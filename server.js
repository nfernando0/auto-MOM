/**
 * server.js — Auto MOM System Local Server
 * Melayani aplikasi web dan menghubungkan HP ke laptop via WebSocket
 *
 * Fitur:
 * - HTTP server untuk file statis (laptop & mobile page)
 * - WebSocket relay antara HP (mobile mic) dan Laptop (desktop app)
 * - QR Code di terminal untuk koneksi cepat
 * - Auto-detect IP lokal
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const os = require('os');

const PORT = 3000;

// ── Get local IP ─────────────────────────────────────────────────────────────
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
const BASE_URL = `http://${LOCAL_IP}:${PORT}`;

// ── MIME Types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS headers untuk WebSocket dan cross-origin assets
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  let urlPath = req.url.split('?')[0]; // strip query

  // Route: /mobile → halaman HP
  if (urlPath === '/mobile' || urlPath === '/mobile/') {
    urlPath = '/mobile.html';
  }

  // Default ke index.html
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

// ── WebSocket Server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

// Dua room: desktop (laptop) dan mobile (HP)
const clients = {
  desktop: new Set(),
  mobile: new Set(),
};

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, BASE_URL);
  const role = url.searchParams.get('role') || 'desktop';

  if (role === 'mobile') {
    clients.mobile.add(ws);
    console.log(`📱 HP terhubung (total: ${clients.mobile.size})`);
    broadcastToDesktop({ type: 'mobile_connected', count: clients.mobile.size });
  } else {
    clients.desktop.add(ws);
    console.log(`💻 Desktop terhubung (total: ${clients.desktop.size})`);
    // Beritahu mobile jika ada desktop yang ready
    broadcastToMobile({ type: 'desktop_ready' });
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (role === 'mobile') {
        // HP mengirim transkripsi → relay ke desktop
        broadcastToDesktop(msg);
      } else {
        // Desktop mengirim kontrol → relay ke HP
        broadcastToMobile(msg);
      }
    } catch (e) {
      console.error('Invalid message:', e.message);
    }
  });

  ws.on('close', () => {
    if (role === 'mobile') {
      clients.mobile.delete(ws);
      console.log(`📱 HP disconnect (sisa: ${clients.mobile.size})`);
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

// ── Start Server + Print QR ───────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', async () => {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║          🎙  AUTO MOM SYSTEM — SERVER            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  💻 Desktop App  : ${BASE_URL.padEnd(29)}║`);
  console.log(`║  📱 Mobile URL   : ${(BASE_URL + '/mobile').padEnd(29)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('📲 Scan QR Code berikut dengan HP Anda:\n');

  try {
    const qr = await QRCode.toString(`${BASE_URL}/mobile`, { type: 'terminal', small: true });
    console.log(qr);
  } catch (e) {
    console.log(`URL HP: ${BASE_URL}/mobile`);
  }

  console.log('\n💡 Pastikan HP dan laptop terhubung ke WiFi yang SAMA');
  console.log('⏹  Tekan Ctrl+C untuk menghentikan server\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} sudah digunakan. Tutup aplikasi lain atau ganti PORT di server.js`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
