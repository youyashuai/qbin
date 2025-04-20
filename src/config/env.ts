import { loadSync } from "https://deno.land/std/dotenv/mod.ts";
const env = loadSync();


export function get_env(key: string, fallback?: string): string | undefined {
  return Deno.env.get(key) || env[key] || fallback;
}
