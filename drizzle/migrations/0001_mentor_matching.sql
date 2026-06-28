CREATE TABLE "mentor_matching_cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"committee_id" text NOT NULL,
	"label" text NOT NULL,
	"sheet_url" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"synced_at" text,
	"finalized_at" text,
	"finalized_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mentor_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"cycle_id" text NOT NULL,
	"andrew_id" text NOT NULL,
	"grade" text NOT NULL,
	"role" text NOT NULL,
	"areas" text NOT NULL,
	"bucket" text NOT NULL,
	"grade_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentor_pairs" (
	"id" text PRIMARY KEY NOT NULL,
	"cycle_id" text NOT NULL,
	"mentor_application_id" text NOT NULL,
	"mentee_application_id" text NOT NULL,
	"matched_area" text NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"is_auto_suggested" boolean DEFAULT true,
	"confirmed_at" text,
	"confirmed_by" text
);
--> statement-breakpoint
ALTER TABLE "mentor_matching_cycles" ADD CONSTRAINT "mentor_matching_cycles_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mentor_matching_cycles" ADD CONSTRAINT "mentor_matching_cycles_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mentor_applications" ADD CONSTRAINT "mentor_applications_cycle_id_mentor_matching_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."mentor_matching_cycles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mentor_pairs" ADD CONSTRAINT "mentor_pairs_cycle_id_mentor_matching_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."mentor_matching_cycles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mentor_pairs" ADD CONSTRAINT "mentor_pairs_mentor_application_id_mentor_applications_id_fk" FOREIGN KEY ("mentor_application_id") REFERENCES "public"."mentor_applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mentor_pairs" ADD CONSTRAINT "mentor_pairs_mentee_application_id_mentor_applications_id_fk" FOREIGN KEY ("mentee_application_id") REFERENCES "public"."mentor_applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mentor_pairs" ADD CONSTRAINT "mentor_pairs_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
