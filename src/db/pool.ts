import { Pool } from "https://deno.land/x/postgres/mod.ts";
import { get_env } from "../config/constants.ts";

/**
 * 数据库连接池管理
 */

let pool: Pool | null = null;  // pdb连接池

/**
 * 获取全局连接池实例
 */
export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = get_env("DATABASE_URL");
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set in environment variables");
    }
    // 默认最大连接数 10，可根据需求调整
    pool = new Pool(databaseUrl, 10, true);
  }
  return pool;
}

/**
 * 关闭连接池
 */
// 可以在 server.ts 里监听关闭信号调用本函数
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

