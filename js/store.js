/**
 * store.js — Centralized state management for Auto MOM System
 */

const Store = (() => {
  const STORAGE_KEY = 'auto_mom_meetings';

  // ── Application State ────────────────────────────────────────────────────
  const state = {
    currentMeeting: null,
    meetings: [],
    settings: {
      language: 'id-ID',
      speakerCount: 2,
      template: 'standard',
    },
  };

  // ── Persistence ──────────────────────────────────────────────────────────
  function saveMeetings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.meetings));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  function loadMeetings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state.meetings = JSON.parse(raw);
    } catch (e) {
      state.meetings = [];
    }
  }

  // ── Meeting Helpers ──────────────────────────────────────────────────────
  function createMeeting(meta) {
    const meeting = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      title: meta.title || 'Meeting Tanpa Judul',
      date: meta.date || new Date().toISOString(),
      location: meta.location || '',
      facilitator: meta.facilitator || '',
      participants: meta.participants || [],
      agenda: meta.agenda || '',
      template: meta.template || 'standard',
      language: meta.language || 'id-ID',
      speakerCount: meta.speakerCount || 2,
      speakerNames: meta.speakerNames || [],
      transcript: [],       // { id, speakerIdx, speakerName, text, timestamp, starred }
      actionItems: [],      // { id, desc, pic, deadline, done }
      notes: '',
      duration: 0,          // seconds
      status: 'active',     // active | completed
    };
    state.currentMeeting = meeting;
    return meeting;
  }

  function saveCurrentMeeting() {
    if (!state.currentMeeting) return;
    const idx = state.meetings.findIndex(m => m.id === state.currentMeeting.id);
    if (idx >= 0) {
      state.meetings[idx] = { ...state.currentMeeting };
    } else {
      state.meetings.unshift({ ...state.currentMeeting });
    }
    saveMeetings();
  }

  function getMeeting(id) {
    return state.meetings.find(m => m.id === id) || null;
  }

  function deleteMeeting(id) {
    state.meetings = state.meetings.filter(m => m.id !== id);
    saveMeetings();
  }

  // ── Transcript ────────────────────────────────────────────────────────────
  function addTranscriptEntry(speakerIdx, speakerName, text, timestamp) {
    if (!state.currentMeeting) return null;
    const entry = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      speakerIdx,
      speakerName,
      text,
      timestamp: timestamp || 0,
      starred: false,
    };
    state.currentMeeting.transcript.push(entry);
    return entry;
  }

  function toggleStar(entryId) {
    if (!state.currentMeeting) return;
    const entry = state.currentMeeting.transcript.find(e => e.id === entryId);
    if (entry) entry.starred = !entry.starred;
  }

  function updateEntryText(entryId, newText) {
    if (!state.currentMeeting) return;
    const entry = state.currentMeeting.transcript.find(e => e.id === entryId);
    if (entry) entry.text = newText;
  }

  function deleteEntry(entryId) {
    if (!state.currentMeeting) return;
    state.currentMeeting.transcript = state.currentMeeting.transcript.filter(e => e.id !== entryId);
  }

  // ── Action Items ──────────────────────────────────────────────────────────
  function addActionItem(desc, pic, deadline) {
    if (!state.currentMeeting) return null;
    const item = {
      id: Date.now().toString(),
      desc,
      pic: pic || '',
      deadline: deadline || '',
      done: false,
    };
    state.currentMeeting.actionItems.push(item);
    return item;
  }

  function toggleActionItem(id) {
    if (!state.currentMeeting) return;
    const item = state.currentMeeting.actionItems.find(a => a.id === id);
    if (item) item.done = !item.done;
  }

  function deleteActionItem(id) {
    if (!state.currentMeeting) return;
    state.currentMeeting.actionItems = state.currentMeeting.actionItems.filter(a => a.id !== id);
  }

  // ── Speaker Stats ─────────────────────────────────────────────────────────
  function getSpeakerStats() {
    if (!state.currentMeeting) return [];
    const counts = {};
    for (const entry of state.currentMeeting.transcript) {
      const key = entry.speakerIdx;
      if (!counts[key]) counts[key] = { speakerIdx: key, speakerName: entry.speakerName, wordCount: 0, entries: 0 };
      counts[key].wordCount += entry.text.split(/\s+/).filter(Boolean).length;
      counts[key].entries++;
    }
    return Object.values(counts);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  loadMeetings();

  return {
    state,
    createMeeting,
    saveCurrentMeeting,
    getMeeting,
    deleteMeeting,
    addTranscriptEntry,
    toggleStar,
    updateEntryText,
    deleteEntry,
    addActionItem,
    toggleActionItem,
    deleteActionItem,
    getSpeakerStats,
    saveMeetings,
  };
})();
