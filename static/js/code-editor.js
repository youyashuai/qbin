class QBinCodeEditor extends QBinEditorBase {
    constructor() {
        super();
        this.currentEditor = "code";
        this.initialize();
    }

    async initEditor() {
        await this.initMonacoEditor();
    }

    getEditorContent() {
        return this.editor.getValue();
    }

    setEditorContent(content) {
        this.editor.setValue(content);
    }

    setupEditorThemes() {
        monaco.editor.defineTheme('qbin-light', {
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

        monaco.editor.defineTheme('qbin-dark', {
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
    }

    setupEditorThemeListener() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', e => {
            monaco.editor.setTheme(e.matches ? 'qbin-dark' : 'qbin-light');
        });
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

            require(['vs/editor/editor.main'], () => {
                this.setupEditorThemes();
                this.editor = monaco.editor.create(document.getElementById('editor'), {
                    value: '',
                    language: 'plaintext',
                    automaticLayout: true,
                    theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'qbin-dark' : 'qbin-light',
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