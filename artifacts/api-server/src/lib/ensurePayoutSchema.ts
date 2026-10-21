import { pool } from "@workspace/db";

export async function ensurePayoutSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payout_methods (
      id serial PRIMARY KEY,
      freelancer_id integer NOT NULL UNIQUE,
      recipient_code text,
      encrypted_account_number text,
      bank_code text NOT NULL,
      bank_name text NOT NULL,
      channel text NOT NULL,
      account_last4 text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE payout_methods
      ADD COLUMN IF NOT EXISTS encrypted_account_number text;
    ALTER TABLE payout_methods
      ALTER COLUMN recipient_code DROP NOT NULL;
  `);
}
