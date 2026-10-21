/* eslint-disable no-constant-condition */
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ui/shadcn-io/ai/conversation";
import { Loader } from "@/components/ui/shadcn-io/ai/loader";
import { Message, MessageAvatar, MessageContent } from "@/components/ui/shadcn-io/ai/message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea, PromptInputToolbar } from "@/components/ui/shadcn-io/ai/prompt-input";

import { nanoid } from "nanoid";
import { type FormEventHandler, useCallback, useState, useEffect } from "react";
import useChatStore, { type ChatMessageItem } from "@/stores/use-chat-store";
import useGlobalStore from "@/stores/use-global-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { drugInteractionAPI } from "@/lib/api";

const ChatbotInline = () => {
  const { messages, addMessage, updateMessage } = useChatStore();
  const { isChatbotOpen } = useGlobalStore();

  const [inputValue, setInputValue] = useState("");
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingTextMap, setStreamingTextMap] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false);

  // Network status listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const simulateTyping = useCallback((messageId: string, content: string) => {
    let currentIndex = 0;
    setStreamingTextMap((messages) => ({ ...messages, [messageId]: "" }));
    const typeInterval = setInterval(() => {
      currentIndex += Math.random() > 0.1 ? 1 : 0;
      const nextIndex = Math.min(currentIndex, content.length);
      setStreamingTextMap((messages) => ({
        ...messages,
        [messageId]: content.slice(0, nextIndex),
      }));

      if (nextIndex >= content.length) {
        clearInterval(typeInterval);
        setStreamingTextMap((messages) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [messageId]: _removed, ...rest } = messages;
          return rest;
        });
        setIsTyping(false);
        setStreamingMessageId(null);
      }
    }, 50);
    return () => clearInterval(typeInterval);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping || !isOnline || isLoading) return;

      const userMessage: ChatMessageItem = {
        id: nanoid(),
        content: text.trim(),
        role: "user",
      };
      addMessage(userMessage);

      const assistantMessageId = nanoid();
      const assistantMessage: ChatMessageItem = {
        id: assistantMessageId,
        content: "",
        role: "assistant",
      };
      addMessage(assistantMessage);
      setStreamingMessageId(assistantMessageId);
      setIsTyping(true);

      try {
        // Hardcode session_id as "optional-session-id" for now
        setIsLoading(true);
        const result = await drugInteractionAPI.chat(text.trim(), "optional-session-id");

        // Update message with answer
        updateMessage(assistantMessageId, { content: result.answer });
        simulateTyping(assistantMessageId, result.answer);
      } catch (error) {
        console.error("Chat API error:", error);
        const errorMessage = !isOnline
          ? "Bạn đang offline. Vui lòng kiểm tra kết nối mạng và thử lại."
          : "Xin lỗi, có lỗi xảy ra khi gọi chatbot. Vui lòng thử lại sau.";

        updateMessage(assistantMessageId, { content: errorMessage });
        setIsTyping(false);
        setStreamingMessageId(null);
      } finally {
        setIsLoading(false);
      }
    },
    [addMessage, isTyping, simulateTyping, updateMessage, isOnline]
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();
      if (!inputValue.trim()) return;
      const text = inputValue;
      setInputValue("");
      await sendMessage(text);
    },
    [inputValue, sendMessage]
  );

  if (!isChatbotOpen) {
    return null;
  }

  return (
    <Card className="mt-6 border-2 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage loading="eager" src="bot.svg" alt="DDI Bot" />
              <AvatarFallback>MB</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <CardTitle className="text-lg leading-none font-semibold mb-1">DDI Bot</CardTitle>
              <span className={`flex items-center gap-1 text-xs ${isOnline ? "text-green-600" : "text-red-600"}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          {/* <Button variant="ghost" size="icon" onClick={closeChatbot}>
            <ChevronDown className="h-4 w-4" />
          </Button> */}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col h-[400px]">
          {/* Conversation Area */}
          <Conversation className="flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ConversationContent className="p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Avatar className="size-12 mb-4">
                    <AvatarImage loading="eager" src="bot.svg" alt="DDI Bot" />
                    <AvatarFallback>MB</AvatarFallback>
                  </Avatar>
                  <p className="text-sm">Xin chào! Tôi là DDI Bot. Hãy hỏi tôi về kết quả phân tích tương tác thuốc.</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={message.id} className={cn(index === messages.length - 1 && (!isTyping ? "mb-4" : "mb-2"))}>
                    <Message from={message.role}>
                      <MessageContent>
                        {message.role === "assistant" && streamingMessageId === message.id && isLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader size={14} />
                            <span className="text-sm text-muted-foreground">Đang suy nghĩ...</span>
                          </div>
                        ) : (
                          streamingTextMap[message.id] ?? message.content
                        )}
                      </MessageContent>
                      {message.role === "assistant" && <MessageAvatar src="bot.svg" name="AI" />}
                    </Message>
                  </div>
                ))
              )}
            </ConversationContent>
            <ConversationScrollButton isTyping={isTyping} className="bottom-20 z-10" />
          </Conversation>
          {/* Input Area */}
          <div className="flex-shrink-0 border-t bg-background p-4">
            <PromptInput onSubmit={handleSubmit} className="flex">
              <PromptInputTextarea
                value={inputValue}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
                placeholder="Nhập câu hỏi của bạn..."
                disabled={isTyping}
                onPointerDown={(e: React.PointerEvent<HTMLTextAreaElement>) => e.stopPropagation()}
              />
              <PromptInputToolbar>
                <PromptInputSubmit
                  disabled={!inputValue.trim() || isTyping || !isOnline || isLoading}
                  status={isTyping ? "streaming" : "ready"}
                  variant="secondary"
                />
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatbotInline;
