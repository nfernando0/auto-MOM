/**
 * app.js — Main application controller for Auto MOM System
 * Orchestrates all modules: Store, Transcription, Waveform, MOMGenerator, Exporter
 */

// =====================================================================
// UTILITIES
// =====================================================================
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg, type = 'info', duration = 3000) {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function formatTimer(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function showView(id) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(id).classList.add('active');
}

// =====================================================================
// STATE
// =====================================================================
let participants = [];
let selectedLang = 'id-ID';
let selectedTemplate = 'standard';
let speakerCount = 2;
let speakerNames = [];
let currentSpeakerIdx = 0;
let recordingSeconds = 0;
let timerInterval = null;
let isPaused = false;
let micTestActive = false;

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  initDateField();
  initSetupHandlers();
  initRecordingHandlers();
  initResultHandlers();
  initSidebarHandlers();
  renderMeetingList();
  Waveform.drawIdle();
  Waveform.init($('waveformCanvas'));
});

// =====================================================================
// SETUP VIEW
// =====================================================================
function initDateField() {
  const now = new Date();
  now.setSeconds(0, 0);
  $('meetingDate').value = now.toISOString().slice(0, 16);
  updateHeaderDate();
}

function updateHeaderDate() {
  const val = $('meetingDate').value;
  if (val) {
    const d = new Date(val);
    $('meetingDateDisplay').textContent = d.toLocaleDateString('id-ID', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}

function initSetupHandlers() {
  // Title
  $('meetingTitle').addEventListener('input', () => {
    $('meetingTitleDisplay').textContent = $('meetingTitle').value || 'Meeting Baru';
  });
  $('meetingDate').addEventListener('change', updateHeaderDate);

  // Participants
  $('participantInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addParticipant(); }
  });
  $('addParticipantBtn').addEventListener('click', addParticipant);

  // Template
  $$('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.template-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTemplate = btn.dataset.template;
    });
  });

  // Language
  $$('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedLang = btn.dataset.lang;
    });
  });

  // Speaker count
  $('speakerDecBtn').addEventListener('click', () => {
    speakerCount = Math.max(1, speakerCount - 1);
    $('speakerCountDisplay').textContent = speakerCount;
  });
  $('speakerIncBtn').addEventListener('click', () => {
    speakerCount = Math.min(8, speakerCount + 1);
    $('speakerCountDisplay').textContent = speakerCount;
  });

  // Mic test
  $('micTestBtn').addEventListener('click', toggleMicTest);

  // Start meeting
  $('startMeetingBtn').addEventListener('click', startMeeting);
}

function addParticipant() {
  const input = $('participantInput');
  const name = input.value.trim();
  if (!name) return;
  if (participants.includes(name)) { showToast('Peserta sudah ada', 'warning'); return; }
  participants.push(name);
  renderParticipantTags();
  input.value = '';
  input.focus();
}

function removeParticipant(name) {
  participants = participants.filter(p => p !== name);
  renderParticipantTags();
}

function renderParticipantTags() {
  $('participantsTags').innerHTML = participants.map(p => `
    <span class="participant-tag">
      ${MOMGenerator.escHtml(p)}
      <button class="tag-remove" onclick="removeParticipant('${p.replace(/'/g, "\\'")}')" title="Hapus">×</button>
    </span>
  `).join('');
}

async function toggleMicTest() {
  const btn = $('micTestBtn');
  const statusEl = $('micStatus');
  if (!micTestActive) {
    micTestActive = true;
    btn.classList.add('active');
    statusEl.textContent = 'Menguji...';
    const ok = await Transcription.startMicTest((level) => {
      $('micLevelFill').style.width = level + '%';
    });
    if (!ok) {
      showToast('Tidak bisa mengakses mikrofon. Izinkan akses mic di browser.', 'error');
      micTestActive = false;
      btn.classList.remove('active');
      statusEl.textContent = 'Gagal';
    } else {
      statusEl.textContent = '🎙 Aktif';
    }
  } else {
    micTestActive = false;
    btn.classList.remove('active');
    Transcription.stopMicTest();
    $('micLevelFill').style.width = '0%';
    statusEl.textContent = 'Siap';
  }
}

async function startMeeting() {
  const title = $('meetingTitle').value.trim();
  if (!title) {
    showToast('Masukkan judul meeting terlebih dahulu', 'warning');
    $('meetingTitle').focus();
    return;
  }

  if (!Transcription.getIsSupported()) {
    showToast('Browser Anda tidak mendukung Web Speech API. Gunakan Chrome atau Edge.', 'error', 5000);
    return;
  }

  // Stop mic test if active
  if (micTestActive) toggleMicTest();

  // Build speaker names from participant list (or generic)
  speakerNames = [];
  for (let i = 0; i < speakerCount; i++) {
    speakerNames.push(participants[i] || `Speaker ${i + 1}`);
  }

  // Create meeting
  const meeting = Store.createMeeting({
    title,
    date: $('meetingDate').value || new Date().toISOString(),
    location: $('meetingLocation').value.trim(),
    facilitator: $('meetingFacilitator').value.trim(),
    participants: [...participants],
    agenda: $('agendaInput').value.trim(),
    template: selectedTemplate,
    language: selectedLang,
    speakerCount,
    speakerNames: [...speakerNames],
  });

  currentSpeakerIdx = 0;
  isPaused = false;
  recordingSeconds = 0;

  // Switch view
  showView('viewRecording');
  $('meetingTitleDisplay').textContent = title;

  // Render speaker list
  renderSpeakerList();

  // Start timer
  startTimer();

  // Show recording badge
  $('recordingBadge').classList.remove('hidden');

  // Init transcription
  Transcription.init({
    language: selectedLang,
    speakerCount,
    onResult: handleTranscriptResult,
    onInterim: (text) => { $('interimDisplay').textContent = `⌛ ${text}` },
    onStart: () => { /* noop */ },
    onError: (err) => {
      if (err === 'not-allowed' || err === 'permission-denied') {
        showToast('Akses mikrofon ditolak. Izinkan akses mic dan coba lagi.', 'error', 5000);
      } else if (err !== 'no-speech' && err !== 'aborted') {
        showToast(`Speech error: ${err}`, 'error');
      }
    },
    onEnd: () => { $('interimDisplay').textContent = ''; },
  });

  const started = Transcription.start();
  if (!started) {
    showToast('Gagal memulai transkripsi', 'error');
    return;
  }

  // Start waveform
  await Waveform.start();

  Store.saveCurrentMeeting();
  renderMeetingList();
  showToast('🎙 Recording dimulai!', 'success');
}

// =====================================================================
// RECORDING VIEW
// =====================================================================
function initRecordingHandlers() {
  $('pauseBtn').addEventListener('click', togglePause);
  $('stopBtn').addEventListener('click', stopMeeting);
  $('nextSpeakerBtn').addEventListener('click', switchToNextSpeaker);
  $('markBtn').addEventListener('click', markLastEntry);
  $('clearTranscriptBtn').addEventListener('click', clearTranscript);
  $('addSpeakerBtn').addEventListener('click', () => promptSpeakerName());
  $('addActionBtn').addEventListener('click', () => openActionItemModal());
  $('saveActionItemBtn').addEventListener('click', saveActionItem);
  $('closeActionModal').addEventListener('click', () => $('actionItemModal').classList.add('hidden'));
  $('actionItemModal').addEventListener('click', (e) => { if (e.target === $('actionItemModal')) $('actionItemModal').classList.add('hidden'); });
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!isPaused) {
      recordingSeconds++;
      if (Store.state.currentMeeting) {
        Store.state.currentMeeting.duration = recordingSeconds;
      }
      $('recTimer').textContent = formatTimer(recordingSeconds);
    }
  }, 1000);
}

function togglePause() {
  isPaused = !isPaused;
  const btn = $('pauseBtn');
  if (isPaused) {
    Transcription.pause();
    Waveform.pause();
    btn.classList.add('paused');
    btn.title = 'Lanjutkan';
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    showToast('⏸ Rekaman dijeda', 'warning');
  } else {
    Transcription.resume();
    Waveform.resume();
    btn.classList.remove('paused');
    btn.title = 'Jeda Rekaman';
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    showToast('▶ Rekaman dilanjutkan', 'info');
  }
}

function stopMeeting() {
  if (!confirm('Apakah Anda yakin ingin mengakhiri meeting dan membuat MOM?')) return;

  // Stop all
  clearInterval(timerInterval);
  Transcription.stop();
  Waveform.stop();

  $('recordingBadge').classList.add('hidden');
  $('interimDisplay').textContent = '';

  // Save notes
  if (Store.state.currentMeeting) {
    Store.state.currentMeeting.notes = $('notesTextarea').value;
    Store.state.currentMeeting.status = 'completed';
  }

  Store.saveCurrentMeeting();
  renderMeetingList();

  // Show MOM result
  renderMOMDocument();
  showView('viewResult');
  showToast('✅ Meeting selesai! MOM telah dibuat.', 'success', 4000);
}

function handleTranscriptResult({ text, speakerIdx }) {
  const meeting = Store.state.currentMeeting;
  if (!meeting) return;

  const speakerName = speakerNames[speakerIdx] || `Speaker ${speakerIdx + 1}`;
  const entry = Store.addTranscriptEntry(speakerIdx, speakerName, text, recordingSeconds);
  if (!entry) return;

  renderTranscriptEntry(entry);
  $('interimDisplay').textContent = '';

  // Auto-save every 10 entries
  if (meeting.transcript.length % 10 === 0) {
    Store.saveCurrentMeeting();
  }
}

function renderTranscriptEntry(entry) {
  const body = $('transcriptBody');

  // Remove placeholder if present
  const placeholder = body.querySelector('.transcript-placeholder');
  if (placeholder) placeholder.remove();

  const color = Transcription.getSpeakerColor(entry.speakerIdx);
  const time = formatTimer(entry.timestamp || 0);

  const el = document.createElement('div');
  el.className = `transcript-entry${entry.starred ? ' starred' : ''}`;
  el.id = `entry-${entry.id}`;
  el.innerHTML = `
    <span class="entry-speaker-tag" style="background:${color}22;border:1px solid ${color}66;color:${color}">${MOMGenerator.escHtml(entry.speakerName)}</span>
    <div class="entry-bubble">
      <div class="entry-meta">
        <span class="entry-time">${time}</span>
        <div class="entry-actions">
          <button class="entry-action-btn star-btn${entry.starred ? ' active' : ''}" onclick="toggleStar('${entry.id}', this)" title="Tandai penting">★</button>
          <button class="entry-action-btn" onclick="editEntry('${entry.id}', this)" title="Edit">✏</button>
          <button class="entry-action-btn" onclick="deleteEntry('${entry.id}')" title="Hapus">✕</button>
        </div>
      </div>
      <div class="entry-text" id="text-${entry.id}">${MOMGenerator.escHtml(entry.text)}</div>
    </div>
  `;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;

  updateSpeakerStats();
}

function toggleStar(id, btn) {
  Store.toggleStar(id);
  const el = document.getElementById(`entry-${id}`);
  if (el) el.classList.toggle('starred');
  btn.classList.toggle('active');
}

function editEntry(id, btn) {
  const textEl = $(`text-${id}`);
  if (!textEl) return;
  const current = textEl.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'form-input';
  input.style.marginTop = '4px';
  textEl.replaceWith(input);
  input.focus();
  input.addEventListener('blur', () => {
    const newText = input.value.trim() || current;
    Store.updateEntryText(id, newText);
    const p = document.createElement('div');
    p.className = 'entry-text';
    p.id = `text-${id}`;
    p.textContent = newText;
    input.replaceWith(p);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
}

function deleteEntry(id) {
  Store.deleteEntry(id);
  const el = $(`entry-${id}`);
  if (el) el.remove();
  if (!Store.state.currentMeeting?.transcript.length) {
    $('transcriptBody').innerHTML = `
      <div class="transcript-placeholder">
        <div class="placeholder-icon">🎙️</div>
        <p>Transkripsi akan muncul di sini saat Anda mulai bicara...</p>
      </div>`;
  }
  updateSpeakerStats();
}

function clearTranscript() {
  if (!confirm('Hapus semua transkripsi?')) return;
  if (Store.state.currentMeeting) Store.state.currentMeeting.transcript = [];
  $('transcriptBody').innerHTML = `
    <div class="transcript-placeholder">
      <div class="placeholder-icon">🎙️</div>
      <p>Transkripsi akan muncul di sini saat Anda mulai bicara...</p>
    </div>`;
  updateSpeakerStats();
}

function markLastEntry() {
  const meeting = Store.state.currentMeeting;
  if (!meeting || !meeting.transcript.length) return;
  const last = meeting.transcript[meeting.transcript.length - 1];
  Store.toggleStar(last.id);
  const el = $(`entry-${last.id}`);
  if (el) {
    el.classList.toggle('starred');
    const btn = el.querySelector('.star-btn');
    if (btn) btn.classList.toggle('active');
  }
  showToast(last.starred ? '⭐ Poin ditandai penting!' : '✩ Tanda dihapus', 'info');
}

// ── Speaker Management ─────────────────────────────────────────────────────
function renderSpeakerList() {
  const list = $('speakerList');
  list.innerHTML = '';
  for (let i = 0; i < speakerCount; i++) {
    const color = Transcription.getSpeakerColor(i);
    const name = speakerNames[i] || `Speaker ${i + 1}`;
    const el = document.createElement('div');
    el.className = `speaker-item${i === currentSpeakerIdx ? ' active' : ''}`;
    el.id = `speaker-item-${i}`;
    el.innerHTML = `
      <div class="speaker-dot" style="background:${color}"></div>
      <span class="speaker-name">${MOMGenerator.escHtml(name)}</span>
      <span class="speaker-word-count" id="wc-${i}">0 kata</span>
    `;
    el.addEventListener('click', () => {
      currentSpeakerIdx = i;
      Transcription.setSpeaker(i);
      updateActiveSpeaker();
    });
    list.appendChild(el);
  }
  updateActiveSpeaker();
}

function updateActiveSpeaker() {
  $$('.speaker-item').forEach((el, i) => el.classList.toggle('active', i === currentSpeakerIdx));
  const name = speakerNames[currentSpeakerIdx] || `Speaker ${currentSpeakerIdx + 1}`;
  $('currentSpeakerBadge').textContent = name;
  $('currentSpeakerBadge').style.color = Transcription.getSpeakerColor(currentSpeakerIdx);
}

function switchToNextSpeaker() {
  currentSpeakerIdx = Transcription.nextSpeaker();
  updateActiveSpeaker();
  const name = speakerNames[currentSpeakerIdx] || `Speaker ${currentSpeakerIdx + 1}`;
  showToast(`🎙 Pindah ke ${name}`, 'info');
}

function promptSpeakerName() {
  const idx = currentSpeakerIdx;
  const current = speakerNames[idx] || `Speaker ${idx + 1}`;
  const newName = prompt(`Nama untuk Speaker ${idx + 1}:`, current);
  if (newName && newName.trim()) {
    speakerNames[idx] = newName.trim();
    if (Store.state.currentMeeting) {
      Store.state.currentMeeting.speakerNames = [...speakerNames];
    }
    renderSpeakerList();
  }
}

function updateSpeakerStats() {
  const stats = Store.getSpeakerStats();
  for (const s of stats) {
    const el = $(`wc-${s.speakerIdx}`);
    if (el) el.textContent = `${s.wordCount} kata`;
  }
}

// ── Action Items ───────────────────────────────────────────────────────────
function openActionItemModal() {
  $('actionDesc').value = '';
  $('actionPic').value = '';
  $('actionDeadline').value = '';
  $('actionItemModal').classList.remove('hidden');
  $('actionDesc').focus();
}

function saveActionItem() {
  const desc = $('actionDesc').value.trim();
  if (!desc) { showToast('Masukkan deskripsi tugas', 'warning'); return; }
  const pic = $('actionPic').value.trim();
  const deadline = $('actionDeadline').value;
  const item = Store.addActionItem(desc, pic, deadline);
  if (item) renderActionItem(item);
  $('actionItemModal').classList.add('hidden');
  showToast('✅ Action item ditambahkan', 'success');
}

function renderActionItem(item) {
  const list = $('actionItemsList');
  const empty = list.querySelector('.empty-state-sm');
  if (empty) empty.remove();

  const el = document.createElement('div');
  el.className = 'action-item';
  el.id = `action-${item.id}`;
  el.innerHTML = `
    <input type="checkbox" class="action-checkbox" ${item.done ? 'checked' : ''} onchange="toggleActionItem('${item.id}', this)">
    <div class="action-content">
      <div class="action-desc">${MOMGenerator.escHtml(item.desc)}</div>
      <div class="action-meta">${item.pic ? '👤 ' + MOMGenerator.escHtml(item.pic) : ''}${item.deadline ? (item.pic ? ' · ' : '') + '📅 ' + item.deadline : ''}</div>
    </div>
    <button class="action-remove" onclick="removeActionItem('${item.id}')" title="Hapus">×</button>
  `;
  list.appendChild(el);
}

function toggleActionItem(id, checkbox) {
  Store.toggleActionItem(id);
  const el = $(`action-${id}`);
  if (el) {
    const desc = el.querySelector('.action-desc');
    if (desc) desc.style.textDecoration = checkbox.checked ? 'line-through' : 'none';
  }
}

function removeActionItem(id) {
  Store.deleteActionItem(id);
  const el = $(`action-${id}`);
  if (el) el.remove();
  if (!Store.state.currentMeeting?.actionItems.length) {
    $('actionItemsList').innerHTML = '<div class="empty-state-sm">Belum ada action item</div>';
  }
}

// =====================================================================
// RESULT VIEW
// =====================================================================
function renderMOMDocument() {
  const meeting = Store.state.currentMeeting;
  if (!meeting) return;
  $('momDocument').innerHTML = MOMGenerator.generate(meeting);
}

function initResultHandlers() {
  $('backToMeetingBtn').addEventListener('click', () => {
    showView('viewRecording');
  });

  $('exportPdfBtn').addEventListener('click', () => {
    const m = Store.state.currentMeeting;
    if (m) Exporter.exportPDF(m);
  });

  $('exportWordBtn').addEventListener('click', () => {
    const m = Store.state.currentMeeting;
    if (m) { Exporter.exportWord(m); showToast('📝 Word berhasil didownload', 'success'); }
  });

  $('copyMomBtn').addEventListener('click', async () => {
    const m = Store.state.currentMeeting;
    if (m) {
      await Exporter.copyToClipboard(m);
      showToast('📋 MOM berhasil disalin ke clipboard', 'success');
    }
  });

  // Header export buttons
  $('exportBtn').addEventListener('click', () => {
    const m = Store.state.currentMeeting;
    if (!m) { showToast('Belum ada meeting aktif', 'warning'); return; }
    $('exportModal').classList.remove('hidden');
  });

  $('printBtn').addEventListener('click', () => {
    const m = Store.state.currentMeeting;
    if (m) Exporter.exportPDF(m);
    else window.print();
  });

  $('closeExportModal').addEventListener('click', () => $('exportModal').classList.add('hidden'));
  $('exportModal').addEventListener('click', (e) => { if (e.target === $('exportModal')) $('exportModal').classList.add('hidden'); });

  $('modalExportPdf').addEventListener('click', () => {
    const m = Store.state.currentMeeting;
    if (m) Exporter.exportPDF(m);
    $('exportModal').classList.add('hidden');
  });
  $('modalExportWord').addEventListener('click', () => {
    const m = Store.state.currentMeeting;
    if (m) { Exporter.exportWord(m); showToast('📝 Word berhasil didownload', 'success'); }
    $('exportModal').classList.add('hidden');
  });
  $('modalExportText').addEventListener('click', () => {
    const m = Store.state.currentMeeting;
    if (m) { Exporter.exportText(m); showToast('📋 Text berhasil didownload', 'success'); }
    $('exportModal').classList.add('hidden');
  });
}

// =====================================================================
// SIDEBAR / HISTORY
// =====================================================================
function initSidebarHandlers() {
  $('sidebarToggle').addEventListener('click', () => {
    $('sidebar').classList.toggle('collapsed');
  });

  $('newMeetingBtn').addEventListener('click', () => {
    if (Store.state.currentMeeting?.status === 'active') {
      if (!confirm('Meeting sedang aktif. Apakah ingin kembali ke halaman setup?')) return;
      Transcription.stop();
      Waveform.stop();
      clearInterval(timerInterval);
      $('recordingBadge').classList.add('hidden');
    }
    resetSetupForm();
    showView('viewSetup');
  });

  $('settingsBtn').addEventListener('click', () => {
    showToast('⚙ Pengaturan akan hadir segera', 'info');
  });
}

function resetSetupForm() {
  participants = [];
  $('participantsTags').innerHTML = '';
  $('meetingTitle').value = '';
  $('meetingLocation').value = '';
  $('meetingFacilitator').value = '';
  $('agendaInput').value = '';
  $('notesTextarea').value = '';
  $('actionItemsList').innerHTML = '<div class="empty-state-sm">Belum ada action item</div>';
  $('transcriptBody').innerHTML = `
    <div class="transcript-placeholder">
      <div class="placeholder-icon">🎙️</div>
      <p>Transkripsi akan muncul di sini saat Anda mulai bicara...</p>
    </div>`;
  $('meetingTitleDisplay').textContent = 'Meeting Baru';
  initDateField();
  recordingSeconds = 0;
  $('recTimer').textContent = '00:00';
  isPaused = false;
  Waveform.drawIdle();
}

function renderMeetingList() {
  const list = $('meetingList');
  const meetings = Store.state.meetings;
  if (!meetings.length) {
    list.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted);padding:12px 4px">Belum ada meeting</div>';
    return;
  }
  list.innerHTML = meetings.slice(0, 30).map(m => {
    const d = new Date(m.date);
    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const isActive = Store.state.currentMeeting?.id === m.id;
    return `
      <div class="meeting-list-item${isActive ? ' active' : ''}" onclick="loadMeeting('${m.id}')">
        <span class="item-title">${MOMGenerator.escHtml(m.title)}</span>
        <span class="item-date">${dateStr} · ${m.status === 'active' ? '🔴 Live' : '✓ Selesai'}</span>
      </div>
    `;
  }).join('');
}

function loadMeeting(id) {
  const meeting = Store.getMeeting(id);
  if (!meeting) return;

  // Stop any active recording
  if (Store.state.currentMeeting?.status === 'active') {
    Transcription.stop();
    Waveform.stop();
    clearInterval(timerInterval);
    $('recordingBadge').classList.add('hidden');
  }

  Store.state.currentMeeting = meeting;
  $('meetingTitleDisplay').textContent = meeting.title;
  updateHeaderDate();

  if (meeting.status === 'completed') {
    renderMOMDocument();
    showView('viewResult');
  } else {
    // Resume active meeting
    speakerNames = meeting.speakerNames || [];
    speakerCount = meeting.speakerCount || 2;
    currentSpeakerIdx = 0;
    recordingSeconds = meeting.duration || 0;
    $('recTimer').textContent = formatTimer(recordingSeconds);
    $('notesTextarea').value = meeting.notes || '';

    $('transcriptBody').innerHTML = '';
    for (const entry of meeting.transcript) {
      renderTranscriptEntry(entry);
    }
    $('actionItemsList').innerHTML = '';
    if (!meeting.actionItems.length) {
      $('actionItemsList').innerHTML = '<div class="empty-state-sm">Belum ada action item</div>';
    } else {
      for (const item of meeting.actionItems) renderActionItem(item);
    }

    renderSpeakerList();
    $('recordingBadge').classList.remove('hidden');
    showView('viewRecording');
    showToast('Meeting dimuat dari history', 'info');
  }

  renderMeetingList();
}

// =====================================================================
// KEYBOARD SHORTCUTS
// =====================================================================
document.addEventListener('keydown', (e) => {
  // Don't intercept when typing in input/textarea
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

  const view = document.querySelector('.view.active');
  if (!view) return;

  if (view.id === 'viewRecording') {
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePause(); }
    if (e.key === 'n' || e.key === 'N') switchToNextSpeaker();
    if (e.key === 'm' || e.key === 'M') markLastEntry();
    if (e.key === 'Escape') stopMeeting();
  }
});
