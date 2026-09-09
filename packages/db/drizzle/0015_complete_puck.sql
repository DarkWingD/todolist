CREATE TABLE IF NOT EXISTS "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"actor_id" uuid,
	"kind" text NOT NULL,
	"list_id" uuid,
	"target_id" uuid,
	"title" text NOT NULL,
	"meta" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_prefs" ADD COLUMN "activity_seen_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity" ADD CONSTRAINT "activity_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_person_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity" ADD CONSTRAINT "activity_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_household_created_idx" ON "activity" USING btree ("household_id","created_at");