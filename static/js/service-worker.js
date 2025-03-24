const CACHE_NAME = 'qbin-cache-v1';
const urlsToCache = [
    '/',
    '/e',
    '/p',
    '/r',
    '/c',
    '/m',
    '/error',
    '/login',
    '/password',
    '/manifest.json',
    '/static/css/render.css',
    '/static/js/render.js'
];

// 安装事件处理
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(error => console.warn('Cache installation failed:', error))
    );
});

// 请求拦截处理
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        // 只缓存成功的请求
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        // 克隆响应以便缓存使用
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            })
                            .catch(error => console.warn('Cache update failed:', error));
                        return response;
                    });
            })
            .catch(() => {
                // 离线时返回默认响应
                return new Response('Network error occurred', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
    );
});

// 缓存清理
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});