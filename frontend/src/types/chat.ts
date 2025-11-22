export interface Citation {
  url: string;
  content: string;
  title: string;
}

export interface ChatStreamData {
  citations?: Citation[];
}

// Simple message type for chat functionality
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
}

export interface ChatRequest {
  messages: Message[];
}

export interface ChatResponse extends ChatStreamData {
  id: string;
  messages: Message[];
  followUpPrompts?: string[];
}
