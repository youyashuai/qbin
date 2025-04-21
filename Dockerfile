# ──────── build stage ─────────────────────
FROM denoland/deno:2.2.11 AS build

ARG DB_CLIENT=sqlite
ENV DB_CLIENT=${DB_CLIENT}
ENV DATABASE_URL="file:/app/src/qbin_local.db"

WORKDIR /app
COPY . .

RUN mkdir -p node_modules/.deno && \
    chown -R deno:deno /app

# 预先缓存依赖
RUN deno cache index.ts

# 执行sqlite数据库初始化任务
RUN sed -i -e 's/"deno"/"no-deno"/' node_modules/@libsql/client/package.json && \
    deno task db:generate && \
    deno task db:migrate  && \
    deno task db:push     && \
    sed -i -e 's/"no-deno"/"deno"/' node_modules/@libsql/client/package.json

# ──────── runtime stage ───────────────────
FROM denoland/deno:2.2.11
WORKDIR /app

ENV DB_CLIENT=sqlite
ENV DATABASE_URL="file:/app/src/qbin_local.db"

COPY --from=build /app /app

# 确保运行时所有目录都有正确的权限
RUN chown -R deno:deno /app

VOLUME ["/app/src"]

EXPOSE 8000
USER deno
CMD ["run", "-NER", "--allow-ffi", "--allow-sys", "--unstable-kv", "--unstable-broadcast-channel", "index.ts"]