import * as DOM from './dom_elements.js';

function sanitizeHTML(htmlString) {
    const allowedTags = new Set(['h1', 'h2', 'h3', 'p', 'pre', 'code', 'em', 'strong', 'ul', 'ol', 'li', 'blockquote', 'span', 'div', 'a']);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    doc.body.querySelectorAll('*').forEach(node => {
        const tagName = node.tagName.toLowerCase();
        if (!allowedTags.has(tagName)) {
            node.parentNode.replaceChild(document.createTextNode(node.outerHTML), node);
            return;
        }

        const attributes = Array.from(node.attributes);
        attributes.forEach(attr => {
            const attrName = attr.name.toLowerCase();
            const attrValue = attr.value;

            if (tagName === 'code' && attrName === 'class' && attrValue.startsWith('language-')) {
                return;
            }
            if (tagName === 'a' && attrName === 'href') {
                return;
            }
            if (tagName === 'div' && attrName === 'class' && attrValue === 'code-block-header') {
                return;
            }
            
            node.removeAttribute(attr.name);
        });
    });

    return doc.body.innerHTML;
}

export function updateStatus(text) {
    DOM.statusLine.textContent = text;
}

export function setButtonsDisabled(disabled) {
    DOM.downloadButton.disabled = disabled;
    DOM.copyButton.disabled = disabled;
    DOM.pdfButton.disabled = disabled;
}

export function setPdfButtonVisible(visible) {
    if (visible) {
        DOM.pdfButton.classList.remove('hidden');
    } else {
        DOM.pdfButton.classList.add('hidden');
    }
}

export function renderPreview(html) {
    const sanitizedHtml = sanitizeHTML(html);
    DOM.previewPane.innerHTML = sanitizedHtml;
}

export function clearPreview() {
    DOM.previewPane.innerHTML = '';
}

export function showCopyFeedback() {
    const originalText = DOM.copyButton.innerHTML;
    DOM.copyButton.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-2"></i> Copied!`;
    lucide.createIcons({
        nodes: [DOM.copyButton.querySelector('[data-lucide]')]
    });
    DOM.copyButton.classList.replace('btn-primary', 'btn-secondary');
    
    setTimeout(() => {
        DOM.copyButton.innerHTML = originalText;
        lucide.createIcons({
            nodes: [DOM.copyButton.querySelector('[data-lucide]')]
        });
        DOM.copyButton.classList.replace('btn-secondary', 'btn-primary');
    }, 2000);
}
