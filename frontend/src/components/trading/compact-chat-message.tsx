'use client';

import { ChatMessage as ChatMessageType } from '@/types/chat-message';

interface CompactChatMessageProps {
  message: ChatMessageType;
  isUser: boolean;
  agentName?: string;
}

export function CompactChatMessage({ message, isUser, agentName }: CompactChatMessageProps) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Sender name */}
        {!isUser && (
          <div className="text-xs text-slate-500 mb-1 px-3">
            {agentName || 'Agent'}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`
            px-4 py-2 rounded-2xl text-sm
            ${isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-slate-100 text-slate-900 rounded-tl-sm'
            }
          `}
        >
          <div className="whitespace-pre-wrap break-words">{message.text}</div>

          {/* Agent thought process (collapsed by default) */}
          {!isUser && message.thought && (
            <details className="mt-2 pt-2 border-t border-slate-200">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                View thinking process
              </summary>
              <div className="mt-2 text-xs text-slate-600 italic">
                {message.thought}
              </div>
            </details>
          )}
        </div>

        {/* Timestamp */}
        <div className={`text-xs text-slate-400 mt-1 px-3 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}
