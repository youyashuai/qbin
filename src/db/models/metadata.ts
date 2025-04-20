import {
  pgTable,
  varchar,
  bigint,
  integer as pgInteger,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer as sqliteInteger,
  blob,
} from "drizzle-orm/sqlite-core";


// 自定义 bytea 列类型
const byteArray = customType<{ data: ArrayBuffer; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {                 // 写入库之前
    return new Uint8Array(value);
  },
  fromDriver(value) {               // 读出库之后
    return (value as Uint8Array).buffer;
  },
});

export const metadataPg = pgTable("qbindbv2", {
  fkey:    varchar("fkey", { length: 40 }).primaryKey(),
  time:    bigint("time", { mode: "number" }).notNull(),
  expire:  bigint("expire", { mode: "number" }).notNull(),
  ip:      varchar("ip", { length: 45 }).notNull(),
  content: byteArray("content").notNull(),
  mime:    varchar("mime", { length: 255 }).notNull(),
  len:     pgInteger("len").notNull(),
  pwd:     varchar("pwd", { length: 40 }),
  email:   varchar("email", { length: 255 }),
  uname:   varchar("uname", { length: 255 }),
  hash:    bigint("hash", { mode: "number" }),
});

export const metadataSqlite = sqliteTable("qbindbv2", {
  fkey:    text("fkey").primaryKey(),
  time:    sqliteInteger("time", { mode: "number" }).notNull(),
  expire:  sqliteInteger("expire", { mode: "number" }).notNull(),
  ip:      text("ip").notNull(),
  content: blob("content").notNull(),
  mime:    text("mime").notNull(),
  len:     sqliteInteger("len").notNull(),
  pwd:     text("pwd"),
  email:   text("email"),
  uname:   text("uname"),
  hash:    sqliteInteger("hash", { mode: "number" }),
});

export async function initPostgresSchema(db: any) {
  await db.db.execute(sql`
    CREATE TABLE IF NOT EXISTS "qbindbv2" (
      fkey    varchar(40) PRIMARY KEY,
      time    bigint  NOT NULL,
      expire  bigint  NOT NULL,
      ip      varchar(45) NOT NULL,
      content bytea   NOT NULL,
      mime    varchar(255) NOT NULL,
      len     integer NOT NULL,
      pwd     varchar(40),
      email   varchar(255),
      uname   varchar(255),
      hash    bigint
    )`);
}

export async function initSQLiteSchema(db: any) {
  await db.db.execute(sql`
    CREATE TABLE IF NOT EXISTS "qbindbv2" (
      fkey    TEXT PRIMARY KEY,
      time    INTEGER NOT NULL,
      expire  INTEGER NOT NULL,
      ip      TEXT NOT NULL,
      content BLOB NOT NULL,
      mime    TEXT NOT NULL,
      len     INTEGER NOT NULL,
      pwd     TEXT,
      email   TEXT,
      uname   TEXT,
      hash    INTEGER
    )`);
}

export type MetadataPg = typeof metadataPg.$inferSelect;
export type MetadataSqlite = typeof metadataSqlite.$inferSelect;