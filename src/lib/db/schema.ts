import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  isExecMember: boolean("is_exec_member").default(true),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const userPermissions = pgTable("user_permissions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  canViewAll: boolean("can_view_all").default(true),
  canEditAll: boolean("can_edit_all").default(false),
  canManageUsers: boolean("can_manage_users").default(false),
  committeeEditScopes: text("committee_edit_scopes").notNull().default("[]"),
});

export const committees = pgTable("committees", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  trackingType: text("tracking_type").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const committeeMemberships = pgTable(
  "committee_memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    committeeId: text("committee_id")
      .notNull()
      .references(() => committees.id, { onDelete: "cascade" }),
    roleLabel: text("role_label"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.committeeId] })],
);

export const signatureEventTemplates = pgTable("signature_event_templates", {
  id: text("id").primaryKey(),
  committeeId: text("committee_id")
    .notNull()
    .references(() => committees.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  typicalTiming: text("typical_timing"),
  sortOrder: integer("sort_order").default(0),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  committeeId: text("committee_id")
    .notNull()
    .references(() => committees.id),
  title: text("title").notNull(),
  startAt: text("start_at").notNull(),
  endAt: text("end_at"),
  location: text("location"),
  description: text("description"),
  isSignature: boolean("is_signature").default(false),
  recurrence: text("recurrence").notNull().default("none"),
  status: text("status").notNull().default("planned"),
  signupFormUrl: text("signup_form_url"),
  rsvpCount: integer("rsvp_count"),
  needsFood: boolean("needs_food").default(false),
  needsFoodSponsored: boolean("needs_food_sponsored").default(false),
  needsFoodInternal: boolean("needs_food_internal").default(false),
  needsSupplies: boolean("needs_supplies").default(false),
  hasExternalGuests: boolean("has_external_guests").default(false),
  coHostIds: text("co_host_ids").default("[]"),
  usePlanningChecklist: boolean("use_planning_checklist").default(true),
  deletedAt: text("deleted_at"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const deliverables = pgTable("deliverables", {
  id: text("id").primaryKey(),
  committeeId: text("committee_id")
    .notNull()
    .references(() => committees.id),
  linkedEventId: text("linked_event_id").references(() => events.id),
  designerId: text("designer_id").references(() => users.id),
  type: text("type").notNull(),
  status: text("status").notNull().default("not_started"),
  dueDate: text("due_date"),
  assetUrl: text("asset_url"),
  captionSummary: text("caption_summary"),
  postUrl: text("post_url"),
  postedAt: text("posted_at"),
});

export const eventPlanningTemplates = pgTable("event_planning_templates", {
  id: text("id").primaryKey(),
  offsetDays: integer("offset_days").notNull(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isOptional: boolean("is_optional").default(false),
  isRecommended: boolean("is_recommended").default(false),
  condition: text("condition").notNull().default("always"),
  linksToDeliverable: boolean("links_to_deliverable").default(false),
});

export const eventChecklistItems = pgTable("event_checklist_items", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  offsetDays: integer("offset_days").notNull(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isOptional: boolean("is_optional").default(false),
  isRecommended: boolean("is_recommended").default(false),
  condition: text("condition").notNull().default("always"),
  status: text("status").notNull().default("pending"),
  dueDate: text("due_date").notNull(),
  linkedDeliverableId: text("linked_deliverable_id").references(() => deliverables.id),
  completedAt: text("completed_at"),
  completedBy: text("completed_by").references(() => users.id),
});

export const meetingNotes = pgTable("meeting_notes", {
  id: text("id").primaryKey(),
  committeeId: text("committee_id")
    .notNull()
    .references(() => committees.id),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  meetingDate: text("meeting_date").notNull(),
  summary: text("summary"),
  attendeeIds: text("attendee_ids").default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const actionItems = pgTable("action_items", {
  id: text("id").primaryKey(),
  meetingNoteId: text("meeting_note_id").references(() => meetingNotes.id),
  committeeId: text("committee_id")
    .notNull()
    .references(() => committees.id),
  ownerId: text("owner_id").references(() => users.id),
  description: text("description").notNull(),
  dueDate: text("due_date"),
  status: text("status").notNull().default("open"),
  completedAt: text("completed_at"),
});

export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  committeeId: text("committee_id")
    .notNull()
    .references(() => committees.id),
  title: text("title").notNull(),
  targetMetric: text("target_metric"),
  deadline: text("deadline"),
  status: text("status").notNull().default("not_started"),
  notes: text("notes"),
});

export const committeeCheckIns = pgTable("committee_check_ins", {
  id: text("id").primaryKey(),
  targetCommitteeId: text("target_committee_id")
    .notNull()
    .references(() => committees.id),
  checkedInAt: text("checked_in_at").notNull(),
  notes: text("notes"),
  checkedInBy: text("checked_in_by")
    .notNull()
    .references(() => users.id),
});

export const prezFinanceSnapshots = pgTable("prez_finance_snapshots", {
  id: text("id").primaryKey(),
  lastUpdated: text("last_updated").notNull(),
  notes: text("notes"),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => users.id),
});

export const eventExpenses = pgTable("event_expenses", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  committeeId: text("committee_id")
    .notNull()
    .references(() => committees.id),
  amount: doublePrecision("amount").notNull(),
  notes: text("notes"),
  loggedBy: text("logged_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const mentorMatchingCycles = pgTable("mentor_matching_cycles", {
  id: text("id").primaryKey(),
  committeeId: text("committee_id")
    .notNull()
    .references(() => committees.id),
  label: text("label").notNull(),
  sheetUrl: text("sheet_url"),
  status: text("status").notNull().default("in_progress"),
  syncedAt: text("synced_at"),
  finalizedAt: text("finalized_at"),
  finalizedBy: text("finalized_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const mentorApplications = pgTable("mentor_applications", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id")
    .notNull()
    .references(() => mentorMatchingCycles.id, { onDelete: "cascade" }),
  andrewId: text("andrew_id").notNull(),
  grade: text("grade").notNull(),
  role: text("role").notNull(),
  areas: text("areas").notNull(),
  bucket: text("bucket").notNull(),
  gradeOrder: integer("grade_order").notNull(),
});

export const mentorPairs = pgTable("mentor_pairs", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id")
    .notNull()
    .references(() => mentorMatchingCycles.id, { onDelete: "cascade" }),
  mentorApplicationId: text("mentor_application_id")
    .notNull()
    .references(() => mentorApplications.id, { onDelete: "cascade" }),
  menteeApplicationId: text("mentee_application_id")
    .notNull()
    .references(() => mentorApplications.id, { onDelete: "cascade" }),
  matchedArea: text("matched_area").notNull(),
  status: text("status").notNull().default("suggested"),
  isAutoSuggested: boolean("is_auto_suggested").default(true),
  confirmedAt: text("confirmed_at"),
  confirmedBy: text("confirmed_by").references(() => users.id),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  permissions: one(userPermissions),
  memberships: many(committeeMemberships),
}));

export const committeesRelations = relations(committees, ({ many }) => ({
  events: many(events),
  memberships: many(committeeMemberships),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  committee: one(committees, {
    fields: [events.committeeId],
    references: [committees.id],
  }),
  checklistItems: many(eventChecklistItems),
  expenses: many(eventExpenses),
}));

export type User = typeof users.$inferSelect;
export type Committee = typeof committees.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Deliverable = typeof deliverables.$inferSelect;
export type EventChecklistItem = typeof eventChecklistItems.$inferSelect;
export type EventExpense = typeof eventExpenses.$inferSelect;
export type UserPermission = typeof userPermissions.$inferSelect;
export type MentorMatchingCycle = typeof mentorMatchingCycles.$inferSelect;
export type MentorApplication = typeof mentorApplications.$inferSelect;
export type MentorPair = typeof mentorPairs.$inferSelect;
