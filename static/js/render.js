class QBinViewer {
    constructor() {
        this.currentPath = parsePath(window.location.pathname);
        this.clickTimeout = null;
        this.CACHE_KEY = 'qbin/';
        this.buttonBar = document.getElementById('buttonBar');
        this.cherryContainer = document.getElementById('qbin-viewer');
        this.isProcessing = false;
        this.debounceTimeouts = new Map();
        this.cherry = null;
        this.init();
    }

    initViewer(content, contentType) {
        if (this.cherry) {
            this.cherry = null;
        }
        if(contentType.startsWith("text/") && !contentType.includes("markdown")){
            const cherryConfig = {
                id: 'qbin-viewer',
                value: content,
                editor: {
                    defaultModel: 'editOnly',
                    keepDocumentScrollAfterInit: false,
                    convertWhenPaste: false, // 粘贴时不转换HTML到Markdown
                    showFullWidthMark: false, // 不高亮全角符号
                    showSuggestList: false, // 不显示联想框
                    codemirror: {
                        autofocus: false, // 不自动聚焦
                        readOnly: true, // 设置为只读
                        mode: 'text/plain',
                        lineNumbers: false, // 不显示行号
                        lineWrapping: true, // 启用自动换行
                        theme: 'default',
                        styleActiveLine: false,
                        matchBrackets: false,
                    },

                },
                toolbars: {
                    toolbar: false, // 不显示工具栏
                    showToolbar: false,
                    bubble: false, // 禁用气泡工具栏
                    float: false, // 禁用浮动工具栏
                    sidebar: false,
                    toc: false,
                },
                previewer: {
                    dom: false,
                    enablePreviewerBubble: false, // 禁用预览区域编辑能力
                },
                autoScrollByHashAfterInit: false,
                autoScrollByCursor: false,  // 禁用自动滚动
                height: '100%',
                engine: {
                    global: {
                        classicBr: false,
                        htmlWhiteList: '',
                        flowSessionContext: true,
                    },
                },
                themeSettings: {
                    mainTheme: 'default',
                    inlineCodeTheme: 'default',
                    codeBlockTheme: 'default',
                    toolbarTheme: 'default'
                },
            };
            this.cherry = new Cherry(cherryConfig);
            this.contentType = contentType;
        }else {
            const cherryConfig = {
                id: 'qbin-viewer',
                value: content,
                editor: {
                    defaultModel: 'previewOnly',
                },
                toolbars: {
                    toolbar: false, // 不显示工具栏
                    showToolbar: false,
                    bubble: false, // 禁用气泡工具栏
                    float: false, // 禁用浮动工具栏
                    sidebar: false,
                    toc: contentType.includes("markdown") ? {
                        updateLocationHash: false, // 更新URL的hash
                        defaultModel: 'pure', // 完整模式，会展示所有标题
                        position: 'fixed', // 悬浮目录
                        cssText: 'right: 20px;',
                    } : false,
                },
                previewer: {
                    enablePreviewerBubble: false, // 禁用预览区域编辑能力
                },
                autoScrollByHashAfterInit: false,
                externals: {
                    katex: window.katex, // 如果需要使用Katex的话
                },
                engine: {
                    global: {
                        urlProcessor(url, srcType) {
                            return url;
                        },
                        flowSessionContext: true,
                    },
                    syntax: {
                        mathBlock: {
                            engine: 'katex',
                        },
                        inlineMath: {
                            engine: 'katex',
                        },
                        codeBlock: {
                            lineNumber: false,
                            copyCode: false,
                        },
                    },
                },
                themeSettings: {
                    mainTheme: 'default',
                    codeBlockTheme: 'default',
                },
            };
            this.cherry = new Cherry(cherryConfig);
            this.contentType = contentType;
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
            const headResponse = await fetch(url, {method: 'HEAD'});
            if (!headResponse.ok) {
                const status = headResponse.status;
                if (status === 403) {
                    // 处理密码错误的情况 - 显示密码输入界面
                    this.showPasswordDialog(key, pwd);
                    return;
                } else if (status === 404) {
                    throw new Error('访问内容不存在');
                }
                throw new Error('内容加载失败');
            }
            await this.loadContent(headResponse);
        } catch (error) {
            console.error('Error loading content:', error);
            const debouncedNew = this.debounce(() => this.handleNew());
            this.buttonBar.innerHTML = '';
            this.buttonBar.appendChild(this.addButton('New', debouncedNew));
            await this.renderError(error.message || '内容加载失败')
        }
    }

    async loadContent(headResponse) {
        const contentType = headResponse.headers.get('Content-Type');
        const contentLength = headResponse.headers.get('Content-Length');
        this.setupButtons(contentType);

        if (!(['text/', 'image/', 'audio/', 'video/'].some(type => contentType.startsWith(type)))) {
            return await this.renderOtherContent(contentType, contentLength);
        }

        this.showLoading();
        const url = `/r/${this.currentPath.key}/${this.currentPath.pwd}`;
        const response = await API.fetchNet(url);
        if (contentType?.startsWith('text/markdown')) {
            await this.renderTextContent(response, contentType, contentLength);
        } else if (contentType?.startsWith('text/')) {
            await this.renderPlainTextContent(response, contentType, contentLength);
        } else if (contentType?.startsWith('image/')) {
            await this.renderImageContent(response, contentType, url, contentLength);
        } else if (contentType?.startsWith('audio/')) {
            await this.renderAudioContent(response, contentType, url, contentLength);
        } else if (contentType?.startsWith('video/')) {
            await this.renderVideoContent(response, contentType, url, contentLength);
        } else {
            await this.renderOtherContent(response, contentType, contentLength);
        }
    }

    async renderImageContent(response, contentType, sourceUrl, contentLength) {
        this.cherryContainer.innerHTML = '';
        const imageMarkdown = `::: center  
![images](${sourceUrl})
:::
`;
        this.initViewer(imageMarkdown, contentType);
        this.hideLoading();
    }

    async renderAudioContent(response, contentType, sourceUrl, contentLength) {
        this.cherryContainer.innerHTML = '';
        const audioMarkdown = `::: center  
!audio[audio](${sourceUrl})
:::
`;
        this.initViewer(audioMarkdown, contentType);
        this.hideLoading();
    }

    async renderVideoContent(response, contentType, sourceUrl, contentLength) {
        this.cherryContainer.innerHTML = '';
        const videoMarkdown = `::: center  
!video[视频文件](${sourceUrl})
:::
`;
        this.initViewer(videoMarkdown, contentType);
        this.hideLoading();
    }

    async renderPlainTextContent(response, contentType) {
        const text = await response.text();
        this.initViewer(text, contentType);
        this.hideLoading();
    }

    async renderTextContent(response, contentType) {
        const contentText = await response.text();
        this.initViewer(contentText, contentType);
        this.hideLoading();
    }

    async renderOtherContent(contentType, contentLength) {
        this.cherryContainer.innerHTML = '';
        const other = `
::: center  
!17 文件类型: ${contentType}!
!17 大小: ${formatSize(contentLength)}!
:::
`;
        this.initViewer(other, contentType);
        this.hideLoading();
    }

    async renderError(message) {
        this.cherryContainer.innerHTML = '';
        const imageMarkdown = `
::: danger  
<p style="text-align: center;">${message}</p>
:::
`;
        this.initViewer(imageMarkdown, "error");
        this.hideLoading();
    }

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
        } else if (['image/', 'audio/', 'video/'].some(type => contentType.startsWith(type))) {
            const rawBtn = this.addButton('Raw', debouncedRaw);
            rawBtn.classList.add('secondary');
            secondaryGroup.appendChild(rawBtn);
        } else {
            const downBtn = this.addButton('Down', debouncedDownload);
            downBtn.classList.add('secondary');
            secondaryGroup.appendChild(downBtn);
        }

        const qrBtn = this.addButton('QR', () => this.showQRCode());
        qrBtn.classList.add('secondary');
        primaryGroup.appendChild(qrBtn);

        // 通用按钮
        secondaryGroup.appendChild(this.addButton('New', debouncedNew));

        // 删除按钮放在最后，使用危险样式
        const delBtn = this.addButton('Del', debouncedDelete);
        delBtn.classList.add('danger');
        secondaryGroup.appendChild(delBtn);

        this.buttonBar.appendChild(primaryGroup);
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
            // 如果使用cherry-markdown，从实例中获取内容
            let content = '';
            if (this.cherry) {
                content = this.cherry.getValue();
            } else {
                // 兼容以前的方式，尝试从textarea获取内容
                const viewer = document.getElementById('viewer');
                if (viewer) {
                    content = viewer.value;
                }
            }

            const cacheData = {
                content,
                timestamp: getTimestamp(),
                path: this.currentPath.key,
                hash: cyrb53(content)
            };
            storage.setCache(this.CACHE_KEY + this.currentPath.key, cacheData);
            sessionStorage.setItem(this.CACHE_KEY + 'last', JSON.stringify(this.currentPath));
        } catch (e) {
            console.error('Fork处理失败:', e);
        }
        const originalEditor = getCookie('qbin-editor') || 'm';
        window.location.assign(`/${originalEditor}`);
    }

    async handleNew() {
        sessionStorage.removeItem(this.CACHE_KEY + 'last');
        const originalEditor = getCookie('qbin-editor') || 'm';
        window.location.assign(`/${originalEditor}`);
    }

    handleCopy() {
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
            }, 250);
        }
    }

    async copyLink() {
        const url = window.location.href.replace("/p/", "/r/");
        ClipboardUtil.copyToClipboard(url)
            .then(result => {
                if (result.success) {
                    this.showToast('链接已复制到剪贴板', {type: 'info'});
                } else {
                    this.showToast('复制失败，请手动复制', {type: 'error'});
                    const modal = ClipboardUtil.createManualCopyUI(url);
                    document.body.appendChild(modal);
                    modal.addEventListener('manualCopy', () => {
                        this.showToast("已手动复制");
                    });
                }
            });
    }

    async copyContent() {
        let content = this.cherry.getMarkdown();
        let tips = "";
        if (this.contentType.startsWith("image/")) {
            const firstImage = document.querySelector('.cherry-markdown img');
            if (!firstImage) {
                console.error('未找到图片元素');
                return;
            }
            if (!firstImage.complete) {
                await new Promise(resolve => {
                    firstImage.onload = resolve;
                });
            }
            if (navigator.clipboard && navigator.clipboard.write) {
                // 创建canvas并绘制图片
                const canvas = document.createElement('canvas');
                canvas.width = firstImage.naturalWidth;
                canvas.height = firstImage.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(firstImage, 0, 0);
                // 将图片转换为Blob对象
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/png');
                });
                // 复制到剪贴板
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                this.showToast('图片已复制到剪贴板', {type: 'info'});
                return;
            }
            if (navigator.share && navigator.canShare) {
                // 创建可分享的文件对象
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = imageViewer.naturalWidth;
                canvas.height = imageViewer.naturalHeight;
                ctx.drawImage(imageViewer, 0, 0);

                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/png');
                });

                const file = new File([blob], 'image.png', {type: 'image/png'});
                const shareData = {
                    files: [file]
                };

                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    this.showToast('已打开分享面板', {type: 'info'});
                    return;
                }
            }
            content = imageViewer.src;
            tips = '已复制图片链接';
        } else if (this.contentType.startsWith("text/")) {
            if (!this.contentType.includes("markdown")) {
                content = content.replace(/^.*?\n/, '');
            }
            tips = '内容已复制到剪贴板';
        } else {
            content = window.location.href.replace('/p/', '/r/');
            tips = '直链已复制到剪贴板';
        }
        ClipboardUtil.copyToClipboard(content)
            .then(result => {
                if (result.success) {
                    this.showToast(tips, {type: 'info'});
                } else {
                    this.showToast('复制失败，请手动复制', {type: 'error'});
                    const modal = ClipboardUtil.createManualCopyUI(url);
                    document.body.appendChild(modal);
                    modal.addEventListener('manualCopy', () => {
                        this.showToast("已手动复制");
                    });
                }
            });
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
                this.showToast(result.message || '上传失败', {type: 'error'});
            }
        } catch (error) {
            this.showToast(error.message, {type: 'error'});
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
            const existingModal = document.querySelector('.qr-modal');
            if (existingModal) {
                existingModal.remove();
            }
            const template = document.getElementById('qrModalTemplate');
            const modal = document.importNode(template.content, true).firstElementChild;
            const urlText = modal.querySelector('.url-text');
            urlText.textContent = currentUrl;
            document.body.appendChild(modal);
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
            const urlContainer = modal.querySelector('.url-container');
            const copyHint = urlContainer.querySelector('.copy-hint');
            urlContainer.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(currentUrl);
                    urlContainer.classList.add('copied');
                    copyHint.textContent = '已复制';
                    this.showToast('链接已复制', {type: 'info'});
                    setTimeout(() => {
                        urlContainer.classList.remove('copied');
                        copyHint.textContent = '点击复制';
                    }, 2000);
                } catch (err) {
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
                        this.showToast('链接已复制', {type: 'info'});
                        setTimeout(() => {
                            urlContainer.classList.remove('copied');
                            copyHint.textContent = '点击复制';
                        }, 2000);
                    } catch (err) {
                        console.error('复制失败:', err);
                        this.showToast('复制失败', {type: 'error'});
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
            const qrImg = document.createElement('img');
            qrImg.src = qr.createDataURL(5, 4);
            qrImg.alt = 'QR Code';
            const qrcodeContent = modal.querySelector('.qrcode-content');
            qrcodeContent.appendChild(qrImg);
        } catch (error) {
            console.error('QR码生成失败:', error);
            this.showToast('QR码生成失败', {type: 'error'});
        }
    }

    showPasswordDialog(key, currentPwd = '') {
        this.hideLoading();
        this.cherryContainer.innerHTML = '';
        this.buttonBar.innerHTML = '';

        // Get the password dialog
        const passwordDialog = document.getElementById('passwordDialog');
        const passwordInput = document.getElementById('passwordInput');
        const passwordError = document.getElementById('passwordError');

        // Reset and configure
        passwordInput.value = currentPwd || '';
        passwordError.textContent = '';
        passwordError.classList.remove('visible');

        // Make it visible in the container
        passwordDialog.style.display = 'block';
        this.cherryContainer.appendChild(passwordDialog);

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
        const headResponse = await fetch(url, {method: 'HEAD'});
        return {
            valid: headResponse.ok,
            headResponse: headResponse
        };
    }

    showLoading() {
        this.cherryContainer.innerHTML = '';
        const template = document.getElementById('loadingTemplate');
        const loadingEl = document.importNode(template.content, true).firstElementChild;
        this.cherryContainer.appendChild(loadingEl);
    }

    hideLoading() {
        const loadingEls = this.cherryContainer.querySelectorAll('.loading-container');
        loadingEls.forEach(el => el.remove());
    }
}

new QBinViewer();