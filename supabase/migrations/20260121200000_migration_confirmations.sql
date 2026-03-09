-- Track which users have confirmed they migrated to the new server
CREATE TABLE IF NOT EXISTS migration_confirmations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE migration_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read confirmations"
  ON migration_confirmations FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own confirmation"
  ON migration_confirmations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
