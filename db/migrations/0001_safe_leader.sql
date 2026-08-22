CREATE TYPE "public"."block_type" AS ENUM('for_time', 'on_off', 'amrap', 'emom', 'general');--> statement-breakpoint
CREATE TYPE "public"."target_preset" AS ENUM('threshold', 'race_pace', 'zone2', 'easy', 'tempo', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('pace_500m', 'cal_per_hour', 'watts', 'rpe');--> statement-breakpoint
CREATE TYPE "public"."volume_type" AS ENUM('duration', 'distance', 'reps', 'calories');--> statement-breakpoint
CREATE TABLE "workout_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"title" text,
	"sort_order" integer NOT NULL,
	"block_type" "block_type" NOT NULL,
	"duration_seconds" integer,
	"rounds" integer,
	"work_seconds" integer,
	"rest_seconds" integer,
	"interval_seconds" integer
);
--> statement-breakpoint
CREATE TABLE "workout_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"exercise_id" uuid,
	"custom_name" text,
	"notes" text,
	"sets" integer DEFAULT 1 NOT NULL,
	"volume_type" "volume_type",
	"volume_value" numeric(6, 2),
	"target_type" "target_type",
	"target_value" numeric(6, 2),
	"target_preset" "target_preset",
	"weight_kg" numeric(6, 2),
	"rest_seconds" integer
);
--> statement-breakpoint
ALTER TABLE "workout_blocks" ADD CONSTRAINT "workout_blocks_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_items" ADD CONSTRAINT "workout_items_block_id_workout_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."workout_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_items" ADD CONSTRAINT "workout_items_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_blocks_workout_id_sort_order_idx" ON "workout_blocks" USING btree ("workout_id","sort_order");--> statement-breakpoint
CREATE INDEX "workout_items_block_id_sort_order_idx" ON "workout_items" USING btree ("block_id","sort_order");