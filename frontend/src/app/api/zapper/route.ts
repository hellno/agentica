import { NextRequest, NextResponse } from "next/server";

/**
 * Zapper GraphQL API endpoint
 * Fetches portfolio data for a given address using Zapper's portfolioV2 query
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawAddress = searchParams.get("address");

  console.log("\n🔍 Zapper GraphQL API called");
  console.log("  Address:", rawAddress);

  if (!rawAddress) {
    return NextResponse.json(
      { success: false, error: "Address is required" },
      { status: 400 }
    );
  }

  // Add 0x prefix if not present
  const address = rawAddress.startsWith('0x') ? rawAddress : `0x${rawAddress}`;

  try {
    // Zapper GraphQL query using portfolioV2
    const query = `
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

    console.log("📤 Calling Zapper GraphQL API");

    const response = await fetch("https://public.zapper.xyz/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Zapper uses custom header x-zapper-api-key
        "x-zapper-api-key": process.env.NEXT_PUBLIC_ZAPPER_API_KEY || "",
      },
      body: JSON.stringify({
        query,
        variables: {
          addresses: [address],
        },
      }),
    });

    console.log("📨 Zapper response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Zapper GraphQL error:", errorText);
      return NextResponse.json(
        {
          success: false,
          error: `Zapper GraphQL error: ${response.status}`,
          details: errorText
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("✅ Zapper portfolio data received");

    return NextResponse.json({
      success: true,
      data: result.data?.portfolioV2,
      address,
    });
  } catch (error) {
    console.error("❌ Error calling Zapper:", error);
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
 * POST endpoint for batch address lookups using GraphQL
 */
export async function POST(request: NextRequest) {
  try {
    const { addresses: rawAddresses } = await request.json();

    if (!rawAddresses || !Array.isArray(rawAddresses)) {
      return NextResponse.json(
        { success: false, error: "Addresses array is required" },
        { status: 400 }
      );
    }

    // Add 0x prefix to all addresses
    const addresses = rawAddresses.map(addr =>
      addr.startsWith('0x') ? addr : `0x${addr}`
    );

    console.log("\n📦 Batch Zapper GraphQL API called");
    console.log("  Addresses:", addresses.length);

    // Zapper GraphQL query for multiple addresses
    const query = `
      query PortfolioData($addresses: [Address!]!) {
        portfolioV2(addresses: $addresses, chainIds: [8453]) {
          tokenBalances {
            totalBalanceUSD
            byToken(first: 10) {
              edges {
                node {
                  symbol
                  tokenAddress
                  balance
                  balanceUSD
                  price
                  name
                }
              }
            }
          }
          appBalances {
            totalBalanceUSD
          }
          nftBalances {
            totalBalanceUSD
          }
        }
      }
    `;

    try {
      const response = await fetch("https://public.zapper.xyz/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Zapper uses custom header x-zapper-api-key
          "x-zapper-api-key": process.env.NEXT_PUBLIC_ZAPPER_API_KEY || "",
        },
        body: JSON.stringify({
          query,
          variables: {
            addresses,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { success: false, error: `GraphQL error: ${response.status}`, details: errorText },
          { status: response.status }
        );
      }

      const result = await response.json();
      console.log("✅ Batch fetch complete");

      return NextResponse.json({
        success: true,
        data: result.data?.portfolioV2,
        count: addresses.length,
      });
    } catch (error) {
      console.error("❌ Error in batch Zapper GraphQL call:", error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Error processing request:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
