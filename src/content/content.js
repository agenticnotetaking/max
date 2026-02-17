(() => {
  const EDITOR_SELECTORS = [
    '[data-testid="articleContentEditable"]',
    'div[role="textbox"][contenteditable="true"]',
    '.DraftEditor-editorContainer [contenteditable="true"]'
  ];

  function findEditor() {
    for (const sel of EDITOR_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function isArticlePage() {
    return /\/(compose\/article|i\/article)/.test(window.location.pathname);
  }

  // SPA navigation handling
  let lastPath = window.location.pathname;
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      chrome.runtime.sendMessage({
        type: 'NAVIGATION',
        path: lastPath,
        onArticlePage: isArticlePage()
      }).catch(() => {});
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ pong: true });
      return;
    }

    if (msg.type === 'CHECK_EDITOR') {
      sendResponse({
        available: !!findEditor(),
        onArticlePage: isArticlePage()
      });
      return;
    }

    if (msg.type === 'TRIGGER_PASTE') {
      const editor = findEditor();
      if (!editor) {
        sendResponse({ success: false, error: 'Editor not found' });
        return;
      }
      editor.focus();
      setTimeout(() => {
        document.execCommand('selectAll');
        const result = document.execCommand('paste');
        sendResponse({ success: result });
      }, 100);
      return true;
    }

    if (msg.type === 'UPLOAD_MEDIA') {
      handleMediaUpload(msg.files).then(sendResponse);
      return true;
    }
  });

  async function handleMediaUpload(files) {
    const fileInput = document.querySelector('input[type="file"][accept*="image"]');
    if (!fileInput) return { success: false, error: 'File input not found', skipped: files.length };

    let uploaded = 0, skipped = 0;
    for (const fileData of files) {
      try {
        const resp = await fetch(fileData.dataUrl);
        const blob = await resp.blob();
        const file = new File([blob], fileData.name || 'image.png', { type: blob.type });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 1500));
        uploaded++;
      } catch { skipped++; }
    }
    return { success: uploaded > 0, uploaded, skipped };
  }
})();
