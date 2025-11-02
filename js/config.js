export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

const TEXT_EXTENSIONS = [
    'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'py', 'java', 'c', 'h',
    'cpp', 'hpp', 'cs', 'rs', 'go', 'rb', 'php', 'swift', 'kt', 'kts', 'r',
    'md', 'json', 'toml', 'yaml', 'yml', 'sh', 'bat', 'ps1', 'dockerfile', 'sql'
];

export const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS]);

export const LANGUAGE_MAP = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    html: 'html',
    css: 'css',
    scss: 'scss',
    py: 'python',
    java: 'java',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    kts: 'kotlin',
    r: 'r',
    md: 'markdown',
    json: 'json',
    toml: 'toml',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bat: 'batch',
    ps1: 'powershell',
    dockerfile: 'dockerfile',
    sql: 'sql'
};

const IGNORED_FILES = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.DS_Store',
    'thumbs.db'
];

const IGNORED_DIRECTORIES = [
    '.git',
    'node_modules',
    'dist',
    'build',
    'out',
    '.vscode',
    '.idea',
    '__pycache__'
];

const ignoredFilesRegex = new RegExp(`(^|/|\\\\\\\\)(${IGNORED_FILES.join('|')})$`, 'i');
const ignoredDirsRegex = new RegExp(`(^|/|\\\\\\\\)(${IGNORED_DIRECTORIES.join('|')})(/|\\\\\\\\|$)`, 'i');

export const IGNORED_PATTERNS = [ignoredFilesRegex, ignoredDirsRegex];
