ALTER TABLE "user_prefs" ADD COLUMN "show_meals" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD COLUMN "week_starts_on" smallint DEFAULT 1 NOT NULL;