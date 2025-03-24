

export async function loggerMiddleware(ctx: any, next: Function) {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  // 记录请求开始信息
  console.log(`[${requestId}] Request started - ${ctx.request.method} ${ctx.request.url.pathname}`);
  try {
    await next();
    // 计算执行时间
    const ms = Date.now() - start;
    // 记录请求完成信息
    console.log(`[${requestId}] Request completed - ${ctx.response.status} - ${ms}ms
      Method: ${ctx.request.method}
      URL: ${ctx.request.url}
      Status: ${ctx.response.status}
      Duration: ${ms}ms`);
  } catch (error) {
    // 记录错误信息
    const ms = Date.now() - start;
    console.error(`[${requestId}] Request failed - ${ms}ms
      Method: ${ctx.request.method}
      URL: ${ctx.request.url}
      Error: ${error.message}`);
    throw error;
  }
}
