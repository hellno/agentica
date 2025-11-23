import { NextRequest, NextResponse } from "next/server";

/**
 * Zapper Transaction History API - Get recent swaps
 *
 * GET /api/zapper-swaps?address=0x...&timeRange=5m
 * GET /api/zapper-swaps?address=0x...&startTime=123456&endTime=789012
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawAddress = searchParams.get("address");
  const timeRange = searchParams.get("timeRange") || "5m"; // 5m, 1h, 24h, 7d
  const networks = searchParams.get("networks")?.split(",") || ["BASE_MAINNET"];

  if (!rawAddress) {
    return NextResponse.json(
      { success: false, error: "Address is required" },
      { status: 400 }
    );
  }

  const address = rawAddress.startsWith('0x') ? rawAddress : `0x${rawAddress}`;

  // Calculate time range (Zapper uses ISO 8601 date strings)
  const now = new Date();
  const endDate = now.toISOString();
  let startDate: string;

  switch (timeRange) {
    case "5m":
      startDate = new Date(now.getTime() - (5 * 60 * 1000)).toISOString();
      break;
    case "1h":
      startDate = new Date(now.getTime() - (60 * 60 * 1000)).toISOString();
      break;
    case "24h":
      startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
      break;
    case "7d":
      startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      break;
    default:
      startDate = new Date(now.getTime() - (5 * 60 * 1000)).toISOString();
  }

  console.log("\n💱 Fetching swap history from Zapper");
  console.log(`   Address: ${address}`);
  console.log(`   Time range: ${timeRange}`);
  console.log(`   Networks: ${networks.join(", ")}`);

  const query = `
    query GetRecentSwaps(
      $subjects: [Address!]!
      $first: Int
      $filters: TransactionHistoryV2FiltersArgs
    ) {
      transactionHistoryV2(
        subjects: $subjects
        perspective: All
        first: $first
        filters: $filters
      ) {
        edges {
          node {
            ... on TimelineEventV2 {
              hash
              network
              timestamp
              transaction {
                blockNumber
                hash
                network
                timestamp
                fromUser {
                  address
                }
                toUser {
                  address
                }
              }
              interpretation {
                processedDescription
                description
                descriptionDisplayItems {
                  ... on TokenDisplayItem {
                    type
                    tokenAddress
                    amountRaw
                    tokenV2 {
                      symbol
                      name
                      decimals
                      imageUrlV2
                      priceData {
                        price
                      }
                    }
                  }
                }
              }
              deltas {
                edges {
                  node {
                    account {
                      address
                    }
                    tokenDeltasV2 {
                      edges {
                        node {
                          amount
                          amountRaw
                          token {
                            address
                            symbol
                            name
                            decimals
                            imageUrlV2
                            priceData {
                              price
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            ... on ActivityTimelineEventDelta {
              transactionHash
              transactionBlockTimestamp
              network
              subject
              from {
                address
              }
              to {
                address
              }
              fungibleDeltas {
                amount
                amountRaw
                token {
                  address
                  symbol
                  name
                  decimals
                  imageUrlV2
                  priceData {
                    price
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  try {
    const response = await fetch("https://public.zapper.xyz/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-zapper-api-key": process.env.NEXT_PUBLIC_ZAPPER_API_KEY || "",
      },
      body: JSON.stringify({
        query,
        variables: {
          subjects: [address],
          first: 20, // Zapper maximum limit
          filters: {
            categories: ["Swap"],
            orderByDirection: "DESC",
            chainIds: [8453], // Base network
            startDate,
            endDate,
          },
        },
      }),
    });

    console.log(`📨 Zapper response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Zapper error:", errorText);
      return NextResponse.json(
        { success: false, error: `HTTP ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (result.errors) {
      console.error("❌ GraphQL errors:", result.errors);
      return NextResponse.json({
        success: false,
        errors: result.errors,
      });
    }

    // Process swaps
    const swaps: any[] = [];
    const transactions = result.data?.transactionHistoryV2?.edges || [];

    transactions.forEach(({ node }: any) => {
      // Handle TimelineEventV2 nodes
      if (node.interpretation) {
        const swapInfo: any = {
          hash: node.hash,
          timestamp: node.timestamp,
          network: node.network,
          description: node.interpretation.processedDescription,
          from: node.transaction?.fromUser?.address,
          to: node.transaction?.toUser?.address,
          blockNumber: node.transaction?.blockNumber,
          tokens: [],
        };

        // Extract tokens from deltas
        if (node.deltas?.edges) {
          node.deltas.edges.forEach(({ node: deltaNode }: any) => {
            if (deltaNode.tokenDeltasV2?.edges) {
              deltaNode.tokenDeltasV2.edges.forEach(({ node: tokenDelta }: any) => {
                if (tokenDelta.token) {
                  const amount = parseFloat(tokenDelta.amount);
                  swapInfo.tokens.push({
                    symbol: tokenDelta.token.symbol,
                    name: tokenDelta.token.name,
                    address: tokenDelta.token.address,
                    amount: tokenDelta.amount,
                    amountRaw: tokenDelta.amountRaw,
                    type: amount < 0 ? 'sent' : 'received',
                    imageUrl: tokenDelta.token.imageUrlV2,
                    usdValue: tokenDelta.token.priceData?.price ? Math.abs(amount) * tokenDelta.token.priceData.price : null,
                  });
                }
              });
            }
          });
        }

        swaps.push(swapInfo);
      }
      // Handle ActivityTimelineEventDelta nodes
      else if (node.fungibleDeltas) {
        const swapInfo: any = {
          hash: node.transactionHash,
          timestamp: node.transactionBlockTimestamp,
          network: node.network,
          description: 'Swap transaction',
          from: node.from?.address,
          to: node.to?.address,
          blockNumber: null,
          tokens: [],
        };

        // Extract tokens from fungibleDeltas
        node.fungibleDeltas.forEach((delta: any) => {
          if (delta.token) {
            const amount = parseFloat(delta.amount);
            swapInfo.tokens.push({
              symbol: delta.token.symbol,
              name: delta.token.name,
              address: delta.token.address,
              amount: delta.amount,
              amountRaw: delta.amountRaw,
              type: amount < 0 ? 'sent' : 'received',
              imageUrl: delta.token.imageUrlV2,
              usdValue: delta.token.priceData?.price ? Math.abs(amount) * delta.token.priceData.price : null,
            });
          }
        });

        swaps.push(swapInfo);
      }
    });

    console.log(`✅ Found ${swaps.length} swaps in last ${timeRange}`);

    return NextResponse.json({
      success: true,
      address,
      timeRange,
      count: swaps.length,
      swaps,
      hasNextPage: result.data?.transactionHistoryV2?.pageInfo?.hasNextPage,
    });
  } catch (error) {
    console.error("❌ Error fetching swaps:", error);
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
 * POST - Batch fetch swaps for multiple addresses
 */
export async function POST(request: NextRequest) {
  try {
    const { addresses, timeRange = "5m", networks = ["BASE_MAINNET"] } = await request.json();

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { success: false, error: "Addresses array is required" },
        { status: 400 }
      );
    }

    console.log(`\n💱 Batch fetching swaps for ${addresses.length} addresses`);

    // Calculate time
    const now = Date.now();
    const timeMs = timeRange === "5m" ? 5 * 60 * 1000 : 60 * 60 * 1000;
    const startTime = now - timeMs;

    // Fetch for all addresses in parallel
    const results = await Promise.all(
      addresses.map(async (addr: string) => {
        const address = addr.startsWith('0x') ? addr : `0x${addr}`;

        try {
          const response = await fetch(`${request.nextUrl.origin}/api/zapper-swaps?address=${address}&timeRange=${timeRange}&networks=${networks.join(",")}`, {
            headers: {
              "x-zapper-api-key": process.env.NEXT_PUBLIC_ZAPPER_API_KEY || "",
            },
          });

          return await response.json();
        } catch (error) {
          return {
            success: false,
            address,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      results,
      totalAddresses: addresses.length,
    });
  } catch (error) {
    console.error("❌ Batch swap fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
