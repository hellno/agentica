import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

// Route segment config for dynamic caching
export const dynamic = "force-dynamic"; // Required for query params
export const revalidate = 300; // Fallback revalidation period (5 minutes)

/**
 * Cached function to fetch portfolio data from Zapper
 * Cache duration: 5 minutes (300 seconds)
 * Cache key includes address for granular caching
 */
const getCachedPortfolio = unstable_cache(
  async (address: string) => {
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

    console.log("📤 Calling Zapper GraphQL API (cache miss)");

    const response = await fetch("https://public.zapper.xyz/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-zapper-api-key": process.env.NEXT_PUBLIC_ZAPPER_API_KEY || "",
      },
      body: JSON.stringify({
        query,
        variables: {
          addresses: [address],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Zapper GraphQL error:", errorText);
      throw new Error(
        `Zapper GraphQL error: ${response.status} - ${errorText}`,
      );
    }

    const result = await response.json();
    console.log("✅ Zapper portfolio data received", result.data?.portfolioV2);

    return result.data?.portfolioV2;
  },
  ["zapper-portfolio"], // Cache key namespace
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ["zapper"],
  },
);

/**
 * Zapper GraphQL API endpoint
 * Fetches portfolio data for a given address using Zapper's portfolioV2 query
 * Cached for 5 minutes to reduce API calls
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawAddress = searchParams.get("address");

  console.log("\n🔍 Zapper GraphQL API called");
  console.log("  Address:", rawAddress);

  if (!rawAddress) {
    return NextResponse.json(
      { success: false, error: "Address is required" },
      { status: 400 },
    );
  }

  // Add 0x prefix if not present
  const address = rawAddress.startsWith("0x") ? rawAddress : `0x${rawAddress}`;

  try {
    // Use cached function
    const portfolioData = await getCachedPortfolio(address);

    return NextResponse.json({
      success: true,
      data: portfolioData,
      address,
      cached: true,
    });
  } catch (error) {
    console.error("❌ Error calling Zapper:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Cached function to fetch batch portfolio data from Zapper
 * Cache duration: 5 minutes (300 seconds)
 */
const getCachedBatchPortfolio = unstable_cache(
  async (addresses: string[]) => {
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

    console.log("📤 Calling Zapper GraphQL API for batch (cache miss)");

    const response = await fetch("https://public.zapper.xyz/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      throw new Error(`GraphQL error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Batch fetch complete");

    return result.data?.portfolioV2;
  },
  ["zapper-batch-portfolio"],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ["zapper", "batch"],
  },
);

/**
 * POST endpoint for batch address lookups using GraphQL
 * Cached for 5 minutes to reduce API calls
 */
export async function POST(request: NextRequest) {
  try {
    const { addresses: rawAddresses } = await request.json();

    if (!rawAddresses || !Array.isArray(rawAddresses)) {
      return NextResponse.json(
        { success: false, error: "Addresses array is required" },
        { status: 400 },
      );
    }

    // Add 0x prefix to all addresses
    const addresses = rawAddresses.map((addr) =>
      addr.startsWith("0x") ? addr : `0x${addr}`,
    );

    console.log("\n📦 Batch Zapper GraphQL API called");
    console.log("  Addresses:", addresses.length);

    try {
      // Use cached function for batch portfolio
      const portfolioData = await getCachedBatchPortfolio(addresses);

      return NextResponse.json({
        success: true,
        data: portfolioData,
        count: addresses.length,
        cached: true,
      });
    } catch (error) {
      console.error("❌ Error in batch Zapper GraphQL call:", error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("❌ Error processing request:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
