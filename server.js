/**
 * server.js — Auto MOM System Local Server
 * Melayani aplikasi web dan menghubungkan HP ke laptop via WebSocket
 * 
 * Mendukung:
 * - HTTP pada port 3000 (untuk Desktop Laptop: http://localhost:3000)
 * - HTTPS pada port 3001 (untuk HP Mobile Mic: https://<IP>:3001/mobile dengan izin mic aman)
 * - WebSocket relay dua arah antara Laptop dan HP
 * - QR code otomatis di browser dan terminal
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const selfsigned = require('selfsigned');

const HTTP_PORT = 3000;
const HTTPS_PORT = 3001;

// ── Get local IPv4 ───────────────────────────────────────────────────────────
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();
const DESKTOP_URL = `http://localhost:${HTTP_PORT}`;
const MOBILE_HTTPS_URL = `https://${LOCAL_IP}:${HTTPS_PORT}/mobile`;
const MOBILE_HTTP_URL = `http://${LOCAL_IP}:${HTTP_PORT}/mobile`;

// ── MIME Types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

// ── Shared Clients for WebSocket ─────────────────────────────────────────────
const clients = {
  desktop: new Set(),
  mobile: new Set(),
};

function broadcastToDesktop(msg) {
  const str = JSON.stringify(msg);
  for (const ws of clients.desktop) {
    if (ws.readyState === 1) ws.send(str);
  }
}

function broadcastToMobile(msg) {
  const str = JSON.stringify(msg);
  for (const ws of clients.mobile) {
    if (ws.readyState === 1) ws.send(str);
  }
}

function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    let role = 'desktop';
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      role = parsedUrl.searchParams.get('role') || 'desktop';
    } catch (_) {}

    if (role === 'mobile') {
      clients.mobile.add(ws);
      console.log(`📱 HP terhubung! (Total HP: ${clients.mobile.size})`);
      broadcastToDesktop({ type: 'mobile_connected', count: clients.mobile.size });
    } else {
      clients.desktop.add(ws);
      console.log(`💻 Desktop terhubung! (Total Desktop: ${clients.desktop.size})`);
      if (clients.mobile.size > 0) {
        broadcastToDesktop({ type: 'mobile_connected', count: clients.mobile.size });
      }
      broadcastToMobile({ type: 'desktop_ready' });
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (role === 'mobile') {
          broadcastToDesktop(msg);
        } else {
          broadcastToMobile(msg);
        }
      } catch (e) {
        console.error('Invalid WS message:', e.message);
      }
    });

    ws.on('close', () => {
      if (role === 'mobile') {
        clients.mobile.delete(ws);
        console.log(`📱 HP terputus. (Sisa HP: ${clients.mobile.size})`);
        broadcastToDesktop({ type: 'mobile_disconnected', count: clients.mobile.size });
      } else {
        clients.desktop.delete(ws);
        console.log(`💻 Desktop disconnect`);
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error [${role}]:`, err.message);
    });
  });

  return wss;
}

// ── HTTP/HTTPS Request Handler ───────────────────────────────────────────────
function createRequestHandler(cachedQRDataUrl) {
  return (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const urlPath = req.url.split('?')[0];

    // API: Info & QR
    if (urlPath === '/api/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ip: LOCAL_IP,
        httpPort: HTTP_PORT,
        httpsPort: HTTPS_PORT,
        desktopUrl: DESKTOP_URL,
        mobileHttpsUrl: MOBILE_HTTPS_URL,
        mobileHttpUrl: MOBILE_HTTP_URL,
        mobileUrl: MOBILE_HTTPS_URL,
        qrDataUrl: cachedQRDataUrl,
      }));
      return;
    }

    // Routing
    let filePath = urlPath;
    if (filePath === '/' || filePath === '') filePath = '/index.html';
    else if (filePath === '/mobile' || filePath === '/mobile/') filePath = '/mobile.html';

    const fullPath = path.join(__dirname, filePath);

    fs.stat(fullPath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found: ' + urlPath);
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(fullPath).pipe(res);
    });
  };
}

// ── Boot Servers ──────────────────────────────────────────────────────────────
async function start() {
  console.log('🔄 Mempersiapkan sertifikat SSL & QR code...');

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(MOBILE_HTTPS_URL, {
      margin: 1,
      width: 240,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (err) {
    console.warn('Gagal membuat QR data URL:', err.message);
  }

  // Generate self-signed cert for HTTPS (makes mobile Chrome allow microphone)
  let pems = null;
  try {
    pems = await selfsigned.generate([
      { name: 'commonName', value: LOCAL_IP },
      { name: 'organizationName', value: 'Auto MOM System' }
    ], { days: 365, keySize: 2048 });
  } catch (err) {
    console.warn('Selfsigned generation error, fallback without HTTPS:', err.message);
  }

  const handler = createRequestHandler(qrDataUrl);

  // 1. HTTP Server (Port 3000)
  const httpServer = http.createServer(handler);
  setupWebSocketServer(httpServer);
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`✅ HTTP Server aktif di port ${HTTP_PORT}`);
  });

  // 2. HTTPS Server (Port 3001) for Mobile
  if (pems && pems.cert && pems.private) {
    const httpsServer = https.createServer({
      key: pems.private,
      cert: pems.cert,
    }, handler);
    setupWebSocketServer(httpsServer);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`✅ HTTPS Server aktif di port ${HTTPS_PORT} (Khusus mic HP)`);
    });
  }

  // Terminal banner
  setTimeout(async () => {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║             🎙  AUTO MOM SYSTEM — SERVER                 ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  💻 Laptop / Desktop : ${DESKTOP_URL.padEnd(34)}║`);
    console.log(`║  📱 HP Mobile Mic    : ${MOBILE_HTTPS_URL.padEnd(34)}║`);
    console.log(`║  🌐 HP Fallback HTTP : ${MOBILE_HTTP_URL.padEnd(34)}║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('📲 Scan QR Code ini dengan HP untuk membuka Mobile Mic:\n');
    try {
      const qrTerminal = await QRCode.toString(MOBILE_HTTPS_URL, { type: 'terminal', small: true });
      console.log(qrTerminal);
    } catch (_) {
      console.log(`Buka URL di HP: ${MOBILE_HTTPS_URL}`);
    }

    console.log('\n💡 Tips:');
    console.log('1. Pastikan HP & Laptop terhubung ke WiFi / Hotspot yang sama.');
    console.log('2. Di browser HP, jika muncul "Koneksi tidak privat", tap "Lanjutan" -> "Lanjutkan ke situs".');
    console.log('3. Tekan Ctrl+C di terminal ini untuk berhenti.\n');
  }, 300);
}

start().catch(err => {
  console.error('Fatal server startup error:', err);
});
