import QRCode from 'qrcode';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const qrContent = $('#qr-content');
const qrCanvas = $('#qr-canvas');
const imageInput = $('#image-file');
let qrValue = '';
let imageFile = null;
let sourceUrl = null;
let cutoutUrl = null;
let busy = false;
let installPrompt = null;

function setTool(tool) {
  const qr = tool === 'qr';
  $('#tab-qr').classList.toggle('is-active', qr);
  $('#tab-cutout').classList.toggle('is-active', !qr);
  $('#tab-qr').setAttribute('aria-selected', String(qr));
  $('#tab-cutout').setAttribute('aria-selected', String(!qr));
  $('#panel-qr').hidden = !qr;
  $('#panel-cutout').hidden = qr;
}

$('#tab-qr').addEventListener('click', () => setTool('qr'));
$('#tab-cutout').addEventListener('click', () => setTool('cutout'));
document.querySelector('.tool-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const next = $('#panel-qr').hidden ? 'qr' : 'cutout';
  setTool(next);
  $(`#tab-${next}`).focus();
});

function setError(id, text = '') {
  const target = $(id);
  target.textContent = text;
  target.hidden = !text;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function qrOptions() {
  return {
    width: Number($('#qr-size').value),
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: $('#qr-dark').value, light: $('#qr-light').value },
  };
}

function luminance(hex) {
  const rgb = [1, 3, 5].map((index) => {
    const v = parseInt(hex.slice(index, index + 2), 16) / 255;
    return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  });
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}

function clearQrPreview() {
  qrValue = '';
  qrCanvas.hidden = true;
  $('#qr-placeholder').hidden = false;
  $('#qr-ready').textContent = 'WAITING FOR GENERATION';
  $('#qr-tip').textContent = 'Generate to update your QR code.';
  $('#qr-png').disabled = true;
  $('#qr-svg').disabled = true;
  setError('#qr-error');
}

qrContent.addEventListener('input', () => {
  $('#qr-count').textContent = `${qrContent.value.length} / 2500`;
  clearQrPreview();
});
['#qr-dark', '#qr-light', '#qr-size'].forEach((id) => $(id).addEventListener('input', clearQrPreview));

$('#qr-generate').addEventListener('click', async () => {
  const content = qrContent.value.trim();
  setError('#qr-error');
  if (!content) {
    setError('#qr-error', 'Enter some text or a link to create a QR code.');
    qrContent.focus();
    return;
  }
  const options = qrOptions();
  const dark = luminance(options.color.dark);
  const light = luminance(options.color.light);
  if ((Math.max(dark, light) + .05) / (Math.min(dark, light) + .05) < 3) {
    setError('#qr-error', 'Choose colors with more contrast so phones can scan the code.');
    return;
  }
  const button = $('#qr-generate');
  button.disabled = true;
  try {
    await QRCode.toCanvas(qrCanvas, content, options);
    qrValue = content;
    qrCanvas.hidden = false;
    $('#qr-placeholder').hidden = true;
    $('#qr-ready').textContent = 'READY TO SAVE';
    $('#qr-tip').textContent = 'Scan it with a phone camera to check the result.';
    $('#qr-png').disabled = false;
    $('#qr-svg').disabled = false;
  } catch (error) {
    setError('#qr-error', 'This content is too long for a QR code. Try shortening it.');
  } finally {
    button.disabled = false;
  }
});

$('#qr-png').addEventListener('click', () => {
  if (!qrValue) return;
  qrCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, 'qr-code.png');
    else setError('#qr-error', 'Could not save the PNG. Please try again.');
  }, 'image/png');
});

$('#qr-svg').addEventListener('click', async () => {
  if (!qrValue) return;
  try {
    const svg = await QRCode.toString(qrValue, { ...qrOptions(), type: 'svg' });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg');
  } catch {
    setError('#qr-error', 'Could not save the SVG. Please try again.');
  }
});

function formatBytes(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function clearImage() {
  if (busy) return;
  imageFile = null;
  imageInput.value = '';
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
  sourceUrl = null;
  cutoutUrl = null;
  $('#source-details').hidden = true;
  $('#source-thumbnail').removeAttribute('src');
  $('#cutout-image').removeAttribute('src');
  $('#cutout-image').hidden = true;
  $('#cutout-placeholder').hidden = false;
  $('#cutout-ready').textContent = 'NO IMAGE YET';
  $('#cutout-tip').textContent = 'Choose a photo to get started.';
  $('#cutout-download').disabled = true;
  $('#remove-btn').disabled = true;
  setError('#cutout-error');
}

function chooseImage(file) {
  if (busy || !file) return;
  clearImage();
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    setError('#cutout-error', 'Choose a PNG, JPG, or WebP image.');
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    setError('#cutout-error', 'Choose an image smaller than 25 MB.');
    return;
  }
  imageFile = file;
  sourceUrl = URL.createObjectURL(file);
  $('#source-thumbnail').src = sourceUrl;
  $('#source-name').textContent = file.name;
  $('#source-size').textContent = formatBytes(file.size);
  $('#source-details').hidden = false;
  $('#cutout-ready').textContent = 'READY TO PROCESS';
  $('#cutout-tip').textContent = 'Press Remove background to start.';
  $('#remove-btn').disabled = false;
}

imageInput.addEventListener('change', () => chooseImage(imageInput.files?.[0]));
$('#clear-image').addEventListener('click', clearImage);
const dropzone = $('#dropzone');
['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (event) => {
  event.preventDefault();
  if (!busy) dropzone.classList.add('is-dragging');
}));
['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-dragging');
}));
dropzone.addEventListener('drop', (event) => chooseImage(event.dataTransfer?.files?.[0]));

$('#remove-btn').addEventListener('click', async () => {
  if (!imageFile || busy) return;
  busy = true;
  const originalFile = imageFile;
  $('#remove-btn').disabled = true;
  imageInput.disabled = true;
  $('#clear-image').disabled = true;
  $('#cutout-download').disabled = true;
  $('#processing').hidden = false;
  $('#processing-label').textContent = 'Loading the AI model…';
  $('#processing-percent').textContent = '';
  $('#processing-fill').style.width = '5%';
  $('#cutout-ready').textContent = 'WORKING…';
  setError('#cutout-error');
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const blob = await removeBackground(originalFile, {
      model: 'small',
      output: { format: 'image/png' },
      progress: (_key, current, total) => {
        const percentage = total > 0 ? Math.round(current / total * 100) : 0;
        $('#processing-label').textContent = 'Downloading the AI model…';
        $('#processing-percent').textContent = `${percentage}%`;
        $('#processing-fill').style.width = `${Math.max(5, percentage)}%`;
      },
    });
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    cutoutUrl = URL.createObjectURL(blob);
    $('#cutout-image').src = cutoutUrl;
    $('#cutout-image').hidden = false;
    $('#cutout-placeholder').hidden = true;
    $('#cutout-ready').textContent = 'READY TO SAVE';
    $('#cutout-tip').textContent = 'Transparent PNG ready to download.';
    $('#cutout-download').disabled = false;
  } catch (error) {
    $('#cutout-ready').textContent = 'COULD NOT PROCESS';
    setError('#cutout-error', `Background removal failed. Check your connection and try a smaller photo. ${error?.message || ''}`);
  } finally {
    busy = false;
    imageInput.disabled = false;
    $('#clear-image').disabled = false;
    $('#remove-btn').disabled = false;
    $('#processing').hidden = true;
  }
});

$('#cutout-download').addEventListener('click', () => {
  if (!cutoutUrl || !imageFile) return;
  const link = document.createElement('a');
  link.href = cutoutUrl;
  link.download = `${imageFile.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|\x00-\x1F]/g, '_')}-transparent.png`;
  document.body.append(link);
  link.click();
  link.remove();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});
$('#install-btn').addEventListener('click', async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  } else {
    const button = $('#install-btn');
    button.textContent = 'Browser menu → Install app';
    setTimeout(() => { button.textContent = 'Install app'; }, 5000);
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
