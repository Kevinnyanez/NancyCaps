import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Plus,
  Check,
  CheckCheck,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface UserInfo {
  id: string;
  email: string;
  role: string;
  cap_number: number | null;
  label: string;
}

interface Conversation {
  id: number;
  user_1: string;
  user_2: string;
  last_message_at: string;
  otherUser: UserInfo;
  lastMessage?: string;
  unreadCount: number;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

const ChatSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchUsers, setSearchUsers] = useState('');
  const [newConvOpen, setNewConvOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const myId = user?.id;

  const buildUserLabel = (p: { role: string; cap_number: number | null; email: string }, capMap: Map<number, string>) => {
    if (p.role === 'admin') return 'Administrador';
    if (p.cap_number) {
      const name = capMap.get(p.cap_number);
      return name ? `CAP ${p.cap_number} — ${name}` : `CAP ${p.cap_number}`;
    }
    return p.email;
  };

  const fetchUsers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, role, cap_number');
    const { data: caps } = await supabase.from('caps').select('numero, nombre');

    const capMap = new Map<number, string>();
    (caps || []).forEach((c: any) => capMap.set(c.numero, c.nombre));

    const mapped = (profiles || [])
      .filter((p: any) => p.id !== myId)
      .map((p: any) => ({
        id: p.id,
        email: p.email,
        role: p.role,
        cap_number: p.cap_number,
        label: buildUserLabel(p, capMap),
      }));

    setUsers(mapped);
    return { mapped, capMap, allProfiles: profiles || [] };
  }, [myId]);

  const fetchConversations = useCallback(async () => {
    if (!myId) return;
    setLoading(true);

    const { mapped: allUsers } = await fetchUsers();
    const userMap = new Map<string, UserInfo>();
    allUsers.forEach((u) => userMap.set(u.id, u));

    const { data: convs } = await (supabase as any)
      .from('chat_conversations')
      .select('*')
      .or(`user_1.eq.${myId},user_2.eq.${myId}`)
      .order('last_message_at', { ascending: false });

    const convList: Conversation[] = [];

    for (const c of convs || []) {
      const otherId = c.user_1 === myId ? c.user_2 : c.user_1;
      const otherUser = userMap.get(otherId) || {
        id: otherId,
        email: 'Usuario',
        role: '',
        cap_number: null,
        label: 'Usuario',
      };

      const { data: lastMsg } = await (supabase as any)
        .from('chat_messages')
        .select('content')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { count } = await (supabase as any)
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .neq('sender_id', myId)
        .is('read_at', null);

      convList.push({
        ...c,
        otherUser,
        lastMessage: lastMsg?.content || '',
        unreadCount: count || 0,
      });
    }

    setConversations(convList);
    setLoading(false);
  }, [myId, fetchUsers]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription
  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: any) => {
          const newMsg: Message = payload.new;

          // If it's in the active conversation, add the message
          if (activeConv && newMsg.conversation_id === activeConv.id) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            // Mark as read if we're the receiver
            if (newMsg.sender_id !== myId) {
              markAsRead(newMsg.id);
            }
          }

          // Refresh conversation list
          fetchConversations();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, activeConv?.id]);

  const markAsRead = async (msgId: number) => {
    await (supabase as any)
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', msgId)
      .is('read_at', null);
  };

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setDraft('');

    const { data } = await (supabase as any)
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });

    setMessages(data || []);

    // Mark all unread as read
    const unread = (data || []).filter(
      (m: Message) => m.sender_id !== myId && !m.read_at,
    );
    for (const m of unread) {
      await markAsRead(m.id);
    }

    // Update local unread
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)),
    );

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }, 100);
  };

  const sendMessage = async () => {
    if (!draft.trim() || !activeConv || !myId || sending) return;
    setSending(true);
    const content = draft.trim();
    setDraft('');

    const { error } = await (supabase as any)
      .from('chat_messages')
      .insert({ conversation_id: activeConv.id, sender_id: myId, content });

    if (error) {
      toast({ title: 'Error al enviar', description: error.message, variant: 'destructive' });
      setDraft(content);
    } else {
      await (supabase as any)
        .from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeConv.id);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const startConversation = async (targetUser: UserInfo) => {
    if (!myId) return;

    // Ensure user_1 < user_2 lexicographically
    const [u1, u2] = myId < targetUser.id ? [myId, targetUser.id] : [targetUser.id, myId];

    // Check if conversation already exists
    const existing = conversations.find(
      (c) => c.otherUser.id === targetUser.id,
    );
    if (existing) {
      setNewConvOpen(false);
      openConversation(existing);
      return;
    }

    const { data, error } = await (supabase as any)
      .from('chat_conversations')
      .insert({ user_1: u1, user_2: u2 })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Already exists, fetch it
        const { data: existingConv } = await (supabase as any)
          .from('chat_conversations')
          .select('*')
          .eq('user_1', u1)
          .eq('user_2', u2)
          .single();
        if (existingConv) {
          setNewConvOpen(false);
          await fetchConversations();
          const conv = {
            ...existingConv,
            otherUser: targetUser,
            lastMessage: '',
            unreadCount: 0,
          };
          openConversation(conv);
        }
        return;
      }
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setNewConvOpen(false);
    await fetchConversations();
    const conv: Conversation = {
      ...data,
      otherUser: targetUser,
      lastMessage: '',
      unreadCount: 0,
    };
    openConversation(conv);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  };

  const formatMsgTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredNewUsers = users.filter(
    (u) =>
      u.label.toLowerCase().includes(searchUsers.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUsers.toLowerCase()),
  );

  // --- RENDER ---

  // Mobile: if active conversation, show only the chat
  const showConvList = !activeConv;

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Conversation list */}
      <div
        className={cn(
          'w-full md:w-80 flex-shrink-0 border-r flex flex-col',
          activeConv ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h3 className="font-semibold text-sm">Conversaciones</h3>
          <Button size="sm" variant="ghost" onClick={() => setNewConvOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Cargando...</p>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No hay conversaciones</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 gap-1"
                onClick={() => setNewConvOpen(true)}
              >
                <Plus className="h-3 w-3" />
                Nueva conversación
              </Button>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b border-muted/30',
                  activeConv?.id === conv.id && 'bg-primary/5',
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                  {conv.otherUser.label.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn('text-sm truncate', conv.unreadCount > 0 && 'font-bold')}>
                      {conv.otherUser.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage || 'Sin mensajes'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-primary">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div
        className={cn(
          'flex-1 flex flex-col',
          !activeConv ? 'hidden md:flex' : 'flex',
        )}
      >
        {activeConv ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden h-8 w-8"
                onClick={() => setActiveConv(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                {activeConv.otherUser.label.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{activeConv.otherUser.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {activeConv.otherUser.email}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    Enviá el primer mensaje para iniciar la conversación
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === myId;
                  return (
                    <div
                      key={m.id}
                      className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                          isMine
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <div
                          className={cn(
                            'flex items-center gap-1 mt-1',
                            isMine ? 'justify-end' : 'justify-start',
                          )}
                        >
                          <span
                            className={cn(
                              'text-[10px]',
                              isMine ? 'text-primary-foreground/60' : 'text-muted-foreground',
                            )}
                          >
                            {formatMsgTime(m.created_at)}
                          </span>
                          {isMine && (
                            m.read_at ? (
                              <CheckCheck className="h-3 w-3 text-primary-foreground/60" />
                            ) : (
                              <Check className="h-3 w-3 text-primary-foreground/60" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t px-4 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escribí un mensaje..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!draft.trim() || sending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <MessageCircle className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-1">Mensajes</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Seleccioná una conversación o iniciá una nueva para comenzar a chatear
            </p>
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => setNewConvOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Nueva conversación
            </Button>
          </div>
        )}
      </div>

      {/* New conversation dialog */}
      <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva conversación</DialogTitle>
            <DialogDescription>Seleccioná un usuario para chatear</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar usuario..."
                value={searchUsers}
                onChange={(e) => setSearchUsers(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredNewUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No se encontraron usuarios
                </p>
              ) : (
                filteredNewUsers.map((u) => {
                  const existingConv = conversations.find((c) => c.otherUser.id === u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => startConversation(u)}
                      className="w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                        {u.label.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      {existingConv && (
                        <Badge variant="secondary" className="text-[10px]">
                          Abierta
                        </Badge>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatSection;
