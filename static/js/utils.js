const getTimestamp = () => Math.floor(Date.now() / 1000);
function cyrb53(str, seed = 512) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 0x85ebca77);
        h2 = Math.imul(h2 ^ ch, 0xc2b2ae3d);
    }
    h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
    h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
    h1 ^= h2 >>> 16;
    h2 ^= h1 >>> 16;
    return 2097152 * (h2 >>> 0) + (h1 >>> 11);
}
class StorageManager {
    constructor(dbName = 'qbin', version = 2) {
        this.dbName = dbName;
        this.version = version;
        this.storeName = 'qbin';
        this.db = null;
        this.indexedDB = this._getIndexedDB();
    }

    // 获取 IndexedDB 实例
    _getIndexedDB() {
        const indexedDB = window.indexedDB || window.mozIndexedDB ||
            window.webkitIndexedDB || window.msIndexedDB;

        if (!indexedDB) {
            throw new Error('当前浏览器不支持 IndexedDB');
        }
        return indexedDB;
    }

    // 统一的错误处理
    _handleError(error) {
        console.error('数据库操作错误:', error);
        throw new Error(`数据库操作失败: ${error.message}`);
    }

    // 获取事务
    _getTransaction(mode = 'readonly') {
        if (!this.db) {
            throw new Error('数据库未初始化');
        }
        try {
            return this.db.transaction([this.storeName], mode);
        } catch (error) {
            this._handleError(error);
        }
    }

    // 初始化数据库连接
    async initialize() {
        if (this.db) return;

        try {
            return new Promise((resolve, reject) => {
                const request = this.indexedDB.open(this.dbName, this.version);

                request.onerror = () => {
                    this._handleError(request.error);
                    reject(request.error);
                };

                request.onblocked = () => {
                    const error = new Error('数据库被阻塞，可能存在其他连接');
                    this._handleError(error);
                    reject(error);
                };

                request.onsuccess = () => {
                    this.db = request.result;

                    this.db.onerror = (event) => {
                        this._handleError(event.target.error);
                    };

                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        const store = db.createObjectStore(this.storeName, {
                            keyPath: 'key'
                        });
                        store.createIndex('timestamp', 'timestamp', {unique: false});
                    }
                };
            });
        } catch (error) {
            this._handleError(error);
        }
    }

    // 设置缓存
    async setCache(key, value, expirationTime = 86400 * 7, maxRetries = 3) {
        let retries = 0;
        while (retries < maxRetries) {
            try {
                await this.initialize();
                return new Promise((resolve, reject) => {
                    const transaction = this._getTransaction('readwrite');
                    const store = transaction.objectStore(this.storeName);

                    const data = {
                        key,
                        value,
                        timestamp: getTimestamp(),
                        exipre: expirationTime
                    };

                    const request = store.put(data);

                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(true);

                    // 添加事务完成的监听
                    transaction.oncomplete = () => resolve(true);
                    transaction.onerror = () => reject(transaction.error);
                });
            } catch (error) {
                retries++;
                if (retries === maxRetries) {
                    this._handleError(error);
                }
                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // 获取缓存
    async getCache(key) {
        try {
            await this.initialize();
            return new Promise((resolve, reject) => {
                const transaction = this._getTransaction('readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    resolve(request.result ? request.result.value : null);
                };
            });
        } catch (error) {
            this._handleError(error);
        }
    }

    async removeCache(key, options = {silent: false}) {
        try {
            await this.initialize();

            // 首先检查键是否存在
            const exists = await this.getCache(key);
            if (!exists && !options.silent) {
                console.log(`Cache key '${key}' not found`)
                return ;
            }

            return new Promise((resolve, reject) => {
                const transaction = this._getTransaction('readwrite');
                const store = transaction.objectStore(this.storeName);

                const request = store.delete(key);

                request.onerror = () => {
                    reject(request.error);
                };

                transaction.oncomplete = () => {
                    resolve(true);
                };

                transaction.onerror = (event) => {
                    reject(new Error(`Failed to remove cache: ${event.target.error}`));
                };

                transaction.onabort = (event) => {
                    reject(new Error(`Transaction aborted: ${event.target.error}`));
                };
            });
        } catch (error) {
            if (!options.silent) {
                this._handleError(error);
            }
            return false;
        }
    }

    async removeCacheMultiple(keys, options = {continueOnError: true}) {
        try {
            await this.initialize();
            const results = {
                success: [],
                failed: []
            };

            for (const key of keys) {
                try {
                    await this.removeCache(key, {silent: true});
                    results.success.push(key);
                } catch (error) {
                    results.failed.push({key, error: error.message});
                    if (!options.continueOnError) {
                        throw error;
                    }
                }
            }

            return results;
        } catch (error) {
            this._handleError(error);
        }
    }

    async getAllCacheKeys(options = {
        sorted: false,
        filter: null,
        limit: null,
        offset: 0
    }) {
        try {
            await this.initialize();

            return new Promise((resolve, reject) => {
                const transaction = this._getTransaction('readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();

                request.onerror = () => reject(request.error);

                request.onsuccess = () => {
                    let results = request.result.map(item => ({
                        key: item.key,
                        timestamp: item.timestamp
                    }));

                    // 应用过滤器
                    if (options.filter && typeof options.filter === 'function') {
                        results = results.filter(options.filter);
                    }

                    // 排序
                    if (options.sorted) {
                        results.sort((a, b) => b.timestamp - a.timestamp);
                    }

                    // 应用分页
                    if (options.offset || options.limit) {
                        const start = options.offset || 0;
                        const end = options.limit ? start + options.limit : undefined;
                        results = results.slice(start, end);
                    }

                    resolve(results.map(item => item.key));
                };

                transaction.onerror = (event) => {
                    reject(new Error(`Failed to get cache keys: ${event.target.error}`));
                };
            });
        } catch (error) {
            this._handleError(error);
        }
    }

    // 获取缓存统计信息
    async getCacheStats() {
        try {
            await this.initialize();

            return new Promise((resolve, reject) => {
                const transaction = this._getTransaction('readonly');
                const store = transaction.objectStore(this.storeName);
                const countRequest = store.count();
                const sizeRequest = store.getAll();

                let count = 0;
                let totalSize = 0;
                let oldestTimestamp = getTimestamp();
                let newestTimestamp = 0;

                countRequest.onsuccess = () => {
                    count = countRequest.result;
                };

                sizeRequest.onsuccess = () => {
                    const items = sizeRequest.result;
                    totalSize = new Blob([JSON.stringify(items)]).size;

                    items.forEach(item => {
                        oldestTimestamp = Math.min(oldestTimestamp, item.timestamp);
                        newestTimestamp = Math.max(newestTimestamp, item.timestamp);
                    });

                    resolve({
                        count,
                        totalSize,
                        oldestTimestamp: count > 0 ? oldestTimestamp : null,
                        newestTimestamp: count > 0 ? newestTimestamp : null,
                        averageSize: count > 0 ? Math.round(totalSize / count) : 0
                    });
                };

                transaction.onerror = (event) => {
                    reject(new Error(`Failed to get cache stats: ${event.target.error}`));
                };
            });
        } catch (error) {
            this._handleError(error);
        }
    }

    // 清除过期缓存，添加批量处理机制
    async clearExpiredCache(batchSize = 100) {
        try {
            await this.initialize();
            const now = getTimestamp();

            return new Promise((resolve, reject) => {
                const transaction = this._getTransaction('readwrite');
                const store = transaction.objectStore(this.storeName);
                const index = store.index('timestamp');

                let processed = 0;
                const processNextBatch = () => {
                    const request = index.openCursor();
                    let count = 0;

                    request.onerror = () => reject(request.error);
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor && count < batchSize) {
                            if (now - cursor.value.timestamp > cursor.value.exipre) {
                                cursor.delete();
                                processed++;
                            }
                            count++;
                            cursor.continue();
                        } else if (count === batchSize) {
                            // 还有更多数据要处理
                            setTimeout(processNextBatch, 0);
                        } else {
                            resolve(processed);
                        }
                    };
                };

                processNextBatch();
            });
        } catch (error) {
            this._handleError(error);
        }
    }
}
const storage = new StorageManager();