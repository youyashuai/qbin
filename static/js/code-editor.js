class Qbin {
    constructor() {
        this.currentPath = this.parsePath(window.location.pathname), this.CACHE_KEY = "qbin/", this.isUploading = !1, this.lastUploadedHash = "", this.autoUploadTimer = null, this.emoji = {
            online: "☁️",
            inline: "☁",
            no: "⊘"
        }, this.status = this.emoji.online, this.editor = null, this.initMonacoEditor().then(() => {
            if (this.loadContent().then(() => {
            }), this.currentPath.key.length < 2) {
                const e = API.generateKey(6);
                this.updateURL(e, this.currentPath.pwd, "")
            }
            this.initializeUI(), this.setupAutoSave(), this.initializePasswordPanel(), this.initializeKeyAndPasswordSync()
        })
    }

    async initMonacoEditor() {
        return new Promise(e => {
            require.config({paths: {vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs"}}), require(["vs/editor/editor.main"], () => {
                this.setupEditorThemes(), this.editor = monaco.editor.create(document.getElementById("editor"), {
                    value: "",
                    language: "plaintext",
                    automaticLayout: !0,
                    theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "qbin-dark" : "qbin-light",
                    minimap: {enabled: window.innerWidth > 768},
                    scrollBeyondLastLine: !1,
                    fontSize: window.innerWidth <= 768 ? 16 : 14,
                    lineNumbers: "on",
                    wordWrap: "on",
                    padding: {top: 20, bottom: 20},
                    renderLineHighlight: "all",
                    smoothScrolling: !0,
                    cursorBlinking: "smooth",
                    cursorSmoothCaretAnimation: !0,
                    fixedOverflowWidgets: !0,
                    contextmenu: !0,
                    scrollbar: {
                        verticalScrollbarSize: window.innerWidth <= 768 ? 10 : 8,
                        horizontalScrollbarSize: window.innerWidth <= 768 ? 10 : 8,
                        vertical: "visible",
                        horizontal: "visible",
                        verticalHasArrows: !1,
                        horizontalHasArrows: !1,
                        useShadows: !0,
                        alwaysConsumeMouseWheel: !1
                    },
                    domReadOnly: !1,
                    readOnly: !1,
                    formatOnPaste: !1,
                    formatOnType: !1
                }), this.initLanguageSelector(), window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
                    this.editor.updateOptions({theme: e.matches ? "qbin-dark" : "qbin-light"})
                }), this.editor.onDidChangeModelContent(() => {
                    clearTimeout(this.saveTimeout), this.saveTimeout = setTimeout(() => {
                        this.saveToLocalCache()
                    }, 1e3), clearTimeout(this.autoUploadTimer), this.autoUploadTimer = setTimeout(() => {
                        const e = this.editor.getValue();
                        if (e.trim() && cyrb53(e) !== this.lastUploadedHash) {
                            const t = document.getElementById("language-select").value, r = this.getMimeTypeFromLang(t);
                            this.handleUpload(e, r)
                        }
                    }, 2e3)
                }), this.editor.onDidFocusEditorText(() => {
                    document.body.classList.add("editor-focused")
                }), this.editor.onDidBlurEditorText(() => {
                    document.body.classList.remove("editor-focused")
                }), e()
            })
        })
    }

    getMimeTypeFromLang(e) {
        return {
            html: "text/html; charset=UTF-8",
            css: "text/css; charset=UTF-8",
            javascript: "text/javascript; charset=UTF-8"
        }[e.toLowerCase()] || "text/plain; charset=UTF-8"
    }

    setupEditorThemes() {
        monaco.editor.defineTheme("qbin-light", {
            base: "vs",
            inherit: !0,
            rules: [],
            colors: {
                "editor.background": "#FAFBFC",
                "editor.foreground": "#2c3e50",
                "editor.lineHighlightBackground": "#f1f8ff55",
                "editorCursor.foreground": "#1890ff",
                "editorLineNumber.foreground": "#999999",
                "editorLineNumber.activeForeground": "#555555",
                "editor.selectionBackground": "#c9d8f5",
                "editor.inactiveSelectionBackground": "#e0e0e0",
                "editorWidget.background": "#f5f5f5",
                "editorWidget.border": "#e0e0e0",
                "scrollbarSlider.background": "rgba(0, 0, 0, 0.2)",
                "scrollbarSlider.hoverBackground": "rgba(0, 0, 0, 0.3)",
                "scrollbarSlider.activeBackground": "rgba(0, 0, 0, 0.4)"
            }
        }), monaco.editor.defineTheme("qbin-dark", {
            base: "vs-dark",
            inherit: !0,
            rules: [],
            colors: {
                "editor.background": "#242424",
                "editor.foreground": "#e0e0e0",
                "editor.lineHighlightBackground": "#ffffff10",
                "editorCursor.foreground": "#1890ff",
                "editorLineNumber.foreground": "#aaaaaa",
                "editorLineNumber.activeForeground": "#dddddd",
                "editor.selectionBackground": "#264f78",
                "editor.inactiveSelectionBackground": "#3a3d41",
                "editorWidget.background": "#333333",
                "editorWidget.border": "#464646",
                "scrollbarSlider.background": "rgba(255, 255, 255, 0.2)",
                "scrollbarSlider.hoverBackground": "rgba(255, 255, 255, 0.3)",
                "scrollbarSlider.activeBackground": "rgba(255, 255, 255, 0.4)"
            }
        })
    }

    saveToLocalCache(e = !1) {
        const t = this.editor.getValue();
        if (e || t.trim() && cyrb53(t) !== this.lastUploadedHash) {
            const e = {content: t, timestamp: getTimestamp(), path: this.currentPath.key, hash: cyrb53(t)};
            storage.setCache(this.CACHE_KEY + this.currentPath.key, e)
        }
    }

    async loadFromLocalCache(e) {
        try {
            const t = await storage.getCache(this.CACHE_KEY + (e || this.currentPath.key));
            if (t) {
                const r = this.parsePath(window.location.pathname), s = r.key.length < 2 || e, i = r.key === t.path;
                if (s || i) return this.status = this.emoji.inline, this.editor.setValue(t.content), this.lastUploadedHash = cyrb53(t.content), [!0, t.timestamp]
            }
            return [!1, 0]
        } catch (e) {
            return console.error("加载缓存失败:", e), [!1, 0]
        }
    }

    initializeUI() {
        /iPad|iPhone|iPod/.test(navigator.userAgent) && window.visualViewport.addEventListener("resize", () => {
        })
    }

    setupAutoSave() {
        window.addEventListener("beforeunload", () => {
            this.saveToLocalCache()
        })
    }

    async loadContent() {
        const {key: e, pwd: t, render: r} = this.currentPath;
        if (e.length > 1) {
            const [s, i] = await this.loadFromLocalCache();
            this.updateURL(e, t, "replaceState"), document.querySelector(".key-watermark").textContent = `${this.status} ${this.currentPath.key}`, "e" === r && getTimestamp() - i > 5 && (await this.loadOnlineCache(e, t, s), document.querySelector(".key-watermark").textContent = `${this.status} ${this.currentPath.key}`)
        } else {
            const e = JSON.parse(sessionStorage.getItem("qbin/last") || '{"key": null}');
            if (!e.key) return null;
            await this.loadFromLocalCache(e.key), this.updateURL(e.key, e.pwd, "replaceState"), document.getElementById("key-input").value = e.key.trim() || "", document.getElementById("password-input").value = e.pwd.trim() || "", document.querySelector(".key-watermark").textContent = `${this.status} ${this.currentPath.key}`, sessionStorage.removeItem("qbin/last")
        }
    }

    async loadOnlineCache(e, t, r, s = !0) {
        if (!this.isUploading) try {
            this.isUploading = !0, this.updateUploadStatus("数据加载中…");
            let i = "";
            const {status: a, content: o} = await API.getContent(e, t);
            return !(!o && 200 !== a && 404 !== a) && (this.lastUploadedHash = cyrb53(o || ""), 404 === a ? (this.status = this.emoji.online, this.saveToLocalCache(!0), i = "这是可用的KEY") : r && this.lastUploadedHash !== cyrb53(editor.value) ? await this.showConfirmDialog("检测到本地缓存与服务器数据不一致，您想使用哪个版本？\n\n" + "• 本地版本：保留当前编辑器中的内容\n" + "• 服务器版本：加载服务器上的最新内容") && (this.status = this.emoji.online, editor.value = o, this.saveToLocalCache(!0), i = "远程数据加载成功") : (this.status = this.emoji.online, editor.value = o || "", this.saveToLocalCache(!0), i = "数据加载成功"), this.updateUploadStatus(i || "数据加载成功", "success"), !0)
        } catch (e) {
            s = !1, this.updateUploadStatus("数据加载失败：" + e.message), console.error(e)
        } finally {
            this.isUploading = !1, setTimeout(() => {
                this.updateUploadStatus("")
            }, s ? 2e3 : 5e3)
        }
    }

    showConfirmDialog(e) {
        return new Promise(t => {
            const r = document.querySelector(".confirm-overlay"), s = document.querySelector(".confirm-dialog");
            s.querySelector(".confirm-dialog-content").textContent = e;
            const i = () => {
                r.classList.remove("active"), s.classList.remove("active")
            }, a = e => {
                const c = e.target.closest(".confirm-button");
                if (!c) return;
                const d = c.dataset.action;
                i(), s.removeEventListener("click", a), r.removeEventListener("click", o), document.removeEventListener("keydown", n), t("confirm" === d)
            }, o = () => {
                i(), t(!1)
            }, n = e => {
                "Escape" === e.key ? (i(), t(!1)) : "Enter" === e.key && (i(), t(!0))
            };
            s.addEventListener("click", a), r.addEventListener("click", o), document.addEventListener("keydown", n), r.classList.add("active"), s.classList.add("active")
        })
    }

    async handleUpload(e, t, r = !0) {
        if (!this.isUploading && e) {
            this.updateUploadStatus("保存中…", "loading");
            try {
                this.isUploading = !0;
                const s = document.getElementById("key-input"), i = document.getElementById("password-input");
                let a = this.currentPath.key || s.value.trim() || API.generateKey(6);
                const o = this.currentPath.key === a ? "replaceState" : "pushState", n = i.value.trim(), c = cyrb53(e);
                await API.uploadContent(e, a, n, t) && (this.lastUploadedHash = c, this.status = this.emoji.online, this.updateUploadStatus("内容保存成功", "success"), this.updateURL(a, n, o), document.querySelector(".key-watermark").textContent = `${this.status} ${this.currentPath.key}`)
            } catch (e) {
                r = !1;
                let t = "保存失败";
                t = e.message.includes("size") ? "内容大小超出限制" : e.message.includes("network") || e.message.includes("connect") ? "网络连接失败，请检查网络" : `保存失败: ${e.message}`, this.updateUploadStatus(t, "error"), this.status = this.emoji.no, document.querySelector(".key-watermark").textContent = `${this.status} ${this.currentPath.key}`, console.error(e)
            } finally {
                this.isUploading = !1, setTimeout(() => {
                    this.updateUploadStatus("")
                }, r ? 2e3 : 5e3)
            }
        }
    }

    updateUploadStatus(e, t) {
        const r = document.getElementById("upload-status");
        if (r) {
            if (!e) return r.textContent = "", void r.classList.remove("visible");
            r.removeAttribute("data-status"), e.includes("成功") ? r.setAttribute("data-status", "success") : e.includes("失败") ? r.setAttribute("data-status", "error") : (e.includes("加载"), r.setAttribute("data-status", "info")), r.textContent = e, requestAnimationFrame(() => {
                r.classList.add("visible")
            })
        }
    }

    initializePasswordPanel() {
        const e = document.querySelector(".bookmark"), t = document.querySelector(".password-panel");
        let r = !1, s = null, i = null;
        const a = document.getElementById("encrypt-checkbox"), o = document.getElementById("encryptData"),
            n = document.querySelector(".option-toggle"),
            c = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768,
            d = () => {
                clearTimeout(i), t.classList.add("active")
            }, l = () => {
                r || (t.classList.remove("active"), t.style.transform = "")
            };
        if (c()) {
            let r, s;
            e.style.cursor = "pointer";
            let i = !1;
            e.addEventListener("touchstart", e => {
                r = getTimestamp(), s = e.touches[0].clientY, i = !1
            }, {passive: !0}), e.addEventListener("touchmove", e => {
                Math.abs(e.touches[0].clientY - s) > 10 && (i = !0)
            }, {passive: !0}), e.addEventListener("touchend", e => {
                const s = getTimestamp() - r;
                !i && s < 250 && (e.preventDefault(), t.classList.contains("active") ? l() : d())
            }), document.addEventListener("click", r => {
                t.classList.contains("active") && !t.contains(r.target) && !e.contains(r.target) && l()
            }, !0);
            let a = 0, o = 0;
            t.addEventListener("touchstart", e => {
                (e.target === t || e.target.closest(".password-panel-title")) && (a = e.touches[0].clientY, o = a)
            }, {passive: !0}), t.addEventListener("touchmove", e => {
                if (0 !== a) {
                    const r = (o = e.touches[0].clientY) - a;
                    r > 0 && (e.preventDefault(), t.style.transform = `translateY(${r}px)`, t.style.transition = "none")
                }
            }, {passive: !1}), t.addEventListener("touchend", () => {
                if (0 !== a) {
                    const e = o - a;
                    t.style.transition = "all 0.3s ease", e > 50 ? l() : t.style.transform = "", a = 0
                }
            })
        } else e.addEventListener("mouseenter", () => {
            clearTimeout(i), s = setTimeout(d, 100)
        }), e.addEventListener("mouseleave", () => {
            clearTimeout(s), i = setTimeout(l, 500)
        }), t.addEventListener("mouseenter", () => {
            clearTimeout(i), clearTimeout(s)
        }), t.addEventListener("mouseleave", () => {
            r || (i = setTimeout(l, 500))
        });
        t.querySelectorAll("input, select").forEach(e => {
            e.addEventListener("focus", () => {
                r = !0, clearTimeout(i)
            }), e.addEventListener("blur", () => {
                r = !1, c() || t.matches(":hover") || (i = setTimeout(l, 800))
            })
        }), document.addEventListener("keydown", e => {
            "Escape" === e.key && t.classList.contains("active") && l()
        }), n.addEventListener("click", function () {
            a.classList.contains("checked") ? (a.classList.remove("checked"), o.checked = !1) : (a.classList.add("checked"), o.checked = !0)
        }), o.checked && a.classList.add("checked"), document.getElementById("preview-button").addEventListener("click", () => {
            const e = this.currentPath.key, t = this.currentPath.pwd;
            e && (this.saveToLocalCache(!0), sessionStorage.setItem("qbin/last", JSON.stringify({
                key: e,
                pwd: t,
                timestamp: getTimestamp()
            })), window.location.href = `/p/${e}/${t}`)
        }), document.getElementById("edit-button").addEventListener("click", () => {
            const e = this.currentPath.key, t = this.currentPath.pwd;
            e && (this.saveToLocalCache(!0), sessionStorage.setItem("qbin/last", JSON.stringify({
                key: e,
                pwd: t,
                timestamp: getTimestamp()
            })), window.location.href = `/e/${e}/${t}`)
        }), document.getElementById("md-button").addEventListener("click", () => {
            const e = this.currentPath.key, t = this.currentPath.pwd;
            e && (this.saveToLocalCache(!0), sessionStorage.setItem("qbin/last", JSON.stringify({
                key: e,
                pwd: t,
                timestamp: getTimestamp()
            })), window.location.href = `/m/${e}/${t}`)
        });
        const h = () => {
            t.scrollHeight > t.clientHeight ? t.classList.add("can-scroll") : t.classList.remove("can-scroll")
        };
        new MutationObserver(e => {
            e.forEach(e => {
                "class" === e.attributeName && t.classList.contains("active") && setTimeout(h, 50)
            })
        }).observe(t, {attributes: !0}), window.addEventListener("resize", () => {
            t.classList.contains("active") && h()
        }), t.addEventListener("scroll", () => {
            const e = document.querySelector(".scroll-indicator");
            e && (t.scrollTop > 10 ? e.style.opacity = "0" : e.style.opacity = "1")
        })
    }

    initializeKeyAndPasswordSync() {
        const e = document.getElementById("key-input"), t = document.getElementById("password-input"),
            r = document.querySelector(".key-watermark");
        e.value = this.currentPath.key, t.value = this.currentPath.pwd, r.textContent = `${this.status} ${this.currentPath.key}`;
        const s = () => {
            const s = e.value.trim(), i = t.value.trim();
            s.length >= 2 && this.updateURL(s, i, "replaceState"), r.textContent = `${this.emoji.inline} ${this.currentPath.key}`
        };
        e.addEventListener("input", s), t.addEventListener("input", s)
    }

    updateURL(e, t, r = "replaceState") {
        if (e && e.length < 2) return;
        const {render: s} = this.parsePath(window.location.pathname);
        ["e", "p"].includes(s), this.currentPath = {
            render: s,
            key: e,
            pwd: t
        }, window.history[r] || console.error(`Invalid history action: ${r}`)
    }

    parsePath(e) {
        const t = e.split("/").filter(Boolean);
        let r = {key: "", pwd: "", render: ""};
        return 0 === t.length ? r : (1 === t[0].length ? (r.key = t[1] || "", r.pwd = t[2] || "", r.render = t[0]) : (r.key = t[0] || "", r.pwd = t[1] || "", r.render = ""), r)
    }

    debounce(e, t) {
        return clearTimeout(this.debounceTimeout), new Promise(r => {
            this.debounceTimeout = setTimeout(() => {
                r(e())
            }, t)
        })
    }

    initLanguageSelector() {
        const e = document.getElementById("language-select");
        e.value = this.editor.getModel().getLanguageId(), e.addEventListener("change", () => {
            const t = e.value;
            monaco.editor.setModelLanguage(this.editor.getModel(), t), localStorage.setItem("qbin_language_preference", t)
        });
        const t = localStorage.getItem("qbin_language_preference");
        t && (e.value = t, monaco.editor.setModelLanguage(this.editor.getModel(), t))
    }
}

const API = {
    generateKey(e = 10) {
        const t = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
        return Array.from({length: e}, () => t.charAt(Math.floor(Math.random() * t.length))).join("")
    },
    async handleAPIError(e) {
        if (e.headers.get("Content-Type").includes("application/json")) try {
            return (await e.json()).message || "请求失败"
        } catch (t) {
            return this.getErrorMessageByStatus(e.status)
        }
        return this.getErrorMessageByStatus(e.status)
    },
    getErrorMessageByStatus: e => e >= 500 ? "服务器出错，请稍后重试" : 404 === e ? "请求的资源不存在" : 403 === e ? "无访问权限" : 401 === e ? "未授权访问" : 400 === e ? "请求参数错误" : "请求失败",
    async getContent(e, t) {
        try {
            const r = await this.fetchWithCache(`/r/${e}/${t}`);
            if (!r.ok && 404 !== r.status) {
                const e = await this.handleAPIError(r);
                throw new Error(e)
            }
            const s = r.headers.get("Content-Type") || "";
            if (!s.startsWith("text/") && !s.includes("json") && !s.includes("javascript") && !contentTy / pe.includes("xml")) throw new Error("不支持的文件类型");
            return {status: r.status, content: await r.text()}
        } catch (e) {
            throw console.error("获取数据失败:", e), e
        }
    },
    async uploadContent(e, t, r = "", s = "text/plain; charset=UTF-8") {
        const i = document.querySelector(".expiry-select");
        try {
            const a = 5 * 1024 * 1024, o = s.includes("text/") ? "POST" : "PUT", n = e;
            let c = {"x-expire": i.options[i.selectedIndex].value, "Content-Type": s};
            if (e.size > a) throw new Error(["上传内容超出", a / 1024 / 1024, "MB限制"].join(""));
            const d = await fetch(`/s/${t}/${r}`, {method: o, body: n, headers: c});
            if (!d.ok) {
                const e = await this.handleAPIError(d);
                throw new Error(e)
            }
            return "success" === (await d.json()).status
        } catch (e) {
            throw console.error("上传失败:", e), e
        }
    },
    async fetchWithCache(e) {
        try {
            const t = await caches.open("qbin-cache-v1"), r = await t.match(e), s = new Headers;
            if (r) {
                const e = r.headers.get("ETag"), t = r.headers.get("Last-Modified");
                e && s.set("If-None-Match", e), t && s.set("If-Modified-Since", t)
            }
            const i = await fetch(e, {headers: s, credentials: "include"});
            return 304 === i.status && r ? r : i.ok ? (await t.put(e, i.clone()), i) : (i.ok || await t.delete(e), i)
        } catch (r) {
            const s = await t.match(e);
            if (s) return s;
            throw r
        }
    }
};

class StorageManager {
    constructor(e = "qbin", t = 2) {
        this.dbName = e, this.version = t, this.storeName = "qbin", this.db = null, this.indexedDB = this._getIndexedDB()
    }

    _getIndexedDB() {
        const e = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        if (!e) throw new Error("当前浏览器不支持 IndexedDB");
        return e
    }

    _handleError(e) {
        throw console.error("数据库操作错误:", e), new Error(`数据库操作失败: ${e.message}`)
    }

    _getTransaction(e = "readonly") {
        if (!this.db) throw new Error("数据库未初始化");
        try {
            return this.db.transaction([this.storeName], e)
        } catch (e) {
            this._handleError(e)
        }
    }

    async initialize() {
        if (!this.db) try {
            return new Promise((e, t) => {
                const r = this.indexedDB.open(this.dbName, this.version);
                r.onerror = (() => {
                    this._handleError(r.error), t(r.error)
                }), r.onblocked = (() => {
                    const e = new Error("数据库被阻塞，可能存在其他连接");
                    this._handleError(e), t(e)
                }), r.onsuccess = (() => {
                    this.db = r.result, this.db.onerror = (e => {
                        this._handleError(e.target.error)
                    }), e()
                }), r.onupgradeneeded = (e => {
                    const t = e.target.result;
                    t.objectStoreNames.contains(this.storeName) || t.createObjectStore(this.storeName, {keyPath: "key"}).createIndex("timestamp", "timestamp", {unique: !1})
                })
            })
        } catch (e) {
            this._handleError(e)
        }
    }

    async setCache(e, t, r = 86400 * 7, s = 3) {
        let i = 0;
        for (; i < s;) try {
            return await this.initialize(), new Promise((s, i) => {
                const a = this._getTransaction("readwrite"), o = a.objectStore(this.storeName),
                    n = {key: e, value: t, timestamp: getTimestamp(), exipre: r}, c = o.put(n);
                c.onerror = (() => i(c.error)), c.onsuccess = (() => s(!0)), a.oncomplete = (() => s(!0)), a.onerror = (() => i(a.error))
            })
        } catch (e) {
            ++i === s && this._handleError(e), await new Promise(e => setTimeout(e, 1e3))
        }
    }

    async getCache(e) {
        try {
            return await this.initialize(), new Promise((t, r) => {
                const s = this._getTransaction("readonly").objectStore(this.storeName).get(e);
                s.onerror = (() => r(s.error)), s.onsuccess = (() => {
                    t(s.result ? s.result.value : null)
                })
            })
        } catch (e) {
            this._handleError(e)
        }
    }

    async removeCache(e, t = {silent: !1}) {
        try {
            if (await this.initialize(), !await this.getCache(e) && !t.silent) throw new Error(`Cache key '${e}' not found`);
            return new Promise((t, r) => {
                const s = this._getTransaction("readwrite"), i = s.objectStore(this.storeName).delete({key: e});
                i.onerror = (() => {
                    r(i.error)
                }), s.oncomplete = (() => {
                    t(!0)
                }), s.onerror = (e => {
                    r(new Error(`Failed to remove cache: ${e.target.error}`))
                }), s.onabort = (e => {
                    r(new Error(`Transaction aborted: ${e.target.error}`))
                })
            })
        } catch (e) {
            return t.silent || this._handleError(e), !1
        }
    }

    async removeCacheMultiple(e, t = {continueOnError: !0}) {
        try {
            await this.initialize();
            const r = {success: [], failed: []};
            for (const s of e) try {
                await this.removeCache(s, {silent: !0}), r.success.push(s)
            } catch (e) {
                if (r.failed.push({key: s, error: e.message}), !t.continueOnError) throw e
            }
            return r
        } catch (e) {
            this._handleError(e)
        }
    }

    async getAllCacheKeys(e = {sorted: !1, filter: null, limit: null, offset: 0}) {
        try {
            return await this.initialize(), new Promise((t, r) => {
                const s = this._getTransaction("readonly"), i = s.objectStore(this.storeName).getAll();
                i.onerror = (() => r(i.error)), i.onsuccess = (() => {
                    let r = i.result.map(e => ({key: e.key, timestamp: e.timestamp}));
                    if (e.filter && "function" == typeof e.filter && (r = r.filter(e.filter)), e.sorted && r.sort((e, t) => t.timestamp - e.timestamp), e.offset || e.limit) {
                        const t = e.offset || 0, s = e.limit ? t + e.limit : void 0;
                        r = r.slice(t, s)
                    }
                    t(r.map(e => e.key))
                }), s.onerror = (e => {
                    r(new Error(`Failed to get cache keys: ${e.target.error}`))
                })
            })
        } catch (e) {
            this._handleError(e)
        }
    }

    async getCacheStats() {
        try {
            return await this.initialize(), new Promise((e, t) => {
                const r = this._getTransaction("readonly"), s = r.objectStore(this.storeName), i = s.count(),
                    a = s.getAll();
                let o = 0, n = 0, c = getTimestamp(), d = 0;
                i.onsuccess = (() => {
                    o = i.result
                }), a.onsuccess = (() => {
                    const t = a.result;
                    n = new Blob([JSON.stringify(t)]).size, t.forEach(e => {
                        c = Math.min(c, e.timestamp), d = Math.max(d, e.timestamp)
                    }), e({
                        count: o,
                        totalSize: n,
                        oldestTimestamp: o > 0 ? c : null,
                        newestTimestamp: o > 0 ? d : null,
                        averageSize: o > 0 ? Math.round(n / o) : 0
                    })
                }), r.onerror = (e => {
                    t(new Error(`Failed to get cache stats: ${e.target.error}`))
                })
            })
        } catch (e) {
            this._handleError(e)
        }
    }

    async clearExpiredCache(e = 100) {
        try {
            await this.initialize();
            const t = getTimestamp();
            return new Promise((r, s) => {
                const i = this._getTransaction("readwrite").objectStore(this.storeName).index("timestamp");
                let a = 0;
                const o = () => {
                    const n = i.openCursor();
                    let c = 0;
                    n.onerror = (() => s(n.error)), n.onsuccess = (s => {
                        const i = s.target.result;
                        i && c < e ? (t - i.value.timestamp > i.value.exipre && (i.delete(), a++), c++, i.continue()) : c === e ? setTimeout(o, 0) : r(a)
                    })
                };
                o()
            })
        } catch (e) {
            this._handleError(e)
        }
    }
}

const storage = new StorageManager;
new Qbin;
const getTimestamp = () => Math.floor(Date.now() / 1e3);

function cyrb53(e, t = 512) {
    let r = 3735928559 ^ t, s = 1103547991 ^ t;
    for (let t, i = 0; i < e.length; i++) t = e.charCodeAt(i), r = Math.imul(r ^ t, 2246822519), s = Math.imul(s ^ t, 3266489917);
    return r ^= Math.imul(r ^ s >>> 15, 1935289751), s ^= Math.imul(s ^ r >>> 15, 3405138345), 2097152 * ((s ^= (r ^= s >>> 16) >>> 16) >>> 0) + (r >>> 11)
}
