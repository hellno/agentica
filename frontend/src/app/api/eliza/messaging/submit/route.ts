import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for ElizaOS messaging/submit endpoint
 * Handles CORS by proxying browser requests through Next.js server
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[API Proxy] Received request body:', JSON.stringify(body, null, 2));
    console.log('[API Proxy] Body keys:', Object.keys(body));

    // Forward to ElizaOS server
    const elizaUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';
    console.log('[API Proxy] Forwarding to:', `${elizaUrl}/api/messaging/submit`);

    const response = await fetch(`${elizaUrl}/api/messaging/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error proxying message submit:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit message'
      },
      { status: 500 }
    );
  }
}
