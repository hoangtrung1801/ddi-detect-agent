import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatState {
  messages: ChatMessageItem[];
  clientId: string | null;
  addMessage: (m: ChatMessageItem) => void;
  updateMessage: (id: string, partial: Partial<ChatMessageItem>) => void;
  setClientId: (id: string) => void;
  clear: () => void;
}

const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      clientId: null,
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      updateMessage: (id, partial) =>
        set((s) => ({
          messages: s.messages.map((message) =>
            message.id === id ? { ...message, ...partial } : message,
          ),
        })),
      setClientId: (id) => set({ clientId: id }),
      clear: () => set({ messages: [], clientId: null }),
    }),
    {
      name: 'chat-session',
      storage: createJSONStorage(() => sessionStorage),
      merge: (persistedState, currentState) => {
        const p = persistedState as Partial<ChatState>;
        const c = currentState as ChatState;
        const filtered = Array.isArray(p.messages)
          ? p.messages.filter(
              (m) =>
                typeof m.content === 'string' && m.content.trim().length > 0,
            )
          : c.messages;
        return { ...c, ...p, messages: filtered } as ChatState;
      },
    },
  ),
);

export default useChatStore;
