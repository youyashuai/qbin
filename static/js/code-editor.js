class Qbin {
    constructor() {
        this.currentPath = this.parsePath(window.location.pathname);
        this.CACHE_KEY = 'qbin/';
        this.isUploading = false;
        this.lastUploadedHash = '';
        this.autoUploadTimer = null;
        this.emoji = {online: "☁️", inline: "☁", no: '⊘'}
        this.status = this.emoji.online; // ☁️ 🌐 | 🏠✈️⊘ ✈ | ☁️ ☁
        this.editor = null; // Monaco Editor 实例

        // 初始化 Monaco Editor
        this.initMonacoEditor().then(() => {
            this.loadContent().then(() => {
            });
            // 如果当前地址为 "/"、"/p" 或 "/p/"，则自动生成 key 并更新地址
            if (this.currentPath.key.length < 2) {
                const newKey = API.generateKey(6);
                this.updateURL(newKey, this.currentPath.pwd, "");
            }
            this.initializeUI();
            this.setupAutoSave();
            this.initializePasswordPanel();
            this.initializeKeyAndPasswordSync();
        });
    }

    // 初始化 Monaco Editor
    async initMonacoEditor() {
        return new Promise((resolve) => {
            require.config({paths: {'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs'}});

            require(['vs/editor/editor.main'], () => {
                // 设置编辑器主题
                this.setupEditorThemes();

                // 创建编辑器实例
                this.editor = monaco.editor.create(document.getElementById('editor'), {
                    value: '', // 初始为空
                    language: 'plaintext', // 默认纯文本
                    automaticLayout: true, // 自动调整布局
                    theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'qbin-dark' : 'qbin-light',
                    minimap: {enabled: window.innerWidth > 768}, // 仅在非移动设备上启用小地图
                    scrollBeyondLastLine: false, // 避免底部多余空白
                    fontSize: window.innerWidth <= 768 ? 16 : 14, // 移动端更大字体
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    padding: {top: 20, bottom: 20}, // 增加内边距提升体验
                    renderLineHighlight: 'all',
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: true,
                    fixedOverflowWidgets: true, // 修复溢出部件
                    contextmenu: true,
                    scrollbar: {
                        // 增强移动端滚动体验
                        verticalScrollbarSize: window.innerWidth <= 768 ? 10 : 8,
                        horizontalScrollbarSize: window.innerWidth <= 768 ? 10 : 8,
                        vertical: 'visible',
                        horizontal: 'visible',
                        verticalHasArrows: false,
                        horizontalHasArrows: false,
                        useShadows: true, // 启用滚动条阴影，增强视觉反馈
                        alwaysConsumeMouseWheel: false // 允许滚动事件冒泡到父容器
                    },
                    // 移动端触摸支持增强
                    domReadOnly: false,
                    readOnly: false,
                    formatOnPaste: false,
                    formatOnType: false,
                });

                // 初始化语言指示器和选择器
                this.initLanguageSelector();

                // 监听深色模式变化
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    this.editor.updateOptions({
                        theme: e.matches ? 'qbin-dark' : 'qbin-light'
                    });
                });

                // 监听编辑器内容变化
                this.editor.onDidChangeModelContent(() => {
                    clearTimeout(this.saveTimeout);
                    this.saveTimeout = setTimeout(() => {
                        this.saveToLocalCache();
                    }, 1000);

                    clearTimeout(this.autoUploadTimer);
                    this.autoUploadTimer = setTimeout(() => {
                        const content = this.editor.getValue();
                        if (content.trim() && cyrb53(content) !== this.lastUploadedHash) {
                            const lang = document.getElementById('language-select').value;
                            const mimetype = this.getMimeTypeFromLang(lang)
                            this.handleUpload(content, mimetype);
                        }
                    }, 2000);
                });

                // 监听编辑器获得/失去焦点
                this.editor.onDidFocusEditorText(() => {
                    document.body.classList.add('editor-focused');
                });

                this.editor.onDidBlurEditorText(() => {
                    document.body.classList.remove('editor-focused');
                });

                resolve();
            });
        });
    }

    getMimeTypeFromLang(lang) {
        const extension = lang.toLowerCase();
        const mimeTypes = {
            'html': 'text/html; charset=UTF-8',
            'css': 'text/css; charset=UTF-8',
            'javascript': 'text/javascript; charset=UTF-8',
        };
        return mimeTypes[extension] || 'text/plain; charset=UTF-8';
    };

    // 设置编辑器主题
    setupEditorThemes() {
        // 浅色主题 - 水墨风格，与整体设计协调
        monaco.editor.defineTheme('qbin-light', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#FAFBFC', // 与页面背景协调
                'editor.foreground': '#2c3e50',
                'editor.lineHighlightBackground': '#f1f8ff55',
                'editorCursor.foreground': '#1890ff',
                'editorLineNumber.foreground': '#999999',
                'editorLineNumber.activeForeground': '#555555',
                'editor.selectionBackground': '#c9d8f5',
                'editor.inactiveSelectionBackground': '#e0e0e0',
                'editorWidget.background': '#f5f5f5',
                'editorWidget.border': '#e0e0e0',
                'scrollbarSlider.background': 'rgba(0, 0, 0, 0.2)',
                'scrollbarSlider.hoverBackground': 'rgba(0, 0, 0, 0.3)',
                'scrollbarSlider.activeBackground': 'rgba(0, 0, 0, 0.4)',
            }
        });

        // 深色主题 - 水墨风格
        monaco.editor.defineTheme('qbin-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#242424', // 确保与深色模式背景协调
                'editor.foreground': '#e0e0e0',
                'editor.lineHighlightBackground': '#ffffff10',
                'editorCursor.foreground': '#1890ff',
                'editorLineNumber.foreground': '#aaaaaa',
                'editorLineNumber.activeForeground': '#dddddd',
                'editor.selectionBackground': '#264f78',
                'editor.inactiveSelectionBackground': '#3a3d41',
                'editorWidget.background': '#333333',
                'editorWidget.border': '#464646',
                'scrollbarSlider.background': 'rgba(255, 255, 255, 0.2)',
                'scrollbarSlider.hoverBackground': 'rgba(255, 255, 255, 0.3)',
                'scrollbarSlider.activeBackground': 'rgba(255, 255, 255, 0.4)',
            }
        });
    }

    // 其余方法需要修改以使用 Monaco Editor 替代 textarea
    saveToLocalCache(force = false) {
        const content = this.editor.getValue();
        // 确保只有新数据被保存
        if (force || (content.trim() && cyrb53(content) !== this.lastUploadedHash)) {
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
                    this.editor.setValue(cacheData.content);
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

    initializeUI() {
        // 针对 iOS 键盘适配
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            window.visualViewport.addEventListener('resize', () => {
                // 如有需要可调整其他 UI
            });
        }
    }

    setupAutoSave() {
        window.addEventListener('beforeunload', () => {
            this.saveToLocalCache();
        });
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
            sessionStorage.removeItem('qbin/last');
        }
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
                } else if (!isCache || this.lastUploadedHash === cyrb53(editor.value)) {
                    this.status = this.emoji.online;
                    editor.value = content || "";
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
                        editor.value = content;
                        this.saveToLocalCache(true); // 更新本地缓存
                        tips = "远程数据加载成功"
                    }
                }
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

        this.updateUploadStatus("保存中…", "loading");

        try {
            this.isUploading = true;
            const keyInput = document.getElementById('key-input');
            const passwordInput = document.getElementById('password-input');
            let key = this.currentPath.key || keyInput.value.trim() || API.generateKey(6);
            const action = this.currentPath.key === key ? "replaceState" : "pushState";
            const pwd = passwordInput.value.trim();
            const chash = cyrb53(content);

            const success = await API.uploadContent(content, key, pwd, mimetype);
            if (success) {
                this.lastUploadedHash = chash;
                this.status = this.emoji.online;

                // Show more descriptive success message
                this.updateUploadStatus("内容保存成功", "success");
                this.updateURL(key, pwd, action);
                document.querySelector('.key-watermark').textContent = `${this.status} ${this.currentPath.key}`;
            }
        } catch (error) {
            isSuccess = false;

            // More detailed error message
            let errorMsg = "保存失败";
            if (error.message.includes("size")) {
                errorMsg = "内容大小超出限制";
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
        optionToggle.addEventListener('click', function () {
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
        const editButton = document.getElementById('edit-button');
        editButton.addEventListener('click', () => {
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
                window.location.href = `/e/${key}/${pwd}`;
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

        // 检查面板是否需要滚动
        const checkIfCanScroll = () => {
            if (passwordPanel.scrollHeight > passwordPanel.clientHeight) {
                passwordPanel.classList.add('can-scroll');
            } else {
                passwordPanel.classList.remove('can-scroll');
            }
        };

        // 监听面板显示时检查滚动
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (passwordPanel.classList.contains('active')) {
                        setTimeout(checkIfCanScroll, 50); // 等待过渡效果完成
                    }
                }
            });
        });

        observer.observe(passwordPanel, { attributes: true });

        // 窗口大小改变时重新检查
        window.addEventListener('resize', () => {
            if (passwordPanel.classList.contains('active')) {
                checkIfCanScroll();
            }
        });

        // 面板滚动时隐藏指示器
        passwordPanel.addEventListener('scroll', () => {
            const scrollIndicator = document.querySelector('.scroll-indicator');
            if (scrollIndicator) {
                if (passwordPanel.scrollTop > 10) {
                    scrollIndicator.style.opacity = '0';
                } else {
                    scrollIndicator.style.opacity = '1';
                }
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

    debounce(func, wait) {
        clearTimeout(this.debounceTimeout);
        return new Promise((resolve) => {
            this.debounceTimeout = setTimeout(() => {
                resolve(func());
            }, wait);
        });
    }

    // 添加语言选择器初始化方法
    initLanguageSelector() {
        const languageSelect = document.getElementById('language-select');

        // 设置初始语言
        languageSelect.value = this.editor.getModel().getLanguageId();

        // 语言选择下拉菜单变化事件
        languageSelect.addEventListener('change', () => {
            const newLanguage = languageSelect.value;
            monaco.editor.setModelLanguage(this.editor.getModel(), newLanguage);

            // 保存语言选择到本地缓存
            localStorage.setItem('qbin_language_preference', newLanguage);
        });

        // 从本地缓存加载语言选择
        const savedLanguage = localStorage.getItem('qbin_language_preference');
        if (savedLanguage) {
            languageSelect.value = savedLanguage;
            monaco.editor.setModelLanguage(this.editor.getModel(), savedLanguage);
        }
    }
}

const API = {
    // 添加缓存配置
    cacheConfig: {
        cacheName: 'qbin-cache-v1',
        cacheSupported: 'caches' in window
    },

    generateKey(length = 10) {
        // 默认去掉了容易混淆的字符：oOLl,9gq,Vv,Uu,I1
        const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
        return Array.from(
            {length},
            () => chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('');
    },

    // 添加缓存fetch方法
    async fetchWithCache(url, options = {}) {
        // 如果不支持Cache API，直接返回普通fetch
        if (!this.cacheConfig.cacheSupported) {
            return fetch(url, options);
        }

        try {
            const cache = await caches.open(this.cacheConfig.cacheName);
            const cacheResponse = await cache.match(url);

            // 设置条件请求头
            const headers = new Headers(options.headers || {});
            if (cacheResponse) {
                const etag = cacheResponse.headers.get('ETag');
                const lastModified = cacheResponse.headers.get('Last-Modified');
                if (etag) headers.set('If-None-Match', etag);
                if (lastModified) headers.set('If-Modified-Since', lastModified);
            }

            try {
                const fetchOptions = {
                    ...options,
                    headers,
                    credentials: 'include'
                };

                const response = await fetch(url, fetchOptions);

                // 如果服务器返回304且有缓存，使用缓存
                if (response.status === 304 && cacheResponse) {
                    return cacheResponse;
                }

                // 如果响应成功，更新缓存
                if (response.ok && options.method !== 'POST' && options.method !== 'PUT') {
                    await cache.put(url, response.clone());
                }

                // 如果响应失败，删除缓存
                if (!response.ok) {
                    await cache.delete(url);
                }

                return response;
            } catch (fetchError) {
                // 网络错误时返回缓存（如果有）
                if (cacheResponse) {
                    console.warn('Network request failed, using cached response');
                    return cacheResponse;
                }
                throw fetchError;
            }
        } catch (error) {
            console.warn('Cache API failed, falling back to normal fetch:', error);
            return fetch(url, {
                ...options,
                credentials: 'include'
            });
        }
    },

    async handleAPIError(response) {
        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('application/json')) {
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

            return {
                status: response.status,
                content: await response.text(),
                contentType
            };
        } catch (error) {
            console.error('获取数据失败:', error);
            throw error;
        }
    },

    async uploadContent(content, key, pwd = '', mimetype = 'text/plain; charset=UTF-8') {
        const select = document.querySelector('.expiry-select');
        try {
            const method = mimetype.includes("text/") ? 'POST' : 'PUT';
            const headers = {
                "x-expire": select.options[select.selectedIndex].value,
                "Content-Type": mimetype,
            };

            const response = await this.fetchWithCache(`/s/${key}/${pwd}`, {
                method,
                body: content,
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

    getErrorMessageByStatus(status) {
        const statusMessages = {
            400: '请求参数错误',
            401: '未授权访问',
            403: '访问被禁止',
            404: '资源不存在',
            413: '内容超出大小限制',
            429: '请求过于频繁',
            500: '服务器内部错误',
            503: '服务暂时不可用'
        };
        return statusMessages[status] || '未知错误';
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
