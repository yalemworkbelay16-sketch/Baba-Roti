import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, MessageSquare, X, Send, RefreshCw,
  AlertTriangle, User as UserIcon,
  Minimize2, Maximize2, RotateCcw,
  Mic, MicOff, Volume2, VolumeX, Square,
} from 'lucide-react';
import api from '../api/axios';
import { useTheme } from '../context/ThemeContext';

// ── Web Speech API support check ──────────────────────────────────
const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

// Clean text for speech synthesis (strip markdown, format units naturally)
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/[`_#~]/g, '')
    .replace(/[•\-\*]\s+/g, ', ')
    .replace(/\bETB\b/gi, 'Ethiopian Birr')
    .replace(/\bpcs\b/gi, 'pieces')
    .replace(/\bkg\b/gi, 'kilograms')
    .replace(/\bltr\b/gi, 'liters')
    .replace(/\bqty\b/gi, 'quantity')
    .replace(/(\r\n|\n|\r)/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// ── Message bubble ────────────────────────────────────────────────
const MessageBubble = ({ msg, isSpeaking, onSpeak, onStopSpeak }) => {
  const isUser = msg.role === 'user';
  const isError = msg.role === 'error';

  if (isError) {
    return (
      <div className="flex items-start gap-2 px-1">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 mt-0.5">
          <AlertTriangle size={13} className="text-rose-600" />
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 max-w-[85%]">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full mb-0.5 ${isUser
        ? 'bg-blue-600 text-white'
        : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
        }`}>
        {isUser ? <UserIcon size={13} /> : <Bot size={13} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${isUser
        ? 'bg-blue-600 text-white rounded-br-sm'
        : 'bg-white border border-ink-100 text-ink-800 rounded-bl-sm shadow-sm'
        }`}>
        {/* Render markdown-like formatting */}
        {msg.content.split('\n').map((line, i) => {
          // Bold: **text**
          const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          // Bullet points
          if (line.startsWith('• ') || line.startsWith('- ')) {
            return (
              <div key={i} className="flex items-start gap-1.5 my-0.5">
                <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${isUser ? 'bg-blue-200' : 'bg-violet-400'}`} />
                <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[•\-] /, '') }} />
              </div>
            );
          }
          if (line.trim() === '') return <div key={i} className="h-1.5" />;
          return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
        })}

        {/* Voice Playback button on assistant responses */}
        {!isUser && !isError && (
          <div className="flex items-center justify-end gap-1.5 mt-2 pt-1 border-t border-ink-100/70">
            {isSpeaking ? (
              <button
                type="button"
                onClick={onStopSpeak}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full hover:bg-rose-100 transition"
                title="Stop reading aloud"
              >
                <span className="flex items-center gap-0.5">
                  <span className="h-2 w-0.5 bg-rose-500 animate-pulse" />
                  <span className="h-3 w-0.5 bg-rose-500 animate-pulse delay-75" />
                  <span className="h-1.5 w-0.5 bg-rose-500 animate-pulse delay-150" />
                </span>
                <Square size={9} fill="currentColor" /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSpeak(msg.content, msg.id)}
                className="flex items-center gap-1 text-[10px] font-medium text-ink-400 hover:text-violet-600 px-1.5 py-0.5 rounded-md hover:bg-violet-50 transition"
                title="Read this answer aloud"
              >
                <Volume2 size={11} /> Read aloud
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Typing indicator ──────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="flex items-end gap-2 px-1">
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
      <Bot size={13} className="text-white" />
    </div>
    <div className="rounded-2xl rounded-bl-sm bg-white border border-ink-100 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-violet-400"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ── Suggestion chip ───────────────────────────────────────────────
const SuggestionChip = ({ text, onClick }) => (
  <button
    onClick={() => onClick(text)}
    className="rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition text-left leading-tight"
  >
    {text}
  </button>
);

const STAFF_MEAL_QUICK_PROMPT = 'How many staff meals were used today and who ordered what food?';

const DEFAULT_FALLBACK_SUGGESTIONS = [
  STAFF_MEAL_QUICK_PROMPT,
  "Show me this month's purchase summary",
  'What are our top valued inventory items?',
  'Analyze our consumption patterns this month',
];

// ── INITIAL GREETING ──────────────────────────────────────────────
const GREETING = `Hi! I'm **MEGA** — your Baba Roti  CaféAI Resource Assistant 🌟

I have live access to your entire stock system right now. Ask me anything like:
• "How many staff meals were used today and who ordered what food?"
• "What items are out of stock?"
• "Show me this month's purchase summary"

What would you like to know?`;

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function AiChat() {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING, id: 'welcome' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(DEFAULT_FALLBACK_SUGGESTIONS);
  const [suggestionPage, setSuggestionPage] = useState(0);
  const [analyzed, setAnalyzed] = useState(null);
  const [unread, setUnread] = useState(0);

  // ── Voice state ─────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      return localStorage.getItem('mega_auto_speak') === 'true';
    } catch {
      return false;
    }
  });

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const openedOnce = useRef(false);
  const recognitionRef = useRef(null);

  // ── Text-to-Speech (Speaking responses) ─────────────────────────
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    }
  }, []);

  const speakText = useCallback((text, msgId) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    if (speakingMsgId === msgId) {
      setSpeakingMsgId(null);
      return;
    }

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick natural English voice if present
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v =>
      v.lang.startsWith('en') && (
        v.name.includes('Natural') ||
        v.name.includes('Google') ||
        v.name.includes('Jenny') ||
        v.name.includes('Guy') ||
        v.name.includes('David')
      )
    ) || voices.find(v => v.lang.startsWith('en'));

    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  }, [speakingMsgId]);

  const toggleAutoSpeak = () => {
    setAutoSpeak(prev => {
      const next = !prev;
      try { localStorage.setItem('mega_auto_speak', String(next)); } catch { }
      if (!next) stopSpeaking();
      return next;
    });
  };

  // ── Speech-to-Text (Microphone voice input) ──────────────────────
  const startListening = () => {
    setSpeechError('');
    if (!SpeechRecognition) {
      setSpeechError('Microphone input is supported in Google Chrome, Microsoft Edge, and Safari.');
      setTimeout(() => setSpeechError(''), 4500);
      return;
    }

    stopSpeaking();

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (e) => {
        const transcript = Array.from(e.results)
          .map(res => res[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = (e) => {
        setIsListening(false);
        if (e.error === 'not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access in browser.');
        } else if (e.error !== 'no-speech') {
          setSpeechError(`Voice error: ${e.error}`);
        }
        setTimeout(() => setSpeechError(''), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { }
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Clean up voice tasks on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { }
      }
    };
  }, [stopSpeaking]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, open, minimized]);

  // Load suggestions on first open
  useEffect(() => {
    if (open && !openedOnce.current) {
      openedOnce.current = true;
      loadSuggestions();
      runAnalysis();
      inputRef.current?.focus();
    }
  }, [open]);

  const loadSuggestions = async () => {
    try {
      const res = await api.get('/ai/quick-suggestions');
      setSuggestions(res.data.suggestions || []);
      setSuggestionPage(0);
    } catch { /* silent */ }
  };

  const runAnalysis = async () => {
    try {
      const res = await api.get('/ai/analyze');
      setAnalyzed(res.data);
      // Show critical alerts as a system message
      const criticals = (res.data.alerts || []).filter(a => a.level === 'critical');
      if (criticals.length > 0) {
        const alertMsg = `⚠️ **Automated Alert**\n\n${criticals.map(a => `**${a.title}:** ${a.message}\n→ ${a.action}`).join('\n\n')}`;
        setMessages(prev => [...prev, { role: 'assistant', content: alertMsg, id: `alert-${Date.now()}` }]);
      }
    } catch { /* silent */ }
  };

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    // Stop speech recognition if listening
    stopListening();
    stopSpeaking();

    setInput('');
    const userMsg = { role: 'user', content: msg, id: `u-${Date.now()}` };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Build history from current messages (exclude welcome, alerts, and previous error messages)
    const history = messages
      .filter(m =>
        ['user', 'assistant'].includes(m.role) &&
        m.id !== 'welcome' &&
        !m.id?.startsWith('alert-') &&
        !m.content?.startsWith('❌') &&
        !m.content?.startsWith('⏳') &&
        !m.content?.startsWith('🔑') &&
        !m.content?.startsWith('🔄')
      )
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await api.post('/ai/chat', { message: msg, history });
      const newMsgId = `a-${Date.now()}`;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        id: newMsgId,
      }]);

      // If auto-speak is enabled and valid reply received, read aloud
      if (autoSpeak && res.data.reply && !res.data.reply.startsWith('❌')) {
        setTimeout(() => speakText(res.data.reply, newMsgId), 250);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Sorry, I couldn\'t process that. Please check your connection and API settings.';
      setMessages(prev => [...prev, { role: 'error', content: errMsg, id: `e-${Date.now()}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, autoSpeak, speakText, stopSpeaking]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    stopSpeaking();
    stopListening();
    setMessages([{ role: 'assistant', content: GREETING, id: 'welcome' }]);
    setAnalyzed(null);
    openedOnce.current = false;
  };

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    setUnread(0);
  };

  const handleClose = () => {
    stopSpeaking();
    stopListening();
    setOpen(false);
  };

  return (
    <>
      {/* ── Keyframes ── */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes megaSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* ── Floating trigger button (sits neatly above MobileBottomNav on phones) ── */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-[76px] right-3 lg:bottom-6 lg:right-6 z-30 flex items-center gap-1.5 lg:gap-2.5 rounded-full lg:rounded-2xl shadow-lg lg:shadow-2xl px-3 py-2 lg:px-4 lg:py-3 text-white font-bold text-xs lg:text-sm transition-all hover:scale-105 active:scale-95 border border-white/20"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #1a56db 100%)' }}
          title="Open MEGA Assistant"
        >
          <div className="relative">
            <Bot size={16} className="lg:w-[18px] lg:h-[18px]" />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black">
                {unread}
              </span>
            )}
          </div>
          <span className="lg:hidden">MEGA</span>
          <span className="hidden lg:inline">Ask MEGA</span>
          {analyzed && (
            <span className="hidden lg:inline text-xs font-normal opacity-80">
              · Score {analyzed.score}/100
            </span>
          )}
        </button>
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div
          className={`fixed inset-x-2 bottom-[76px] lg:inset-x-auto lg:right-6 lg:bottom-6 z-[999] flex flex-col rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl border border-white/20 transition-all duration-300 ${minimized ? 'h-14 w-auto lg:w-80' : 'lg:w-[390px] max-h-[calc(100dvh-6.25rem)]'
            }`}
          style={{
            height: minimized ? 56 : 'min(580px, calc(100dvh - 6.25rem))',
            animation: 'megaSlideUp 0.25s ease-out',
            background: isDark
              ? 'linear-gradient(180deg, #08122b 0%, #040b1d 100%)'
              : 'linear-gradient(180deg, #fafbff 0%, #ffffff 100%)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #1a56db 100%)' }}
            onClick={() => setMinimized(v => !v)}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-black text-white leading-tight">MEGA</p>
                <p className="text-[10px] text-purple-200 leading-tight">Baba Roti Smart Assistant</p>
              </div>
              {analyzed && (
                <div className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                  {analyzed.score}/100
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Auto-Voice Speak Toggle */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleAutoSpeak(); }}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${autoSpeak
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                title={autoSpeak ? 'Auto-Voice is ON (click to mute)' : 'Auto-Voice is OFF (click to auto-read answers)'}
              >
                {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearChat(); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition"
                title="Clear chat"
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMinimized(v => !v); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition"
                title={minimized ? 'Expand' : 'Minimize'}
              >
                {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Analysis bar */}
              {analyzed && analyzed.alerts?.some(a => a.level !== 'info') && (
                <div className={`px-4 py-2 text-[11px] font-semibold flex items-center gap-2 flex-shrink-0 ${analyzed.alerts.some(a => a.level === 'critical')
                  ? 'bg-rose-50 text-rose-700 border-b border-rose-100'
                  : 'bg-amber-50 text-amber-700 border-b border-amber-100'
                  }`}>
                  <AlertTriangle size={11} className="flex-shrink-0" />
                  {analyzed.summary}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isSpeaking={speakingMsgId === msg.id}
                    onSpeak={speakText}
                    onStopSpeak={stopSpeaking}
                  />
                ))}
                {loading && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>

              {/* Suggestions — always visible */}
              {suggestions.length > 0 && (
                <div className="px-3 pb-2 flex-shrink-0">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                      Quick questions
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => sendMessage(STAFF_MEAL_QUICK_PROMPT)}
                        disabled={loading}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                        title="Instant report: who used daily staff meals today and how many foods were consumed"
                      >
                        🍽️ Daily Staff Meals
                      </button>
                      <button
                        onClick={() => setSuggestionPage(p => (p + 1) % Math.ceil(suggestions.length / 4))}
                        className="flex items-center gap-1 text-[10px] font-semibold text-violet-500 hover:text-violet-700 transition"
                        title="Show more questions"
                      >
                        <RefreshCw size={10} /> More
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.slice(suggestionPage * 4, suggestionPage * 4 + 4).map((s, i) => (
                      <SuggestionChip key={i} text={s} onClick={sendMessage} />
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area with Voice Controls */}
              <div className="flex-shrink-0 border-t border-ink-100 bg-white px-3 py-3">
                {/* Listening Alert / Error Banner */}
                {isListening && (
                  <div className="flex items-center justify-between bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-[11px] mb-2">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      <span className="font-semibold">Listening... speak your question</span>
                    </div>
                    <button
                      type="button"
                      onClick={stopListening}
                      className="text-[10px] font-bold text-rose-600 hover:underline"
                    >
                      Done
                    </button>
                  </div>
                )}

                {speechError && (
                  <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg mb-2">
                    {speechError}
                  </div>
                )}

                <div className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-ink-50/60 px-3 py-2 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-200 transition">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? 'Listening... Speak now' : 'Ask about stock, or click mic...'}
                    rows={1}
                    className="flex-1 bg-transparent text-xs text-ink-900 placeholder-ink-400 outline-none resize-none max-h-24"
                    style={{ lineHeight: '1.5' }}
                    disabled={loading}
                  />

                  {/* Microphone speech-to-text button (positioned right next to Send button) */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={loading}
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl transition shadow-xs ${isListening
                        ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-200'
                        : 'bg-violet-100 text-violet-700 hover:bg-violet-200 active:scale-95'
                      }`}
                    title={isListening ? 'Stop listening' : 'Voice input / Click to speak'}
                  >
                    {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                  </button>

                  {/* Send button */}
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-xs"
                    title="Send message"
                  >
                    {loading
                      ? <RefreshCw size={12} className="animate-spin" />
                      : <Send size={12} />
                    }
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-ink-300 mt-1.5 px-1">
                  <span>MEGA · Google Gemini</span>
                  <span className="flex items-center gap-1 text-[9px] text-violet-500 font-medium">
                    🎙️ Voice Input & Readout active
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
