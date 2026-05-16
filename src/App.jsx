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
 
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes micPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 0 16px rgba(239,68,68,0); } }
  @keyframes slideIn { from { transform: translateX(-10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
  @keyframes notif { 0% { transform: translateY(-20px); opacity: 0; } 15%, 85% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-20px); opacity: 0; } }
  @keyframes shimmer { from { background-position: -200% center; } to { background-position: 200% center; } }
 
  .fadeUp { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards; }
  .fadeIn { animation: fadeIn 0.3s ease forwards; }
  .spin { animation: spin 0.7s linear infinite; display: inline-block; }
  .float { animation: float 3s ease-in-out infinite; }
  .card-hover { transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease, border-color 0.2s ease; }
  .card-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.3); border-color: rgba(91,141,239,0.25) !important; }
  .btn-press:active { transform: scale(0.97); }
 
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 9999;
    opacity: 0.4;
  }
 
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
    .replace(/#{1,6}\s/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1').replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[-*+]\s/gm, '').replace(/\n{2,}/g, '. ').replace(/[^\w\s.,!?\-']/g, ' ')
    .replace(/\s+/g, ' ').trim();
};
 
/* ═══════════════════════════════════════════════════════════════════
   ANDROID-SAFE TTS ENGINE
═══════════════════════════════════════════════════════════════════ */
let ttsQueue = [];
let ttsPlaying = false;
 
const androidSpeak = (text, onEnd) => {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  ttsQueue = [];
  ttsPlaying = false;
  const clean = stripMd(text);
  if (!clean) return;
  const chunks = clean.match(/[^.!?]+[.!?]*/g) || [clean];
  ttsQueue = [...chunks];
  const playNext = () => {
    if (ttsQueue.length === 0) { ttsPlaying = false; onEnd?.(); return; }
    ttsPlaying = true;
    const chunk = ttsQueue.shift();
    const u = new SpeechSynthesisUtterance(chunk.trim());
    u.lang = 'en-US'; u.rate = 0.92; u.pitch = 1.0; u.volume = 1.0;
    u.onend = () => setTimeout(playNext, 80);
    u.onerror = (e) => { if (e.error !== 'interrupted') setTimeout(playNext, 100); else { ttsPlaying = false; onEnd?.(); } };
    setTimeout(() => { try { window.speechSynthesis.speak(u); } catch { playNext(); } }, 50);
  };
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  setTimeout(playNext, 100);
};
 
const stopSpeak = () => {
  ttsQueue = []; ttsPlaying = false;
  try { window.speechSynthesis.cancel(); } catch {}
};
 
/* ═══════════════════════════════════════════════════════════════════
   GEMINI API — via backend proxy
═══════════════════════════════════════════════════════════════════ */
const gemini = async (prompt) => {
  const apiKey = 'AIzaSyCpo9RBUgWhFp_jPH8qhkszGQIIPaWHajs';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.75 },
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from AI');
  return text;
};
 
/* ═══════════════════════════════════════════════════════════════════
   MIC HOOK
═══════════════════════════════════════════════════════════════════ */
function useMic({ onResult, onError }) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
 
  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onError?.('Speech recognition not supported. Use Chrome.'); return; }
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach(t => t.stop());
        stopSpeak();
        const r = new SR();
        recRef.current = r;
        r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
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
          setListening(false); setInterim('');
          const msgs = {
            'not-allowed': 'Mic blocked! Go to Phone Settings → Apps → Smart Coach → Permissions → Microphone → Allow',
            'no-speech': 'No speech detected. Try again.',
            'network': 'Network error. Check internet.',
            'audio-capture': 'Mic not found.',
          };
          onError?.(msgs[e.error] || `Error: ${e.error}`);
        };
        r.onend = () => setListening(false);
        r.start();
      })
      .catch(() => onError?.('Mic access denied! Go to: Phone Settings → Apps → Smart Coach → Permissions → Microphone → Allow'));
  }, [onResult, onError]);
 
  const stop = useCallback(() => {
    try { recRef.current?.abort(); } catch {}
    setListening(false); setInterim('');
  }, []);
 
  return { listening, interim, start, stop };
}
 
/* ═══════════════════════════════════════════════════════════════════
   NAV
═══════════════════════════════════════════════════════════════════ */
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'coach', label: 'My Coach', icon: '🎓' },
  { id: 'practice', label: 'Practice', icon: '◎' },
  { id: 'modules', label: 'Study Modules', icon: '📚' },
  { id: 'pronunciation', label: 'Pronunciation', icon: '◈' },
  { id: 'vocab', label: 'Vocabulary', icon: '◆' },
  { id: 'chat', label: 'AI Chat', icon: '◌' },
  { id: 'resume', label: 'Resume AI', icon: '◧' },
  { id: 'timer', label: 'Mock Timer', icon: '◷' },
  { id: 'notes', label: 'Notes', icon: '◫' },
  { id: 'progress', label: 'Progress', icon: '◐' },
  { id: 'profile', label: 'Profile', icon: '◯' },
];
 
/* ═══════════════════════════════════════════════════════════════════
   SHARED STYLES
═══════════════════════════════════════════════════════════════════ */
const C = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20, marginBottom: 14 },
  inp: { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 12, padding: '12px 16px', fontSize: 14, outline: 'none', width: '100%', transition: 'border-color 0.2s', fontFamily: 'var(--body)' },
  ta: { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 12, padding: '12px 16px', fontSize: 14, outline: 'none', width: '100%', resize: 'vertical', minHeight: 100, fontFamily: 'var(--body)' },
  btn: { padding: '11px 22px', background: 'var(--grad)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'opacity 0.2s, transform 0.15s', fontFamily: 'var(--font)', letterSpacing: '0.01em' },
  ibtn: { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, transition: 'all 0.15s', fontFamily: 'var(--body)' },
  sel: { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 12, padding: '12px 16px', fontSize: 14, outline: 'none', width: '100%', cursor: 'pointer', fontFamily: 'var(--body)' },
};
 
function T({ children, sub }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em' }}>{children}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}
 
function Toast({ msg, type = 'info' }) {
  if (!msg) return null;
  const colors = { info: '#5b8def', success: '#06d6a0', error: '#ef4444', warn: '#f59e0b' };
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface2)', border: `1px solid ${colors[type]}30`, borderLeft: `3px solid ${colors[type]}`, borderRadius: 12, padding: '12px 20px', fontSize: 13, color: 'var(--text)', zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', animation: 'notif 3s ease forwards', fontFamily: 'var(--body)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: colors[type] }}>{type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warn' ? '⚠' : 'ℹ'}</span>
      {msg}
    </div>
  );
}
 
/* ═══════════════════════════════════════════════════════════════════
   ONBOARDING STEPS
═══════════════════════════════════════════════════════════════════ */
const ONBOARDING = [
  { key: 'name', q: "What's your full name?", placeholder: "Your name..." },
  { key: 'goal', q: "What's your main goal?", type: 'select', options: ['Get a job abroad', 'Improve English for business', 'Pass IELTS/TOEFL', 'Career change', 'University admission', 'Get promoted at work', 'Start my own business', 'General skill improvement', 'Other'] },
  { key: 'level', q: "Current English level?", type: 'select', options: ['Beginner', 'Elementary', 'Intermediate', 'Upper-Intermediate', 'Advanced'] },
  { key: 'field', q: "Your profession or field?", placeholder: "e.g. Software Engineer, Doctor, Chef, Student, Teacher..." },
  { key: 'country', q: "Target country or market?", placeholder: "e.g. USA, UK, Canada, Australia, Taiwan, UAE..." },
  { key: 'resumeSetup', q: "Add your resume/background (optional but recommended)", type: 'resume' },
];
 
const githubProvider = new GithubAuthProvider();
 
/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [authLoad, setAuthLoad] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
 
  const [screen, setScreen] = useState('dashboard');
  const [sideOpen, setSideOpen] = useState(true);
  const [toast, setToast] = useState({ msg: '', type: 'info' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [editData, setEditData] = useState({});
 
  const [onboarding, setOnboarding] = useState(false);
  const [obStep, setObStep] = useState(0);
  const [obData, setObData] = useState({});
  const [obVal, setObVal] = useState('');
  const [obResume, setObResume] = useState('');
  const [obResumeFile, setObResumeFile] = useState(null);
  const [obResumeMode, setObResumeMode] = useState('text');
 
  const [transcript, setTranscript] = useState('');
  const [aiResp, setAiResp] = useState('');
  const [aiLoad, setAiLoad] = useState(false);
  const [aiError, setAiError] = useState('');
  const [speaking, setSpeaking] = useState(false);
 
  const [pronTxt, setPronTxt] = useState('');
  const [pronScore, setPronScore] = useState(null);
  const [pronFb, setPronFb] = useState('');
  const [pronLoad, setPronLoad] = useState(false);
 
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoad, setChatLoad] = useState(false);
  const chatEndRef = useRef(null);
 
  const [vocabWords, setVocabWords] = useState([]);
  const [vocabIdx, setVocabIdx] = useState(0);
  const [vocabFlipped, setVocabFlipped] = useState(false);
  const [vocabPracticed, setVocabPracticed] = useState('');
  const [vocabFb, setVocabFb] = useState('');
  const [vocabFbLoad, setVocabFbLoad] = useState(false);
  const [vocabLoading, setVocabLoading] = useState(false);
 
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [activeModule, setActiveModule] = useState(null);
  const [moduleContent, setModuleContent] = useState('');
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleInput, setModuleInput] = useState('');
  const [moduleFb, setModuleFb] = useState('');
  const [moduleFbLoad, setModuleFbLoad] = useState(false);
 
  const [coachPlan, setCoachPlan] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
 
  const [timerSec, setTimerSec] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerQ, setTimerQ] = useState('');
  const [timerAnswer, setTimerAnswer] = useState('');
  const [timerDone, setTimerDone] = useState(false);
  const [timerFb, setTimerFb] = useState('');
  const [timerFbLoad, setTimerFbLoad] = useState(false);
  const timerRef = useRef(null);
 
  const [resumeText, setResumeText] = useState('');
  const [resumeFb, setResumeFb] = useState('');
  const [resumeLoad, setResumeLoad] = useState(false);
  const [resumeTab, setResumeTab] = useState('analyze');
 
  const [notes, setNotes] = useState([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
 
  const [sessions, setSessions] = useState([]);
  const [streak, setStreak] = useState(0);
 
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
    return () => { try { document.head.removeChild(s); } catch {} };
  }, []);
 
  useEffect(() => {
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis && !ttsPlaying) { window.speechSynthesis.pause(); window.speechSynthesis.resume(); }
    }, 10000);
    return () => clearInterval(keepAlive);
  }, []);
 
  const showToast = (msg, type = 'info', duration = 3000) => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'info' }), duration);
  };
 
  const checkStreak = (sessions) => {
    if (!sessions.length) return 0;
    let s = 0;
    const dates = [...new Set(sessions.map(x => x.date))].sort((a, b) => new Date(b) - new Date(a));
    if (dates[0] !== new Date().toDateString() && dates[0] !== new Date(Date.now() - 864e5).toDateString()) return 0;
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] === new Date(Date.now() - i * 864e5).toDateString()) s++; else break;
    }
    return s;
  };
 
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
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
        setUserProfile(null); setSessions([]); setNotes([]); setChatMsgs([]);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);
 
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);
 
  useEffect(() => {
    if (timerRunning && timerSec > 0) { timerRef.current = setTimeout(() => setTimerSec(s => s - 1), 1000); }
    else if (timerRunning && timerSec === 0) { setTimerRunning(false); setTimerDone(true); showToast("Time's up!", 'warn'); }
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
    if (newStreak > 0 && newStreak % 7 === 0) showToast(`🔥 ${newStreak} day streak!`, 'success', 5000);
  };
 
  /* ── PERSONALIZED VOCAB ── */
  const loadPersonalVocab = async (profile) => {
    if (vocabWords.length > 0) return;
    setVocabLoading(true);
    try {
      const res = await gemini(
        `Generate 15 essential vocabulary words for a ${profile?.field || 'professional'} with goal: "${profile?.goal || 'career improvement'}" targeting ${profile?.country || 'abroad'}.
Return ONLY a JSON array like:
[{"word":"Example","meaning":"Definition here","example":"Sentence using the word.","level":"B2"}]
No other text, just the JSON array.`
      );
      const clean = res.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setVocabWords(parsed);
    } catch {
      setVocabWords([
        { word: 'Proficient', meaning: 'Skilled and competent', example: 'She is proficient in her field.', level: 'B2' },
        { word: 'Articulate', meaning: 'Express ideas clearly', example: 'An articulate speaker impresses clients.', level: 'B2' },
        { word: 'Resilient', meaning: 'Recover quickly from difficulties', example: 'Resilient professionals thrive under pressure.', level: 'C1' },
      ]);
    }
    setVocabLoading(false);
  };
 
  /* ── PERSONALIZED STUDY MODULES ── */
  const loadModules = async (profile) => {
    if (modules.length > 0) return;
    setModulesLoading(true);
    try {
      const resumeSummary = profile?.resumeText ? `Resume summary: ${profile.resumeText.substring(0, 500)}` : '';
      const res = await gemini(
        `Create 8 personalized study modules for:
Name: ${profile?.name}
Field: ${profile?.field || 'professional'}
Goal: ${profile?.goal || 'career improvement'}
Level: ${profile?.level || 'intermediate'}
Target: ${profile?.country || 'abroad'}
${resumeSummary}
 
Return ONLY a JSON array like:
[{"id":"1","title":"Module Title","description":"What this covers","icon":"📚","duration":"15 min","difficulty":"Beginner"}]
Make modules specific to their field and goal. No other text, just JSON.`
      );
      const clean = res.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setModules(parsed);
    } catch {
      setModules([
        { id: '1', title: 'Professional Introduction', description: 'Master your elevator pitch', icon: '👤', duration: '15 min', difficulty: 'Beginner' },
        { id: '2', title: 'Interview Skills', description: 'Answer tough questions confidently', icon: '💼', duration: '20 min', difficulty: 'Intermediate' },
        { id: '3', title: 'Email Writing', description: 'Professional email communication', icon: '📧', duration: '15 min', difficulty: 'Beginner' },
        { id: '4', title: 'Negotiation Skills', description: 'Negotiate salary and contracts', icon: '🤝', duration: '25 min', difficulty: 'Advanced' },
      ]);
    }
    setModulesLoading(false);
  };
 
  /* ── COACH PLAN ── */
  const loadCoachPlan = async (profile) => {
    if (coachPlan) return;
    setCoachLoading(true);
    try {
      const resumeSummary = profile?.resumeText ? `\nResume: ${profile.resumeText.substring(0, 800)}` : '';
      const res = await gemini(
        `You are Smart Coach — create a personalized 30-day coaching plan for:
Name: ${profile?.name}
Field: ${profile?.field}
Goal: ${profile?.goal}
English Level: ${profile?.level}
Target Country: ${profile?.country}
${resumeSummary}
 
Create a motivating, specific plan with:
1. Assessment of their current situation
2. Week 1-2 focus areas
3. Week 3-4 focus areas
4. Top 3 immediate action steps
5. One personalized tip based on their field
 
Be specific, warm, and encouraging. Max 250 words.`
      );
      setCoachPlan(stripMd(res));
    } catch (e) {
      setCoachPlan('Unable to load coach plan. Check your connection.');
    }
    setCoachLoading(false);
  };
 
  /* ── OPEN MODULE ── */
  const openModule = async (mod) => {
    setActiveModule(mod);
    setModuleContent('');
    setModuleInput('');
    setModuleFb('');
    setModuleLoading(true);
    try {
      const p = userProfile;
      const res = await gemini(
        `You are Smart Coach teaching the module "${mod.title}" to:
Name: ${p?.name}
Field: ${p?.field}
Goal: ${p?.goal}
Level: ${p?.level}
Target: ${p?.country}
${p?.resumeText ? `Background: ${p.resumeText.substring(0, 400)}` : ''}
 
Create a complete lesson for this module:
1. Key concept explanation (2-3 sentences)
2. 3 field-specific examples for ${p?.field || 'their profession'}
3. Common mistakes to avoid
4. One practice exercise for them to try
 
Make it highly specific to their field and goal. Max 200 words.`
      );
      setModuleContent(stripMd(res));
      await recordSession('Study Modules');
    } catch (e) {
      setModuleContent('Error loading module. Please try again.');
    }
    setModuleLoading(false);
  };
 
  const submitModuleExercise = async () => {
    if (!moduleInput.trim() || !activeModule) return;
    setModuleFbLoad(true);
    try {
      const res = await gemini(
        `Module: "${activeModule.title}" for ${userProfile?.field || 'professional'} in ${userProfile?.country || 'abroad'}.
Student's exercise answer: "${moduleInput}"
Give specific feedback: what's good, what to improve, better version. Max 80 words. Be encouraging.`
      );
      setModuleFb(stripMd(res));
    } catch (e) {
      setModuleFb('Error getting feedback.');
    }
    setModuleFbLoad(false);
  };
 
  /* ── MIC ── */
  const { listening, interim, start: startListen, stop: stopListen } = useMic({
    onResult: async (text) => {
      setTranscript(text);
      const p = userProfile;
      await askAI(
        `You are Smart Coach for ${p?.name || 'the user'} — a ${p?.field || 'professional'} targeting ${p?.country || 'abroad'}.
Goal: ${p?.goal} | Level: ${p?.level}
${p?.resumeText ? `Their background: ${p.resumeText.substring(0, 300)}` : ''}
The student said: "${text}"
Give structured feedback:
1. Fluency score /10
2. Grammar corrections
3. Better phrasing for their field
4. One encouragement
Max 100 words. Be warm and specific to their profession.`
      );
    },
    onError: (msg) => { setAiError(msg); showToast(msg, 'error', 5000); },
  });
 
  const askAI = async (prompt) => {
    stopSpeak(); setSpeaking(false); setAiLoad(true); setAiResp(''); setAiError('');
    try {
      const text = await gemini(prompt);
      const clean = stripMd(text);
      setAiResp(clean);
      setSpeaking(true);
      androidSpeak(clean, () => setSpeaking(false));
      await recordSession('Practice');
    } catch (e) { setAiError(e.message); showToast(e.message, 'error'); }
    setAiLoad(false);
  };
 
  /* ── AUTH ── */
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
        if (!cred.user.emailVerified) { setAuthErr('Please verify your email first.'); await signOut(auth); }
      }
    } catch (e) { setAuthErr(e.message.replace('Firebase: ', '').replace(/\(auth.*\)/, '')); }
    setAuthLoad(false);
  };
 
  const logout = async () => { stopSpeak(); await signOut(auth); setUserProfile(null); setSessions([]); setScreen('dashboard'); };
 
  /* ── ONBOARDING ── */
  const completeOnboarding = async (data) => {
    if (!user) return;
    const profile = { ...data, email: user.email, createdAt: Date.now(), sessions: [], streak: 0, notes: [], chatHistory: [] };
    await setDoc(doc(db, 'users', user.uid), profile);
    setUserProfile(profile);
    setOnboarding(false);
    showToast(`Welcome, ${data.name?.split(' ')[0]}! Your personal coach is ready! 🎓`, 'success', 4000);
  };
 
  const obNext = () => {
    const step = ONBOARDING[obStep];
    if (step.type === 'resume') {
      const updated = { ...obData, resumeText: obResume };
      setObData(updated);
      completeOnboarding(updated);
      return;
    }
    if (!obVal.trim()) return;
    const updated = { ...obData, [step.key]: obVal.trim() };
    setObData(updated);
    setObVal('');
    if (obStep < ONBOARDING.length - 1) setObStep(obStep + 1);
    else completeOnboarding(updated);
  };
 
  const handleResumeFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setObResumeFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setObResume(text || `Resume file: ${file.name}`);
    };
    if (file.type === 'application/pdf') {
      setObResume(`Resume uploaded: ${file.name} - PDF file`);
    } else {
      reader.readAsText(file);
    }
  };
 
  /* ── CHAT ── */
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoad) return;
    const userMsg = { role: 'user', text: chatInput.trim(), ts: Date.now() };
    const newMsgs = [...chatMsgs, userMsg];
    setChatMsgs(newMsgs); setChatInput(''); setChatLoad(true);
    try {
      const history = newMsgs.slice(-8).map(m => `${m.role === 'user' ? 'Student' : 'Coach'}: ${m.text}`).join('\n');
      const resp = await gemini(
        `You are Smart Coach for ${userProfile?.name || 'the student'} — a ${userProfile?.field || 'professional'} targeting ${userProfile?.country || 'abroad'}.
Goal: ${userProfile?.goal} | Level: ${userProfile?.level}
${userProfile?.resumeText ? `Their background: ${userProfile.resumeText.substring(0, 300)}` : ''}
History:\n${history}
Give a helpful, personalized response specific to their field. Max 120 words. Be encouraging.`
      );
      const aiMsg = { role: 'ai', text: stripMd(resp), ts: Date.now() };
      const final = [...newMsgs, aiMsg];
      setChatMsgs(final);
      await saveToFirestore({ chatHistory: final.slice(-60) });
      await recordSession('Chat');
    } catch (e) { setChatMsgs([...newMsgs, { role: 'ai', text: '❌ ' + e.message, ts: Date.now() }]); }
    setChatLoad(false);
  };
 
  /* ── VOCAB ── */
  const practiceVocab = async () => {
    if (!vocabPracticed.trim() || !vocabWords[vocabIdx]) return;
    setVocabFbLoad(true); setVocabFb('');
    try {
      const fb = await gemini(
        `Vocab practice for "${vocabWords[vocabIdx].word}" for a ${userProfile?.field || 'professional'}. Student's sentence: "${vocabPracticed}".
Check: 1) Correct usage? 2) Grammar ok? 3) Better sentence for their field.
Max 80 words. Be encouraging.`
      );
      setVocabFb(stripMd(fb));
      await recordSession('Vocab');
    } catch (e) { setVocabFb('Error: ' + e.message); }
    setVocabFbLoad(false);
  };
 
  /* ── PRONUNCIATION ── */
  const checkPron = async () => {
    if (!pronTxt.trim()) return;
    setPronLoad(true); setPronScore(null); setPronFb('');
    try {
      const res = await gemini(
        `Pronunciation coach. Evaluate: "${pronTxt}"
Format EXACTLY:
SCORE: [0-100]
ISSUES: [sounds to work on]
BETTER: [phonetic guide]
TIP: [one practice tip]`
      );
      const m = res.match(/SCORE:\s*(\d+)/);
      setPronScore(m ? parseInt(m[1]) : 70);
      setPronFb(res.replace(/SCORE:\s*\d+/, '').trim());
      await recordSession('Pronunciation');
    } catch (e) { setPronFb('Error: ' + e.message); showToast(e.message, 'error'); }
    setPronLoad(false);
  };
 
  /* ── RESUME ── */
  const analyzeResume = async () => {
    if (!resumeText.trim()) return;
    setResumeLoad(true); setResumeFb('');
    try {
      const prompts = {
        analyze: `Resume coach for ${userProfile?.name} targeting ${userProfile?.country} in ${userProfile?.field}.
Analyze: "${resumeText}"
Give: 1) Score /10  2) Top 3 strengths  3) Top 3 improvements  4) Missing ATS keywords  5) One rewritten bullet example. Max 200 words.`,
        rewrite: `Rewrite for ${userProfile?.field} applying in ${userProfile?.country}: "${resumeText}"
Make it impactful, ATS-friendly, strong action verbs, quantified achievements. Return improved version only.`,
        cover: `Write cover letter for ${userProfile?.name} — ${userProfile?.field} targeting ${userProfile?.country}.
Resume: "${resumeText}". Goal: ${userProfile?.goal}. 3 paragraphs, max 200 words.`,
      };
      const fb = await gemini(prompts[resumeTab]);
      setResumeFb(stripMd(fb));
      await recordSession('Resume AI');
    } catch (e) { setResumeFb('Error: ' + e.message); showToast(e.message, 'error'); }
    setResumeLoad(false);
  };
 
  /* ── NOTES ── */
  const saveNote = async () => {
    if (!noteTitle.trim()) return;
    const n = { title: noteTitle, body: noteBody, ts: Date.now() };
    const updated = [n, ...notes];
    setNotes(updated); setNoteTitle(''); setNoteBody('');
    await saveToFirestore({ notes: updated });
    showToast('Note saved!', 'success');
  };
 
  const deleteNote = async (i) => {
    const updated = notes.filter((_, idx) => idx !== i);
    setNotes(updated);
    await saveToFirestore({ notes: updated });
  };
 
  /* ── TIMER ── */
  const startTimer = async () => {
    setTimerSec(60); setTimerRunning(true); setTimerDone(false); setTimerAnswer(''); setTimerFb('');
    try {
      const q = await gemini(
        `Generate ONE challenging interview question for a ${userProfile?.field || 'professional'} applying in ${userProfile?.country || 'abroad'} for goal: ${userProfile?.goal}. Just the question, nothing else.`
      );
      const clean = stripMd(q);
      setTimerQ(clean);
      androidSpeak(clean, () => {});
    } catch {
      const fallback = 'Tell me about yourself and why you are the best candidate for this role.';
      setTimerQ(fallback);
      androidSpeak(fallback, () => {});
    }
  };
 
  const getTimerFeedback = async () => {
    if (!timerAnswer.trim()) return;
    setTimerFbLoad(true); setTimerFb('');
    try {
      const fb = await gemini(
        `Interview coach for ${userProfile?.name} — ${userProfile?.field} targeting ${userProfile?.country}.
Q: "${timerQ}" | Answer in ${60 - timerSec}s: "${timerAnswer}"
Give: 1) Score /10  2) What was good  3) Improve  4) Model answer (2-3 sentences). Max 150 words.`
      );
      setTimerFb(stripMd(fb));
      await recordSession('Mock Timer');
    } catch (e) { setTimerFb('Error: ' + e.message); }
    setTimerFbLoad(false);
  };
 
  /* ── PROFILE SAVE ── */
  const saveProfile = async () => {
    const updated = { ...userProfile, ...editData };
    setUserProfile(updated);
    await saveToFirestore(editData);
    setEditingProfile(false);
    setModules([]); setVocabWords([]); setCoachPlan('');
    showToast('Profile updated! Reloading personalized content...', 'success');
  };
 
  /* ── STATS ── */
  const today = new Date().toDateString();
  const todaySess = sessions.filter(s => s.date === today).length;
  const weekSess = sessions.filter(s => (Date.now() - (s.ts || 0)) < 7 * 864e5).length;
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5);
    return { day: d.toLocaleDateString('en', { weekday: 'short' }), count: sessions.filter(s => s.date === d.toDateString()).length };
  });
  const maxC = Math.max(...last7.map(d => d.count), 1);
  const modCounts = sessions.reduce((acc, s) => { acc[s.mod] = (acc[s.mod] || 0) + 1; return acc; }, {});
  const userName = userProfile?.name?.split(' ')[0] || 'Coach';
 
  /* ─────────────────────────────────────────────────────────────
     LOADING
  ───────────────────────────────────────────────────────────── */
  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    <div style={{ minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(91,141,239,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }} className="fadeUp">
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #5b8def, #8b5cf6)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 36, boxShadow: '0 20px 60px rgba(91,141,239,0.3)' }}>🎓</div>
          <div style={{ fontFamily: 'var(--font)', fontSize: 30, fontWeight: 800, color: '#e8ecf4', letterSpacing: '-0.03em', marginBottom: 6 }}>Smart Coach</div>
          <div style={{ fontSize: 13, color: '#3a4258' }}>AI-powered personal coaching for every professional</div>
        </div>
        <div style={{ background: '#0c0f1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 22, padding: '30px 26px' }}>
          {verifyMsg && <div style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#06d6a0', marginBottom: 18 }}>✅ {verifyMsg}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <button onClick={loginGoogle} disabled={authLoad} style={{ width: '100%', padding: '13px', background: '#fff', color: '#111', border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} className="btn-press">
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <button onClick={loginGithub} disabled={authLoad} style={{ width: '100%', padding: '13px', background: '#24292f', color: '#fff', border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} className="btn-press">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              Continue with GitHub
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <span style={{ fontSize: 11, color: '#3a4258', letterSpacing: 1, textTransform: 'uppercase' }}>or email</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div style={{ display: 'flex', background: '#060810', borderRadius: 12, padding: 3, marginBottom: 16 }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthErr(''); setVerifyMsg(''); }}
                style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: authMode === m ? '#111520' : 'transparent', color: authMode === m ? '#5b8def' : '#3a4258', transition: 'all 0.2s', fontFamily: 'var(--font)' }}>
                {m === 'login' ? 'Login' : 'Sign Up'}
              </button>
            ))}
          </div>
          <input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...C.inp, marginBottom: 10 }} />
          <input placeholder="Password (min 6 chars)" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && emailAuth()} style={{ ...C.inp, marginBottom: 14 }} />
          {authErr && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '11px 16px', borderRadius: 12, fontSize: 13, marginBottom: 14 }}>{authErr}</div>}
          <button onClick={emailAuth} disabled={authLoad} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #5b8def, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: authLoad ? 0.7 : 1, fontFamily: 'var(--font)', transition: 'opacity 0.2s' }} className="btn-press">
            {authLoad ? '...' : authMode === 'login' ? 'Login →' : 'Create Account →'}
          </button>
          {authMode === 'signup' && <div style={{ marginTop: 12, fontSize: 12, color: '#3a4258', textAlign: 'center' }}>After signup, verify your email before logging in</div>}
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
      <div style={{ minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 520 }} className="fadeUp">
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, color: '#3a4258' }}>
              <span style={{ fontFamily: 'var(--font)', fontWeight: 600 }}>Building your personal coach</span>
              <span>{obStep + 1}/{ONBOARDING.length}</span>
            </div>
            <div style={{ height: 4, background: '#111520', borderRadius: 4 }}>
              <div style={{ height: '100%', borderRadius: 4, width: `${progress}%`, background: 'linear-gradient(90deg, #5b8def, #8b5cf6)', transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
          </div>
          <div style={{ background: '#0c0f1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 22, padding: '36px 30px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#e8ecf4', fontFamily: 'var(--font)', letterSpacing: '-0.02em' }}>{step.q}</div>
 
            {step.type === 'resume' ? (
              <div>
                <div style={{ fontSize: 13, color: '#7a8499', marginBottom: 16, lineHeight: 1.7 }}>
                  Adding your resume helps AI create a <strong style={{ color: '#5b8def' }}>100% personalized</strong> coaching plan, vocabulary, and study modules just for you.
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {['text', 'file'].map(m => (
                    <button key={m} onClick={() => setObResumeMode(m)}
                      style={{ flex: 1, padding: '10px', border: `1px solid ${obResumeMode === m ? '#5b8def' : 'var(--border)'}`, borderRadius: 12, background: obResumeMode === m ? 'rgba(91,141,239,0.1)' : 'transparent', color: obResumeMode === m ? '#5b8def' : '#3a4258', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {m === 'text' ? '✍️ Paste Text' : '📁 Upload File'}
                    </button>
                  ))}
                </div>
                {obResumeMode === 'text' ? (
                  <textarea value={obResume} onChange={e => setObResume(e.target.value)}
                    placeholder="Paste your resume, CV, or just describe your experience and background...&#10;&#10;Example: I am a software engineer with 3 years experience in React and Node.js. I worked at XYZ company..."
                    style={{ ...C.ta, minHeight: 160, marginBottom: 12 }} />
                ) : (
                  <div style={{ border: '2px dashed var(--border2)', borderRadius: 14, padding: 30, textAlign: 'center', marginBottom: 12 }}>
                    <input type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleResumeFile} style={{ display: 'none' }} id="resume-upload" />
                    <label htmlFor="resume-upload" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{obResumeFile ? '✅' : '📁'}</div>
                      <div style={{ fontSize: 14, color: obResumeFile ? '#06d6a0' : '#3a4258' }}>
                        {obResumeFile ? obResumeFile.name : 'Click to upload resume (.txt, .pdf, .doc)'}
                      </div>
                    </label>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={obNext} style={{ ...C.btn, flex: 1, justifyContent: 'center', padding: '15px', fontSize: 16 }}>
                    🚀 Start My Personal Coaching!
                  </button>
                </div>
                <button onClick={() => completeOnboarding({ ...obData, resumeText: '' })}
                  style={{ width: '100%', marginTop: 10, padding: '12px', background: 'transparent', border: '1px solid var(--border)', color: '#3a4258', borderRadius: 12, fontSize: 13, cursor: 'pointer' }}>
                  Skip — I'll add resume later in Profile
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 24 }}>
                  {step.type === 'select' ? (
                    <select value={obVal} onChange={e => setObVal(e.target.value)} style={C.sel}>
                      <option value="">Select an option...</option>
                      {step.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={obVal} onChange={e => setObVal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && obNext()}
                      placeholder={step.placeholder} style={{ ...C.inp, fontSize: 16 }} />
                  )}
                </div>
                <button onClick={obNext} disabled={!obVal.trim()}
                  style={{ ...C.btn, width: '100%', justifyContent: 'center', padding: '15px', fontSize: 16, opacity: !obVal.trim() ? 0.4 : 1 }}>
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
 
  /* ─────────────────────────────────────────────────────────────
     MAIN APP
  ───────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--body)' }}>
      <Toast msg={toast.msg} type={toast.type} />
 
      {/* SIDEBAR */}
      <aside style={{ width: sideOpen ? 218 : 60, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '16px 8px', gap: 2, transition: 'width 0.28s cubic-bezier(0.16,1,0.3,1)', overflow: 'hidden', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', marginBottom: 20, height: 40 }}>
          <button onClick={() => setSideOpen(!sideOpen)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text3)', cursor: 'pointer', padding: '6px 8px', flexShrink: 0, fontSize: 12, borderRadius: 8 }}>
            {sideOpen ? '←' : '→'}
          </button>
          {sideOpen && <span style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 16, color: '#5b8def', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>Smart Coach</span>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => { setScreen(item.id); if (item.id === 'modules') loadModules(userProfile); if (item.id === 'vocab') loadPersonalVocab(userProfile); if (item.id === 'coach') loadCoachPlan(userProfile); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: screen === item.id ? 'rgba(91,141,239,0.1)' : 'transparent', color: screen === item.id ? '#5b8def' : 'var(--text3)', transition: 'all 0.15s', position: 'relative' }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
              {sideOpen && <span style={{ fontSize: 13, fontWeight: screen === item.id ? 700 : 400 }}>{item.label}</span>}
              {screen === item.id && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: '#5b8def', borderRadius: 2 }} />}
            </button>
          ))}
        </div>
        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', borderRadius: 12, transition: 'color 0.2s' }}
          onMouseOver={e => e.currentTarget.style.color = '#ef4444'} onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}>
          <span>↩</span>{sideOpen && <span style={{ fontSize: 13 }}>Logout</span>}
        </button>
      </aside>
 
      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
 
        {/* HEADER */}
        <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user?.photoURL
              ? <img src={user.photoURL} style={{ width: 38, height: 38, borderRadius: 12, objectFit: 'cover' }} alt="" />
              : <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#5b8def,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font)' }}>{(userProfile?.name || 'U')[0].toUpperCase()}</div>
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font)' }}>{userProfile?.name || 'Welcome!'}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{userProfile?.field} · {userProfile?.country}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }} className="header-actions">
            <span style={{ padding: '5px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font)' }}>🔥 {streak}d</span>
            <span style={{ padding: '5px 14px', background: 'rgba(6,214,160,0.05)', border: '1px solid rgba(6,214,160,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#06d6a0', fontFamily: 'var(--font)' }}>{todaySess}/3 today</span>
          </div>
        </header>
 
        {/* MOBILE NAV */}
        <nav className="mobile-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '8px 4px', zIndex: 100, justifyContent: 'space-around', alignItems: 'center' }}>
          {NAV.slice(0, 6).map(item => (
            <button key={item.id} onClick={() => { setScreen(item.id); if (item.id === 'modules') loadModules(userProfile); if (item.id === 'vocab') loadPersonalVocab(userProfile); if (item.id === 'coach') loadCoachPlan(userProfile); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', color: screen === item.id ? '#5b8def' : 'var(--text3)', flex: 1 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 9, fontWeight: screen === item.id ? 700 : 400 }}>{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
 
        <main className="main-content" style={{ flex: 1, overflowY: 'auto', padding: 24, paddingBottom: 80 }}>
 
          {/* ════════ DASHBOARD ════════ */}
          {screen === 'dashboard' && (
            <div className="fadeUp">
              <div style={{ background: 'linear-gradient(135deg, #0d1117, #111827)', border: '1px solid rgba(91,141,239,0.12)', borderRadius: 20, padding: '24px 28px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, background: 'radial-gradient(circle, rgba(91,141,239,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{ fontSize: 11, color: '#5b8def', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, fontFamily: 'var(--font)' }}>Your Personal AI Coach</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#e8ecf4', fontFamily: 'var(--font)', letterSpacing: '-0.02em', marginBottom: 6 }}>Welcome back, {userName}! 👋</div>
                <div style={{ fontSize: 13, color: '#3a4258', marginBottom: 14 }}>{userProfile?.goal} · {userProfile?.field} · {userProfile?.country}</div>
                {userProfile?.resumeText && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', borderRadius: 20, fontSize: 12, color: '#06d6a0' }}>
                    ✓ Resume loaded — coaching is fully personalized for you
                  </div>
                )}
                {!userProfile?.resumeText && (
                  <div onClick={() => setScreen('profile')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, fontSize: 12, color: '#f59e0b', cursor: 'pointer' }}>
                    ⚠ Add your resume in Profile for personalized coaching →
                  </div>
                )}
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: '📚', label: 'Total Sessions', value: sessions.length, c: '#5b8def' },
                  { icon: '🔥', label: 'Day Streak', value: `${streak}d`, c: '#f59e0b' },
                  { icon: '📈', label: 'This Week', value: weekSess, c: '#06d6a0' },
                  { icon: '🎯', label: 'Today', value: `${todaySess}/3`, c: '#8b5cf6' },
                ].map(s => (
                  <div key={s.label} style={{ ...C.card, textAlign: 'center', marginBottom: 0 }} className="card-hover">
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.c, fontFamily: 'var(--font)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
 
              <div style={C.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)' }}>Daily Goal</span>
                  <span style={{ fontSize: 12, color: todaySess >= 3 ? '#06d6a0' : 'var(--text3)' }}>{todaySess}/3 sessions</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                  <div style={{ height: '100%', borderRadius: 6, width: `${Math.min(todaySess / 3 * 100, 100)}%`, background: 'linear-gradient(90deg, #5b8def, #8b5cf6)', transition: 'width 0.6s' }} />
                </div>
                {todaySess >= 3 && <div style={{ marginTop: 10, color: '#06d6a0', fontSize: 13, fontWeight: 600 }}>🎉 Daily goal complete!</div>}
              </div>
 
              <T sub="Start a session">Quick Practice</T>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>
                {[
                  { label: 'My Coach', icon: '🎓', action: () => { setScreen('coach'); loadCoachPlan(userProfile); } },
                  { label: 'Study Modules', icon: '📚', action: () => { setScreen('modules'); loadModules(userProfile); } },
                  { label: 'Free Speaking', icon: '🎤', action: () => setScreen('practice') },
                  { label: 'Mock Interview', icon: '💼', action: () => { setScreen('timer'); } },
                  { label: 'Pronunciation', icon: '🔤', action: () => setScreen('pronunciation') },
                  { label: 'Vocabulary', icon: '◆', action: () => { setScreen('vocab'); loadPersonalVocab(userProfile); } },
                  { label: 'AI Chat', icon: '💬', action: () => setScreen('chat') },
                  { label: 'Resume AI', icon: '📄', action: () => setScreen('resume') },
                ].map(m => (
                  <button key={m.label} onClick={m.action}
                    style={{ ...C.card, marginBottom: 0, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }} className="card-hover btn-press">
                    <div style={{ fontSize: 26, marginBottom: 8 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)' }}>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
 
          {/* ════════ MY COACH ════════ */}
          {screen === 'coach' && (
            <div className="fadeUp">
              <T sub="Your personalized 30-day coaching plan">My Personal Coach</T>
              <div style={{ background: 'linear-gradient(135deg, rgba(91,141,239,0.05), rgba(139,92,246,0.05))', border: '1px solid rgba(91,141,239,0.15)', borderRadius: 20, padding: 24, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#5b8def,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🎓</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'var(--font)', marginBottom: 4 }}>{userName}'s Smart Coach</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>{userProfile?.field} · {userProfile?.goal}</div>
                  </div>
                </div>
                {coachLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', fontSize: 13 }}>
                    <span className="spin">⟳</span> Building your personalized plan...
                  </div>
                ) : coachPlan ? (
                  <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{coachPlan}</div>
                ) : (
                  <button onClick={() => loadCoachPlan(userProfile)} style={C.btn}>Generate My Plan</button>
                )}
              </div>
              {coachPlan && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => { setCoachPlan(''); loadCoachPlan(userProfile); }} style={C.ibtn}>↺ Refresh Plan</button>
                  <button onClick={() => androidSpeak(coachPlan, () => {})} style={C.ibtn}>🔊 Listen</button>
                  <button onClick={() => { setScreen('modules'); loadModules(userProfile); }} style={C.btn}>📚 Start Study Modules →</button>
                </div>
              )}
            </div>
          )}
 
          {/* ════════ STUDY MODULES ════════ */}
          {screen === 'modules' && (
            <div className="fadeUp">
              {!activeModule ? (
                <>
                  <T sub={`Personalized for ${userProfile?.field} — ${userProfile?.goal}`}>Study Modules</T>
                  {modulesLoading ? (
                    <div style={{ ...C.card, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)' }}>
                      <span className="spin">⟳</span> Creating personalized modules for {userProfile?.field}...
                    </div>
                  ) : modules.length === 0 ? (
                    <button onClick={() => loadModules(userProfile)} style={C.btn}>Load My Modules</button>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                      {modules.map((mod, i) => (
                        <div key={mod.id || i} onClick={() => openModule(mod)}
                          style={{ ...C.card, cursor: 'pointer', marginBottom: 0, transition: 'all 0.2s' }} className="card-hover">
                          <div style={{ fontSize: 32, marginBottom: 12 }}>{mod.icon || '📖'}</div>
                          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--font)', marginBottom: 6 }}>{mod.title}</div>
                          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.6 }}>{mod.description}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ padding: '3px 10px', background: 'rgba(91,141,239,0.08)', border: '1px solid rgba(91,141,239,0.15)', borderRadius: 20, fontSize: 11, color: '#5b8def' }}>{mod.duration || '15 min'}</span>
                            <span style={{ padding: '3px 10px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 20, fontSize: 11, color: '#a78bfa' }}>{mod.difficulty || 'Intermediate'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {modules.length > 0 && (
                    <button onClick={() => { setModules([]); loadModules(userProfile); }} style={{ ...C.ibtn, marginTop: 14 }}>↺ Regenerate Modules</button>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <button onClick={() => setActiveModule(null)} style={C.ibtn}>← Back</button>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'var(--font)' }}>{activeModule.icon} {activeModule.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{activeModule.difficulty} · {activeModule.duration}</div>
                    </div>
                  </div>
                  {moduleLoading ? (
                    <div style={{ ...C.card, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)' }}>
                      <span className="spin">⟳</span> Loading lesson...
                    </div>
                  ) : (
                    <div style={{ ...C.card, borderColor: 'rgba(91,141,239,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 11, color: '#5b8def', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font)' }}>Lesson Content</span>
                        <button onClick={() => androidSpeak(moduleContent, () => {})} style={C.ibtn}>🔊 Listen</button>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-wrap', marginBottom: 20 }}>{moduleContent}</div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font)', marginBottom: 8 }}>✍️ Practice Exercise</div>
                        <textarea value={moduleInput} onChange={e => setModuleInput(e.target.value)}
                          placeholder="Complete the exercise above and type your answer here..." style={{ ...C.ta, marginBottom: 10 }} />
                        <button onClick={submitModuleExercise} disabled={moduleFbLoad || !moduleInput.trim()} style={{ ...C.btn, opacity: moduleFbLoad ? 0.6 : 1 }}>
                          {moduleFbLoad ? <><span className="spin">⟳</span> Checking...</> : '✓ Submit Exercise'}
                        </button>
                        {moduleFb && (
                          <div style={{ marginTop: 14, background: 'rgba(91,141,239,0.05)', border: '1px solid rgba(91,141,239,0.15)', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>{moduleFb}</div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
 
          {/* ════════ PRACTICE ════════ */}
          {screen === 'practice' && (
            <div className="fadeUp">
              <T sub="Speak and get instant personalized feedback">AI Practice Partner</T>
              <div style={{ background: 'linear-gradient(135deg, #0d1117, #111827)', border: '1px solid rgba(91,141,239,0.12)', borderRadius: 20, padding: '28px 24px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 11, color: '#5b8def', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, fontFamily: 'var(--font)' }}>Personalized Coach for {userName}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#e8ecf4', marginBottom: 6, fontFamily: 'var(--font)' }}>Speak → Get Feedback</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>AI coach knows your field: {userProfile?.field}</div>
                    {(interim || transcript) && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: 12, fontSize: 13, color: '#7a8499', marginTop: 8 }}>
                        💬 "{interim || transcript}"
                      </div>
                    )}
                    {aiError && <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: 12, fontSize: 13, color: '#ef4444' }}>⚠️ {aiError}</div>}
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
 
              <div style={C.card}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, fontWeight: 600 }}>Quick topics for {userProfile?.field}:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: '👤 Introduce Yourself', p: `Ask ${userName} to professionally introduce themselves as a ${userProfile?.field} targeting ${userProfile?.country}. Just give the prompt.` },
                    { label: '💼 Field Interview', p: `Ask ONE tough interview question specific to a ${userProfile?.field} applying in ${userProfile?.country}. Just the question.` },
                    { label: '🎯 Goal Pitch', p: `Ask ${userName} to explain why they want to ${userProfile?.goal} in ${userProfile?.country} as a ${userProfile?.field}. Just give the scenario.` },
                    { label: '📞 Client Call', p: `Simulate a professional phone call scenario for a ${userProfile?.field} in ${userProfile?.country}. Just describe the scenario and ask how they'd start.` },
                    { label: '🤝 Networking', p: `Give a networking scenario for a ${userProfile?.field} at a professional event in ${userProfile?.country}. Just the scenario.` },
                    { label: '📧 Email Task', p: `Give a professional email writing exercise for a ${userProfile?.field} working in ${userProfile?.country}. Just the task.` },
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
 
              {aiLoad && <div style={{ ...C.card, color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}><span className="spin">⟳</span> AI thinking...</div>}
 
              {aiResp && !aiLoad && (
                <div style={{ ...C.card, borderColor: 'rgba(91,141,239,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 11, color: '#5b8def', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font)' }}>AI Feedback</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { if (speaking) { stopSpeak(); setSpeaking(false); } else { setSpeaking(true); androidSpeak(aiResp, () => setSpeaking(false)); } }} style={C.ibtn}>{speaking ? '⏸ Pause' : '▶ Play'}</button>
                      <button onClick={() => { setAiResp(''); setTranscript(''); stopSpeak(); setSpeaking(false); }} style={C.ibtn}>↺ Reset</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{aiResp}</div>
                </div>
              )}
            </div>
          )}
 
          {/* ════════ PRONUNCIATION ════════ */}
          {screen === 'pronunciation' && (
            <div className="fadeUp">
              <T sub="Type text → get pronunciation score and tips">Pronunciation Checker</T>
              <div style={C.card}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <input value={pronTxt} onChange={e => setPronTxt(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkPron()}
                    placeholder="Type an English sentence..." style={{ ...C.inp, flex: 1, minWidth: 180 }} />
                  <button onClick={checkPron} disabled={pronLoad || !pronTxt.trim()} style={{ ...C.btn, opacity: pronLoad ? 0.6 : 1 }}>
                    {pronLoad ? <span className="spin">⟳</span> : 'Analyze'}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Try these:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['I would like to schedule a meeting.', 'Thank you for the opportunity.', 'Could you please clarify that?'].map(s => (
                    <button key={s} onClick={() => setPronTxt(s)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>{s.substring(0, 28)}...</button>
                  ))}
                </div>
              </div>
              {pronScore !== null && !pronLoad && (
                <div style={{ ...C.card, borderColor: pronScore >= 80 ? 'rgba(6,214,160,0.2)' : pronScore >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                      <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                        <circle cx="45" cy="45" r="36" fill="none" stroke={pronScore >= 80 ? '#06d6a0' : pronScore >= 60 ? '#f59e0b' : '#ef4444'} strokeWidth="8" strokeLinecap="round" strokeDasharray="226" strokeDashoffset={226 - (226 * pronScore / 100)} style={{ transition: 'stroke-dashoffset 1s' }} />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: pronScore >= 80 ? '#06d6a0' : pronScore >= 60 ? '#f59e0b' : '#ef4444', fontFamily: 'var(--font)' }}>{pronScore}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>/100</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font)', marginBottom: 4 }}>{pronScore >= 80 ? 'Excellent! 🎉' : pronScore >= 60 ? 'Keep Going! 💪' : 'Needs Practice 📖'}</div>
                      <button onClick={() => pronTxt && androidSpeak(pronTxt, () => {})} style={{ ...C.ibtn, marginTop: 10, fontSize: 12 }}>🔊 Hear correct pronunciation</button>
                    </div>
                  </div>
                  {pronFb && <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{pronFb}</div>}
                </div>
              )}
            </div>
          )}
 
          {/* ════════ VOCABULARY ════════ */}
          {screen === 'vocab' && (
            <div className="fadeUp">
              <T sub={`Personalized for ${userProfile?.field}`}>Daily Vocabulary</T>
              {vocabLoading ? (
                <div style={{ ...C.card, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)' }}>
                  <span className="spin">⟳</span> Generating vocabulary for {userProfile?.field}...
                </div>
              ) : vocabWords.length > 0 ? (
                <>
                  <div onClick={() => setVocabFlipped(!vocabFlipped)}
                    style={{ ...C.card, cursor: 'pointer', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative', borderColor: 'rgba(139,92,246,0.2)', transition: 'all 0.3s', background: vocabFlipped ? 'rgba(139,92,246,0.05)' : 'var(--surface)' }} className="card-hover">
                    <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, color: 'var(--text3)' }}>Tap to flip</div>
                    <div style={{ position: 'absolute', top: 12, left: 14, padding: '3px 10px', background: 'rgba(139,92,246,0.1)', borderRadius: 20, fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>{vocabWords[vocabIdx]?.level}</div>
                    {!vocabFlipped ? (
                      <div>
                        <div style={{ fontSize: 42, fontWeight: 800, color: '#8b5cf6', fontFamily: 'var(--font)', letterSpacing: '-0.03em', marginBottom: 8 }}>{vocabWords[vocabIdx]?.word}</div>
                        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Tap to see meaning</div>
                      </div>
                    ) : (
                      <div style={{ maxWidth: 380 }}>
                        <div style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, marginBottom: 10, fontFamily: 'var(--font)' }}>{vocabWords[vocabIdx]?.meaning}</div>
                        <div style={{ fontSize: 13, color: '#a78bfa', fontStyle: 'italic', marginBottom: 14 }}>"{vocabWords[vocabIdx]?.example}"</div>
                        <button onClick={(e) => { e.stopPropagation(); androidSpeak(`${vocabWords[vocabIdx]?.word}. ${vocabWords[vocabIdx]?.meaning}`, () => {}); }} style={C.ibtn}>🔊 Hear it</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <button onClick={() => { setVocabIdx(i => Math.max(0, i - 1)); setVocabFlipped(false); setVocabFb(''); setVocabPracticed(''); }} style={C.ibtn} disabled={vocabIdx === 0}>← Previous</button>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{vocabIdx + 1} / {vocabWords.length}</span>
                    <button onClick={() => { setVocabIdx(i => Math.min(vocabWords.length - 1, i + 1)); setVocabFlipped(false); setVocabFb(''); setVocabPracticed(''); }} style={C.ibtn} disabled={vocabIdx === vocabWords.length - 1}>Next →</button>
                  </div>
                  <div style={C.card}>
                    <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font)', marginBottom: 4 }}>Practice it!</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>Use <strong style={{ color: '#a78bfa' }}>{vocabWords[vocabIdx]?.word}</strong> in a sentence related to {userProfile?.field}:</div>
                    <textarea value={vocabPracticed} onChange={e => setVocabPracticed(e.target.value)} placeholder={`Write a sentence using "${vocabWords[vocabIdx]?.word}"...`} style={{ ...C.ta, minHeight: 80, marginBottom: 10 }} />
                    <button onClick={practiceVocab} disabled={vocabFbLoad || !vocabPracticed.trim()} style={{ ...C.btn, opacity: vocabFbLoad ? 0.6 : 1 }}>
                      {vocabFbLoad ? <><span className="spin">⟳</span> Checking...</> : 'Check My Sentence'}
                    </button>
                    {vocabFb && <div style={{ marginTop: 14, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>{vocabFb}</div>}
                  </div>
                  <button onClick={() => { setVocabWords([]); loadPersonalVocab(userProfile); }} style={C.ibtn}>↺ New Vocabulary Set</button>
                </>
              ) : (
                <button onClick={() => loadPersonalVocab(userProfile)} style={C.btn}>Load My Vocabulary</button>
              )}
            </div>
          )}
 
          {/* ════════ CHAT ════════ */}
          {screen === 'chat' && (
            <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <T sub={`Knows your background as ${userProfile?.field}`}>AI Chat Coach</T>
                <button onClick={() => { setChatMsgs([]); saveToFirestore({ chatHistory: [] }); }} style={{ ...C.ibtn, fontSize: 11 }}>🗑 Clear</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                {chatMsgs.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, paddingTop: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
                    <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: 'var(--font)' }}>Hi {userName}!</div>
                    <div style={{ fontSize: 13 }}>I know you're a {userProfile?.field} targeting {userProfile?.country}. Ask me anything!</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                      {[
                        `How do I answer "Tell me about yourself" as a ${userProfile?.field}?`,
                        `What are common interview mistakes in ${userProfile?.country}?`,
                        'Correct my English grammar',
                        `What skills do I need for ${userProfile?.goal}?`,
                      ].map(s => (
                        <button key={s} onClick={() => setChatInput(s)} style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>{s}</button>
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
                      {m.role === 'ai' && <button onClick={() => androidSpeak(m.text, () => {})} style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text3)' }}>🔊</button>}
                    </div>
                  </div>
                ))}
                {chatLoad && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(6,214,160,0.1)', border: '1px solid rgba(6,214,160,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎓</div>
                    <div style={{ padding: '11px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, color: 'var(--text3)', fontSize: 13 }}><span className="spin">⟳</span> Thinking...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Ask your coach anything..." style={{ ...C.inp, flex: 1 }} />
                <button onClick={sendChat} disabled={chatLoad || !chatInput.trim()} style={{ ...C.btn, opacity: chatLoad ? 0.5 : 1 }}>Send →</button>
              </div>
            </div>
          )}
 
          {/* ════════ RESUME AI ════════ */}
          {screen === 'resume' && (
            <div className="fadeUp">
              <T sub="AI-powered resume and cover letter help">Resume AI</T>
              <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
                {[{ id: 'analyze', label: '📊 Analyze' }, { id: 'rewrite', label: '✍️ Rewrite' }, { id: 'cover', label: '📧 Cover Letter' }].map(t => (
                  <button key={t.id} onClick={() => setResumeTab(t.id)}
                    style={{ flex: 1, padding: '10px 8px', border: 'none', borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: resumeTab === t.id ? 'var(--surface2)' : 'transparent', color: resumeTab === t.id ? '#5b8def' : 'var(--text3)', transition: 'all 0.2s', fontFamily: 'var(--font)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={C.card}>
                <textarea value={resumeText} onChange={e => setResumeText(e.target.value)}
                  placeholder="Paste your resume / CV text here..." style={{ ...C.ta, minHeight: 180, marginBottom: 12 }} />
                <button onClick={analyzeResume} disabled={resumeLoad || !resumeText.trim()} style={{ ...C.btn, opacity: resumeLoad ? 0.6 : 1 }}>
                  {resumeLoad ? <><span className="spin">⟳</span> Processing...</> : resumeTab === 'analyze' ? '📊 Analyze Resume' : resumeTab === 'rewrite' ? '✍️ Rewrite & Improve' : '📧 Generate Cover Letter'}
                </button>
              </div>
              {resumeFb && !resumeLoad && (
                <div style={{ ...C.card, borderColor: 'rgba(91,141,239,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: '#5b8def', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'var(--font)' }}>{resumeTab === 'analyze' ? 'Analysis' : resumeTab === 'rewrite' ? 'Improved Version' : 'Cover Letter'}</span>
                    <button onClick={() => { navigator.clipboard?.writeText(resumeFb); showToast('Copied!', 'success'); }} style={{ ...C.ibtn, fontSize: 11 }}>Copy</button>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 2, whiteSpace: 'pre-wrap' }}>{resumeFb}</div>
                </div>
              )}
            </div>
          )}
 
          {/* ════════ TIMER ════════ */}
          {screen === 'timer' && (
            <div className="fadeUp">
              <T sub="AI-generated questions for your field">Mock Interview Timer</T>
              <div style={{ ...C.card, textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 170, height: 170, margin: '0 auto 24px' }}>
                  <svg width="170" height="170" viewBox="0 0 170 170" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="85" cy="85" r="75" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
                    <circle cx="85" cy="85" r="75" fill="none" stroke={timerSec > 30 ? '#5b8def' : timerSec > 10 ? '#f59e0b' : '#ef4444'} strokeWidth="10" strokeLinecap="round" strokeDasharray="471" strokeDashoffset={471 - (471 * timerSec / 60)} style={{ transition: 'all 1s linear, stroke 0.5s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 48, fontWeight: 800, color: timerSec > 30 ? '#5b8def' : timerSec > 10 ? '#f59e0b' : '#ef4444', fontFamily: 'var(--font)', lineHeight: 1 }}>{timerSec}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>seconds</span>
                  </div>
                </div>
                {timerQ && <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, fontSize: 15, color: 'var(--text)', textAlign: 'left', lineHeight: 1.6, fontWeight: 500 }}>{timerQ}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                  {!timerRunning && !timerDone && <button onClick={startTimer} style={C.btn}>▶ Start Question</button>}
                  {timerRunning && <button onClick={() => { clearTimeout(timerRef.current); setTimerRunning(false); setTimerDone(true); }} style={{ ...C.btn, background: '#ef4444' }}>⏹ Stop</button>}
                  {timerDone && <button onClick={startTimer} style={C.btn}>↺ New Question</button>}
                </div>
                {timerDone && (
                  <div style={{ textAlign: 'left' }}>
                    <textarea value={timerAnswer} onChange={e => setTimerAnswer(e.target.value)} placeholder="Type your answer to get AI feedback..." style={{ ...C.ta, minHeight: 120, marginBottom: 12 }} />
                    <button onClick={getTimerFeedback} style={C.btn} disabled={timerFbLoad || !timerAnswer.trim()}>
                      {timerFbLoad ? <><span className="spin">⟳</span> Analyzing...</> : '🎓 Get AI Feedback'}
                    </button>
                    {timerFb && <div style={{ marginTop: 16, background: 'rgba(91,141,239,0.05)', border: '1px solid rgba(91,141,239,0.15)', borderRadius: 14, padding: '16px', fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{timerFb}</div>}
                  </div>
                )}
              </div>
            </div>
          )}
 
          {/* ════════ NOTES ════════ */}
          {screen === 'notes' && (
            <div className="fadeUp">
              <T sub="Your personal study notes">My Notes</T>
              <div style={C.card}>
                <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Note title..." style={{ ...C.inp, marginBottom: 10 }} />
                <textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Write your notes, vocab, phrases..." style={{ ...C.ta, marginBottom: 12 }} />
                <button onClick={saveNote} disabled={!noteTitle.trim()} style={C.btn}>+ Save Note</button>
              </div>
              {notes.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '30px 0' }}>No notes yet.</div>}
              {notes.map((n, i) => (
                <div key={i} style={C.card} className="card-hover">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: n.body ? 10 : 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font)' }}>{n.title}</div>
                    <button onClick={() => deleteNote(i)} style={{ ...C.ibtn, color: '#ef4444', padding: '4px 8px', fontSize: 12 }}>🗑</button>
                  </div>
                  {n.body && <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{new Date(n.ts).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
 
          {/* ════════ PROGRESS ════════ */}
          {screen === 'progress' && (
            <div className="fadeUp">
              <T sub="Your learning journey">Progress</T>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
                {[{ icon: '📚', label: 'Total Sessions', value: sessions.length, c: '#5b8def' }, { icon: '🔥', label: 'Day Streak', value: `${streak}d`, c: '#f59e0b' }, { icon: '📈', label: 'This Week', value: weekSess, c: '#06d6a0' }, { icon: '🎯', label: 'Today', value: todaySess, c: '#8b5cf6' }].map(s => (
                  <div key={s.label} style={{ ...C.card, textAlign: 'center', marginBottom: 0 }} className="card-hover">
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.c, fontFamily: 'var(--font)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
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
              {Object.keys(modCounts).length > 0 && (
                <div style={C.card}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, fontFamily: 'var(--font)' }}>Practice Breakdown</div>
                  {Object.entries(modCounts).sort((a, b) => b[1] - a[1]).map(([mod, count]) => (
                    <div key={mod} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                        <span style={{ color: 'var(--text2)' }}>{mod}</span>
                        <span style={{ color: 'var(--text3)', fontSize: 12 }}>{count}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${(count / sessions.length) * 100}%`, background: 'linear-gradient(90deg, #5b8def, #8b5cf6)', transition: 'width 0.8s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
 
          {/* ════════ PROFILE ════════ */}
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
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>{userProfile?.field} · {userProfile?.goal}</div>
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
                      { l: 'Profession / Field', v: userProfile?.field },
                      { l: 'Target Country', v: userProfile?.country },
                      { l: 'Email', v: user?.email },
                      { l: 'Resume Added', v: userProfile?.resumeText ? `✓ Yes (${userProfile.resumeText.length} chars)` : '✗ Not added — add for personalized coaching' },
                      { l: 'Total Sessions', v: sessions.length },
                      { l: 'Current Streak', v: `${streak} days 🔥` },
                    ].map(s => (
                      <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13, gap: 10 }}>
                        <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{s.l}</span>
                        <span style={{ color: s.l === 'Resume Added' && !userProfile?.resumeText ? '#f59e0b' : 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{s.v || '—'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => { setEditingProfile(true); setEditData({ name: userProfile?.name, goal: userProfile?.goal, level: userProfile?.level, field: userProfile?.field, country: userProfile?.country, resumeText: userProfile?.resumeText || '' }); }} style={C.btn}>✏️ Edit Profile</button>
                    <button onClick={logout} style={{ ...C.btn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>↩ Logout</button>
                  </div>
                </>
              ) : (
                <div style={C.card}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: 'var(--font)' }}>Edit Profile</div>
                  {[{ key: 'name', label: 'Full Name', placeholder: 'Your name' }, { key: 'field', label: 'Profession / Field', placeholder: 'e.g. Software Engineer, Doctor, Chef...' }, { key: 'country', label: 'Target Country', placeholder: 'e.g. USA, UK, Canada...' }].map(f => (
                    <div key={f.key} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{f.label}</div>
                      <input value={editData[f.key] || ''} onChange={e => setEditData({ ...editData, [f.key]: e.target.value })} placeholder={f.placeholder} style={C.inp} />
                    </div>
                  ))}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>English Level</div>
                    <select value={editData.level || ''} onChange={e => setEditData({ ...editData, level: e.target.value })} style={C.sel}>
                      {['Beginner', 'Elementary', 'Intermediate', 'Upper-Intermediate', 'Advanced'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Resume / Background <span style={{ color: '#5b8def' }}>(paste text or update)</span></div>
                    <textarea value={editData.resumeText || ''} onChange={e => setEditData({ ...editData, resumeText: e.target.value })}
                      placeholder="Paste your resume, CV, or describe your experience..." style={{ ...C.ta, minHeight: 150 }} />
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
 