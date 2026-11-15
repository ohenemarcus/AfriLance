import { sql, type SQLWrapper } from "drizzle-orm";

export function completedJobsCountSql(profileId: SQLWrapper) {
  return sql<number>`(
    select count(distinct jobs.id)::int
    from jobs
    left join proposals
      on proposals.job_id = jobs.id
      and proposals.status = 'accepted'
    where jobs.status = 'completed'
      and (jobs.client_id = ${profileId} or proposals.freelancer_id = ${profileId})
  )`;
}
