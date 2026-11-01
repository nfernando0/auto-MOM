/**
 * mobile-bridge.js — Desktop-side WebSocket bridge for mobile mic
 * Menangani koneksi dari HP ke desktop: terima transkripsi, kirim kontrol
 */

const MobileBridge = (() => {
  let ws = null;
  let isConnected = false;
  let mobileCount = 0;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 50;

  function getWsUrl() {
    const isHttps = location.protocol === 'https:';
    const proto = isHttps ? 'wss:' : 'ws:';
    const host = location.host || 'localhost:3000';
    return `${proto}//${host}?role=desktop`;
  }

  // Callbacks
  let onTranscript = null;
  let onStatusChange = null;
  let onMobileConnect = null;
  let onMobileDisconnect = null;
  let onMarkImportant = null;
  let onSpeakerChange = null;

  function connect(callbacks = {}) {
    onTranscript = callbacks.onTranscript || null;
    onStatusChange = callbacks.onStatusChange || null;
    onMobileConnect = callbacks.onMobileConnect || null;
    onMobileDisconnect = callbacks.onMobileDisconnect || null;
    onMarkImportant = callbacks.onMarkImportant || null;
    onSpeakerChange = callbacks.onSpeakerChange || null;
    tryConnect();
  }

  function tryConnect() {
    if (ws) { try { ws.close(); } catch(_) {} }
    try {
      ws = new WebSocket(getWsUrl());
    } catch (_) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      isConnected = true;
      reconnectAttempts = 0;
      if (onStatusChange) onStatusChange('connected');
      sendSpeakerConfig();
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        handleMessage(msg);
      } catch(_) {}
    };

    ws.onclose = () => {
      isConnected = false;
      if (onStatusChange) onStatusChange('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      isConnected = false;
    };
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectAttempts++;
    if (reconnectAttempts > MAX_RECONNECT) return;
    const delay = Math.min(1000 * reconnectAttempts, 4000);
    reconnectTimer = setTimeout(tryConnect, delay);
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'mobile_connected':
        mobileCount = msg.count || 1;
        if (onMobileConnect) onMobileConnect(mobileCount);
        sendSpeakerConfig();
        break;
      case 'mobile_disconnected':
        mobileCount = msg.count || 0;
        if (onMobileDisconnect) onMobileDisconnect(mobileCount);
        break;
      case 'mobile_ready':
        sendSpeakerConfig();
        break;
      case 'transcript':
        if (onTranscript) onTranscript(msg);
        break;
      case 'mark_important':
        if (onMarkImportant) onMarkImportant();
        break;
      case 'speaker_change':
        if (onSpeakerChange) onSpeakerChange(msg.speakerIdx);
        break;
      case 'recording_started':
        if (onStatusChange) onStatusChange('mobile_recording');
        break;
    }
  }

  function sendToMobile(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  let _speakerCount = 2;
  let _speakerNames = [];

  function updateSpeakerConfig(count, names) {
    _speakerCount = count;
    _speakerNames = names;
    sendSpeakerConfig();
  }

  function sendSpeakerConfig() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendToMobile({
        type: 'set_speakers',
        count: _speakerCount,
        names: _speakerNames,
      });
    }
  }

  function stopMobile() { sendToMobile({ type: 'stop_recording' }); }
  function setMobileSpeaker(idx) { sendToMobile({ type: 'set_speaker', idx }); }
  function getIsConnected() { return isConnected; }
  function getMobileCount() { return mobileCount; }

  return {
    connect, sendToMobile, stopMobile, setMobileSpeaker,
    updateSpeakerConfig, sendSpeakerConfig, getIsConnected, getMobileCount,
  };
})();
