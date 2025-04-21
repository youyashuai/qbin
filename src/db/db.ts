export { createMetadataRepository } from "./repositories/metadataRepository.ts";
export type { IMetadataRepository } from "./repositories/IMetadataRepository.ts";
export { getDb } from "./adapters/index.ts";


import {getDb} from "./adapters/index.ts";

export async function initializeServices() {
  await Promise.all([
    getDb(),
  ]);
  console.log("所有服务初始化完成");
}