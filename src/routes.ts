import { Router, Context } from "https://deno.land/x/oak/mod.ts";
import { MetadataDB } from "./db/metadata.ts";
import { getCachedContent, updateCache, kv, generateKey, checkPassword, isCached, getTimestamp, memCache, cacheBroadcast } from "./utils/cache.ts";
import {
  VALID_CHARS_REGEX,
  reservedWords,
  mimeTypeRegex,
  MAX_UPLOAD_FILE_SIZE,
  PASTE_STORE,
  EMAIL
} from "./config/constants.ts";
import { AppState, Metadata } from "./types.ts";
import { PasteError, Response } from "./utils/response.ts";
import {
  getEditHtml,
  getCodeEditHtml,
  renderHtml,
  getFavicon,
  getJS,
  getCSS,
  getDocumentHtml
} from "./utils/render.ts";
import { handleAdminLogin, handleLogin, handleOAuthCallback } from "./middlewares/auth.ts";


/**
 * 解析 URL 路径参数，拿到 key/pwd
 */
function parsePathParams(params: Record<string, string>) {
  // 有效路径 < 3
  // 路径长度 1 < x < 32
  // 如果是 /p/:key/:pwd? 走一套逻辑
  const isCommandPath = !params.type || params.type.length === 1;
  let key, pwd;
  if (isCommandPath){
    if (params.key === undefined || (params.key.length > 32 || params.key.length < 2) || !VALID_CHARS_REGEX.test(params.key))
      return {key: null, pwd: null};
    if (params.pwd && (params.pwd.length > 32 || params.pwd.length < 1) || !VALID_CHARS_REGEX.test(params.pwd))
      return {key: null, pwd: null};
    key = params.key;
    pwd = params.pwd;
  }
  else{
    if ((params.type.length > 32 || params.type.length < 2) || !VALID_CHARS_REGEX.test(params.type))
      return {key: null, pwd: null};
    if (params.key && (params.key.length > 32 || params.key.length < 1) || !VALID_CHARS_REGEX.test(params.key))
      return {key: null, pwd: null};
    key = params.type;
    pwd = params.key;
  }
  return {
    key: key || generateKey(),
    pwd: pwd || "",
  };
}

function cyrb53(buffer: ArrayBuffer, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  const bytes = new Uint8Array(buffer);
  for(let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x85ebca77);
    h2 = Math.imul(h2 ^ bytes[i], 0xc2b2ae3d);
  }
  h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
  h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
  h1 ^= h2 >>> 16; h2 ^= h1 >>> 16;
  return 2097152 * (h2 >>> 0) + (h1 >>> 11);
}

/**
 * 上传（POST/PUT）处理函数
 */
async function handleContentUpload(ctx: Context<AppState>, key: string, pwd: string, pdb: MetadataDB) {
  // TODO 更新缓存？
  const request = ctx.request;
  const headers = request.headers;

  const clientIp = headers.get("cf-connecting-ip") || ctx.request.ip;
  const expire = getTimestamp() + ~~(headers.get("x-expire") || "315360000");

  // 1) 基础验证
  const contentLength = parseInt(headers.get("Content-Length") || "0", 10);
  if (contentLength > MAX_UPLOAD_FILE_SIZE) {
    throw new PasteError(413, "Content too large");
  }
  const contentType = headers.get("Content-Type") || "";
  if (!mimeTypeRegex.test(contentType) || contentType.length > 100) {
    throw new PasteError(415, "Invalid Content-Type format");
  }

  // 2) 读取 body
  const content = await request.body.arrayBuffer();
  if (content.byteLength > MAX_UPLOAD_FILE_SIZE || contentLength !== content.byteLength) {
    throw new PasteError(413, "Content too large");
  }

  const hash = cyrb53(content);
  // 3) 从 JWT 中读取用户信息
  const payload = ctx.state.session?.get("user");
  const email = payload.email as string;
  const uname = payload.name as string;

  // 4) 构造 Metadata
  const metadata: Metadata = {
    fkey: key,
    time: getTimestamp(),
    expire: expire,
    ip: clientIp,
    content,
    type: contentType,
    len: contentLength,
    pwd: pwd || "",
    email,
    uname,
    hash
  };
  // 5) 在 KV 中预占 key (防止重复)
  const kvRes = await kv.atomic()
    .check({ key: [PASTE_STORE, key], versionstamp: null })
    .set([PASTE_STORE, key], {
      email,
      name: uname,
      ip: clientIp,
      len: contentLength,
      expire: expire,
      hash: hash,
      pwd,
    }, { expireIn: null })
    .commit();
  if (!kvRes.ok) {
    return new Response(ctx, 409, "Key already exists");
  }
  // 6) 先更新内存 / Cache API
  memCache.set(key, metadata);
  // 7) 后台异步写 Postgres
  queueMicrotask(async () => {
    try {
      const fkey = await pdb.create(metadata); // 更新三级缓存
      await updateCache(key, metadata);
      console.log("Background DB create success:", fkey);
    } catch (err) {
      console.error("Background DB create error:", err);
      // 保证原子性
      await kv.delete([PASTE_STORE, key]);  // 先执行异步的 KV 删除
      memCache.delete(key);                 // 再执行同步的 Map 删除
    }
  });
  ctx.response.status = 200;
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = JSON.stringify({ status: "success", key });
}

async function handleContentUpdate(ctx, key: any, pwd: any, pdb: any) {
  const request = ctx.request;
  const headers = request.headers;
  const clientIp = headers.get("cf-connecting-ip") || ctx.request.ip;
  const expire = getTimestamp() + ~~(headers.get("x-expire") || "315360000");

  // TODO 对 post headers参数校验 expire, clength > 0 && str.length < 9
  // 1) 基础验证
  const contentLength = parseInt(headers.get("Content-Length") || "0", 10);
  if (contentLength > MAX_UPLOAD_FILE_SIZE) {
    throw new PasteError(413, "Content too large");
  }
  const contentType = headers.get("Content-Type") || "";
  if (!mimeTypeRegex.test(contentType) || contentType.length > 100) {
    throw new PasteError(415, "Invalid Content-Type format");
  }

  // 2) 读取 body
  const content = await request.body.arrayBuffer();
  if (content.byteLength > MAX_UPLOAD_FILE_SIZE || contentLength !== content.byteLength) {
    throw new PasteError(413, "Content too large");
  }

  const hash = cyrb53(content);
  // 3) 从 JWT 中读取用户信息
  const payload = ctx.state.session?.get("user");
  const email = payload.email as string;
  const uname = payload.name as string;

  // 4) 构造 Metadata
  const metadata: Metadata = {
    fkey: key,
    time: getTimestamp(),
    expire: expire,
    ip: clientIp,
    content,
    type: contentType,
    len: contentLength,
    pwd: pwd || "",
    email,
    uname,
    hash
  };
  // 5) 在 KV 中预占 key (防止重复)
  const kvRes = await kv.atomic()
    .set([PASTE_STORE, key], {
      email,
      name: uname,
      ip: clientIp,
      len: contentLength,
      expire: expire,
      hash: hash,
      pwd,
    }, { expireIn: null })
    .commit();
  if (!kvRes.ok) {
    return new Response(ctx, 409, "Key already exists");
  }
  // 6) 先更新内存 / Cache API
  memCache.set(key, metadata);
  // 7) 后台异步写 Postgres
  queueMicrotask(async () => {
    try {
      const result = await pdb.update(key, metadata); // 更新三级缓存
      if(!result){
        throw new PasteError(400, "PG更新数据失败!");
      }
      await updateCache(key, metadata);
      cacheBroadcast.postMessage({ type: "update", key, metadata });  // 通知更新状态
    } catch (err) {
      console.error("Background DB create error:", err);
      memCache.delete(key);
    }
  });
  ctx.response.status = 200;
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = JSON.stringify({ status: "success", key });
}

/**
 * 将Postgres数据库中的所有fkeys同步到Deno KV存储
 * 使用批处理和原子操作实现
 */
async function syncPostgresToKV(ctx: Context<AppState>, pdb: MetadataDB) {
  try {
    // 从Postgres数据库获取所有fkeys
    const pgFkeys = await pdb.getAllFkeys();
    const pgFkeysSet = new Set(pgFkeys);

    // 追踪同步统计信息
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    // 处理现有KV条目
    const kvEntries = kv.list({ prefix: [PASTE_STORE] });
    const kvFkeysSet = new Set<string>();
    const toRemove = [];

    // 识别需要删除的fkeys（存在于KV中但不在Postgres中）
    for await (const entry of kvEntries) {
      const fkey = entry.key[1] as string;

      if (!pgFkeysSet.has(fkey)) {
        toRemove.push(["qbin", fkey]);
      } else {
        kvFkeysSet.add(fkey);
        unchanged++;
      }
    }

    // 批量删除过期的fkeys
    const batchSize = 100; // 根据系统限制优化批次大小
    for (let i = 0; i < toRemove.length; i += batchSize) {
      const batch = toRemove.slice(i, i + batchSize);
      if (batch.length > 0) {
        const atomicOp = kv.atomic();
        for (const key of batch) {
          atomicOp.delete(key);
        }
        await atomicOp.commit();
        removed += batch.length;
      }
    }

    // 识别需要添加的fkeys（存在于Postgres但不在KV中）
    const toAdd = [];
    for (const fkey of pgFkeys) {
      if (!kvFkeysSet.has(fkey)) {
        toAdd.push(fkey);
      }
    }

    // 批量添加新fkeys
    for (let i = 0; i < toAdd.length; i += batchSize) {
      const batch = toAdd.slice(i, i + batchSize);
      if (batch.length > 0) {
        const atomicOp = kv.atomic();
        for (const fkey of batch) {
          atomicOp.set(["qbin", fkey], true);
        }
        await atomicOp.commit();
        added += batch.length;
      }
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      stats: {
        added, // 新增的fkey数量
        removed, // 移除的fkey数量
        unchanged, // 保持不变的fkey数量
        total: pgFkeys.length // 总fkey数量
      }
    };

  } catch (error) {
    console.error("同步Postgres到KV时出错:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error.message
    };
  }
}

/**
 * 注册路由
 */
const router = new Router<AppState>();


/**
 * /e/key/pwd 文本编辑器，上传...
 * /c/key/pwd 代码编辑器
 * /m/key/pwd markdown编辑器
 */
router
  .get("/favicon.ico", async (ctx) => {
    return await getFavicon(ctx, 200);
  })
  .get("/document", async (ctx) => {
    return await getDocumentHtml(ctx, 200);
  })
  .get("/static/js/:file", async (ctx) => {
    return await getJS(ctx, ctx.params.file, 200);
  })
  .get("/static/css/:file", async (ctx) => {
    return await getCSS(ctx, ctx.params.file, 200);
  })
  .get("/r/:key?/:pwd?", async (ctx) => {
    const { key, pwd } = parsePathParams(ctx.params);
    if (key === null || reservedWords.has(key)) {
      return new Response(ctx, 403, "该KEY为保留字");
    }
    const pdb = MetadataDB.getInstance();
    // 先检查缓存内容
    const _metadata = await isCached(key, pwd, pdb);
    if (_metadata?.email === undefined || _metadata.expire < getTimestamp()) {
      return new Response(ctx, 404, "KEY不存在");
    }
    // 密码验证
    if (_metadata.pwd && !checkPassword(_metadata.pwd, pwd)) {
      return new Response(ctx, 403, "访问密码错误");
    }
    const metadata = await getCachedContent(key, pwd, pdb);
    if(!(metadata && "content" in metadata)){
      return new Response(ctx, 404, "KEY不存在");
    }
    ctx.state.metadata = { etag: metadata?.hash, time: metadata?.time ?? null };
    ctx.response.headers.set('Pragma', 'no-cache');
    ctx.response.headers.set('Cache-Control', 'no-cache, must-revalidate');  // private , must-revalidate | , max-age=3600
    ctx.response.headers.set("Content-Type", metadata.type);
    ctx.response.headers.set("Content-Length", metadata.len.toString());
    ctx.response.body = metadata.content;
  })    // get raw
  .head("/r/:key?/:pwd?", async (ctx) => {
    const { key, pwd } = parsePathParams(ctx.params);
    if (key === null || reservedWords.has(key)) {
      return new Response(ctx, 403, "该KEY为保留字");
    }
    const pdb = MetadataDB.getInstance();
    const _metadata = await isCached(key, pwd, pdb);
    if (_metadata?.email === undefined || _metadata.expire < getTimestamp()) {
      ctx.response.status = 404;
      return;
    }
    if (_metadata.pwd && !checkPassword(_metadata.pwd, pwd)) { ctx.response.status = 403; return; }
    ctx.response.status = 200;
    ctx.response.headers.set("Content-Type", _metadata.type);
    ctx.response.headers.set("Content-Length", _metadata.len.toString());
  })    // head raw
  .get("/p/:key?/:pwd?", async (ctx) => {
    return await renderHtml(ctx, 200);
  })    // render
  .get("/e/:key?/:pwd?", async (ctx) => {
    return await getEditHtml(ctx, 200);
  })    // edit
  .get("/c/:key?/:pwd?", async (ctx) => {
    return await getCodeEditHtml(ctx, 200);
  })    // code edit
  // .get("/m/:key?/:pwd?", async (ctx) => {
  // })    // markdown edit
  // 首页，/p或/p/ 所有单字符
  .get(/^\/?[a-zA-Z0-9]?\/?$/, async (ctx) => {
    return await getEditHtml(ctx, 200);
  })
  .post("/s/:key/:pwd?", async (ctx) => {
    const { key, pwd } = parsePathParams(ctx.params);
    if (key === null || reservedWords.has(key)) {
      return new Response(ctx, 403, "该KEY为保留字");
    }
    const pdb = MetadataDB.getInstance();
    const metadata = await isCached(key, pwd, pdb);
    if(metadata && "email" in metadata) {
      if (metadata.expire > getTimestamp()){
        const email = await ctx.state.session?.get("user")?.email;
        if (!(email !== undefined && metadata.email === email)) {
          return new Response(ctx, 403, "您没有该KEY的内容修改权限");
        }
      }
      await handleContentUpdate(ctx, key, pwd || "", pdb);  // 更新
    }else {
      await handleContentUpload(ctx, key, pwd || "", pdb);  // 创建
    }
  })
  .put("/s/:key/:pwd?", async (ctx) => {
    const { key, pwd } = parsePathParams(ctx.params);
    if (key === null || reservedWords.has(key)) {
      return new Response(ctx, 403, "该KEY为保留字");
    }
    const pdb = MetadataDB.getInstance();
    const metadata = await isCached(key, pwd, pdb);
    if(metadata){
      if (metadata.expire > getTimestamp()){
        return new Response(ctx, 409, "Key already exists");
      }
      await handleContentUpdate(ctx, key, pwd || "", pdb);  // 更新
    }else {
      await handleContentUpload(ctx, key, pwd || "", pdb);
    }
  })
  .delete("/d/:key/:pwd?", async (ctx) => {
    const { key, pwd } = parsePathParams(ctx.params);
    if (key === null || reservedWords.has(key)) {
      return new Response(ctx, 403, "该KEY为保留字");
    }

    const pdb = MetadataDB.getInstance();
    // 先检查缓存内容
    const metadata = await isCached(key, pwd, pdb);
    // 排除减少查询次数缓存, 但不是真数据
    if (!metadata || metadata.expire < getTimestamp()) {
      return new Response(ctx, 404, "内容不存在");
    }
    if(!(checkPassword(metadata.pwd, pwd) && "email" in metadata)){
      return new Response(ctx, 403, "密码错误");
    }
    // 验证是否作者本人或管理员
    const email = await ctx.state.session?.get("user")?.email;
    if (!(email !== undefined && metadata.email === email)) {
      return new Response(ctx, 403, "您没有删除该内容的权限");
    }

    delete metadata.content;  // 删除不必要信息
    metadata.len = 0;
    const expire = metadata.expire;
    if(expire > 0) metadata.expire = -expire;
    // 并发删除 KV/Cache
    await Promise.all([
      updateCache(key, metadata),
      kv.set([PASTE_STORE, key], metadata),
    ]);
    cacheBroadcast.postMessage({ type: "delete", key, metadata });  // 通知删除状态
    // 异步删除数据库记录
    queueMicrotask(async () => {
      await pdb.update(key, {content: new Uint8Array(0), expire: metadata.expire}); // 更新三级缓存, 执行真实删除
      // await pdb.delete(key);     // TODO 删除异常处理
    });

    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = { status: "success", message: "删除成功" };
  })
  .get("/api/data/sync", async (ctx) => {
    // 验证是否管理员
    const email = await ctx.state.session?.get("user")?.email;
    if (!(email !== undefined && EMAIL === email)) {
      return new Response(ctx, 403, "您没有执行权限");
    }
    const pdb = MetadataDB.getInstance();
    return await syncPostgresToKV(ctx, pdb);
  })    // kv与pg同步
  .get("/api/login/admin", handleAdminLogin)
  .get("/api/login/:provider", handleLogin)
  .get("/api/login/oauth2/callback/:provider", handleOAuthCallback);
  // .post("/api/data/clean", async (ctx) => {
  // })   // 清理过期key


export default router;
