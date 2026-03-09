import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatUnread } from '@/hooks/useChatUnread';

interface Props {
  onNavigateChat: () => void;
  isActive?: boolean;
}

const ChatBubble = ({ onNavigateChat, isActive }: Props) => {
  const { unread } = useChatUnread();

  if (isActive) return null;

  return (
    <button
      onClick={onNavigateChat}
      className={cn(
        'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95',
      )}
    >
      <MessageCircle className="h-6 w-6" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
};

export default ChatBubble;
