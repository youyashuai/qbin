// 获取当前时间
export const getTimestamp = () => Math.floor(Date.now() / 1000);

export function cyrb53(buffer: ArrayBuffer, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  const bytes = new Uint8Array(buffer);
  for(let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x85ebca77);
    h2 = Math.imul(h2 ^ bytes[i], 0xc2b2ae3d);
  }
  h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
  h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
  h1 ^= h2 >>> 16; h2 ^= h1 >>> 16;
  return 2097152 * (h2 >>> 0) + (h1 >>> 11);
}

export function cyrb53_str(str: string, seed = 8125): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for(let i = 0, ch: number; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x85ebca77);
    h2 = Math.imul(h2 ^ ch, 0xc2b2ae3d);
  }
  h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
  h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
  h1 ^= h2 >>> 16; h2 ^= h1 >>> 16;
  return 2097152 * (h2 >>> 0) + (h1 >>> 11);
}

export function checkPassword(dbpwd:string, pwd?: string) {
  if (!dbpwd) return true;           // 无密码
  return dbpwd === pwd;              // 有密码则需匹配
}

export function generateKey(): string {
  return `${crypto.randomUUID().split("-").pop()}${Date.now()}`;
}
