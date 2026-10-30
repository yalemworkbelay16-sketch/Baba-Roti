/**
 * Audio & Voice Alert Utility — Baba Roti  Café& Restaurant POS
 * ──────────────────────────────────────────────────────────────────
 * Provides restaurant chime sound alerts (Web Audio API) and
 * voice announcements (Web Speech API) when customer QR self-orders arrive.
 * Works 100% offline without external audio files.
 */

let audioCtx = null;

// Initialize or resume AudioContext safely
function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a pleasant high-end restaurant service bell chime (3-tone harmonic chime).
 */
export function playOrderChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Harmonic chime chords (E5, G#5, B5, E6)
    const notes = [
      { freq: 659.25, time: 0, duration: 0.6 },    // E5
      { freq: 830.61, time: 0.08, duration: 0.7 }, // G#5
      { freq: 987.77, time: 0.16, duration: 0.9 }, // B5
      { freq: 1318.5, time: 0.24, duration: 1.2 }, // E6
    ];

    notes.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      // Bell envelope: instant attack, exponential decay
      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.3, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + duration);
    });
  } catch (err) {
    console.warn('[AudioAlert] Web Audio chime could not play:', err.message);
  }
}

/**
 * Speech synthesis voice announcement for cashiers / waitstaff.
 */
export function announceOrderVoice(text) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel any stuck utterance
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    // Pick English or default voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[AudioAlert] Speech announcement failed:', err.message);
  }
}

// Track alerted order numbers in memory to prevent repeat alerts
const alertedOrderIds = new Set();

/**
 * Trigger full alert (Chime + Voice Announcement) for a new incoming customer order.
 */
export function triggerNewOrderAlert({ orderId, orderNo, tableNo, itemsCount, totalAmount }) {
  const key = String(orderId || orderNo);
  if (alertedOrderIds.has(key)) return false;
  alertedOrderIds.add(key);

  // 1. Play crystal-clear chime
  playOrderChime();

  // 2. Announce with voice after short chime delay
  setTimeout(() => {
    let cleanTable = String(tableNo || 'Table').trim();
    cleanTable = cleanTable.replace(/^Table\s*0*([1-9]\d*)/i, 'Table $1');
    const countText = itemsCount ? `for ${itemsCount} items` : '';
    const voiceMessage = `New customer order on ${cleanTable} ${countText}!`;
    announceOrderVoice(voiceMessage);
  }, 350);

  return true;
}

