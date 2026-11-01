/**
 * transcription.js — Real-time speech-to-text using Web Speech API
 * Supports: Bahasa Indonesia, English, Auto-detect rotation
 */

const Transcription = (() => {
  let recognition = null;
  let isListening = false;
  let isPaused = false;
  let currentSpeakerIdx = 0;
  let speakerCount = 2;
  let language = 'id-ID';
  let restartTimer = null;
  let onResultCb = null;
  let onInterimCb = null;
  let onErrorCb = null;
  let onStartCb = null;
  let onEndCb = null;

  // ── Check Browser Support ────────────────────────────────────────────────
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = !!SpeechRecognition;

  // ── Speaker Colors ────────────────────────────────────────────────────────
  const SPEAKER_COLORS = [
    '#00d4aa', '#7c3aed', '#f59e0b', '#f43f5e',
    '#3b82f6', '#ec4899', '#14b8a6', '#a855f7',
  ];

  function getSpeakerColor(idx) {
    return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
  }

  function getSpeakerName(idx, customNames) {
    if (customNames && customNames[idx]) return customNames[idx];
    return `Speaker ${idx + 1}`;
  }

  // ── Build Recognition Instance ────────────────────────────────────────────
  function buildRecognition(lang) {
    if (!isSupported) return null;
    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.lang = lang === 'auto' ? 'id-ID' : lang;
    return r;
  }

  // ── Attach handlers ───────────────────────────────────────────────────────
  function attachHandlers(r) {
    r.onstart = () => {
      isListening = true;
      if (onStartCb) onStartCb();
    };

    r.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalTranscript += res[0].transcript;
        } else {
          interimTranscript += res[0].transcript;
        }
      }

      if (interimTranscript && onInterimCb) {
        onInterimCb(interimTranscript.trim());
      }

      if (finalTranscript.trim() && onResultCb) {
        onResultCb({
          text: finalTranscript.trim(),
          speakerIdx: currentSpeakerIdx,
          confidence: event.results[event.resultIndex]?.[0]?.confidence || 1,
        });
      }
    };

    r.onerror = (event) => {
      // Gracefully handle "no-speech" — just restart
      if (event.error === 'no-speech') {
        if (isListening && !isPaused) scheduleRestart();
        return;
      }
      if (event.error === 'aborted') return;
      if (onErrorCb) onErrorCb(event.error);
    };

    r.onend = () => {
      isListening = false;
      if (!isPaused && recognition) {
        scheduleRestart();
      } else {
        if (onEndCb) onEndCb();
      }
    };
  }

  function scheduleRestart(delay = 300) {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!isPaused && recognition) {
        try { recognition.start(); } catch (_) {}
      }
    }, delay);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function init(options = {}) {
    language = options.language || 'id-ID';
    speakerCount = options.speakerCount || 2;
    currentSpeakerIdx = 0;
    onResultCb = options.onResult || null;
    onInterimCb = options.onInterim || null;
    onErrorCb = options.onError || null;
    onStartCb = options.onStart || null;
    onEndCb = options.onEnd || null;
  }

  function start() {
    if (!isSupported) {
      if (onErrorCb) onErrorCb('not-supported');
      return false;
    }
    stop(); // ensure clean state
    isPaused = false;
    recognition = buildRecognition(language);
    attachHandlers(recognition);
    try {
      recognition.start();
      return true;
    } catch (e) {
      if (onErrorCb) onErrorCb(e.message);
      return false;
    }
  }

  function stop() {
    isPaused = true;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
      recognition = null;
    }
    isListening = false;
  }

  function pause() {
    isPaused = true;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    isListening = false;
  }

  function resume() {
    if (!recognition) {
      recognition = buildRecognition(language);
      attachHandlers(recognition);
    }
    isPaused = false;
    try { recognition.start(); } catch (_) {}
  }

  function nextSpeaker() {
    currentSpeakerIdx = (currentSpeakerIdx + 1) % speakerCount;
    return currentSpeakerIdx;
  }

  function setSpeaker(idx) {
    currentSpeakerIdx = Math.max(0, Math.min(idx, speakerCount - 1));
    return currentSpeakerIdx;
  }

  function getCurrentSpeaker() { return currentSpeakerIdx; }
  function getIsListening() { return isListening && !isPaused; }
  function getIsSupported() { return isSupported; }

  // ── Mic Test ──────────────────────────────────────────────────────────────
  let micTestStream = null;
  let micTestAnalyser = null;
  let micTestAnimFrame = null;
  let micTestAudioCtx = null;

  async function startMicTest(onLevel) {
    try {
      micTestStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micTestAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = micTestAudioCtx.createMediaStreamSource(micTestStream);
      micTestAnalyser = micTestAudioCtx.createAnalyser();
      micTestAnalyser.fftSize = 256;
      src.connect(micTestAnalyser);
      const data = new Uint8Array(micTestAnalyser.frequencyBinCount);

      function tick() {
        micTestAnalyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const level = Math.min(100, avg * 3);
        if (onLevel) onLevel(level);
        micTestAnimFrame = requestAnimationFrame(tick);
      }
      tick();
      return true;
    } catch (e) {
      return false;
    }
  }

  function stopMicTest() {
    if (micTestAnimFrame) cancelAnimationFrame(micTestAnimFrame);
    if (micTestAnalyser) micTestAnalyser.disconnect();
    if (micTestAudioCtx) micTestAudioCtx.close();
    if (micTestStream) micTestStream.getTracks().forEach(t => t.stop());
    micTestStream = null; micTestAnalyser = null; micTestAudioCtx = null; micTestAnimFrame = null;
  }

  return {
    init, start, stop, pause, resume,
    nextSpeaker, setSpeaker, getCurrentSpeaker,
    getIsListening, getIsSupported,
    getSpeakerColor, getSpeakerName,
    startMicTest, stopMicTest,
  };
})();
