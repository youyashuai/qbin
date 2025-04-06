import { Context, Next } from "https://deno.land/x/oak/mod.ts";


function getETagValue(etag: string | null): string {
  if (!etag) return "";
  const match = etag.match(/(\d+)/);
  return match ? match[1] : "0";
}


export const etagMiddleware = async (ctx: Context, next: Next) => {
  await next();

  if (ctx.request.method !== 'GET') {
    return;
  }
  // 如果没有 metadata 或没有 etag，则跳过中间件
  const metadata = ctx.state.metadata;
  if(ctx.response.status !=200){
    ctx.response.headers.delete("cache-control");
  }
  if (!metadata && (!metadata?.etag || !metadata?.time)) {
    return;
  }

  // 获取客户端传来的 If-None-Match 头
  const clientETag = parseInt(getETagValue(ctx.request.headers.get("If-None-Match")));
  // 获取客户端传来的 If-Modified-Since 头
  const clientLastModified = ctx.request.headers.get("If-Modified-Since");
  // 比较缓存的 ETag 和客户端的 ETag
  if (clientETag === metadata.etag) {
    // 如果匹配，则返回 304 Not Modified
    ctx.response.status = 304;
    ctx.response.body = undefined;
    ctx.response.headers.set("Content-Length", "0");
    return;
  }

  // 检查 Last-Modified 是否匹配
  if (clientLastModified) {
    const clientDate = new Date(clientLastModified).getTime() / 1000; // 转换为时间戳
    if (clientDate >= metadata.time) {
      // 如果客户端提供的时间大于或等于资源的最后修改时间，则返回 304
      ctx.response.status = 304;
      ctx.response.body = undefined;
      ctx.response.headers.set("Content-Length", "0");
      return;
    }
  }
  // 如果不匹配，则继续处理请求并设置 ETag 头
  if(metadata?.etag){
    ctx.response.headers.set("ETag", `"${metadata.etag}"`);
  } 
  if(metadata?.time){
    const lastModified = new Date(metadata.time * 1000).toUTCString();
    ctx.response.headers.set("Last-Modified", lastModified);
  }
  return;
};
