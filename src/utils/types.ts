/**
 * 类型定义文件
 */

export interface Metadata {
  /** 主键（唯一标识） */
  fkey: string;
  /** 创建时间戳 */
  time: number;
  /** 过期时间戳 */
  expire: number;
  /** 客户端 IP */
  ip: string;
  /** 文件二进制内容（入：ArrayBuffer，出：Uint8Array） */
  content: ArrayBuffer;
  /** 客户端声明的 MIME 类型 */
  mime: string;
  /** 字节长度 */
  len: number;
  /** 访问密码（可选） */
  pwd?: string;
  /** 上传者邮箱 */
  email?: string;
  /** 上传者昵称 */
  uname?: string;
  /** 文件哈希 */
  hash: number;
}

export interface KVMeta {
  fkey: string;
  email: string | null;
  uname: string | null;
  ip: string | null;
  len: number;
  expire: number;
  hash: string;
  pwd: string | null;
}

export interface SessionStore extends Map<string, unknown> {}

export interface AuthUser {
  id: number;
  name: string;
  email?: string;
  provider: string;
}

export interface AppState {
  session: SessionStore;
  user?: AuthUser;
}

export type FontExt  = 'eot' | 'svg' | 'ttf' | 'woff' | 'woff2';
export type ImageExt = 'png' | 'jpg' | 'jpeg' | 'gif' | 'svg' | 'webp' | 'ico';
export type FileExt  = FontExt | ImageExt;
export const fontMimeMap = {
  eot:  'application/vnd.ms-fontobject',
  svg:  'image/svg+xml',
  ttf:  'font/ttf',
  woff: 'font/woff',
  woff2:'font/woff2',
} as const;
export const imageMimeMap = {
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  svg:  'image/svg+xml',
  webp: 'image/webp',
  ico:  'image/x-icon',
} as const;
export const mimeMap: Record<FileExt, string> = {
  ...fontMimeMap,
  ...imageMimeMap,
} as const;
export const getMime = (ext: FileExt): string => mimeMap[ext];
