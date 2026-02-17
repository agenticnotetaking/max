(() => {
  const $ = (sel) => document.querySelector(sel);
  const textarea = $('#editorTextarea');
  const wordCountEl = $('#wordCount');
  const syncBtn = $('#syncBtn');
  const syncInfo = $('#syncInfo');
  const mediaTray = $('#mediaTray');
  const mediaThumbnails = $('#mediaThumbnails');
  const mediaAddBtn = $('#mediaAddBtn');
  const mediaFileInput = $('#mediaFileInput');
  const editorContainer = $('#editorContainer');
  const toastContainer = $('#toastContainer');

  const mediaStore = [];
  let mediaIdCounter = 0;
  let saveTimeout = null;

  marked.use({ renderer: xRenderer, breaks: true });

  // --- Selection & Word Count ---
  function getSelection() {
    const s = textarea.selectionStart;
    const e = textarea.selectionEnd;
    return e - s > 0 ? { start: s, end: e, text: textarea.value.slice(s, e) } : null;
  }

  function wordCount(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  function updateInfo() {
    const sel = getSelection();
    const total = wordCount(textarea.value);

    if (sel) {
      const selWords = wordCount(sel.text);
      syncInfo.textContent = `${selWords} of ${total} words selected`;
      syncBtn.textContent = 'Sync Selection';
    } else {
      syncInfo.textContent = `${total} words`;
      syncBtn.textContent = 'Sync to X';
    }
  }

  textarea.addEventListener('input', () => { updateInfo(); scheduleSave(); });
  textarea.addEventListener('select', updateInfo);
  textarea.addEventListener('click', updateInfo);
  textarea.addEventListener('keyup', updateInfo);

  // --- Keyboard Shortcuts ---
  textarea.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'b') { e.preventDefault(); wrapSelection('**', '**'); }
    else if (mod && e.key === 'i') { e.preventDefault(); wrapSelection('*', '*'); }
    else if (mod && e.key === 'k') { e.preventDefault(); wrapSelection('[', '](url)'); }
    else if (e.key === 'Tab') { e.preventDefault(); insertAtCursor('  '); }
  });

  function wrapSelection(before, after) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.slice(start, end);
    const bLen = before.length, aLen = after.length;

    if (start >= bLen && text.slice(start - bLen, start) === before && text.slice(end, end + aLen) === after) {
      textarea.value = text.slice(0, start - bLen) + selected + text.slice(end + aLen);
      textarea.selectionStart = start - bLen;
      textarea.selectionEnd = end - bLen;
    } else {
      textarea.value = text.slice(0, start) + before + selected + after + text.slice(end);
      textarea.selectionStart = start + bLen;
      textarea.selectionEnd = end + bLen;
    }
    textarea.dispatchEvent(new Event('input'));
  }

  function insertAtCursor(text) {
    const start = textarea.selectionStart;
    const val = textarea.value;
    textarea.value = val.slice(0, start) + text + val.slice(start);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.dispatchEvent(new Event('input'));
  }

  // --- Auto-save ---
  function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => localStorage.setItem('mdtox-content', textarea.value), 300);
  }

  const EXAMPLE_DOC = `# Title (pastes as h2)

## Heading 2

### Heading 3

**bold** and *italic* and ~~strikethrough~~

***bold italic*** and **~~bold strikethrough~~**

A [link](https://example.com) in a sentence.

- bullet one
- bullet two
- bullet three

1. numbered one
2. numbered two
3. numbered three

> a blockquote

\`inline code\` → pastes as **bold**

\`\`\`
code block → pastes as blockquote
use X's toolbar to convert
\`\`\`

---

↑ separator → pastes as · · ·

select text to sync a section. clear this and start writing.
`;

  function restoreContent() {
    const saved = localStorage.getItem('mdtox-content');
    textarea.value = saved || EXAMPLE_DOC;
    updateInfo();
  }

  // --- Media ---
  mediaAddBtn.addEventListener('click', () => mediaFileInput.click());

  mediaFileInput.addEventListener('change', (e) => {
    for (const file of e.target.files) addMediaFile(file);
    mediaFileInput.value = '';
  });

  editorContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    editorContainer.style.outline = '2px dashed var(--muted)';
  });
  editorContainer.addEventListener('dragleave', () => { editorContainer.style.outline = ''; });
  editorContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    editorContainer.style.outline = '';
    for (const file of e.dataTransfer.files) {
      if (file.type.startsWith('image/')) addMediaFile(file);
    }
  });

  function addMediaFile(file) {
    const id = mediaIdCounter++;
    const objectUrl = URL.createObjectURL(file);
    const markdownRef = `![image-${id}](media:${id})`;
    mediaStore.push({ id, file, objectUrl, markdownRef });
    insertAtCursor(markdownRef + '\n');
    renderMediaTray();
  }

  function removeMedia(id) {
    const idx = mediaStore.findIndex(m => m.id === id);
    if (idx === -1) return;
    const item = mediaStore[idx];
    URL.revokeObjectURL(item.objectUrl);
    textarea.value = textarea.value.replace(item.markdownRef + '\n', '').replace(item.markdownRef, '');
    textarea.dispatchEvent(new Event('input'));
    mediaStore.splice(idx, 1);
    renderMediaTray();
  }

  function renderMediaTray() {
    mediaThumbnails.innerHTML = '';
    for (const item of mediaStore) {
      const wrapper = document.createElement('div');
      wrapper.className = 'media-thumb-wrapper';
      const img = document.createElement('img');
      img.className = 'media-thumb';
      img.src = item.objectUrl;
      img.alt = `image-${item.id}`;
      const btn = document.createElement('button');
      btn.className = 'media-remove';
      btn.textContent = '\u00d7';
      btn.addEventListener('click', () => removeMedia(item.id));
      wrapper.append(img, btn);
      mediaThumbnails.appendChild(wrapper);
    }
  }

  // --- Toasts ---
  function showToast(type, message) {
    const existing = toastContainer.querySelectorAll('.toast:not(.dismissing)');
    if (existing.length >= 3) dismissToast(existing[0]);

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = type === 'success' ? '\u2714' : '\u2718';

    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;

    const dismiss = document.createElement('button');
    dismiss.className = 'toast-dismiss';
    dismiss.textContent = '\u00d7';
    dismiss.addEventListener('click', () => dismissToast(toast));

    toast.append(icon, msg, dismiss);

    const dur = type === 'success' ? 3000 : 0;
    if (dur > 0) {
      const bar = document.createElement('div');
      bar.className = 'toast-progress';
      bar.style.animation = `shrink ${dur}ms linear forwards`;
      toast.appendChild(bar);
      toast._auto = setTimeout(() => dismissToast(toast), dur);
    }

    toastContainer.appendChild(toast);
    return toast;
  }

  function dismissToast(t) {
    if (!t || t.classList.contains('dismissing')) return;
    clearTimeout(t._auto);
    t.classList.add('dismissing');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }

  const ss = document.createElement('style');
  ss.textContent = '@keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }';
  document.head.appendChild(ss);

  // --- Sync ---
  syncBtn.addEventListener('click', doSync);

  async function doSync() {
    syncBtn.disabled = true;
    const sel = getSelection();
    const md = sel ? sel.text : textarea.value;
    const label = sel ? `Selection (${wordCount(sel.text)} words)` : 'Article';

    const pending = showToast('success', `Syncing ${label.toLowerCase()}\u2026`);
    pending.querySelector('.toast-icon').style.color = 'var(--muted)';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      // Ensure content script
      let status;
      try {
        status = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_EDITOR' });
      } catch {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/content.js'] });
        try { status = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_EDITOR' }); }
        catch { throw new Error('Could not reach page. Refresh and retry.'); }
      }

      if (!status.onArticlePage) throw new Error('Open x.com/compose/article first');
      if (!status.available) throw new Error('Editor not found. Try refreshing.');

      const html = marked.parse(md).replace(/<p>\s*<\/p>/g, '').replace(/<!--IMG:\d+-->/g, '');
      const plain = md.replace(/[#*_~`>\[\]()!-]/g, '');

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' })
        })
      ]);

      const result = await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_PASTE' });
      if (!result.success) throw new Error('Paste failed. Check the editor.');

      dismissToast(pending);

      // Media uploads (full article sync only)
      if (!sel && mediaStore.length > 0) {
        const files = await Promise.all(mediaStore.map(async (item) => {
          const dataUrl = await fileToDataUrl(item.file);
          return { dataUrl, name: item.file.name };
        }));
        const mr = await chrome.tabs.sendMessage(tab.id, { type: 'UPLOAD_MEDIA', files });
        showToast('success', mr.skipped > 0 ? `Synced (${mr.skipped} images skipped)` : 'Synced with images');
      } else {
        showToast('success', `${label} synced`);
      }
    } catch (err) {
      dismissToast(pending);
      showToast('error', err.message || 'Sync failed');
    } finally {
      syncBtn.disabled = false;
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // --- Init ---
  restoreContent();
})();
