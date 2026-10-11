CREATE TABLE "calendar_links" (
	"user_id" text NOT NULL,
	"task_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"html_link" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_links_user_id_task_id_pk" PRIMARY KEY("user_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "task_shares" (
	"task_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"owner_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_shares_task_id_email_pk" PRIMARY KEY("task_id","email")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "public_token" text;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "owner_email" text;--> statement-breakpoint
ALTER TABLE "calendar_links" ADD CONSTRAINT "calendar_links_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_shares" ADD CONSTRAINT "task_shares_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_links_user_event_uq" ON "calendar_links" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE INDEX "task_shares_email_idx" ON "task_shares" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_public_token_uq" ON "attachments" USING btree ("public_token");