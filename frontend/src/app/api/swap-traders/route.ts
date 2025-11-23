import { NextRequest, NextResponse } from "next/server";
import { createConnectTransport } from "@connectrpc/connect-web";
import { createAuthInterceptor, createClient } from "@edgeandnode/amp";

/**
 * Combined API: Get swap events from AMP → Extract traders → Fetch Zapper data
 *
 * Flow:
 * 1. Query Uniswap V3 Base swaps from The Graph AMP
 * 2. Extract unique sender addresses
 * 3. For each sender, fetch their trading data from Zapper
 * 4. Return combined results
 */

const baseUrl = process.env.NEXT_PUBLIC_AMP_QUERY_URL || "https://gateway.amp.staging.thegraph.com";

const transport = createConnectTransport({
  baseUrl,
  interceptors: process.env.NEXT_PUBLIC_AMP_API_KEY
    ? [createAuthInterceptor(process.env.NEXT_PUBLIC_AMP_API_KEY)]
    : undefined,
});

const ampClient = createClient(transport);

async function performAmpQuery<T = any>(query: string): Promise<Array<T>> {
  return await new Promise<Array<T>>(async (resolve, reject) => {
    const data: Array<T> = [];
    try {
      for await (const batch of ampClient.query(query)) {
        data.push(...batch);
      }
      resolve(data);
    } catch (error) {
      reject(error);
    }
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get("limit") || "100";
  const includeZapper = searchParams.get("includeZapper") !== "false"; // default true

  console.log("\n🚀 Swap Traders API called");
  console.log("  Limit:", limit);
  console.log("  Include Zapper:", includeZapper);

  try {
    // Step 1: Get swap events from The Graph AMP
    console.log("\n📊 Step 1: Fetching swap events from AMP...");
    const query = `
      SELECT *
      FROM "edgeandnode/uniswap_v3_base@0.0.1"."event__swap"
      ORDER BY _block_num DESC
      LIMIT 200;
    `;

    const swapEvents = await performAmpQuery(query);
    console.log(`✅ Fetched ${swapEvents.length} swap events`);

    // Step 2: Extract unique sender addresses
    console.log("\n👥 Step 2: Extracting sender addresses...");
    const senders = new Set<string>();
    swapEvents.forEach((swap: any) => {
      if (swap.event?.sender) {
        // Add 0x prefix if not present
        const sender = swap.event.sender.startsWith('0x')
          ? swap.event.sender
          : `0x${swap.event.sender}`;
        senders.add(sender.toLowerCase());
      }
    });

    const uniqueSenders = Array.from(senders);
    console.log(`✅ Found ${uniqueSenders.length} unique senders`);

    // Step 3: Optionally fetch Zapper data for each sender
    let zapperData = null;
    if (includeZapper && uniqueSenders.length > 0) {
      console.log("\n💰 Step 3: Fetching Zapper data for senders...");

      // Take top 10 senders to avoid rate limits
      const sendersToFetch = uniqueSenders.slice(0, 10);
      console.log(`  Fetching for ${sendersToFetch.length} senders`);

      // Zapper GraphQL query
      const zapperQuery = `
        query PortfolioData($addresses: [Address!]!) {
          portfolioV2(addresses: $addresses, chainIds: [8453]) {
            tokenBalances {
              totalBalanceUSD
              byToken(first: 10) {
                totalCount
                edges {
                  node {
                    symbol
                    tokenAddress
                    balance
                    balanceUSD
                    price
                    name
                    network {
                      name
                    }
                  }
                }
              }
            }
            appBalances {
              totalBalanceUSD
              byApp(first: 5) {
                edges {
                  node {
                    app {
                      displayName
                      slug
                    }
                    balanceUSD
                  }
                }
              }
            }
          }
        }
      `;

      try {
        console.log(`📤 Calling Zapper GraphQL with ${sendersToFetch.length} addresses`);
        console.log(`   First address: ${sendersToFetch[0]}`);
        console.log(`   API Key present: ${!!process.env.NEXT_PUBLIC_ZAPPER_API_KEY}`);

        const response = await fetch("https://public.zapper.xyz/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Zapper uses custom header x-zapper-api-key
            "x-zapper-api-key": process.env.NEXT_PUBLIC_ZAPPER_API_KEY || "",
          },
          body: JSON.stringify({
            query: zapperQuery,
            variables: {
              addresses: sendersToFetch,
            },
          }),
        });

        console.log(`📨 Zapper response status: ${response.status}`);

        if (response.ok) {
          const result = await response.json();
          console.log("📦 Zapper response:", JSON.stringify(result, null, 2));

          if (result.errors) {
            console.error("❌ Zapper GraphQL errors:", result.errors);
          }

          zapperData = result.data?.portfolioV2;
          console.log(`✅ Fetched Zapper portfolio data:`, zapperData ? "Data present" : "No data");
        } else {
          const errorText = await response.text();
          console.error(`❌ Zapper GraphQL failed: ${response.status}`);
          console.error(`   Error body: ${errorText}`);
        }
      } catch (error) {
        console.error("❌ Zapper GraphQL error:", error);
        console.error("   Error details:", error instanceof Error ? error.stack : error);
      }
    }

    // Return combined results
    return NextResponse.json({
      success: true,
      data: {
        swapEvents,
        senders: uniqueSenders,
        zapperData,
      },
      stats: {
        totalSwaps: swapEvents.length,
        uniqueSenders: uniqueSenders.length,
        zapperFetched: zapperData ? zapperData.length : 0,
      },
    });
  } catch (error) {
    console.error("❌ Error in swap traders API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to get specific sender's details
 */
export async function POST(request: NextRequest) {
  try {
    const { sender: rawSender } = await request.json();

    if (!rawSender) {
      return NextResponse.json(
        { success: false, error: "Sender address is required" },
        { status: 400 }
      );
    }

    // Add 0x prefix if not present
    const sender = rawSender.startsWith('0x') ? rawSender : `0x${rawSender}`;
    console.log("\n🔍 Fetching details for sender:", sender);

    // Get the raw sender without 0x for AMP query (use hex literal)
    const rawSenderForQuery = sender.replace('0x', '').toLowerCase();

    // Get swap events for this specific sender
    // Use hex literal x'...' for binary address comparison
    const query = `
      SELECT *
      FROM "edgeandnode/uniswap_v3_base@0.0.1"."event__swap"
      WHERE event.sender = x'${rawSenderForQuery}'
      ORDER BY _block_num DESC
      LIMIT 100;
    `;

    const swapEvents = await performAmpQuery(query);
    console.log(`✅ Found ${swapEvents.length} swaps for sender`);

    // Get Zapper data using GraphQL
    console.log("💰 Fetching Zapper portfolio data...");
    const zapperQuery = `
      query PortfolioData($addresses: [Address!]!) {
        portfolioV2(addresses: $addresses, chainIds: [8453]) {
          tokenBalances {
            totalBalanceUSD
            byToken(first: 20) {
              totalCount
              edges {
                node {
                  symbol
                  tokenAddress
                  balance
                  balanceUSD
                  price
                  name
                  network {
                    name
                  }
                }
              }
            }
          }
          appBalances {
            totalBalanceUSD
            byApp(first: 10) {
              edges {
                node {
                  app {
                    displayName
                    slug
                    imgUrl
                  }
                  balanceUSD
                  network {
                    name
                  }
                }
              }
            }
          }
          nftBalances {
            totalBalanceUSD
            totalTokensOwned
          }
        }
      }
    `;

    let zapperData = null;
    try {
      console.log("📤 Calling Zapper GraphQL for sender:", sender);
      console.log("   API Key present:", !!process.env.NEXT_PUBLIC_ZAPPER_API_KEY);

      const zapperResponse = await fetch("https://public.zapper.xyz/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Zapper uses custom header x-zapper-api-key
          "x-zapper-api-key": process.env.NEXT_PUBLIC_ZAPPER_API_KEY || "",
        },
        body: JSON.stringify({
          query: zapperQuery,
          variables: {
            addresses: [sender],
          },
        }),
      });

      console.log("📨 Zapper response status:", zapperResponse.status);

      if (zapperResponse.ok) {
        const result = await zapperResponse.json();
        console.log("📦 Zapper response:", JSON.stringify(result, null, 2));

        if (result.errors) {
          console.error("❌ Zapper GraphQL errors:", result.errors);
        }

        zapperData = result.data?.portfolioV2;
        console.log("✅ Zapper portfolio data fetched:", zapperData ? "Data present" : "No data");
      } else {
        const errorText = await zapperResponse.text();
        console.error("❌ Zapper GraphQL failed:", zapperResponse.status);
        console.error("   Error body:", errorText);
      }
    } catch (error) {
      console.error("❌ Zapper GraphQL error:", error);
      console.error("   Error details:", error instanceof Error ? error.stack : error);
    }

    return NextResponse.json({
      success: true,
      sender,
      data: {
        swapEvents,
        zapperData,
      },
      stats: {
        totalSwaps: swapEvents.length,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching sender details:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
