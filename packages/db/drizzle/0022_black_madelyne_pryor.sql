ALTER TABLE "meal" ADD COLUMN "servings" integer;--> statement-breakpoint
ALTER TABLE "meal" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "meal" ADD COLUMN "prep_minutes" integer;--> statement-breakpoint
ALTER TABLE "meal" ADD COLUMN "cook_minutes" integer;--> statement-breakpoint
ALTER TABLE "meal" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "meal_plan" ADD COLUMN "servings" integer;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD COLUMN "pantry" text;