CREATE TYPE "public"."calendar_view" AS ENUM('month', 'week', 'agenda', 'list');--> statement-breakpoint
ALTER TABLE "user_prefs" ADD COLUMN "calendar_view" "calendar_view" DEFAULT 'month' NOT NULL;