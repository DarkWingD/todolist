ALTER TABLE "household" ADD COLUMN "wall_token" text;--> statement-breakpoint
ALTER TABLE "household" ADD CONSTRAINT "household_wall_token_unique" UNIQUE("wall_token");