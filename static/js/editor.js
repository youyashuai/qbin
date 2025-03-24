class Qbin {
    constructor() {
        this.currentPath = this.parsePath(window.location.pathname);
        this.CACHE_KEY = 'qbin/';
        this.isUploading = false;
        this.lastUploadedHash = '';
        this.autoUploadTimer = null;
        this.emoji = {online: "☁️", inline: "☁", no: '⊘'}
        this.status = this.emoji.online; // ☁️ 🌐 | 🏠✈️⊘ ✈ | ☁️ ☁
        this.editor = document.getElementById('editor');

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
        // 确保只有新数据被保存
        if (force || (content.trimEnd() && cyrb53(content) !== this.lastUploadedHash)) {
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
                    uploadArea.classList.toggle('visible', false);
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
            document.querySelector('.key-watermark').textContent = `${this.status} ${this.currentPath.key}`;
            if (render === "e" && (getTimestamp() - last) > 5) {
                await this.loadOnlineCache(key, pwd, isCahce);
                document.querySelector('.key-watermark').textContent = `${this.status} ${this.currentPath.key}`;
            }
        } else {
            const cacheData = JSON.parse(sessionStorage.getItem('qbin/last') || '{"key": null}')
            if (!cacheData.key) return null;
            await this.loadFromLocalCache(cacheData.key);  // 如果是新页面，尝试加载缓存
            this.updateURL(cacheData.key, cacheData.pwd, "replaceState");   // 更新路径
            document.getElementById('key-input').value = cacheData.key.trim() || '';
            document.getElementById('password-input').value = cacheData.pwd.trim() || '';
            document.querySelector('.key-watermark').textContent = `${this.status} ${this.currentPath.key}`;
            // sessionStorage.removeItem('qbin/last');
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
                if (content.trim() && cyrb53(content) !== this.lastUploadedHash) {
                    this.handleUpload(content.trimEnd(), "text/plain; charset=UTF-8");
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
            if (content || status === 200 || status === 404) {
                this.lastUploadedHash = cyrb53(content || "");
                if (status === 404) {
                    this.status = this.emoji.online;
                    this.saveToLocalCache(true); // 更新本地缓存
                    tips = "这是可用的KEY"
                } else if (!isCache || this.lastUploadedHash === cyrb53(this.editor.value)) {
                    this.status = this.emoji.online;
                    this.editor.value = content || "";
                    this.saveToLocalCache(true); // 更新本地缓存
                    tips = "数据加载成功"
                } else {
                    // 显示确认对话框
                    const result = await this.showConfirmDialog(
                        "检测到本地缓存与服务器数据不一致，您想使用哪个版本？\n\n" +
                        "• 本地版本：保留当前编辑器中的内容\n" +
                        "• 服务器版本：加载服务器上的最新内容"
                    );

                    if (result) {
                        this.status = this.emoji.online;
                        this.editor.value = content;
                        this.saveToLocalCache(true); // 更新本地缓存
                        tips = "远程数据加载成功"
                    }
                }
                const uploadArea = document.querySelector('.upload-area');
                uploadArea.classList.toggle('visible', false);
                this.updateUploadStatus(tips || "数据加载成功", "success");
                return true;
            }
            return false;
        } catch (error) {
            isSuccess = false
            this.updateUploadStatus("数据加载失败：" + error.message);
            console.error(error);
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

    getMimeTypeFromFileName(filename) {
        const extension = filename.toLowerCase().split('.').pop();
        const mimeTypes = {
            // Text formats
            'txt': 'text/plain; charset=UTF-8',
            'md': 'text/markdown',
            'csv': 'text/csv',
            'html': 'text/html',
            'htm': 'text/html',
            'css': 'text/css',
            'js': 'text/javascript',
            'json': 'application/json',
            'xml': 'application/xml',

            // Document formats
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'odt': 'application/vnd.oasis.opendocument.text',
            'ods': 'application/vnd.oasis.opendocument.spreadsheet',
            'odp': 'application/vnd.oasis.opendocument.presentation',
            'rtf': 'application/rtf',

            // Image formats
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'ico': 'image/x-icon',
            'tiff': 'image/tiff',
            'tif': 'image/tiff',

            // Audio formats
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'flac': 'audio/flac',
            'aac': 'audio/aac',
            'm4a': 'audio/mp4',

            // Video formats
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogv': 'video/ogg',
            'avi': 'video/x-msvideo',
            'mov': 'video/quicktime',
            'wmv': 'video/x-ms-wmv',
            'mkv': 'video/x-matroska',

            // Archive formats
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed',
            'tar': 'application/x-tar',
            'gz': 'application/gzip',

            // Other common formats
            'epub': 'application/epub+zip',
            'exe': 'application/x-msdownload',
            'dmg': 'application/x-apple-diskimage',
            'iso': 'application/x-iso9660-image',
            'apk': 'application/vnd.android.package-archive',
            'ics': 'text/calendar',
            'ttf': 'font/ttf',
            'woff': 'font/woff',
            'woff2': 'font/woff2'
        };
        return mimeTypes[extension] || 'application/octet-stream';
    }

    debounce(func, wait) {
        clearTimeout(this.debounceTimeout);
        return new Promise((resolve) => {
            this.debounceTimeout = setTimeout(() => {
                resolve(func());
            }, wait);
        });
    }
}

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
                !contentTy / pe.includes('xml')) {
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
            const MAX_FILE_SIZE = 5 * 1024 * 1024;
            const method = mimetype.includes("text/") ? 'POST' : 'PUT';
            const body = content;
            let headers = {
                "x-expire": select.options[select.selectedIndex].value,
                "Content-Type": mimetype,
            };
            if (content.size > MAX_FILE_SIZE) {
                throw new Error(['上传内容超出', MAX_FILE_SIZE / 1024 / 1024, 'MB限制'].join(''));
            }
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
        try {
            const cache = await caches.open('qbin-cache-v1');
            const cacheResponse = await cache.match(url);
            const headers = new Headers();
            if (cacheResponse) {
                const etag = cacheResponse.headers.get('ETag');
                const lastModified = cacheResponse.headers.get('Last-Modified');
                if (etag) headers.set('If-None-Match', etag);
                if (lastModified) headers.set('If-Modified-Since', lastModified);
            }
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
        } catch (error) {
            // 网络错误时尝试返回缓存
            const cacheResponse = await cache.match(url);
            if (cacheResponse) return cacheResponse;
            throw error;
        }
    }
};

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
                throw new Error(`Cache key '${key}' not found`);
            }

            return new Promise((resolve, reject) => {
                const transaction = this._getTransaction('readwrite');
                const store = transaction.objectStore(this.storeName);

                const request = store.delete({key});

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
new Qbin();

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
