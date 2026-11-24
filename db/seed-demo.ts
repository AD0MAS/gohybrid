process.loadEnvFile(".env.local");

/**
 * Resets the demo account and fills it with a realistic training history:
 * `npm run db:seed-demo`. Re-runnable: it deletes everything the demo user
 * owns, restores the demo password, and seeds again, dated relative to
 * today — so the same command repairs an account visitors have changed.
 *
 * The user itself must already exist (created in the Supabase dashboard);
 * it is found by DEMO_EMAIL. Workouts and sessions go through the same lib/
 * functions the app uses, so validation, snapshots and plan linking behave
 * exactly as they do for a real user.
 */
async function seedDemo() {
  const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) {
    throw new Error("Set DEMO_EMAIL and DEMO_PASSWORD in .env.local.");
  }

  const { db } = await import("./index");
  const { eq, sql } = await import("drizzle-orm");
  const schema = await import("./schema");
  const enums = await import("./enums");
  const data = await import("./demo-data");
  const { validateBuilderPayload } = await import("@/lib/workout-builder-validation");
  const { createFullWorkoutForUser } = await import("@/lib/workouts");
  const { createSessionForWorkout } = await import("@/lib/sessions");
  const { validateGoalInput } = await import("@/lib/goals-validation");
  const { createGoalForUser } = await import("@/lib/goals");
  const { addDays } = await import("@/lib/dates");
  const { getCurrentDateString, toInstantAtTime, toNoonInstant } = await import("@/lib/timezone");

  const {
    rows: [user],
  } = await db.execute<{ id: string }>(
    sql`select id::text as id from auth.users where lower(email) = ${email}`
  );
  if (!user) {
    throw new Error(`No auth user with email ${email}. Create it in the Supabase dashboard first.`);
  }
  const userId = user.id;
  const tz = data.DEMO_TIMEZONE;

  // Undo a visitor changing the password, and end every open session so a
  // changed password can't keep an old one alive. pgcrypto's bcrypt is the
  // hash format Supabase Auth itself stores.
  await db.execute(sql`
    update auth.users
    set encrypted_password = extensions.crypt(${password}, extensions.gen_salt('bf')),
        updated_at = now()
    where id = ${userId}
  `);
  await db.execute(sql`delete from auth.sessions where user_id = ${userId}`);

  await db.transaction(async (tx) => {
    await tx.delete(schema.scheduledWorkouts).where(eq(schema.scheduledWorkouts.userId, userId));
    await tx.delete(schema.workoutSessions).where(eq(schema.workoutSessions.userId, userId));
    await tx.delete(schema.workouts).where(eq(schema.workouts.userId, userId));
    await tx.delete(schema.goals).where(eq(schema.goals.userId, userId));
    await tx.delete(schema.personalRecords).where(eq(schema.personalRecords.userId, userId));
    await tx.delete(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, userId));
    await tx.delete(schema.events).where(eq(schema.events.userId, userId));
    await tx.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId));
    await tx.insert(schema.userSettings).values({ userId, timezone: tz, unitSystem: "metric" });
  });
  console.log("Cleared the demo account.");

  const catalog = await db
    .select({ id: schema.exercises.id, name: schema.exercises.name, category: schema.exercises.category })
    .from(schema.exercises);
  const exerciseIdByName = new Map(catalog.map((e) => [e.name, e.id]));
  const tagRows = await db.select({ id: schema.tags.id, name: schema.tags.name }).from(schema.tags);
  const tagIdByName = new Map(tagRows.map((t) => [t.name, t.id]));
  const enumOptions = {
    primaryTypeOptions: enums.WORKOUT_PRIMARY_TYPES,
    difficultyOptions: enums.WORKOUT_DIFFICULTIES,
    blockTypeOptions: enums.BLOCK_TYPES,
    volumeTypeOptions: enums.VOLUME_TYPES,
    targetTypeOptions: enums.TARGET_TYPES,
    targetPresetOptions: enums.TARGET_PRESETS,
    restExerciseIds: catalog.filter((e) => e.category === "rest").map((e) => e.id),
  };

  // Workouts
  const workoutIdByKey = new Map<string, string>();
  for (const workout of data.DEMO_WORKOUTS) {
    const result = validateBuilderPayload(
      data.toBuilderPayload(workout, exerciseIdByName, tagIdByName),
      enumOptions
    );
    if (!result.success) {
      throw new Error(`Demo workout "${workout.title}" is invalid: ${result.error}`);
    }
    const created = await createFullWorkoutForUser(userId, result.data);
    if (workout.isFavorite) {
      await db
        .update(schema.workouts)
        .set({ isFavorite: true })
        .where(eq(schema.workouts.id, created.id));
    }
    workoutIdByKey.set(workout.key, created.id);
  }
  console.log(`Created ${workoutIdByKey.size} workouts.`);

  // History: plans, their sessions, skips and unplanned sessions
  const today = await getCurrentDateString(tz);
  const { past, planned } = data.buildDemoSchedule(today);
  let sessionCount = 0;
  for (const entry of past) {
    const workoutId = workoutIdByKey.get(entry.workout)!;

    if (entry.kind === "unplanned") {
      const completedAt = await toInstantAtTime(
        entry.date,
        data.addSecondsToClock(entry.time, entry.durationSeconds ?? 0),
        tz
      );
      const session = await createSessionForWorkout(
        userId,
        workoutId,
        { kind: "sameDay", date: entry.date, timezone: tz },
        { completedAt, durationSeconds: entry.durationSeconds }
      );
      if (!session) throw new Error(`Could not create a session on ${entry.date}.`);
      sessionCount++;
      continue;
    }

    const [plan] = await db
      .insert(schema.scheduledWorkouts)
      .values({
        userId,
        workoutId,
        scheduledDate: entry.date,
        scheduledTime: entry.time,
        isSkipped: entry.kind === "skipped",
      })
      .returning({ id: schema.scheduledWorkouts.id });
    if (entry.kind === "skipped") continue;

    // Mark done on a past day stamps noon, as the app does.
    const completedAt =
      entry.kind === "done"
        ? await toInstantAtTime(entry.date, data.addSecondsToClock(entry.time, entry.durationSeconds ?? 0), tz)
        : await toNoonInstant(entry.date, tz);
    const session = await createSessionForWorkout(
      userId,
      workoutId,
      { kind: "specific", scheduledWorkoutId: plan.id },
      { completedAt, durationSeconds: entry.durationSeconds }
    );
    if (!session) throw new Error(`Could not complete the plan on ${entry.date}.`);
    sessionCount++;
  }

  // Today and the next two weeks, still open
  await db.insert(schema.scheduledWorkouts).values(
    planned.map((entry) => ({
      userId,
      workoutId: workoutIdByKey.get(entry.workout)!,
      scheduledDate: entry.date,
      scheduledTime: entry.time,
    }))
  );
  console.log(
    `Created ${sessionCount} sessions, ${past.filter((e) => e.kind === "skipped").length} skipped and ${planned.length} planned entries.`
  );

  // Personal records
  await db.insert(schema.personalRecords).values(
    data.DEMO_RECORDS.map((record) => ({
      userId,
      exerciseId: record.exercise ? exerciseIdByName.get(record.exercise)! : null,
      customName: record.customName ?? null,
      recordType: record.recordType,
      value: String(record.value),
      achievedAt: addDays(today, -record.daysAgo),
    }))
  );

  // Body metrics
  const metrics = data.buildDemoMetrics();
  await db.insert(schema.bodyMetrics).values(
    metrics.map((metric) => ({
      userId,
      metricType: metric.metricType,
      value: String(metric.value),
      measuredAt: addDays(today, -metric.daysAgo),
    }))
  );

  // Goals, through the form validator
  const startValues = {
    firstWeight: metrics.find((m) => m.metricType === "weight")!.value,
    first5k: data.DEMO_RECORDS.find((r) => r.customName === "5 km run")!.value,
  };
  for (const goal of data.DEMO_GOALS) {
    const { targetExercise, ...raw } = goal.raw;
    const result = validateGoalInput(
      { ...raw, targetExerciseId: targetExercise ? exerciseIdByName.get(targetExercise) : undefined },
      "metric"
    );
    if (!result.success) {
      throw new Error(`Demo goal "${goal.raw.title}" is invalid: ${result.error}`);
    }
    const created = await createGoalForUser(userId, {
      ...result.data,
      startValue: goal.startFrom ? startValues[goal.startFrom] : null,
    });
    if (goal.isArchived) {
      await db.update(schema.goals).set({ isArchived: true }).where(eq(schema.goals.id, created.id));
    }
  }

  // Events
  await db.insert(schema.events).values(
    data.DEMO_EVENTS.map((event) => ({
      userId,
      title: event.title,
      eventType: event.eventType,
      eventDate: addDays(today, event.daysFromToday),
      eventTime: event.time,
      location: event.location,
      notes: event.notes,
    }))
  );

  console.log(
    `Added ${data.DEMO_RECORDS.length} records, ${metrics.length} measurements, ${data.DEMO_GOALS.length} goals and ${data.DEMO_EVENTS.length} events.`
  );
  process.exit(0);
}

seedDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
