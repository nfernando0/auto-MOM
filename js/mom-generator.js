/**
 * mom-generator.js — Generates formatted MOM HTML from meeting data
 * Supports 4 templates: standard, formal, agile, simple
 */

const MOMGenerator = (() => {

  function formatDate(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }) + ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch { return isoStr || '—'; }
  }

  function formatShortDate(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return isoStr || '—'; }
  }

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}j ${m}m ${s}d`;
    return `${m}m ${s}d`;
  }

  function speakerColor(idx) {
    const colors = ['#00d4aa','#7c3aed','#f59e0b','#f43f5e','#3b82f6','#ec4899','#14b8a6','#a855f7'];
    return colors[idx % colors.length];
  }

  // ── STANDARD TEMPLATE ─────────────────────────────────────────────────────
  function buildStandard(meeting) {
    const starred = meeting.transcript.filter(e => e.starred);

    return `
<div class="mom-header">
  <div class="mom-org-name">Minutes of Meeting</div>
  <div class="mom-doc-title">${escHtml(meeting.title)}</div>
  <div class="mom-doc-subtitle">Dokumen resmi hasil rapat yang direkam secara otomatis</div>
</div>

<div class="mom-meta-grid">
  <div class="mom-meta-item">
    <span class="mom-meta-label">📅 Tanggal &amp; Waktu</span>
    <span class="mom-meta-value">${formatDate(meeting.date)}</span>
  </div>
  <div class="mom-meta-item">
    <span class="mom-meta-label">📍 Lokasi / Platform</span>
    <span class="mom-meta-value">${escHtml(meeting.location) || '—'}</span>
  </div>
  <div class="mom-meta-item">
    <span class="mom-meta-label">👤 Fasilitator</span>
    <span class="mom-meta-value">${escHtml(meeting.facilitator) || '—'}</span>
  </div>
  <div class="mom-meta-item">
    <span class="mom-meta-label">⏱ Durasi Meeting</span>
    <span class="mom-meta-value">${formatDuration(meeting.duration)}</span>
  </div>
</div>

${buildParticipantsSection(meeting)}

${meeting.agenda ? `
<div class="mom-section">
  <div class="mom-section-title">📋 Agenda Meeting</div>
  <div style="color:var(--text-secondary);font-size:0.9rem;line-height:1.8;white-space:pre-wrap">${escHtml(meeting.agenda)}</div>
</div>` : ''}

<div class="mom-section">
  <div class="mom-section-title">📝 Ringkasan Diskusi</div>
  ${buildDiscussionSummary(meeting)}
</div>

${starred.length > 0 ? `
<div class="mom-section">
  <div class="mom-section-title">⭐ Poin-Poin Penting</div>
  <ul style="list-style:none;display:flex;flex-direction:column;gap:8px">
    ${starred.map(e => `
      <li style="display:flex;gap:10px;align-items:flex-start;padding:10px 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:8px">
        <span style="color:#f59e0b;font-size:1rem;flex-shrink:0">★</span>
        <div>
          <span style="font-size:0.75rem;font-weight:700;color:${speakerColor(e.speakerIdx)}">${escHtml(e.speakerName)}</span>
          <p style="font-size:0.88rem;color:var(--text-primary);margin-top:2px">${escHtml(e.text)}</p>
        </div>
      </li>
    `).join('')}
  </ul>
</div>` : ''}

${buildTranscriptSection(meeting)}
${buildActionItemsSection(meeting)}
${meeting.notes ? buildNotesSection(meeting) : ''}
${buildSignatureSection(meeting)}
    `.trim();
  }

  // ── FORMAL TEMPLATE ───────────────────────────────────────────────────────
  function buildFormal(meeting) {
    return `
<div class="mom-header" style="border-top: 3px solid var(--cyan);">
  <div class="mom-org-name" style="font-size:0.75rem;letter-spacing:0.2em">NOTULEN RAPAT RESMI</div>
  <div class="mom-doc-title" style="font-size:1.6rem">${escHtml(meeting.title)}</div>
  <div style="margin-top:8px;padding:12px 16px;background:var(--bg-elevated);border-radius:8px;display:inline-block;font-size:0.8rem;color:var(--text-secondary)">
    Nomor: MOM/${new Date().getFullYear()}/${String(Date.now()).slice(-4)}
  </div>
</div>

<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:24px">
  ${[
    ['Perihal', meeting.title],
    ['Tanggal Pelaksanaan', formatDate(meeting.date)],
    ['Tempat', meeting.location || '—'],
    ['Pimpinan Rapat', meeting.facilitator || '—'],
    ['Jumlah Peserta', meeting.participants.length + ' orang'],
    ['Durasi', formatDuration(meeting.duration)],
  ].map((r, i) => `
  <div style="display:grid;grid-template-columns:180px 1fr;${i > 0 ? 'border-top:1px solid var(--border)' : ''}">
    <div style="padding:10px 16px;background:var(--bg-elevated);font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">${r[0]}</div>
    <div style="padding:10px 16px;font-size:0.88rem;color:var(--text-primary)">${escHtml(r[1])}</div>
  </div>`).join('')}
</div>

${buildParticipantsSection(meeting)}

${meeting.agenda ? `
<div class="mom-section">
  <div class="mom-section-title">I. Agenda Rapat</div>
  <ol style="padding-left:20px;display:flex;flex-direction:column;gap:6px">
    ${meeting.agenda.split('\n').filter(Boolean).map(a => `<li style="color:var(--text-secondary);font-size:0.9rem">${escHtml(a)}</li>`).join('')}
  </ol>
</div>` : ''}

<div class="mom-section">
  <div class="mom-section-title">II. Jalannya Rapat</div>
  ${buildDiscussionSummary(meeting)}
</div>

${buildTranscriptSection(meeting, 'III. ')}
${buildActionItemsSection(meeting, 'IV. ')}
${meeting.notes ? buildNotesSection(meeting, 'V. ') : ''}

<div class="mom-section">
  <div class="mom-section-title">${meeting.notes ? 'VI.' : 'V.'} Penutup</div>
  <p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.7">
    Demikian notulen rapat ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.
    Notulen ini dihasilkan secara otomatis oleh sistem Auto MOM dan telah diverifikasi oleh peserta rapat.
  </p>
</div>

${buildSignatureSection(meeting)}
    `.trim();
  }

  // ── AGILE TEMPLATE ────────────────────────────────────────────────────────
  function buildAgile(meeting) {
    const done = meeting.actionItems.filter(a => a.done);
    const pending = meeting.actionItems.filter(a => !a.done);

    return `
<div class="mom-header">
  <div class="mom-org-name" style="color:#7c3aed">⚡ Agile / Scrum Meeting Notes</div>
  <div class="mom-doc-title">${escHtml(meeting.title)}</div>
  <div class="mom-doc-subtitle">${formatDate(meeting.date)} • ${formatDuration(meeting.duration)}</div>
</div>

<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
  ${[
    { icon:'👤', label:'Scrum Master', val: meeting.facilitator || '—' },
    { icon:'👥', label:'Team', val: meeting.participants.join(', ') || '—' },
    { icon:'⏱', label:'Sprint / Periode', val: formatShortDate(meeting.date) },
  ].map(c => `
  <div style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px">
    <div style="font-size:1.2rem;margin-bottom:4px">${c.icon}</div>
    <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px">${c.label}</div>
    <div style="font-size:0.85rem;color:var(--text-primary)">${escHtml(c.val)}</div>
  </div>`).join('')}
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
  <div class="mom-section">
    <div class="mom-section-title" style="color:#22c55e">✅ Completed (${done.length})</div>
    ${done.length > 0 ? `<ul style="list-style:none;display:flex;flex-direction:column;gap:6px">
      ${done.map(a => `<li style="display:flex;gap:8px;align-items:flex-start;padding:8px;background:rgba(34,197,94,0.05);border-radius:6px;border:1px solid rgba(34,197,94,0.15)">
        <span style="color:#22c55e">✓</span>
        <div style="font-size:0.82rem">
          <div style="color:var(--text-primary)">${escHtml(a.desc)}</div>
          ${a.pic ? `<div style="color:var(--text-muted)">@${escHtml(a.pic)}</div>` : ''}
        </div>
      </li>`).join('')}
    </ul>` : '<div style="color:var(--text-muted);font-size:0.82rem">—</div>'}
  </div>
  <div class="mom-section">
    <div class="mom-section-title" style="color:#f59e0b">⏳ Backlog / Todo (${pending.length})</div>
    ${pending.length > 0 ? `<ul style="list-style:none;display:flex;flex-direction:column;gap:6px">
      ${pending.map(a => `<li style="display:flex;gap:8px;align-items:flex-start;padding:8px;background:rgba(245,158,11,0.05);border-radius:6px;border:1px solid rgba(245,158,11,0.15)">
        <span style="color:#f59e0b">○</span>
        <div style="font-size:0.82rem">
          <div style="color:var(--text-primary)">${escHtml(a.desc)}</div>
          <div style="color:var(--text-muted)">${a.pic ? '@' + escHtml(a.pic) : ''} ${a.deadline ? '· ' + formatShortDate(a.deadline) : ''}</div>
        </div>
      </li>`).join('')}
    </ul>` : '<div style="color:var(--text-muted);font-size:0.82rem">—</div>'}
  </div>
</div>

${buildTranscriptSection(meeting)}
${meeting.notes ? buildNotesSection(meeting) : ''}
    `.trim();
  }

  // ── SIMPLE TEMPLATE ───────────────────────────────────────────────────────
  function buildSimple(meeting) {
    return `
<div class="mom-header">
  <div class="mom-doc-title">${escHtml(meeting.title)}</div>
  <div class="mom-doc-subtitle">${formatDate(meeting.date)}</div>
</div>

<div style="margin-bottom:20px;font-size:0.88rem;color:var(--text-secondary)">
  <strong style="color:var(--text-primary)">Peserta:</strong> ${meeting.participants.join(', ') || '—'}<br>
  ${meeting.facilitator ? `<strong style="color:var(--text-primary)">Dipimpin oleh:</strong> ${escHtml(meeting.facilitator)}<br>` : ''}
  ${meeting.location ? `<strong style="color:var(--text-primary)">Lokasi:</strong> ${escHtml(meeting.location)}<br>` : ''}
  <strong style="color:var(--text-primary)">Durasi:</strong> ${formatDuration(meeting.duration)}
</div>

${meeting.transcript.length > 0 ? `
<div class="mom-section">
  <div class="mom-section-title">Rangkuman Diskusi</div>
  <div style="color:var(--text-secondary);font-size:0.88rem;line-height:1.8">
    ${meeting.transcript.map(e => `<p><strong style="color:${speakerColor(e.speakerIdx)}">${escHtml(e.speakerName)}:</strong> ${escHtml(e.text)}</p>`).join('')}
  </div>
</div>` : ''}

${meeting.actionItems.length > 0 ? `
<div class="mom-section">
  <div class="mom-section-title">Action Items</div>
  <ul style="list-style:none;display:flex;flex-direction:column;gap:6px">
    ${meeting.actionItems.map(a => `
    <li style="display:flex;gap:8px;font-size:0.88rem">
      <span style="color:${a.done ? '#22c55e' : 'var(--text-muted)'}">${a.done ? '✓' : '○'}</span>
      <span style="${a.done ? 'text-decoration:line-through;color:var(--text-muted)' : 'color:var(--text-primary)'}">${escHtml(a.desc)}${a.pic ? ` — <em>${escHtml(a.pic)}</em>` : ''}${a.deadline ? ` (${formatShortDate(a.deadline)})` : ''}</span>
    </li>`).join('')}
  </ul>
</div>` : ''}

${meeting.notes ? `<div class="mom-section"><div class="mom-section-title">Catatan</div><p style="color:var(--text-secondary);font-size:0.88rem;white-space:pre-wrap">${escHtml(meeting.notes)}</p></div>` : ''}
    `.trim();
  }

  // ── Shared Section Builders ───────────────────────────────────────────────
  function buildParticipantsSection(meeting) {
    if (!meeting.participants.length) return '';
    return `
<div class="mom-section">
  <div class="mom-section-title">👥 Peserta Rapat</div>
  <ul class="mom-participants-list">
    ${meeting.participants.map(p => `<li>${escHtml(p)}</li>`).join('')}
  </ul>
</div>`;
  }

  function buildDiscussionSummary(meeting) {
    if (!meeting.transcript.length) {
      return '<p style="color:var(--text-muted);font-size:0.88rem">Tidak ada transkripsi tersedia.</p>';
    }
    // Group consecutive same-speaker segments
    const groups = [];
    for (const e of meeting.transcript) {
      if (groups.length && groups[groups.length - 1].speakerIdx === e.speakerIdx) {
        groups[groups.length - 1].text += ' ' + e.text;
      } else {
        groups.push({ ...e });
      }
    }
    // Simple summary: first 150 chars per speaker group
    const summary = groups.slice(0, 8).map(g =>
      `<strong style="color:${speakerColor(g.speakerIdx)}">${escHtml(g.speakerName)}</strong> membahas: ${escHtml(g.text.slice(0, 180))}${g.text.length > 180 ? '...' : ''}`
    ).join('<br><br>');
    return `<p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.8">${summary}</p>`;
  }

  function buildTranscriptSection(meeting, prefix = '') {
    if (!meeting.transcript.length) return '';
    return `
<div class="mom-section">
  <div class="mom-section-title">${prefix}📜 Transkripsi Lengkap</div>
  <div class="mom-transcript-block">
    ${meeting.transcript.map(e => `
    <div class="mom-transcript-entry">
      <span class="mom-speaker-label" style="color:${speakerColor(e.speakerIdx)}">${escHtml(e.speakerName)}</span>
      <span class="mom-transcript-text">${escHtml(e.text)}</span>
    </div>`).join('')}
  </div>
</div>`;
  }

  function buildActionItemsSection(meeting, prefix = '') {
    if (!meeting.actionItems.length) return '';
    return `
<div class="mom-section">
  <div class="mom-section-title">${prefix}✅ Action Items &amp; Tindak Lanjut</div>
  <table class="mom-action-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Deskripsi Tugas</th>
        <th>PIC</th>
        <th>Deadline</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${meeting.actionItems.map((a, i) => `
      <tr>
        <td style="text-align:center;width:36px;color:var(--text-muted)">${i + 1}</td>
        <td>${escHtml(a.desc)}</td>
        <td>${escHtml(a.pic) || '—'}</td>
        <td>${a.deadline ? formatShortDate(a.deadline) : '—'}</td>
        <td><span style="padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;background:${a.done ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'};color:${a.done ? '#22c55e' : '#f59e0b'}">${a.done ? 'Selesai' : 'Pending'}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;
  }

  function buildNotesSection(meeting, prefix = '') {
    return `
<div class="mom-section">
  <div class="mom-section-title">${prefix}📌 Catatan Tambahan</div>
  <p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.8;white-space:pre-wrap">${escHtml(meeting.notes)}</p>
</div>`;
  }

  function buildSignatureSection(meeting) {
    return `
<div class="mom-signature-grid">
  <div class="mom-signature-box">
    <div class="mom-signature-role">Fasilitator / Ketua Rapat</div>
    <div class="mom-signature-line"></div>
    <div class="mom-signature-name">${escHtml(meeting.facilitator) || '________________________'}</div>
  </div>
  <div class="mom-signature-box">
    <div class="mom-signature-role">Notulis / Sekretaris</div>
    <div class="mom-signature-line"></div>
    <div class="mom-signature-name" style="color:var(--cyan);font-size:0.8rem">Auto MOM System</div>
  </div>
</div>`;
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── Main Generate ─────────────────────────────────────────────────────────
  function generate(meeting) {
    switch (meeting.template) {
      case 'formal':   return buildFormal(meeting);
      case 'agile':    return buildAgile(meeting);
      case 'simple':   return buildSimple(meeting);
      default:         return buildStandard(meeting);
    }
  }

  // ── Plain Text for Copy/Export ────────────────────────────────────────────
  function generateText(meeting) {
    const sep = '─'.repeat(60);
    let out = '';
    out += `MINUTES OF MEETING\n${sep}\n`;
    out += `Judul     : ${meeting.title}\n`;
    out += `Tanggal   : ${formatDate(meeting.date)}\n`;
    out += `Lokasi    : ${meeting.location || '—'}\n`;
    out += `Fasilitator: ${meeting.facilitator || '—'}\n`;
    out += `Durasi    : ${formatDuration(meeting.duration)}\n`;
    out += `Peserta   : ${meeting.participants.join(', ') || '—'}\n`;
    out += `\n${sep}\nAGENDA\n${sep}\n${meeting.agenda || '—'}\n`;
    out += `\n${sep}\nTRANSKRIPSI\n${sep}\n`;
    for (const e of meeting.transcript) {
      out += `[${e.speakerName}] ${e.text}\n`;
    }
    out += `\n${sep}\nACTION ITEMS\n${sep}\n`;
    for (const a of meeting.actionItems) {
      out += `[${a.done ? 'X' : ' '}] ${a.desc} — PIC: ${a.pic || '—'} | Deadline: ${a.deadline || '—'}\n`;
    }
    if (meeting.notes) out += `\n${sep}\nCATATAN\n${sep}\n${meeting.notes}\n`;
    return out;
  }

  return { generate, generateText, escHtml };
})();
