import { Context } from "https://deno.land/x/oak/mod.ts";


export async function loggerMiddleware(ctx: Context, next: () => Promise<unknown>,) {
  const requestId = crypto.randomUUID();
  ctx.state.requestId = requestId;
  ctx.response.headers.set("X-Request-Id", requestId);

  const start = performance.now();

  try {
    await next();
  } finally {
    const cost = performance.now() - start;
    const status = ctx.response.status || 404;

    const logStr =
      `[${requestId}] ${ctx.request.method} ${ctx.request.url.pathname} ` +
      `=> ${status} ${cost.toFixed(2)}ms`;

    if (status >= 500) {
      console.error(logStr);
    } else if (status >= 400) {
      console.warn(logStr);
    } else {
      console.info(logStr);
    }
  }
}