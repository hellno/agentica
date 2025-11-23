import { NextRequest, NextResponse } from 'next/server';

/**
 * Get message history for a channel
 * GET /api/eliza/central-channels/{channelId}/messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';

    console.log('[API Proxy] GET messages for channel:', channelId);

    // Forward to ElizaOS server
    const elizaUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';
    const url = `${elizaUrl}/api/messaging/central-channels/${channelId}/messages?limit=${limit}`;

    console.log('[API Proxy] Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[API Proxy] ElizaOS error:', response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[API Proxy] Fetched', data?.data?.messages?.length || 0, 'messages');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error fetching messages:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages'
      },
      { status: 500 }
    );
  }
}

/**
 * Proxy for ElizaOS central-channels messages endpoint
 * POST /api/messaging/central-channels/{channelId}/messages
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const body = await request.json();

    console.log('[API Proxy] POST central-channels message:', {
      channelId,
      author_id: body.author_id,
      content: body.content?.substring(0, 50),
    });

    // Forward to ElizaOS server
    const elizaUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';
    const url = `${elizaUrl}/api/messaging/central-channels/${channelId}/messages`;

    console.log('[API Proxy] Forwarding to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[API Proxy] ElizaOS error:', response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[API Proxy] Message sent successfully');
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error proxying central-channels message:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      },
      { status: 500 }
    );
  }
}
