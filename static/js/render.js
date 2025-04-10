class QBinViewer {
    constructor() {
        this.currentPath = parsePath(window.location.pathname);
        this.lastClickTime = 0;
        this.clickTimeout = null;
        this.CACHE_KEY = 'qbin/';
        this.buttonBar = document.getElementById('buttonBar');
        this.contentArea = document.getElementById('contentArea');
        this.isProcessing = false;
        this.debounceTimeouts = new Map();
        this.isLoading = false;
        this.init();
    }

    showLoading() {
        this.isLoading = true;
        this.contentArea.innerHTML = '';
        const template = document.getElementById('loadingTemplate');
        const loadingEl = document.importNode(template.content, true).firstElementChild;
        this.contentArea.appendChild(loadingEl);
    }

    hideLoading() {
        this.isLoading = false;
        const loadingEls = this.contentArea.querySelectorAll('.loading-container');
        loadingEls.forEach(el => el.remove());
    }

    // 更新加载进度（用于文本流式加载）
    updateLoadingProgress(loaded, total) {
        const percent = Math.round((loaded / total) * 100);

        // Find loading text in the content area
        const loadingText = this.contentArea.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = `正在加载内容... (${percent}%)`;
        }
    }

    async init() {
        try {
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
                    // 处理密码错误的情况 - 显示密码输入界面
                    this.showPasswordDialog(key, pwd);
                    return;
                } else if(status === 404) {
                    throw new Error('访问内容不存在');
                }
                throw new Error('内容加载失败');
            }

            // 执行正常的内容加载逻辑
            await this.loadContent(headResponse);
        } catch (error) {
            console.error('Error loading content:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'file-info error';
            errorDiv.textContent = error.message || '内容加载失败';
            this.contentArea.innerHTML = '';
            this.contentArea.appendChild(errorDiv);

            const debouncedNew = this.debounce(() => this.handleNew());
            this.buttonBar.innerHTML = '';
            this.buttonBar.appendChild(this.addButton('New', debouncedNew));
            this.hideLoading();
        }
    }

    // 拆分内容加载逻辑，便于密码验证后重用
    async loadContent(headResponse) {
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
        const url = `/r/${this.currentPath.key}/${this.currentPath.pwd}`;
        const response = await API.fetchNet(url);
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
        const originalEditor = getCookie('qbin-editor') || 'm';
        window.location.assign(`/${originalEditor}`);
    }

    async handleNew() {
        sessionStorage.removeItem(this.CACHE_KEY + 'last');
        const originalEditor = getCookie('qbin-editor') || 'm';
        window.location.assign(`/${originalEditor}`);
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
            this.showToast('链接已复制到剪贴板', { type: 'info' });
        } catch (err) {
            console.error('复制链接失败:', err);
            this.showToast('复制失败，请手动复制', { type: 'error' });
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
                this.showToast('内容已复制到剪贴板', { type: 'info' });
            } else if (imageViewer) {
                // 图片复制 - 优先使用标准 API，然后是共享 API，最后降级到复制链接
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
                        this.showToast('图片已复制到剪贴板', { type: 'info' });
                        return;
                    } catch (err) {
                        console.warn('复制图片失败:', err);
                    }
                }

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
                            this.showToast('已打开分享面板', { type: 'info' });
                            return;
                        }
                    } catch (err) {
                        console.warn('分享API失败:', err);
                    }
                }

                content = imageViewer.src;
                await navigator.clipboard.writeText(content);
                this.showToast('已复制图片链接', { type: 'info' });
            } else {
                // 其他文件 - 复制下载链接
                content = window.location.href.replace('/p/', '/r/');
                await navigator.clipboard.writeText(content);
                this.showToast('内容已复制到剪贴板', { type: 'info' });
            }
        } catch (err) {
            console.error('复制内容失败:', err);
            this.showToast('复制失败，请手动复制', { type: 'error' });
        }
    }

    showToast(message, options = {}) {
        const {
            type = 'info',
            duration = 3000
        } = options;

        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('data-status', type);
        toast.textContent = message;

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('visible');
            });
        });
        toast.timeoutId = setTimeout(() => {
            toast.classList.remove('visible');

            // Remove from DOM after animation completes
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
        return toast;
    }

    async handleDelete() {
        const path = `/d/${this.currentPath.key}/${this.currentPath.pwd}`;
        try {
            const response = await fetch(path, {method: 'DELETE'});
            if (response.ok) {
                await this.clearLocalCache();
                const originalEditor = getCookie('qbin-editor') || 'm';
                window.location.assign(`/${originalEditor}`);
            } else {
                const result = await response.json();
                this.showToast(result.message || '上传失败', { type: 'error' });
            }
        } catch (error) {
            this.showToast(error.message, { type: 'error' });
        }
    }

    handleDownload() {
        window.location.assign(window.location.pathname.replace('/p/', '/r/'));
    }

    async clearLocalCache() {
        await storage.removeCache(this.CACHE_KEY + this.currentPath.key);
    }

    async showQRCode() {
        try {
            const currentUrl = window.location.href;

            // Remove any existing QR modal
            const existingModal = document.querySelector('.qr-modal');
            if (existingModal) {
                existingModal.remove();
            }

            // Clone the template
            const template = document.getElementById('qrModalTemplate');
            const modal = document.importNode(template.content, true).firstElementChild;

            // Set the URL text
            const urlText = modal.querySelector('.url-text');
            urlText.textContent = currentUrl;

            // Add to body
            document.body.appendChild(modal);

            // Bind close event
            const closeBtn = modal.querySelector('.qr-close');
            closeBtn.onclick = () => {
                modal.classList.add('fadeOut');
                setTimeout(() => modal.remove(), 200);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.add('fadeOut');
                    setTimeout(() => modal.remove(), 200);
                }
            };

            // Bind URL copy event
            const urlContainer = modal.querySelector('.url-container');
            const copyHint = urlContainer.querySelector('.copy-hint');

            urlContainer.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(currentUrl);
                    urlContainer.classList.add('copied');
                    copyHint.textContent = '已复制';

                    // Show toast for successful copy
                    this.showToast('链接已复制', { type: 'info' });

                    // Reset after 2 seconds
                    setTimeout(() => {
                        urlContainer.classList.remove('copied');
                        copyHint.textContent = '点击复制';
                    }, 2000);
                } catch (err) {
                    // Fallback copy method
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
                        this.showToast('链接已复制', { type: 'info' });
                        setTimeout(() => {
                            urlContainer.classList.remove('copied');
                            copyHint.textContent = '点击复制';
                        }, 2000);
                    } catch (err) {
                        console.error('复制失败:', err);
                        this.showToast('复制失败', { type: 'error' });
                    }
                    document.body.removeChild(textarea);
                }
            };

            if (typeof qrcode === 'undefined') {
                throw new Error('QR码库未加载，请稍后再试');
            }
            const qr = qrcode(0, 'M');
            qr.addData(currentUrl);
            qr.make();
            const cellSize = 5;
            const margin = 4;

            // Create QR code image
            const qrImg = document.createElement('img');
            qrImg.src = qr.createDataURL(cellSize, margin);
            qrImg.alt = 'QR Code';

            // Add QR code to the container
            const qrcodeContent = modal.querySelector('.qrcode-content');
            qrcodeContent.appendChild(qrImg);

        } catch (error) {
            console.error('QR码生成失败:', error);
            this.showToast('QR码生成失败', { type: 'error' });
        }
    }

    showPasswordDialog(key, currentPwd = '') {
        this.hideLoading();
        this.contentArea.innerHTML = '';
        this.buttonBar.innerHTML = '';

        // Get the password dialog
        const passwordDialog = document.getElementById('passwordDialog');
        const passwordInput = document.getElementById('passwordInput');
        const passwordError = document.getElementById('passwordError');

        // Reset and configure
        passwordInput.value = currentPwd || '';
        passwordError.textContent = '';
        passwordError.classList.remove('visible');

        // Make it visible in the content area
        passwordDialog.style.display = 'block';
        this.contentArea.appendChild(passwordDialog);

        // Show New button
        const newButton = this.addButton('New', this.debounce(() => this.handleNew()));
        this.buttonBar.appendChild(newButton);

        // Handle form submission
        const form = document.getElementById('passwordForm');
        form.onsubmit = async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('submitPasswordBtn');
            const submitBtnText = document.getElementById('submitBtnText');
            const submitBtnSpinner = document.getElementById('submitBtnSpinner');
            const password = passwordInput.value.trim();

            if (!password) {
                passwordError.textContent = '请输入密码';
                passwordError.classList.add('visible');
                return;
            }

            submitBtn.disabled = true;
            submitBtnText.style.visibility = 'hidden';
            submitBtnSpinner.style.display = 'block';
            passwordError.classList.remove('visible');

            try {
                // Validate password
                const validationResult = await this.validatePassword(key, password);
                if (validationResult.valid) {
                    // Success - update path and URL
                    this.currentPath.pwd = password;

                    if (history.pushState) {
                        const newUrl = `/p/${key}/${password}`;
                        history.pushState({path: newUrl}, '', newUrl);
                    }

                    // Reset dialog display
                    passwordDialog.style.display = 'none';

                    // Re-fetch content
                    this.showLoading();
                    await this.loadContent(validationResult.headResponse);
                } else {
                    // Failed validation
                    passwordError.textContent = '密码错误，请重试';
                    passwordError.classList.add('visible');
                    passwordInput.focus();
                }
            } catch (error) {
                passwordError.textContent = error.message || '验证过程中出现错误';
                passwordError.classList.add('visible');
            } finally {
                submitBtn.disabled = false;
                submitBtnText.style.visibility = 'visible';
                submitBtnSpinner.style.display = 'none';
            }
        };

        // Focus on password input
        setTimeout(() => {
            passwordInput.focus();
            if (currentPwd) {
                passwordInput.select();
            }
        }, 100);
    }

    async validatePassword(key, password) {
        const url = `/r/${key}/${password}`;
        const headResponse = await fetch(url, { method: 'HEAD' });
        return {
            valid: headResponse.ok,
            headResponse: headResponse
        };
    }
}

new QBinViewer();