-- Run this once in the Neon SQL Editor to create Thinkwell's tables.
CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON "session"(user_id);

CREATE TABLE IF NOT EXISTS "account" (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON "account"(user_id);

CREATE TABLE IF NOT EXISTS "verification" (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification"(identifier);

CREATE TABLE IF NOT EXISTS conversation (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_user_updated_idx ON conversation(user_id, updated_at);

CREATE TABLE IF NOT EXISTS chat_message (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  conversation_id text REFERENCES conversation(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS conversation_id text REFERENCES conversation(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS chat_message_user_created_idx ON chat_message(user_id, created_at);
CREATE INDEX IF NOT EXISTS chat_message_conversation_created_idx ON chat_message(conversation_id, created_at);

INSERT INTO conversation (id, user_id, title, created_at, updated_at)
SELECT 'legacy-' || user_id, user_id,
       COALESCE((SELECT left(m2.content, 100) FROM chat_message m2 WHERE m2.user_id = grouped.user_id AND m2.role = 'user' ORDER BY m2.created_at LIMIT 1), 'Earlier conversation'),
       min(created_at), max(created_at)
FROM chat_message AS grouped
WHERE conversation_id IS NULL
GROUP BY user_id
ON CONFLICT (id) DO NOTHING;

UPDATE chat_message SET conversation_id = 'legacy-' || user_id WHERE conversation_id IS NULL;

-- Add per-user AI controls, spend tracking, and response feedback.
CREATE TABLE IF NOT EXISTS user_ai_settings (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  monthly_limit double precision NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  conversation_id text REFERENCES conversation(id) ON DELETE SET NULL,
  model text NOT NULL,
  kind text NOT NULL,
  cost_usd double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx ON ai_usage(user_id, created_at);

CREATE TABLE IF NOT EXISTS message_feedback (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  message_id text NOT NULL REFERENCES chat_message(id) ON DELETE CASCADE,
  rating text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);
