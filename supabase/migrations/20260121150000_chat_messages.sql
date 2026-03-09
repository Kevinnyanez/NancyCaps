-- Chat conversations (1:1 direct messages)
-- user_1 is always the lexicographically smaller UUID to enforce uniqueness
CREATE TABLE IF NOT EXISTS chat_conversations (
  id SERIAL PRIMARY KEY,
  user_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chat_conversations_unique UNIQUE (user_1, user_2),
  CONSTRAINT chat_conversations_different_users CHECK (user_1 <> user_2)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_conversations_user_1 ON chat_conversations(user_1);
CREATE INDEX idx_chat_conversations_user_2 ON chat_conversations(user_2);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_unread ON chat_messages(sender_id, read_at) WHERE read_at IS NULL;

-- RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: users can see/create only their own
CREATE POLICY "Users can view own conversations"
  ON chat_conversations FOR SELECT
  USING (auth.uid() IN (user_1, user_2));

CREATE POLICY "Users can create conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (auth.uid() IN (user_1, user_2));

CREATE POLICY "Users can update own conversations"
  ON chat_conversations FOR UPDATE
  USING (auth.uid() IN (user_1, user_2));

-- Messages: users can see messages in their conversations
CREATE POLICY "Users can view messages in own conversations"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND auth.uid() IN (c.user_1, c.user_2)
    )
  );

CREATE POLICY "Users can send messages in own conversations"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND auth.uid() IN (c.user_1, c.user_2)
    )
  );

-- Only receiver can mark messages as read
CREATE POLICY "Receiver can mark messages as read"
  ON chat_messages FOR UPDATE
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND auth.uid() IN (c.user_1, c.user_2)
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
  );

-- Enable Realtime on chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
