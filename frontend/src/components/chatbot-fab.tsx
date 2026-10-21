import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import useGlobalStore from "@/stores/use-global-store";

interface ChatbotFabProps {
  show?: boolean;
}

const ChatbotFab = ({ show = true }: ChatbotFabProps) => {
  const { openChatbot } = useGlobalStore();
  const handleOpenChatbot = () => {
    openChatbot();
  };

  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        className="pointer-events-auto h-14 w-14 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        size="icon"
        variant="ghost"
        onClick={handleOpenChatbot}
      >
        <Avatar className="h-full w-full">
          <AvatarImage src="bot.svg" draggable={false} loading="eager" />
          <AvatarFallback>MB</AvatarFallback>
        </Avatar>
        <span className="sr-only">Open chatbot</span>
      </Button>
    </div>
  );
};

export default ChatbotFab;
