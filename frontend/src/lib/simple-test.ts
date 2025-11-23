/**
 * Simple Test - Single Query Only
 * Testing address: 0x6d9fFaede2c6CD9bb48becE230ad589e0E0D981c
 */

/**
 * Test query for Ethereum mainnet transactions
 * Note: Ethereum mainnet uses: block_number, hash, from_address, to_address
 */
export async function testSingleQuery() {
  const address = "0x6d9fFaede2c6CD9bb48becE230ad589e0E0D981c";

  // Ethereum mainnet schema uses: block_number, hash, from_address, to_address
  const query = `
   SELECT * FROM "edgeandnode/uniswap_v3_base@0.0.1"."event__swap" ORDER BY _block_num DESC LIMIT 100;
  `;

  console.log("🔍 Executing query for address:", address);
  console.log("Query:", query);

  try {
    console.log("⏳ Fetching results...");
    console.log("📤 Sending POST request to /api/query");

    // Call the API route instead of direct client (avoids CORS)
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    console.log("📨 Response received, status:", response.status);
    console.log("📨 Response ok:", response.ok);

    const result = await response.json();
    console.log("📦 Result parsed:", result);

    if (result.success) {
      console.log("✅ Success! Found", result.count, "transactions");
      if (result.data.length > 0) {
        console.log("\nFirst result:");
        console.log(JSON.stringify(result.data[0], null, 2));
      }
    } else {
      console.error("❌ Query failed:", result.error);
    }

    return result;
  } catch (error) {
    console.error("❌ Error in testSingleQuery:", error);
    console.error("Error type:", typeof error);
    console.error("Error details:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: [],
    };
  }
}
