import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { schema } from "../schema.ts";
import { get_env } from "../../config/env.ts";
import { registerAdapter } from "./registry.ts";

const { Pool } = pg;

function newPool() {
  const  CA_CERT_DATA = get_env("CA_CERT_DATA") ?? "";
  const poolConfig = {
    connectionString: get_env("DATABASE_URL") ?? "",
    idleTimeoutMillis: Number(get_env("PG_IDLE_TIMEOUT") ?? 30_000),
    connectionTimeoutMillis: Number(get_env("PG_CONN_TIMEOUT") ?? 5_000),
  };
  if (CA_CERT_DATA) {
    poolConfig.ssl = {
      rejectUnauthorized: true,
      ca: CA_CERT_DATA,
    };
  }
  return new Pool(poolConfig);
}

registerAdapter("postgres", async () => {
  let pool = newPool();

  pool.on("error", async (err) => {
    console.error("[postgres] pool error – reconnecting", err);
    try { await pool.end(); } catch (_) {}
    pool = newPool();
  });

  const db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
});