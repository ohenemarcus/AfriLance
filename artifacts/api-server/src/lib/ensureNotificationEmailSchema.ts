import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function ensureNotificationEmailSchema(): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    await pool.query("DROP TRIGGER IF EXISTS notification_email_outbox_trigger ON notifications");
    logger.info("Notification emails are disabled until Resend is configured");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_email_outbox (
      id serial PRIMARY KEY,
      notification_id integer NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      locked_at timestamptz,
      sent_at timestamptz,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS notification_email_outbox_notification_idx
      ON notification_email_outbox (notification_id);
    CREATE INDEX IF NOT EXISTS notification_email_outbox_status_attempt_idx
      ON notification_email_outbox (status, next_attempt_at);

    CREATE OR REPLACE FUNCTION enqueue_important_notification_email()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.type IN (
        'new_message',
        'new_proposal',
        'proposal_accepted',
        'proposal_rejected',
        'job_funded',
        'job_in_progress',
        'payment_processing',
        'payment_release_failed',
        'payment_failed',
        'job_completed',
        'payment_dispute',
        'dispute_response',
        'work_submitted',
        'work_revision_requested',
        'work_approved',
        'hire_cancelled',
        'id_verified',
        'id_rejected',
        'job_flagged'
      ) THEN
        INSERT INTO notification_email_outbox (notification_id)
        VALUES (NEW.id)
        ON CONFLICT (notification_id) DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS notification_email_outbox_trigger ON notifications;
    CREATE TRIGGER notification_email_outbox_trigger
    AFTER INSERT ON notifications
    FOR EACH ROW EXECUTE FUNCTION enqueue_important_notification_email();
  `);
}
