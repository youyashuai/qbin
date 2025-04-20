import {
  Context,
  isHttpError,
  Status,
} from "https://deno.land/x/oak/mod.ts";
import {HEADERS, QBIN_ENV} from "../config/constants.ts";
import { PasteError } from "../utils/response.ts";


export async function errorMiddleware(
  ctx: Context,
  next: () => Promise<unknown>,
) {
  try {
    await next();
  } catch (err) {
    if(err.message || err.stack){
      let status: Status;
      if (err instanceof PasteError) {
        status = err.status as Status;
      } else if (isHttpError(err)) {
        status = err.status;
      } else {
        status = Status.InternalServerError;
      }
      const isClientErr = status >= 400 && status < 500;

      const logMsg = `${ctx.request.method} ${ctx.request.url} -> ${status}`;
      if (isClientErr) {
        console.warn(logMsg, "-", err.message);
      } else {
        console.error(logMsg, "\n", err.stack || err);
      }

      ctx.response.status = status;
      ctx.response.headers.set(
        "Content-Type",
        HEADERS.JSON["Content-Type"],
      );

      ctx.response.body = {
        code: status,
        message: isClientErr
          ? err.message
          : QBIN_ENV === "dev"
          ? err.message
          : "内部服务器错误",
        ...(QBIN_ENV === "dev" && !isClientErr ? { stack: err.stack } : {}),
      };
    }
  }
}
