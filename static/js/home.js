class QBinHome {
    constructor() {
        this.dataLoaded = {
            storage: false,
            shares: false
        };
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;
        this.currentView = 'list'; // 默认视图类型：'list', 'grid'
        this.isLoading = false;
        this.hasMoreData = true;
        this.storageItems = [];
        this.selectedItem = null;

        // 滚动相关属性
        this.scrollRAF = null; // requestAnimationFrame标识符

        // 渲染相关属性
        this.batchSize = 50; // 分批渲染的批次大小
        this.batchRenderTimer = null; // 分批渲染计时器

        this.initializeNavigation();
        this.initializeSettings();
        this.initializeTokenFeature();
        this.initializeLogout();
        this.initializeViewToggle();
        this.initializeInfiniteScroll();
        this.initializeContextMenu();
        this.initializeSearch();

        // 从本地存储中恢复视图偏好
        this.loadViewPreference();
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

    initializeViewToggle() {
        // 视图切换按钮事件监听
        const listViewBtn = document.getElementById('list-view-btn');
        const gridViewBtn = document.getElementById('grid-view-btn');

        // 简化事件监听器的添加
        if (listViewBtn) {
            // 移除所有旧的点击事件监听器
            const newListViewBtn = listViewBtn.cloneNode(true);
            listViewBtn.parentNode.replaceChild(newListViewBtn, listViewBtn);

            // 添加新的事件监听器
            newListViewBtn.addEventListener('click', () => {
                this.switchView('list');
            });
        }

        if (gridViewBtn) {
            // 移除所有旧的点击事件监听器
            const newGridViewBtn = gridViewBtn.cloneNode(true);
            gridViewBtn.parentNode.replaceChild(newGridViewBtn, gridViewBtn);

            // 添加新的事件监听器
            newGridViewBtn.addEventListener('click', () => {
                this.switchView('grid');
            });
        }
    }

    initializeInfiniteScroll() {
        // 移除全局滚动事件委托，改为直接在容器上添加监听器
        // 为列表视图和网格视图分别添加滚动监听器
        this.addScrollListenerToView('list');
        this.addScrollListenerToView('grid');

        // 在视图切换时重新添加滚动监听器
        document.addEventListener('viewChanged', (event) => {
            this.addScrollListenerToView(event.detail.view);
        });
    }

    // 存储滚动事件处理函数的引用，以便正确移除
    scrollHandlers = {
        list: null,
        grid: null
    };

    addScrollListenerToView(viewType) {
        // 为指定视图的滚动容器添加滚动监听器
        // 使用requestAnimationFrame确保在浏览器空闲时添加监听器
        requestAnimationFrame(() => {
            // 根据视图类型选择正确的滚动容器
            let scrollContainer;

            if (viewType === 'list') {
                scrollContainer = document.querySelector(`#${viewType}-view .storage-list`);
            } else if (viewType === 'grid') {
                scrollContainer = document.querySelector(`#${viewType}-view .grid-container`);
            }

            if (scrollContainer) {
                // 移除旧的监听器，防止重复
                if (this.scrollHandlers[viewType]) {
                    scrollContainer.removeEventListener('scroll', this.scrollHandlers[viewType]);
                    this.scrollHandlers[viewType] = null;
                }

                // 创建新的处理函数并保存引用
                // 使用passive选项提高滚动性能
                this.scrollHandlers[viewType] = (event) => {
                    // 使用requestAnimationFrame来防止滚动时过多的处理
                    if (!this.scrollRAF) {
                        this.scrollRAF = requestAnimationFrame(() => {
                            this.handleScroll(event, scrollContainer);
                            this.scrollRAF = null;
                        });
                    }
                };

                // 添加新的监听器，使用passive选项提高滚动性能
                scrollContainer.addEventListener('scroll', this.scrollHandlers[viewType], { passive: true });

                // 初始检查是否需要加载更多数据
                if (this.hasMoreData && !this.isLoading) {
                    // 延迟检查，等待视图完全渲染
                    setTimeout(() => {
                        this.handleScroll(null, scrollContainer);
                    }, 200);
                }
            }
        });
    }

    initializeContextMenu() {
        // 初始化右键菜单
        const contextMenu = document.getElementById('context-menu');
        const menuView = document.getElementById('menu-view');
        const menuCopyLink = document.getElementById('menu-copy-link');
        const menuDelete = document.getElementById('menu-delete');

        if (!contextMenu) return;

        // 添加对action-btn的直接事件处理
        this.setupActionButtonHandlers();

        // 为列表和网格视图添加事件委托
        this.setupItemEventDelegation();

        // 点击其他地方关闭右键菜单
        document.addEventListener('click', (e) => {
            // 如果点击的不是action-btn或者菜单项，则隐藏菜单
            if (!e.target.closest('.action-btn') && !e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });

        // 菜单项点击事件
        if (menuView) {
            menuView.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedItem) {
                    window.open(`/p/${this.selectedItem.fkey}/${this.selectedItem.pwd}`, '_blank', 'noopener');
                }
                this.hideContextMenu();
            });
        }

        if (menuCopyLink) {
            menuCopyLink.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedItem) {
                    const url = `${window.location.origin}/r/${this.selectedItem.fkey}/${this.selectedItem.pwd || ''}`;
                    this.copyToClipboard(url);
                }
                this.hideContextMenu();
            });
        }

        if (menuDelete) {
            menuDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedItem) {
                    this.deleteStorageItem(this.selectedItem.fkey, this.selectedItem.pwd);
                }
                this.hideContextMenu();
            });
        }
    }

    // 为列表和网格视图添加事件委托
    setupItemEventDelegation() {
        // 获取容器
        const listContainer = document.getElementById('list-items');
        const gridContainer = document.getElementById('grid-items');

        // 为列表视图添加事件委托
        if (listContainer && !listContainer.hasEventListeners) {
            // 双击打开文件
            listContainer.addEventListener('dblclick', (e) => {
                const listItem = e.target.closest('.list-item');
                if (listItem) {
                    const actionBtn = listItem.querySelector('.action-btn');
                    if (actionBtn) {
                        const fkey = actionBtn.getAttribute('data-fkey');
                        const pwd = actionBtn.getAttribute('data-pwd');
                        if (fkey) {
                            window.open(`/p/${fkey}/${pwd}`, '_blank', 'noopener');
                        }
                    }
                }
            });

            // 右键菜单
            listContainer.addEventListener('contextmenu', (e) => {
                const listItem = e.target.closest('.list-item');
                if (listItem) {
                    e.preventDefault();
                    const actionBtn = listItem.querySelector('.action-btn');
                    if (actionBtn) {
                        const fkey = actionBtn.getAttribute('data-fkey');
                        if (fkey) {
                            const item = this.storageItems.find(item => String(item.fkey) === fkey);
                            if (item) {
                                this.showContextMenu(e.clientX, e.clientY, item);
                            }
                        }
                    }
                }
            });

            // 标记容器已添加事件监听器
            listContainer.hasEventListeners = true;
        }

        // 为网格视图添加事件委托
        if (gridContainer && !gridContainer.hasEventListeners) {
            // 双击打开文件
            gridContainer.addEventListener('dblclick', (e) => {
                const gridItem = e.target.closest('.grid-item');
                if (gridItem) {
                    const fkey = gridItem.dataset.fkey;
                    const pwd = gridItem.dataset.pwd;
                    if (fkey) {
                        window.open(`/p/${fkey}/${pwd}`, '_blank', 'noopener');
                    }
                }
            });

            // 右键菜单
            gridContainer.addEventListener('contextmenu', (e) => {
                const gridItem = e.target.closest('.grid-item');
                if (gridItem) {
                    e.preventDefault();
                    const fkey = gridItem.dataset.fkey;
                    if (fkey) {
                        const item = this.storageItems.find(item => String(item.fkey) === fkey);
                        if (item) {
                            this.showContextMenu(e.clientX, e.clientY, item);
                        }
                    }
                }
            });

            // 标记容器已添加事件监听器
            gridContainer.hasEventListeners = true;
        }

        // 当视图切换时重新添加事件委托
        document.addEventListener('viewChanged', () => {
            this.setupItemEventDelegation();
        });
    }

    initializeSearch() {
        // 初始化搜索功能
        const searchInput = document.getElementById('storage-search');
        if (!searchInput) return;

        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const searchTerm = e.target.value.trim().toLowerCase();
                this.filterStorageItems(searchTerm);
            }, 300);
        });
    }

    filterStorageItems(searchTerm) {
        // 根据搜索关键词过滤显示的文件
        if (!this.storageItems.length) return;

        const containerMap = {
            list: 'list-items',
            grid: 'grid-items'
        };

        const container = document.getElementById(containerMap[this.currentView]);
        if (!container) return;

        if (!searchTerm) {
            // 如果搜索框为空，显示所有文件
            if (this.currentView === 'list') {
                this.renderListView(this.storageItems, container, true);
            } else {
                this.renderGridView(this.storageItems, container, true);
            }
            return;
        }

        // 过滤匹配的文件
        const filteredItems = this.storageItems.filter(item => {
            const fileName = this.getFileName(item).toLowerCase();
            return fileName.includes(searchTerm);
        });

        // 渲染过滤后的文件
        if (this.currentView === 'list') {
            this.renderListView(filteredItems, container, true);
        } else {
            this.renderGridView(filteredItems, container, true);
        }
    }

    showContextMenu(x, y, item) {
        // 显示右键菜单
        const contextMenu = document.getElementById('context-menu');
        if (!contextMenu) return;

        // 首先隐藏任何已经显示的菜单
        this.hideContextMenu();

        // 防止光标出现
        document.activeElement.blur();

        // 存储选中项
        this.selectedItem = item;

        // 获取滚动位置
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        // 先设置可见性为隐藏，但添加可见类，以便测量尺寸
        contextMenu.style.visibility = 'hidden';
        contextMenu.classList.add('visible');

        // 等待一帧以确保样式已应用
        setTimeout(() => {
            // 获取菜单尺寸
            const menuWidth = contextMenu.offsetWidth;
            const menuHeight = contextMenu.offsetHeight;

            // 设置菜单位置，考虑滚动位置
            // 将视口坐标转换为页面坐标
            let posX = x + scrollX;
            let posY = y + scrollY;

            // 确保菜单不超出屏幕边界
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // 调整菜单位置以防止超出屏幕
            if (x + menuWidth > viewportWidth) {
                posX = scrollX + x - menuWidth;
            }

            if (y + menuHeight > viewportHeight) {
                posY = scrollY + y - menuHeight;
            }

            // 设置最终位置
            contextMenu.style.left = `${posX}px`;
            contextMenu.style.top = `${posY}px`;

            // 显示菜单
            contextMenu.style.visibility = 'visible';
        }, 0);

        // 防止鼠标移动导致选中状态丢失
        const menuItems = contextMenu.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('mouseover', function(e) {
                // 移除所有项的高亮
                menuItems.forEach(i => i.classList.remove('hover'));
                // 高亮当前项
                this.classList.add('hover');
            });
        });

        // 阻止事件冒泡，防止点击菜单外关闭菜单
        contextMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        }, { once: true });
    }

    hideContextMenu() {
        // 隐藏右键菜单
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu) {
            contextMenu.classList.remove('visible');
        }
    }

    setupActionButtonHandlers() {
        // 为列表视图和网格视图中的action-btn添加事件处理
        const listContainer = document.getElementById('list-items');
        const gridContainer = document.getElementById('grid-items');

        // 为列表视图中的按钮添加事件委托
        if (listContainer) {
            listContainer.addEventListener('click', (e) => {
                this.handleActionButtonClick(e);
            });
        }

        // 为网格视图中的按钮添加事件委托
        if (gridContainer) {
            gridContainer.addEventListener('click', (e) => {
                this.handleActionButtonClick(e);
            });
        }

        // 当视图切换时重新添加事件处理
        document.addEventListener('viewChanged', () => {
            this.setupActionButtonHandlers();
        });
    }

    handleActionButtonClick(e) {
        const actionBtn = e.target.closest('.action-btn');
        if (actionBtn) {
            e.stopPropagation(); // 阻止事件冒泡，防止触发其他点击事件

            // 获取按钮位置信息
            const rect = actionBtn.getBoundingClientRect();
            const x = rect.left;
            const y = rect.bottom;

            // 获取文件信息
            const fkey = actionBtn.getAttribute('data-fkey');
            const pwd = actionBtn.getAttribute('data-pwd');

            // 找到对应的文件项
            const item = this.storageItems.find(item => String(item.fkey) === fkey);
            if (item) {
                this.showContextMenu(x, y, item);
            } else {
                console.error('Could not find item with fkey:', fkey);
                // 如果找不到对应的文件项，尝试使用按钮上的数据创建一个临时项
                const tempItem = {
                    fkey: fkey,
                    pwd: pwd || ''
                };
                this.showContextMenu(x, y, tempItem);
            }
        }
    }

    // 滚动节流计时器
    scrollThrottleTimer = null;

    // 最后一次滚动处理时间
    lastScrollTime = 0;

    handleScroll(event, scrollContainer) {
        // 如果当前不在存储管理页面，则不处理
        if (!document.getElementById('storage').classList.contains('active')) {
            return;
        }

        // 如果正在加载或没有更多数据，则不处理
        if (this.isLoading || !this.hasMoreData) {
            return;
        }

        // 节流处理，防止频繁触发
        const now = Date.now();
        if (now - this.lastScrollTime < 100) { // 至少间隔100ms
            // 如果已经有计时器，则不重新设置
            if (!this.scrollThrottleTimer) {
                this.scrollThrottleTimer = setTimeout(() => {
                    this.scrollThrottleTimer = null;
                    this.lastScrollTime = Date.now();
                    this._handleScrollImpl(scrollContainer);
                }, 100);
            }
            return;
        }

        // 更新最后处理时间
        this.lastScrollTime = now;
        // 清除之前的计时器
        if (this.scrollThrottleTimer) {
            clearTimeout(this.scrollThrottleTimer);
            this.scrollThrottleTimer = null;
        }

        // 实际处理滚动
        this._handleScrollImpl(scrollContainer);
    }

    // 实际处理滚动的内部方法
    _handleScrollImpl(scrollContainer) {
        // 如果没有传入滚动容器，则根据当前视图获取
        if (!scrollContainer) {
            if (this.currentView === 'list') {
                scrollContainer = document.querySelector(`#${this.currentView}-view .storage-list`);
            } else if (this.currentView === 'grid') {
                scrollContainer = document.querySelector(`#${this.currentView}-view .grid-container`);
            }
        }

        if (!scrollContainer) return;

        // 检查是否滚动到底部
        // 滚动位置 + 可见高度 >= 总高度 - 50px（留出一点空间提前加载）
        const isNearBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 50;

        if (isNearBottom) {
            this.loadMoreData();
        }
    }

    async loadMoreData() {
        // 加载更多数据
        if (this.isLoading || !this.hasMoreData) return;

        this.isLoading = true;

        // 获取当前视图的容器
        const containerMap = {
            list: 'list-items',
            grid: 'grid-items'
        };

        const container = document.getElementById(containerMap[this.currentView]);
        if (!container) {
            this.isLoading = false;
            return;
        }

        // 显示加载中的Toast提示
        const loadingToast = this.showToast('正在加载更多数据...', 'loading', 0, 'loading-toast');

        try {
            // 发起API请求，带上分页参数
            const nextPage = this.currentPage + 1;
            const response = await fetch(`/api/user/storage?page=${nextPage}&pageSize=${this.pageSize}`, {
                credentials: 'include' // 确保发送cookie
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();

            if (result.status !== 200 || !result.data) {
                throw new Error(result.message || '加载数据失败');
            }

            // 从结果中获取数据和分页信息
            const { items, pagination } = result.data;

            // 判断数据是否有效
            if (!items || items.length === 0) {
                this.hasMoreData = false;
                this.updateToast(loadingToast, '没有更多数据', 'info', 2000);
                return;
            }

            // 更新分页信息
            this.totalPages = pagination.totalPages;
            this.currentPage = nextPage;
            
            // 根据总页数判断是否还有更多数据
            this.hasMoreData = this.currentPage < this.totalPages;

            // 将新数据添加到存储数组
            this.storageItems = [...this.storageItems, ...items];

            // 根据当前视图类型渲染数据
            if (this.currentView === 'list') {
                this.renderListView(items, container, false);
            } else {
                this.renderGridView(items, container, false);
            }

            // 更新Toast提示为成功
            this.updateToast(loadingToast, `成功加载 ${items.length} 个数据`, 'success', 2000);

            // 如果加载到最后一页，显示提示
            if (!this.hasMoreData) {
                setTimeout(() => {
                    const totalItems = pagination.total || this.storageItems.length;
                    this.showToast(`已加载全部 ${totalItems} 个数据`, 'info', 3000);
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to load more data:', error);

            // 更新Toast提示为错误
            this.updateToast(loadingToast, `加载失败: ${error.message}`, 'error', 3000);

            // 显示重试提示
            setTimeout(() => {
                this.showToast('点击重试', 'warning', 0, 'retry-toast')
                    .addEventListener('click', () => {
                        this.hideToast(document.getElementById('retry-toast'));
                        this.loadMoreData();
                    });
            }, 3000);
        } finally {
            this.isLoading = false;
        }
    }

    loadViewPreference() {
        // 从本地存储中加载视图偏好设置
        const savedView = localStorage.getItem('qbin-storage-view');
        if (savedView && ['list', 'grid'].includes(savedView)) {
            this.switchView(savedView, false); // 不显示通知
        }
    }

    // 标记是否正在切换视图
    isSwitchingView = false;

    // 视图切换锁定时间（毫秒）
    viewSwitchLockTime = 200;

    // 视图切换计时器
    viewSwitchTimer = null;

    switchView(viewType, showNotification = false) {
        // 如果当前已经是目标视图，不执行切换
        if (this.currentView === viewType) return;

        // 如果正在切换视图，直接返回，防止重复切换
        if (this.isSwitchingView) return;

        // 标记正在切换视图
        this.isSwitchingView = true;

        // 清理所有可能存在的计时器
        this.clearAllTimers();

        try {
            // 存储旧视图类型
            const oldViewType = this.currentView;
            this.currentView = viewType;

            // 更新按钮状态
            document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`${viewType}-view-btn`).classList.add('active');

            // 更新视图显示
            document.querySelectorAll('.storage-view').forEach(view => view.classList.remove('active'));
            document.getElementById(`${viewType}-view`).classList.add('active');

            // 保存用户偏好到本地存储
            localStorage.setItem('qbin-storage-view', viewType);

            // 显示通知
            if (showNotification) {
                const viewNames = {
                    list: '列表',
                    grid: '网格'
                };
                this.showToast(`已切换到${viewNames[viewType]}视图`);
            }

            // 清理旧视图的事件监听器
            this.cleanupViewEventListeners(oldViewType);

            // 如果数据已加载，则重新渲染当前数据
            if (this.dataLoaded.storage && this.storageItems.length > 0) {
                // 获取当前视图的容器
                const containerMap = {
                    list: 'list-items',
                    grid: 'grid-items'
                };

                const container = document.getElementById(containerMap[viewType]);
                if (container) {
                    // 清空容器
                    container.innerHTML = '';

                    // 简单直接地渲染视图，不使用复杂的分批渲染
                    if (viewType === 'list') {
                        this.renderSimpleListView(this.storageItems, container);
                    } else {
                        this.renderSimpleGridView(this.storageItems, container);
                    }

                    // 触发视图切换事件
                    this.triggerViewChangedEvent(viewType);
                }
            } else if (!this.dataLoaded.storage) {
                // 如果数据还没有加载，则加载数据
                this.resetAndLoadData();

                // 触发视图切换事件
                this.triggerViewChangedEvent(viewType);
            } else {
                // 触发视图切换事件
                this.triggerViewChangedEvent(viewType);
            }

            // 设置一个计时器，在一定时间后解除视图切换锁定
            this.viewSwitchTimer = setTimeout(() => {
                this.isSwitchingView = false;
                this.viewSwitchTimer = null;
            }, this.viewSwitchLockTime);

        } catch (error) {
            console.error('Error switching view:', error);
            // 出错时也要重置切换状态
            this.isSwitchingView = false;
        }
    }

    // 清理所有计时器
    clearAllTimers() {
        // 清理视图切换计时器
        if (this.viewSwitchTimer) {
            clearTimeout(this.viewSwitchTimer);
            this.viewSwitchTimer = null;
        }

        // 清理批量渲染计时器
        if (this.batchRenderTimer) {
            clearTimeout(this.batchRenderTimer);
            this.batchRenderTimer = null;
        }

        // 清理滚动动画帧
        if (this.scrollRAF) {
            cancelAnimationFrame(this.scrollRAF);
            this.scrollRAF = null;
        }
    }

    // 清理视图的事件监听器
    cleanupViewEventListeners(viewType) {
        if (viewType && this.scrollHandlers[viewType]) {
            const container = viewType === 'list'
                ? document.querySelector(`#${viewType}-view .storage-list`)
                : document.querySelector(`#${viewType}-view .grid-container`);

            if (container) {
                container.removeEventListener('scroll', this.scrollHandlers[viewType]);
                this.scrollHandlers[viewType] = null;
            }
        }
    }

    // 触发视图切换事件
    triggerViewChangedEvent(viewType) {
        const viewChangedEvent = new CustomEvent('viewChanged', {
            detail: { view: viewType }
        });
        document.dispatchEvent(viewChangedEvent);
    }

    // 简单的列表视图渲染，不使用分批处理
    renderSimpleListView(items, container) {
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无数据</div>';
            return;
        }

        // 创建文档片段来提高性能
        const fragment = document.createDocumentFragment();
        const btnIcon = isMobile() ? '<span style="font-size: 20px; font-weight: bold;">…</span>': '<span style="font-size: 8px; letter-spacing: 1px;">●●●</span>';

        // 一次性渲染所有项目
        items.forEach(item => {
            const fileName = this.getFileName(item);
            const fileIcon = this.getFileTypeIcon(item.type);

            const listItem = document.createElement('div');
            listItem.className = 'list-item visible'; // 直接添加visible类
            listItem.innerHTML = `
                <span class="file-name">
                    <span class="file-icon">${fileIcon}</span>
                    ${fileName}
                </span>
                <span class="file-size">${this.formatSize(item.len)}</span>
                <span class="file-time">${this.formatDate(item.time)}</span>
                <span class="file-actions">
                    <button class="action-btn" title="更多操作" data-fkey="${item.fkey}" data-pwd="${item.pwd}">
                    ${btnIcon}
                    </button>
                </span>
            `;

            fragment.appendChild(listItem);
        });

        // 一次性添加到DOM
        container.appendChild(fragment);
    }

    // 简单的网格视图渲染，不使用分批处理
    renderSimpleGridView(items, container) {
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无数据</div>';
            return;
        }

        // 创建文档片段来提高性能
        const fragment = document.createDocumentFragment();

        // 一次性渲染所有项目
        items.forEach(item => {
            const fileName = this.getFileName(item);
            const fileIcon = this.getFileIcon(item.type);

            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item visible'; // 直接添加visible类
            gridItem.innerHTML = `
                <div class="file-icon">${fileIcon}</div>
                <div class="file-name">${fileName}</div>
                <div class="file-meta">${this.formatSize(item.len)}</div>
            `;

            gridItem.dataset.fkey = item.fkey;
            gridItem.dataset.pwd = item.pwd || '';

            fragment.appendChild(gridItem);
        });

        // 一次性添加到DOM
        container.appendChild(fragment);
    }

    // 标记是否正在重置数据
    isResetting = false;

    async resetAndLoadData() {
        // 防止重复重置
        if (this.isResetting) return;
        this.isResetting = true;

        try {
            // 重置数据状态并加载第一页
            this.currentPage = 1;
            this.storageItems = [];
            this.hasMoreData = true;
            this.dataLoaded.storage = false; // 重置数据加载状态

            // 清空容器
            const listContainer = document.getElementById('list-items');
            const gridContainer = document.getElementById('grid-items');

            if (listContainer) listContainer.innerHTML = '';
            if (gridContainer) gridContainer.innerHTML = '';

            // 加载数据
            await this.loadStorageData(true);
        } catch (error) {
            console.error('Error resetting data:', error);
        } finally {
            // 重置状态
            this.isResetting = false;
        }
    }

    // 标记是否正在加载数据
    isLoadingData = false;

    async loadStorageData(isReset = false) {
        // 防止并发加载
        if (this.isLoadingData) return;
        this.isLoadingData = true;

        // 根据当前视图类型选择容器
        const containerMap = {
            list: 'list-items',
            grid: 'grid-items',
            table: 'table-items'
        };

        const container = document.getElementById(containerMap[this.currentView]);
        if (!container) {
            this.isLoadingData = false;
            return;
        }

        const loadingToast = this.showToast('正在加载数据...', 'loading', 0, 'loading-toast');

        try {
            // 发起API请求，带上分页参数
            const response = await fetch(`/api/user/storage?page=${this.currentPage}&pageSize=${this.pageSize}`, {
                credentials: 'include' // 确保发送cookie
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();
            if (result.status !== 200 || !result.data) {
                throw new Error(result.message || '加载数据失败');
            }

            const { items, pagination } = result.data;

            // 将数据添加到存储数组
            if (isReset) {
                this.storageItems = [...items];
            } else {
                this.storageItems = [...this.storageItems, ...items];
            }

            // 更新分页信息
            this.totalPages = pagination.totalPages;
            this.hasMoreData = this.currentPage < this.totalPages;

            // 根据当前视图类型渲染数据
            switch (this.currentView) {
                case 'list':
                    this.renderListView(items, container, isReset);
                    break;
                case 'grid':
                    this.renderGridView(items, container, isReset);
                    break;
                case 'table':
                    this.renderTableView(items, container, isReset);
                    break;
            }

            this.dataLoaded.storage = true;

            // 更新Toast提示为成功
            this.updateToast(loadingToast, `成功加载 ${items.length} 个数据`, 'success', 2000);
        } catch (error) {
            console.error('Failed to load storage data:', error);
            container.innerHTML = `
                <div class="error-message">
                    <p>加载数据失败: ${error.message}</p>
                    <button onclick="document.querySelector('a[href=\'#storage\']').click()">重试</button>
                </div>
            `;

            // 更新Toast提示为错误
            this.updateToast(loadingToast, `加载失败: ${error.message}`, 'error', 3000);
        } finally {
            // 重置加载状态
            this.isLoadingData = false;
        }
    }

    async loadShareData() {
        const container = document.getElementById('share-items');
        try {
            throw new Error('未来计划预留界面，敬请期待');
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
            container.innerHTML = `
                <div class="error-message">
                    <p>未来计划预留界面，敬请期待</p>
                </div>
            `;
            // console.error('Failed to load share data:', error);
            // container.innerHTML = `
            //     <div class="error-message">
            //         <p>加载数据失败: ${error.message}</p>
            //         <button onclick="document.querySelector('a[href=\'#shares\']').click()">重试</button>
            //     </div>
            // `;
        }
    }

    renderListView(items, container, isReset = false) {
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无数据</div>';
            return;
        }

        // 如果是重置，则清空容器
        if (isReset) {
            container.innerHTML = '';
        }

        // 清除之前的分批渲染计时器
        if (this.batchRenderTimer) {
            clearTimeout(this.batchRenderTimer);
            this.batchRenderTimer = null;
        }

        // 使用requestAnimationFrame确保在下一帧渲染
        requestAnimationFrame(() => {
            // 如果项目数量少，直接渲染
            if (items.length <= this.batchSize) {
                this._renderListItemsBatch(items, container, 0, items.length);
                return;
            }

            // 分批渲染大量项目
            this._renderListItemsBatch(items, container, 0, this.batchSize);
        });
    }

    // 分批渲染列表项目
    _renderListItemsBatch(items, container, startIndex, batchSize) {
        // 计算当前批次的结束索引
        const endIndex = Math.min(startIndex + batchSize, items.length);

        // 创建文档片段来提高性能
        const fragment = document.createDocumentFragment();

        // 预先创建模板元素，减少DOM操作
        const template = document.createElement('template');
        const btnIcon = isMobile() ? '<span style="font-size: 20px; font-weight: bold;">…</span>': '<span style="font-size: 8px; letter-spacing: 1px;">●●●</span>';

        // 渲染当前批次的项目
        for (let i = startIndex; i < endIndex; i++) {
            const item = items[i];
            const fileName = this.getFileName(item);
            const fileIcon = this.getFileTypeIcon(item.type);

            // 使用模板字符串创建元素，减少innerHTML操作
            template.innerHTML = `
                <div class="list-item">
                    <span class="file-name">
                        <span class="file-icon">${fileIcon}</span>
                        ${fileName}
                    </span>
                    <span class="file-size">${this.formatSize(item.len)}</span>
                    <span class="file-time">${this.formatDate(item.time)}</span>
                    <span class="file-actions">
                        <button class="action-btn" title="更多操作" data-fkey="${item.fkey}" data-pwd="${item.pwd}">
                        ${btnIcon}
                        </button>
                    </span>
                </div>
            `;

            // 获取创建的元素
            const listItem = template.content.firstElementChild.cloneNode(true);

            // 使用事件委托减少事件监听器数量
            // 添加数据属性以便于委托处理
            listItem.dataset.fkey = item.fkey;
            listItem.dataset.pwd = item.pwd || '';

            // 添加到文档片段
            fragment.appendChild(listItem);
        }

        // 添加到容器
        container.appendChild(fragment);

        // 使用事件委托添加交互事件
        if (!container.hasListEventListeners) {
            // 双击查看数据
            container.addEventListener('dblclick', (e) => {
                const listItem = e.target.closest('.list-item');
                if (listItem) {
                    const fkey = listItem.dataset.fkey;
                    const pwd = listItem.dataset.pwd;
                    if (fkey) {
                        window.open(`/p/${fkey}/${pwd}`, '_blank', 'noopener');
                    }
                }
            });

            // 右键菜单
            container.addEventListener('contextmenu', (e) => {
                const listItem = e.target.closest('.list-item');
                if (listItem) {
                    e.preventDefault();
                    const fkey = listItem.dataset.fkey;
                    if (fkey) {
                        const item = this.storageItems.find(item => String(item.fkey) === fkey);
                        if (item) {
                            this.showContextMenu(e.clientX, e.clientY, item);
                        }
                    }
                }
            });

            // 长按事件（移动端）
            let longPressTimer;
            let touchedItem = null;

            container.addEventListener('touchstart', (e) => {
                const listItem = e.target.closest('.list-item');
                if (listItem) {
                    touchedItem = listItem;
                    longPressTimer = setTimeout(() => {
                        const fkey = listItem.dataset.fkey;
                        if (fkey) {
                            const item = this.storageItems.find(item => String(item.fkey) === fkey);
                            if (item) {
                                const touch = e.touches[0];
                                this.showContextMenu(touch.clientX, touch.clientY, item);
                            }
                        }
                    }, 500);
                }
            });

            container.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
                touchedItem = null;
            });

            container.addEventListener('touchmove', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    touchedItem = null;
                }
            });

            // 标记容器已添加事件监听器
            container.hasListEventListeners = true;
        }

        // 立即显示所有项目
        const newItems = container.querySelectorAll('.list-item:not(.visible)');
        newItems.forEach(item => {
            item.classList.add('visible');
        });

        // 如果还有更多项目需要渲染，使用requestAnimationFrame安排下一批
        if (endIndex < items.length) {
            this.batchRenderTimer = setTimeout(() => {
                requestAnimationFrame(() => {
                    this._renderListItemsBatch(items, container, endIndex, this.batchSize);
                });
            }, 20); // 增加延迟，给浏览器更多时间处理当前批次
        }
    }

    renderGridView(items, container, isReset = false) {
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无数据</div>';
            return;
        }

        // 如果是重置，则清空容器
        if (isReset) {
            container.innerHTML = '';
        }

        // 使用requestAnimationFrame确保在下一帧渲染
        requestAnimationFrame(() => {
            // 如果项目数量少，直接渲染
            if (items.length <= this.batchSize) {
                this._renderGridItemsBatch(items, container, 0, items.length);
                return;
            }

            // 分批渲染大量项目
            this._renderGridItemsBatch(items, container, 0, this.batchSize);
        });
    }

    // 分批渲染网格项目
    _renderGridItemsBatch(items, container, startIndex, batchSize) {
        // 计算当前批次的结束索引
        const endIndex = Math.min(startIndex + batchSize, items.length);

        // 创建文档片段来提高性能
        const fragment = document.createDocumentFragment();

        // 预先创建模板元素，减少DOM操作
        const template = document.createElement('template');

        // 渲染当前批次的项目
        for (let i = startIndex; i < endIndex; i++) {
            const item = items[i];
            const fileName = this.getFileName(item);
            const fileIcon = this.getFileIcon(item.type);

            // 使用模板字符串创建元素
            template.innerHTML = `
                <div class="grid-item">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-name">${fileName}</div>
                    <div class="file-meta">${this.formatSize(item.len)}</div>
                </div>
            `;

            // 获取创建的元素
            const gridItem = template.content.firstElementChild.cloneNode(true);

            // 使用事件委托减少事件监听器数量
            // 添加数据属性以便于委托处理
            gridItem.dataset.fkey = item.fkey;
            gridItem.dataset.pwd = item.pwd || '';

            // 添加到文档片段
            fragment.appendChild(gridItem);
        }

        // 添加到容器
        container.appendChild(fragment);

        // 使用事件委托添加交互事件
        if (!container.hasGridEventListeners) {
            // 双击打开文件
            container.addEventListener('dblclick', (e) => {
                const gridItem = e.target.closest('.grid-item');
                if (gridItem) {
                    const fkey = gridItem.dataset.fkey;
                    const pwd = gridItem.dataset.pwd;
                    if (fkey) {
                        window.open(`/p/${fkey}/${pwd}`, '_blank', 'noopener');
                    }
                }
            });

            // 右键菜单
            container.addEventListener('contextmenu', (e) => {
                const gridItem = e.target.closest('.grid-item');
                if (gridItem) {
                    e.preventDefault();
                    const fkey = gridItem.dataset.fkey;
                    if (fkey) {
                        const item = this.storageItems.find(item => String(item.fkey) === fkey);
                        if (item) {
                            this.showContextMenu(e.clientX, e.clientY, item);
                        }
                    }
                }
            });

            // 长按事件（移动端）
            let longPressTimer;
            let touchedItem = null;

            container.addEventListener('touchstart', (e) => {
                const gridItem = e.target.closest('.grid-item');
                if (gridItem) {
                    touchedItem = gridItem;
                    longPressTimer = setTimeout(() => {
                        const fkey = gridItem.dataset.fkey;
                        if (fkey) {
                            const item = this.storageItems.find(item => String(item.fkey) === fkey);
                            if (item) {
                                const touch = e.touches[0];
                                this.showContextMenu(touch.clientX, touch.clientY, item);
                            }
                        }
                    }, 500);
                }
            });

            container.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
                touchedItem = null;
            });

            container.addEventListener('touchmove', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    touchedItem = null;
                }
            });

            // 标记容器已添加事件监听器
            container.hasGridEventListeners = true;
        }

        // 立即显示所有项目
        const newItems = container.querySelectorAll('.grid-item:not(.visible)');
        newItems.forEach(item => {
            item.classList.add('visible');
        });

        // 如果还有更多项目需要渲染，使用requestAnimationFrame安排下一批
        if (endIndex < items.length) {
            this.batchRenderTimer = setTimeout(() => {
                requestAnimationFrame(() => {
                    this._renderGridItemsBatch(items, container, endIndex, this.batchSize);
                });
            }, 20); // 增加延迟，给浏览器更多时间处理当前批次
        }
    }

    renderTableView(items, container) {
        if (!items || items.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="empty-message">暂无数据</td></tr>';
            return;
        }

        container.innerHTML = items.map(item => {
            const fileName = this.getFileName(item);
            const fileType = this.getFileType(item.type);
            return `
                <tr>
                    <td>${fileName}</td>
                    <td>${fileType}</td>
                    <td>${this.formatSize(item.len)}</td>
                    <td>${this.formatDate(item.time)}</td>
                    <td>${this.formatDate(item.expire)}</td>
                    <td class="file-actions">
                        <button onclick="window.open('/p/1', '_blank', 'noopener')">查看</button>
                        <button onclick="qbinHome.deleteStorageItem(item.fkey, item.pwd)">删除</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getFileName(item) {
        // 从文件类型和路径生成文件名
        const defaultName = item.fkey || 'Untitled';

        // 如果是文本类型，可以尝试从内容中提取标题
        if (item.type && item.type.startsWith('text/')) {
            return defaultName;
        }

        return defaultName;
    }

    getFileType(mimeType) {
        // 根据MIME类型返回可读的文件类型
        if (!mimeType) return '未知类型';

        const mimeMap = {
            'text/plain': '文本文件',
            'text/html': 'HTML文件',
            'text/css': 'CSS文件',
            'text/javascript': 'JavaScript文件',
            'application/json': 'JSON文件',
            'application/xml': 'XML文件',
            'application/pdf': 'PDF文件',
            'image/jpeg': '图片',
            'image/png': '图片',
            'image/gif': '图片',
            'image/svg+xml': 'SVG图片',
            'video/mp4': '视频',
            'audio/mpeg': '音频',
            'application/zip': '压缩文件',
            'application/x-tar': '压缩文件',
            'application/x-gzip': '压缩文件'
        };

        // 先尝试精确匹配
        if (mimeMap[mimeType]) {
            return mimeMap[mimeType];
        }

        // 再尝试模糊匹配
        for (const [key, value] of Object.entries(mimeMap)) {
            if (mimeType.startsWith(key.split('/')[0] + '/')) {
                return value;
            }
        }

        return mimeType;
    }

    getFileIcon(mimeType) {
        // 根据MIME类型返回适当的图标
        if (!mimeType) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
        }

        // 文本类型
        if (mimeType.startsWith('text/')) {
            if (mimeType === 'text/html') {
                return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>';
            }
            return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>';
        }

        // 图片类型
        if (mimeType.startsWith('image/')) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
        }

        // 视频类型
        if (mimeType.startsWith('video/')) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>';
        }

        // 音频类型
        if (mimeType.startsWith('audio/')) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>';
        }

        // 压缩文件
        if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('compressed')) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>';
        }

        // 默认图标
        return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
    }

    getFileTypeIcon(mimeType) {
        // 返回小图标用于列表视图
        if (!mimeType) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
        }

        // 文本类型
        if (mimeType.startsWith('text/')) {
            if (mimeType === 'text/html') {
                return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>';
            }
            return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>';
        }

        // 图片类型
        if (mimeType.startsWith('image/')) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
        }

        // 视频类型
        if (mimeType.startsWith('video/')) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
        }

        // 音频类型
        if (mimeType.startsWith('audio/')) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
        }

        // 压缩文件
        if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('compressed')) {
            return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>';
        }

        // 默认图标
        return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>';
    }

    async deleteStorageItem(fkey, pwd) {
        if (!fkey) return;
        if (!confirm('确定要永久删除该数据吗？')) {
            return;
        }
        try {
            const response = await fetch(`/d/${fkey}/${pwd}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 200) {
                // 从本地数据中移除被删除的项
                const itemIndex = this.storageItems.findIndex(item => String(item.fkey) === String(fkey));
                if (itemIndex !== -1) {
                    // 从数组中移除该项
                    this.storageItems.splice(itemIndex, 1);
                    
                    // 获取当前视图的容器
                    const containerMap = {
                        list: 'list-items',
                        grid: 'grid-items'
                    };
                    
                    const container = document.getElementById(containerMap[this.currentView]);
                    if (container) {
                        // 优化方案1: 快速直接地删除对应的DOM元素，避免整个视图重渲染
                        if (this.currentView === 'list') {
                            const itemToRemove = container.querySelector(`.list-item[data-fkey="${fkey}"]`);
                            if (itemToRemove) {
                                // 添加淡出动画
                                itemToRemove.classList.add('deleting');
                                // 等待动画完成后删除DOM元素
                                setTimeout(() => {
                                    container.removeChild(itemToRemove);
                                    // 检查是否需要显示空状态
                                    if (this.storageItems.length === 0) {
                                        container.innerHTML = '<div class="empty-message">暂无数据</div>';
                                    }
                                }, 300);
                            } else {
                                // 如果找不到元素（极少情况），则重新渲染整个视图
                                container.innerHTML = ''; // 完全清空容器
                                this.renderSimpleListView(this.storageItems, container);
                            }
                        } else { // grid view
                            const itemToRemove = container.querySelector(`.grid-item[data-fkey="${fkey}"]`);
                            if (itemToRemove) {
                                // 添加淡出动画
                                itemToRemove.classList.add('deleting');
                                // 等待动画完成后删除DOM元素
                                setTimeout(() => {
                                    container.removeChild(itemToRemove);
                                    // 检查是否需要显示空状态
                                    if (this.storageItems.length === 0) {
                                        container.innerHTML = '<div class="empty-message">暂无数据</div>';
                                    }
                                }, 300);
                            } else {
                                // 如果找不到元素（极少情况），则重新渲染整个视图
                                container.innerHTML = ''; // 完全清空容器
                                this.renderSimpleGridView(this.storageItems, container);
                            }
                        }
                    }
                }
                
                this.showToast('删除成功');
            } else {
                throw new Error(result.message || '删除失败');
            }
        } catch (error) {
            console.error('Failed to delete item:', error);
            this.showToast(`删除失败: ${error.message}`, 'error');
        }
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
        const editorRadios = document.querySelectorAll('input[name="qbin-editor"]');
        const themeRadios = document.querySelectorAll('input[name="qbin-theme"]');

        // 设置默认编辑器选择
        const savedEditor = getCookie('qbin-editor') || 'e';
        document.querySelector(`input[name="qbin-editor"][value="${savedEditor}"]`).checked = true;
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

                        document.cookie = `qbin-editor=${selectedEditor}; path=/; max-age=31536000; SameSite=Lax`;
                        storage.setCache('qbin-editor', selectedEditor, -1).catch(error => {});
                        // 更新视觉反馈
                        this.updateEditorRadioVisualFeedback(selectedEditor);
                        // 显示成功提示
                        this.showToast(`${selectedEditor === 'e' ? '通用编辑器' : selectedEditor === 'm' ? 'Markdown编辑器' : '代码编辑器'}已设置`);
                    } catch (error) {
                        console.error('设置默认编辑器失败:', error);

                        // 发生错误时恢复原来的选择
                        const originalEditor = getCookie('qbin-editor') || 'e';
                        document.querySelector(`input[name="qbin-editor"][value="${originalEditor}"]`).checked = true;
                        this.updateEditorRadioVisualFeedback(originalEditor);

                        // 显示错误提示
                        this.showToast('设置默认编辑器失败，请重试', 'error');
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
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
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
        this.updateRadioVisualFeedback('qbin-editor', editorValue, 'active-editor');
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
            if (response.ok || response.status === 302) {
                window.location.assign('/login');
            } else {
                console.error('Logout failed:', await response.text());
                alert('退出登录失败，请稍后再试');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('退出登录出错，请稍后再试');
        }
    }

    showToast(message, type = 'success', duration = 3000, id = null) {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        if (id) {
            const existingToast = document.getElementById(id);
            if (existingToast) {
                // 更新已存在的toast
                existingToast.textContent = message;
                existingToast.className = `toast ${type}`;
                if (type === 'loading') {
                    existingToast.innerHTML = `${message}`;
                }
                return existingToast;
            }
        }

        // 创建新的提示元素
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        if (id) toast.id = id;

        // 如果是加载状态，不需要自动消失
        if (type === 'loading') {
            toast.innerHTML = `${message}`;
            duration = 0; // 加载状态不自动消失
        } else {
            toast.textContent = message;
        }

        // 添加到容器
        toastContainer.appendChild(toast);

        // 如果设置了持续时间，则自动消失
        if (duration > 0) {
            setTimeout(() => {
                this.hideToast(toast);
            }, duration);
        }

        return toast;
    }

    hideToast(toast) {
        if (!toast) return;

        toast.classList.add('hide');
        setTimeout(() => {
            const toastContainer = document.getElementById('toast-container');
            if (toastContainer && toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
                // 如果没有更多提示，移除容器
                if (toastContainer.children.length === 0) {
                    document.body.removeChild(toastContainer);
                }
            }
        }, 300);
    }

    updateToast(toast, message, type = 'success', duration = 3000) {
        if (!toast) return;

        toast.className = `toast ${type}`;

        if (type === 'loading') {
            toast.innerHTML = `${message}`;
            return toast;
        } else {
            toast.textContent = message;
        }

        // 如果设置了持续时间，则自动消失
        if (duration > 0) {
            setTimeout(() => {
                this.hideToast(toast);
            }, duration);
        }

        return toast;
    }

    // 通用的复制到剪贴板方法，兼容移动端和桌面端
    copyToClipboard(text) {
        // 尝试使用现代Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => this.showToast('链接已复制到剪贴板'))
                .catch(() => {
                    // 如果Clipboard API失败，回退到备用方法
                    this.fallbackCopyToClipboard(text);
                });
        } else {
            // 对于不支持Clipboard API的设备或非安全上下文，使用备用方法
            console.log("回退方案")
            this.fallbackCopyToClipboard(text);
        }
    }

    // 备用的复制到剪贴板方法
    fallbackCopyToClipboard(text) {
        try {
            // 创建一个临时的文本区域元素
            const textArea = document.createElement('textarea');
            
            // 设置文本区域的样式，使其不可见
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            textArea.style.padding = '0';
            textArea.style.border = 'none';
            textArea.style.outline = 'none';
            textArea.style.boxShadow = 'none';
            textArea.style.background = 'transparent';
            textArea.style.opacity = '0';
            
            // 设置文本内容
            textArea.value = text;
            
            // 将文本区域添加到DOM
            document.body.appendChild(textArea);
            
            // 选择文本
            textArea.select();
            textArea.setSelectionRange(0, 99999); // 适用于移动设备
            
            // 尝试执行复制命令
            const successful = document.execCommand('copy');
            
            // 移除临时文本区域
            document.body.removeChild(textArea);
            
            // 根据复制操作的结果显示提示
            if (successful) {
                this.showToast('链接已复制到剪贴板');
            } else {
                // 如果execCommand失败，尝试提供链接给用户手动复制
                this.showShareableLink(text);
            }
        } catch (err) {
            console.error('复制到剪贴板失败:', err);
            // 如果发生异常，提供链接给用户手动复制
            this.showShareableLink(text);
        }
    }

    // 当自动复制失败时，显示一个可分享链接给用户手动复制
    showShareableLink(link) {
        // 创建一个模态对话框，显示链接并允许用户手动复制
        const modal = document.createElement('div');
        modal.className = 'share-modal';
        modal.innerHTML = `
            <div class="share-content">
                <h3>分享链接</h3>
                <p>请手动复制以下链接:</p>
                <div class="link-container">
                    <input type="text" value="${link}" readonly id="manual-copy-link">
                    <button id="manual-copy-btn">复制</button>
                </div>
                <button class="close-btn">关闭</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 链接输入框获得焦点并全选
        const linkInput = document.getElementById('manual-copy-link');
        linkInput.focus();
        linkInput.select();
        
        // 添加复制按钮事件
        const copyBtn = document.getElementById('manual-copy-btn');
        copyBtn.addEventListener('click', () => {
            linkInput.select();
            document.execCommand('copy');
            this.showToast('链接已复制');
        });
        
        // 添加关闭按钮事件
        const closeBtn = modal.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
}

const qbinHome = new QBinHome();