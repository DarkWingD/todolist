CREATE TYPE "public"."list_type" AS ENUM('tasks', 'checklist');--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN "type" "list_type" DEFAULT 'tasks' NOT NULL;