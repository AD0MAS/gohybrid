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
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, max: 5 });

export const db = drizzle(pool, { schema });
