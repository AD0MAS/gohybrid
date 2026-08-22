CREATE TYPE "public"."exercise_category" AS ENUM('exercise', 'run', 'rest');--> statement-breakpoint
CREATE TYPE "public"."workout_difficulty" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."workout_primary_type" AS ENUM('running', 'strength', 'hyrox', 'conditioning', 'other');--> statement-breakpoint

CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"equipment" text,
	"category" "exercise_category" DEFAULT 'exercise' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"primary_type" "workout_primary_type" NOT NULL,
	"difficulty" "workout_difficulty" NOT NULL,
	"estimated_duration_minutes" integer,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workouts_user_id_primary_type_idx" ON "workouts" USING btree ("user_id","primary_type");