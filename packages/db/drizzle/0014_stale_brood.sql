CREATE TYPE "public"."person_kind" AS ENUM('adult', 'child');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "household" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT 'Family' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "household_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"invited_by" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" text,
	"kind" "person_kind" DEFAULT 'adult' NOT NULL,
	"name" text NOT NULL,
	"avatar_emoji" text DEFAULT '🙂' NOT NULL,
	"avatar_color" text DEFAULT '#8B5CF6' NOT NULL,
	"image" text,
	"child_list_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN "household_id" uuid;--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN "private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD COLUMN "household_id" uuid;--> statement-breakpoint

-- ───────────────────────── backfill: households from existing sharing ─────────────────────────
-- People who already share a list or a meal plan are one family. Each connected
-- component of that sharing graph becomes a household; everyone else gets one
-- of their own. A user with nothing shared still appears via the self-edge.
CREATE TEMP TABLE hh_edges AS
  SELECT a.user_id AS u, b.user_id AS v
    FROM list_member a JOIN list_member b ON a.list_id = b.list_id
  UNION
  SELECT a.user_id, b.user_id
    FROM meal_plan_member a JOIN meal_plan_member b ON a.plan_id = b.plan_id
  UNION
  SELECT id, id FROM "user";
--> statement-breakpoint
CREATE TEMP TABLE hh_root AS
  WITH RECURSIVE reach(u, v) AS (
    SELECT u, v FROM hh_edges
    UNION
    SELECT r.u, e.v FROM reach r JOIN hh_edges e ON e.u = r.v
  )
  SELECT u AS user_id, min(v) AS root FROM reach GROUP BY u;
--> statement-breakpoint
CREATE TEMP TABLE hh_map AS
  SELECT DISTINCT root, gen_random_uuid() AS household_id FROM hh_root;
--> statement-breakpoint
INSERT INTO "household" ("id", "name", "created_by")
  SELECT household_id, 'Family', root FROM hh_map;
--> statement-breakpoint
-- One adult per account, carrying the account's name and avatar.
INSERT INTO "person" ("household_id", "user_id", "kind", "name", "avatar_emoji", "avatar_color", "image")
  SELECT m.household_id, u.id, 'adult', u.name, u.avatar_emoji, u.avatar_color, u.image
    FROM "user" u
    JOIN hh_root r ON r.user_id = u.id
    JOIN hh_map m ON m.root = r.root;
--> statement-breakpoint
-- Every list belongs to its owner's household.
UPDATE "list" l SET household_id = p.household_id
  FROM "person" p WHERE p.user_id = l.owner_id;
--> statement-breakpoint
-- Nothing becomes visible to anyone new: a list is private unless every adult
-- in the household was already a member. Built-in lists are personal by design.
UPDATE "list" l SET private = true
  WHERE l.system_key IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM "person" p
        WHERE p.household_id = l.household_id AND p.kind = 'adult' AND p.user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM list_member lm WHERE lm.list_id = l.id AND lm.user_id = p.user_id
          )
     );
--> statement-breakpoint
-- Each child list becomes a child in the household, coloured as the list was.
INSERT INTO "person" ("household_id", "kind", "name", "avatar_emoji", "avatar_color", "child_list_id")
  SELECT l.household_id, 'child', l.name, l.emoji_icon, coalesce(l.color, '#F59E0B'), l.id
    FROM "list" l
   WHERE l.type = 'child' AND l.deleted_at IS NULL AND l.household_id IS NOT NULL;
--> statement-breakpoint
UPDATE "meal_plan" mp SET household_id = p.household_id
  FROM "person" p WHERE p.user_id = mp.owner_id;
--> statement-breakpoint

-- ───────────────────────── assignees: account → person ─────────────────────────
ALTER TABLE "event" DROP CONSTRAINT "event_assignee_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_assignee_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "assignee_person_id" uuid;--> statement-breakpoint
UPDATE "task" t SET assignee_person_id = p.id FROM "person" p WHERE p.user_id = t.assignee_id;--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "assignee_id";--> statement-breakpoint
ALTER TABLE "task" RENAME COLUMN "assignee_person_id" TO "assignee_id";--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "assignee_person_id" uuid;--> statement-breakpoint
UPDATE "event" e SET assignee_person_id = p.id FROM "person" p WHERE p.user_id = e.assignee_id;--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "assignee_id";--> statement-breakpoint
ALTER TABLE "event" RENAME COLUMN "assignee_person_id" TO "assignee_id";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_assignee_idx" ON "task" USING btree ("assignee_id");--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "household" ADD CONSTRAINT "household_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "household_invite" ADD CONSTRAINT "household_invite_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "household_invite" ADD CONSTRAINT "household_invite_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person" ADD CONSTRAINT "person_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person" ADD CONSTRAINT "person_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person" ADD CONSTRAINT "person_child_list_id_list_id_fk" FOREIGN KEY ("child_list_id") REFERENCES "public"."list"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_invite_household_idx" ON "household_invite" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_invite_email_idx" ON "household_invite" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_household_idx" ON "person" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_user_idx" ON "person" USING btree ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event" ADD CONSTRAINT "event_assignee_id_person_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "list" ADD CONSTRAINT "list_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_person_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
