import { NextRequest, NextResponse } from "next/server";

// Platform API URL from environment variable
const PLATFORM_API_URL = process.env.NEXT_PUBLIC_PLATFORM_API_URL;

if (!PLATFORM_API_URL) {
  throw new Error("NEXT_PUBLIC_PLATFORM_API_URL environment variable is not set");
}

/**
 * Proxy for Platform API (Modal Backend)
 *
 * Routes:
 * - POST /api/platform/rooms → Modal POST /rooms
 * - GET /api/platform/rooms → Modal GET /rooms?user_id=xxx
 * - POST /api/platform/wallets/{room_id}/transfer → Modal POST /wallets/{room_id}/transfer
 *
 * Auth: Extract user_id from your custom auth provider and inject into requests
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join("/");
    const searchParams = request.nextUrl.searchParams;

    // TODO: Extract user_id from your custom auth provider
    // Example: const userId = await getUserIdFromAuth(request);
    // For now, using query param (REPLACE THIS WITH YOUR AUTH)
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - user_id required" },
        { status: 401 }
      );
    }

    // Add user_id to query params
    searchParams.set("user_id", userId);
    const query = searchParams.toString();
    const platformUrl = `${PLATFORM_API_URL}/${path}${query ? `?${query}` : ""}`;

    console.log(`[Platform Proxy] GET ${platformUrl}`);

    const response = await fetch(platformUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("[Platform Proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to platform API" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join("/");
    const body = await request.json();

    // TODO: Extract user_id from your custom auth provider
    // Example: const userId = await getUserIdFromAuth(request);
    // For now, using body.user_id (REPLACE THIS WITH YOUR AUTH)
    const userId = body.user_id;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - user_id required" },
        { status: 401 }
      );
    }

    // Inject user_id into body (backend validates ownership)
    const bodyWithAuth = { ...body, user_id: userId };
    const platformUrl = `${PLATFORM_API_URL}/${path}`;

    console.log(`[Platform Proxy] POST ${platformUrl}`);

    const response = await fetch(platformUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(bodyWithAuth),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("[Platform Proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to platform API" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
