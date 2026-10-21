/* eslint-disable no-constant-condition */
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ui/shadcn-io/ai/conversation";
import { Loader } from "@/components/ui/shadcn-io/ai/loader";
import { Message, MessageAvatar, MessageContent } from "@/components/ui/shadcn-io/ai/message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea, PromptInputToolbar } from "@/components/ui/shadcn-io/ai/prompt-input";

import { nanoid } from "nanoid";
import { type FormEventHandler, useCallback, useState, useEffect } from "react";
import { X } from "lucide-react";
import useChatStore, { type ChatMessageItem } from "@/stores/use-chat-store";
import useGlobalStore from "@/stores/use-global-store";
// import { useAskChatMutation, useGetClientId } from "@/hooks/api/use-chat";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ChatbotModal = () => {
  const { messages, addMessage, updateMessage, clientId } = useChatStore();
  const { isChatbotOpen, closeChatbot } = useGlobalStore();

  const [inputValue, setInputValue] = useState("");
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  // const useGetClientId = new Promise((resolve) => {
  //   setTimeout(() => {
  //     resolve({ clientId: "123" });
  //   }, 1000);
  // });

  // const { isLoading: isClientIdLoading } = useGetClientId();
  // const { clientId } = useChatStore();
  // const askMutation = useAskChatMutation(clientId || "");

  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingTextMap, setStreamingTextMap] = useState<Record<string, string>>({});

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
      if (!clientId || !text.trim() || isTyping || !isOnline) return;

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
        // const result = await askMutation.mutateAsync({
        //   user_query: userMessage.content,
        //   voice_code: "en",
        // });
        // const content = result?.data?.assistant_reply?.content || "";
        // updateMessage(assistantMessageId, { content });
        // simulateTyping(assistantMessageId, content);
      } catch {
        const assistantMessageError: ChatMessageItem = {
          id: assistantMessageId,
          content: !isOnline ? "You are offline. Please check your network and try again." : "Sorry, there was an error calling the chatbot.",
          role: "assistant",
        };
        addMessage(assistantMessageError);
        setIsTyping(false);
        setStreamingMessageId(null);
      }
    },
    [addMessage, clientId, isTyping, simulateTyping, updateMessage, isOnline]
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

  return (
    <Drawer open={isChatbotOpen} onOpenChange={(v) => (!v ? closeChatbot() : null)}>
      <DrawerContent aria-describedby={undefined} className="!z-200 !mt-0 h-[100dvh] !max-h-[100dvh] w-screen !rounded-none border-0 p-0 lg:max-w-lg">
        <DrawerClose asChild className="absolute top-4 right-4">
          <Button variant="ghost" size="icon">
            <X />
          </Button>
        </DrawerClose>
        <DrawerTitle className="sr-only">DDI Bot</DrawerTitle>
        <div className="bg-background flex h-full w-full flex-col overflow-hidden border shadow-sm">
          {/* Header */}
          <div className="bg-muted/50 flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage loading="eager" src="bot.svg" alt="DDI Bot" />
                <AvatarFallback>MB</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-lg leading-none font-semibold">DDI Bot</span>
                <span className={`flex items-center gap-1 text-sm ${isOnline ? "text-green-600" : "text-red-600"}`}>
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>
          {/* Conversation Area */}
          <Conversation className="flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ConversationContent>
              {messages.map((message, index) => (
                <div key={message.id} className={cn(index === messages.length - 1 && (!isTyping ? "mb-34" : "mb-22"))}>
                  <Message from={message.role}>
                    <MessageContent>
                      {message.role === "assistant" && streamingMessageId === message.id && false ? (
                        <div className="flex items-center gap-2">
                          <Loader size={14} />
                          <span className="text-sm text-gray-800">Thinking...</span>
                        </div>
                      ) : (
                        streamingTextMap[message.id] ?? message.content
                      )}
                    </MessageContent>
                    {message.role === "assistant" && <MessageAvatar src="assets/images/bot.svg" name="AI" />}
                  </Message>
                </div>
              ))}
            </ConversationContent>
            <ConversationScrollButton isTyping={isTyping} className="bottom-40 z-[200]" />
          </Conversation>
          <div className="absolute right-0 bottom-0 left-0 flex flex-col gap-2">
            {/* Input Area */}
            <div className="flex-shrink-0 border-t bg-white p-4">
              <PromptInput onSubmit={handleSubmit} className="flex">
                <PromptInputTextarea
                  value={inputValue}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
                  placeholder="Write your message"
                  disabled={isTyping}
                  onPointerDown={(e: React.PointerEvent<HTMLTextAreaElement>) => e.stopPropagation()}
                />
                <PromptInputToolbar>
                  <PromptInputSubmit
                    disabled={!inputValue.trim() || isTyping || !isOnline}
                    status={isTyping ? "streaming" : "ready"}
                    variant="secondary"
                  />
                </PromptInputToolbar>
              </PromptInput>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
export default ChatbotModal;
