const API = {
    generateKey(length = 10) {
        // 默认去掉了容易混淆的字符：oOLl,9gq,Vv,Uu,I1
        const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
        return Array.from(
            {length},
            () => chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');
    },

    async handleAPIError(response) {
        const contentType = response.headers.get('Content-Type');
        if (contentType.includes('application/json')) {
            try {
                const errorData = await response.json();
                return errorData.message || '请求失败';
            } catch (e) {
                return this.getErrorMessageByStatus(response.status);
            }
        }
        return this.getErrorMessageByStatus(response.status);
    },

    getErrorMessageByStatus(status) {
        if (status >= 500) {
            return '服务器出错，请稍后重试';
        } else if (status === 404) {
            return '请求的资源不存在';
        } else if (status === 403) {
            return '无访问权限';
        } else if (status === 401) {
            return '未授权访问';
        } else if (status === 400) {
            return '请求参数错误';
        }
        return '请求失败';
    },

    async getContent(key, pwd) {
        try {
            const response = await this.fetchWithCache(`/r/${key}/${pwd}`);
            if (!response.ok && response.status !== 404) {
                const errorMessage = await this.handleAPIError(response);
                throw new Error(errorMessage);
            }
            const contentType = response.headers.get('Content-Type') || '';
            if (!contentType.startsWith('text/') &&
                !contentType.includes('json') &&
                !contentType.includes('javascript') &&
                !contentType.includes('xml')) {
                throw new Error('不支持的文件类型');
            }
            return {status: response.status, content: await response.text()};
        } catch (error) {
            console.error('获取数据失败:', error);
            throw error;
        }
    },

    async uploadContent(content, key, pwd = '', mimetype = 'application/octet-stream') {
        const select = document.querySelector('.expiry-select');
        try {
            const method = mimetype.includes("text/") ? 'POST' : 'PUT';
            const body = content;
            let headers = {
                "x-expire": select.options[select.selectedIndex].value,
                "Content-Type": mimetype,
            };
            const response = await fetch(`/s/${key}/${pwd}`, {
                method,
                body,
                headers
            });
            if (!response.ok) {
                const errorMessage = await this.handleAPIError(response);
                throw new Error(errorMessage);
            }
            const result = await response.json();
            return result.status === 'success';
        } catch (error) {
            console.error('上传失败:', error);
            throw error;
        }
    },

    async fetchWithCache(url) {
        // 如果不支持Cache API，直接使用普通fetch
        if (!this.cacheSupported) {
            return fetch(url);
        }

        try {
            const cache = await caches.open(this.cacheName);
            const cacheResponse = await cache.match(url);
            const headers = new Headers();

            if (cacheResponse) {
                const etag = cacheResponse.headers.get('ETag');
                const lastModified = cacheResponse.headers.get('Last-Modified');
                if (etag) headers.set('If-None-Match', etag);
                if (lastModified) headers.set('If-Modified-Since', lastModified);
            }

            try {
                const response = await fetch(url, {
                    headers,
                    credentials: 'include'
                });

                if (response.status === 304 && cacheResponse) {
                    return cacheResponse;
                }

                if (response.ok) {
                    await cache.put(url, response.clone());
                    return response;
                }

                if (!response.ok) {
                    await cache.delete(url);
                }
                return response;
            } catch (fetchError) {
                // 网络错误时尝试返回缓存
                if (cacheResponse) {
                    return cacheResponse;
                }
                throw fetchError;
            }
        } catch (error) {
            console.warn('Cache API failed, falling back to normal fetch:', error);
            return fetch(url, { credentials: 'include' });
        }
    }
};
class Qbin {
    constructor() {
        this.currentPath = this.parsePath(window.location.pathname);
        this.CACHE_KEY = 'qbin/';
        this.cacheName = 'qbin-cache-v1';
        this.isUploading = false;
        this.lastUploadedHash = '';
        this.autoUploadTimer = null;
        this.emoji = {online: "☁️", inline: "☁", no: '⊘'}
        this.status = this.emoji.online; // ☁️ 🌐 | 🏠✈️⊘ ✈ | ☁️ ☁
        this.editor = document.getElementById('editor');
        // 检查缓存API是否可用
        this.cacheSupported = 'caches' in window;

        this.loadContent().then(() => {});
        // 如果当前地址为 "/"、"/p" 或 "/p/"，则自动生成 key 并更新地址
        if (this.currentPath.key.length < 2) {
            const newKey = API.generateKey(6);
            // this.updateURL(newKey, this.currentPath.pwd, "replaceState")
            this.updateURL(newKey, this.currentPath.pwd, "")
        }
        this.initializeUI();
        this.setupAutoSave();
        this.initializePasswordPanel();
        this.initializeKeyAndPasswordSync();
    }

    setupAutoSave() {
        window.addEventListener('beforeunload', () => {
            this.saveToLocalCache();
        });
    }

    saveToLocalCache(force = false) {
        const content = this.editor.value;
        if (force || (content && cyrb53(content) !== this.lastUploadedHash)) {
            const cacheData = {
                content,
                timestamp: getTimestamp(),
                path: this.currentPath.key,
                hash: cyrb53(content)
            };
            storage.setCache(this.CACHE_KEY + this.currentPath.key, cacheData);
        }
    }

    async loadFromLocalCache(key) {
        try {
            const cacheData = await storage.getCache(this.CACHE_KEY + (key || this.currentPath.key));
            if (cacheData) {
                // this.currentPath.key 会被随机生成
                const currentPath = this.parsePath(window.location.pathname);
                const isNewPage = currentPath.key.length < 2 || key;
                const isSamePath = currentPath.key === cacheData.path;
                if (isNewPage || isSamePath) {
                    this.status = this.emoji.inline;
                    this.editor.value = cacheData.content;
                    const uploadArea = document.querySelector('.upload-area');
                    if (uploadArea) uploadArea.classList.toggle('visible', false);
                    this.lastUploadedHash = cyrb53(cacheData.content);
                    return [true, cacheData.timestamp];
                }
            }
            return [false, 0];
        } catch (error) {
            console.error('加载缓存失败:', error);
            return [false, 0];
        }
    }

    async loadContent() {
        const {key, pwd, render} = this.currentPath;
        if (key.length > 1) {
            const [isCahce, last] = await this.loadFromLocalCache()  // 如果是新页面，尝试加载缓存
            this.updateURL(key, pwd, "replaceState");   // 更新路径
            const keyWatermark = document.querySelector('.key-watermark');
            if (keyWatermark) keyWatermark.textContent = `${this.status} ${this.currentPath.key}`;
            if (render === "e" && (getTimestamp() - last) > 5) {
                await this.loadOnlineCache(key, pwd, isCahce);
                if (keyWatermark) keyWatermark.textContent = `${this.status} ${this.currentPath.key}`;
            }
        } else {
            const cacheData = JSON.parse(sessionStorage.getItem('qbin/last') || '{"key": null}')
            if (!cacheData.key) return null;
            await this.loadFromLocalCache(cacheData.key);  // 如果是新页面，尝试加载缓存
            this.updateURL(cacheData.key, cacheData.pwd, "replaceState");   // 更新路径
            const keyInput = document.getElementById('key-input');
            const passwordInput = document.getElementById('password-input');
            const keyWatermark = document.querySelector('.key-watermark');
            
            if (keyInput) keyInput.value = cacheData.key.trim() || '';
            if (passwordInput) passwordInput.value = cacheData.pwd.trim() || '';
            if (keyWatermark) keyWatermark.textContent = `${this.status} ${this.currentPath.key}`;
        }
    }

    initializeUI() {
        // 针对 iOS 键盘适配
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        let saveTimeout;
        if (isIOS) {
            window.visualViewport.addEventListener('resize', () => {
                // 如有需要可调整其他 UI
                // const currentHeight = window.visualViewport.height;
                // uploadBtn.style.bottom = [Math.max(20, currentHeight * 0.05), 'px'].join('');
            });
        }

        // 编辑器内容变化：保存缓存并自动上传（防抖2秒）
        this.editor.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveToLocalCache();
            }, 1000);

            clearTimeout(this.autoUploadTimer);
            this.autoUploadTimer = setTimeout(() => {
                const content = this.editor.value;
                if (content && cyrb53(content) !== this.lastUploadedHash) {
                    this.handleUpload(content, "text/plain; charset=UTF-8");
                }
            }, 2000);
        });

        // 粘贴上传（图片）
        this.editor.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.indexOf('image/') === 0) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    // file.name
                    this.handleUpload(file, file.type);
                    return;
                }
            }
        });

        // 拖拽上传
        this.editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.editor.classList.add('drag-over');
        });
        this.editor.addEventListener('dragleave', () => {
            this.editor.classList.remove('drag-over');
        });
        this.editor.addEventListener('drop', (e) => {
            e.preventDefault();
            this.editor.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                this.handleUpload(file, file.type);
            }
        });

        // 文件上传区域
        const uploadArea = document.querySelector('.upload-area');
        const fileInput = document.getElementById('file-input');

        const updateUploadAreaVisibility = () => {
            const isEmpty = !this.editor.value.trim();
            uploadArea.classList.toggle('visible', isEmpty);
        };
        updateUploadAreaVisibility();
        this.editor.addEventListener('input', () => {
            updateUploadAreaVisibility();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                this.handleUpload(file, file.type);
            }
        });
        this.editor.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (!this.editor.value.trim()) {
                uploadArea.classList.add('visible');
            }
            this.editor.classList.add('drag-over');

            // Add subtle animation to show the editor is ready to accept files
            this.editor.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        });
        this.editor.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!e.relatedTarget || !this.editor.contains(e.relatedTarget)) {
                this.editor.classList.remove('drag-over');
                this.editor.style.transition = 'all 0.3s ease';
            }
        });

        // 添加编辑器焦点处理
        this.editor.addEventListener('focus', () => {
            document.body.classList.add('editor-focused');
        });

        this.editor.addEventListener('blur', () => {
            document.body.classList.remove('editor-focused');
        });
    }

    async loadOnlineCache(key, pwd, isCache, isSuccess = true) {
        if (this.isUploading) return;
        try {
            this.isUploading = true;
            this.updateUploadStatus("数据加载中…");
            let tips = "";
            const {status, content} = await API.getContent(key, pwd);

            if (!content && status !== 200 && status !== 404) {
                throw new Error('加载失败');
            }

            this.lastUploadedHash = cyrb53(content || "");

            if (status === 404) {
                this.status = this.emoji.online;
                this.saveToLocalCache(true);
                tips = "这是可用的KEY";
            } else if (!isCache || this.lastUploadedHash === cyrb53(this.editor.value)) {
                this.status = this.emoji.online;
                this.editor.value = content || "";
                this.saveToLocalCache(true);
                tips = "数据加载成功";
            } else {
                const result = await this.showConfirmDialog(
                    "检测到本地缓存与服务器数据不一致，您想使用哪个版本？\n\n" +
                    "• 本地版本：保留当前编辑器中的内容\n" +
                    "• 服务器版本：加载服务器上的最新内容"
                );

                if (result) {
                    this.status = this.emoji.online;
                    this.editor.value = content;
                    this.saveToLocalCache(true);
                    tips = "远程数据加载成功";
                }
            }

            const uploadArea = document.querySelector('.upload-area');
            if (uploadArea) {
                uploadArea.classList.toggle('visible', false);
            }
            this.updateUploadStatus(tips || "数据加载成功", "success");
            return true;
        } catch (error) {
            isSuccess = false;
            this.updateUploadStatus("数据加载失败：" + error.message);
            console.error(error);
            return false;
        } finally {
            this.isUploading = false;
            setTimeout(() => {
                this.updateUploadStatus("");
            }, isSuccess ? 2000 : 5000);
        }
    }

    // 添加确认对话框方法
    showConfirmDialog(message) {
        return new Promise((resolve) => {
            const overlay = document.querySelector('.confirm-overlay');
            const dialog = document.querySelector('.confirm-dialog');
            const content = dialog.querySelector('.confirm-dialog-content');

            content.textContent = message;

            const showDialog = () => {
                overlay.classList.add('active');
                dialog.classList.add('active');
            };

            const hideDialog = () => {
                overlay.classList.remove('active');
                dialog.classList.remove('active');
            };

            const handleClick = (e) => {
                const button = e.target.closest('.confirm-button');
                if (!button) return;

                const action = button.dataset.action;
                hideDialog();

                // 移除事件监听
                dialog.removeEventListener('click', handleClick);
                overlay.removeEventListener('click', handleOverlayClick);
                document.removeEventListener('keydown', handleKeydown);

                resolve(action === 'confirm');
            };

            const handleOverlayClick = () => {
                hideDialog();
                resolve(false);
            };

            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    hideDialog();
                    resolve(false);
                } else if (e.key === 'Enter') {
                    hideDialog();
                    resolve(true);
                }
            };

            // 添加事件监听
            dialog.addEventListener('click', handleClick);
            overlay.addEventListener('click', handleOverlayClick);
            document.addEventListener('keydown', handleKeydown);
            showDialog();
        });
    }

    async handleUpload(content, mimetype, isSuccess = true) {
        if (this.isUploading) return;
        if (!content) return;
        const isFile = ! mimetype.includes("text/");
        // For files, show file type in upload status
        let statusMessage = "保存中…";
        let statusType = "loading";
        if (isFile) {
            const fileSize = content.size / 1024;
            const sizeText = fileSize < 1024 ?
                `${fileSize.toFixed(1)}KB` :
                `${(fileSize / 1024).toFixed(1)}MB`;
            statusMessage = `上传中 ${content.name} (${sizeText})`;
        }

        this.updateUploadStatus(statusMessage, statusType);

        try {
            this.isUploading = true;
            const keyInput = document.getElementById('key-input');
            const passwordInput = document.getElementById('password-input');
            let key = this.currentPath.key || keyInput.value.trim() || API.generateKey(6);
            const action = this.currentPath.key === key ? "replaceState" : "pushState";
            const pwd = passwordInput.value.trim();
            const chash = cyrb53(content);

            // Add visual loading indicator to editor for large files
            if (isFile && content.size > 1024 * 1024) {
                document.querySelector('.upload-icon').innerHTML = "⏳";
                document.querySelector('.upload-text').textContent = "正在处理，请稍候...";
            }

            const success = await API.uploadContent(content, key, pwd, mimetype);
            if (success) {
                if (!isFile) {
                    this.lastUploadedHash = chash;
                }
                this.status = this.emoji.online;

                // Show more descriptive success message
                if (isFile) {
                    this.updateUploadStatus(`文件 ${content.name} 上传成功`, "success");
                } else {
                    this.updateUploadStatus("内容保存成功", "success");
                }

                this.updateURL(key, pwd, action);
                document.querySelector('.key-watermark').textContent = `${this.status} ${this.currentPath.key}`;

                if (isFile) {
                    setTimeout(() => {
                        window.location.assign(`/p/${key}/${pwd}`);
                    }, 800); // Give more time to see the success message
                }
            }
        } catch (error) {
            isSuccess = false;

            // More detailed error message
            let errorMsg = "保存失败";
            if (error.message.includes("size")) {
                errorMsg = "文件大小超出限制";
            } else if (error.message.includes("network") || error.message.includes("connect")) {
                errorMsg = "网络连接失败，请检查网络";
            } else {
                errorMsg = `保存失败: ${error.message}`;
            }

            this.updateUploadStatus(errorMsg, "error");
            this.status = this.emoji.no;
            document.querySelector('.key-watermark').textContent = `${this.status} ${this.currentPath.key}`;
            console.error(error);
        } finally {
            this.isUploading = false;

            // Reset upload button if needed
            if (isFile && document.querySelector('.upload-icon').innerHTML === "⏳") {
                document.querySelector('.upload-icon').innerHTML = "📁";
                document.querySelector('.upload-text').textContent = "点击或拖拽文件到此处上传";
            }

            setTimeout(() => {
                this.updateUploadStatus("");
            }, isSuccess ? 2000 : 5000);
        }
    }

    updateUploadStatus(message, type) {
        const statusEl = document.getElementById('upload-status');
        if (!statusEl) return;

        // If empty message, hide the status
        if (!message) {
            statusEl.textContent = '';
            statusEl.classList.remove('visible');
            return;
        }

        // Set the status type
        statusEl.removeAttribute('data-status');
        if (message.includes('成功')) {
            statusEl.setAttribute('data-status', 'success');
        } else if (message.includes('失败')) {
            statusEl.setAttribute('data-status', 'error');
        } else if (message.includes('加载')) {
            statusEl.setAttribute('data-status', 'info');
        } else {
            statusEl.setAttribute('data-status', 'info');
        }

        statusEl.textContent = message;
        requestAnimationFrame(() => {
            statusEl.classList.add('visible');
        });
    }

    initializePasswordPanel() {
        const bookmark = document.querySelector('.bookmark');
        const passwordPanel = document.querySelector('.password-panel');
        let isInputActive = false;
        let hoverTimeout = null;
        let hideTimeout = null;
        // 设置复选框交互 - FIXED CODE HERE
        const checkbox = document.getElementById('encrypt-checkbox');
        const hiddenCheckbox = document.getElementById('encryptData');
        const optionToggle = document.querySelector('.option-toggle');

        const isMobileDevice = () => {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                || window.innerWidth <= 768;
        };

        const showPanel = () => {
            clearTimeout(hideTimeout);
            passwordPanel.classList.add('active');
        };

        const hidePanel = () => {
            if (!isInputActive) {
                passwordPanel.classList.remove('active');
                passwordPanel.style.transform = '';
            }
        };

        if (isMobileDevice()) {
            bookmark.style.cursor = 'pointer';
            let touchStartTime;
            let touchStartY;
            let isTouchMoved = false;
            bookmark.addEventListener('touchstart', (e) => {
                touchStartTime = getTimestamp();
                touchStartY = e.touches[0].clientY;
                isTouchMoved = false;
            }, {passive: true});
            bookmark.addEventListener('touchmove', (e) => {
                if (Math.abs(e.touches[0].clientY - touchStartY) > 10) {
                    isTouchMoved = true;
                }
            }, {passive: true});
            bookmark.addEventListener('touchend', (e) => {
                const touchDuration = getTimestamp() - touchStartTime;
                if (!isTouchMoved && touchDuration < 250) {
                    e.preventDefault();
                    if (passwordPanel.classList.contains('active')) {
                        hidePanel();
                    } else {
                        showPanel();
                    }
                }
            });
            document.addEventListener('click', (e) => {
                if (passwordPanel.classList.contains('active')) {
                    const isOutsideClick = !passwordPanel.contains(e.target) &&
                        !bookmark.contains(e.target);
                    if (isOutsideClick) {
                        hidePanel();
                    }
                }
            }, true);
            let startY = 0;
            let currentY = 0;
            passwordPanel.addEventListener('touchstart', (e) => {
                if (e.target === passwordPanel || e.target.closest('.password-panel-title')) {
                    startY = e.touches[0].clientY;
                    currentY = startY;
                }
            }, {passive: true});
            passwordPanel.addEventListener('touchmove', (e) => {
                if (startY !== 0) {
                    currentY = e.touches[0].clientY;
                    const deltaY = currentY - startY;
                    if (deltaY > 0) {
                        e.preventDefault();
                        passwordPanel.style.transform = `translateY(${deltaY}px)`;
                        passwordPanel.style.transition = 'none';
                    }
                }
            }, {passive: false});
            passwordPanel.addEventListener('touchend', () => {
                if (startY !== 0) {
                    const deltaY = currentY - startY;
                    passwordPanel.style.transition = 'all 0.3s ease';
                    if (deltaY > 50) {
                        hidePanel();
                    } else {
                        passwordPanel.style.transform = '';
                    }
                    startY = 0;
                }
            });
        } else {
            bookmark.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
                hoverTimeout = setTimeout(showPanel, 100);
            });
            bookmark.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                hideTimeout = setTimeout(hidePanel, 500);
            });
            passwordPanel.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
                clearTimeout(hoverTimeout);
            });
            passwordPanel.addEventListener('mouseleave', () => {
                if (!isInputActive) {
                    hideTimeout = setTimeout(hidePanel, 500);
                }
            });
        }

        const inputs = passwordPanel.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                isInputActive = true;
                clearTimeout(hideTimeout);
            });
            input.addEventListener('blur', () => {
                isInputActive = false;
                if (!isMobileDevice() && !passwordPanel.matches(':hover')) {
                    hideTimeout = setTimeout(hidePanel, 800);
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && passwordPanel.classList.contains('active')) {
                hidePanel();
            }
        });

        // 将点击事件从checkbox移到整个optionToggle区域
        optionToggle.addEventListener('click', function() {
            if (checkbox.classList.contains('checked')) {
                checkbox.classList.remove('checked');
                hiddenCheckbox.checked = false;
            } else {
                checkbox.classList.add('checked');
                hiddenCheckbox.checked = true;
            }
        });

        // 初始化复选框状态
        if (hiddenCheckbox.checked) {
            checkbox.classList.add('checked');
        }

        // 添加预览按钮功能
        const previewButton = document.getElementById('preview-button');
        previewButton.addEventListener('click', () => {
            const key = this.currentPath.key;
            const pwd = this.currentPath.pwd;
            if (key) {
                // 保存当前编辑内容
                this.saveToLocalCache(true);
                sessionStorage.setItem('qbin/last', JSON.stringify({
                    key: key,
                    pwd: pwd,
                    timestamp: getTimestamp()
                }));
                // 跳转到预览页面
                window.location.href = `/p/${key}/${pwd}`;
            }
        });

        // 添加跳转到代码编辑器按钮功能
        const codeButton = document.getElementById('code-button');
        codeButton.addEventListener('click', () => {
            const key = this.currentPath.key;
            const pwd = this.currentPath.pwd;
            if (key) {
                // 保存当前编辑内容
                this.saveToLocalCache(true);
                sessionStorage.setItem('qbin/last', JSON.stringify({
                    key: key,
                    pwd: pwd,
                    timestamp: getTimestamp()
                }));
                window.location.href = `/c/${key}/${pwd}`;
            }
        });

        // 添加跳转到markdown编辑器按钮功能
        const mdButton = document.getElementById('md-button');
        mdButton.addEventListener('click', () => {
            const key = this.currentPath.key;
            const pwd = this.currentPath.pwd;
            if (key) {
                // 保存当前编辑内容
                this.saveToLocalCache(true);
                sessionStorage.setItem('qbin/last', JSON.stringify({
                    key: key,
                    pwd: pwd,
                    timestamp: getTimestamp()
                }));
                window.location.href = `/m/${key}/${pwd}`;
            }
        });
    }

    initializeKeyAndPasswordSync() {
        const keyInput = document.getElementById('key-input');
        const passwordInput = document.getElementById('password-input');
        const keyWatermark = document.querySelector('.key-watermark');

        // 初始化输入框值
        keyInput.value = this.currentPath.key;
        passwordInput.value = this.currentPath.pwd;
        keyWatermark.textContent = `${this.status} ${this.currentPath.key}`;

        // 监听输入变化，更新地址栏
        const updateURLHandler = () => {
            const trimmedKey = keyInput.value.trim();
            const trimmedPwd = passwordInput.value.trim();

            // 只有在 key 长度大于等于 2 时才更新 URL
            if (trimmedKey.length >= 2) {
                this.updateURL(trimmedKey, trimmedPwd, "replaceState");
            }

            // 更新水印显示
            // keyWatermark.textContent = `${this.status} ${this.currentPath.key}`;
            keyWatermark.textContent = `${this.emoji.inline} ${this.currentPath.key}`;
        };

        // 监听输入变化时更新水印
        keyInput.addEventListener('input', updateURLHandler);
        passwordInput.addEventListener('input', updateURLHandler);
    }

    updateURL(key, pwd, action = "replaceState") {
        // action: replaceState | pushState
        if (key && key.length < 2) return;
        const {render} = this.parsePath(window.location.pathname);
        const renderPath = ["e", "p", "c", "m"].includes(render) ? `/${render}` : '/e';

        const newPath = key || pwd
            ? `${renderPath}/${key}/${pwd}`
            : renderPath || '/e';

        this.currentPath = {render, key, pwd};

        const historyMethod = window.history[action];
        if (!historyMethod) {
            console.error(`Invalid history action: ${action}`);
            return;
        }
        historyMethod.call(window.history, null, '', newPath);
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
}
new Qbin();