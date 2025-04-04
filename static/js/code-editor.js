class QBinCodeEditor extends QBinEditorBase {
    constructor() {
        super();
        this.currentEditor = "code";
        this.editorBuffer = {
            content: "",
            isReady: false
        };
        this.currentTheme = this.getThemePreference();
        this.initialize();
    }

    // Add this helper method
    getThemePreference() {
        const savedTheme = localStorage.getItem('qbin-theme') || 'system';
        if (savedTheme === 'dark') return 'dark-theme';
        if (savedTheme === 'light') return 'light-theme';
        // System preference:
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 
            'dark-theme' : 'light-theme';
    }

    async initEditor() {
        // Add theme class to editor container before Monaco loads
        const editorEl = document.getElementById('editor');
        if (editorEl) {
            editorEl.classList.add(this.currentTheme === 'dark-theme' ? 'monaco-dark' : 'monaco-light');
        }
        await this.initMonacoEditor();
    }

    getEditorContent() {
        if (!this.editorBuffer.isReady) {
            return this.editorBuffer.content;
        }
        return this.editor.getValue();
    }

    setEditorContent(content) {
        if (!this.editorBuffer.isReady) {
            this.editorBuffer.content = content;
        } else {
            this.editor.setValue(content);
        }
    }

    setupEditorThemes() {
        monaco.editor.defineTheme('light-theme', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#ffffff',
                'editor.foreground': '#2c2c2c',
                'editor.lineHighlightBackground': '#f5f5f5',
                'editorLineNumber.foreground': '#999999',
                'editor.selectionBackground': '#b3d4fc',
                'editor.inactiveSelectionBackground': '#d4d4d4'
            }
        });

        monaco.editor.defineTheme('dark-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#242424',
                'editor.foreground': '#e0e0e0',
                'editor.lineHighlightBackground': '#2a2a2a',
                'editorLineNumber.foreground': '#666666',
                'editor.selectionBackground': '#264f78',
                'editor.inactiveSelectionBackground': '#3a3a3a'
            }
        });

        // Apply initial theme based on user preference
        this.applyEditorTheme();
    }

    applyEditorTheme() {
        // Get user preference
        const savedTheme = localStorage.getItem('qbin-theme') || 'system';
        
        // First, update document class to ensure panel styling changes
        document.documentElement.classList.remove('light-theme', 'dark-theme');
        
        let monacoTheme;
        if (savedTheme === 'dark') {
            // User explicitly chose dark
            monacoTheme = 'dark-theme';
            document.documentElement.classList.add('dark-theme');
        } else if (savedTheme === 'light') {
            // User explicitly chose light
            monacoTheme = 'light-theme';
            document.documentElement.classList.add('light-theme');
        } else {
            // System preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            monacoTheme = prefersDark ? 'dark-theme' : 'light-theme';
            document.documentElement.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
        }
        
        // Then update Monaco theme
        if (monaco && monaco.editor) {
            monaco.editor.setTheme(monacoTheme);
        }
        
        this.currentTheme = monacoTheme;
    }

    setupEditorThemeListener() {
        // Listen for system preference changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
            // Only react to system changes if the user preference is 'system'
            if (localStorage.getItem('qbin-theme') === 'system' || !localStorage.getItem('qbin-theme')) {
                this.applyEditorTheme();
            }
        });

        // Listen for explicit theme changes from other tabs/windows
        window.addEventListener('storage', (event) => {
            if (event.key === 'qbin-theme') {
                this.applyEditorTheme();
            }
        });

        // Add custom event listener for theme changes from UI
        window.addEventListener('themeChange', () => {
            this.applyEditorTheme();
        });
        
        // Create a global theme utility function for UI elements to use
        window.qbinToggleTheme = (theme) => {
            localStorage.setItem('qbin-theme', theme);
            // Dispatch event to update all listeners
            window.dispatchEvent(new CustomEvent('themeChange'));
        };
    }

    setupEditorChangeListener() {
        let saveTimeout;
        this.editor.getModel().onDidChangeContent(() => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveToLocalCache();
            }, 1000);

            clearTimeout(this.autoUploadTimer);
            this.autoUploadTimer = setTimeout(() => {
                const content = this.getEditorContent();
                if (content && cyrb53(content) !== this.lastUploadedHash) {
                    const lang = document.getElementById('language-select').value;
                    const mimetype = this.getMimeTypeFromLang(lang);
                    this.handleUpload(content, mimetype);
                }
            }, 2000);
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

    async initMonacoEditor() {
        return new Promise((resolve) => {
            require.config({paths: {'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs'}});

            // Configure Monaco loader with correct theme before editor loads
            window.MonacoEnvironment = {
                getTheme: () => this.currentTheme
            };

            require(['vs/editor/editor.main'], () => {
                this.setupEditorThemes();
                
                this.editor = monaco.editor.create(document.getElementById('editor'), {
                    value: this.editorBuffer.content,
                    language: 'plaintext',
                    automaticLayout: true,
                    theme: this.currentTheme, // Use preloaded theme
                    minimap: {enabled: window.innerWidth > 768},
                    scrollBeyondLastLine: false,
                    fontSize: isMobile() ? 16 : 14,
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    padding: {top: 20, bottom: 20},
                    renderLineHighlight: 'all',
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: true,
                    fixedOverflowWidgets: true,
                    contextmenu: true,
                    matchBrackets: "always"
                });

                // Remove the temporary class now that Monaco has loaded
                const editorEl = document.getElementById('editor');
                if (editorEl) {
                    editorEl.classList.remove('monaco-dark', 'monaco-light');
                }

                // Mark editor as ready
                this.editorBuffer.isReady = true;
                
                this.initLanguageSelector();
                this.setupEditorThemeListener();
                this.setupEditorChangeListener();
                resolve();
            });
        });
    }

    initLanguageSelector() {
        const languageSelect = document.getElementById('language-select');
        languageSelect.value = this.editor.getModel().getLanguageId();

        languageSelect.addEventListener('change', () => {
            const newLanguage = languageSelect.value;
            monaco.editor.setModelLanguage(this.editor.getModel(), newLanguage);
            localStorage.setItem('qbin_language_preference', newLanguage);
        });

        const savedLanguage = localStorage.getItem('qbin_language_preference');
        if (savedLanguage) {
            languageSelect.value = savedLanguage;
            monaco.editor.setModelLanguage(this.editor.getModel(), savedLanguage);
        }
    }
}
new QBinCodeEditor();
