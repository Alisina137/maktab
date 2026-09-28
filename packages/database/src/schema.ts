import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const schoolStatusEnum = pgEnum("school_status", ["ACTIVE", "INACTIVE"]);
export const languageCodeEnum = pgEnum("language_code", ["fa-AF", "ps-AF", "en"]);

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  province: varchar("province", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  status: schoolStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const schoolSettings = pgTable("school_settings", {
  schoolId: uuid("school_id")
    .primaryKey()
    .references(() => schools.id, { onDelete: "cascade" }),
  defaultLanguage: languageCodeEnum("default_language").notNull().default("fa-AF"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kabul"),
  dateSystem: varchar("date_system", { length: 32 }).notNull().default("solar-hijri"),
  weekStartsOn: integer("week_starts_on").notNull().default(6),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export type School = typeof schools.$inferSelect;
export type SchoolSettings = typeof schoolSettings.$inferSelect;
