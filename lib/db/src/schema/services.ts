import {
  pgEnum,
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  numeric,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const servicePricingTypeEnum = pgEnum("service_pricing_type", [
  "hourly",
  "fixed",
  "contact_for_quote",
]);

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  pricingType: servicePricingTypeEnum("pricing_type").notNull(),
  baseRate: numeric("base_rate", { precision: 12, scale: 2, mode: "number" }),
  region: text("region").notNull(),
  city: text("city").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  phoneNumber: text("phone_number").notNull(),
  whatsappNumber: text("whatsapp_number").notNull(),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const servicePortfolioImagesTable = pgTable("service_portfolio_images", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id")
    .notNull()
    .references(() => servicesTable.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
});

export const insertServiceSchema = createInsertSchema(servicesTable)
  .omit({
    id: true,
    isVerified: true,
    createdAt: true,
  })
  .extend({
    title: z.string().trim().min(2).max(120),
    category: z.string().trim().min(1).max(80),
    description: z.string().trim().min(10).max(5000),
    region: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(120),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    phoneNumber: z.string().trim().min(5).max(32),
    whatsappNumber: z.string().trim().min(5).max(32),
    baseRate: z.number().positive().nullable().optional(),
  })
  .superRefine((service, ctx) => {
    if ((service.latitude == null) !== (service.longitude == null)) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude and longitude must be provided together",
      });
    }
  });

export const insertServicePortfolioImageSchema = createInsertSchema(
  servicePortfolioImagesTable,
).omit({
  id: true,
});

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
export type ServicePortfolioImage = typeof servicePortfolioImagesTable.$inferSelect;
