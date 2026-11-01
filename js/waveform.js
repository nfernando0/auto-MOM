/**
 * waveform.js — Real-time audio waveform visualization using Canvas API
 */

const Waveform = (() => {
  let canvas = null;
  let ctx = null;
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let stream = null;
  let animFrame = null;
  let isRunning = false;
  let bufferLength = 0;
  let dataArray = null;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  async function start() {
    if (isRunning) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      isRunning = true;
      draw();
    } catch (e) {
      console.warn('Waveform: Could not access microphone', e);
      drawIdle();
    }
  }

  function stop() {
    isRunning = false;
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (source) { try { source.disconnect(); } catch (_) {} }
    if (audioCtx) { audioCtx.close(); }
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; source = null; audioCtx = null; analyser = null;
    drawIdle();
  }

  function pause() {
    isRunning = false;
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    drawPaused();
  }

  function resume() {
    if (!isRunning && analyser) {
      isRunning = true;
      draw();
    }
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  function getCanvasSize() {
    if (!canvas) return { w: 300, h: 60 };
    return {
      w: canvas.width / (window.devicePixelRatio || 1),
      h: canvas.height / (window.devicePixelRatio || 1),
    };
  }

  function clearCanvas() {
    if (!ctx || !canvas) return;
    const { w, h } = getCanvasSize();
    ctx.clearRect(0, 0, w, h);
  }

  function draw() {
    if (!isRunning || !ctx || !analyser) return;
    animFrame = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    const { w, h } = getCanvasSize();
    ctx.clearRect(0, 0, w, h);

    const barW = (w / bufferLength) * 2.2;
    let x = 0;

    // Gradient
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#00d4aa');
    grad.addColorStop(0.5, '#7c3aed');
    grad.addColorStop(1, '#00d4aa');

    for (let i = 0; i < bufferLength; i++) {
      const barH = (dataArray[i] / 255) * h * 0.9;
      const y = h / 2 - barH / 2;

      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.85;
      roundRect(ctx, x, y, barW - 1, barH, 2);
      ctx.fill();

      x += barW + 0.5;
    }
    ctx.globalAlpha = 1;
  }

  function drawIdle() {
    if (!ctx || !canvas) return;
    const { w, h } = getCanvasSize();
    ctx.clearRect(0, 0, w, h);
    // Draw flat line
    ctx.strokeStyle = 'rgba(0,212,170,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    // Small center dot
    ctx.fillStyle = 'rgba(0,212,170,0.4)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPaused() {
    if (!ctx || !canvas) return;
    const { w, h } = getCanvasSize();
    ctx.clearRect(0, 0, w, h);
    const barCount = 20;
    const barW = 3;
    const gap = (w - barCount * barW) / (barCount + 1);
    for (let i = 0; i < barCount; i++) {
      const x = gap + i * (barW + gap);
      const barH = 4 + Math.sin(i * 0.7) * 6;
      const y = h / 2 - barH / 2;
      ctx.fillStyle = 'rgba(245,158,11,0.4)';
      roundRect(ctx, x, y, barW, barH, 1.5);
      ctx.fill();
    }
  }

  function roundRect(ctx, x, y, width, height, radius) {
    if (height <= 0) height = 1;
    if (width <= 0) width = 1;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  return { init, start, stop, pause, resume, drawIdle, drawPaused };
})();
