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
        const defaultEditor = document.getElementById('default-editor');
        const darkMode = document.getElementById('dark-mode');

        defaultEditor.value = localStorage.getItem('default-editor') || 'e';
        darkMode.checked = localStorage.getItem('dark-mode') === 'true';
        
        defaultEditor.addEventListener('change', async (e) => {
            const selectedEditor = e.target.value;
            
            try {
                // 显示加载状态
                defaultEditor.classList.add('loading');
                
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
                
                // 可选：显示成功提示
                this.showToast('默认编辑器已设置');
            } catch (error) {
                console.error('设置默认编辑器失败:', error);
                
                // 发生错误时恢复原来的选择
                defaultEditor.value = localStorage.getItem('default-editor') || 'e';
                
                // 显示错误提示
                this.showToast('设置默认编辑器失败，请重试', 'error');
            } finally {
                // 移除加载状态
                defaultEditor.classList.remove('loading');
            }
        });

        darkMode.addEventListener('change', (e) => {
            const isDark = e.target.checked;
            localStorage.setItem('dark-mode', isDark);
            this.updateTheme(isDark);
        });
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

    updateTheme(isDark) {
        if (isDark) {
            document.documentElement.classList.add('dark-theme');
        } else {
            document.documentElement.classList.remove('dark-theme');
        }
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