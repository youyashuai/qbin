import { PoolClient, Transaction } from "https://deno.land/x/postgres/mod.ts";
import { getPool } from "./pool.ts";
import { Metadata } from "../types.ts";
import {ISDEMO} from "../config/constants.ts";

export class MetadataDB {
  private pool: Pool;
  private static instance: MetadataDB;

  private constructor() {
    this.pool = getPool();
    if(!ISDEMO){
      // 初始化表（若已存在不会重复创建）
      this.initTable().catch((err) => {
        console.error("Failed to init qbindb table:", err);
      });
    }
  }

  // 单例模式获取实例
  public static getInstance(): MetadataDB {
    if (!MetadataDB.instance) {
      MetadataDB.instance = new MetadataDB();
    }
    return MetadataDB.instance;
  }

  // 初始化表
  private async initTable(): Promise<void> {
    await this.withClient(async (client) => {
      await client.queryObject(`
        CREATE TABLE IF NOT EXISTS qbindb (
          fkey    VARCHAR(40) PRIMARY KEY,
          time    BIGINT NOT NULL,
          expire    BIGINT NOT NULL,
          ip      VARCHAR(45) NOT NULL,
          content BYTEA NOT NULL,                 -- 这里用 BYTEA 存储二进制数据
          type    VARCHAR(255) NOT NULL,
          len     INTEGER NOT NULL,
          pwd     VARCHAR(40),
          email     VARCHAR(255),
          uname   VARCHAR(255),
          hash    BIGINT
        )
      `);
    });
  }

  // 获取连接的工具方法
  private async withClient<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await operation(client);
    } finally {
      client.release();
    }
  }

  // 事务执行的工具方法
  private async withTransaction<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    return await this.withClient(async (client) => {
      const transaction = client.createTransaction("metadata_transaction");
      await transaction.begin();
      try {
        const result = await operation(transaction);
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback();
        console.error(error);
      }
    });
  }

  // 创建记录 (返回插入的 fkey 便于后续使用)
  async create(metadata: Metadata): Promise<string> {
    return await this.withTransaction(async (tx) => {
      const contentBytes = new Uint8Array(metadata.content);
      const pwdValue = metadata.pwd ?? null; // 若没有则插入 null
      const emailValue = metadata.email ?? null;
      const unameValue = metadata.uname ?? null;

      // INSERT 时改为用 fkey
      const result = await tx.queryObject<{ fkey: string }>`
        INSERT INTO qbindb (fkey, time, expire, ip, content, type, len, pwd, email, uname, hash)
        VALUES (
          ${metadata.fkey},
          ${metadata.time},
          ${metadata.expire},
          ${metadata.ip},
          ${contentBytes},
          ${metadata.type},
          ${metadata.len},
          ${pwdValue},
          ${emailValue},
          ${unameValue},
          ${metadata.hash}
        )
        RETURNING fkey
      `;
      return result.rows[0].fkey;
    });
  }

  // 根据 fkey 查询单条记录
  async getByFkey(fkey: string): Promise<Metadata | null> {
    return await this.withClient(async (client) => {
      const result = await client.queryObject<
        Omit<Metadata, "content"> & { content: Uint8Array | null }
      >`
        SELECT fkey, time, expire, ip, content, type, len, pwd, email, uname, hash
        FROM qbindb
        WHERE fkey = ${fkey}
      `;
      if (result.rows.length === 0) {
        return null;
      }
      const row = result.rows[0];

      return {
        fkey: row.fkey,
        time: Number(row.time),
        expire: Number(row.expire),
        ip: row.ip,
        content: row.content ?? new Uint8Array().buffer,  // 防止 null
        type: row.type,
        len: row.len,
        pwd: row.pwd ?? undefined,
        email: row.email,
        uname: row.uname,
        hash: Number(row.hash)
      };
    });
  }

  // 分页查询
  async list(limit: number = 10, offset: number = 0): Promise<Metadata[]> {
    return await this.withClient(async (client) => {
      const result = await client.queryObject<
        Omit<Metadata, "content"> & { content: Uint8Array | null }
      >`
        SELECT fkey, time, expire, ip, content, type, len, pwd, email, uname, hash
        FROM qbindb
        ORDER BY time DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return result.rows.map((row) => {
          return {
            fkey: row.fkey,
            time: Number(row.time),
            expire: Number(row.expire),
            ip: row.ip,
            content: row.content ?? new Uint8Array().buffer,  // 防止 null
            type: row.type,
            len: row.len,
            pwd: row.pwd ?? undefined,
            email: row.email,
            uname: row.uname,
            hash: Number(row.hash)
          };
      });
    });
  }

  // 更新记录 (根据 fkey 更新)
  async update(fkey: string, metadata: Partial<Metadata>): Promise<boolean> {
    /*
      - 通过一个动态SQL，组装需要更新的字段
      - 避免直接拼接SQL，防止SQL注入
      - 所有字段走预编译参数
    */
    return await this.withTransaction(async (tx) => {
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      // 先单独处理 content
      if (metadata.content !== undefined) {
        updates.push(`content = $${paramIndex}`);
        values.push(new Uint8Array(metadata.content));
        paramIndex++;
      }

      // 处理其余字段
      for (const [key, value] of Object.entries(metadata)) {
        // content 已经处理过, 或者 value 未定义就跳过
        if (key === "content" || value === undefined) continue;
        updates.push(`"${key}" = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      if (updates.length === 0) {
        // 若没有要更新的字段，直接返回 false
        return false;
      }

      // WHERE fkey = $X
      values.push(fkey);
      const query = `
        UPDATE qbindb
        SET ${updates.join(", ")}
        WHERE fkey = $${paramIndex}
      `;
      const result = await tx.queryObject(query, values);   // 不能使用...展开运算符, 破坏了对应关系
      return result.rowCount === 1;
    });
  }

  // 删除记录 (根据 fkey 删除)
  async delete(fkey: string): Promise<boolean> {
    return await this.withTransaction(async (tx) => {
      const result = await tx.queryObject`
        DELETE FROM qbindb
        WHERE fkey = ${fkey}
      `;
      return result.rowCount === 1;
    });
  }

  // 根据类型查询
  async findByType(type: string): Promise<Metadata[]> {
    return await this.withClient(async (client) => {
      const result = await client.queryObject<
        Omit<Metadata, "content"> & { content: Uint8Array | null }
      >`
        SELECT fkey, time, expire, ip, content, type, len, pwd, email, uname, hash
        FROM qbindb
        WHERE type = ${type}
        ORDER BY time DESC
      `;
      return result.rows.map((row) => {
          return {
            fkey: row.fkey,
            time: Number(row.time),
            expire: Number(row.expire),
            ip: row.ip,
            content: row.content ?? new Uint8Array().buffer,  // 防止 null
            type: row.type,
            len: row.len,
            pwd: row.pwd ?? undefined,
            email: row.email,
            uname: row.uname,
            hash: Number(row.hash)
          };
      });
    });
  }

  // 获取数据库中所有fkey
  async getAllFkeys(): Promise<string[]> {
    return await this.withClient(async (client) => {
      const result = await client.queryObject<{ fkey: string }>`
        SELECT fkey
        FROM qbindb
      `;
      return result.rows.map(row => row.fkey);
    });
  }

  // 获取指定email所有fkey
  async getByemailAllFkeys(email?: number): Promise<string[]> {
    return await this.withClient(async (client) => {
      const result = await client.queryObject<{ fkey: string }>`
        SELECT fkey
        FROM qbindb
        WHERE email = ${email}
      `;
      return result.rows.map(row => row.fkey);
    });
  }

  // 关闭连接池
  async close() {
    await this.pool.end();
  }
}
