import { sql } from 'drizzle-orm';
import {initPostgresSchema} from "../models/metadata.ts";

// 旧版本数据表迁移
export async function migrateToV2( db, dialect) {
  if (dialect === 'postgres') {
    await initPostgresSchema(db);

    const { rows } = await db.db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'qbindb'
      ) AS "exists";
    `);
    if (!rows[0].exists) return;

    return await db.db.execute(sql`
      INSERT INTO qbindbv2 (fkey,time,expire,ip,content,mime,len,pwd,email,uname,hash)
      SELECT fkey,time,expire,ip,content,type AS mime,len,pwd,email,uname,hash
      FROM   qbindb
      ON CONFLICT (fkey) DO NOTHING;
    `);
  }
}