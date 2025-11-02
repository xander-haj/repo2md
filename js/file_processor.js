import { SUPPORTED_EXTENSIONS, LANGUAGE_MAP, IGNORED_PATTERNS, IMAGE_EXTENSIONS } from './config.js';

function readFile(file, isImage) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ content: reader.result, error: null });
        reader.onerror = () => resolve({ content: null, error: reader.error });
        if (isImage) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });
}

function isIgnored(path) {
    return IGNORED_PATTERNS.some(pattern => pattern.test(path));
}

export async function processFiles(files) {
    const rawPaths = Array.from(files).map(f => f.webkitRelativePath || f.name);
    const firstPath = rawPaths.length > 0 ? (rawPaths[0] || '').replace(new RegExp('\\\\', 'g'), '/') : '';
    const firstPathParts = firstPath.split('/');
    const topDir = firstPathParts.length > 1 ? firstPathParts[0] : null;

    function toRootPath(path) {
        const basename = (path || '').split('/').pop().split('\\').pop() || path;

        const normalizedPath = (path || '')
            .replace(new RegExp('\\\\', 'g'), '/')
            .replace(new RegExp('^/'), '');

        const parts = normalizedPath.split('/').filter(p => p);

        if (topDir && parts.length > 0 && parts[0] === topDir) {
            parts.shift();
        }

        let relativePath = parts.join('/');

        if (!relativePath) {
            relativePath = basename;
        }

        return `root/${relativePath}`;
    }

    let hasImages = false;

    const fileMetas = Array.from(files).map(file => {
        const path = file.webkitRelativePath || file.name;
        const rootPath = toRootPath(path);
        const extension = path.split('.').pop()?.toLowerCase() || '';
        const isImage = IMAGE_EXTENSIONS.has(extension);
        if (isImage) hasImages = true;
        const isSupported = SUPPORTED_EXTENSIONS.has(extension);
        return { file, path, rootPath, extension, isImage, isSupported };
    });

    const filteredFileMetas = fileMetas
        .filter(meta => !isIgnored(meta.path) && meta.isSupported)
        .sort((a, b) => a.rootPath.localeCompare(b.rootPath));

    if (filteredFileMetas.length === 0) {
        return { markdown: '', processedFiles: [], processedCount: 0, hasImages: false };
    }
    
    const readPromises = filteredFileMetas.map(meta => readFile(meta.file, meta.isImage));
    const readResults = await Promise.all(readPromises);

    const processedFileData = [];
    let processedCount = 0;
    const fileBlocks = [];

    filteredFileMetas.forEach((meta, index) => {
        const { path, rootPath, extension, isImage } = meta;
        const { content, error } = readResults[index];
        const language = LANGUAGE_MAP[extension] || '';

        processedFileData.push({ path, rootPath, content, error, isImage, extension, language });

        let block = `## ${rootPath}\n\n`;

        if (error) {
            block += '```\n' + `> **Error:** Could not read file. (${error.message})\n` + '```';
        } else if (content !== null) {
            if (isImage) {
                block += '```\n' + `[Image content for ${path}]\n` + '```';
            } else {
                block += '```' + language + '\n' + (content || '') + '\n' + '```';
            }
            processedCount++;
        }
        fileBlocks.push(block);
    });
    
    let markdown = '# Monolithic Code File\n\n';
    markdown += fileBlocks.join('\n\n---\n\n');
    
    return { markdown, processedFiles: processedFileData, processedCount, hasImages };
}
