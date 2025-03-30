import { Pool } from "https://deno.land/x/postgres/mod.ts";
import { get_env } from "../config/constants.ts";

let pool: Pool | null = null;

// 添加重试配置
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1秒

// 检查连接是否健康
async function isPoolHealthy(pool: Pool): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.queryObject`SELECT 1`;
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

// 创建新的连接池
function createPool(): Pool {
  const databaseUrl = get_env("DATABASE_URL");
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }
  return new Pool(databaseUrl, 10, true);
}

// 获取带有自动重连的连接池
export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

// 带重试的执行操作
export async function withRetry<T>(
  operation: () => Promise<T>,
  attempts: number = RETRY_ATTEMPTS
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === attempts - 1) throw error;
      
      // 检查连接池健康状况
      if (pool && !(await isPoolHealthy(pool))) {
        await closePool();
        pool = createPool();
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  throw new Error("Max retry attempts reached");
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}