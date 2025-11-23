import { NextRequest, NextResponse } from "next/server";

// Route segment config for dynamic caching
export const dynamic = "force-dynamic"; // Required for query params
export const revalidate = 300; // Fallback revalidation period (5 minutes)

// Simple in-memory cache with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const portfolioCache = new Map<string, CacheEntry<any>>();
const batchCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

function getCachedData<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  console.log(`[Cache] Hit for key: ${key.substring(0, 20)}... (age: ${Math.round(age / 1000)}s)`);
  return entry.data;
}

function setCachedData<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`[Cache] Set for key: ${key.substring(0, 20)}...`);
}

/**
 * Fetch portfolio data from Zapper (with in-memory caching)
 * Cache duration: 5 minutes
 */
async function fetchPortfolioData(address: string) {
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
    console.log("✅ Zapper portfolio data received");

    return result.data?.portfolioV2;
}

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
    // Check cache first
    const cached = getCachedData(portfolioCache, address);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        address,
        cached: true,
      });
    }

    // Fetch fresh data
    const portfolioData = await fetchPortfolioData(address);

    // Cache the result
    setCachedData(portfolioCache, address, portfolioData);

    return NextResponse.json({
      success: true,
      data: portfolioData,
      address,
      cached: false,
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
 * Fetch batch portfolio data from Zapper (with in-memory caching)
 * Cache duration: 5 minutes
 */
async function fetchBatchPortfolioData(addresses: string[]) {
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
}

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
      // Use addresses as cache key (sorted for consistency)
      const cacheKey = addresses.sort().join(',');

      // Check cache first
      const cached = getCachedData(batchCache, cacheKey);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          count: addresses.length,
          cached: true,
        });
      }

      // Fetch fresh data
      const portfolioData = await fetchBatchPortfolioData(addresses);

      // Cache the result
      setCachedData(batchCache, cacheKey, portfolioData);

      return NextResponse.json({
        success: true,
        data: portfolioData,
        count: addresses.length,
        cached: false,
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
