import * as DOM from './dom_elements.js';
import * as UIManager from './ui_manager.js';
import { processFiles } from './file_processor.js';

let aggregatedMarkdown = '';
let processedFileCount = 0;
let processedFiles = [];

async function handleFileSelection(fileList) {
    if (!fileList || fileList.length === 0) {
        UIManager.updateStatus('Awaiting directory selection…');
        return;
    }

    UIManager.setButtonsDisabled(true);
    UIManager.setPdfButtonVisible(false);
    UIManager.updateStatus(`Processing ${fileList.length} files…`);
    UIManager.clearPreview();
    aggregatedMarkdown = '';
    processedFiles = [];

    const result = await processFiles(Array.from(fileList));
    aggregatedMarkdown = result.markdown;
    processedFileCount = result.processedCount;
    processedFiles = result.processedFiles;
    
    if (processedFileCount > 0) {
        UIManager.updateStatus(`Successfully processed ${processedFileCount} file(s).`);
        const html = marked.parse(aggregatedMarkdown.replace(new RegExp('\n', 'g'), '\n'));
        UIManager.renderPreview(html);
        UIManager.setButtonsDisabled(false);
        if (result.hasImages) {
            UIManager.setPdfButtonVisible(true);
        }
    } else {
        UIManager.updateStatus('No valid or supported files found.');
        UIManager.renderPreview('<p class=\\\"text-center text-gray-500\\\">No content to preview.</p>');
    }
}

function handleDownload() {
    if (!aggregatedMarkdown) return;
    const blob = new Blob([aggregatedMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'source_code.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleCopy() {
    if (!aggregatedMarkdown) return;
    navigator.clipboard.writeText(aggregatedMarkdown).then(() => {
        UIManager.showCopyFeedback();
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy. Please try again.');
    });
}

function getImageProperties(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = (err) => reject(err);
        img.src = dataUrl;
    });
}

async function handlePdfDownload() {
    if (!processedFiles || processedFiles.length === 0) return;

    UIManager.updateStatus('Generating PDF...');
    UIManager.setButtonsDisabled(true);

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

        const MARGIN = 40;
        const PAGE_WIDTH = doc.internal.pageSize.getWidth() - MARGIN * 2;
        const PAGE_HEIGHT = doc.internal.pageSize.getHeight() - MARGIN * 2;
        const FONT_H = 12;
        const FONT_T = 8;
        const LINE_H = 1.2;
        const LINE_T = 1.2;
        
        let yPos = MARGIN;

        const checkAndAddPage = (requiredHeight) => {
            if (yPos + requiredHeight > PAGE_HEIGHT + MARGIN) {
                doc.addPage();
                yPos = MARGIN;
            }
        };

        for (const file of processedFiles) {
            checkAndAddPage(FONT_H * LINE_H * 1.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(FONT_H);
            doc.text(file.rootPath, MARGIN, yPos);
            yPos += FONT_H * LINE_H * 1.5;

            if (file.error) {
                doc.setFont('courier', 'normal');
                doc.setFontSize(FONT_T);

                checkAndAddPage(FONT_T * LINE_T);
                doc.text('```', MARGIN, yPos);
                yPos += FONT_T * LINE_T;

                checkAndAddPage(FONT_T * LINE_T);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(255, 0, 0);
                doc.text('Error: Could not read file.', MARGIN, yPos);
                doc.setTextColor(0, 0, 0);
                yPos += FONT_T * LINE_T;
                
                checkAndAddPage(FONT_T * LINE_T);
                doc.setFont('courier', 'normal');
                doc.text('```', MARGIN, yPos);
                yPos += FONT_T * LINE_T * 2;

                continue;
            }

            if (file.isImage) {
                doc.setFont('courier', 'normal');
                doc.setFontSize(FONT_T);
                checkAndAddPage(FONT_T * LINE_T);
                doc.text('```', MARGIN, yPos);
                yPos += FONT_T * LINE_T;

                try {
                    const imgProps = await getImageProperties(file.content);
                    const aspectRatio = imgProps.width / imgProps.height;
                    let imgWidth = PAGE_WIDTH;
                    let imgHeight = imgWidth / aspectRatio;
                    
                    if (imgHeight > PAGE_HEIGHT * 0.75) {
                        imgHeight = PAGE_HEIGHT * 0.75;
                        imgWidth = imgHeight * aspectRatio;
                    }

                    checkAndAddPage(imgHeight + 10);
                    doc.addImage(file.content, file.extension.toUpperCase(), MARGIN, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 10;
                } catch (e) {
                    checkAndAddPage(FONT_T * LINE_T);
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(FONT_T);
                    doc.setTextColor(255, 0, 0);
                    doc.text('Error: Could not process image.', MARGIN, yPos);
                    doc.setTextColor(0, 0, 0);
                    yPos += FONT_T * LINE_T;
                }

                checkAndAddPage(FONT_T * LINE_T);
                doc.setFont('courier', 'normal');
                doc.text('```', MARGIN, yPos);
                yPos += FONT_T * LINE_T * 2;

            } else {
                doc.setFont('courier', 'normal');
                doc.setFontSize(FONT_T);

                const language = file.language || '';
                checkAndAddPage(FONT_T * LINE_T);
                doc.text('```' + language, MARGIN, yPos);
                yPos += FONT_T * LINE_T;

                const lines = doc.splitTextToSize(file.content || '', PAGE_WIDTH);
                for (const line of lines) {
                    checkAndAddPage(FONT_T * LINE_T);
                    doc.text(line, MARGIN, yPos);
                    yPos += FONT_T * LINE_T;
                }
                
                checkAndAddPage(FONT_T * LINE_T);
                doc.text('```', MARGIN, yPos);
                yPos += FONT_T * LINE_T * 2;
            }
        }

        doc.save('source_code.pdf');
    } catch (e) {
        console.error("Failed to generate PDF:", e);
        UIManager.updateStatus('Error generating PDF. Check console for details.');
    } finally {
        UIManager.setButtonsDisabled(false);
        UIManager.updateStatus(`Successfully processed ${processedFileCount} file(s).`);
    }
}

function getFile(fileEntry) {
    return new Promise((resolve, reject) => {
        fileEntry.file(resolve, reject);
    });
}

function readEntries(dirReader) {
    return new Promise((resolve, reject) => {
        dirReader.readEntries(resolve, reject);
    });
}

async function traverseDirectory(entry) {
    let files = [];
    if (entry.isFile) {
        try {
            const file = await getFile(entry);
            if (entry.fullPath && !file.webkitRelativePath) {
                const normalizedPath = entry.fullPath.startsWith('/') ? entry.fullPath.substring(1) : entry.fullPath;
                Object.defineProperty(file, 'webkitRelativePath', {
                    value: normalizedPath,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
            }
            files.push(file);
        } catch (err) {
            console.error('Could not get file from entry:', entry.name, err);
        }
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        let allEntries = [];
        let newEntries;
        do {
            try {
                newEntries = await readEntries(dirReader);
                if (newEntries && newEntries.length > 0) {
                    allEntries = allEntries.concat(Array.from(newEntries));
                }
            } catch (err) {
                console.error('Could not read directory entries:', entry.name, err);
                break;
            }
        } while (newEntries && newEntries.length > 0);

        for (const subEntry of allEntries) {
            const nestedFiles = await traverseDirectory(subEntry);
            files = files.concat(nestedFiles);
        }
    }
    return files;
}

function init() {
    lucide.createIcons();
    UIManager.setButtonsDisabled(true);
    UIManager.setPdfButtonVisible(false);

    DOM.dropZone.addEventListener('click', () => DOM.folderInput.click());
    DOM.folderInput.addEventListener('change', (e) => handleFileSelection(e.target.files));

    ['dragenter', 'dragover'].forEach(eventName => {
        DOM.dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            DOM.dropZone.classList.add('drag-over');
        }, false);
    });

    DOM.dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        DOM.dropZone.classList.remove('drag-over');
    });

    DOM.dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        DOM.dropZone.classList.remove('drag-over');

        const items = e.dataTransfer.items;
        if (items) {
            const promises = Array.from(items)
                .filter(item => item.kind === 'file')
                .map(item => item.webkitGetAsEntry())
                .filter(entry => entry)
                .map(entry => traverseDirectory(entry));
            
            try {
                const fileArrays = await Promise.all(promises);
                const allFiles = fileArrays.flat();
                handleFileSelection(allFiles);
            } catch (err) {
                console.error("Error processing dropped files:", err);
                UIManager.updateStatus('Error processing directory. Please try again.');
                UIManager.setButtonsDisabled(true);
            }
        } else {
            handleFileSelection(e.dataTransfer.files);
        }
    });

    DOM.downloadButton.addEventListener('click', handleDownload);
    DOM.pdfButton.addEventListener('click', handlePdfDownload);
    DOM.copyButton.addEventListener('click', handleCopy);
}

document.addEventListener('DOMContentLoaded', init);
