import { Router } from "https://deno.land/x/oak/mod.ts";
import { Response, PasteError } from "../utils/response.ts";
import { ResponseMessages } from "../utils/messages.ts";
import {createMetadataRepository} from "../db/repositories/metadataRepository.ts";
import {EMAIL, QBIN_ENV} from "../config/constants.ts";
import {syncDBToKV} from "../controllers/admin.controller.ts";
import {migrateToV2} from "../db/helpers/migrate.ts";
import {get_env} from "../config/env.ts";


const router = new Router();

router
  .get("/api/admin/storage", async (ctx) => {
    const url = new URL(ctx.request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "10", 10);

    try {
      const repo = await createMetadataRepository();
      const { items, total } = await repo.listAlive(pageSize, offset);

      const totalPages = Math.ceil(total / pageSize);
      return new Response(ctx, 200, ResponseMessages.SUCCESS, {
        items,
        pagination: {
          total,
          page,
          pageSize,
          totalPages
        }
      });
    } catch (error) {
      console.error("获取管理员存储数据时出错:", error);
      throw new PasteError(500, ResponseMessages.SERVER_ERROR);
    }
  })
  .get("/api/admin/sync", async (ctx) => {
    const email = await ctx.state.session?.get("user")?.email;
    if(QBIN_ENV === "dev") return new Response(ctx, 403, ResponseMessages.DEMO_RESTRICTED);
    if (email !== EMAIL) return new Response(ctx, 403, ResponseMessages.ADMIN_REQUIRED);
    const repo = await createMetadataRepository();
    return await syncDBToKV(ctx, repo);
  })    // kv与pg同步
  .get("/api/database/migrate", async (ctx) => {
    // 旧版本数据迁移至新数据表
    const email = await ctx.state.session?.get("user")?.email;
    if(QBIN_ENV === "dev") return new Response(ctx, 403, ResponseMessages.DEMO_RESTRICTED);
    if (email !== EMAIL) return new Response(ctx, 403, ResponseMessages.ADMIN_REQUIRED);
    const repo = await createMetadataRepository();
    const {rowCount} = await migrateToV2(repo, get_env("DB_CLIENT", "postgres"));
    return new Response(ctx, 200, ResponseMessages.SUCCESS, {rowCount: rowCount});
  })
  // .post("/api/admin/clean", async (ctx) => {
  // });   // 清理过期key

export default router;