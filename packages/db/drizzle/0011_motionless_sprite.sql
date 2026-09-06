CREATE TYPE "public"."school_period_kind" AS ENUM('term', 'break', 'closure');--> statement-breakpoint
ALTER TYPE "public"."list_type" ADD VALUE 'child';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "child_day" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"place" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "child_profile" (
	"list_id" uuid PRIMARY KEY NOT NULL,
	"class_name" text,
	"room" text,
	"teacher" text,
	"office_phone" text,
	"medical_notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "school_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"kind" "school_period_kind" NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_prefs" ADD COLUMN "show_kids" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "child_day" ADD CONSTRAINT "child_day_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "child_profile" ADD CONSTRAINT "child_profile_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "school_period" ADD CONSTRAINT "school_period_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "child_day_list_weekday_idx" ON "child_day" USING btree ("list_id","weekday");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "school_period_list_idx" ON "school_period" USING btree ("list_id");