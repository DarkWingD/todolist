CREATE TABLE IF NOT EXISTS "bin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"weekday" smallint NOT NULL,
	"fortnightly" boolean DEFAULT false NOT NULL,
	"anchor_date" date NOT NULL,
	"assignee_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bin" ADD CONSTRAINT "bin_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bin" ADD CONSTRAINT "bin_assignee_id_person_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bin_household_idx" ON "bin" USING btree ("household_id");