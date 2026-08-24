CREATE TABLE "scheduled_workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workout_id" uuid NOT NULL,
	"scheduled_date" date NOT NULL,
	"session_id" uuid,
	"is_skipped" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_workouts" ADD CONSTRAINT "scheduled_workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_workouts" ADD CONSTRAINT "scheduled_workouts_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_workouts" ADD CONSTRAINT "scheduled_workouts_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_workouts_user_id_scheduled_date_idx" ON "scheduled_workouts" USING btree ("user_id","scheduled_date");