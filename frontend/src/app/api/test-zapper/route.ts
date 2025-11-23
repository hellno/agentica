import { NextRequest, NextResponse } from "next/server";

/**
 * Simple test endpoint - just Zapper, no AMP
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address") || "0xadcc96b0bd79388ad549edd638a3137587ed07d0";

  console.log("\n🧪 Testing Zapper API only");
  console.log("   Address:", address);
  console.log("   API Key present:", !!process.env.NEXT_PUBLIC_ZAPPER_API_KEY);

  const query = `
    query TokenBalances($addresses: [Address!]!, $chainIds: [Int!]) {
      portfolioV2(addresses: $addresses, chainIds: $chainIds) {
        tokenBalances {
          totalBalanceUSD
          byToken(first: 20) {
            totalCount
            edges {
              node {
                symbol
                name
                tokenAddress
                balance
                balanceUSD
                price
                imgUrlV2
                network {
                  name
                  chainId
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    console.log("📤 Calling Zapper GraphQL...");

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
          chainIds: [8453], // Base
        },
      }),
    });

    console.log("📨 Zapper response status:", response.status);

    const result = await response.json();
    console.log("📦 Full response:");
    console.log(JSON.stringify(result, null, 2));

    if (result.errors) {
      console.error("❌ GraphQL errors:", result.errors);
      return NextResponse.json({
        success: false,
        errors: result.errors,
      });
    }

    if (result.data?.portfolioV2?.tokenBalances) {
      const balances = result.data.portfolioV2.tokenBalances;
      console.log("✅ Success!");
      console.log(`   Total Balance USD: $${balances.totalBalanceUSD}`);
      console.log(`   Total Tokens: ${balances.byToken?.totalCount || 0}`);

      return NextResponse.json({
        success: true,
        address,
        data: balances,
      });
    }

    return NextResponse.json({
      success: false,
      message: "No data returned",
      rawResponse: result,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
