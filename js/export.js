/**
 * export.js — Export MOM to PDF, Word (.doc), and plain text
 */

const Exporter = (() => {

  // ── PDF Export (using browser print) ─────────────────────────────────────
  function exportPDF(meeting) {
    const html = MOMGenerator.generate(meeting);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${meeting.title} — MOM</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: white;
      color: #1a1a2e;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.7;
    }
    :root {
      --cyan: #00796b;
      --purple: #5c35a6;
      --bg-elevated: #f8f9fa;
      --border: #e0e0e0;
      --border-accent: #00796b;
      --text-primary: #1a1a2e;
      --text-secondary: #4a5568;
      --text-muted: #718096;
      --bg-base: #f5f5f5;
    }
    .mom-header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #00796b; margin-bottom: 24px; }
    .mom-org-name { font-size: 0.8rem; font-weight: 700; color: #00796b; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 6px; }
    .mom-doc-title { font-size: 1.6rem; font-weight: 800; color: #1a1a2e; }
    .mom-doc-subtitle { color: #718096; font-size: 0.85rem; margin-top: 4px; }
    .mom-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .mom-meta-label { font-size: 0.7rem; font-weight: 700; color: #718096; text-transform: uppercase; letter-spacing: 0.08em; }
    .mom-meta-value { font-size: 0.88rem; color: #1a1a2e; }
    .mom-section { margin-bottom: 24px; }
    .mom-section-title { font-size: 0.78rem; font-weight: 800; color: #00796b; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e0e0e0; }
    .mom-transcript-block { display: flex; flex-direction: column; gap: 8px; }
    .mom-transcript-entry { display: flex; gap: 10px; }
    .mom-speaker-label { flex-shrink: 0; font-size: 0.78rem; font-weight: 700; min-width: 80px; padding-top: 2px; }
    .mom-transcript-text { font-size: 0.85rem; color: #4a5568; line-height: 1.7; }
    .mom-action-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .mom-action-table th { text-align: left; padding: 7px 10px; background: #f8f9fa; border: 1px solid #e0e0e0; color: #718096; font-size: 0.72rem; text-transform: uppercase; }
    .mom-action-table td { padding: 9px 10px; border: 1px solid #e0e0e0; color: #1a1a2e; }
    .mom-participants-list { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
    .mom-participants-list li { padding: 3px 10px; border-radius: 999px; background: #f0ebff; border: 1px solid #d4b8ff; font-size: 0.8rem; color: #5c35a6; }
    .mom-meta-item { display: flex; flex-direction: column; gap: 2px; }
    .mom-signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 36px; }
    .mom-signature-box { display: flex; flex-direction: column; gap: 4px; }
    .mom-signature-role { font-size: 0.72rem; font-weight: 700; color: #718096; text-transform: uppercase; }
    .mom-signature-line { width: 100%; height: 1px; background: #e0e0e0; margin: 36px 0 6px; }
    .mom-signature-name { font-size: 0.88rem; font-weight: 600; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 600);
  }

  // ── Word Export (HTML in .doc) ────────────────────────────────────────────
  function exportWord(meeting) {
    const html = MOMGenerator.generate(meeting);
    const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="UTF-8">
  <title>${meeting.title} — MOM</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml><![endif]-->
  <style>
    body { font-family: Calibri, sans-serif; font-size: 11pt; color: #1a1a2e; margin: 40px; }
    h1 { font-size: 20pt; font-weight: bold; text-align: center; }
    h2 { font-size: 13pt; font-weight: bold; color: #00796b; border-bottom: 1pt solid #00796b; padding-bottom: 4pt; margin-top: 18pt; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th { background: #f0f0f0; border: 1pt solid #ccc; padding: 6pt; font-weight: bold; text-align: left; }
    td { border: 1pt solid #ccc; padding: 6pt; }
    p { line-height: 1.6; }
    ul { padding-left: 20pt; }
    li { margin-bottom: 4pt; }
    .label { font-size: 9pt; font-weight: bold; color: #718096; text-transform: uppercase; }
    .speaker { font-weight: bold; min-width: 80pt; display: inline-block; }
  </style>
</head>
<body>
${html.replace(/style="[^"]*color:var\([^)]+\)[^"]*"/g, '')
       .replace(/style="[^"]*background:[^"]*var\([^"]+\)[^"]*"/g, '')
       .replace(/class="[^"]+"/g, '')}
</body>
</html>`;

    const blob = new Blob([wordHtml], { type: 'application/msword' });
    downloadBlob(blob, `MOM_${sanitizeFilename(meeting.title)}_${formatDateFile(meeting.date)}.doc`);
  }

  // ── Plain Text Export ─────────────────────────────────────────────────────
  function exportText(meeting) {
    const text = MOMGenerator.generateText(meeting);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `MOM_${sanitizeFilename(meeting.title)}_${formatDateFile(meeting.date)}.txt`);
  }

  // ── Copy to Clipboard ─────────────────────────────────────────────────────
  async function copyToClipboard(meeting) {
    const text = MOMGenerator.generateText(meeting);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function sanitizeFilename(str) {
    return (str || 'MOM').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').slice(0, 40);
  }

  function formatDateFile(isoStr) {
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    } catch { return 'nodate'; }
  }

  return { exportPDF, exportWord, exportText, copyToClipboard };
})();
