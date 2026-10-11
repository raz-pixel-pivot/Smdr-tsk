import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    body: jsonb("body"),
    isSample: boolean("is_sample").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("tasks_user_date_idx").on(t.userId, t.date)],
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    owner: text("owner"),
    ownerEmail: text("owner_email"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    isSample: boolean("is_sample").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Names are unique per user among live labels (case-insensitive).
    uniqueIndex("labels_user_name_uq")
      .on(t.userId, sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const taskLabels = pgTable(
  "task_labels",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] }), index("task_labels_user_idx").on(t.userId)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    // Private blob URL; only the server reads it.
    url: text("url").notNull(),
    // Set when the file is shared publicly: /s/<token> serves it to anyone.
    publicToken: text("public_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_task_idx").on(t.taskId), uniqueIndex("attachments_public_token_uq").on(t.publicToken)],
);

/** A task shared by its owner with another person, by (lowercase) email. */
export const taskShares = pgTable(
  "task_shares",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["view", "edit"] }).notNull(),
    ownerEmail: text("owner_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.email] }), index("task_shares_email_idx").on(t.email)],
);

/** A user's Google Calendar event for a task (created from the task, or imported). */
export const calendarLinks = pgTable(
  "calendar_links",
  {
    userId: text("user_id").notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    htmlLink: text("html_link").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.taskId] }), uniqueIndex("calendar_links_user_event_uq").on(t.userId, t.eventId)],
);

export const settings = pgTable("settings", {
  userId: text("user_id").primaryKey(),
  language: text("language", { enum: ["en", "he"] }).notNull().default("en"),
  showCompleted: boolean("show_completed").notNull().default(true),
  seeded: boolean("seeded").notNull().default(false),
  ...timestamps,
});
