CREATE TYPE "public"."tag_color" AS ENUM('red', 'orange', 'green', 'blue', 'purple', 'gray');--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" "tag_color" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "workout_tags" (
	"workout_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "workout_tags_workout_id_tag_id_pk" PRIMARY KEY("workout_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "workout_tags" ADD CONSTRAINT "workout_tags_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_tags" ADD CONSTRAINT "workout_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;