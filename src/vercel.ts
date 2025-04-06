import { createServer } from "./server.ts";
import { get_env } from "./config/constants.ts";

const app = createServer();
const PORT = parseInt(get_env("PORT")) || 8000;

// Vercel expects a handler function
export default async function handler(req: Request) {
  return await app.handle(req);
}