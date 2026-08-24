import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// prepare: false — required for Supabase's transaction pooler (used in production
// on Vercel, port 6543). Transaction mode hands connections back to the pool between
// statements, so a prepared statement from one query may not exist on the connection
// a later query gets — the pooler doesn't support them. Session pooler (used locally)
// works fine either way, so this stays on for both.
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });
