import React, { createContext, useContext, useMemo, useState } from 'react';

export type ChatScope = 'general' | 'knowledge' | 'project' | 'meeting';
export type MeetingPhase = 'pre' | 'in' | 'post';

export interface ChatContextOverride {
  scope: ChatScope;
  meetingId?: string;
  projectId?: string;
  phase?: MeetingPhase;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  promptPrefix?: string;
  suggestions?: string[];
}

interface ChatContextValue {
  override: ChatContextOverride | null;
  setOverride: (override: ChatContextOverride | null) => void;
  clearOverride: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [override, setOverride] = useState<ChatContextOverride | null>(null);

  const value = useMemo<ChatContextValue>(() => {
    return {
      override,
      setOverride,
      clearOverride: () => setOverride(null),
    };
  }, [override]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
