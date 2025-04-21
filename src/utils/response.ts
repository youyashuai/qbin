// 创建响应处理器，自动设置状态码
export function Response(ctx, status: number, message: string, data?: any) {
  ctx.response.status = status;
  ctx.response.body = { status, message, data };
}

// 错误响应类
export class PasteError extends Error {
  constructor(public status: number = 500, message: string) {
    super(message);
    this.name = "PasteError";
  }
}
