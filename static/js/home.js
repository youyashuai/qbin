
class QBinHome {
    constructor() {
        this.initializeNavigation();
        this.loadStorageData();
        this.loadShareData();
        this.initializeSettings();
    }

    initializeNavigation() {
        const links = document.querySelectorAll('.sidebar nav a');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
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
        try {
            const response = await fetch('/api/storage');
            const data = await response.json();
            this.renderStorageItems(data);
        } catch (error) {
            console.error('Failed to load storage data:', error);
        }
    }

    async loadShareData() {
        try {
            const response = await fetch('/api/shares');
            const data = await response.json();
            this.renderShareItems(data);
        } catch (error) {
            console.error('Failed to load share data:', error);
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

        defaultEditor.addEventListener('change', (e) => {
            localStorage.setItem('default-editor', e.target.value);
        });

        darkMode.addEventListener('change', (e) => {
            localStorage.setItem('dark-mode', e.target.checked);
            this.updateTheme(e.target.checked);
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
        document.documentElement.style.setProperty('--bg-color', isDark ? '#1a1a1a' : '#ffffff');
        document.documentElement.style.setProperty('--text-color', isDark ? '#ffffff' : '#333333');
        document.documentElement.style.setProperty('--border-color', isDark ? '#333333' : '#e0e0e0');
        document.documentElement.style.setProperty('--hover-color', isDark ? '#2a2a2a' : '#f5f5f5');
    }
}

new QBinHome();