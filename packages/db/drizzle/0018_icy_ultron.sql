CREATE TABLE IF NOT EXISTS "dose" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"medicine" text NOT NULL,
	"amount" text,
	"interval_hours" double precision,
	"given_at" timestamp with time zone NOT NULL,
	"given_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dose" ADD CONSTRAINT "dose_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dose" ADD CONSTRAINT "dose_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dose" ADD CONSTRAINT "dose_given_by_person_id_fk" FOREIGN KEY ("given_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dose_person_given_idx" ON "dose" USING btree ("person_id","given_at");