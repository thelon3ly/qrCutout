import QRCode from 'qrcode';
import { initCutout } from './cutout.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const qrContent = $('#qr-content');
const qrCanvas = $('#qr-canvas');
let qrValue = '';
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
    color: { dark: $('#qr-dark').value, light: $('#qr-transparent').checked ? '#00000000' : $('#qr-light').value },
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
['#qr-dark', '#qr-light', '#qr-size', '#qr-transparent'].forEach((id) => $(id).addEventListener('input', clearQrPreview));
$('#qr-transparent').addEventListener('change', () => { $('#qr-light').disabled = $('#qr-transparent').checked; });

$('#qr-generate').addEventListener('click', async () => {
  const content = qrContent.value.trim();
  setError('#qr-error');
  if (!content) {
    setError('#qr-error', 'Enter some text or a link to create a QR code.');
    qrContent.focus();
    return;
  }
  if (!$('#qr-size').checkValidity() || !Number.isInteger(Number($('#qr-size').value))) {
    setError('#qr-error', 'Enter a whole-number size from 128 to 4096 pixels.');
    $('#qr-size').focus();
    return;
  }
  const options = qrOptions();
  const dark = luminance(options.color.dark);
  const light = $('#qr-transparent').checked ? null : luminance(options.color.light);
  if (light !== null && (Math.max(dark, light) + .05) / (Math.min(dark, light) + .05) < 3) {
    setError('#qr-error', 'Choose colors with more contrast so phones can scan the code.');
    return;
  }
  const button = $('#qr-generate');
  button.disabled = true;
  try {
    await QRCode.toCanvas(qrCanvas, content, options);
    // The renderer fixes the canvas's display size to its export size.
    // Let the stylesheet scale the preview without changing the PNG pixels.
    qrCanvas.style.removeProperty('width');
    qrCanvas.style.removeProperty('height');
    qrValue = content;
    qrCanvas.hidden = false;
    $('#qr-stage').classList.toggle('is-transparent', $('#qr-transparent').checked);
    $('#qr-placeholder').hidden = true;
    $('#qr-ready').textContent = 'READY TO SAVE';
    $('#qr-tip').textContent = $('#qr-transparent').checked ? 'Transparent background: place it on a light surface and scan with a phone to check it.' : 'Scan it with a phone camera to check the result.';
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

initCutout({ downloadBlob, setError });

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
