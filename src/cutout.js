import JSZip from 'jszip';

export function initCutout({ downloadBlob, setError }) {
  const $ = (selector) => document.querySelector(selector);
  const input = $('#image-file');
  const list = $('#image-list');
  const stageImage = $('#cutout-image');
  const entries = [];
  let selectedId = null;
  let busy = false;

  const safeName = (name) => name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|\x00-\x1F]/g, '_') || 'image';
  const outputName = (entry) => `${safeName(entry.file.name)}-transparent.png`;
  const formatBytes = (bytes) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  const selected = () => entries.find((entry) => entry.id === selectedId);

  function release(entry) {
    URL.revokeObjectURL(entry.sourceUrl);
    if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl);
  }

  function render() {
    const current = selected();
    list.replaceChildren();
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'image-row';
      if (entry.id === selectedId) row.classList.add('is-selected');
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'image-pick';
      pick.textContent = entry.file.name;
      pick.title = entry.file.name;
      pick.addEventListener('click', () => { selectedId = entry.id; render(); });
      const status = document.createElement('span');
      status.className = 'image-status';
      status.textContent = entry.status;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'image-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${entry.file.name}`);
      remove.disabled = busy;
      remove.addEventListener('click', () => {
        const index = entries.indexOf(entry);
        if (index < 0 || busy) return;
        release(entry);
        entries.splice(index, 1);
        if (selectedId === entry.id) selectedId = entries[0]?.id ?? null;
        render();
      });
      row.append(pick, status, remove);
      list.append(row);
    }
    list.hidden = entries.length === 0;
    $('#source-details').hidden = entries.length === 0;
    $('#source-name').textContent = `${entries.length} image${entries.length === 1 ? '' : 's'} selected`;
    $('#source-size').textContent = current ? `${current.file.name} · ${formatBytes(current.file.size)}` : '';
    $('#remove-btn').disabled = busy || !entries.some((entry) => !entry.resultBlob);
    $('#cutout-download').disabled = !current?.resultBlob;
    $('#cutout-download-all').disabled = !entries.some((entry) => entry.resultBlob);
    if (current) {
      stageImage.src = current.resultUrl || current.sourceUrl;
      stageImage.alt = current.resultUrl ? `Background removed from ${current.file.name}` : `Original ${current.file.name}`;
      stageImage.hidden = false;
      $('#cutout-placeholder').hidden = true;
      $('#cutout-ready').textContent = current.status.toUpperCase();
      $('#cutout-tip').textContent = current.error || (current.resultBlob ? 'Transparent PNG ready to download.' : 'Select Remove backgrounds to process your images.');
    } else {
      stageImage.removeAttribute('src');
      stageImage.hidden = true;
      $('#cutout-placeholder').hidden = false;
      $('#cutout-ready').textContent = 'NO IMAGE YET';
      $('#cutout-tip').textContent = 'Choose photos to get started.';
    }
  }

  function addFiles(files) {
    if (busy) return;
    setError('#cutout-error');
    const incoming = Array.from(files || []);
    let rejected = 0;
    for (const file of incoming) {
      if (entries.length >= 8 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 25 * 1024 * 1024) {
        rejected++;
        continue;
      }
      entries.push({ id: ++nextId, file, sourceUrl: URL.createObjectURL(file), resultBlob: null, resultUrl: null, status: 'Waiting', error: '' });
      selectedId ??= nextId;
    }
    if (rejected) setError('#cutout-error', `${rejected} file${rejected === 1 ? ' was' : 's were'} skipped. Use up to 8 PNG, JPG or WebP images under 25 MB each.`);
    render();
  }

  let nextId = 0;
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  $('#clear-image').addEventListener('click', () => {
    if (busy) return;
    entries.forEach(release);
    entries.length = 0;
    selectedId = null;
    setError('#cutout-error');
    render();
  });
  const dropzone = $('#dropzone');
  ['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    if (!busy) dropzone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
  }));
  dropzone.addEventListener('drop', (event) => addFiles(event.dataTransfer?.files));

  $('#remove-btn').addEventListener('click', async () => {
    if (busy || !entries.some((entry) => !entry.resultBlob)) return;
    busy = true;
    input.disabled = true;
    $('#clear-image').disabled = true;
    $('#processing').hidden = false;
    setError('#cutout-error');
    const pending = entries.filter((entry) => !entry.resultBlob);
    let failures = 0;
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      for (let index = 0; index < pending.length; index++) {
        const entry = pending[index];
        selectedId = entry.id;
        entry.status = `Working ${index + 1}/${pending.length}`;
        $('#processing-label').textContent = `Removing background ${index + 1} of ${pending.length}…`;
        $('#processing-percent').textContent = '';
        $('#processing-fill').style.width = '5%';
        render();
        try {
          entry.resultBlob = await removeBackground(entry.file, {
            model: 'small',
            output: { format: 'image/png' },
            progress: (_key, current, total) => {
              const percentage = total > 0 ? Math.round(current / total * 100) : 0;
              $('#processing-percent').textContent = `${percentage}%`;
              $('#processing-fill').style.width = `${Math.max(5, percentage)}%`;
            },
          });
          entry.resultUrl = URL.createObjectURL(entry.resultBlob);
          entry.status = 'Ready';
          entry.error = '';
        } catch (error) {
          failures++;
          entry.status = 'Failed';
          entry.error = `Could not process this image. ${error?.message || 'Try a smaller photo.'}`;
        }
        render();
      }
    } catch (error) {
      failures = pending.length;
      setError('#cutout-error', `Could not load the background removal model. ${error?.message || 'Check your connection and try again.'}`);
    } finally {
      busy = false;
      input.disabled = false;
      $('#clear-image').disabled = false;
      $('#processing').hidden = true;
      if (failures && !$('#cutout-error').textContent) setError('#cutout-error', `${failures} image${failures === 1 ? '' : 's'} could not be processed. Select one for details, then try again.`);
      render();
    }
  });

  $('#cutout-download').addEventListener('click', () => {
    const entry = selected();
    if (entry?.resultBlob) downloadBlob(entry.resultBlob, outputName(entry));
  });
  $('#cutout-download-all').addEventListener('click', async () => {
    const completed = entries.filter((entry) => entry.resultBlob);
    if (!completed.length) return;
    const button = $('#cutout-download-all');
    button.disabled = true;
    button.textContent = 'Preparing ZIP…';
    try {
      const zip = new JSZip();
      const used = new Set();
      for (const entry of completed) {
        const base = outputName(entry);
        let name = base;
        let index = 2;
        while (used.has(name)) name = base.replace(/\.png$/, `-${index++}.png`);
        used.add(name);
        zip.file(name, entry.resultBlob);
      }
      downloadBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), 'transparent-images.zip');
    } catch {
      setError('#cutout-error', 'Could not create the ZIP. You can still save each PNG individually.');
    } finally {
      button.textContent = 'Save all as ZIP';
      render();
    }
  });

  render();
}
