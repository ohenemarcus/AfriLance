import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const legalAcceptancesTable = pgTable(
  "legal_acceptances",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    termsVersion: text("terms_version").notNull(),
    privacyVersion: text("privacy_version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_acceptances_user_versions_idx").on(
      table.userId,
      table.termsVersion,
      table.privacyVersion,
    ),
  ],
);

export type LegalAcceptance = typeof legalAcceptancesTable.$inferSelect;
