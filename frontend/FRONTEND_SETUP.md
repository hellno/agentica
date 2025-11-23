# Frontend Setup Guide

**Architecture:** Simplified approach with custom auth (no RLS)

## Overview

This Next.js frontend connects to your Modal backend (Platform API) to create portfolio rooms and manage AI trading agents.

**Key Features:**
- ✅ Custom auth provider integration (bring your own auth)
- ✅ Next.js API proxy pattern (secure, hides backend URLs)
- ✅ No Row Level Security (RLS) - simplified for MVP
- ✅ Service role key access via backend only

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser                                     │
│  ├─ React Components                        │
│  └─ platform-api.ts (client SDK)            │
│           │                                   │
│           ▼                                   │
│  ┌────────────────────────────────────────┐ │
│  │  Next.js API Routes (Server-Side)      │ │
│  │  /api/platform/[...path]               │ │
│  │                                         │ │
│  │  1. Extract user_id from your auth     │ │
│  │  2. Inject into requests               │ │
│  │  3. Proxy to Modal backend             │ │
│  └────────────────────────────────────────┘ │
└──────────────────┼──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Modal Backend (Platform API)               │
│  - Validates user_id ownership              │
│  - Orchestrates ElizaOS + Wallet API        │
│  - Returns filtered data                    │
└─────────────────────────────────────────────┘
```

**Security Benefits:**
1. **Backend URLs hidden** - Never exposed to browser
2. **Auth centralized** - All requests authenticated by Next.js
3. **Ownership validation** - Backend filters by user_id
4. **CORS safe** - Proxy eliminates cross-origin issues

## Setup Steps

### 1. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

**Edit `.env` with your actual URLs:**

```bash
# Get these from Modal deployment
NEXT_PUBLIC_SERVER_URL=https://YOUR_ORG--agentica-platform-eliza-server.modal.run
NEXT_PUBLIC_PLATFORM_API_URL=https://YOUR_ORG--agentica-platform-api.modal.run
```

**How to find your Modal URLs:**
```bash
# Deploy backend first
modal deploy backend/modal_app.py

# Look for output like:
# ✓ Web app created.
# └── https://YOUR_ORG--agentica-platform-api.modal.run
```

### 2. Integrate Your Auth Provider

**CRITICAL:** Replace placeholder `user_id` with your auth system.

**File:** `src/app/api/platform/[...path]/route.ts`

Find these lines:
```typescript
// TODO: Extract user_id from your custom auth provider
// Example: const userId = await getUserIdFromAuth(request);
const userId = searchParams.get("user_id"); // REPLACE THIS
```

**Replace with your auth integration:**

<details>
<summary>Example: NextAuth.js</summary>

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// In GET handler
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = session.user.id;
```
</details>

<details>
<summary>Example: Clerk</summary>

```typescript
import { auth } from "@clerk/nextjs";

// In GET handler
const { userId } = auth();
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```
</details>

<details>
<summary>Example: Supabase Auth (if you choose to use it)</summary>

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// In GET handler
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies }
);

const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = user.id;
```
</details>

<details>
<summary>Example: Custom JWT</summary>

```typescript
import jwt from "jsonwebtoken";

// In GET handler
const token = request.headers.get("Authorization")?.replace("Bearer ", "");
if (!token) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!);
  const userId = decoded.sub || decoded.userId;
} catch (error) {
  return NextResponse.json({ error: "Invalid token" }, { status: 401 });
}
```
</details>

### 3. Install Dependencies

```bash
cd frontend
bun install  # or npm install
```

### 4. Run Development Server

```bash
bun run dev  # Runs on port 4000
```

## Usage Examples

### Create Portfolio Room

**React Component:** See `src/components/CreateRoomForm.tsx`

**Client-side code:**
```typescript
import { createRoom } from "@/lib/platform-api";

const result = await createRoom({
  name: "Conservative BTC DCA",
  description: "A conservative Bitcoin accumulation strategy",
  prompt: "Buy $100 of BTC weekly when price is below $95k. Keep 20% cash reserves.",
  frequency: "daily"
});

console.log("Room created:", result.data.room_id);
console.log("Wallet address:", result.data.wallet_address);
console.log("AI-generated strategy:", result.data.generated_strategy);
```

**What happens:**
1. `createRoom()` calls `/api/platform/rooms` (Next.js proxy)
2. Proxy extracts `user_id` from your auth
3. Proxy forwards to Modal Platform API with auth
4. Modal orchestrates:
   - Generates AI strategy with OpenAI
   - Creates wallet via Wallet API
   - Creates strategy agent in ElizaOS
   - Creates ElizaOS room
   - Stores metadata in Supabase
5. Returns room details and wallet address

### List User's Rooms

```typescript
import { getRooms } from "@/lib/platform-api";

const rooms = await getRooms();
console.log(`You have ${rooms.length} portfolio rooms`);
```

### Execute Wallet Actions

**Check balance:**
```typescript
import { getWalletBalance } from "@/lib/platform-api";

const result = await getWalletBalance(roomId);
console.log("Wallet address:", result.result.address);
```

**Transfer tokens:**
```typescript
import { transferTokens } from "@/lib/platform-api";

const result = await transferTokens(
  roomId,
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "10", // 10 USDC
  "USDC"
);
console.log("Transaction hash:", result.result.tx_hash);
```

**View transaction history:**
```typescript
import { getWalletTransactions } from "@/lib/platform-api";

const { transactions, total } = await getWalletTransactions(roomId, {
  limit: 20,
  offset: 0,
  status: "success"
});

console.log(`Showing ${transactions.length} of ${total} transactions`);
```

## File Structure

```
frontend/src/
├── app/
│   ├── api/
│   │   ├── eliza/[...path]/       # ElizaOS proxy (existing)
│   │   └── platform/[...path]/    # Platform API proxy (NEW)
│   │       └── route.ts            # Proxy implementation
│   └── ...                         # Your Next.js pages
├── components/
│   └── CreateRoomForm.tsx          # Example component (NEW)
└── lib/
    ├── platform-api.ts             # Client SDK for Platform API (NEW)
    ├── api-client.ts               # ElizaOS client (existing)
    └── socketio-manager.ts         # Socket.IO client (existing)
```

## API Routes Reference

### Platform API Proxy Routes

All routes require authentication (user_id from your auth provider).

**Create room:**
```
POST /api/platform/rooms
Body: { name, description?, prompt, frequency }
Returns: { room_id, wallet_address, generated_strategy, ... }
```

**List rooms:**
```
GET /api/platform/rooms
Returns: [{ id, name, wallet_address, ... }]
```

**Execute wallet action:**
```
POST /api/platform/wallets/{room_id}/{action}
Body: { params: { ... } }
Actions: balance, transfer, swap
Returns: { success, transaction_id, result, ... }
```

**Get transactions:**
```
GET /api/platform/wallets/{room_id}/transactions?limit=20&offset=0&status=success
Returns: { transactions: [...], total: 123 }
```

### ElizaOS Proxy Routes (Existing)

**Chat with agent:**
```
POST /api/eliza/messaging/submit
Body: { roomId, text, userId }
```

**List agents:**
```
GET /api/eliza/agents
```

## Security Notes

### ✅ Secure Patterns

1. **Always use proxy routes** - Never call Modal URLs directly from browser
2. **Extract user_id server-side** - Never trust client-provided user_id
3. **Validate ownership** - Backend checks user_id matches room owner
4. **Use HTTPS in production** - Encrypt all traffic

### ❌ Anti-Patterns (Avoid)

1. **Direct Modal API calls from browser** - Exposes backend URLs
2. **Client-side user_id** - Easy to spoof
3. **Hardcoded URLs** - Use environment variables
4. **Exposing service role keys** - Keep in backend only

## Troubleshooting

### "Failed to connect to platform API"

**Cause:** Backend URL not configured or incorrect

**Fix:**
1. Check `.env` file has `NEXT_PUBLIC_PLATFORM_API_URL`
2. Verify URL matches Modal deployment output
3. Ensure no trailing slashes

### "Unauthorized - user_id required"

**Cause:** Auth integration not completed

**Fix:**
1. Replace placeholder `user_id` extraction in proxy route
2. Verify your auth provider returns user ID
3. Check session/JWT is valid

### "Room not found"

**Cause:** User trying to access room they don't own

**Fix:**
- Backend validates `user_id` matches room owner
- Ensure you're logged in as correct user
- Check database: `SELECT * FROM platform_rooms WHERE user_id = 'xxx'`

## Next Steps

1. **Integrate auth** - Replace placeholder user_id with your auth system
2. **Test room creation** - Use `CreateRoomForm.tsx` component
3. **Build portfolio UI** - List rooms, show wallet balances, display transactions
4. **Add chat interface** - Use existing ElizaOS integration for agent chat

## Additional Resources

- **Backend API docs:** See `backend/PRD.md`
- **ElizaOS integration:** See `frontend/CLAUDE.md`
- **Database schema:** See `backend/db/platform_rooms_schema.sql`
