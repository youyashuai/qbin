import { defineConfig } from "drizzle-kit";

let client  = Deno.env.get("DB_CLIENT") || "postgres";   // "postgres" | "sqlite"
const dbCredentials = {}
if(client === "postgres"){
  client = 'postgresql';
  dbCredentials["url"] = Deno.env.get("DATABASE_URL");
} else if(client === "sqlite"){
  // client = 'turso';
  dbCredentials["url"] = Deno.env.get("SQLITE_URL") || "file:qbin_local.db";
  dbCredentials["authToken"] = Deno.env.get("SQLITE_AUTH_TOKEN");
}
console.log(dbCredentials)

export default defineConfig({
  dialect: client,
  schema: "./src/db/models/*.ts",
  out: "./drizzle",
  dbCredentials
});
