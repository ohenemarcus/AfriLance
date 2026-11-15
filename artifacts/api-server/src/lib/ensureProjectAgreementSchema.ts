import { pool } from "@workspace/db";

export async function ensureProjectAgreementSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_agreements (
      id serial PRIMARY KEY,
      job_id integer NOT NULL,
      proposal_id integer NOT NULL,
      client_id integer NOT NULL,
      freelancer_id integer NOT NULL,
      scope text NOT NULL,
      deadline date NOT NULL,
      amount real NOT NULL,
      status text NOT NULL DEFAULT 'pending_freelancer',
      change_request text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS project_agreements_job_unique
      ON project_agreements(job_id);
  `);
}
