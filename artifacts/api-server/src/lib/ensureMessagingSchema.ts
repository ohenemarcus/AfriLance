import { pool } from "@workspace/db";

export async function ensureMessagingSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id serial PRIMARY KEY,
      participant_a integer NOT NULL,
      participant_b integer NOT NULL,
      job_id integer,
      proposal_id integer,
      last_message text,
      last_message_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id serial PRIMARY KEY,
      conversation_id integer NOT NULL,
      sender_id integer NOT NULL,
      content text NOT NULL,
      attachment_url text,
      attachment_name text,
      attachment_type text,
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS message_reports (
      id serial PRIMARY KEY,
      message_id integer NOT NULL,
      reporter_id integer NOT NULL,
      reason text NOT NULL,
      details text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS conversation_preferences (
      id serial PRIMARY KEY,
      profile_id integer NOT NULL,
      conversation_id integer NOT NULL,
      is_muted boolean NOT NULL DEFAULT false,
      CONSTRAINT conversation_preferences_profile_conversation_unique UNIQUE (profile_id, conversation_id)
    );

    CREATE TABLE IF NOT EXISTS user_blocks (
      id serial PRIMARY KEY,
      blocker_id integer NOT NULL,
      blocked_id integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT user_blocks_blocker_blocked_unique UNIQUE (blocker_id, blocked_id),
      CONSTRAINT user_blocks_no_self_block CHECK (blocker_id <> blocked_id)
    );

    CREATE TABLE IF NOT EXISTS user_reports (
      id serial PRIMARY KEY,
      reporter_id integer NOT NULL,
      reported_id integer NOT NULL,
      reason text NOT NULL,
      details text,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT user_reports_no_self_report CHECK (reporter_id <> reported_id)
    );

    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_a integer;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_b integer;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS job_id integer;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS proposal_id integer;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message text;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at timestamptz;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

    ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id integer;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id integer;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS content text;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url text;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name text;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type text;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

    ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS message_id integer;
    ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS reporter_id integer;
    ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS reason text;
    ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS details text;
    ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
  `);
}