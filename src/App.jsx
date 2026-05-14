import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, signOut, onAuthStateChanged, GithubAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
 
/* ═══════════════════════════════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #060810;
    --surface: #0c0f1a;
    --surface2: #111520;
    --surface3: #161c2e;
    --border: rgba(255,255,255,0.05);
    --border2: rgba(255,255,255,0.1);
    --text: #e8ecf4;
    --text2: #7a8499;
    --text3: #3a4258;
    --accent: #5b8def;
    --accent2: #8b5cf6;
    --accent3: #06d6a0;
    --danger: #ef4444;
    --warn: #f59e0b;
    --r: 16px;
    --font: 'Syne', sans-serif;
    --body: 'DM Sans', sans-serif;
    --mono: 'JetBrains Mono', monospace;
    --grad: linear-gradient(135deg, #5b8def, #8b5cf6);
    --glow: 0 0 40px rgba(91,141,239,0.15);
  }
  html { scroll-behavior: smooth; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--body);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1e2535; border-radius: 2px; }
  input, button, textarea, select { font-family: var(--body); }
  input::placeholder, textarea::placeholder { color: var(--text3); }
 
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes ripple {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes micPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
    50% { box-shadow: 0 0 0 16px rgba(239,68,68,0); }
  }
  @keyframes slideIn {
    from { transform: translateX(-10px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes barGrow {
    from { height: 0; }
    to { height: var(--h); }
  }
  @keyframes shine {
    from { background-position: -200% center; }
    to { background-position: 200% center; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }
  @keyframes notif {
    0% { transform: translateY(-20px); opacity: 0; }
    15%, 85% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-20px); opacity: 0; }
  }
 
  .fadeUp { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards; }
  .fadeIn { animation: fadeIn 0.3s ease forwards; }
  .spin { animation: spin 0.7s linear infinite; display: inline-block; }
  .float { animation: float 3s ease-in-out infinite; }
 
  .card-hover {
    transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .card-hover:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.3);
    border-color: rgba(91,141,239,0.25) !important;
  }
 
  .btn-press:active { transform: scale(0.97); }
  .tab-active { position: relative; }
  .tab-active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0; right: 0;
    height: 2px;
    background: var(--grad);
    border-radius: 2px;
  }
 
  /* Noise texture overlay */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 9999;
    opacity: 0.4;
  }
 
  /* Scrollable container fix for mobile */
  @media (max-width: 640px) {
    aside { display: none !important; }
    .mobile-nav { display: flex !important; }
    .main-content { padding: 16px !important; }
    .header-actions span { display: none; }
  }
  .mobile-nav { display: none; }
`;
 
/* ═══════════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════════ */
const stripMd = (t) => {
  if (!t || typeof t !== 'string') return '';
  return t
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[-*+]\s/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/[^\w\s.,!?\-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};
 
/* ═══════════════════════════════════════════════════════════════════
   ANDROID-SAFE TTS ENGINE
═══════════════════════════════════════════════════════════════════ */
let ttsQueue = [];
let ttsPlaying = false;
 
const androidSpeak = (text, onEnd) => {
  if (!text || !window.speechSynthesis) return;
 
  // Cancel any current
  window.speechSynthesis.cancel();
  ttsQueue = [];
  ttsPlaying = false;
 
  const clean = stripMd(text);
  if (!clean) return;
 
  // Split into chunks for Android reliability
  const chunks = clean.match(/[^.!?]+[.!?]*/g) || [clean];
  ttsQueue = [...chunks];
 
  const playNext = () => {
    if (ttsQueue.length === 0) {
      ttsPlaying = false;
      onEnd?.();
      return;
    }
    ttsPlaying = true;
    const chunk = ttsQueue.shift();
    const u = new SpeechSynthesisUtterance(chunk.trim());
    u.lang = 'en-US';
    u.rate = 0.92;
    u.pitch = 1.0;
    u.volume = 1.0;
 
    u.onend = () => {
      // Android fix: small delay between chunks
      setTimeout(playNext, 80);
    };
    u.onerror = (e) => {
      if (e.error !== 'interrupted') setTimeout(playNext, 100);
      else { ttsPlaying = false; onEnd?.(); }
    };
 
    // Android requires this to avoid silence bug
    setTimeout(() => {
      try { window.speechSynthesis.speak(u); } catch (err) { playNext(); }
    }, 50);
  };
 
  // Android Chrome needs this resume trick
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  setTimeout(playNext, 100);
};
 
const stopSpeak = () => {
  ttsQueue = [];
  ttsPlaying = false;
  try { window.speechSynthesis.cancel(); } catch {}
};
 
/* ═══════════════════════════════════════════════════════════════════
   GEMINI API
═══════════════════════════════════════════════════════════════════ */
const gemini = async (prompt) => {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from AI');
  return text;
};
 
/* ═══════════════════════════════════════════════════════════════════
   MIC HOOK (Android-safe)
═══════════════════════════════════════════════════════════════════ */
function useMic({ onResult, onError }) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
 
  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onError?.('Speech recognition not supported. Use Chrome.'); return; }
 
    // Request mic permission explicitly first (Android)
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then((stream) => {
        // Stop the stream immediately — we just needed the permission grant
        stream.getTracks().forEach(t => t.stop());
 
        stopSpeak();
        const r = new SR();
        recRef.current = r;
        r.lang = 'en-US';
        r.interimResults = true;
        r.continuous = false;
        r.maxAlternatives = 1;
 
        r.onstart = () => { setListening(true); setInterim('Listening...'); };
        r.onresult = (e) => {
          let fin = '', intr = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) fin += t; else intr += t;
          }
          if (intr) setInterim(intr);
          if (fin) { setInterim(fin); onResult?.(fin.trim()); }
        };
        r.onerror = (e) => {
          setListening(false);
          setInterim('');
          const msgs = {
            'not-allowed': 'Mic blocked! Go to Phone Settings → Apps → Smart Coach → Permissions → Microphone → Allow',
            'no-speech': 'No speech detected. Try again.',
            'network': 'Network error. Check internet.',
            'audio-capture': 'Mic not found. Check your device.',
          };
          onError?.(msgs[e.error] || `Error: ${e.error}`);
        };
        r.onend = () => { setListening(false); };
        r.start();
      })
      .catch(() => {
        onError?.('Mic access denied! Go to: Phone Settings → Apps → Smart Coach → Permissions → Microphone → Allow');
      });
  }, [onResult, onError]);
 
  const stop = useCallback(() => {
    try { recRef.current?.abort(); } catch {}
    setListening(false);
    setInterim('');
  }, []);
 
  return { listening, interim, start, stop };
}
 
/* ═══════════════════════════════════════════════════════════════════
   DAILY VOCAB DATA
═══════════════════════════════════════════════════════════════════ */
const VOCAB_LIST = [
  { word: 'Eloquent', meaning: 'Fluent and persuasive in speaking or writing', example: 'She gave an eloquent speech at the conference.', level: 'B2' },
  { word: 'Concise', meaning: 'Brief but comprehensive', example: 'Keep your emails concise and to the point.', level: 'B1' },
  { word: 'Negotiate', meaning: 'Discuss to reach an agreement', example: 'He negotiated a higher salary with confidence.', level: 'B1' },
  { word: 'Proficient', meaning: 'Competent and skilled', example: 'She is proficient in three languages.', level: 'B2' },
  { word: 'Articulate', meaning: 'Express ideas clearly', example: 'An articulate candidate impresses interviewers.', level: 'B2' },
  { word: 'Diligent', meaning: 'Showing care and effort', example: 'Diligent students practice every day.', level: 'B1' },
  { word: 'Resilient', meaning: 'Able to recover quickly from difficulties', example: 'Resilient professionals thrive under pressure.', level: 'C1' },
  { word: 'Leverage', meaning: 'Use something to maximum advantage', example: 'Leverage your skills to get the job abroad.', level: 'B2' },
  { word: 'Collaborate', meaning: 'Work jointly on an activity', example: 'We collaborated with the international team.', level: 'B1' },
  { word: 'Initiative', meaning: 'The ability to act independently', example: 'Show initiative by suggesting new ideas.', level: 'B2' },
  { word: 'Persevere', meaning: 'Continue despite difficulty', example: 'Persevere with your English practice daily.', level: 'B2' },
  { word: 'Meticulous', meaning: 'Very careful and precise', example: 'Be meticulous in your resume formatting.', level: 'C1' },
  { word: 'Adaptable', meaning: 'Able to adjust to new conditions', example: 'Adaptable employees succeed in global companies.', level: 'B1' },
  { word: 'Proactive', meaning: 'Creating situations rather than just reacting', example: 'Be proactive in seeking feedback.', level: 'B2' },
  { word: 'Constructive', meaning: 'Serving a useful purpose', example: 'Give constructive criticism, not just complaints.', level: 'B1' },
];
 
const FLASHCARDS = [
  { zh: '你好', py: 'Nǐ hǎo', en: 'Hello', cat: 'Greetings' },
  { zh: '謝謝', py: 'Xièxiè', en: 'Thank you', cat: 'Greetings' },
  { zh: '對不起', py: 'Duìbuqǐ', en: 'Sorry', cat: 'Greetings' },
  { zh: '再見', py: 'Zàijiàn', en: 'Goodbye', cat: 'Greetings' },
  { zh: '多少錢', py: 'Duōshǎo qián', en: 'How much?', cat: 'Shopping' },
  { zh: '我不懂', py: 'Wǒ bù dǒng', en: "I don't understand", cat: 'Common' },
  { zh: '廁所在哪裡', py: 'Cèsuǒ zài nǎlǐ', en: 'Where is the toilet?', cat: 'Navigation' },
  { zh: '好吃', py: 'Hǎo chī', en: 'Delicious', cat: 'Food' },
  { zh: '沒問題', py: 'Méi wèntí', en: 'No problem', cat: 'Common' },
  { zh: '請慢慢說', py: 'Qǐng màn màn shuō', en: 'Please speak slowly', cat: 'Polite' },
];
 
const TIMER_QS = [
  'Tell me about yourself.',
  'What are your greatest strengths and weaknesses?',
  'Why do you want this job?',
  'Where do you see yourself in 5 years?',
  'Describe a challenge you overcame.',
  'Why should we hire you?',
  'How do you handle pressure or stress?',
  'Tell me about a time you showed leadership.',
  'What motivates you to do your best work?',
  'Describe your ideal work environment.',
];
 
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'practice', label: 'Practice', icon: '◎' },
  { id: 'pronunciation', label: 'Pronunciation', icon: '◈' },
  { id: 'vocab', label: 'Daily Vocab', icon: '◆' },
  { id: 'chat', label: 'AI Chat', icon: '◌' },
  { id: 'flashcards', label: 'Flashcards', icon: '⬕' },
  { id: 'timer', label: 'Mock Timer', icon: '◷' },
  { id: 'resume', label: 'Resume AI', icon: '◧' },
  { id: 'notes', label: 'Notes', icon: '◫' },
  { id: 'progress', label: 'Progress', icon: '◐' },
  { id: 'profile', label: 'Profile', icon: '◯' },
];
 
/* ═══════════════════════════════════════════════════════════════════
   SHARED STYLES
═══════════════════════════════════════════════════════════════════ */
const C = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    padding: 20,
    marginBottom: 14,
  },
  inp: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border2)',
    color: 'var(--text)',
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'var(--body)',
  },
  ta: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border2)',
    color: 'var(--text)',
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    resize: 'vertical',
    minHeight: 100,
    fontFamily: 'var(--body)',
  },
  btn: {
    padding: '11px 22px',
    background: 'var(--grad)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'opacity 0.2s, transform 0.15s',
    fontFamily: 'var(--font)',
    letterSpacing: '0.01em',
  },
  ibtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    color: 'var(--text2)',
    borderRadius: 10,
    padding: '8px 16px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    transition: 'all 0.15s',
    fontFamily: 'var(--body)',
  },
  sel: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border2)',
    color: 'var(--text)',
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    cursor: 'pointer',
    fontFamily: 'var(--body)',
  },
};
 
/* ═══════════════════════════════════════════════════════════════════
   SECTION TITLE
═══════════════════════════════════════════════════════════════════ */
function T({ children, sub }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em' }}>{children}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 5, fontFamily: 'var(--body)' }}>{sub}</div>}
    </div>
  );
}
 
/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATION TOAST
═══════════════════════════════════════════════════════════════════ */
function Toast({ msg, type = 'info' }) {
  if (!msg) return null;
  const colors = { info: '#5b8def', success: '#06d6a0', error: '#ef4444', warn: '#f59e0b' };
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--surface2)', border: `1px solid ${colors[type]}30`,
      borderLeft: `3px solid ${colors[type]}`, borderRadius: 12,
      padding: '12px 20px', fontSize: 13, color: 'var(--text)',
      zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      animation: 'notif 3s ease forwards', fontFamily: 'var(--body)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ color: colors[type] }}>
        {type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warn' ? '⚠' : 'ℹ'}
      </span>
      {msg}
    </div>
  );
}
 
/* ═══════════════════════════════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════════════════════════════ */
const ONBOARDING = [
  { key: 'name', q: "What's your full name?", placeholder: "Your name..." },
  { key: 'goal', q: "What's your main goal?", type: 'select', options: ['Get a job abroad', 'Improve English for business', 'Pass IELTS/TOEFL', 'Learn Mandarin', 'University admission', 'General English improvement', 'Other'] },
  { key: 'level', q: "Current English level?", type: 'select', options: ['Beginner', 'Elementary', 'Intermediate', 'Upper-Intermediate', 'Advanced'] },
  { key: 'field', q: "Your profession or field?", placeholder: "e.g. Software Engineer, Doctor, Student..." },
  { key: 'country', q: "Target country?", placeholder: "e.g. Taiwan, USA, UK, Canada, Australia..." },
  { key: 'geminiKey', q: "Gemini API Key (for AI features)", placeholder: "AIzaSy...", hint: "Free at aistudio.google.com → Create API Key" },
];
 
/* ═══════════════════════════════════════════════════════════════════
   GITHUB AUTH PROVIDER
═══════════════════════════════════════════════════════════════════ */
const githubProvider = new GithubAuthProvider();
 
/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [authLoad, setAuthLoad] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
 
  // App state
  const [screen, setScreen] = useState('dashboard');
  const [sideOpen, setSideOpen] = useState(true);
  const [toast, setToast] = useState({ msg: '', type: 'info' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [editData, setEditData] = useState({});
 
  // Onboarding
  const [onboarding, setOnboarding] = useState(false);
  const [obStep, setObStep] = useState(0);
  const [obData, setObData] = useState({});
  const [obVal, setObVal] = useState('');
 
  // Practice
  const [transcript, setTranscript] = useState('');
  const [aiResp, setAiResp] = useState('');
  const [aiLoad, setAiLoad] = useState(false);
  const [aiError, setAiError] = useState('');
  const [speaking, setSpeaking] = useState(false);
 
  // Pronunciation
  const [pronTxt, setPronTxt] = useState('');
  const [pronScore, setPronScore] = useState(null);
  const [pronFb, setPronFb] = useState('');
  const [pronLoad, setPronLoad] = useState(false);
 
  // Chat
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoad, setChatLoad] = useState(false);
  const chatEndRef = useRef(null);
 
  // Flashcards
  const [fcIdx, setFcIdx] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcScore, setFcScore] = useState({ correct: 0, wrong: 0 });
 
  // Vocab
  const [vocabIdx, setVocabIdx] = useState(() => new Date().getDate() % VOCAB_LIST.length);
  const [vocabPracticed, setVocabPracticed] = useState('');
  const [vocabFb, setVocabFb] = useState('');
  const [vocabFbLoad, setVocabFbLoad] = useState(false);
  const [vocabFlipped, setVocabFlipped] = useState(false);
 
  // Timer
  const [timerSec, setTimerSec] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerQ, setTimerQ] = useState('');
  const [timerAnswer, setTimerAnswer] = useState('');
  const [timerDone, setTimerDone] = useState(false);
  const [timerFb, setTimerFb] = useState('');
  const [timerFbLoad, setTimerFbLoad] = useState(false);
  const timerRef = useRef(null);
 
  // Resume
  const [resumeText, setResumeText] = useState('');
  const [resumeFb, setResumeFb] = useState('');
  const [resumeLoad, setResumeLoad] = useState(false);
  const [resumeTab, setResumeTab] = useState('analyze');
 
  // Notes
  const [notes, setNotes] = useState([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
 
  // Sessions & progress
  const [sessions, setSessions] = useState([]);
  const [streak, setStreak] = useState(0);
 
  // Inject styles
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
    return () => { try { document.head.removeChild(s); } catch {} };
  }, []);
 
  // Android TTS keepalive — prevents Chrome Android from stopping TTS
  useEffect(() => {
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis && !ttsPlaying) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
    return () => clearInterval(keepAlive);
  }, []);
 
  // Toast helper
  const showToast = (msg, type = 'info', duration = 3000) => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'info' }), duration);
  };
 
  // Streak check
  const checkStreak = (sessions) => {
    if (!sessions.length) return 0;
    let s = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    const dates = [...new Set(sessions.map(x => x.date))].sort((a, b) => new Date(b) - new Date(a));
    if (dates[0] !== today && dates[0] !== yesterday) return 0;
    for (let i = 0; i < dates.length; i++) {
      const d = new Date(Date.now() - i * 864e5).toDateString();
      if (dates[i] === d) s++;
      else break;
    }
    return s;
  };
 
  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const ref = doc(db, 'users', u.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data();
            setUserProfile(data);
            setSessions(data.sessions || []);
            setStreak(checkStreak(data.sessions || []));
            setNotes(data.notes || []);
            setChatMsgs(data.chatHistory || []);
          } else {
            setOnboarding(true);
          }
        } catch {}
      } else {
        setUserProfile(null);
        setSessions([]);
        setNotes([]);
        setChatMsgs([]);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);
 
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);
 
  useEffect(() => {
    if (timerRunning && timerSec > 0) {
      timerRef.current = setTimeout(() => setTimerSec(s => s - 1), 1000);
    } else if (timerRunning && timerSec === 0) {
      setTimerRunning(false);
      setTimerDone(true);
      showToast("Time's up! Type your answer.", 'warn');
    }
    return () => clearTimeout(timerRef.current);
  }, [timerRunning, timerSec]);
 
  const saveToFirestore = async (data) => {
    if (!user) return;
    try { await updateDoc(doc(db, 'users', user.uid), data); } catch {}
  };
 
  const recordSession = async (mod) => {
    const s = { mod, date: new Date().toDateString(), ts: Date.now() };
    const updated = [s, ...sessions].slice(0, 500);
    setSessions(updated);
    const newStreak = checkStreak(updated);
    setStreak(newStreak);
    await saveToFirestore({ sessions: updated, streak: newStreak });
    if (newStreak > 0 && newStreak % 7 === 0) {
      showToast(`🔥 ${newStreak} day streak! Amazing!`, 'success', 5000);
    }
  };
 
  // Mic hook
  const { listening, interim, start: startListen, stop: stopListen } = useMic({
    onResult: async (text) => {
      setTranscript(text);
      const p = userProfile;
      await askAI(
        `You are Smart Coach — a personal AI English coach for ${p?.name || 'the user'}.
Goal: ${p?.goal || 'improve English'} | Field: ${p?.field || 'general'} | Level: ${p?.level || 'intermediate'} | Target: ${p?.country || 'abroad'}.
The student said: "${text}"
Give structured feedback:
1. Fluency score /10
2. Grammar corrections (if any)
3. Better phrasing suggestion
4. One encouragement tip
Keep it under 100 words. Be warm and motivating.`
      );
    },
    onError: (msg) => {
      setAiError(msg);
      showToast(msg, 'error', 5000);
    },
  });
 
  const askAI = async (prompt) => {
    stopSpeak();
    setSpeaking(false);
    setAiLoad(true);
    setAiResp('');
    setAiError('');
    try {
      const text = await gemini(prompt, userProfile?.geminiKey);
      const clean = stripMd(text);
      setAiResp(clean);
      setSpeaking(true);
      androidSpeak(clean, () => setSpeaking(false));
      await recordSession('Practice');
    } catch (e) {
      setAiError(e.message);
      showToast(e.message, 'error');
    }
    setAiLoad(false);
  };
 
  // ── AUTH ──
  const loginGoogle = async () => {
    setAuthLoad(true); setAuthErr('');
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { setAuthErr(e.message.replace('Firebase: ', '').replace(/\(auth.*\)/, '')); }
    setAuthLoad(false);
  };
 
  const loginGithub = async () => {
    setAuthLoad(true); setAuthErr('');
    try { await signInWithPopup(auth, githubProvider); }
    catch (e) { setAuthErr(e.message.replace('Firebase: ', '').replace(/\(auth.*\)/, '')); }
    setAuthLoad(false);
  };
 
  const emailAuth = async () => {
    setAuthLoad(true); setAuthErr(''); setVerifyMsg('');
    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        setVerifyMsg('Verification email sent! Check your inbox, then login.');
        await signOut(auth);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!cred.user.emailVerified) {
          setAuthErr('Please verify your email first. Check your inbox.');
          await signOut(auth);
        }
      }
    } catch (e) {
      setAuthErr(e.message.replace('Firebase: ', '').replace(/\(auth.*\)/, ''));
    }
    setAuthLoad(false);
  };
 
  const logout = async () => {
    stopSpeak();
    await signOut(auth);
    setUserProfile(null);
    setSessions([]);
    setScreen('dashboard');
  };
 
  // ── ONBOARDING ──
  const completeOnboarding = async (data) => {
    if (!user) return;
    const profile = {
      ...data,
      email: user.email,
      createdAt: Date.now(),
      sessions: [],
      streak: 0,
      notes: [],
      chatHistory: [],
    };
    await setDoc(doc(db, 'users', user.uid), profile);
    setUserProfile(profile);
    setOnboarding(false);
    showToast(`Welcome, ${data.name?.split(' ')[0]}! Your coach is ready! 🎓`, 'success', 4000);
  };
 
  const obNext = () => {
    const key = ONBOARDING[obStep].key;
    if (!obVal.trim() && key !== 'geminiKey') return;
    const updated = { ...obData, [key]: obVal.trim() };
    setObData(updated);
    setObVal('');
    if (obStep < ONBOARDING.length - 1) setObStep(obStep + 1);
    else completeOnboarding(updated);
  };
 
  // ── PRONUNCIATION ──
  const checkPron = async () => {
    if (!pronTxt.trim()) return;
    setPronLoad(true); setPronScore(null); setPronFb('');
    try {
      const res = await gemini(
        `You are a pronunciation coach. Evaluate this English text: "${pronTxt}"
Format your response EXACTLY as:
SCORE: [0-100]
ISSUES: [specific sounds that need work]
BETTER: [phonetic pronunciation guide]
TIP: [one practice tip]`,
        userProfile?.geminiKey
      );
      const m = res.match(/SCORE:\s*(\d+)/);
      setPronScore(m ? parseInt(m[1]) : 70);
      setPronFb(res.replace(/SCORE:\s*\d+/, '').trim());
      await recordSession('Pronunciation');
    } catch (e) {
      setPronFb('Error: ' + e.message);
      showToast(e.message, 'error');
    }
    setPronLoad(false);
  };
 
  // ── CHAT ──
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoad) return;
    const userMsg = { role: 'user', text: chatInput.trim(), ts: Date.now() };
    const newMsgs = [...chatMsgs, userMsg];
    setChatMsgs(newMsgs);
    setChatInput('');
    setChatLoad(true);
    try {
      const history = newMsgs.slice(-8).map(m => `${m.role === 'user' ? 'Student' : 'Coach'}: ${m.text}`).join('\n');
      const resp = await gemini(
        `You are Smart Coach, a warm and expert AI coach for ${userProfile?.name || 'the student'}.
Their profile: Goal: ${userProfile?.goal || 'improve English'} | Field: ${userProfile?.field || 'general'} | Level: ${userProfile?.level || 'intermediate'} | Target: ${userProfile?.country || 'abroad'}.
 
Conversation history:
${history}
 
Give a helpful, personalized response. Max 120 words. Be encouraging.`,
        userProfile?.geminiKey
      );
      const aiMsg = { role: 'ai', text: stripMd(resp), ts: Date.now() };
      const final = [...newMsgs, aiMsg];
      setChatMsgs(final);
      await saveToFirestore({ chatHistory: final.slice(-60) });
      await recordSession('Chat');
    } catch (e) {
      setChatMsgs([...newMsgs, { role: 'ai', text: '❌ ' + e.message, ts: Date.now() }]);
    }
    setChatLoad(false);
  };
 
  // ── VOCAB ──
  const practiceVocab = async () => {
    if (!vocabPracticed.trim()) return;
    setVocabFbLoad(true); setVocabFb('');
    const word = VOCAB_LIST[vocabIdx];
    try {
      const fb = await gemini(
        `Vocab practice for "${word.word}". Student's sentence: "${vocabPracticed}".
Check: 1) Is the word used correctly? 2) Grammar ok? 3) Suggest a better sentence.
Max 80 words. Be encouraging.`,
        userProfile?.geminiKey
      );
      setVocabFb(stripMd(fb));
      await recordSession('Vocab');
    } catch (e) {
      setVocabFb('Error: ' + e.message);
    }
    setVocabFbLoad(false);
  };
 
  // ── RESUME ──
  const analyzeResume = async () => {
    if (!resumeText.trim()) return;
    setResumeLoad(true); setResumeFb('');
    try {
      const prompts = {
        analyze: `You are a professional resume coach for ${userProfile?.name || 'the user'} targeting ${userProfile?.country || 'abroad'} in ${userProfile?.field || 'their field'}.
Analyze this resume/CV:
"${resumeText}"
Give:
1. Overall Score /10
2. Top 3 strengths
3. Top 3 improvements needed
4. ATS keywords missing
5. One rewritten bullet point as example
Be specific and actionable. Max 200 words.`,
        rewrite: `Rewrite and improve this resume content for ${userProfile?.field || 'a professional'} applying in ${userProfile?.country || 'abroad'}:
"${resumeText}"
Make it: more impactful, ATS-friendly, use strong action verbs, quantify achievements where possible.
Return only the improved version.`,
        cover: `Write a professional cover letter for ${userProfile?.name || 'the applicant'} — a ${userProfile?.field || 'professional'} targeting ${userProfile?.country || 'abroad'}.
Based on their resume/experience:
"${resumeText}"
Goal: ${userProfile?.goal || 'get a job abroad'}.
Write a compelling 3-paragraph cover letter. Max 200 words.`,
      };
      const fb = await gemini(prompts[resumeTab], userProfile?.geminiKey);
      setResumeFb(stripMd(fb));
      await recordSession('Resume AI');
    } catch (e) {
      setResumeFb('Error: ' + e.message);
      showToast(e.message, 'error');
    }
    setResumeLoad(false);
  };
 
  // ── NOTES ──
  const saveNote = async () => {
    if (!noteTitle.trim()) return;
    const n = { title: noteTitle, body: noteBody, ts: Date.now() };
    const updated = [n, ...notes];
    setNotes(updated);
    setNoteTitle(''); setNoteBody('');
    await saveToFirestore({ notes: updated });
    showToast('Note saved!', 'success');
  };
 
  const deleteNote = async (i) => {
    const updated = notes.filter((_, idx) => idx !== i);
    setNotes(updated);
    await saveToFirestore({ notes: updated });
  };
 
  // ── TIMER ──
  const startTimer = () => {
    const q = TIMER_QS[Math.floor(Math.random() * TIMER_QS.length)];
    setTimerQ(q); setTimerSec(60); setTimerRunning(true);
    setTimerDone(false); setTimerAnswer(''); setTimerFb('');
    androidSpeak(q, () => {});
  };
 
  const getTimerFeedback = async () => {
    if (!timerAnswer.trim()) return;
    setTimerFbLoad(true); setTimerFb('');
    try {
      const fb = await gemini(
        `Interview coach for ${userProfile?.name || 'user'} targeting ${userProfile?.country || 'abroad'} in ${userProfile?.field || 'their field'}.
Question: "${timerQ}"
Answer given in ${60 - timerSec}s: "${timerAnswer}"
Give:
1. Score /10
2. What was good
3. What to improve
4. Model answer (2-3 sentences)
Max 150 words.`,
        userProfile?.geminiKey
      );
      setTimerFb(stripMd(fb));
      await recordSession('Mock Timer');
    } catch (e) {
      setTimerFb('Error: ' + e.message);
    }
    setTimerFbLoad(false);
  };
 
  // ── PROFILE EDIT ──
  const saveProfile = async () => {
    const updated = { ...userProfile, ...editData };
    setUserProfile(updated);
    await saveToFirestore(editData);
    setEditingProfile(false);
    showToast('Profile updated!', 'success');
  };
 
  // ── STATS ──
  const today = new Date().toDateString();
  const todaySess = sessions.filter(s => s.date === today).length;
  const weekSess = sessions.filter(s => (Date.now() - (s.ts || 0)) < 7 * 864e5).length;
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5);
    return {
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      count: sessions.filter(s => s.date === d.toDateString()).length,
    };
  });
  const maxC = Math.max(...last7.map(d => d.count), 1);
 
  const modCounts = sessions.reduce((acc, s) => {
    acc[s.mod] = (acc[s.mod] || 0) + 1;
    return acc;
  }, {});
 
  /* ─────────────────────────────────────────────────────────────
     LOADING
  ───────────────────────────────────────────────────────────── */
  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--body)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }} className="float">🎓</div>
        <div style={{ fontFamily: 'var(--font)', fontSize: 22, fontWeight: 800, color: '#e8ecf4', marginBottom: 8 }}>Smart Coach</div>
        <div style={{ color: '#3a4258', fontSize: 13 }}>Loading your coaching session...</div>
      </div>
    </div>
  );
 
  /* ─────────────────────────────────────────────────────────────
     LOGIN
  ───────────────────────────────────────────────────────────── */
  if (!user) return (
    <div style={{ minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'var(--body)', position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(91,141,239,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
 
      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }} className="fadeUp">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #5b8def 0%, #8b5cf6 100%)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 36, boxShadow: '0 20px 60px rgba(91,141,239,0.3)' }}>🎓</div>
          <div style={{ fontFamily: 'var(--font)', fontSize: 30, fontWeight: 800, color: '#e8ecf4', letterSpacing: '-0.03em', marginBottom: 6 }}>Smart Coach</div>
          <div style={{ fontSize: 13, color: '#3a4258' }}>AI-powered language & career coaching</div>
        </div>
 
        <div style={{ background: '#0c0f1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 22, padding: '30px 26px' }}>
          {verifyMsg && (
            <div style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#06d6a0', marginBottom: 18 }}>
              ✅ {verifyMsg}
            </div>
          )}
 
          {/* Social logins */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <button onClick={loginGoogle} disabled={authLoad}
              style={{ width: '100%', padding: '13px', background: '#fff', color: '#111', border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} className="btn-press">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
 
            <button onClick={loginGithub} disabled={authLoad}
              style={{ width: '100%', padding: '13px', background: '#24292f', color: '#fff', border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} className="btn-press">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>
          </div>
 
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <span style={{ fontSize: 11, color: '#3a4258', letterSpacing: 1, textTransform: 'uppercase' }}>or email</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          </div>
 
          {/* Mode tabs */}
          <div style={{ display: 'flex', background: '#060810', borderRadius: 12, padding: 3, marginBottom: 16 }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthErr(''); setVerifyMsg(''); }}
                style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: authMode === m ? '#111520' : 'transparent', color: authMode === m ? '#5b8def' : '#3a4258', transition: 'all 0.2s', fontFamily: 'var(--font)' }}>
                {m === 'login' ? 'Login' : 'Sign Up'}
              </button>
            ))}
          </div>
 
          <input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ ...C.inp, marginBottom: 10 }} />
          <input placeholder="Password (min 6 chars)" type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && emailAuth()}
            style={{ ...C.inp, marginBottom: 14 }} />
 
          {authErr && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '11px 16px', borderRadius: 12, fontSize: 13, marginBottom: 14 }}>
              {authErr}
            </div>
          )}
 
          <button onClick={emailAuth} disabled={authLoad}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #5b8def, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: authLoad ? 0.7 : 1, fontFamily: 'var(--font)', letterSpacing: '-0.01em', transition: 'opacity 0.2s' }} className="btn-press">
            {authLoad ? '...' : authMode === 'login' ? 'Login →' : 'Create Account →'}
          </button>
 
          {authMode === 'signup' && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#3a4258', textAlign: 'center' }}>
              After signup, verify your email before logging in
            </div>
          )}
        </div>
      </div>
    </div>
  );
 
  /* ─────────────────────────────────────────────────────────────
     ONBOARDING
  ───────────────────────────────────────────────────────────── */
  if (onboarding) {
    const step = ONBOARDING[obStep];
    const progress = (obStep / ONBOARDING.length) * 100;
    return (
      <div style={{ minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'var(--body)' }}>
        <div style={{ width: '100%', maxWidth: 480 }} className="fadeUp">
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, color: '#3a4258' }}>
              <span style={{ fontFamily: 'var(--font)', fontWeight: 600 }}>Setting up your personal coach</span>
              <span>{obStep + 1}/{ONBOARDING.length}</span>
            </div>
            <div style={{ height: 4, background: '#111520', borderRadius: 4 }}>
              <div style={{ height: '100%', borderRadius: 4, width: `${progress}%`, background: 'linear-gradient(90deg, #5b8def, #8b5cf6)', transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
          </div>
 
          <div style={{ background: '#0c0f1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 22, padding: '36px 30px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#e8ecf4', fontFamily: 'var(--font)', letterSpacing: '-0.02em' }}>{step.q}</div>
            {step.hint && (
              <div style={{ fontSize: 12, color: '#5b8def', marginBottom: 20, background: 'rgba(91,141,239,0.08)', border: '1px solid rgba(91,141,239,0.15)', borderRadius: 10, padding: '8px 12px', display: 'inline-block' }}>
                💡 {step.hint}
              </div>
            )}
 
            <div style={{ marginBottom: 24 }}>
              {step.type === 'select' ? (
                <select value={obVal} onChange={e => setObVal(e.target.value)} style={C.sel}>
                  <option value="">Select an option...</option>
                  {step.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={obVal} onChange={e => setObVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && obNext()}
                  placeholder={step.placeholder}
                  type={step.key === 'geminiKey' ? 'password' : 'text'}
                  style={{ ...C.inp, fontSize: 16 }} />
              )}
            </div>
 
            <button onClick={obNext} disabled={!obVal.trim() && step.key !== 'geminiKey'}
              style={{ ...C.btn, width: '100%', justifyContent: 'center', padding: '15px', fontSize: 16, opacity: (!obVal.trim() && step.key !== 'geminiKey') ? 0.4 : 1 }}>
              {obStep < ONBOARDING.length - 1 ? 'Next →' : '🚀 Start Coaching!'}
            </button>
 
            {obStep === ONBOARDING.length - 1 && (
              <button onClick={() => completeOnboarding({ ...obData, geminiKey: '' })}
                style={{ width: '100%', marginTop: 10, padding: '12px', background: 'transparent', border: '1px solid var(--border)', color: '#3a4258', borderRadius: 12, fontSize: 13, cursor: 'pointer' }}>
                Skip — add API key later in Profile
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
 
  /* ─────────────────────────────────────────────────────────────
     MAIN APP
  ───────────────────────────────────────────────────────────── */
  const userName = userProfile?.name?.split(' ')[0] || 'Coach';
 
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--body)' }}>
      <Toast msg={toast.msg} type={toast.type} />
 
      {/* ── SIDEBAR ── */}
      <aside style={{ width: sideOpen ? 218 : 60, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '16px 8px', gap: 2, transition: 'width 0.28s cubic-bezier(0.16,1,0.3,1)', overflow: 'hidden', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', marginBottom: 20, height: 40 }}>
          <button onClick={() => setSideOpen(!sideOpen)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text3)', cursor: 'pointer', padding: '6px 8px', flexShrink: 0, fontSize: 12, borderRadius: 8, transition: 'all 0.2s' }}>
            {sideOpen ? '←' : '→'}
          </button>
          {sideOpen && <span style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 16, color: '#5b8def', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>Smart Coach</span>}
        </div>
 
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setScreen(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: screen === item.id ? 'rgba(91,141,239,0.1)' : 'transparent', color: screen === item.id ? '#5b8def' : 'var(--text3)', transition: 'all 0.15s', position: 'relative' }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
              {sideOpen && <span style={{ fontSize: 13, fontWeight: screen === item.id ? 700 : 400, fontFamily: screen === item.id ? 'var(--font)' : 'var(--body)' }}>{item.label}</span>}
              {screen === item.id && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: '#5b8def', borderRadius: 2 }} />}
            </button>
          ))}
        </div>
 
        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', borderRadius: 12, transition: 'color 0.2s' }}
          onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}>
          <span>↩</span>{sideOpen && <span style={{ fontSize: 13 }}>Logout</span>}
        </button>
      </aside>
 
      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
 
        {/* HEADER */}
        <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user?.photoURL
              ? <img src={user.photoURL} style={{ width: 38, height: 38, borderRadius: 12, objectFit: 'cover' }} alt="" />
              : <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#5b8def,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font)' }}>
                  {(userProfile?.name || user?.email || 'U')[0].toUpperCase()}
                </div>
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font)' }}>{userProfile?.name || 'Welcome!'}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{userProfile?.goal || 'Getting started...'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }} className="header-actions">
            <span style={{ padding: '5px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font)' }}>🔥 {streak}d</span>
            <span style={{ padding: '5px 14px', background: todaySess >= 3 ? 'rgba(6,214,160,0.1)' : 'rgba(6,214,160,0.05)', border: `1px solid rgba(6,214,160,${todaySess >= 3 ? '0.3' : '0.15'})`, borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#06d6a0', fontFamily: 'var(--font)' }}>{todaySess}/3 today</span>
          </div>
        </header>
 
        {/* MOBILE BOTTOM NAV */}
        <nav className="mobile-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '8px 4px', zIndex: 100, justifyContent: 'space-around', alignItems: 'center' }}>
          {NAV.slice(0, 6).map(item => (
            <button key={item.id} onClick={() => setScreen(item.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', color: screen === item.id ? '#5b8def' : 'var(--text3)', flex: 1 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 9, fontWeight: screen === item.id ? 700 : 400 }}>{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
 
        <main className="main-content" style={{ flex: 1, overflowY: 'auto', padding: 24, paddingBottom: 80 }}>
 
          {/* ════════════════════════════════════════
              DASHBOARD
          ════════════════════════════════════════ */}
          {screen === 'dashboard' && (
            <div className="fadeUp">
              {/* Welcome banner */}
              <div style={{ background: 'linear-gradient(135deg, #0d1117 0%, #111827 100%)', border: '1px solid rgba(91,141,239,0.12)', borderRadius: 20, padding: '24px 28px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, background: 'radial-gradient(circle, rgba(91,141,239,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{ fontSize: 11, color: '#5b8def', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, fontFamily: 'var(--font)' }}>Your AI Coach</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#e8ecf4', fontFamily: 'var(--font)', letterSpacing: '-0.02em', marginBottom: 6 }}>
                  Welcome back, {userName}! 👋
                </div>
                <div style={{ fontSize: 13, color: '#3a4258' }}>{userProfile?.goal} · {userProfile?.country}</div>
 
                {/* Today's vocab word pill */}
                <div onClick={() => setScreen('vocab')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '8px 16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}>
                  <span style={{ fontSize: 14 }}>◆</span>
                  <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>Today's word: <strong>{VOCAB_LIST[vocabIdx].word}</strong></span>
                  <span style={{ fontSize: 11, color: '#7a8499' }}>→</span>
                </div>
              </div>
 
              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: '📚', label: 'Total Sessions', value: sessions.length, c: '#5b8def' },
                  { icon: '🔥', label: 'Day Streak', value: `${streak}d`, c: '#f59e0b' },
                  { icon: '📈', label: 'This Week', value: weekSess, c: '#06d6a0' },
                  { icon: '🎯', label: 'Today', value: `${todaySess}/3`, c: '#8b5cf6' },
                ].map(s => (
                  <div key={s.label} style={{ ...C.card, textAlign: 'center', marginBottom: 0, transition: 'all 0.2s' }} className="card-hover">
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.c, fontFamily: 'var(--font)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
 
              {/* Daily goal */}
              <div style={C.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)' }}>Daily Goal</span>
                  <span style={{ fontSize: 12, color: todaySess >= 3 ? '#06d6a0' : 'var(--text3)' }}>{todaySess}/3 sessions</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                  <div style={{ height: '100%', borderRadius: 6, width: `${Math.min(todaySess / 3 * 100, 100)}%`, background: 'linear-gradient(90deg, #5b8def, #8b5cf6)', transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
                </div>
                {todaySess >= 3 && <div style={{ marginTop: 10, color: '#06d6a0', fontSize: 13, fontWeight: 600 }}>🎉 Daily goal complete! Excellent work!</div>}
              </div>
 
              {/* Quick actions */}
              <T sub="Tap to start a session">Quick Practice</T>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>
                {[
                  { label: 'Free Speaking', icon: '🎤', action: () => setScreen('practice') },
                  { label: 'Job Interview', icon: '💼', action: () => { setScreen('practice'); askAI(`You are an interview coach. Ask ${userName} one challenging interview question for a ${userProfile?.field || 'professional'} role in ${userProfile?.country || 'abroad'}. Just ask the question, don't answer it.`); } },
                  { label: 'Pronunciation', icon: '🔤', action: () => setScreen('pronunciation') },
                  { label: 'Daily Vocab', icon: '◆', action: () => setScreen('vocab') },
                  { label: 'AI Chat', icon: '💬', action: () => setScreen('chat') },
                  { label: 'Resume AI', icon: '📄', action: () => setScreen('resume') },
                  { label: 'Flashcards', icon: '🃏', action: () => setScreen('flashcards') },
                  { label: 'Mock Timer', icon: '⏱', action: () => setScreen('timer') },
                ].map(m => (
                  <button key={m.label} onClick={m.action}
                    style={{ ...C.card, marginBottom: 0, textAlign: 'center', cursor: 'pointer', background: 'var(--surface)', transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)' }} className="card-hover btn-press">
                    <div style={{ fontSize: 26, marginBottom: 8 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', color: 'var(--text)' }}>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
 
          {/* ════════════════════════════════════════
              PRACTICE
          ════════════════════════════════════════ */}
          {screen === 'practice' && (
            <div className="fadeUp">
              <T sub="Speak and get instant personalized feedback">AI Practice Partner</T>
 
              <div style={{ background: 'linear-gradient(135deg, #0d1117, #111827)', border: '1px solid rgba(91,141,239,0.12)', borderRadius: 20, padding: '28px 24px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 11, color: '#5b8def', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, fontFamily: 'var(--font)' }}>Coach for {userName}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#e8ecf4', marginBottom: 6, fontFamily: 'var(--font)' }}>Speak → Get Feedback</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Tap the mic, speak naturally, get instant AI coaching</div>
 
                    {/* Mic permission note */}
                    <div style={{ fontSize: 12, color: '#3a4258', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
                      📱 First time? Allow mic when prompted. If blocked: Settings → Apps → Smart Coach → Permissions → Mic → Allow
                    </div>
 
                    {(interim || transcript) && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: 12, fontSize: 13, color: '#7a8499', marginTop: 8 }}>
                        💬 "{interim || transcript}"
                      </div>
                    )}
                    {aiError && (
                      <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: 12, fontSize: 13, color: '#ef4444' }}>
                        ⚠️ {aiError}
                      </div>
                    )}
                  </div>
 
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button onClick={listening ? stopListen : startListen}
                      style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, background: listening ? '#ef4444' : 'linear-gradient(135deg,#5b8def,#8b5cf6)', animation: listening ? 'micPulse 1.5s ease-in-out infinite' : 'none', boxShadow: listening ? 'none' : '0 8px 30px rgba(91,141,239,0.3)', transition: 'all 0.2s' }} className="btn-press">
                      {listening ? '⏹' : '🎤'}
                    </button>
                    <span style={{ fontSize: 11, color: listening ? '#ef4444' : 'var(--text3)', fontWeight: listening ? 600 : 400 }}>
                      {listening ? '● Recording...' : 'Tap to speak'}
                    </span>
                  </div>
                </div>
              </div>
 
              {/* Quick prompts */}
              <div style={C.card}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, fontWeight: 600 }}>Quick topics:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: '👤 Introduce Yourself', p: `Ask ${userName} to introduce themselves professionally for a ${userProfile?.field || 'professional'} role in ${userProfile?.country || 'abroad'}. Just give the prompt, don't answer.` },
                    { label: '💼 Interview Q', p: `Ask one tough interview question for a ${userProfile?.field || 'professional'} applying in ${userProfile?.country || 'abroad'}. Just the question.` },
                    { label: '✈️ Visa Interview', p: `Ask one challenging visa officer question for someone going to ${userProfile?.country || 'abroad'}. Just the question.` },
                    { label: '📞 Phone Call', p: `Simulate a professional phone call scenario in English for a ${userProfile?.field || 'professional'}. Describe the scenario, then ask: how would you start this call?` },
                    { label: '📧 Email Writing', p: `Give a professional email writing exercise for a ${userProfile?.field || 'professional'} in ${userProfile?.country || 'abroad'}. Just give the scenario.` },
                    { label: '🤝 Small Talk', p: `Give a small talk scenario for someone networking in ${userProfile?.country || 'abroad'} as a ${userProfile?.field || 'professional'}. Just the scenario.` },
                  ].map(m => (
                    <button key={m.label} onClick={() => askAI(m.p)}
                      style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s' }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#5b8def'; e.currentTarget.style.color = '#5b8def'; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
 
              {aiLoad && (
                <div style={{ ...C.card, color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="spin" style={{ fontSize: 16 }}>⟳</span>
                  AI thinking...
                </div>
              )}
 
              {aiResp && !aiLoad && (
                <div style={{ ...C.card, borderColor: 'rgba(91,141,239,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 11, color: '#5b8def', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font)' }}>AI Feedback</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => {
                        if (speaking) { stopSpeak(); setSpeaking(false); }
                        else { setSpeaking(true); androidSpeak(aiResp, () => setSpeaking(false)); }
                      }} style={C.ibtn}>
                        {speaking ? '⏸ Pause' : '▶ Play'}
                      </button>
                      <button onClick={() => { setAiResp(''); setTranscript(''); stopSpeak(); setSpeaking(false); }} style={C.ibtn}>↺ Reset</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{aiResp}</div>
                </div>
              )}
            </div>
          )}
 
          {/* ════════════════════════════════════════
              PRONUNCIATION
          ════════════════════════════════════════ */}
          {screen === 'pronunciation' && (
            <div className="fadeUp">
              <T sub="Type text → get pronunciation score and tips">Pronunciation Checker</T>
              <div style={C.card}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <input value={pronTxt} onChange={e => setPronTxt(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkPron()}
                    placeholder="Type an English sentence to check..." style={{ ...C.inp, flex: 1, minWidth: 180 }} />
                  <button onClick={checkPron} disabled={pronLoad || !pronTxt.trim()} style={{ ...C.btn, opacity: pronLoad ? 0.6 : 1 }}>
                    {pronLoad ? <span className="spin">⟳</span> : 'Analyze'}
                  </button>
                </div>
 
                {/* Quick samples */}
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Try these:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['I would like to schedule a meeting.', 'Thank you for the opportunity.', 'Could you please clarify that?'].map(s => (
                    <button key={s} onClick={() => setPronTxt(s)}
                      style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>
                      {s.substring(0, 28)}...
                    </button>
                  ))}
                </div>
              </div>
 
              {pronScore !== null && !pronLoad && (
                <div style={{ ...C.card, borderColor: pronScore >= 80 ? 'rgba(6,214,160,0.2)' : pronScore >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                      <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                        <circle cx="45" cy="45" r="36" fill="none"
                          stroke={pronScore >= 80 ? '#06d6a0' : pronScore >= 60 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="8" strokeLinecap="round"
                          strokeDasharray="226"
                          strokeDashoffset={226 - (226 * pronScore / 100)}
                          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }} />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: pronScore >= 80 ? '#06d6a0' : pronScore >= 60 ? '#f59e0b' : '#ef4444', fontFamily: 'var(--font)' }}>{pronScore}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>/100</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font)', marginBottom: 4 }}>
                        {pronScore >= 80 ? 'Excellent! 🎉' : pronScore >= 60 ? 'Keep Going! 💪' : 'Needs Practice 📖'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                        {pronScore >= 80 ? 'Native-level pronunciation!' : pronScore >= 60 ? 'Good progress, a few areas to refine' : 'Daily practice will improve this fast'}
                      </div>
                      <button onClick={() => pronTxt && androidSpeak(pronTxt, () => {})} style={{ ...C.ibtn, marginTop: 10, fontSize: 12 }}>🔊 Hear correct pronunciation</button>
                    </div>
                  </div>
                  {pronFb && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{pronFb}</div>
                  )}
                </div>
              )}
            </div>
          )}
 
          {/* ════════════════════════════════════════
              DAILY VOCAB
          ════════════════════════════════════════ */}
          {screen === 'vocab' && (
            <div className="fadeUp">
              <T sub="Learn one powerful word every day">Daily Vocabulary</T>
 
              {/* Vocab card */}
              <div onClick={() => setVocabFlipped(!vocabFlipped)}
                style={{ ...C.card, cursor: 'pointer', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative', borderColor: 'rgba(139,92,246,0.2)', transition: 'all 0.3s', background: vocabFlipped ? 'rgba(139,92,246,0.05)' : 'var(--surface)' }} className="card-hover">
                <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, color: 'var(--text3)' }}>Tap to flip</div>
                <div style={{ position: 'absolute', top: 12, left: 14, padding: '3px 10px', background: 'rgba(139,92,246,0.1)', borderRadius: 20, fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>{VOCAB_LIST[vocabIdx].level}</div>
 
                {!vocabFlipped ? (
                  <div>
                    <div style={{ fontSize: 42, fontWeight: 800, color: '#8b5cf6', fontFamily: 'var(--font)', letterSpacing: '-0.03em', marginBottom: 8 }}>{VOCAB_LIST[vocabIdx].word}</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>Tap to see meaning</div>
                  </div>
                ) : (
                  <div style={{ maxWidth: 380 }}>
                    <div style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, marginBottom: 10, fontFamily: 'var(--font)' }}>{VOCAB_LIST[vocabIdx].meaning}</div>
                    <div style={{ fontSize: 13, color: '#a78bfa', fontStyle: 'italic', marginBottom: 14 }}>"{VOCAB_LIST[vocabIdx].example}"</div>
                    <button onClick={(e) => { e.stopPropagation(); androidSpeak(`${VOCAB_LIST[vocabIdx].word}. ${VOCAB_LIST[vocabIdx].meaning}. Example: ${VOCAB_LIST[vocabIdx].example}`, () => {}); }}
                      style={C.ibtn}>🔊 Hear it</button>
                  </div>
                )}
              </div>
 
              {/* Navigate vocab */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <button onClick={() => { setVocabIdx(i => Math.max(0, i - 1)); setVocabFlipped(false); setVocabFb(''); setVocabPracticed(''); }} style={C.ibtn} disabled={vocabIdx === 0}>← Previous</button>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{vocabIdx + 1} / {VOCAB_LIST.length}</span>
                <button onClick={() => { setVocabIdx(i => Math.min(VOCAB_LIST.length - 1, i + 1)); setVocabFlipped(false); setVocabFb(''); setVocabPracticed(''); }} style={C.ibtn} disabled={vocabIdx === VOCAB_LIST.length - 1}>Next →</button>
              </div>
 
              {/* Practice section */}
              <div style={C.card}>
                <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font)', marginBottom: 4 }}>Practice it!</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
                  Use <strong style={{ color: '#a78bfa' }}>{VOCAB_LIST[vocabIdx].word}</strong> in your own sentence:
                </div>
                <textarea value={vocabPracticed} onChange={e => setVocabPracticed(e.target.value)}
                  placeholder={`Write a sentence using "${VOCAB_LIST[vocabIdx].word}"...`}
                  style={{ ...C.ta, minHeight: 80, marginBottom: 10 }} />
                <button onClick={practiceVocab} disabled={vocabFbLoad || !vocabPracticed.trim()} style={{ ...C.btn, opacity: vocabFbLoad ? 0.6 : 1 }}>
                  {vocabFbLoad ? <><span className="spin">⟳</span> Checking...</> : 'Check My Sentence'}
                </button>
                {vocabFb && (
                  <div style={{ marginTop: 14, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
                    {vocabFb}
                  </div>
                )}
              </div>
 
              {/* All words list */}
              <T sub="All vocabulary words">Word Bank</T>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 8 }}>
                {VOCAB_LIST.map((v, i) => (
                  <button key={v.word} onClick={() => { setVocabIdx(i); setVocabFlipped(false); setVocabFb(''); setVocabPracticed(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    style={{ padding: '10px 14px', background: i === vocabIdx ? 'rgba(139,92,246,0.1)' : 'var(--surface)', border: `1px solid ${i === vocabIdx ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: i === vocabIdx ? '#a78bfa' : 'var(--text)', fontFamily: 'var(--font)' }}>{v.word}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{v.level}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
 
          {/* ════════════════════════════════════════
              CHAT
          ════════════════════════════════════════ */}
          {screen === 'chat' && (
            <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <T sub={`Personalized for ${userProfile?.level || 'your level'}`}>AI Chat Coach</T>
                <button onClick={() => { setChatMsgs([]); saveToFirestore({ chatHistory: [] }); }} style={{ ...C.ibtn, fontSize: 11 }}>🗑 Clear</button>
              </div>
 
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                {chatMsgs.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, paddingTop: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
                    <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: 'var(--font)' }}>Hi {userName}!</div>
                    <div style={{ fontSize: 13 }}>Ask me anything about English, interviews, or {userProfile?.country || 'your goals'}!</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                      {[`How do I answer "Tell me about yourself"?`, `What are common mistakes in ${userProfile?.country || 'job'} interviews?`, 'Correct my English grammar', 'Teach me a useful phrase'].map(s => (
                        <button key={s} onClick={() => { setChatInput(s); }}
                          style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
 
                {chatMsgs.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }} className="slideIn">
                    <div style={{ width: 34, height: 34, borderRadius: 11, background: m.role === 'user' ? 'linear-gradient(135deg,#5b8def,#8b5cf6)' : 'rgba(6,214,160,0.1)', border: m.role === 'ai' ? '1px solid rgba(6,214,160,0.2)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: m.role === 'user' ? '#fff' : '#06d6a0', flexShrink: 0 }}>
                      {m.role === 'user' ? (userProfile?.name || 'U')[0].toUpperCase() : '🎓'}
                    </div>
                    <div style={{ maxWidth: '72%', padding: '11px 16px', borderRadius: 16, fontSize: 13.5, background: m.role === 'user' ? 'rgba(91,141,239,0.08)' : 'var(--surface)', border: `1px solid ${m.role === 'user' ? 'rgba(91,141,239,0.2)' : 'var(--border)'}`, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {m.text}
                      {m.role === 'ai' && (
                        <button onClick={() => androidSpeak(m.text, () => {})} style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text3)' }}>🔊</button>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoad && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(6,214,160,0.1)', border: '1px solid rgba(6,214,160,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎓</div>
                    <div style={{ padding: '11px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, color: 'var(--text3)', fontSize: 13 }}>
                      <span className="spin">⟳</span> Thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
 
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Ask your coach anything..." style={{ ...C.inp, flex: 1 }} />
                <button onClick={sendChat} disabled={chatLoad || !chatInput.trim()} style={{ ...C.btn, opacity: chatLoad ? 0.5 : 1 }}>Send →</button>
              </div>
            </div>
          )}
 
          {/* ════════════════════════════════════════
              FLASHCARDS
          ════════════════════════════════════════ */}
          {screen === 'flashcards' && (
            <div className="fadeUp">
              <T sub="Master Mandarin phrases">Flashcards</T>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <span style={{ padding: '5px 14px', background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 20, fontSize: 12, color: '#06d6a0', fontWeight: 700 }}>✓ {fcScore.correct}</span>
                <span style={{ padding: '5px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, fontSize: 12, color: '#ef4444', fontWeight: 700 }}>✗ {fcScore.wrong}</span>
                <span style={{ padding: '5px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--text3)' }}>{fcIdx + 1}/{FLASHCARDS.length}</span>
              </div>
 
              <div onClick={() => setFcFlipped(!fcFlipped)}
                style={{ ...C.card, minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', position: 'relative', borderColor: fcFlipped ? 'rgba(91,141,239,0.3)' : 'var(--border)', transition: 'all 0.3s', background: fcFlipped ? 'rgba(91,141,239,0.04)' : 'var(--surface)' }} className="card-hover">
                <div style={{ position: 'absolute', bottom: 14, fontSize: 11, color: 'var(--text3)' }}>Tap to flip</div>
                {!fcFlipped ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 58, fontWeight: 800, color: '#5b8def', marginBottom: 10, fontFamily: 'serif' }}>{FLASHCARDS[fcIdx]?.zh}</div>
                    <div style={{ fontSize: 17, color: 'var(--text2)' }}>{FLASHCARDS[fcIdx]?.py}</div>
                    <span style={{ marginTop: 8, display: 'inline-block', padding: '3px 10px', background: 'rgba(91,141,239,0.08)', borderRadius: 20, fontSize: 11, color: '#5b8def' }}>{FLASHCARDS[fcIdx]?.cat}</span>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, color: 'var(--text)', fontWeight: 700, marginBottom: 12, fontFamily: 'var(--font)' }}>{FLASHCARDS[fcIdx]?.en}</div>
                    <button onClick={e => { e.stopPropagation(); androidSpeak(FLASHCARDS[fcIdx]?.en, () => {}); }} style={C.ibtn}>🔊 Hear it</button>
                  </div>
                )}
              </div>
 
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <button onClick={() => { setFcIdx(i => Math.max(0, i - 1)); setFcFlipped(false); }} style={C.ibtn} disabled={fcIdx === 0}>← Prev</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setFcScore(s => ({ ...s, correct: s.correct + 1 })); setFcIdx(i => Math.min(FLASHCARDS.length - 1, i + 1)); setFcFlipped(false); recordSession('Flashcards'); }}
                    style={{ ...C.btn, background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' }}>✓ Know</button>
                  <button onClick={() => { setFcScore(s => ({ ...s, wrong: s.wrong + 1 })); setFcIdx(i => Math.min(FLASHCARDS.length - 1, i + 1)); setFcFlipped(false); }}
                    style={{ ...C.btn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>✗ Review</button>
                </div>
                <button onClick={() => { setFcIdx(i => Math.min(FLASHCARDS.length - 1, i + 1)); setFcFlipped(false); }} style={C.ibtn} disabled={fcIdx === FLASHCARDS.length - 1}>Next →</button>
              </div>
            </div>
          )}
 
          {/* ════════════════════════════════════════
              MOCK TIMER
          ════════════════════════════════════════ */}
          {screen === 'timer' && (
            <div className="fadeUp">
              <T sub="60 seconds to answer like a pro">Mock Interview Timer</T>
              <div style={{ ...C.card, textAlign: 'center' }}>
                {/* Timer circle */}
                <div style={{ position: 'relative', width: 170, height: 170, margin: '0 auto 24px' }}>
                  <svg width="170" height="170" viewBox="0 0 170 170" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="85" cy="85" r="75" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
                    <circle cx="85" cy="85" r="75" fill="none"
                      stroke={timerSec > 30 ? '#5b8def' : timerSec > 10 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray="471"
                      strokeDashoffset={471 - (471 * timerSec / 60)}
                      style={{ transition: 'all 1s linear, stroke 0.5s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 48, fontWeight: 800, color: timerSec > 30 ? '#5b8def' : timerSec > 10 ? '#f59e0b' : '#ef4444', fontFamily: 'var(--font)', letterSpacing: '-0.03em', lineHeight: 1 }}>{timerSec}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>seconds</span>
                  </div>
                </div>
 
                {timerQ && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, fontSize: 15, color: 'var(--text)', textAlign: 'left', lineHeight: 1.6, fontWeight: 500 }}>
                    {timerQ}
                  </div>
                )}
 
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                  {!timerRunning && !timerDone && (
                    <button onClick={startTimer} style={C.btn}>▶ Start Question</button>
                  )}
                  {timerRunning && (
                    <button onClick={() => { clearTimeout(timerRef.current); setTimerRunning(false); setTimerDone(true); }}
                      style={{ ...C.btn, background: '#ef4444' }}>⏹ Stop</button>
                  )}
                  {timerDone && (
                    <button onClick={startTimer} style={C.btn}>↺ New Question</button>
                  )}
                </div>
 
                {timerDone && (
                  <div style={{ textAlign: 'left' }}>
                    <textarea value={timerAnswer} onChange={e => setTimerAnswer(e.target.value)}
                      placeholder="Type your answer here to get AI feedback..." style={{ ...C.ta, minHeight: 120, marginBottom: 12 }} />
                    <button onClick={getTimerFeedback} style={C.btn} disabled={timerFbLoad || !timerAnswer.trim()}>
                      {timerFbLoad ? <><span className="spin">⟳</span> Analyzing...</> : '🎓 Get AI Feedback'}
                    </button>
                    {timerFb && (
                      <div style={{ marginTop: 16, background: 'rgba(91,141,239,0.05)', border: '1px solid rgba(91,141,239,0.15)', borderRadius: 14, padding: '16px', fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                        {timerFb}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
 
          {/* ════════════════════════════════════════
              RESUME AI
          ════════════════════════════════════════ */}
          {screen === 'resume' && (
            <div className="fadeUp">
              <T sub="AI-powered resume and cover letter help">Resume AI</T>
 
              {/* Tabs */}
              <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
                {[
                  { id: 'analyze', label: '📊 Analyze' },
                  { id: 'rewrite', label: '✍️ Rewrite' },
                  { id: 'cover', label: '📧 Cover Letter' },
                ].map(t => (
                  <button key={t.id} onClick={() => setResumeTab(t.id)}
                    style={{ flex: 1, padding: '10px 8px', border: 'none', borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: resumeTab === t.id ? 'var(--surface2)' : 'transparent', color: resumeTab === t.id ? '#5b8def' : 'var(--text3)', transition: 'all 0.2s', fontFamily: 'var(--font)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
 
              <div style={C.card}>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
                  {resumeTab === 'analyze' && '📊 Paste your resume text below — get a score, feedback, and improvement tips'}
                  {resumeTab === 'rewrite' && '✍️ Paste your resume bullets — get professional rewrites with strong action verbs'}
                  {resumeTab === 'cover' && '📧 Paste your resume summary — get a personalized cover letter for ' + (userProfile?.country || 'abroad')}
                </div>
                <textarea value={resumeText} onChange={e => setResumeText(e.target.value)}
                  placeholder={`Paste your resume / CV text here...\n\nExample:\n• Developed web applications using React and Node.js\n• Led a team of 5 engineers\n• Reduced deployment time by 40%`}
                  style={{ ...C.ta, minHeight: 180, marginBottom: 12 }} />
                <button onClick={analyzeResume} disabled={resumeLoad || !resumeText.trim()} style={{ ...C.btn, opacity: resumeLoad ? 0.6 : 1 }}>
                  {resumeLoad
                    ? <><span className="spin">⟳</span> Processing...</>
                    : resumeTab === 'analyze' ? '📊 Analyze Resume'
                    : resumeTab === 'rewrite' ? '✍️ Rewrite & Improve'
                    : '📧 Generate Cover Letter'}
                </button>
              </div>
 
              {resumeFb && !resumeLoad && (
                <div style={{ ...C.card, borderColor: 'rgba(91,141,239,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: '#5b8def', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font)' }}>
                      {resumeTab === 'analyze' ? 'Resume Analysis' : resumeTab === 'rewrite' ? 'Improved Version' : 'Cover Letter'}
                    </span>
                    <button onClick={() => { navigator.clipboard?.writeText(resumeFb); showToast('Copied!', 'success'); }} style={{ ...C.ibtn, fontSize: 11 }}>Copy</button>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 2, whiteSpace: 'pre-wrap' }}>{resumeFb}</div>
                </div>
              )}
            </div>
          )}
 
          {/* ════════════════════════════════════════
              NOTES
          ════════════════════════════════════════ */}
          {screen === 'notes' && (
            <div className="fadeUp">
              <T sub="Your personal study notes">My Notes</T>
              <div style={C.card}>
                <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Note title..." style={{ ...C.inp, marginBottom: 10 }} />
                <textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Write your notes, vocab, phrases..." style={{ ...C.ta, marginBottom: 12 }} />
                <button onClick={saveNote} disabled={!noteTitle.trim()} style={C.btn}>+ Save Note</button>
              </div>
              {notes.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '30px 0' }}>No notes yet. Add your first note above!</div>
              )}
              {notes.map((n, i) => (
                <div key={i} style={{ ...C.card, borderColor: 'var(--border)' }} className="card-hover">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: n.body ? 10 : 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font)' }}>{n.title}</div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => deleteNote(i)} style={{ ...C.ibtn, color: '#ef4444', padding: '4px 8px', fontSize: 12 }}>🗑</button>
                    </div>
                  </div>
                  {n.body && <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{new Date(n.ts).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
 
          {/* ════════════════════════════════════════
              PROGRESS
          ════════════════════════════════════════ */}
          {screen === 'progress' && (
            <div className="fadeUp">
              <T sub="Your learning journey">Progress</T>
 
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: '📚', label: 'Total Sessions', value: sessions.length, c: '#5b8def' },
                  { icon: '🔥', label: 'Day Streak', value: `${streak}d`, c: '#f59e0b' },
                  { icon: '📈', label: 'This Week', value: weekSess, c: '#06d6a0' },
                  { icon: '🎯', label: 'Today', value: todaySess, c: '#8b5cf6' },
                ].map(s => (
                  <div key={s.label} style={{ ...C.card, textAlign: 'center', marginBottom: 0 }} className="card-hover">
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.c, fontFamily: 'var(--font)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
 
              {/* Bar chart */}
              <div style={C.card}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 20, fontFamily: 'var(--font)' }}>Last 7 Days</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
                  {last7.map((d, i) => (
                    <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: d.count > 0 ? '#5b8def' : 'var(--text3)', fontWeight: d.count > 0 ? 700 : 400 }}>{d.count || ''}</span>
                      <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: d.count > 0 ? 'linear-gradient(to top, #5b8def, #8b5cf6)' : 'rgba(255,255,255,0.04)', height: `${Math.max((d.count / maxC) * 80, 4)}px`, transition: `height 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s` }} />
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>
 
              {/* Module breakdown */}
              {Object.keys(modCounts).length > 0 && (
                <div style={C.card}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, fontFamily: 'var(--font)' }}>Practice Breakdown</div>
                  {Object.entries(modCounts).sort((a, b) => b[1] - a[1]).map(([mod, count]) => (
                    <div key={mod} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                        <span style={{ color: 'var(--text2)' }}>{mod}</span>
                        <span style={{ color: 'var(--text3)', fontSize: 12 }}>{count} sessions</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${(count / sessions.length) * 100}%`, background: 'linear-gradient(90deg, #5b8def, #8b5cf6)', transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
 
              {/* Recent sessions */}
              {sessions.slice(0, 10).length > 0 && (
                <div style={C.card}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, fontFamily: 'var(--font)' }}>Recent Activity</div>
                  {sessions.slice(0, 10).map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5b8def', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text2)' }}>{s.mod}</span>
                      </div>
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>{s.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
 
          {/* ════════════════════════════════════════
              PROFILE
          ════════════════════════════════════════ */}
          {screen === 'profile' && (
            <div className="fadeUp">
              <T sub="Your coaching profile">Profile</T>
 
              <div style={{ ...C.card, display: 'flex', gap: 18, alignItems: 'center' }}>
                {user?.photoURL
                  ? <img src={user.photoURL} style={{ width: 70, height: 70, borderRadius: 18, objectFit: 'cover' }} alt="" />
                  : <div style={{ width: 70, height: 70, borderRadius: 18, background: 'linear-gradient(135deg,#5b8def,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: '#fff', fontFamily: 'var(--font)' }}>{(userProfile?.name || 'U')[0].toUpperCase()}</div>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 20, fontFamily: 'var(--font)', marginBottom: 4 }}>{userProfile?.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>{userProfile?.goal}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 10px', background: 'rgba(91,141,239,0.08)', border: '1px solid rgba(91,141,239,0.15)', borderRadius: 20, fontSize: 11, color: '#5b8def' }}>🎯 {userProfile?.country}</span>
                    <span style={{ padding: '3px 10px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 20, fontSize: 11, color: '#a78bfa' }}>{userProfile?.level}</span>
                  </div>
                </div>
              </div>
 
              {!editingProfile ? (
                <>
                  <div style={C.card}>
                    {[
                      { l: 'Full Name', v: userProfile?.name },
                      { l: 'Goal', v: userProfile?.goal },
                      { l: 'English Level', v: userProfile?.level },
                      { l: 'Profession', v: userProfile?.field },
                      { l: 'Target Country', v: userProfile?.country },
                      { l: 'Email', v: user?.email },
                      { l: 'Total Sessions', v: sessions.length },
                      { l: 'Current Streak', v: `${streak} days 🔥` },
                      { l: 'Gemini API Key', v: userProfile?.geminiKey ? '✓ Set (hidden)' : '✗ Not set — AI features need this' },
                    ].map(s => (
                      <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13, gap: 10 }}>
                        <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{s.l}</span>
                        <span style={{ color: s.l === 'Gemini API Key' && !userProfile?.geminiKey ? '#ef4444' : 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{s.v || '—'}</span>
                      </div>
                    ))}
                  </div>
 
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => { setEditingProfile(true); setEditData({ name: userProfile?.name, goal: userProfile?.goal, level: userProfile?.level, field: userProfile?.field, country: userProfile?.country, geminiKey: userProfile?.geminiKey || '' }); }} style={C.btn}>
                      ✏️ Edit Profile
                    </button>
                    <button onClick={logout} style={{ ...C.btn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>↩ Logout</button>
                  </div>
                </>
              ) : (
                <div style={C.card}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: 'var(--font)' }}>Edit Profile</div>
                  {[
                    { key: 'name', label: 'Full Name', placeholder: 'Your name' },
                    { key: 'field', label: 'Profession', placeholder: 'Your field' },
                    { key: 'country', label: 'Target Country', placeholder: 'Target country' },
                    { key: 'geminiKey', label: 'Gemini API Key', placeholder: 'AIzaSy...', type: 'password' },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{f.label}</div>
                      <input value={editData[f.key] || ''} onChange={e => setEditData({ ...editData, [f.key]: e.target.value })}
                        placeholder={f.placeholder} type={f.type || 'text'} style={C.inp} />
                    </div>
                  ))}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>English Level</div>
                    <select value={editData.level || ''} onChange={e => setEditData({ ...editData, level: e.target.value })} style={C.sel}>
                      {['Beginner', 'Elementary', 'Intermediate', 'Upper-Intermediate', 'Advanced'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={saveProfile} style={C.btn}>Save Changes</button>
                    <button onClick={() => setEditingProfile(false)} style={C.ibtn}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
 
        </main>
      </div>
    </div>
  );
}
 