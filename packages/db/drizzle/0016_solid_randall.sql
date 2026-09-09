CREATE TABLE IF NOT EXISTS "person_workday" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"week" smallint DEFAULT 0 NOT NULL,
	"weekday" smallint NOT NULL,
	"place" text DEFAULT 'Work' NOT NULL,
	"start_time" text,
	"end_time" text
);
--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "fortnight_anchor" date DEFAULT '2026-01-05' NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "note" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_workday" ADD CONSTRAINT "person_workday_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_workday_idx" ON "person_workday" USING btree ("person_id","week","weekday");