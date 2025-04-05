/**
 * 类型定义文件
 */
// ArrayBuffer 仅分配内存，不能直接访问数据
// Uint8Array 需要额外创建视图对象，会产生轻微的性能开销
export interface Metadata {
  fkey: string;               // 这里作为主键
  time: number;
  expire: number;
  ip: string;
  content: ArrayBuffer;  // 二进制内容 进ArrayBuffer,出Uint8Array
  type: string;
  len: number;
  pwd?: string | undefined;
  email?: string;
  uname?: string | undefined;
  hash: number;
}

export interface AppState {
  session: Map<string, any>;
  user?: {
    id: number;
    name: string;
    email?: string;
    level: number;
    provider: string;
  };
}

export const fontsTypeMap: Record<string, string> = {
  'eot': 'application/vnd.ms-fontobject',
  'svg': 'image/svg+xml',
  'ttf': 'font/ttf',
  'woff': 'font/woff',
  'woff2': 'font/woff2'
};

export const imgTypeMap: Record<string, string> = {
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'ico': 'image/x-icon'
};
