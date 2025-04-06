/**
 * QBin PWA 处理程序
 * 支持HTTP/HTTPS协议和降级方案
 */
(function() {
    // 初始化全局变量
    window.QBinPWA = {
        isSupported: 'serviceWorker' in navigator,
        isHTTPS: location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1',
        registration: null,
        offlineReady: false
    };
    
    // 检测是否支持IndexedDB（用于离线存储）
    window.QBinPWA.hasIndexedDB = 'indexedDB' in window;
    
    // 检测是否支持Cache API
    window.QBinPWA.hasCacheAPI = 'caches' in window;

    // 注册Service Worker
    function registerServiceWorker() {
        if (window.QBinPWA.isSupported && window.QBinPWA.isHTTPS) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js', { scope: "/" })
                    .then(registration => {
                        window.QBinPWA.registration = registration;
                        console.log('Service Worker 注册成功:', registration.scope);
                        
                        // 监听控制台状态变化
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'activated') {
                                    window.QBinPWA.offlineReady = true;
                                    console.log('离线模式已就绪');
                                }
                            });
                        });
                        
                        // 如果已经有激活的Service Worker
                        if (registration.active) {
                            window.QBinPWA.offlineReady = true;
                        }
                    })
                    .catch(error => {
                        console.warn('Service Worker 注册失败:', error);
                        // 启用降级方案
                        enableFallbackMode('sw-register-error');
                    });
            });
            
            // 添加离线/在线状态检测
            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);
            updateOnlineStatus();
            
            // 监听来自Service Worker的消息
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'SW_ACTIVATED') {
                    console.log('收到Service Worker激活消息，版本:', event.data.version);
                    window.QBinPWA.offlineReady = true;
                }
            });
        } else {
            // 不支持Service Worker或非HTTPS，启用降级方案
            const reason = !window.QBinPWA.isSupported ? 'sw-not-supported' : 'not-https';
            enableFallbackMode(reason);
        }
    }
    
    // 更新在线/离线状态
    function updateOnlineStatus() {
        const isOnline = navigator.onLine;
        window.QBinPWA.isOnline = isOnline;
        
        // 如果需要，可以在这里添加UI提示
        if (!isOnline && window.QBinPWA.offlineReady) {
            console.log('当前处于离线模式，但离线缓存可用');
            showOfflineNotification(true);
        } else if (!isOnline) {
            console.log('当前处于离线模式，离线缓存尚未就绪');
            showOfflineNotification(false);
        } else {
            hideOfflineNotification();
        }
    }
    
    // 显示离线通知
    function showOfflineNotification(cacheAvailable) {
        // 检查是否已存在通知
        let notification = document.getElementById('offline-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'offline-notification';
            notification.style.position = 'fixed';
            notification.style.bottom = '20px';
            notification.style.right = '20px';
            notification.style.padding = '10px 15px';
            notification.style.borderRadius = '4px';
            notification.style.zIndex = '9999';
            notification.style.fontSize = '14px';
            notification.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(notification);
        }
        
        notification.style.backgroundColor = cacheAvailable ? '#4a6cf7' : '#f44336';
        notification.style.color = '#fff';
        notification.textContent = cacheAvailable 
            ? '您当前处于离线模式，但可以访问缓存内容' 
            : '您当前处于离线模式，部分功能可能不可用';
        notification.style.opacity = '1';
    }
    
    // 隐藏离线通知
    function hideOfflineNotification() {
        const notification = document.getElementById('offline-notification');
        if (notification) {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }
    
    // 启用降级方案
    function enableFallbackMode(reason) {
        window.QBinPWA.fallbackMode = true;
        window.QBinPWA.fallbackReason = reason;
        console.log('启用PWA降级方案，原因:', reason);
        
        // 如果支持localStorage，使用它来实现基本的离线功能
        if ('localStorage' in window) {
            window.QBinPWA.storage = localStorage;
        }
        
        if (window.QBinPWA.hasIndexedDB) {
        }
    }
    
    // 启动注册过程
    registerServiceWorker();
})();
