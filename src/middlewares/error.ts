/**
 * 错误处理中间件
 */
import { Context } from "jsr:@oak/oak";
import { HEADERS } from "../config/constants.ts";
import { PasteError } from "../utils/response.ts";

/**
 * 通用错误处理中间件
 */
export async function errorMiddleware(ctx: Context, next: () => Promise<unknown>) {
  try {
    await next();
  } catch (err) {
    console.error(err);
    const status = err instanceof PasteError ? err.status : 500;
    const message = err instanceof PasteError ? err.message : "内部服务器错误";

    ctx.response.status = status;
    Object.entries(HEADERS.JSON).forEach(([key, value]) => {
      ctx.response.headers.set(key, value);
    });
    ctx.response.body = { status: "error", message };
  }
}
