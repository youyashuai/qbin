/**
 * QBin Progressive Web App - Service Worker
 * 支持HTTP/HTTPS协议和降级方案
 */

// 缓存配置
const CACHE_VERSION = 'v1.6';
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
 * 请求拦截处理 - 根据资源类型和协议使用不同的缓存策略
 */
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (['.pem', '.key', '.cert'].some(ext => url.pathname.includes(ext))) return;
    if (['token=', 'auth=', 'key='].some(param => url.search.includes(param))) return;

    // 如果是非安全上下文，使用有限的缓存策略
    if (!isSecureContext) {
        if (isStaticResource(request.url) && url.origin === self.location.origin) {
            event.respondWith(limitedCacheStrategy(request));
        }
        return;
    }

    // 在HTTPS环境下，根据不同资源类型使用不同的缓存策略
    try {
        if (isCdnResource(request.url) || url.origin !== self.location.origin) {
            // CDN资源: 使用特殊的跨域缓存策略
            // 其他跨域资源: 使用网络优先策略并缓存
            event.respondWith(cdnCacheStrategy(request));
        }else {
            // 采用映射处理特殊路径: /p/、/c/、/m/、/e/ 和根路径 /
            const path = url.pathname;

            if (path.match(/^\/[pcme](\/.*)?$/)) {
                event.respondWith((async () => {
                    try {
                        const prefix = path.substring(0, 3);
                        // 获取原始URL的查询参数
                        const originalUrl = new URL(request.url);

                        // 构建新的URL，保留原始查询参数
                        const targetUrl = new URL(prefix, self.location.origin);
                        targetUrl.search = originalUrl.search;

                        // 先尝试从缓存中获取页面模板
                        const cache = await caches.open(STATIC_CACHE_NAME);
                        const templateResponse = await cache.match(new Request(targetUrl.toString()));

                        if (templateResponse) {
                            log(`从缓存返回页面: ${targetUrl}`);
                            return templateResponse;
                        }

                        // 如果缓存中没有，尝试从网络获取
                        log(`从网络获取页面: ${targetUrl}`);
                        const networkResponse = await fetch(targetUrl);

                        // 如果网络请求成功，将响应缓存起来以便离线使用
                        if (networkResponse && networkResponse.status === 200) {
                            const clonedResponse = networkResponse.clone();
                            cache.put(new Request(targetUrl.toString()), clonedResponse);
                            log(`已缓存页面: ${targetUrl}`);
                        }

                        return networkResponse;
                    } catch (err) {
                        console.error('路径处理错误:', err);

                        // 尝试从缓存中获取基本模板作为备用
                        try {
                            const prefix = path.substring(0, 3);
                            const fallbackUrl = new URL(prefix, self.location.origin);
                            const cache = await caches.open(STATIC_CACHE_NAME);
                            const fallbackResponse = await cache.match(new Request(fallbackUrl.toString()));

                            if (fallbackResponse) {
                                log(`使用备用模板: ${fallbackUrl}`);
                                return fallbackResponse;
                            }
                        } catch (fallbackErr) {
                            console.error('备用模板获取失败:', fallbackErr);
                        }

                        // 返回一个通用错误响应
                        return new Response('页面加载失败，请检查网络连接后再试', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
                        });
                    }
                })());
                return;
            }

            // 处理根路径 /，根据 cookie 中的 qbin-editor 值重定向到对应页面
            // 支持离线访问，在离线时使用缓存的页面
            if (path === '/') {
                event.respondWith((async () => {
                    try {
                        const cookieHeader = request.headers.get('cookie') || '';
                        const match = cookieHeader.match(/qbin-editor=([ecm])/);
                        let editorType = match ? match[1] : 'e';

                        let redirectPath;
                        switch (editorType) {
                            case 'c':
                                redirectPath = '/c/';
                                break;
                            case 'm':
                                redirectPath = '/m/';
                                break;
                            case 'e':
                            default:
                                redirectPath = '/e/';
                                break;
                        }

                        // 先检查目标页面是否已缓存
                        const targetUrl = new URL(redirectPath, self.location.origin);
                        const cache = await caches.open(STATIC_CACHE_NAME);
                        const cachedResponse = await cache.match(new Request(targetUrl.toString()));

                        // 如果目标页面已缓存，则使用缓存的响应
                        if (cachedResponse) {
                            log(`根路径重定向到缓存页面: ${targetUrl}`);
                            return Response.redirect(targetUrl, 302);
                        }

                        // 如果目标页面未缓存，尝试预缓存它
                        try {
                            const preloadResponse = await fetch(targetUrl);
                            if (preloadResponse && preloadResponse.status === 200) {
                                const clonedResponse = preloadResponse.clone();
                                cache.put(new Request(targetUrl.toString()), clonedResponse);
                                log(`预缓存根路径目标页面: ${targetUrl}`);
                            }
                        } catch (preloadErr) {
                            console.warn('预缓存目标页面失败:', preloadErr);
                        }

                        // 构建重定向响应
                        return Response.redirect(targetUrl, 302);
                    } catch (err) {
                        console.error('根路径处理错误:', err);

                        // 出错时尝试从缓存中获取默认编辑器页面
                        try {
                            const fallbackUrl = new URL('/e/', self.location.origin);
                            const cache = await caches.open(STATIC_CACHE_NAME);
                            const fallbackResponse = await cache.match(new Request(fallbackUrl.toString()));

                            if (fallbackResponse) {
                                log(`使用缓存的默认编辑器页面: ${fallbackUrl}`);
                                return Response.redirect(fallbackUrl, 302);
                            }
                        } catch (fallbackErr) {
                            console.error('获取默认编辑器页面失败:', fallbackErr);
                        }

                        // 最后的备用方案，直接重定向到 /e/
                        return Response.redirect(new URL('/e/', self.location.origin), 302);
                    }
                })());
                return;
            }
            if (isStaticResource(request.url)) {
                // 静态资源: 缓存优先，网络回退
                event.respondWith(cacheFirstStrategy(request));
            } else if (isPageTemplate(request.url)) {
                // 页面模板: 缓存优先，但定期从网络更新
                event.respondWith(staleWhileRevalidateStrategy(request));
            } else if (isRealtimeResource(request.url)) {
                // 实时数据: 网络优先，缓存回退
                event.respondWith(networkFirstStrategy(request));
            }else {
                // 其他资源: 网络优先，缓存回退
                event.respondWith(networkFirstStrategy(request));
            }
        }
    } catch (err) {
        // 如果缓存策略处理过程中出错，记录错误并回退到原始网络请求
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

// 缓存优先策略 - 适用于静态资源
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.warn('Network fetch failed:', error);
        return new Response('Network error occurred', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// 网络优先策略 - 适用于实时数据
async function networkFirstStrategy(request) {
    try {
        // 尝试从网络获取
        const networkResponse = await fetch(request);

        // 如果成功且状态为 200，则缓存响应
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // 网络请求失败，尝试从缓存获取
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // 如果缓存也没有，返回错误响应
        return new Response('Network error occurred and no cache available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Stale-While-Revalidate 策略 - 适用于页面模板
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);

    // 先尝试从缓存获取
    const cachedResponse = await cache.match(request);

    // 无论是否命中缓存，都发起网络请求以更新缓存
    const networkResponsePromise = fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(error => {
        console.warn('Network fetch failed in stale-while-revalidate:', error);
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
    return new Response('Network error occurred and no cache available', {
        status: 503,
        statusText: 'Service Unavailable'
    });
}

// CDN资源缓存策略 - 适用于跨域资源
async function cdnCacheStrategy(request) {
    // 先检查缓存
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        // 如果有缓存，在后台开始更新缓存
        updateCdnCache(request).catch(error =>
            console.warn('Background CDN cache update failed:', error)
        );
        return cachedResponse;
    }

    // 如果没有缓存，尝试从网络获取并缓存
    try {
        const response = await fetch(request, { mode: 'cors', credentials: 'omit' });
        if (response && response.status === 200) {
            const cache = await caches.open(CDN_CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.warn('CDN fetch failed:', error);
        return new Response('Failed to fetch CDN resource', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// 后台更新CDN缓存
async function updateCdnCache(request) {
    const cache = await caches.open(CDN_CACHE_NAME);
    const response = await fetch(request, { mode: 'cors', credentials: 'omit' });

    if (response && response.status === 200) {
        return cache.put(request, response);
    }

    throw new Error(`Failed to update CDN cache for ${request.url}`);
}