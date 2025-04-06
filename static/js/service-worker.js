/**
 * QBin Progressive Web App - Service Worker
 * 支持HTTP/HTTPS协议和降级方案
 */

// 缓存配置
const CACHE_VERSION = 'v1.20';
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
    '/static/css/fonts/',
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
            event.respondWith(cacheFirstStrategy(request));  // StaleWhileRevalidate
            return;
        }

        const path = url.pathname;
        
        // 处理根路径和模板路径 (/, /p/, /c/, /m/, /e/)
        if (path === '/' || path.match(/^\/[pcme](\/.*)?$/)) {
            event.respondWith(handleTemplateRoutes(request));
            return;
        }

        // 基于资源类型应用不同的缓存策略
        if (isStaticResource(request.url) || isPageTemplate(request.url)) {
            // 静态资源和页面模板: 缓存优先
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
 * 验证并更新缓存 - 统一处理本地资源和CDN资源
 * @param {Request} request 原始请求
 * @param {Response} cachedResponse 已缓存的响应
 * @param {Cache} cache 缓存对象
 * @param {Object} options 配置选项
 * @param {boolean} options.isCdn 是否为CDN资源
 * @param {string} options.type 资源类型描述（用于日志）
 */
async function validateAndUpdateCache(request, cachedResponse, cache, options = {}) {
    const isCdn = options.isCdn || false;
    const resourceType = options.type || '资源';
    
    try {
        // 准备请求头
        const headers = new Headers();
        
        // 复制原始请求头（如果不是CDN）
        if (!isCdn && request.headers) {
            request.headers.forEach((value, key) => {
                headers.set(key, value);
            });
        }
        
        // CDN资源需要特殊处理
        if (isCdn) {
            headers.set('Accept', '*/*');
            headers.set('Origin', self.location.origin);
        }
        
        // 添加条件验证头
        const etag = cachedResponse.headers.get('etag') || 
                     cachedResponse.headers.get('ETag') || 
                     cachedResponse.headers.get('Etag');
        
        if (etag) {
            headers.set('If-None-Match', etag);
            if (DEBUG) log(`添加条件验证头If-None-Match: ${etag} - ${request.url}`);
        } else {
            const lastModified = cachedResponse.headers.get('last-modified') || 
                                 cachedResponse.headers.get('Last-Modified');
            if (lastModified) {
                headers.set('If-Modified-Since', lastModified);
                if (DEBUG) log(`添加条件验证头If-Modified-Since: ${lastModified} - ${request.url}`);
            }
        }
        
        // 创建条件验证请求
        const conditionalRequest = new Request(request.url, {
            method: 'GET',
            headers: headers,
            mode: isCdn ? 'cors' : request.mode,
            credentials: isCdn ? 'omit' : request.credentials,
            cache: 'no-cache',
            redirect: request.redirect || 'follow',
            referrer: request.referrer
        });
        
        // 发送条件验证请求
        const response = await fetch(conditionalRequest);
        
        if (response.status === 304) {
            // 资源未变化，不需要更新
            if (DEBUG) log(`${resourceType}未变化: ${request.url}`);
        } else if (response.ok) {
            // 资源已更新，更新缓存
            if (DEBUG) log(`更新${resourceType}缓存: ${request.url}`);
            await cache.put(request, response);
        }
        
        return response;
    } catch (err) {
        // 验证过程出错，但不影响整体流程
        if (DEBUG) warn(`${resourceType}缓存验证出错: ${request.url}`, err);
        return null;
    }
}

/**
 * 缓存优先策略 - 适用于静态资源和页面模板
 */
async function cacheFirstStrategy(request) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // 立即返回缓存内容
        if (DEBUG) log(`缓存优先: 返回缓存 - ${request.url}`);

        // 后台验证
        // setTimeout(() => {
        //     validateAndUpdateCache(request, cachedResponse, cache);
        // }, 0);
        return cachedResponse;
    }

    try {
        // 从网络获取
        if (DEBUG) log(`缓存优先: 从网络获取 - ${request.url}`);
        const response = await fetch(request);

        if (response.ok) {
            const clonedResponse = response.clone();
            cache.put(request, clonedResponse);
        }

        return response;
    } catch (err) {
        // 网络错误
        if (DEBUG) warn(`网络请求失败: ${request.url}`);

        // 再次检查缓存（处理race condition）
        const recheck = await cache.match(request);
        if (recheck) return recheck;

        // 返回错误响应
        return new Response('无法加载资源', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=UTF-8'}
        });
    }
}

/**
 * 网络优先策略 - 适用于实时数据
 */
async function networkFirstStrategy(request) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    try {
        // 准备网络请求
        let networkRequest = request.clone();

        // 创建带有条件验证头的请求(如果有缓存)
        if (cachedResponse) {
            const headers = new Headers(request.headers);

            // 获取缓存的ETag和Last-Modified (注意大小写变体)
            const etag = cachedResponse.headers.get('etag') ||
                         cachedResponse.headers.get('ETag') ||
                         cachedResponse.headers.get('Etag');

            if (etag) {
                headers.set('If-None-Match', etag);
                if (DEBUG) log(`添加条件验证头If-None-Match: ${etag} - ${request.url}`);
            }

            const lastModified = cachedResponse.headers.get('last-modified') ||
                                cachedResponse.headers.get('Last-Modified');
            if (lastModified) {
                headers.set('If-Modified-Since', lastModified);
                if (DEBUG) log(`添加条件验证头If-Modified-Since: ${lastModified} - ${request.url}`);
            }

            // 创建新的请求，确保包含验证头
            networkRequest = new Request(request.url, {
                method: request.method,
                headers: headers,
                mode: request.mode,
                credentials: request.credentials,
                cache: 'no-cache', // 防止浏览器缓存干扰
                redirect: request.redirect,
                referrer: request.referrer
            });
        }

        // 发送网络请求
        const response = await fetch(networkRequest);

        // 处理响应
        if (response.status === 304 && cachedResponse) {
            // 304表示资源未变化，使用缓存
            if (DEBUG) log(`网络优先: 资源未变化(304) - ${request.url}`);
            return cachedResponse;
        } else if (response.ok) {
            // 更新缓存 - 创建一个新的响应对象，确保包含关键头信息
            const responseToCache = response.clone();
            const headers = new Headers(responseToCache.headers);

            // 确保有date头，用于过期判断
            if (!headers.has('date')) {
                headers.set('date', new Date().toUTCString());
            }

            // 创建增强的响应用于缓存
            const enhancedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
            });

            // 将增强的响应存入缓存
            cache.put(request, enhancedResponse);

            if (DEBUG) log(`网络优先: 更新缓存 - ${request.url}`);
            return response;
        } else if (response.status >= 500 && cachedResponse) {
            // 服务器错误，回退到缓存
            if (DEBUG) warn(`网络优先: 服务器错误(${response.status})，使用缓存 - ${request.url}`);
            return cachedResponse;
        }

        // 其他情况返回网络响应
        return response;
    } catch (err) {
        if (DEBUG) warn(`网络请求失败: ${request.url}`, err);

        // 网络失败时回退到缓存
        if (cachedResponse) {
            if (DEBUG) log(`网络优先: 网络失败，使用缓存 - ${request.url}`);
            return cachedResponse;
        }

        // 完全失败
        return new Response('无法获取资源', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=UTF-8'}
        });
    }
}

/**
 * 先缓存后网络策略
 */
async function StaleWhileRevalidate(request) {
    const cdnRequest = new Request(request.url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache'
    });

    const cache = await caches.open(CDN_CACHE_NAME);
    const cachedResponse = await cache.match(cdnRequest);

    const backgroundUpdate = (async () => {
        try {
            // 如果有缓存，使用条件验证请求
            if (cachedResponse) {
                await validateAndUpdateCache(cdnRequest, cachedResponse, cache, {
                    isCdn: true,
                    type: 'CDN资源'
                });
            } else {
                // 如果没有缓存，直接获取并缓存
                const networkResponse = await fetch(cdnRequest);
                if (networkResponse && networkResponse.ok) {
                    // 确保新响应包含date头用于过期管理
                    const headers = new Headers(networkResponse.headers);
                    if (!headers.has('date')) {
                        headers.set('date', new Date().toUTCString());
                    }

                    // 创建增强的响应
                    const enhancedResponse = new Response(networkResponse.clone().body, {
                        status: networkResponse.status,
                        statusText: networkResponse.statusText,
                        headers: headers
                    });

                    await cache.put(cdnRequest, enhancedResponse);
                    if (DEBUG) log(`CDN资源缓存: ${cdnRequest.url}`);
                }
            }
        } catch (err) {
            if (DEBUG) warn(`CDN资源后台更新失败: ${cdnRequest.url}`, err);
        }
    })();

    if (cachedResponse) {
        if (DEBUG) log(`CDN缓存返回: ${cdnRequest.url}`);
        backgroundUpdate.catch(err => warn(`CDN后台更新错误: ${cdnRequest.url}`, err));
        return cachedResponse;
    }

    // 缓存不存在时等待网络响应
    try {
        if (DEBUG) log(`CDN资源从网络获取: ${cdnRequest.url}`);
        const networkResponse = await fetch(cdnRequest);

        // 完成后台更新过程以确保缓存更新
        await backgroundUpdate;

        if (networkResponse.ok) {
            return networkResponse;
        } else {
            return new Response('CDN资源加载失败', {
                status: networkResponse.status,
                headers: {'Content-Type': 'text/plain; charset=UTF-8'}
            });
        }
    } catch (err) {
        if (DEBUG) warn(`CDN资源获取失败: ${cdnRequest.url}`, err);

        // 网络请求失败，再次检查缓存（以防在这段时间内被其他请求填充）
        const recheckCache = await cache.match(cdnRequest);
        if (recheckCache) {
            if (DEBUG) log(`CDN资源重新检查缓存命中: ${cdnRequest.url}`);
            return recheckCache;
        }

        // 完全失败的情况
        return new Response('无法加载CDN资源', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=UTF-8'}
        });
    }
}

/**
 * 处理页面模板路由 - 包括根路径和模板路径
 */
async function handleTemplateRoutes(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
        let templatePath;
        if (path === '/') {
            const cookies = request.headers.get('cookie') || '';
            const editorTypeMatch = cookies.match(/(?:^|;\s*)qbin-editor\s*=\s*([^;]*)/i);
            let editorType = editorTypeMatch ? editorTypeMatch[1].trim() : '';
            if (!['e', 'c', 'm'].includes(editorType)) {
                editorType = 'e';  // 默认使用 'e' 编辑器
            }
            if (DEBUG) log(`根路径请求: 使用${editorType}编辑器模板`);
            templatePath = `/${editorType}`;
        } else {
            templatePath = path.substring(0, 2);
        }
        
        // 构建模板请求
        const templateUrl = new URL(templatePath, self.location.origin);
        templateUrl.search = url.search;
        const templateRequest = new Request(templateUrl.toString(), {
            method: 'GET',
            headers: request.headers,
            mode: request.mode, 
            credentials: request.credentials,
            redirect: 'follow'
        });
        
        return await cacheFirstStrategy(templateRequest);
    } catch (err) {
        if (DEBUG) error(`模板路由处理失败: ${path}`, err);
        
        try {
            let fallbackPrefix = path === '/' ? '/e' : path.substring(0, 2);
            const fallbackUrl = new URL(fallbackPrefix, self.location.origin);
            const cache = await caches.open(STATIC_CACHE_NAME);
            const fallback = await cache.match(new Request(fallbackUrl.toString()));
            if (fallback) return fallback;
        } catch (fallbackErr) {
            if (DEBUG) error(`备用模板获取失败`, fallbackErr);
        }
        
        // 返回错误响应
        return new Response('页面加载失败', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=UTF-8'}
        });
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
            'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/loader.min.js',
            'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'
        ];

        const fetchPromises = criticalCdnResources.map(async url => {
            try {
                // 首先检查资源是否已缓存
                const request = new Request(url, { mode: 'cors', credentials: 'omit' });
                const cachedResponse = await cdnCache.match(request);

                if (!cachedResponse) {
                    // 资源未缓存，直接获取并存入缓存
                    if (DEBUG) log(`预缓存CDN资源: ${url}`);
                    const response = await fetch(request);
                    if (response && response.ok) {
                        await cdnCache.put(request, response);
                    }
                } else {
                    // 资源已缓存，使用条件请求进行验证更新
                    if (DEBUG) log(`验证CDN缓存: ${url}`);
                    validateAndUpdateCache(request, cachedResponse, cdnCache, {
                        isCdn: true,
                        type: 'CDN资源'
                    }).catch(err => {
                        warn(`CDN缓存验证失败: ${url}`, err);
                    });
                }
                return true;
            } catch (err) {
                warn(`预缓存CDN资源失败: ${url}`, err);
                return false;
            }
        });

        await Promise.all(fetchPromises);
        return Promise.resolve();
    } catch (err) {
        warn('预缓存CDN资源过程失败:', err);
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

