CREATE TYPE "public"."goal_direction" AS ENUM('increase', 'decrease');--> statement-breakpoint
CREATE TYPE "public"."goal_period" AS ENUM('week', 'month', 'all_time');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('session_count', 'streak', 'body_metric', 'personal_record');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"goal_type" "goal_type" NOT NULL,
	"direction" "goal_direction" NOT NULL,
	"period" "goal_period" NOT NULL,
	"target_value" numeric(9, 2) NOT NULL,
	"start_value" numeric(9, 2),
	"target_primary_type" "workout_primary_type",
	"target_metric_type" "body_metric_type",
	"target_exercise_id" uuid,
	"target_custom_name" text,
	"target_record_type" "personal_record_type",
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_target_exercise_id_exercises_id_fk" FOREIGN KEY ("target_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_user_id_is_archived_idx" ON "goals" USING btree ("user_id","is_archived");