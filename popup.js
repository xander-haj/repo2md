// --- DOM Elements ---
// Views
const uploadView = document.getElementById('upload-view');
const workspaceView = document.getElementById('workspace-view');

// Global Inputs
const fileInputGlobal = document.getElementById('file-input-global');
const folderInputGlobal = document.getElementById('folder-input-global');

// Settings & Controls
const exportSystemPromptEl = document.getElementById('export-system-prompt');
const exportModeSelect = document.getElementById('export-mode-select');
const customIgnoreToggleBtn = document.getElementById('custom-ignore-toggle-btn');
const customIgnoreContainer = document.getElementById('custom-ignore-container');
const customIgnoreInput = document.getElementById('custom-ignore-input');

// Ignored Output
const ignoredCountBadge = document.getElementById('ignored-count');
const ignoredFilesListEl = document.getElementById('ignored-files-list');

// Outputs & Actions
const exportFileTreeEl = document.getElementById('export-file-tree');
const fileCountBadge = document.getElementById('file-count-badge');
const totalTokensEl = document.getElementById('total-tokens');
const copyBtn = document.getElementById('copy-btn');
const generateMdBtn = document.getElementById('generate-md-btn');

// --- State ---
const workspaceFilesMap = new Map();
let extractedFiles = [];
let ignoredFilesLog = [];

// --- Constants ---
const TEXT_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'scss', 'json', 'md', 'txt', 'yaml', 'yml', 'sh', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt', 'sql', 'xml', 'env']);
const LANGUAGE_MAP = {
    'js': 'javascript', 'jsx': 'jsx', 'ts': 'typescript', 'tsx': 'tsx', 'py': 'python',
    'html': 'html', 'css': 'css', 'scss': 'scss', 'json': 'json', 'md': 'markdown',
    'sh': 'bash', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'cs': 'csharp', 'go': 'go',
    'rs': 'rust', 'php': 'php', 'rb': 'ruby', 'swift': 'swift', 'kt': 'kotlin', 'sql': 'sql', 'xml': 'xml'
};

const ICONS = {
    chevronDown: `<svg class="icon-svg chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>`,
    chevronRight: `<svg class="icon-svg chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>`
};

// --- Utilities ---
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function formatTokens(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
}

function switchView(viewName) {
    if (viewName === 'workspace') {
        uploadView.classList.remove('active');
        uploadView.classList.add('hidden');
        workspaceView.classList.remove('hidden');
        workspaceView.classList.add('active');
    } else {
        workspaceView.classList.remove('active');
        workspaceView.classList.add('hidden');
        uploadView.classList.remove('hidden');
        uploadView.classList.add('active');
    }
}

// --- Initialization & Persistence ---
document.addEventListener('DOMContentLoaded', () => {
    const systemPrompt = localStorage.getItem('systemPrompt');
    const customIgnores = localStorage.getItem('customIgnores');
    const exportMode = localStorage.getItem('exportMode');

    if (systemPrompt) exportSystemPromptEl.value = systemPrompt;
    if (customIgnores) customIgnoreInput.value = customIgnores;
    if (exportMode) exportModeSelect.value = exportMode;
});

const saveSettings = debounce(() => {
    localStorage.setItem('systemPrompt', exportSystemPromptEl.value);
    localStorage.setItem('customIgnores', customIgnoreInput.value);
    localStorage.setItem('exportMode', exportModeSelect.value);
}, 500);

exportSystemPromptEl.addEventListener('input', saveSettings);
customIgnoreInput.addEventListener('input', saveSettings);
exportModeSelect.addEventListener('change', saveSettings);

customIgnoreToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    customIgnoreContainer.classList.toggle('hidden');
});

// --- Input Binding (Zip & Folder Buttons) ---
document.querySelectorAll('.browse-zip-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInputGlobal.click();
    });
});

document.querySelectorAll('.browse-folder-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        folderInputGlobal.click();
    });
});

fileInputGlobal.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleZipFile(e.target.files[0]);
    }
});

folderInputGlobal.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        await handleFolderFiles(e.target.files);
    }
});

// --- Drag & Drop Binding ---
document.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        
        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
            const item = items[0];
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            
            if (entry) {
                if (entry.isDirectory) {
                    await handleDroppedFolder(entry);
                } else if (entry.isFile && entry.name.endsWith('.zip')) {
                    const file = item.getAsFile();
                    await handleZipFile(file);
                } else {
                    alert('Please drop a .zip file or an unpacked folder.');
                }
            } else if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.name.endsWith('.zip')) {
                    await handleZipFile(file);
                } else {
                    alert('Folder drop unsupported in this browser. Please use the Browse Folder button.');
                }
            }
        }
    });
});

// --- File Processing Core ---
function getIgnoreList() {
    const defaults = [
        '__MACOSX', '.DS_Store', 'node_modules', '.git', 'dist', 'out', 'build',
        '._', 'venv', '.venv', 'env', '__pycache__', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
    ];
    const custom = customIgnoreInput.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return [...defaults, ...custom];
}

function isIgnored(path, ignores) {
    for (const ignore of ignores) {
        if (path.includes(ignore)) return true;
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        if (filename === ignore || (ignore.startsWith('*.') && filename.endsWith(ignore.substring(1)))) {
            return true;
        }
    }
    return false;
}

function renderIgnoredList() {
    ignoredFilesListEl.innerHTML = '';
    ignoredCountBadge.innerText = ignoredFilesLog.length;
    
    if (ignoredFilesLog.length === 0) {
        const li = document.createElement('li');
        li.innerText = 'No files ignored.';
        li.style.fontStyle = 'italic';
        ignoredFilesListEl.appendChild(li);
        return;
    }

    ignoredFilesLog.slice(0, 100).forEach(path => {
        const li = document.createElement('li');
        li.innerText = `🚫 ${path}`;
        li.title = path;
        ignoredFilesListEl.appendChild(li);
    });

    if (ignoredFilesLog.length > 100) {
        const li = document.createElement('li');
        li.innerText = `...and ${ignoredFilesLog.length - 100} more hidden items`;
        li.style.color = 'var(--accent)';
        ignoredFilesListEl.appendChild(li);
    }
}

function finishLoadingFiles() {
    renderExportTree(extractedFiles);
    renderIgnoredList();
    switchView('workspace');
}

async function processRawTextFile(file, relativePath) {
    const parts = relativePath.split('/');
    const filename = parts[parts.length - 1];
    const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';

    if (TEXT_EXTENSIONS.has(ext) || filename.startsWith('.env') || filename === 'Dockerfile') {
        try {
            const textContent = await file.text();
            
            const dependencies = [];
            const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
            let match;
            while ((match = importRegex.exec(textContent)) !== null) {
                const importStr = match[1] || match[2];
                if (importStr.startsWith('.')) {
                    dependencies.push(importStr); 
                }
            }

            extractedFiles.push({
                path: relativePath,
                size: file.size,
                content: textContent,
                dependencies: dependencies
            });
        } catch (err) {
            console.warn(`Could not read file: ${relativePath}`, err);
        }
    }
}

// --- Handler: Folder via Input ---
async function handleFolderFiles(fileList) {
    extractedFiles = [];
    ignoredFilesLog = [];
    workspaceFilesMap.clear();
    const ignores = getIgnoreList();

    for(let i=0; i<fileList.length; i++) {
        const file = fileList[i];
        const path = file.webkitRelativePath || file.name;
        
        if (isIgnored(path, ignores)) {
            ignoredFilesLog.push(path);
            continue;
        }
        await processRawTextFile(file, path);
    }
    
    finishLoadingFiles();
    folderInputGlobal.value = ''; 
}

// --- Handler: Folder via Drag/Drop ---
async function handleDroppedFolder(dirEntry) {
    extractedFiles = [];
    ignoredFilesLog = [];
    workspaceFilesMap.clear();
    const ignores = getIgnoreList();

    async function traverse(entry, pathPrefix) {
        const fullPath = pathPrefix + entry.name;
        
        if (isIgnored(fullPath, ignores)) {
            ignoredFilesLog.push(fullPath + (entry.isDirectory ? '/' : ''));
            return;
        }

        if (entry.isDirectory) {
            const reader = entry.createReader();
            let allEntries = [];
            let readBatch = async () => {
                return new Promise(res => {
                    reader.readEntries(entries => res(entries), err => {
                        console.error(err);
                        res([]);
                    });
                });
            };
            
            let entries;
            do {
                entries = await readBatch();
                allEntries = allEntries.concat(entries);
            } while (entries.length > 0);
            
            for (const child of allEntries) {
                await traverse(child, fullPath + '/');
            }
        } else if (entry.isFile) {
            const file = await new Promise(res => entry.file(res, () => res(null)));
            if (file) {
                await processRawTextFile(file, fullPath);
            }
        }
    }
    
    await traverse(dirEntry, '');
    finishLoadingFiles();
}

// --- Handler: Zip File ---
async function handleZipFile(file) {
    extractedFiles = [];
    ignoredFilesLog = [];
    workspaceFilesMap.clear();

    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const ignores = getIgnoreList();
        
        const allFilePaths = Object.keys(contents.files).filter(p => !contents.files[p].dir);

        for (const relativePath of allFilePaths) {
            const zipEntry = contents.files[relativePath];
            
            if (isIgnored(relativePath, ignores)) {
                ignoredFilesLog.push(relativePath);
                continue;
            }

            const parts = relativePath.split('/');
            const filename = parts[parts.length - 1];
            const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';

            if (TEXT_EXTENSIONS.has(ext) || filename.startsWith('.env') || filename === 'Dockerfile') {
                const textContent = await zipEntry.async('string');
                
                const dependencies = [];
                const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
                let match;
                while ((match = importRegex.exec(textContent)) !== null) {
                    const importStr = match[1] || match[2];
                    if (importStr.startsWith('.')) {
                        dependencies.push(importStr); 
                    }
                }

                extractedFiles.push({
                    path: relativePath,
                    size: new Blob([textContent]).size,
                    content: textContent,
                    dependencies: dependencies
                });
            }
        }

        finishLoadingFiles();
        fileInputGlobal.value = ''; 
    } catch (error) {
        console.error(error);
        alert('Error parsing zip. Is it corrupted?');
    }
}

// --- Tree Rendering ---
function renderExportTree(files) {
    exportFileTreeEl.innerHTML = '';
    
    if (!files || files.length === 0) {
        exportFileTreeEl.innerHTML = '<div class="empty-state">No text files found (check ignore rules).</div>';
        fileCountBadge.innerText = '0 files';
        totalTokensEl.innerText = '0 tokens';
        copyBtn.disabled = true;
        generateMdBtn.disabled = true;
        return;
    }

    const tree = {};
    files.forEach(f => {
        workspaceFilesMap.set(f.path, f);
        const parts = f.path.split('/');
        let current = tree;
        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = (index === parts.length - 1) ? null : {};
            }
            current = current[part];
        });
    });

    exportFileTreeEl.appendChild(createTreeList(tree, ''));
    attachTreeEvents();
    updateExportStats();
}

function createTreeList(obj, prefix) {
    const ul = document.createElement('ul');
    ul.className = 'tree-list';
    const keys = Object.keys(obj).sort((a, b) => {
        const aIsFolder = obj[a] !== null;
        const bIsFolder = obj[b] !== null;
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a.localeCompare(b);
    });

    keys.forEach(key => {
        const li = document.createElement('li');
        const isFolder = obj[key] !== null;
        const fullPath = prefix ? `${prefix}/${key}` : key;
        const displayPath = fullPath.startsWith('/') ? fullPath.substring(1) : fullPath;

        if (isFolder) {
            li.className = 'tree-folder';
            li.innerHTML = `
                <div class="tree-item-row">
                    <span class="toggle-icon">${ICONS.chevronDown}</span>
                    <input type="checkbox" checked class="tree-checkbox folder-checkbox" data-path="${displayPath}">
                    <span class="label" style="font-weight: 600;">${key}/</span>
                </div>
            `;
            const childUl = createTreeList(obj[key], displayPath);
            li.appendChild(childUl);
        } else {
            li.className = 'tree-file';
            li.innerHTML = `
                <div class="tree-item-row">
                    <span class="spacer"></span>
                    <input type="checkbox" checked class="tree-checkbox file-checkbox" data-path="${displayPath}">
                    <span class="label file-label">${key}</span>
                </div>
            `;
        }
        ul.appendChild(li);
    });
    return ul;
}

function attachTreeEvents() {
    document.querySelectorAll('.toggle-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const li = e.target.closest('li');
            li.classList.toggle('collapsed');
            const isCollapsed = li.classList.contains('collapsed');
            icon.innerHTML = isCollapsed ? ICONS.chevronRight : ICONS.chevronDown;
        });
    });

    document.querySelectorAll('.folder-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const li = e.target.closest('li');
            const children = li.querySelectorAll('input[type="checkbox"]');
            children.forEach(child => child.checked = e.target.checked);
            updateExportStats();
        });
    });

    document.querySelectorAll('.file-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                const path = e.target.getAttribute('data-path');
                const fileData = workspaceFilesMap.get(path);
                
                if (fileData && fileData.dependencies && fileData.dependencies.length > 0) {
                    fileData.dependencies.forEach(depStr => {
                        const targetName = depStr.split('/').pop();
                        const allCheckboxes = document.querySelectorAll('.file-checkbox:not(:checked)');
                        allCheckboxes.forEach(unCb => {
                            if (unCb.getAttribute('data-path').includes(targetName)) {
                                unCb.checked = true;
                                const label = unCb.closest('.tree-item-row').querySelector('.file-label');
                                if (label) {
                                    label.style.color = 'var(--accent)';
                                    setTimeout(() => label.style.color = '', 1500);
                                }
                            }
                        });
                    });
                }
            }
            updateExportStats();
        });
    });

    document.querySelectorAll('.tree-item-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.closest('.toggle-icon')) return;
            const cb = row.querySelector('input[type="checkbox"]');
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
        });
    });
}

function updateExportStats() {
    const checkedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'));
    const count = checkedFiles.length;
    
    let totalBytes = 0;
    checkedFiles.forEach(cb => {
        const p = cb.getAttribute('data-path');
        const fileData = workspaceFilesMap.get(p);
        totalBytes += fileData ? fileData.size : 0;
    });
    
    const approxTokens = Math.ceil(totalBytes / 4);
    
    copyBtn.disabled = count === 0;
    generateMdBtn.disabled = count === 0;
    
    fileCountBadge.innerText = `${count} files`;
    totalTokensEl.innerText = `${formatTokens(approxTokens)} tokens`;
}

// --- ASCII Tree Generator ---
function getSelectedAsciiTree(checkedPaths) {
    if (checkedPaths.length === 0) return '';
    
    const tree = {};
    checkedPaths.forEach(p => {
        const parts = p.split('/');
        let cur = tree;
        parts.forEach((part, i) => {
            if (!cur[part]) cur[part] = (i === parts.length - 1) ? null : {};
            cur = cur[part];
        });
    });
    
    let result = '';
    function printTree(node, prefix = '') {
        const keys = Object.keys(node).sort((a, b) => {
            const aIsFolder = node[a] !== null;
            const bIsFolder = node[b] !== null;
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            return a.localeCompare(b);
        });

        keys.forEach((key, index) => {
            const isLast = index === keys.length - 1;
            const pointer = isLast ? '└── ' : '├── ';
            result += prefix + pointer + key + '\n';
            if (node[key] !== null) {
                const extension = isLast ? '    ' : '│   ';
                printTree(node[key], prefix + extension);
            }
        });
    }
    
    result += 'root\n';
    printTree(tree, '');
    return result;
}

// --- Markdown Compilation ---
function compileMarkdown() {
    const checkedPaths = Array.from(document.querySelectorAll('.file-checkbox:checked'))
                              .map(cb => cb.getAttribute('data-path'));
    
    const systemPrompt = exportSystemPromptEl.value;
    const treeMode = exportModeSelect.value;
    const treeString = getSelectedAsciiTree(checkedPaths);
    
    let markdown = '';
    
    if (systemPrompt && systemPrompt.trim().length > 0) {
        markdown += `${systemPrompt.trim()}\n\n---\n\n`;
    }

    if (treeString && treeString.trim().length > 0) {
        markdown += `### Project Structure\n\n\`\`\`text\n${treeString.trim()}\n\`\`\`\n\n---\n\n`;
    }

    if (treeMode === 'tree-only') {
        return { markdown, filename: 'file_tree.md' };
    }

    markdown += '# Monolithic Code File\n\n';
    const fileBlocks = [];

    checkedPaths.forEach(path => {
        const fileData = workspaceFilesMap.get(path);
        if (fileData) {
            const ext = path.includes('.') ? path.split('.').pop().toLowerCase() : '';
            const language = LANGUAGE_MAP[ext] || '';
            const block = `## root/${path}\n\n\`\`\`${language}\n${fileData.content}\n\`\`\``;
            fileBlocks.push(block);
        }
    });

    markdown += fileBlocks.join('\n\n---\n\n');
    return { markdown, filename: 'source_code.md' };
}

// --- Export Actions ---
copyBtn.addEventListener('click', async () => {
    const { markdown } = compileMarkdown();
    try {
        await navigator.clipboard.writeText(markdown);
        const originalText = copyBtn.innerText;
        copyBtn.innerText = 'Copied!';
        copyBtn.style.backgroundColor = 'var(--success)';
        setTimeout(() => {
            copyBtn.innerText = originalText;
            copyBtn.style.backgroundColor = '';
        }, 2000);
    } catch (err) {
        alert('Failed to copy to clipboard.');
    }
});

generateMdBtn.addEventListener('click', () => {
    const { markdown, filename } = compileMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
});