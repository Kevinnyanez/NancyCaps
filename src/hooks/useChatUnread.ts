import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Shared hook that tracks total unread chat message count in real-time.
 * Used by ChatBubble and sidebar nav badge.
 */
export const useChatUnread = () => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user?.id) return;

    const { data: convs } = await (supabase as any)
      .from('chat_conversations')
      .select('id')
      .or(`user_1.eq.${user.id},user_2.eq.${user.id}`);

    if (!convs || convs.length === 0) {
      setUnread(0);
      return;
    }

    const ids = convs.map((c: any) => c.id);

    const { count } = await (supabase as any)
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', ids)
      .neq('sender_id', user.id)
      .is('read_at', null);

    setUnread(count || 0);
  }, [user?.id]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('chat-unread-global')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => {
          fetchUnread();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchUnread]);

  return { unread, refresh: fetchUnread };
};
