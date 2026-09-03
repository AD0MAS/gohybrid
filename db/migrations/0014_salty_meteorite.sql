ALTER TYPE "public"."target_type" ADD VALUE 'pace_km' BEFORE 'cal_per_hour';--> statement-breakpoint
UPDATE "workout_items" SET "target_preset" = NULL WHERE "target_preset" = 'easy';--> statement-breakpoint
ALTER TABLE "workout_items" ALTER COLUMN "target_preset" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."target_preset";--> statement-breakpoint
CREATE TYPE "public"."target_preset" AS ENUM('threshold', 'race_pace', 'zone2', 'tempo', 'recovery');--> statement-breakpoint
ALTER TABLE "workout_items" ALTER COLUMN "target_preset" SET DATA TYPE "public"."target_preset" USING "target_preset"::"public"."target_preset";