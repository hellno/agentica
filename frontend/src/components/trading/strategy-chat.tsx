'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Room } from '@/lib/platform-api';
import SocketIOManager from '@/lib/socketio-manager';
import { ChatMessage } from '@/types/chat-message';
import { ChatMessages } from '@/components/chat-messages';
import { v4 as uuidv4 } from 'uuid';
import { MessageCircle, Send } from 'lucide-react';

interface StrategyChatProps {
  room: Room | null;
  userEntity: string;
}

const USER_NAME = "You";
const CHAT_SOURCE = "strategy_chat";

export default function StrategyChat({ room, userEntity }: StrategyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error">("connecting");

  const socketIOManager = SocketIOManager.getInstance();
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Initialize Socket.IO connection when room changes
  useEffect(() => {
    if (!room || !userEntity) {
      setConnectionStatus("error");
      return;
    }

    console.log('[StrategyChat] Initializing connection for room:', room.name);

    // Initialize Socket.IO connection
    socketIOManager.initialize(userEntity, room.strategy_agent_id);

    // Join the room's channel
    const joinChannel = async () => {
      try {
        console.log('[StrategyChat] Joining channel:', room.eliza_room_id);
        await socketIOManager.joinChannel(room.eliza_room_id);
        setConnectionStatus("connected");
        console.log('[StrategyChat] Successfully joined channel');
      } catch (error) {
        console.error('[StrategyChat] Failed to join channel:', error);
        setConnectionStatus("error");
      }
    };

    joinChannel();

    // TODO: Load message history from API
    // const loadHistory = async () => {
    //   try {
    //     const history = await getChannelMessages(room.eliza_room_id);
    //     setMessages(history);
    //   } catch (error) {
    //     console.error('[StrategyChat] Failed to load history:', error);
    //   }
    // };
    // loadHistory();

    return () => {
      // Leave channel on cleanup
      socketIOManager.leaveChannel(room.eliza_room_id);
    };
  }, [room?.id, userEntity]);

  // Listen for incoming messages
  useEffect(() => {
    if (!room) return;

    const handleMessageBroadcast = (data: any) => {
      console.log('[StrategyChat] Message broadcast:', data);

      // Skip own messages to avoid duplicates
      if (data.senderId === userEntity) return;

      // Only show messages for current room
      if (data.channelId !== room.eliza_room_id) return;

      const message: ChatMessage = {
        id: data.id || uuidv4(),
        name: data.senderName || 'Agent',
        text: data.text,
        senderId: data.senderId,
        roomId: room.eliza_room_id,
        createdAt: data.createdAt || Date.now(),
        source: data.source || 'agent',
        thought: data.thought,
        actions: data.actions,
      };

      setMessages((prev) => [...prev, message]);
      setIsLoading(false);
    };

    socketIOManager.on("messageBroadcast", handleMessageBroadcast);

    return () => {
      socketIOManager.off("messageBroadcast", handleMessageBroadcast);
    };
  }, [room?.id, userEntity]);

  // Auto-scroll to bottom only when new messages arrive
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !room || !userEntity || isLoading) return;

    const messageText = input.trim();
    setInput("");
    setIsLoading(true);

    // Add optimistic message
    const optimisticMessage: ChatMessage = {
      id: uuidv4(),
      name: USER_NAME,
      text: messageText,
      senderId: userEntity,
      roomId: room.eliza_room_id,
      createdAt: Date.now(),
      source: CHAT_SOURCE,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      console.log('[StrategyChat] Sending message to room:', room.eliza_room_id);

      // Send via Socket.IO to the room's channel
      await socketIOManager.sendChannelMessage(
        messageText,
        "00000000-0000-0000-0000-000000000000", // Central channel
        CHAT_SOURCE,
        room.eliza_room_id, // Session channel (room ID)
        room.strategy_agent_id // Server ID (agent ID)
      );

      console.log('[StrategyChat] Message sent successfully');
    } catch (error) {
      console.error('[StrategyChat] Failed to send message:', error);
      setIsLoading(false);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
    }
  }, [input, room, userEntity, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFollowUpClick = (prompt: string) => {
    setInput(prompt);
  };

  // Empty state when no room selected
  if (!room) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-slate-300 mb-2 mx-auto" />
          <p className="text-sm text-slate-500">Select a strategy to chat</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
      {/* Compact Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm truncate">{room.name}</h3>
        </div>
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus === "connected" ? "bg-green-500" :
          connectionStatus === "connecting" ? "bg-yellow-500" :
          "bg-red-500"
        }`} />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && connectionStatus === "connected" ? (
          <div className="flex flex-col items-center justify-center h-full">
            <MessageCircle className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500">Ask your agent anything</p>
          </div>
        ) : (
          <>
            <ChatMessages
              messages={messages}
              citationsMap={{}}
              followUpPromptsMap={{}}
              onFollowUpClick={handleFollowUpClick}
            />
            <div ref={messageEndRef} />
          </>
        )}
      </div>

      {/* Compact Input Area */}
      <div className="px-4 py-3 border-t border-slate-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your strategy agent..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={isLoading || connectionStatus !== "connected"}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading || connectionStatus !== "connected"}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-1 ${
              input.trim() && !isLoading && connectionStatus === "connected"
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
