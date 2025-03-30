import { closePool } from "./src/db/pool.ts";
import { createServer } from "./src/server.ts";
import {get_env} from "./src/config/constants.ts";

/**
 * 程序入口
 */
async function main() {
  const app = createServer();

  if (Deno.build.os === "windows") {
    // Windows only supports ctrl-c (SIGINT) and ctrl-break (SIGBREAK)
    Deno.addSignalListener("SIGINT", async () => {
      console.log("Received SIGINT signal");
      closePool();
      Deno.exit();
    });
  } else {
    Deno.addSignalListener("SIGTERM", async () => {
      console.log("Received SIGTERM signal");
      closePool();
      Deno.exit();
    });
  }

  const PORT = parseInt(get_env("PORT")) || 8000;
  console.log(`Server is running on port ${PORT}...`);
  await app.listen({ port: PORT });
}

await main();
