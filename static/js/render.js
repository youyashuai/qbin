class Viewer {
    constructor() {
        this.currentPath = this.parsePath(window.location.pathname);
        this.lastClickTime = 0;
        this.clickTimeout = null;
        this.CACHE_KEY = 'qbin/';
        this.cacheName = 'qbin-cache-v1';
        this.buttonBar = document.getElementById('buttonBar');
        this.contentArea = document.getElementById('contentArea');
        this.isProcessing = false;
        this.debounceTimeouts = new Map();
        this.qrLoaded = false;
        this.isLoading = false;
        // 检查环境是否支持 Cache API
        this.cacheSupported = 'caches' in window;
        this.init();
    }

    // 显示 fetch 加载动画（含进度条）
    showLoading() {
        this.isLoading = true;
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-container';
        loadingEl.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">正在加载内容...</div>
        `;
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(loadingEl);
    }

    // 隐藏加载动画
    hideLoading() {
        this.isLoading = false;
        const loadingEl = this.contentArea.querySelector('.loading-container');
        if (loadingEl) {
            loadingEl.remove();
        }
    }

    // 更新加载进度（用于文本流式加载）
    updateLoadingProgress(loaded, total) {
        const percent = Math.round((loaded / total) * 100);
        const progressBar = document.querySelector('.loading-progress-bar');
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = `正在加载内容... (${percent}%)`;
        }
    }

    async init() {
        try {
            // await this.registerServiceWorker();

            const {key, pwd} = this.currentPath;
            if (!key) {
                this.hideLoading();
                return;
            }

            const url = `/r/${key}/${pwd}`;
            this.showLoading();

            // 使用 HEAD 请求获取文件信息
            const headResponse = await fetch(url, { method: 'HEAD' });
            if (!headResponse.ok) {
                const status = headResponse.status;
                if(status === 403) {
                    throw new Error('访问密码错误');
                } else if(status === 404) {
                    throw new Error('访问内容不存在');
                }
                throw new Error('内容加载失败');
            }
            const contentType = headResponse.headers.get('Content-Type');

            const contentLength = headResponse.headers.get('Content-Length');
            this.clearContent();
            this.setupButtons(contentType);

            // 如果文件格式既不是文本也不是图片，则不进行完整下载
            if (!contentType?.startsWith('text/') && !contentType?.startsWith('image/')) {
                const fileInfo = document.createElement('div');
                fileInfo.className = 'file-info';
                const size = headResponse.headers.get('Content-Length');
                fileInfo.textContent = `文件类型: ${contentType}\t大小: ${size ? Math.ceil(size / 1024) : '未知'}KB`;
                this.contentArea.appendChild(fileInfo);
                return;
            }

            // 如果文件是文本或图片，继续发起 GET 请求下载文件内容
            this.showLoading();
            const response = await this.fetchWithCache(url);
            if (contentType?.startsWith('text/')) {
                await this.renderTextContent(response, contentLength);
            } else if (contentType?.startsWith('image/')) {
                await this.renderImageContent(response, contentType, contentLength);
            }
            else {
                // 兜底情况
                const fileInfo = document.createElement('div');
                fileInfo.className = 'file-info';
                fileInfo.textContent = `文件类型: ${contentType}\t大小: ${contentLength ? Math.ceil(contentLength / 1024) : '未知'}KB`;
                this.contentArea.appendChild(fileInfo);
                this.hideLoading();
            }
        } catch (error) {
            console.error('Error loading content:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'file-info error';
            errorDiv.textContent = error.message || '内容加载失败';
            this.contentArea.innerHTML = '';
            this.contentArea.appendChild(errorDiv);

            const debouncedNew = this.debounce(() => this.handleNew());
            this.buttonBar.appendChild(this.addButton('New', debouncedNew));
            // const debouncedFork = this.debounce(() => this.handleFork());
            // this.buttonBar.appendChild(this.addButton('Fork', debouncedFork));
            this.hideLoading();
        }
    }

    async fetchWithCache(url) {
        // 如果不支持 Cache API，直接使用普通fetch
        if (!this.cacheSupported) {
            return fetch(url);
        }

        try {
            const cacheResponse = await caches.match(url);
            const fetchRequest = new Request(url, {
                headers: {
                    'If-None-Match': cacheResponse?.headers.get('ETag'),
                    'If-Modified-Since': cacheResponse?.headers.get('Last-Modified')
                },
            });

            try {
                const response = await fetch(fetchRequest);
                if (response.status === 304 && cacheResponse) {
                    return cacheResponse;
                }
                if (response.ok) {
                    const clonedResponse = response.clone();
                    const cache = await caches.open(this.cacheName);
                    await cache.put(url, clonedResponse);
                }
                return response;
            } catch (fetchError) {
                console.warn('Fetch failed, falling back to cache:', fetchError);
                if (cacheResponse) {
                    return cacheResponse;
                }
                throw fetchError;
            }
        } catch (error) {
            console.warn('Cache API failed, falling back to normal fetch:', error);
            return fetch(url);
        }
    }

    // 添加检查缓存支持的方法
    async registerServiceWorker() {
        if ('serviceWorker' in navigator && this.cacheSupported) {
            try {
                await navigator.serviceWorker.register('/static/js/service-worker.js');
                console.log('Service Worker registered successfully');
            } catch (error) {
                console.warn('Service Worker registration failed:', error);
            }
        }
    }

    clearContent() {
        this.buttonBar.innerHTML = '';
        this.contentArea.innerHTML = '';
    }

    // Viewer 类中用于渲染文本内容的方法
    async renderTextContent(response, contentLengthHeader) {
        const totalLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
        if (response.body && totalLength) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';
            let receivedLength = 0;
            let lastUpdate = 0;
            const TEXT_UPDATE_THRESHOLD = 50 * 1024; // 每50KB更新一次

            const textarea = document.createElement('textarea');
            textarea.id = 'viewer';
            textarea.readOnly = true;
            textarea.style.width = '100%';
            textarea.style.height = '100%';
            textarea.style.boxSizing = 'border-box';
            textarea.style.border = 'none';
            this.contentArea.innerHTML = '';
            this.contentArea.appendChild(textarea);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                accumulatedText += decoder.decode(value, { stream: true });
                receivedLength += value.length;
                this.updateLoadingProgress(receivedLength, totalLength);
                if (receivedLength - lastUpdate >= TEXT_UPDATE_THRESHOLD) {
                    lastUpdate = receivedLength;
                    textarea.value = accumulatedText;
                }
            }
            accumulatedText += decoder.decode(); // 刷新解码器
            textarea.value = accumulatedText;
        } else {
            // 如果不支持流式读取则直接读取文本
            const text = await response.text();
            const textarea = document.createElement('textarea');
            textarea.id = 'viewer';
            textarea.value = text;
            textarea.readOnly = true;
            textarea.style.width = '100%';
            textarea.style.height = '100%';
            textarea.style.boxSizing = 'border-box';
            textarea.style.border = 'none';
            this.contentArea.innerHTML = '';
            this.contentArea.appendChild(textarea);
        }
        this.hideLoading();
    }

    async renderImageContent(response, contentType, contentLengthHeader) {
        const totalLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
        if (response.body && totalLength) {
            const reader = response.body.getReader();
            let receivedLength = 0;
            const chunks = [];
            let lastUpdate = 0;
            let partialUrl = null;
            const PROGRESS_THRESHOLD = 50 * 1024; // 每50KB更新一次

            const img = document.createElement('img');
            img.id = 'imageViewer';
            this.contentArea.innerHTML = '';
            this.contentArea.appendChild(img);

            img.onerror = () => {
                this.hideLoading();
                const errorDiv = document.createElement('div');
                errorDiv.className = 'file-info';
                errorDiv.textContent = '图片加载失败';
                this.contentArea.appendChild(errorDiv);
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                this.updateLoadingProgress(receivedLength, totalLength);
                if (receivedLength - lastUpdate >= PROGRESS_THRESHOLD) {
                    lastUpdate = receivedLength;
                    if (partialUrl) {
                        URL.revokeObjectURL(partialUrl);
                    }
                    const partialBlob = new Blob(chunks, { type: contentType });
                    partialUrl = URL.createObjectURL(partialBlob);
                    img.src = partialUrl;
                }
            }
            if (partialUrl) {
                URL.revokeObjectURL(partialUrl);
                partialUrl = null;
            }
            const completeBlob = new Blob(chunks, { type: contentType });
            const completeUrl = URL.createObjectURL(completeBlob);
            img.src = completeUrl;
            img.onload = () => {
                this.hideLoading();
                URL.revokeObjectURL(completeUrl);
            };
        } else {
            // 非流式读取时的降级处理
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const img = document.createElement('img');
            img.id = 'imageViewer';
            img.src = url;
            this.contentArea.innerHTML = '';
            this.contentArea.appendChild(img);
            img.onload = () => this.hideLoading();
            img.onerror = () => {
                this.hideLoading();
                const errorDiv = document.createElement('div');
                errorDiv.className = 'file-info';
                errorDiv.textContent = '图片加载失败';
                this.contentArea.appendChild(errorDiv);
            };
        }
    }

    // 防抖装饰器函数
    debounce(func, wait = 5) {
        const key = func.name; // 使用函数名作为唯一标识
        return async (...args) => {
            // 如果正在处理中，直接返回
            if (this.isProcessing) {
                return;
            }

            // 清除已存在的计时器
            if (this.debounceTimeouts.has(key)) {
                clearTimeout(this.debounceTimeouts.get(key));
            }

            // 创建新的Promise
            return new Promise((resolve) => {
                const timeout = setTimeout(async () => {
                    this.isProcessing = true;
                    try {
                        await func.apply(this, args);
                        resolve();
                    } catch (error) {
                        console.error(error);
                    } finally {
                        this.isProcessing = false;
                        this.debounceTimeouts.delete(key);
                    }
                }, wait);

                this.debounceTimeouts.set(key, timeout);
            });
        };
    }

    setupButtons(contentType) {
        // 创建按钮组
        const primaryGroup = document.createElement('div');
        const secondaryGroup = document.createElement('div');
        primaryGroup.className = 'button-group';
        secondaryGroup.className = 'button-group';

        // Copy 按钮固定在最前
        const copyBtn = this.addButton('Copy', () => this.handleCopy());
        primaryGroup.appendChild(copyBtn);

        // 使用防抖包装按钮处理函数
        const debouncedFork = this.debounce(() => this.handleFork());
        const debouncedRaw = this.debounce(() => this.handleRaw());
        const debouncedNew = this.debounce(() => this.handleNew());
        const debouncedDelete = this.debounce(() => this.handleDelete());
        const debouncedDownload = this.debounce(() => this.handleDownload());

        if (contentType?.startsWith('text/')) {
            primaryGroup.appendChild(this.addButton('Fork', debouncedFork));
            const rawBtn = this.addButton('Raw', debouncedRaw);
            rawBtn.classList.add('secondary');
            secondaryGroup.appendChild(rawBtn);
        } else if (contentType?.startsWith('image/')) {
            const rawBtn = this.addButton('Raw', debouncedRaw);
            rawBtn.classList.add('secondary');
            secondaryGroup.appendChild(rawBtn);
        } else {
            const downBtn = this.addButton('Down', debouncedDownload);
            downBtn.classList.add('secondary');
            secondaryGroup.appendChild(downBtn);
        }

        // 在现有的 primaryGroup 按钮组中添加 QR 按钮
        const qrBtn = this.addButton('QR', () => this.showQRCode());
        qrBtn.classList.add('secondary');
        primaryGroup.appendChild(qrBtn);

        // 通用按钮
        secondaryGroup.appendChild(this.addButton('New', debouncedNew));

        // 删除按钮放在最后，使用危险样式
        const delBtn = this.addButton('Del', debouncedDelete);
        delBtn.classList.add('danger');
        secondaryGroup.appendChild(delBtn);

        // 添加按钮组到工具栏
        this.buttonBar.appendChild(primaryGroup);

        // 添加分隔线
        const divider = document.createElement('div');
        divider.className = 'divider';
        this.buttonBar.appendChild(divider);

        this.buttonBar.appendChild(secondaryGroup);
    }

    addButton(text, onClick) {
        const button = document.createElement('button');
        button.className = 'button';
        button.textContent = text;
        button.onclick = async (e) => {
            const btn = e.currentTarget;
            if (btn.disabled) return;

            btn.disabled = true;
            try {
                await onClick();
            } finally {
                btn.disabled = false;
            }
        };
        return button;
    }

    handleRaw() {
        window.location.assign(`/r/${this.currentPath.key}/${this.currentPath.pwd}`);
    }

    handleFork() {
        try {
            const content = document.getElementById('viewer').value;
            const cacheData = {
                content,
                timestamp: getTimestamp(),
                path: this.currentPath.key,
                hash: cyrb53(content)
            };
            storage.setCache(this.CACHE_KEY + this.currentPath.key, cacheData);
            sessionStorage.setItem(this.CACHE_KEY + 'last', JSON.stringify(this.currentPath));
        }catch(e) {}
        window.location.assign('/e');
    }

    async handleNew() {
        // 加载前先清除缓存
        window.location.assign('/e');
    }

    handleCopy() {
        const currentTime = new Date().getTime();
        const timeDiff = currentTime - this.lastClickTime;

        if (this.clickTimeout) {
            // 双击检测
            clearTimeout(this.clickTimeout);
            this.clickTimeout = null;
            this.copyLink();
        } else {
            // 单击处理
            this.clickTimeout = setTimeout(() => {
                this.copyContent();
                this.clickTimeout = null;
            }, 250); // 5ms 双击判定时间
        }

        this.lastClickTime = currentTime;
    }

    async copyLink() {
        try {
            const url = window.location.href.replace("/p/", "/r/");
            await navigator.clipboard.writeText(url);
            this.showToast('链接已复制到剪贴板');
        } catch (err) {
            console.error('复制链接失败:', err);
            this.showToast('复制失败，请手动复制');
        }
    }

    async copyContent() {
        try {
            let content = '';
            const viewer = document.getElementById('viewer');
            const imageViewer = document.getElementById('imageViewer');

            if (viewer) {
                content = viewer.value;
                await navigator.clipboard.writeText(content);
                this.showToast('内容已复制到剪贴板');
            } else if (imageViewer) {
                // 图片复制 - 优先使用标准 API，然后是共享 API，最后降级到其他方法
                // 1. 首先尝试 Clipboard API 直接复制图片
                if (navigator.clipboard && navigator.clipboard.write) {
                    try {
                        // 创建Canvas并绘制图片
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = imageViewer.naturalWidth;
                        canvas.height = imageViewer.naturalHeight;
                        ctx.drawImage(imageViewer, 0, 0);
                        
                        // 转换为Blob并复制
                        const blob = await new Promise(resolve => {
                            canvas.toBlob(resolve, 'image/png');
                        });
                        
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        this.showToast('图片已复制到剪贴板');
                        return;
                    } catch (err) {
                        console.warn('标准复制图片失败:', err);
                    }
                }
                
                // 2. 再尝试使用 Web Share API (移动设备友好)
                if (navigator.share && navigator.canShare) {
                    try {
                        // 创建可分享的文件对象
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = imageViewer.naturalWidth;
                        canvas.height = imageViewer.naturalHeight;
                        ctx.drawImage(imageViewer, 0, 0);
                        
                        const blob = await new Promise(resolve => {
                            canvas.toBlob(resolve, 'image/png');
                        });
                        
                        const file = new File([blob], 'image.png', { type: 'image/png' });
                        const shareData = {
                            files: [file]
                        };
                        
                        if (navigator.canShare(shareData)) {
                            await navigator.share(shareData);
                            this.showToast('已打开分享面板');
                            return;
                        }
                    } catch (err) {
                        console.warn('分享API失败:', err);
                    }
                }
                
                // 3. 使用临时下载方法 (移动设备通用方法)
                try {
                    // 创建临时链接触发下载
                    const link = document.createElement('a');
                    link.href = imageViewer.src;
                    link.download = `image_${Date.now()}.png`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => {
                        document.body.removeChild(link);
                    }, 100);
                    this.showToast('图片已准备下载');
                    return;
                } catch (err) {
                    console.warn('下载图片失败:', err);
                }
                
                // 4. 最后降级为复制图片URL
                content = imageViewer.src;
                await navigator.clipboard.writeText(content);
                this.showToast('已复制图片链接 (您的设备不支持直接复制图片)');
            } else {
                // 其他文件 - 复制下载链接
                content = window.location.href.replace('/p/', '/r/');
                await navigator.clipboard.writeText(content);
                this.showToast('内容已复制到剪贴板');
            }
        } catch (err) {
            console.error('复制内容失败:', err);
            this.showToast('复制失败，请手动复制');
        }
    }

    // 添加提示框样式和方法
    showToast(message) {
        // 移除可能存在的旧提示
        const oldToast = document.querySelector('.toast');
        if (oldToast) {
            oldToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // 3秒后自动消失
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    async handleDelete() {
        const path = `/d/${this.currentPath.key}/${this.currentPath.pwd}`;
        try {
            const response = await fetch(path, {method: 'DELETE'});
            if (response.ok) {
                await this.clearLocalCache();
                window.location.assign('/e');
            } else {
                const result = await response.json();
                this.showToast(result.message || '上传失败');
            }
        } catch (error) {
            this.showToast(error.message);
        }
    }

    handleDownload() {
        window.location.assign(window.location.pathname.replace('/p/', '/r/'));
    }

    // 清除本地缓存
    async clearLocalCache() {
        await storage.removeCache(this.CACHE_KEY + this.currentPath.key);
    }

    parsePath(pathname) {
        const parts = pathname.split('/').filter(Boolean);
        let result = {key: '', pwd: '', render: ''};
        if (parts.length === 0) {
            return result
        }
        if (parts[0].length === 1) {
            result.key = parts[1] || '';
            result.pwd = parts[2] || '';
            result.render = parts[0];
        } else {
            result.key = parts[0] || '';
            result.pwd = parts[1] || '';
            result.render = "";
        }
        return result;
    }

    async loadQRLibrary2() {
        // 不能本地缓存
        if (this.qrLoaded) return;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
            script.onload = () => {
                this.qrLoaded = true;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async loadQRLibrary() {
        try {
            const scriptUrl = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
            const cache = await caches.open('qbin-cache-v1');
            let response = await cache.match(scriptUrl);
            if (!response) {
                response = await fetch(scriptUrl, {mode: 'cors'});
                if (!response.ok) {
                    throw new Error(`Network error: ${response.statusText}`);
                }
                await cache.put(scriptUrl, response.clone());
            }
            // 将响应内容转换为 Blob 对象
            const scriptBlob = await response.blob();
            // 生成 Blob URL
            const blobUrl = URL.createObjectURL(scriptBlob);
            // 返回 Promise，保证只有脚本加载完毕后才 resolve
            return new Promise((resolve, reject) => {
                const scriptElem = document.createElement('script');
                scriptElem.src = blobUrl;
                scriptElem.onload = () => {
                    URL.revokeObjectURL(blobUrl);
                    resolve();
                };
                scriptElem.onerror = () => {
                    URL.revokeObjectURL(blobUrl);
                    reject(new Error('Failed to load the QR library script'));
                };
                document.head.appendChild(scriptElem);
            });
        } catch (error) {
            console.error('Error loading QR library:', error);
            throw error;
        }
    }

    async showQRCode() {
        try {
            const currentUrl = window.location.href;
            const modal = document.createElement('div');
            modal.className = 'qr-modal';
            modal.innerHTML = `
                    <div class="qr-container">
                        <div class="qr-close">&times;</div>
                        <div class="qr-title">分享链接</div>
                        <div id="qrcode"></div>
                        <div class="url-container">
                            <div class="url-text">${currentUrl}</div>
                            <span class="copy-hint">点击复制</span>
                        </div>
                    </div>
                `;
            document.body.appendChild(modal);

            // 绑定关闭事件
            modal.querySelector('.qr-close').onclick = () => modal.remove();
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };

            // 绑定 URL 复制事件
            const urlContainer = modal.querySelector('.url-container');
            const copyHint = urlContainer.querySelector('.copy-hint');
            urlContainer.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(currentUrl);
                    urlContainer.classList.add('copied');
                    copyHint.textContent = '已复制';

                    // 2秒后恢复原状
                    setTimeout(() => {
                        urlContainer.classList.remove('copied');
                        copyHint.textContent = '点击复制';
                    }, 2000);
                } catch (err) {
                    // 降级处理：创建临时输入框进行复制
                    const textarea = document.createElement('textarea');
                    textarea.value = currentUrl;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        urlContainer.classList.add('copied');
                        copyHint.textContent = '已复制';
                        setTimeout(() => {
                            urlContainer.classList.remove('copied');
                            copyHint.textContent = '点击复制';
                        }, 2000);
                    } catch (err) {
                        console.error('复制失败:', err);
                    }
                    document.body.removeChild(textarea);
                }
            };

            // 加载 QR 库并生成二维码
            await this.loadQRLibrary();
            const qr = qrcode(0, 'M');
            qr.addData(currentUrl);
            qr.make();
            const cellSize = 5;
            const margin = 4;
            document.getElementById('qrcode').innerHTML = qr.createImgTag(cellSize, margin);

        } catch (error) {
            console.error('QR码生成失败:', error);
            this.showToast('QR码生成失败');
        }
    }
}

new Viewer();
