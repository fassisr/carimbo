// Leitor de QR pela câmera: usa o leitor nativo do Android (BarcodeDetector) e, se não houver, o jsQR.
window.fuilaScanQR = function (video, onText) {
  let stream = null, timer = 0, stopped = false, det = null;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  async function tick() {
    if (stopped) return;
    if (video.readyState >= 2 && video.videoWidth) {
      let txt = null;
      if (det) { try { txt = (await det.detect(video))[0]?.rawValue || null; } catch (e) { det = null; } }
      else if (window.jsQR) {
        const s = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        cv.width = Math.round(video.videoWidth * s); cv.height = Math.round(video.videoHeight * s);
        ctx.drawImage(video, 0, 0, cv.width, cv.height);
        const img = ctx.getImageData(0, 0, cv.width, cv.height);
        txt = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || null;
      }
      if (txt && !stopped && onText(txt) === true) return api.stop();
    }
    timer = setTimeout(tick, 150);
  }
  const api = {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (stopped) return api.stop();
      video.setAttribute('playsinline', ''); video.muted = true; video.srcObject = stream;
      await video.play();
      if ('BarcodeDetector' in window) {
        try { if ((await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) det = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) {}
      }
      if (!det && !window.jsQR) await load('assets/vendor/jsQR.js');
      tick();
    },
    stop() { stopped = true; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); video.srcObject = null; },
  };
  return api;
};
// Lê o conteúdo do QR do Fuilá: link https://.../?p=ID&k=CODIGO, ou só o código digitado
window.fuilaParseQR = function (txt) {
  txt = String(txt || '').trim();
  try { const u = new URL(txt); const p = u.searchParams.get('p'), k = u.searchParams.get('k'); if (k) return { p, k }; } catch (e) {}
  const m = txt.match(/^FUILA:([\w-]+):(\w+)$/i); if (m) return { p: m[1], k: m[2] };
  if (/^[A-Z0-9]{4,10}$/i.test(txt)) return { p: null, k: txt.toUpperCase() };
  return null;
};
