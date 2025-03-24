import { closePool } from "./src/db/pool.ts";
import { createServer } from "./src/server.ts";
import {get_env} from "./src/config/constants";

/**
 * 程序入口
 */
async function main() {
  const app = createServer();

  // 优雅退出，关闭数据库连接池等 SIGTERM
  if (Deno.build.os === "windows") {
    // Windows only supports ctrl-c (SIGINT) and ctrl-break (SIGBREAK)
    Deno.addSignalListener("SIGINT", async () => {
      // 处理 SIGINT 信号
      console.log("Received SIGINT signal");
      await closePool();
      // 退出程序或执行清理操作
      Deno.exit();
    });
  } else {
    Deno.addSignalListener("SIGTERM", async () => {
      // 处理 SIGTERM 信号
      console.log("Received SIGTERM signal");
      await closePool();
      // 退出程序或执行清理操作
      Deno.exit();
    });
  }

  // 启动服务器
  const PORT = parseInt(get_env("PORT")) || 8000;
  console.log(`Server is running on port ${PORT}...`);
  await app.listen({ port: PORT });
}

// 执行入口函数
await main();
