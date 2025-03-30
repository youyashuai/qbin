class QBinMultiEditor extends QBinEditorBase {
    constructor() {
        super();
        this.currentEditor = "multi";
        this.initialize();
    }

    async initEditor() {
        this.editor = document.getElementById('editor');
        this.setupDragAndPaste();
        this.updateUploadAreaVisibility();

        // 监听编辑器内容变化
        this.editor.addEventListener('input', () => {
            this.updateUploadAreaVisibility();
        });
    }

    getEditorContent() {
        return this.editor.value;
    }

    setEditorContent(content) {
        this.editor.value = content;
        this.updateUploadAreaVisibility();
    }

    updateUploadAreaVisibility() {
        const uploadArea = document.querySelector('.upload-area');
        if (uploadArea) {
            const isEmpty = !this.getEditorContent().trim();
            uploadArea.classList.toggle('visible', isEmpty);
        }
    }

    setupDragAndPaste() {
        // 粘贴上传（图片）
        this.editor.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.indexOf('image/') === 0) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    this.handleUpload(file, file.type);
                    return;
                }
            }
        });
        // 拖放上传
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
    }
}
new QBinMultiEditor();
