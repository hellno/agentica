import { createConnectTransport } from "@connectrpc/connect-web";
import { createAuthInterceptor, createClient } from "@edgeandnode/amp";
import { NextRequest, NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_AMP_QUERY_URL || "https://gateway.amp.staging.thegraph.com";

console.log("🔧 API Route Config:");
console.log("  Base URL:", baseUrl);
console.log("  Has API Key:", !!process.env.NEXT_PUBLIC_AMP_API_KEY);

const transport = createConnectTransport({
  baseUrl,
  interceptors: process.env.NEXT_PUBLIC_AMP_API_KEY
    ? [createAuthInterceptor(process.env.NEXT_PUBLIC_AMP_API_KEY)]
    : undefined,
});

const ampClient = createClient(transport);

async function performAmpQuery<T = any>(query: string): Promise<Array<T>> {
  console.log("📡 Starting performAmpQuery...");
  return await new Promise<Array<T>>(async (resolve, reject) => {
    const data: Array<T> = [];
    let batchCount = 0;

    try {
      console.log("🔄 Starting to iterate batches...");
      for await (const batch of ampClient.query(query)) {
        batchCount++;
        console.log(`📦 Received batch ${batchCount}, size:`, batch.length);
        data.push(...batch);
      }
      console.log(`✅ All batches received. Total batches: ${batchCount}, Total rows: ${data.length}`);
      resolve(data);
    } catch (error) {
      console.error("❌ Error in performAmpQuery:", error);
      reject(error);
    }
  });
}

export async function POST(request: NextRequest) {
  console.log("\n🚀 API Route /api/query called");

  try {
    console.log("📥 Parsing request body...");
    const { query } = await request.json();

    if (!query) {
      console.log("⚠️ No query provided");
      return NextResponse.json(
        { success: false, error: "Query is required" },
        { status: 400 }
      );
    }

    console.log("📝 Query received:");
    console.log(query);
    console.log("\n🔍 Executing query...");

    const rows = await performAmpQuery(query);

    console.log("✅ Query successful! Returning", rows.length, "rows");

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("❌ Error executing query:", error);
    console.error("Error details:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        data: [],
      },
      { status: 500 }
    );
  }
}
