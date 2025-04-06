/**
 * QBin Progressive Web App - Service Worker
 * 支持HTTP/HTTPS协议和降级方案
 */

// 缓存配置
const CACHE_VERSION = 'v1.11';
const STATIC_CACHE_NAME = `qbin-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `qbin-dynamic-${CACHE_VERSION}`;
const CDN_CACHE_NAME = `qbin-cdn-${CACHE_VERSION}`;

// 调试模式
const DEBUG = false;

// 日志函数
const log = DEBUG ? console.log.bind(console, '[SW]') : () => {};
const warn = console.warn.bind(console, '[SW]');
const error = console.error.bind(console, '[SW]');

// 缓存过期时间配置
const CACHE_EXPIRATION = {
    static: 30 * 24 * 60 * 60 * 1000, // 30天
    dynamic: 7 * 24 * 60 * 60 * 1000, // 7天
    cdn: 14 * 24 * 60 * 60 * 1000     // 14天
};

// 检测是否为HTTPS环境
const isSecureContext = self.location.protocol === 'https:' ||
                        self.location.hostname === 'localhost' ||
                        self.location.hostname === '127.0.0.1';

// 静态资源 - 长期缓存，很少变化
const STATIC_RESOURCES = [
    '/favicon.ico',
    '/manifest.json',
    '/document',
    '/home',
    '/static/css/',
    '/static/js/',
    '/static/css/',
    '/static/img/'
];

// CDN资源 - 跨域资源，采用特殊处理
const CDN_RESOURCES = [
    // Monaco编辑器核心文件
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/loader.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/editor/editor.main.js',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/editor/editor.main.nls.js',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/base/worker/workerMain.js',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/base/common/worker/simpleWorker.nls.js',
    // Monaco编辑器主题和语言支持
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/basic-languages/',
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/language/',
    // 其他可能的CDN资源
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
];

// 页面模板 - 可能会更新，但可以缓存
const PAGE_TEMPLATES = [
    '/',
    '/e/',
    '/c/',
    '/m/',
    '/p/',
    '/e',
    '/c',
    '/m',
    '/p',
];

// 实时数据 - 采用网络优先策略
const REALTIME_PATHS = [
    '/r/',
];

/**
 * 安装事件处理 - 初始化缓存并预缓存关键资源
 */
self.addEventListener('install', event => {
    log('安装事件触发');

    // 如果不是安全上下文，使用有限的缓存策略
    const cachingStrategy = isSecureContext ? fullCachingStrategy : limitedCachingStrategy;

    event.waitUntil(
        cachingStrategy()
            .then(() => {
                log('缓存初始化完成');
                return self.skipWaiting(); // 立即激活新的 service worker
            })
            .catch(err => {
                error('缓存初始化失败:', err);
                // 即使出错也继续激活，以便在下次访问时重试
                return self.skipWaiting();
            })
    );
});

/**
 * 完整缓存策略 - 用于HTTPS环境
 */
async function fullCachingStrategy() {
    try {
        // 缓存静态资源
        const staticCache = await caches.open(STATIC_CACHE_NAME);
        await staticCache.addAll(STATIC_RESOURCES)
            .catch(err => warn('静态资源缓存失败:', err));

        // 缓存页面模板
        await staticCache.addAll(PAGE_TEMPLATES)
            .catch(err => warn('页面模板缓存失败:', err));

        // 初始化动态资源缓存
        await caches.open(DYNAMIC_CACHE_NAME);

        // 初始化CDN资源缓存
        await caches.open(CDN_CACHE_NAME);

        // 预缓存关键的CDN资源
        await preCacheCriticalCdnResources();

        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

/**
 * 有限缓存策略 - 用于HTTP环境
 */
async function limitedCachingStrategy() {
    try {
        // 在HTTP环境下，只缓存最关键的资源
        const staticCache = await caches.open(STATIC_CACHE_NAME);

        // 只缓存最基本的静态资源
        const criticalResources = [
            '/favicon.ico',
            '/static/css/panel-common.css',
            '/static/js/utils.js'
        ];

        await staticCache.addAll(criticalResources)
            .catch(err => warn('关键资源缓存失败:', err));

        // 初始化动态资源缓存
        await caches.open(DYNAMIC_CACHE_NAME);

        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

/**
 * 预缓存关键的CDN资源
 */
async function preCacheCriticalCdnResources() {
    try {
        const cdnCache = await caches.open(CDN_CACHE_NAME);

        // 只预缓存最关键的CDN资源
        const criticalCdnResources = [
            'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/loader.min.js'
        ];

        const fetchPromises = criticalCdnResources.map(async url => {
            try {
                const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
                if (response && response.status === 200) {
                    return cdnCache.put(url, response);
                }
            } catch (err) {
                warn(`预缓存CDN资源失败: ${url}`, err);
            }
        });

        return Promise.all(fetchPromises);
    } catch (err) {
        warn('预缓存CDN资源过程失败:', err);
        return Promise.resolve();
    }
}

/**
 * 激活事件处理 - 清理旧缓存并检查过期资源
 */
self.addEventListener('activate', event => {
    log('激活事件触发');

    event.waitUntil(
        Promise.all([
            // 清理旧版本缓存
            cleanupOldCaches(),

            // 清理过期资源
            cleanupExpiredResources()
        ])
        .then(() => {
            log('缓存清理完成');
            return self.clients.claim(); // 接管所有客户端
        })
        .catch(err => {
            warn('缓存清理过程出错:', err);
            return self.clients.claim(); // 即使出错也继续接管客户端
        })
    );

    // 如果是安全上下文，发送消息通知客户端
    if (isSecureContext) {
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_ACTIVATED',
                    version: CACHE_VERSION
                });
            });
        });
    }
});

/**
 * 清理旧版本缓存
 */
async function cleanupOldCaches() {
    try {
        const cacheNames = await caches.keys();
        const deletionPromises = cacheNames.map(cacheName => {
            // 删除旧版本缓存
            if (
                cacheName !== STATIC_CACHE_NAME &&
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CDN_CACHE_NAME &&
                cacheName.includes('qbin-')
            ) {
                log('删除旧缓存:', cacheName);
                return caches.delete(cacheName);
            }
            return null;
        }).filter(Boolean);

        return Promise.all(deletionPromises);
    } catch (err) {
        warn('清理旧缓存失败:', err);
        return Promise.resolve(); // 不让这个错误影响整体激活过程
    }
}

/**
 * 清理过期资源
 */
async function cleanupExpiredResources() {
    try {
        const now = Date.now();

        // 清理静态资源缓存中的过期资源
        await cleanupExpiredCacheEntries(STATIC_CACHE_NAME, now - CACHE_EXPIRATION.static);

        // 清理动态资源缓存中的过期资源
        await cleanupExpiredCacheEntries(DYNAMIC_CACHE_NAME, now - CACHE_EXPIRATION.dynamic);

        // 清理CDN资源缓存中的过期资源
        await cleanupExpiredCacheEntries(CDN_CACHE_NAME, now - CACHE_EXPIRATION.cdn);

        return Promise.resolve();
    } catch (err) {
        warn('清理过期资源失败:', err);
        return Promise.resolve();
    }
}

/**
 * 清理指定缓存中的过期条目
 */
async function cleanupExpiredCacheEntries(cacheName, expirationTime) {
    try {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();

        const deletionPromises = requests.map(async request => {
            try {
                const response = await cache.match(request);
                if (!response) return null;

                // 获取响应的时间戳
                const dateHeader = response.headers.get('date');
                if (!dateHeader) return null;

                const responseTime = new Date(dateHeader).getTime();
                if (responseTime < expirationTime) {
                    log(`删除过期资源: ${request.url}`);
                    return cache.delete(request);
                }

                return null;
            } catch (err) {
                warn(`处理缓存条目时出错: ${request.url}`, err);
                return null;
            }
        });

        return Promise.all(deletionPromises.filter(Boolean));
    } catch (err) {
        warn(`清理缓存 ${cacheName} 失败:`, err);
        return Promise.resolve();
    }
}

// 判断请求是否为静态资源
function isStaticResource(url) {
    const path = new URL(url).pathname;
    return STATIC_RESOURCES.some(staticPath => path.startsWith(staticPath));
}

// 判断请求是否为页面模板
function isPageTemplate(url) {
    const path = new URL(url).pathname;

    // 精确匹配页面模板路径
    if (PAGE_TEMPLATES.some(templatePath => path === templatePath)) {
        return true;
    }

    // 判断是否为 /p/xxx、/c/xxx、/m/xxx、/e/xxx 路径
    if (path.match(/^\/[pcme](\/.*)?$/)) {
        return true;
    }

    return false;
}

// 判断请求是否为实时数据
function isRealtimeResource(url) {
    const path = new URL(url).pathname;
    return REALTIME_PATHS.some(realtimePath => path.startsWith(realtimePath));
}

// 判断请求是否为CDN资源
function isCdnResource(url) {
    return CDN_RESOURCES.some(cdnPath => url.startsWith(cdnPath));
}

/**
 * 请求拦截处理
 */
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // 仅处理GET请求
    if (request.method !== 'GET') return;
    
    // 跳过敏感资源和授权请求
    if (['.pem', '.key', '.cert'].some(ext => url.pathname.includes(ext))) return;
    if (['token=', 'auth=', 'key='].some(param => url.search.includes(param))) return;
    
    // 非安全上下文(HTTP)环境下的处理
    if (!isSecureContext) {
        if (isStaticResource(request.url) && url.origin === self.location.origin) {
            event.respondWith(limitedCacheStrategy(request));
        }
        return;
    }
    
    // 安全上下文(HTTPS)环境下的处理
    try {
        // CDN或跨域资源处理
        if (isCdnResource(request.url) || url.origin !== self.location.origin) {
            event.respondWith(cdnCacheStrategy(request));
            return;
        }
        
        // 特殊路径处理(/p/、/c/、/m/、/e/)
        const path = url.pathname;
        if (path.match(/^\/[pcme](\/.*)?$/)) {
            event.respondWith(handleTemplateRoutes(request));
            return;
        }
        
        // 根路径处理
        if (path === '/') {
            event.respondWith(handleRootPath(request));
            return;
        }
        
        // 基于资源类型应用不同的缓存策略
        if (isStaticResource(request.url)) {
            // 静态资源: 缓存优先
            event.respondWith(cacheFirstStrategy(request));
        } else if (isPageTemplate(request.url)) {
            // 页面模板: 缓存优先，定期更新
            event.respondWith(cacheFirstStrategy(request));
        } else if (isRealtimeResource(request.url)) {
            // 实时数据: 网络优先
            event.respondWith(networkFirstStrategy(request));
        } else {
            // 其他资源: 网络优先
            event.respondWith(networkFirstStrategy(request));
        }
    } catch (err) {
        error('缓存策略处理错误:', err);
    }
});

/**
 * 有限缓存策略 - 用于HTTP环境
 */
async function limitedCacheStrategy(request) {
    try {
        // 先尝试从缓存获取
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // 如果缓存中没有，尝试从网络获取
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            // 只缓存关键的静态资源
            const criticalResources = [
                '/favicon.ico',
                '/static/css/panel-common.css',
                '/static/js/utils.js'
            ];

            const url = new URL(request.url);
            if (criticalResources.some(path => url.pathname === path)) {
                const cache = await caches.open(STATIC_CACHE_NAME);
                cache.put(request, networkResponse.clone());
            }
        }
        return networkResponse;
    } catch (err) {
        warn('HTTP环境下缓存处理失败:', err);
        return new Response('Network error occurred', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * 创建带有条件验证头的请求
 * 支持 ETag 和 Last-Modified 缓存验证
 */
async function createConditionalRequest(request, cachedResponse) {
    const headers = new Headers(request.headers);
    
    // 尝试不同大小写形式获取ETag (解决大小写敏感问题)
    const etag = cachedResponse.headers.get('ETag') || 
                cachedResponse.headers.get('etag') || 
                cachedResponse.headers.get('Etag');
    
    if (etag) {
        headers.set('If-None-Match', etag);
        log(`使用 ETag 验证: ${etag} - ${request.url}`);
    } else {
        // 如果没有 ETag，退回到 Last-Modified
        const lastModified = cachedResponse.headers.get('Last-Modified') || 
                            cachedResponse.headers.get('last-modified');
        if (lastModified) {
            headers.set('If-Modified-Since', lastModified);
            log(`使用 Last-Modified 验证: ${lastModified} - ${request.url}`);
        }
    }

    return new Request(request.url, {
        method: request.method,
        headers: headers,
        mode: request.mode === 'navigate' ? 'same-origin' : request.mode,
        credentials: request.credentials,
        cache: 'no-cache', // 强制检查新鲜度
        redirect: request.redirect,
        referrer: request.referrer,
        integrity: request.integrity
    });
}

/**
 * 确保缓存响应保留所有重要头信息
 * 特别是确保ETag和Last-Modified被保留
 */
async function cacheResponseWithHeaders(cache, request, response) {
    // 检查响应是否有效
    if (!response || !response.ok) return;
    
    // 创建响应副本，确保头信息被保留
    const clonedResponse = response.clone();
    
    // 调试输出 - 检查响应是否包含ETag
    if (DEBUG) {
        const etag = clonedResponse.headers.get('ETag') || clonedResponse.headers.get('etag');
        if (etag) {
            log(`缓存带有ETag的响应: ${etag} - ${request.url}`);
        } else {
            log(`缓存的响应没有ETag: ${request.url}`);
        }
    }
    
    try {
        await cache.put(request, clonedResponse);
        log(`已缓存响应: ${request.url}`);
    } catch (err) {
        warn(`缓存响应失败: ${request.url}`, err);
    }
}

/**
 * 处理服务器响应状态
 * 优雅处理 304 Not Modified、200 和 5xx 错误
 */
function handleServerResponse(response, cachedResponse, request, cache) {
    return (async () => {
        // 304 Not Modified - 资源未变化，使用缓存
        if (response.status === 304 && cachedResponse) {
            log(`资源未变化 (ETag匹配): ${request.url}`);
            return cachedResponse;
        }
        
        // 200 OK - 资源已更新，更新缓存
        if (response.status === 200) {
            log(`资源已更新: ${request.url}`);
            if (cache) {
                await cacheResponseWithHeaders(cache, request, response.clone());
            }
            return response;
        }
        
        // 服务器错误 - 使用缓存
        if (response.status >= 500 && cachedResponse) {
            warn(`服务器错误 ${response.status}，使用缓存: ${request.url}`);
            return cachedResponse;
        }
        
        // 其他情况返回原始响应
        return response;
    })();
}

/**
 * 缓存优先策略 - 适用于静态资源
 * 优先返回缓存内容，同时在后台校验更新
 */
async function cacheFirstStrategy(request) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // 如果有缓存，立即返回并在后台更新
        log(`从缓存返回: ${request.url}`);
        
        // 异步更新缓存，不影响主流程
        (async () => {
            try {
                const conditionalRequest = await createConditionalRequest(request, cachedResponse);
                const networkResponse = await fetch(conditionalRequest);
                await handleServerResponse(networkResponse, cachedResponse, request, cache);
            } catch (err) {
                warn(`后台更新失败: ${request.url}`, err);
            }
        })();
        
        return cachedResponse;
    }

    try {
        // 缓存中没有，从网络获取
        const networkResponse = await fetch(request);
        
        // 处理响应
        if (networkResponse.status === 200) {
            // 缓存成功响应
            await cacheResponseWithHeaders(cache, request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (err) {
        warn(`网络请求失败: ${request.url}`, err);
        
        // 再次检查缓存（并发情况）
        const reCheckCachedResponse = await cache.match(request);
        if (reCheckCachedResponse) {
            return reCheckCachedResponse;
        }
        
        // 完全失败时返回错误响应
        return new Response('请求失败，无法获取资源', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
        });
    }
}

/**
 * 网络优先策略 - 适用于实时数据
 * 优先使用网络，失败时回退到缓存
 */
async function networkFirstStrategy(request) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    try {
        // 准备网络请求，如果有缓存则使用条件请求
        let networkRequest = request;
        if (cachedResponse) {
            networkRequest = await createConditionalRequest(request, cachedResponse);
        }
        
        // 发起网络请求
        const networkResponse = await fetch(networkRequest);
        
        // 处理响应
        return await handleServerResponse(networkResponse, cachedResponse, request, cache);
    } catch (err) {
        warn(`网络请求失败: ${request.url}`, err);
        
        // 网络失败，使用缓存
        if (cachedResponse) {
            log(`使用缓存响应: ${request.url}`);
            return cachedResponse;
        }
        
        // 无缓存可用，返回错误响应
        return new Response('无法获取实时数据', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
        });
    }
}

// Stale-While-Revalidate 策略 - 适用于页面模板
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);

    // 先尝试从缓存获取
    const cachedResponse = await cache.match(request);

    // 准备网络请求，如果有缓存则使用条件请求
    let networkRequest = request;
    if (cachedResponse) {
        try {
            networkRequest = await createConditionalRequest(request, cachedResponse);
            log(`Stale-While-Revalidate 使用条件请求: ${request.url}`);
        } catch (condErr) {
            warn('Stale-While-Revalidate 创建条件请求失败:', condErr);
        }
    }

    // 无论是否命中缓存，都发起网络请求以更新缓存
    const networkResponsePromise = fetch(networkRequest).then(async networkResponse => {
        // 处理 304 Not Modified 和服务器错误
        if (cachedResponse) {
            if (networkResponse.status === 304) {
                log(`资源未变化 (304): ${request.url}`);
                return cachedResponse;
            } else if (networkResponse.status >= 500) {
                warn(`服务器错误 ${networkResponse.status}，使用缓存: ${request.url}`);
                return cachedResponse;
            }
        }

        // 如果响应成功，更新缓存
        if (networkResponse && networkResponse.status === 200) {
            await cache.put(request, networkResponse.clone());
            log(`Stale-While-Revalidate 更新缓存: ${request.url}`);
        }

        return networkResponse;
    }).catch(error => {
        warn('Stale-While-Revalidate 网络请求失败:', error);
        return null;
    });

    // 如果有缓存，立即返回缓存的响应
    if (cachedResponse) {
        return cachedResponse;
    }

    // 否则等待网络响应
    const networkResponse = await networkResponsePromise;
    if (networkResponse) {
        return networkResponse;
    }

    // 如果网络请求也失败，返回错误响应
    return new Response('网络请求失败，且缓存中没有该资源', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
    });
}

// CDN资源缓存策略 - 适用于跨域资源
async function cdnCacheStrategy(request) {
    // 先检查缓存
    const cache = await caches.open(CDN_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // 如果有缓存，在后台开始更新缓存
        try {
            // 尝试使用条件请求更新CDN缓存
            updateCdnCacheWithValidation(request, cachedResponse).catch(error => {
                warn('Background CDN cache update failed:', error);
            });
        } catch (err) {
            warn('Failed to initiate CDN cache update:', err);
        }

        return cachedResponse;
    }

    // 如果没有缓存，尝试从网络获取并缓存
    try {
        const response = await fetch(request, { mode: 'cors', credentials: 'omit' });

        // 处理服务器错误
        if (response.status >= 500) {
            warn(`CDN 服务器错误 ${response.status}: ${request.url}`);
            // 尝试再次检查缓存（以防并发更新）
            const reCheckCachedResponse = await cache.match(request);
            if (reCheckCachedResponse) {
                return reCheckCachedResponse;
            }
        }

        // 如果响应成功，缓存它
        if (response && response.status === 200) {
            await cache.put(request, response.clone());
            log(`新的CDN资源已缓存: ${request.url}`);
        }

        return response;
    } catch (error) {
        warn('CDN fetch failed:', error);

        // 再次尝试从缓存获取（以防并发更新）
        const reCheckCachedResponse = await cache.match(request);
        if (reCheckCachedResponse) {
            return reCheckCachedResponse;
        }

        return new Response('无法获取CDN资源', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
        });
    }
}

/**
 * 使用条件验证更新CDN缓存
 */
async function updateCdnCacheWithValidation(request, cachedResponse) {
    try {
        // 创建条件请求
        const conditionalRequest = await createConditionalRequest(request, cachedResponse);
        
        // 直接使用条件请求对象进行fetch
        const response = await fetch(conditionalRequest);
        
        // 处理 304 Not Modified
        if (response.status === 304) {
            log(`CDN资源未变化 (ETag匹配): ${request.url}`);
            return;
        }
        
        // 如果资源已更新，更新缓存
        if (response.status === 200) {
            const cache = await caches.open(CDN_CACHE_NAME);
            await cacheResponseWithHeaders(cache, request, response);
            log(`CDN资源已更新: ${request.url}`);
            return;
        }
        
        // 其他状态码
        warn(`CDN资源更新失败，状态码: ${response.status}`);
    } catch (error) {
        warn(`更新CDN缓存失败: ${request.url}`, error);
        throw error;
    }
}

/**
 * 页面模板处理 - 特殊路径映射与缓存
 * 处理 /p/、/c/、/m/、/e/ 路径
 */
async function handleTemplateRoutes(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const prefix = path.substring(0, 3); // 获取 /p/、/c/、/m/、/e/ 前缀
    
    try {
        // 构建基础模板URL（/p、/c、/m、/e）
        const targetUrl = new URL(prefix, self.location.origin);
        targetUrl.search = url.search; // 保留查询参数
        const templateRequest = new Request(targetUrl.toString());
        
        // 优先从缓存获取模板
        const cache = await caches.open(STATIC_CACHE_NAME);
        const cachedTemplate = await cache.match(templateRequest);
        
        if (cachedTemplate) {
            log(`使用缓存模板: ${targetUrl}`);
            
            // 后台异步更新模板
            (async () => {
                try {
                    const conditionalRequest = await createConditionalRequest(templateRequest, cachedTemplate);
                    const networkResponse = await fetch(conditionalRequest);
                    await handleServerResponse(networkResponse, cachedTemplate, templateRequest, cache);
                } catch (err) {
                    warn(`模板后台更新失败: ${targetUrl}`, err);
                }
            })();
            
            return cachedTemplate;
        }
        
        // 缓存中没有，从网络获取
        log(`从网络获取模板: ${targetUrl}`);
        const networkResponse = await fetch(templateRequest);
        
        // 处理响应
        if (networkResponse.status === 200) {
            await cache.put(templateRequest, networkResponse.clone());
            log(`已缓存模板: ${targetUrl}`);
        }
        
        return networkResponse;
    } catch (err) {
        error(`模板路由处理错误: ${path}`, err);
        
        // 尝试获取基本模板作为备用
        try {
            const fallbackUrl = new URL(prefix, self.location.origin);
            const cache = await caches.open(STATIC_CACHE_NAME);
            const fallbackResponse = await cache.match(new Request(fallbackUrl.toString()));
            
            if (fallbackResponse) {
                log(`使用备用模板: ${fallbackUrl}`);
                return fallbackResponse;
            }
        } catch (fallbackErr) {
            error(`备用模板获取失败`, fallbackErr);
        }
        
        // 返回通用错误响应
        return new Response('页面加载失败，请检查网络连接', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
        });
    }
}