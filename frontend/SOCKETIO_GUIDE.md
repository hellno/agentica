# Socket.IO Chat Implementation Guide

This guide explains how to read and write messages in group conversations using the existing Socket.IO implementation.

## 🔑 Key Files to Check Out

### 1. **Core Socket.IO Manager**
**`src/lib/socketio-manager.ts`** (685 lines)
- **What it does:** Singleton class that manages Socket.IO connection and real-time events
- **Key features:**
  - Connects to ElizaOS server via WebSocket
  - Handles message broadcasting, control messages, and channel management
  - Event-based architecture using `Evt` library

### 2. **Main Chat Component**
**`src/components/chat-simple.tsx`** (753 lines)
- **What it does:** Full-featured chat UI with Socket.IO integration
- **Key features:**
  - Manages chat sessions and message history
  - Listens for incoming messages via Socket.IO
  - Sends messages through Socket.IO manager

### 3. **API Client**
**`src/lib/api-client.ts`** (587 lines)
- **What it does:** REST API wrapper for ElizaOS backend operations
- **Handles:** Session management, message history, agent participation

---

## 📡 How Messages Flow (Group Conversation)

### **Reading Messages (Receiving)**

```typescript
// 1. Initialize Socket.IO connection (chat-simple.tsx:281)
socketIOManager.initialize(userEntity, serverId);

// 2. Join a channel to receive messages (chat-simple.tsx:205)
await socketIOManager.joinChannel(centralChannelId);

// 3. Listen for incoming messages (chat-simple.tsx:312-344)
const handleMessageBroadcast = (data: MessageBroadcastData) => {
  // Skip your own messages to avoid duplicates
  if (data.senderId === userEntity) return;

  // Add message to UI
  const message: ChatMessage = {
    id: data.id || uuidv4(),
    name: data.senderName,
    text: data.text,
    senderId: data.senderId,
    createdAt: data.createdAt || Date.now(),
    // ... more fields
  };

  setMessages((prev) => [...prev, message]);
};

socketIOManager.on("messageBroadcast", handleMessageBroadcast);
```

### **Writing Messages (Sending)**

```typescript
// From chat-simple.tsx:449-478
const handleSendMessage = async () => {
  // 1. Create optimistic message for instant UI feedback
  const newMessage: ChatMessage = {
    id: uuidv4(),
    name: USER_NAME,
    text: input,
    senderId: userEntity!,
    createdAt: Date.now(),
    source: CHAT_SOURCE,
    isLoading: true,
  };

  setMessages((prev) => [...prev, newMessage]);

  // 2. Send via Socket.IO to the centralized channel
  await socketIOManager.sendChannelMessage(
    input,
    centralChannelId,  // Where all messages go
    CHAT_SOURCE,
    channelId,         // Your session channel ID
    serverId
  );
};
```

---

## 🎯 Key Concepts

### **1. Central Channel Pattern**
```typescript
// All messages go through a central "bus" channel
const centralChannelId = "00000000-0000-0000-0000-000000000000";

// Your session gets its own channel ID for filtering
const sessionChannelId = "abc-123-def-456...";
```

### **2. User Entity (Persistent Identity)**
```typescript
// Stored in localStorage for consistent identity (chat-simple.tsx:101-112)
const storedEntity = localStorage.getItem("elizaHowUserEntity");
if (!storedEntity) {
  const newEntity = uuidv4();
  localStorage.setItem("elizaHowUserEntity", newEntity);
}
```

### **3. Message Types**
```typescript
// From socketio-manager.ts:22-36
type MessageBroadcastData = {
  senderId: string;      // Who sent it
  senderName: string;    // Display name
  text: string;          // Message content
  channelId: string;     // Which channel
  createdAt: number;     // Timestamp
  source: string;        // Where it came from
  thought?: string;      // Agent's thinking (optional)
  actions?: string[];    // Agent actions (optional)
};
```

---

## 🛠️ Quick Implementation Guide

### **To Read Messages from a Group:**

```typescript
// 1. Get the SocketIOManager instance
const socketIOManager = SocketIOManager.getInstance();

// 2. Initialize with your user ID
socketIOManager.initialize(yourUserId, serverId);

// 3. Join the channel
await socketIOManager.joinChannel(channelId);

// 4. Listen for messages
socketIOManager.on("messageBroadcast", (data) => {
  if (data.senderId !== yourUserId) {
    // Display the message
    console.log(`${data.senderName}: ${data.text}`);
  }
});
```

### **To Send Messages to a Group:**

```typescript
// Send a message to the central channel
await socketIOManager.sendChannelMessage(
  messageText,           // Your message
  centralChannelId,      // "00000000-0000-0000-0000-000000000000"
  "my_app",             // Source identifier
  sessionChannelId,      // Your session/group ID
  serverId              // Server ID
);
```

---

## 📂 File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/socketio-manager.ts` | Socket.IO connection & events | 685 |
| `src/components/chat-simple.tsx` | Main chat UI | 753 |
| `src/components/chat-messages.tsx` | Message list display | 174 |
| `src/components/chat-message.tsx` | Individual message UI | 231 |
| `src/lib/api-client.ts` | REST API calls | 587 |
| `src/types/chat-message.ts` | Message type definitions | 12 |

---

## 🚀 Getting Started

**Start with:** `chat-simple.tsx` (lines 280-478) to see the full flow of connecting, listening, and sending messages!

### Initialization Flow

1. **User Entity Setup** (lines 101-112)
   - Creates/retrieves persistent user ID from localStorage

2. **Connection Setup** (lines 234-301)
   - Adds agent to centralized channel
   - Initializes Socket.IO connection
   - Waits for connection confirmation

3. **Event Listeners** (lines 304-381)
   - `messageBroadcast` - Incoming messages
   - `controlMessage` - UI control (enable/disable input)
   - Filters out own messages to prevent duplicates

4. **Message Sending** (lines 449-478)
   - Optimistic UI update
   - Send through Socket.IO
   - Handle agent thinking state

---

## 💡 Important Notes

- **Central Channel ID:** Always use `"00000000-0000-0000-0000-000000000000"` for the centralized message bus
- **Message Filtering:** Always check `senderId !== yourUserId` to avoid displaying your own messages twice
- **Connection Timing:** Wait for `connectionStatus === "connected"` before joining channels or sending messages
- **Session Channel ID:** Use for filtering messages to specific conversations while sending to central bus
- **Error Handling:** Check connection status before operations, handle disconnections gracefully

---

## 🔍 Common Patterns

### Join Multiple Channels
```typescript
const channels = ["channel-1", "channel-2", "channel-3"];
for (const channelId of channels) {
  await socketIOManager.joinChannel(channelId);
}
```

### Leave a Channel
```typescript
socketIOManager.leaveChannel(channelId);
```

### Clean Up Event Listeners
```typescript
useEffect(() => {
  const handler = (data) => { /* ... */ };
  socketIOManager.on("messageBroadcast", handler);

  return () => {
    socketIOManager.off("messageBroadcast", handler);
  };
}, []);
```

---

**Last Updated:** 2025-01-22
