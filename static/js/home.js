class QBinHome {
    constructor() {
        this.dataLoaded = {
            storage: false,
            shares: false
        };
        this.initializeNavigation();
        this.initializeSettings();
        this.initializeTokenFeature();
        this.initializeLogout();
    }

    initializeNavigation() {
        const links = document.querySelectorAll('.sidebar nav a');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);

                // Don't process logout button click here
                if (targetId === '') return;

                // Load data only when the respective section is clicked
                if (targetId === 'storage' && !this.dataLoaded.storage) {
                    this.loadStorageData();
                } else if (targetId === 'shares' && !this.dataLoaded.shares) {
                    this.loadShareData();
                }

                this.showSection(targetId);

                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');
    }

    async loadStorageData() {
        const container = document.getElementById('storage-items');
        // Show loading state
        container.innerHTML = '<div class="loading-indicator">加载中...</div>';

        try {
            const response = await fetch('/api/user/storage', {
                credentials: 'include' // Ensure cookies are sent with the request
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            this.renderStorageItems(data);
            this.dataLoaded.storage = true;
        } catch (error) {
            console.error('Failed to load storage data:', error);
            container.innerHTML = `
                <div class="error-message">
                    <p>功能暂未实现，敬请期待</p>
                </div>
            `;
            // container.innerHTML = `
            //     <div class="error-message">
            //         <p>加载数据失败: ${error.message}</p>
            //         <button onclick="document.querySelector('a[href=\'#storage\']').click()">重试</button>
            //     </div>
            // `;
        }
    }

    async loadShareData() {
        const container = document.getElementById('share-items');
        // Show loading state
        container.innerHTML = '<div class="loading-indicator">加载中...</div>';

        try {
            const response = await fetch('/api/user/shares', {
                credentials: 'include' // Ensure cookies are sent with the request
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            this.renderShareItems(data);
            this.dataLoaded.shares = true;
        } catch (error) {
            console.error('Failed to load share data:', error);
            container.innerHTML = `
                <div class="error-message">
                    <p>功能暂未实现，敬请期待</p>
                </div>
            `;
            // container.innerHTML = `
            //     <div class="error-message">
            //         <p>加载数据失败: ${error.message}</p>
            //         <button onclick="document.querySelector('a[href=\'#shares\']').click()">重试</button>
            //     </div>
            // `;
        }
    }

    renderStorageItems(items) {
        const container = document.getElementById('storage-items');
        container.innerHTML = items.map(item => `
            <div class="list-item">
                <span>${item.fname || 'Untitled'}</span>
                <span>${this.formatSize(item.len)}</span>
                <span>${this.formatDate(item.time)}</span>
                <span>${this.formatDate(item.expire)}</span>
                <span>
                    <button onclick="window.location.href='/p/${item.fkey}/${item.pwd}'">查看</button>
                    <button onclick="deleteItem('${item.fkey}')">删除</button>
                </span>
            </div>
        `).join('');
    }

    renderShareItems(items) {
        const container = document.getElementById('share-items');
        container.innerHTML = items.map(item => `
            <div class="list-item">
                <span>${item.fkey}</span>
                <span>${item.ftype}</span>
                <span>${this.formatDate(item.time)}</span>
                <span>${item.views || 0}</span>
                <span>
                    <button onclick="copyToClipboard('${item.fkey}')">复制链接</button>
                    <button onclick="deleteShare('${item.fkey}')">删除</button>
                </span>
            </div>
        `).join('');
    }

    initializeSettings() {
        const editorRadios = document.querySelectorAll('input[name="default-editor"]');
        const themeRadios = document.querySelectorAll('input[name="qbin-theme"]');

        // 设置默认编辑器选择
        const savedEditor = localStorage.getItem('default-editor') || 'e';
        document.querySelector(`input[name="default-editor"][value="${savedEditor}"]`).checked = true;
        this.updateEditorRadioVisualFeedback(savedEditor);

        // 设置默认主题选择
        const savedTheme = localStorage.getItem('qbin-theme') || 'system';
        document.querySelector(`input[name="qbin-theme"][value="${savedTheme}"]`).checked = true;

        // 确保主题设置已应用
        this.applyTheme(savedTheme);

        // 编辑器选择器变更监听
        editorRadios.forEach(radio => {
            radio.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    const selectedEditor = e.target.value;

                    try {
                        // 添加点击反馈动画
                        const label = e.target.nextElementSibling;
                        label.classList.add('radio-clicked');
                        setTimeout(() => {
                            label.classList.remove('radio-clicked');
                        }, 300);

                        // 调用后端API设置默认编辑器
                        const response = await fetch(`/api/user/default/${selectedEditor}`, {
                            method: 'GET',
                            credentials: 'include'
                        });
                        if (!response.ok) {
                            throw new Error('设置默认编辑器失败');
                        }
                        // 成功后存储到localStorage以保持UI一致性
                        localStorage.setItem('default-editor', selectedEditor);
                        // 更新视觉反馈
                        this.updateEditorRadioVisualFeedback(selectedEditor);
                        // 显示成功提示
                        this.showToast(`${selectedEditor === 'e' ? '通用编辑器' : selectedEditor === 'm' ? 'Markdown编辑器' : '代码编辑器'}已设置`);
                    } catch (error) {
                        console.error('设置默认编辑器失败:', error);

                        // 发生错误时恢复原来的选择
                        const originalEditor = localStorage.getItem('default-editor') || 'e';
                        document.querySelector(`input[name="default-editor"][value="${originalEditor}"]`).checked = true;
                        this.updateEditorRadioVisualFeedback(originalEditor);

                        // 显示错误提示
                        this.showToast('设置默认编辑器失败，请重试', 'error');
                    } finally {
                        // 不需要加载状态处理
                    }
                }
            });
        });

        // 主题变更监听
        themeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    const themeValue = e.target.value;
                    localStorage.setItem('qbin-theme', themeValue);
                    this.applyTheme(themeValue);
                    this.showToast(`已切换到${themeValue === 'light' ? '浅色' : themeValue === 'dark' ? '深色' : '系统'}主题`);

                    // 添加点击反馈动画
                    const label = e.target.nextElementSibling;
                    label.classList.add('radio-clicked');
                    setTimeout(() => {
                        label.classList.remove('radio-clicked');
                    }, 300);
                }
            });
        });

        // 初始化时设置视觉反馈
        this.updateThemeRadioVisualFeedback(savedTheme);
    }

    // 应用主题方法
    applyTheme(themeValue) {
        // 添加过渡效果类
        document.documentElement.classList.add('theme-transition');

        // 移除所有主题类
        document.documentElement.classList.remove('light-theme', 'dark-theme');

        if (themeValue === 'system') {
            // 系统主题检测
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.documentElement.classList.add('dark-theme');
            } else {
                document.documentElement.classList.add('light-theme');
            }

            // 监听系统主题变化
            this.setupSystemThemeListener();
        } else {
            // 直接应用指定主题
            document.documentElement.classList.add(themeValue === 'dark' ? 'dark-theme' : 'light-theme');
        }

        // 添加视觉反馈
        this.updateThemeRadioVisualFeedback(themeValue);

        // 移除过渡类，防止影响其他操作
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 300);
    }

    // 设置系统主题变化监听
    setupSystemThemeListener() {
        if (!this.systemThemeListenerSet) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            const handleThemeChange = (e) => {
                if (localStorage.getItem('qbin-theme') === 'system') {
                    // 添加过渡效果
                    document.documentElement.classList.add('theme-transition');
                    document.documentElement.classList.remove('light-theme', 'dark-theme');
                    document.documentElement.classList.add(e.matches ? 'dark-theme' : 'light-theme');

                    // 移除过渡类
                    setTimeout(() => {
                        document.documentElement.classList.remove('theme-transition');
                    }, 300);
                }
            };

            // 添加事件监听器
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handleThemeChange);
            } else if (mediaQuery.addListener) {
                // 兼容旧版本浏览器
                mediaQuery.addListener(handleThemeChange);
            }

            this.systemThemeListenerSet = true;
        }
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Never';
        return new Date(timestamp * 1000).toLocaleString();
    }

    // 更新选择器的视觉反馈
    updateRadioVisualFeedback(name, value, activeClass) {
        // 先移除所有选项的活跃状态
        document.querySelectorAll(`input[name="${name}"] + .radio-label`).forEach(label => {
            label.classList.remove(activeClass);
        });

        // 给当前选中的选项添加活跃状态
        const selectedRadio = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (selectedRadio) {
            const label = selectedRadio.nextElementSibling;
            label.classList.add(activeClass);
        }
    }

    // 更新主题选择器的视觉反馈
    updateThemeRadioVisualFeedback(themeValue) {
        this.updateRadioVisualFeedback('qbin-theme', themeValue, 'active-theme');
    }

    // 更新编辑器选择器的视觉反馈
    updateEditorRadioVisualFeedback(editorValue) {
        this.updateRadioVisualFeedback('default-editor', editorValue, 'active-editor');
    }

    initializeTokenFeature() {
        const generateBtn = document.getElementById('generate-token-btn');
        const copyBtn = document.getElementById('copy-token-btn');
        const tokenInput = document.getElementById('token-input');

        // Generate token button
        if (generateBtn) {
            generateBtn.addEventListener('click', async () => {
                // Reset any previous messages
                this.setTokenMessage('', 'hidden');

                try {
                    // Update UI to loading state
                    generateBtn.disabled = true;
                    generateBtn.classList.add('loading');
                    generateBtn.textContent = '生成中...';

                    // Make API request
                    const response = await fetch('/api/user/token', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        credentials: 'include'
                    });

                    if (!response.ok) {
                        throw new Error(await this.getErrorMessage(response));
                    }

                    const data = await response.json();

                    if ("token" in data.data) {
                        tokenInput.value = data.data.token;
                        copyBtn.disabled = false;
                        this.setTokenMessage('Token已生成，请妥善保存', 'success');
                    } else {
                        throw new Error('服务器返回的数据中没有Token');
                    }
                } catch (error) {
                    console.error('Token generation failed:', error);
                    this.setTokenMessage(error.message, 'error');
                } finally {
                    // Restore button state
                    generateBtn.disabled = false;
                    generateBtn.classList.remove('loading');
                    generateBtn.textContent = '生成Token';
                }
            });
        }

        // Copy button
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (!tokenInput.value) return;

                // Copy to clipboard
                tokenInput.select();
                document.execCommand('copy');
                // Deselect the text
                window.getSelection().removeAllRanges();

                // Show feedback
                this.setTokenMessage('Token已复制到剪贴板', 'success');

                // Visual feedback on the button
                copyBtn.classList.add('active');
                setTimeout(() => copyBtn.classList.remove('active'), 1000);
            });
        }
    }

    async getErrorMessage(response) {
        try {
            const data = await response.json();
            return data.message || `请求失败 (${response.status})`;
        } catch (e) {
            return `请求失败 (${response.status})`;
        }
    }

    setTokenMessage(message, type) {
        const messageEl = document.getElementById('token-message');
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.className = 'message'; // Reset classes

        if (type === 'hidden') {
            messageEl.classList.add('hidden');
        } else {
            messageEl.classList.add(type);
        }
    }

    initializeLogout() {
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }
    }

    async handleLogout() {
        try {
            const response = await fetch('/api/user/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (response.ok) {
                window.location.href = '/';
            } else {
                console.error('Logout failed:', await response.text());
                alert('退出登录失败，请稍后再试');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('退出登录出错，请稍后再试');
        }
    }

    showToast(message, type = 'success') {
        // 检查是否已存在toast容器，没有则创建
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        // 创建新的提示元素
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        // 添加到容器
        toastContainer.appendChild(toast);

        // 设置自动消失
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => {
                toastContainer.removeChild(toast);
                // 如果没有更多提示，移除容器
                if (toastContainer.children.length === 0) {
                    document.body.removeChild(toastContainer);
                }
            }, 300);
        }, 3000);
    }
}

new QBinHome();