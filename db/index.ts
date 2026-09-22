import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// node-postgres, not postgres.js — postgres.js pipelines queries onto a
// shared socket, which Supabase's transaction-mode pooler (Supavisor, port
// 6543 in production) mishandles: queries reach Postgres but the backend
// sits in ClientRead until statement_timeout fires. node-postgres checks a
// connection out of the pool per query and returns it when done, which is
// what transaction mode expects. Session pooler (used locally) works fine
// either way, so this stays the driver for both.
// max is kept low — each Vercel instance opens its own pool, and Supabase's
// pooler caps the project at 15 connections total.
// The server-side statement_timeout stays at Supavisor's 2 minutes: the
// pooler drops startup parameters, so neither pg's `statement_timeout` option
// nor `options: "-c statement_timeout=…"` reaches Postgres (checked with
// SHOW on both ports). `query_timeout` is the client-side bound instead: it
// rejects the request after 10 s but does not cancel the backend, which keeps
// running until the 2-minute limit. `connectionTimeoutMillis` bounds the wait
// for a free connection when all `max` are busy (the default waits forever).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 5,
  query_timeout: 10_000,
  connectionTimeoutMillis: 10_000,
});

// Pool is an EventEmitter; an unhandled 'error' event terminates the process.
// A pooled connection can die while idle — Supavisor recycles connections on
// its own — so this is reachable in normal operation, not just on failure.
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client", err);
});

export const db = drizzle(pool, { schema });
