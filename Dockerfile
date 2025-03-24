FROM denoland/deno:2.2.5

# 应用程序监听的端口
EXPOSE 8000

WORKDIR /app

ENV DENO_DIR=/deno-dir

COPY . .

# 确保目录权限正确
RUN chown -R deno:deno /app && \
    mkdir -p ${DENO_DIR} && \
    chown -R deno:deno ${DENO_DIR}

# 切换到非root用户
USER deno

RUN deno cache index.ts

CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--unstable-kv", "--unstable-broadcast-channel", "index.ts"]