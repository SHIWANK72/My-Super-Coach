import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
 
/* ═══════════════════════════════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #08090a; --surface: #111214; --surface2: #1a1c1f;
    --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.13);
    --text: #f0f0f0; --text2: #999; --text3: #555;
    --accent: #6ee7b7; --accent2: #3b82f6; --accent3: #f59e0b;
    --danger: #ef4444; --success: #10b981; --r: 16px;
  }
  body { background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; overflow-x:hidden; }
  body.light {
    --bg: #f4f6f9; --surface: #ffffff; --surface2: #eef0f4;
    --border: rgba(0,0,0,0.08); --border2: rgba(0,0,0,0.14);
    --text: #111214; --text2: #555; --text3: #aaa;
  }
  ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px;}
  input,button,textarea{font-family:inherit;}
  input::placeholder,textarea::placeholder{color:#444;}
  body.light input::placeholder,body.light textarea::placeholder{color:#aaa;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  @keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(110,231,183,0.5);}50%{transform:scale(1.04);box-shadow:0 0 0 14px rgba(110,231,183,0);}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes bar{0%,100%{transform:scaleY(0.4);}50%{transform:scaleY(1);}}
  @keyframes flipIn{from{opacity:0;transform:rotateY(-90deg);}to{opacity:1;transform:rotateY(0);}}
  @keyframes ripple{0%{transform:scale(0);opacity:1;}100%{transform:scale(4);opacity:0;}}
  .fadeUp{animation:fadeUp 0.35s ease forwards;}
  .pulse{animation:pulse 2s infinite;}
  .flipIn{animation:flipIn 0.4s ease forwards;}
  .spin{animation:spin 1s linear infinite;}
`;
 
/* ═══════════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════════ */
const LS = {
  get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},
};
 
const stripMd=(t)=>{
  if(!t||typeof t!=='string')return '';
  return t
    .replace(/#{1,6}\s/g,'')
    .replace(/\*\*(.*?)\*\*/g,'$1')
    .replace(/\*(.*?)\*/g,'$1')
    .replace(/`{1,3}(.*?)`{1,3}/gs,'$1')
    .replace(/\[(.*?)\]\(.*?\)/g,'$1')
    .replace(/[-*+]\s/gm,'')
    .replace(/\n{2,}/g,'. ')
    .replace(/[^\w\s.,!?\-']/g,' ')
    .replace(/\s+/g,' ')
    .trim();
};
 
/* ═══════════════════════════════════════════════════════════════════
   GEMINI API
═══════════════════════════════════════════════════════════════════ */
const gemini = async (prompt) => {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const model = import.meta.env.VITE_GEMINI_MODEL_NAME || 'gemini-2.5-flash';
  
  if (!key) throw new Error('Gemini API key missing! .env file check karo.');
  
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
      }),
    }
  );
  
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${r.status} - API call failed`);
  }
  
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
};
 
/* ═══════════════════════════════════════════════════════════════════
   TTS
═══════════════════════════════════════════════════════════════════ */
const speak = (text, onEnd) => {
  if (!text || typeof text !== 'string') return;
  window.speechSynthesis.cancel();
  const cleanText = stripMd(text);
  const u = new SpeechSynthesisUtterance(cleanText);
  u.lang = 'en-US'; u.rate = 0.95; u.pitch = 1.0; u.volume = 1;
  if (onEnd) u.onend = () => { onEnd(); };
  u.onerror = (e) => console.error('TTS Error:', e);
  window.speechSynthesis.speak(u);
  return u;
};
const stopSpeak = () => { window.speechSynthesis.cancel(); };
 
/* ═══════════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════════ */
const ICONS = {
  mic:<><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></>,
  stop:<rect x="6" y="6" width="12" height="12" rx="2"/>,
  play:<polygon points="5,3 19,12 5,21"/>,
  pause:<><line x1="6" y1="4" x2="6" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/></>,
  volume:<><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></>,
  logout:<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  chevL:<polyline points="15,18 9,12 15,6"/>,
  chevR:<polyline points="9,18 15,12 9,6"/>,
  mail:<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
  cal:<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  github:<><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></>,
  linkedin:<><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></>,
  refresh:<><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
  plus:<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  x:<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  flame:<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>,
  chart:<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  whatsapp:<><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M11.997 2C6.476 2 2 6.477 2 12c0 1.849.487 3.586 1.337 5.09L2 22l5.032-1.321A9.956 9.956 0 0 0 11.997 22C17.52 22 22 17.523 22 12c0-5.524-4.48-10-10.003-10z"/></>,
  sun:<><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
  moon:<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
  bell:<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  timer:<><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></>,
  user:<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  chat:<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  cards:<><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
  check:<polyline points="20,6 9,17 4,12"/>,
  trash:<><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
  edit:<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  send:<><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></>,
  wifi:<><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></>,
  download:<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
};
const Ic = ({ n, s=18, c='currentColor' }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[n]}
  </svg>
);
 
/* ═══════════════════════════════════════════════════════════════════
   FLASHCARDS DATA
═══════════════════════════════════════════════════════════════════ */
const FLASHCARDS = [
  {zh:'你好',py:'Nǐ hǎo',hi:'नमस्ते',en:'Hello',cat:'Greetings'},
  {zh:'謝謝',py:'Xièxiè',hi:'धन्यवाद',en:'Thank you',cat:'Greetings'},
  {zh:'對不起',py:'Duìbuqǐ',hi:'माफ़ करना',en:'Sorry',cat:'Greetings'},
  {zh:'再見',py:'Zàijiàn',hi:'अलविदा',en:'Goodbye',cat:'Greetings'},
  {zh:'請問',py:'Qǐngwèn',hi:'क्या मैं पूछ सकता हूँ?',en:'May I ask?',cat:'Polite'},
  {zh:'我不懂',py:'Wǒ bù dǒng',hi:'मुझे समझ नहीं आया',en:"I don't understand",cat:'Common'},
  {zh:'多少錢',py:'Duōshǎo qián',hi:'कितने पैसे?',en:'How much?',cat:'Shopping'},
  {zh:'廁所在哪裡',py:'Cèsuǒ zài nǎlǐ',hi:'टॉयलेट कहाँ है?',en:'Where is the toilet?',cat:'Navigation'},
  {zh:'我叫...',py:'Wǒ jiào...',hi:'मेरा नाम... है',en:'My name is...',cat:'Introduction'},
  {zh:'我是印度人',py:'Wǒ shì Yìndù rén',hi:'मैं भारतीय हूँ',en:'I am Indian',cat:'Introduction'},
  {zh:'我在找工作',py:'Wǒ zài zhǎo gōngzuò',hi:'मैं नौकरी ढूंढ रहा हूँ',en:'I am looking for a job',cat:'Work'},
  {zh:'工程師',py:'Gōngchéngshī',hi:'इंजीनियर',en:'Engineer',cat:'Work'},
  {zh:'捷運站',py:'Jiéyùn zhàn',hi:'मेट्रो स्टेशन',en:'MRT Station',cat:'Navigation'},
  {zh:'好吃',py:'Hǎo chī',hi:'बहुत स्वादिष्ट',en:'Delicious',cat:'Food'},
  {zh:'我要這個',py:'Wǒ yào zhège',hi:'मुझे यह चाहिए',en:'I want this',cat:'Shopping'},
  {zh:'可以幫我嗎',py:'Kěyǐ bāng wǒ ma',hi:'क्या आप मेरी मदद कर सकते हैं?',en:'Can you help me?',cat:'Polite'},
  {zh:'沒問題',py:'Méi wèntí',hi:'कोई बात नहीं',en:'No problem',cat:'Common'},
  {zh:'太貴了',py:'Tài guì le',hi:'बहुत महंगा है',en:'Too expensive',cat:'Shopping'},
  {zh:'我聽不懂',py:'Wǒ tīng bù dǒng',hi:'मुझे सुनाई नहीं दिया',en:"I can't understand",cat:'Common'},
  {zh:'請慢慢說',py:'Qǐng màn màn shuō',hi:'कृपया धीरे बोलें',en:'Please speak slowly',cat:'Polite'},
];
 
/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════ */
const MODULES = [
  {id:1,title:'Introduce Yourself',icon:'👤',color:'#6ee7b7',prompt:'Ask me to introduce myself for a VLSI job interview. I am Shiwank, a VLSI Design Engineer from India going to Taiwan.'},
  {id:2,title:'Job Interview',icon:'💼',color:'#3b82f6',prompt:'Ask me one tough HR interview question for a VLSI semiconductor engineer role in Taiwan.'},
  {id:3,title:'Visa Interview',icon:'✈️',color:'#f59e0b',prompt:'Ask me one Taiwan student/work visa interview question.'},
  {id:4,title:'University Abroad',icon:'🎓',color:'#8b5cf6',prompt:"Ask me one admission interview question for a Master's program in Taiwan for VLSI."},
  {id:5,title:'Telephonic English',icon:'📞',color:'#ec4899',prompt:'Simulate a phone call: HR is scheduling a technical interview for a VLSI role.'},
  {id:6,title:'Basic Mandarin',icon:'🇹🇼',color:'#06b6d4',prompt:'Teach me 5 essential Mandarin phrases for daily life in Taiwan. Format: Chinese | Pinyin | Hindi | English'},
  {id:7,title:'Email Writing',icon:'📧',color:'#f97316',prompt:'Give me a professional email writing exercise for a VLSI engineer applying for a job in Taiwan.'},
  {id:8,title:'Technical English',icon:'🔬',color:'#84cc16',prompt:'Ask me to explain a VLSI concept (timing closure, setup/hold violations, floorplanning) in simple English for a non-technical manager.'},
];
 
const NAV = [
  {id:'dashboard',label:'Dashboard',sym:'⬡'},
  {id:'practice',label:'Practice',sym:'◎'},
  {id:'pronunciation',label:'Pronunciation',sym:'◈'},
  {id:'flashcards',label:'Flashcards',sym:'⬕'},
  {id:'timer',label:'Mock Timer',sym:'◷'},
  {id:'chat',label:'AI Chat',sym:'◌'},
  {id:'notes',label:'Notes',sym:'◧'},
  {id:'profile',label:'Profile',sym:'◯'},
  {id:'resume',label:'Resume',sym:'◫'},
  {id:'progress',label:'Progress',sym:'◐'},
  {id:'ecosystem',label:'Ecosystem',sym:'◉'},
  {id:'calendar',label:'Calendar',sym:'▣'},
  {id:'leaderboard',label:'Leaderboard',sym:'◆'},
];
 
const TIMER_QUESTIONS = [
  'Tell me about yourself and why you want to work in Taiwan.',
  'What is timing closure in VLSI? Explain simply.',
  'How do you handle setup and hold time violations?',
  'Why did you choose semiconductor engineering?',
  'Describe your biggest project achievement.',
  'What do you know about Taiwan semiconductor industry?',
  'How do you work under pressure and tight deadlines?',
  'Explain floorplanning in VLSI chip design.',
  'Where do you see yourself in 5 years?',
  'Why should we hire you over other candidates?',
];
 
/* ═══════════════════════════════════════════════════════════════════
   PWA INSTALL HOOK
═══════════════════════════════════════════════════════════════════ */
function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
 
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
 
  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setCanInstall(false);
    setDeferredPrompt(null);
  };
 
  return { canInstall, install };
}
 
/* ═══════════════════════════════════════════════════════════════════
   SPEECH RECOGNITION HOOK
═══════════════════════════════════════════════════════════════════ */
function useSpeechRecognition({ onResult, onError }) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
 
  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onError?.('Chrome browser use karo! Speech recognition support nahi hai.');
      return;
    }
 
    // Check mic permission first
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(() => {
        stopSpeak();
        const r = new SR();
        recRef.current = r;
        r.lang = 'en-US';
        r.interimResults = true;
        r.continuous = false;
        r.maxAlternatives = 1;
 
        r.onstart = () => { setListening(true); setInterim('Listening...'); };
        
        r.onresult = (e) => {
          let interimText = '';
          let finalText = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalText += t;
            else interimText += t;
          }
          if (interimText) setInterim(interimText);
          if (finalText) {
            setInterim(finalText);
            onResult?.(finalText);
          }
        };
 
        r.onerror = (e) => {
          setListening(false);
          setInterim('');
          if (e.error === 'no-speech') onError?.('Koi awaaz nahi aayi. Dobara try karo.');
          else if (e.error === 'not-allowed') onError?.('Mic permission denied! Browser settings mein allow karo.');
          else onError?.(`Error: ${e.error}`);
        };
 
        r.onend = () => { setListening(false); };
        r.start();
      })
      .catch(() => {
        onError?.('Mic access denied! Browser address bar mein 🔒 icon click karke Microphone → Allow karo.');
      });
  }, [onResult, onError]);
 
  const stop = useCallback(() => {
    recRef.current?.abort();
    setListening(false);
    setInterim('');
  }, []);
 
  return { listening, interim, start, stop };
}
 
/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [darkMode, setDarkMode] = useState(() => LS.get('sc_dark', true));
  const { canInstall, install } = usePWAInstall();
 
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);
 
  useEffect(() => {
    document.body.className = darkMode ? '' : 'light';
  }, [darkMode]);
 
  // Auth
  const [user, setUser] = useState(() => LS.get('sc_user', null));
  const [authErr, setAuthErr] = useState('');
  const [emailForm, setEmailForm] = useState({ name: '', email: '', password: '' });
  const [authMode, setAuthMode] = useState('login');
 
  // Nav
  const [screen, setScreen] = useState('dashboard');
  const [sideOpen, setSideOpen] = useState(true);
 
  // Practice
  const [transcript, setTranscript] = useState('');
  const [aiResp, setAiResp] = useState('');
  const [aiLoad, setAiLoad] = useState(false);
  const [aiError, setAiError] = useState('');
  const [activeMod, setActiveMod] = useState(null);
  const [speaking, setSpeaking] = useState(false);
 
  // Pronunciation
  const [pronTxt, setPronTxt] = useState('');
  const [pronScore, setPronScore] = useState(null);
  const [pronFb, setPronFb] = useState('');
  const [pronLoad, setPronLoad] = useState(false);
 
  // Sessions / Streak
  const [sessions, setSessions] = useState(() => LS.get('sc_sessions', []));
  const [streak, setStreak] = useState(() => LS.get('sc_streak', 0));
  const [lastDay, setLastDay] = useState(() => LS.get('sc_lastday', null));
 
  // Calendar
  const [calEvs, setCalEvs] = useState(() => LS.get('sc_cal', {}));
  const [calDate, setCalDate] = useState(new Date().toISOString().split('T')[0]);
  const [calTxt, setCalTxt] = useState('');
 
  // Flashcards
  const [fcIdx, setFcIdx] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcFilter, setFcFilter] = useState('All');
  const [fcScore, setFcScore] = useState({ correct: 0, wrong: 0 });
  const fcCats = ['All', ...[...new Set(FLASHCARDS.map(f => f.cat))]];
  const fcCards = fcFilter === 'All' ? FLASHCARDS : FLASHCARDS.filter(f => f.cat === fcFilter);
 
  // Timer
  const [timerSec, setTimerSec] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerQ, setTimerQ] = useState('');
  const [timerAnswer, setTimerAnswer] = useState('');
  const [timerDone, setTimerDone] = useState(false);
  const [timerFb, setTimerFb] = useState('');
  const [timerFbLoad, setTimerFbLoad] = useState(false);
  const timerRef = useRef(null);
 
  // AI Chat
  const [chatMsgs, setChatMsgs] = useState(() => LS.get('sc_chat', []));
  const [chatInput, setChatInput] = useState('');
  const [chatLoad, setChatLoad] = useState(false);
  const chatEndRef = useRef(null);
 
  // Notes
  const [notes, setNotes] = useState(() => LS.get('sc_notes', []));
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteEdit, setNoteEdit] = useState(null);
 
  // Profile
  const [profile, setProfile] = useState(() => LS.get('sc_profile', {
    name: 'Shiwank Gupta', bio: 'VLSI Design Engineer | India → Taiwan',
    goal: 'Get a job at TSMC by Dec 2025', skills: 'Static Timing Analysis, Synopsys, Cadence, Verilog',
    target: 'Taiwan', linkedin: 'https://linkedin.com/in/shiwank-gupta-a93132264', github: '',
  }));
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState(profile);
 
  // Resume
  const [resumeData, setResumeData] = useState(() => LS.get('sc_resume', {
    name: 'Shiwank Gupta', email: 'shiwank@email.com', phone: '+91-XXXXXXXXXX',
    location: 'India → Taiwan', linkedin: 'linkedin.com/in/shiwank-gupta-a93132264',
    summary: 'VLSI Design Engineer with expertise in Static Timing Analysis, Synopsys Design Compiler, and Cadence tools. Seeking opportunities in Taiwan semiconductor industry.',
    experience: [{ title: 'VLSI Design Engineer', company: 'Company Name', duration: '2022 - Present', points: 'Worked on STA, timing closure, floorplanning.\nReduced timing violations by 30% using ECO techniques.' }],
    education: [{ degree: 'B.Tech Electronics Engineering', college: 'University Name', year: '2022', grade: '8.5 CGPA' }],
    skills: 'STA, Synopsys DC, Cadence Innovus, Verilog, VHDL, Primetime, DFT, Floorplanning',
    languages: 'English (Fluent), Hindi (Native), Mandarin (Basic)', certifications: '',
  }));
  const [resumeSection, setResumeSection] = useState('edit');
  const [aiResumeLoad, setAiResumeLoad] = useState(false);
  const [aiResumeFb, setAiResumeFb] = useState('');
 
  // Reminder
  const [reminder, setReminder] = useState(() => LS.get('sc_reminder', { enabled: false, time: '09:00', msg: 'Time to practice English! 🎯' }));
  const [reminderSet, setReminderSet] = useState(false);
 
  // Stats
  const today = new Date().toDateString();
  const todaySess = sessions.filter(s => s.date === today).length;
  const weekSess = sessions.filter(s => (Date.now() - (s.ts || 0)) < 7 * 864e5).length;
  const scored = sessions.filter(s => s.score);
  const avgScore = scored.length ? Math.round(scored.reduce((a, b) => a + (b.score || 0), 0) / scored.length) : 0;
  const userScore = sessions.length * 50 + streak * 100;
  const mockLB = [
    { name: 'Arjun S.', score: 1840, streak: 21 },
    { name: 'Priya M.', score: 1380, streak: 14 },
    { name: 'Rahul K.', score: 1075, streak: 9 },
    { name: 'Sneha T.', score: 860, streak: 7 },
  ];
  const fullLB = [...mockLB, { name: (user?.name?.split(' ')[0] || 'You') + ' (You)', score: userScore, streak }].sort((a, b) => b.score - a.score);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5);
    return { day: d.toLocaleDateString('en', { weekday: 'short' }), count: sessions.filter(s => s.date === d.toDateString()).length };
  });
  const maxC = Math.max(...last7.map(d => d.count), 1);
 
  const record = (mod, score = null) => {
    const s = { date: today, mod, score, ts: Date.now() };
    const upd = [s, ...sessions].slice(0, 300);
    setSessions(upd); LS.set('sc_sessions', upd);
    if (lastDay !== today) {
      const yest = new Date(Date.now() - 864e5).toDateString();
      const ns = lastDay === yest ? streak + 1 : 1;
      setStreak(ns); setLastDay(today);
      LS.set('sc_streak', ns); LS.set('sc_lastday', today);
    }
  };
 
  // Speech recognition
  const { listening, interim, start: startListen, stop: stopListen } = useSpeechRecognition({
    onResult: (text) => {
      setTranscript(text);
      const low = text.toLowerCase();
      if (low.includes('flashcard')) { setScreen('flashcards'); return; }
      if (low.includes('timer') || low.includes('interview')) { setScreen('timer'); return; }
      if (low.includes('note')) { setScreen('notes'); return; }
      if (low.includes('progress')) { setScreen('progress'); return; }
      if (low.includes('calendar')) { setScreen('calendar'); return; }
      askGemini(
        `You are an English + Mandarin coach for Shiwank Gupta, VLSI engineer from India preparing for Taiwan. He said: "${text}". Give: 1) Fluency /10, 2) Grammar corrections, 3) Better phrasing, 4) Brief answer. Be concise and encouraging. Keep response under 150 words.`,
        'Free Practice'
      );
    },
    onError: (msg) => { setAiError(msg); },
  });
 
  // Gemini call
  const askGemini = async (prompt, modTitle) => {
    stopSpeak(); setSpeaking(false); setAiLoad(true); setAiResp(''); setAiError('');
    try {
      const text = await gemini(prompt);
      const clean = stripMd(text);
      setAiResp(clean);
      setSpeaking(true);
      speak(clean, () => setSpeaking(false));
      record(modTitle);
    } catch (e) {
      setAiError(e.message);
    }
    setAiLoad(false);
  };
 
  const toggleSpeak = () => {
    if (speaking) { stopSpeak(); setSpeaking(false); }
    else if (aiResp) { setSpeaking(true); speak(aiResp, () => setSpeaking(false)); }
  };
 
  // Auth handlers
  const handleGoogleLogin = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const u = { name: decoded.name, email: decoded.email, picture: decoded.picture, provider: 'google' };
      setUser(u); LS.set('sc_user', u);
    } catch (e) { setAuthErr('Google login failed: ' + e.message); }
  };
 
  const emailAuth = () => {
    setAuthErr('');
    if (!emailForm.email || !emailForm.password) { setAuthErr('Email aur password daalo!'); return; }
    if (authMode === 'signup' && !emailForm.name) { setAuthErr('Naam daalo!'); return; }
    const key = `sc_eu_${emailForm.email}`;
    const stored = LS.get(key, null);
    if (authMode === 'signup') {
      if (stored) { setAuthErr('Email already registered!'); return; }
      const u = { name: emailForm.name, email: emailForm.email, picture: null, provider: 'email' };
      LS.set(key, { ...u, pw: emailForm.password });
      setUser(u); LS.set('sc_user', u);
    } else {
      if (!stored || stored.pw !== emailForm.password) { setAuthErr('Email ya password galat!'); return; }
      const u = { name: stored.name, email: stored.email, picture: null, provider: 'email' };
      setUser(u); LS.set('sc_user', u);
    }
  };
 
  const logout = () => { setUser(null); LS.set('sc_user', null); };
 
  // Pronunciation
  const checkPron = async () => {
    if (!pronTxt.trim()) return;
    setPronLoad(true); setPronScore(null); setPronFb('');
    try {
      const res = await gemini(`Strict English pronunciation coach. Evaluate: "${pronTxt}"\nFormat EXACTLY:\nSCORE: [0-100]\nISSUES: [sounds to fix]\nBETTER: [phonetic]\nEXERCISE: [practice sentence]\nTIP1: [tip]\nTIP2: [tip]`);
      const m = res.match(/SCORE:\s*(\d+)/);
      setPronScore(m ? parseInt(m[1]) : 70);
      setPronFb(stripMd(res));
      record('Pronunciation', m ? parseInt(m[1]) : null);
    } catch (e) { setPronFb('Error: ' + e.message); }
    setPronLoad(false);
  };
 
  const pronMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); r.lang = 'en-US';
    r.onresult = (e) => setPronTxt(e.results[0][0].transcript);
    r.start();
  };
 
  // Calendar
  const addLocalEv = () => {
    if (!calTxt.trim()) return;
    const upd = { ...calEvs, [calDate]: [...(calEvs[calDate] || []), calTxt.trim()] };
    setCalEvs(upd); LS.set('sc_cal', upd); setCalTxt('');
  };
 
  // Timer
  useEffect(() => {
    if (timerRunning && timerSec > 0) {
      timerRef.current = setTimeout(() => setTimerSec(s => s - 1), 1000);
    } else if (timerRunning && timerSec === 0) {
      setTimerRunning(false); setTimerDone(true);
    }
    return () => clearTimeout(timerRef.current);
  }, [timerRunning, timerSec]);
 
  const startTimer = () => {
    const q = TIMER_QUESTIONS[Math.floor(Math.random() * TIMER_QUESTIONS.length)];
    setTimerQ(q); setTimerSec(60); setTimerRunning(true);
    setTimerDone(false); setTimerAnswer(''); setTimerFb('');
  };
 
  const getTimerFeedback = async () => {
    if (!timerAnswer.trim()) return;
    setTimerFbLoad(true); setTimerFb('');
    try {
      const fb = await gemini(`Interview coach. Question: "${timerQ}". Answer in ${60 - timerSec}s: "${timerAnswer}". Give: 1) Score /10, 2) Good points, 3) Improvements, 4) Model answer. Be concise, max 150 words.`);
      setTimerFb(stripMd(fb)); record('Mock Timer');
    } catch (e) { setTimerFb('Error: ' + e.message); }
    setTimerFbLoad(false);
  };
 
  // Chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);
 
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoad) return;
    const userMsg = { role: 'user', text: chatInput.trim(), ts: Date.now() };
    const newMsgs = [...chatMsgs, userMsg];
    setChatMsgs(newMsgs); LS.set('sc_chat', newMsgs); setChatInput(''); setChatLoad(true);
    try {
      const history = newMsgs.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
      const resp = await gemini(`You are Super Coach, English + Mandarin + VLSI interview coach for Shiwank Gupta, VLSI engineer from India preparing for Taiwan.\n\nHistory:\n${history}\n\nRespond helpfully and concisely (max 150 words). For Mandarin: give Chinese + Pinyin + English.`);
      const aiMsg = { role: 'ai', text: stripMd(resp), ts: Date.now() };
      const final = [...newMsgs, aiMsg];
      setChatMsgs(final); LS.set('sc_chat', final);
    } catch (e) {
      const errMsg = { role: 'ai', text: '❌ ' + e.message, ts: Date.now() };
      setChatMsgs([...newMsgs, errMsg]); LS.set('sc_chat', [...newMsgs, errMsg]);
    }
    setChatLoad(false);
  };
 
  // Notes
  const saveNote = () => {
    if (!noteTitle.trim()) return;
    if (noteEdit !== null) {
      const upd = notes.map((n, i) => i === noteEdit ? { ...n, title: noteTitle, body: noteBody, updated: Date.now() } : n);
      setNotes(upd); LS.set('sc_notes', upd); setNoteEdit(null);
    } else {
      const n = { title: noteTitle, body: noteBody, created: Date.now(), updated: Date.now() };
      const upd = [n, ...notes]; setNotes(upd); LS.set('sc_notes', upd);
    }
    setNoteTitle(''); setNoteBody('');
  };
 
  const deleteNote = (i) => { const upd = notes.filter((_, idx) => idx !== i); setNotes(upd); LS.set('sc_notes', upd); };
  const editNote = (i) => { setNoteTitle(notes[i].title); setNoteBody(notes[i].body); setNoteEdit(i); };
 
  const saveProfile = () => { setProfile(profileForm); LS.set('sc_profile', profileForm); setProfileEdit(false); };
 
  const improveResume = async () => {
    setAiResumeLoad(true); setAiResumeFb('');
    try {
      const fb = await gemini(`Resume reviewer for Taiwan semiconductor jobs. Review:\nName: ${resumeData.name}\nSummary: ${resumeData.summary}\nSkills: ${resumeData.skills}\nExp: ${resumeData.experience.map(e => e.title + ' at ' + e.company).join(', ')}\n\nGive: 1) Score /10, 2) Top 3 strengths, 3) Top 3 improvements, 4) Taiwan-specific tips, 5) Better summary rewrite. Max 200 words.`);
      setAiResumeFb(stripMd(fb));
    } catch (e) { setAiResumeFb('Error: ' + e.message); }
    setAiResumeLoad(false);
  };
 
  const saveReminder = () => {
    LS.set('sc_reminder', reminder); setReminderSet(true);
    setTimeout(() => setReminderSet(false), 2000);
  };
 
  /* ── SHARED STYLES ── */
  const C = {
    card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20, marginBottom: 16 },
    inp: { background: 'rgba(128,128,128,0.08)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', width: '100%' },
    ta: { background: 'rgba(128,128,128,0.08)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', width: '100%', resize: 'vertical', minHeight: 90 },
    btn: { padding: '10px 18px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    ibtn: { background: 'rgba(128,128,128,0.08)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 },
  };
 
  /* ════════════════════════════════════════
     LOGIN SCREEN
  ════════════════════════════════════════ */
  if (!user) return (
    <div style={{ minHeight: '100vh', background: '#08090a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg,#6ee7b7,#3b82f6)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 0 40px rgba(110,231,183,0.25)' }}>
            <span style={{ fontSize: 32 }}>🎓</span>
          </div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.5px' }}>Super Coach</h1>
          <p style={{ color: '#444', fontSize: 13, marginTop: 4 }}>English · Mandarin · VLSI · Taiwan</p>
        </div>
        <div style={{ background: '#111214', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
          
          {/* Google Login */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#555', textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Quick Login</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => setAuthErr('Google login failed!')}
                useOneTap
                text="continue_with"
                shape="rounded"
                size="large"
                theme="filled_black"
              />
            </div>
          </div>
 
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 11, color: '#333' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>
 
          {/* Email Auth */}
          <div style={{ display: 'flex', background: '#0a0b0c', borderRadius: 12, padding: 4, marginBottom: 16 }}>
            {['login', 'signup'].map(m => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthErr(''); }}
                style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: authMode === m ? '#1a1c1f' : 'transparent', color: authMode === m ? '#6ee7b7' : '#444' }}>
                {m === 'login' ? 'Login' : 'Sign Up'}
              </button>
            ))}
          </div>
 
          {authMode === 'signup' && (
            <input placeholder="Full Name" value={emailForm.name} onChange={e => setEmailForm({ ...emailForm, name: e.target.value })}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.13)', color: '#f0f0f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', width: '100%', marginBottom: 10 }} />
          )}
          <input placeholder="Email" type="email" value={emailForm.email} onChange={e => setEmailForm({ ...emailForm, email: e.target.value })}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.13)', color: '#f0f0f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', width: '100%', marginBottom: 10 }} />
          <input placeholder="Password" type="password" value={emailForm.password} onChange={e => setEmailForm({ ...emailForm, password: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && emailAuth()}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.13)', color: '#f0f0f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', width: '100%', marginBottom: 12 }} />
 
          {authErr && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '8px 12px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
              {authErr}
            </div>
          )}
 
          <button onClick={emailAuth}
            style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg,#6ee7b7,#3b82f6)', color: '#000', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
            {authMode === 'login' ? 'Login →' : 'Create Account →'}
          </button>
          <button onClick={() => { const u = { name: 'Guest', picture: null, email: '', provider: 'guest' }; setUser(u); LS.set('sc_user', u); }}
            style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#444', borderRadius: 12, fontSize: 13, cursor: 'pointer' }}>
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
 
  /* ════════════════════════════════════════
     MAIN APP
  ════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'DM Sans',sans-serif" }}>
 
      {/* SIDEBAR */}
      <aside style={{ width: sideOpen ? 220 : 62, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '18px 8px', gap: 2, transition: 'width 0.25s ease', overflow: 'hidden', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 16 }}>
          <button onClick={() => setSideOpen(!sideOpen)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}>
            <Ic n={sideOpen ? 'chevL' : 'chevR'} s={15} />
          </button>
          {sideOpen && <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: '#6ee7b7', whiteSpace: 'nowrap' }}>Super Coach</span>}
        </div>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setScreen(item.id)} title={item.label}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', background: screen === item.id ? 'rgba(110,231,183,0.08)' : 'transparent', color: screen === item.id ? '#6ee7b7' : 'var(--text3)' }}>
              <span style={{ fontSize: 14, fontFamily: 'monospace', flexShrink: 0 }}>{item.sym}</span>
              {sideOpen && <span style={{ fontSize: 12, fontWeight: screen === item.id ? 600 : 400 }}>{item.label}</span>}
            </button>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* PWA Install Button */}
          {canInstall && (
            <button onClick={install}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.2)', color: '#6ee7b7', cursor: 'pointer', borderRadius: 8, marginBottom: 4 }} title="Install App">
              <Ic n="download" s={14} />
              {sideOpen && <span style={{ fontSize: 12, fontWeight: 600 }}>Install App</span>}
            </button>
          )}
          <button onClick={() => { setDarkMode(!darkMode); LS.set('sc_dark', !darkMode); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', borderRadius: 8 }} title={darkMode ? 'Light Mode' : 'Dark Mode'}>
            <Ic n={darkMode ? 'sun' : 'moon'} s={14} />
            {sideOpen && <span style={{ fontSize: 12 }}>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          {sideOpen && (
            <div>
              {[
                { l: 'LinkedIn', u: 'https://linkedin.com/in/shiwank-gupta-a93132264', n: 'linkedin' },
                { l: 'Gmail', u: 'https://mail.google.com', n: 'mail' },
                { l: 'WhatsApp', u: 'https://web.whatsapp.com', n: 'whatsapp' },
              ].map(lk => (
                <a key={lk.l} href={lk.u} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', color: 'var(--text3)', textDecoration: 'none', borderRadius: 8, fontSize: 12 }}>
                  <Ic n={lk.n} s={13} />{lk.l}
                </a>
              ))}
            </div>
          )}
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', borderRadius: 10 }} title="Logout">
            <Ic n="logout" s={14} />
            {sideOpen && <span style={{ fontSize: 12 }}>Logout</span>}
          </button>
        </div>
      </aside>
 
      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.picture
              ? <img src={user.picture} style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'cover' }} alt="" />
              : <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#6ee7b7,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontSize: 13 }}>{user.name[0]}</div>
            }
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{user.name.split(' ')[0]}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>VLSI · Taiwan Ready</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {canInstall && (
              <button onClick={install} style={{ ...C.ibtn, color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.3)' }}>
                <Ic n="download" s={13} />Install
              </button>
            )}
            <span style={{ padding: '5px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>🔥 {streak}d</span>
            <span style={{ padding: '5px 12px', background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#6ee7b7' }}>{todaySess}/3</span>
          </div>
        </header>
 
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
 
          {/* ── DASHBOARD ── */}
          {screen === 'dashboard' && (
            <div className="fadeUp">
              <T>Overview</T>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: '📚', label: 'Total Sessions', value: sessions.length, c: '#6ee7b7' },
                  { icon: '🔥', label: 'Streak', value: `${streak}d`, c: '#f59e0b' },
                  { icon: '📈', label: 'This Week', value: weekSess, c: '#3b82f6' },
                  { icon: '⭐', label: 'Avg Score', value: avgScore ? `${avgScore}%` : '—', c: '#8b5cf6' },
                ].map(s => (
                  <div key={s.label} style={{ ...C.card, textAlign: 'center', marginBottom: 0 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.c, fontFamily: "'Syne',sans-serif" }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Daily Goal</span>
                  <span style={{ fontSize: 12, color: todaySess >= 3 ? '#10b981' : 'var(--text3)' }}>{todaySess}/3 sessions</span>
                </div>
                <div style={{ height: 5, background: 'rgba(128,128,128,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(todaySess / 3 * 100, 100)}%`, background: todaySess >= 3 ? '#10b981' : '#6ee7b7', transition: 'width 0.5s' }} />
                </div>
                {todaySess >= 3 && <div style={{ marginTop: 8, color: '#10b981', fontSize: 12, fontWeight: 600 }}>🎉 Aaj ka goal complete! Shabash!</div>}
              </div>
              <T>Quick Practice</T>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 10 }}>
                {MODULES.map(mod => (
                  <ModCard key={mod.id} mod={mod} onClick={() => { setScreen('practice'); setActiveMod(mod); askGemini(mod.prompt, mod.title); }} active={activeMod?.id === mod.id} />
                ))}
              </div>
            </div>
          )}
 
          {/* ── PRACTICE ── */}
          {screen === 'practice' && (
            <div className="fadeUp">
              <div style={{ background: 'linear-gradient(135deg,#0d1117,#111827)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>AI Practice Partner</div>
                    <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: '#f0f0f0' }}>Speak. Learn. Improve.</div>
                    <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Mic dabao → bolo → AI real-time feedback dega</div>
                    {(interim || transcript) && (
                      <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 14px', borderRadius: 10, fontSize: 13, color: '#888' }}>
                        💬 "{interim || transcript}"
                      </div>
                    )}
                    {aiError && (
                      <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: 10, fontSize: 13, color: '#ef4444' }}>
                        ⚠️ {aiError}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <button onClick={listening ? stopListen : startListen} className={listening ? 'pulse' : ''}
                      style={{ width: 62, height: 62, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: listening ? '#ef4444' : '#6ee7b7', boxShadow: listening ? '0 0 24px rgba(239,68,68,0.4)' : '0 0 24px rgba(110,231,183,0.25)' }}>
                      <Ic n={listening ? 'stop' : 'mic'} s={24} c={listening ? '#fff' : '#000'} />
                    </button>
                    <span style={{ fontSize: 10, color: listening ? '#ef4444' : 'var(--text3)' }}>
                      {listening ? 'Recording...' : 'Tap to speak'}
                    </span>
                  </div>
                </div>
              </div>
 
              {/* Module Selector */}
              <div style={{ ...C.card, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Ya module select karo:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {MODULES.map(mod => (
                    <button key={mod.id} onClick={() => { setActiveMod(mod); askGemini(mod.prompt, mod.title); }}
                      style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${activeMod?.id === mod.id ? mod.color : 'var(--border)'}`, background: activeMod?.id === mod.id ? `${mod.color}15` : 'transparent', color: activeMod?.id === mod.id ? mod.color : 'var(--text3)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                      {mod.icon} {mod.title}
                    </button>
                  ))}
                </div>
              </div>
 
              {aiLoad && (
                <div style={{ ...C.card, color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="spin" style={{ display: 'inline-block' }}>⟳</span> AI soch raha hai...
                </div>
              )}
              {aiResp && !aiLoad && (
                <div style={{ ...C.card, borderColor: 'rgba(110,231,183,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>AI Response</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={toggleSpeak} style={C.ibtn}><Ic n={speaking ? 'pause' : 'play'} s={13} />{speaking ? 'Pause' : 'Play'}</button>
                      <button onClick={() => { setAiResp(''); setTranscript(''); stopSpeak(); setSpeaking(false); setAiError(''); }} style={C.ibtn}><Ic n="refresh" s={13} />Reset</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{aiResp}</div>
                </div>
              )}
            </div>
          )}
 
          {/* ── PRONUNCIATION ── */}
          {screen === 'pronunciation' && (
            <div className="fadeUp">
              <T>Pronunciation Checker</T>
              <div style={C.card}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <input value={pronTxt} onChange={e => setPronTxt(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkPron()} placeholder="Type or say something in English..." style={{ ...C.inp, flex: 1 }} />
                  <button onClick={pronMic} style={{ ...C.ibtn, flexShrink: 0 }}><Ic n="mic" s={15} /></button>
                  <button onClick={checkPron} style={{ ...C.btn, flexShrink: 0 }}>Check</button>
                </div>
                {pronLoad && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Analyzing...</div>}
                {pronScore !== null && !pronLoad && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
                      <div style={{ width: 76, height: 76, borderRadius: '50%', border: `3px solid ${pronScore >= 80 ? '#10b981' : pronScore >= 60 ? '#f59e0b' : '#ef4444'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: pronScore >= 80 ? '#10b981' : pronScore >= 60 ? '#f59e0b' : '#ef4444' }}>{pronScore}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>/100</span>
                      </div>
                      <div><div style={{ fontWeight: 700, fontSize: 15 }}>{pronScore >= 80 ? 'Excellent! 🎉' : pronScore >= 60 ? 'Keep practicing 💪' : 'Needs work 📖'}</div></div>
                    </div>
                    {pronFb && <div style={{ background: 'rgba(128,128,128,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{pronFb}</div>}
                  </div>
                )}
              </div>
            </div>
          )}
 
          {/* ── FLASHCARDS ── */}
          {screen === 'flashcards' && (
            <div className="fadeUp">
              <T>Mandarin Flashcards</T>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {fcCats.map(cat => (
                  <button key={cat} onClick={() => { setFcFilter(cat); setFcIdx(0); setFcFlipped(false); }}
                    style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${fcFilter === cat ? '#06b6d4' : 'var(--border)'}`, background: fcFilter === cat ? 'rgba(6,182,212,0.1)' : 'transparent', color: fcFilter === cat ? '#06b6d4' : 'var(--text3)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    {cat}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <span style={{ padding: '4px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, fontSize: 12, color: '#10b981', fontWeight: 600 }}>✓ {fcScore.correct}</span>
                <span style={{ padding: '4px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>✗ {fcScore.wrong}</span>
              </div>
              <div style={{ ...C.card, minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', position: 'relative', background: fcFlipped ? 'rgba(6,182,212,0.04)' : 'var(--surface)', borderColor: fcFlipped ? 'rgba(6,182,212,0.3)' : 'var(--border)', transition: 'all 0.3s' }}
                onClick={() => setFcFlipped(!fcFlipped)}>
                <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, color: 'var(--text3)' }}>{fcIdx + 1}/{fcCards.length}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', position: 'absolute', bottom: 12 }}>Tap to flip</div>
                {!fcFlipped ? (
                  <div className="flipIn" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 52, fontWeight: 800, color: '#06b6d4', fontFamily: 'serif', marginBottom: 8 }}>{fcCards[fcIdx]?.zh}</div>
                    <div style={{ fontSize: 16, color: 'var(--text2)' }}>{fcCards[fcIdx]?.py}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, padding: '3px 10px', background: 'rgba(6,182,212,0.08)', borderRadius: 20, display: 'inline-block' }}>{fcCards[fcIdx]?.cat}</div>
                  </div>
                ) : (
                  <div className="flipIn" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>{fcCards[fcIdx]?.en}</div>
                    <div style={{ fontSize: 18, color: '#f59e0b', marginBottom: 6 }}>{fcCards[fcIdx]?.hi}</div>
                    <button onClick={e => { e.stopPropagation(); speak(fcCards[fcIdx]?.en); }} style={{ ...C.ibtn, marginTop: 12, fontSize: 11 }}><Ic n="volume" s={12} />Hear it</button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <button onClick={() => { setFcIdx(i => Math.max(0, i - 1)); setFcFlipped(false); }} style={C.ibtn} disabled={fcIdx === 0}><Ic n="chevL" s={14} />Prev</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setFcScore(s => ({ ...s, correct: s.correct + 1 })); setFcIdx(i => Math.min(fcCards.length - 1, i + 1)); setFcFlipped(false); }}
                    style={{ ...C.btn, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>✓ Know</button>
                  <button onClick={() => { setFcScore(s => ({ ...s, wrong: s.wrong + 1 })); setFcIdx(i => Math.min(fcCards.length - 1, i + 1)); setFcFlipped(false); }}
                    style={{ ...C.btn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>✗ Review</button>
                </div>
                <button onClick={() => { setFcIdx(i => Math.min(fcCards.length - 1, i + 1)); setFcFlipped(false); }} style={C.ibtn} disabled={fcIdx === fcCards.length - 1}>Next<Ic n="chevR" s={14} /></button>
              </div>
            </div>
          )}
 
          {/* ── MOCK TIMER ── */}
          {screen === 'timer' && (
            <div className="fadeUp">
              <T>Mock Interview Timer</T>
              <div style={{ ...C.card, textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto 20px' }}>
                  <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(128,128,128,0.1)" strokeWidth="8" />
                    <circle cx="80" cy="80" r="70" fill="none"
                      stroke={timerSec > 30 ? '#6ee7b7' : timerSec > 10 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray="440"
                      strokeDashoffset={440 - (440 * (timerSec / 60))}
                      style={{ transition: 'all 1s linear' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 42, fontWeight: 800, color: timerSec > 30 ? '#6ee7b7' : timerSec > 10 ? '#f59e0b' : '#ef4444' }}>{timerSec}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>seconds</span>
                  </div>
                </div>
                {timerQ && <div style={{ background: 'rgba(128,128,128,0.06)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px', marginBottom: 16, fontSize: 14, color: 'var(--text)', textAlign: 'left' }}>{timerQ}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                  {!timerRunning && !timerDone && <button onClick={startTimer} style={C.btn}><Ic n="play" s={15} />Start</button>}
                  {timerRunning && <button onClick={() => { clearTimeout(timerRef.current); setTimerRunning(false); setTimerDone(true); }} style={{ ...C.btn, background: '#ef4444', color: '#fff' }}><Ic n="stop" s={15} />Stop</button>}
                  {timerDone && <button onClick={startTimer} style={C.btn}><Ic n="refresh" s={15} />New Question</button>}
                </div>
                {timerDone && (
                  <div>
                    <textarea value={timerAnswer} onChange={e => setTimerAnswer(e.target.value)} placeholder="Apna answer type karo..." style={{ ...C.ta, minHeight: 100, marginBottom: 10, textAlign: 'left' }} />
                    <button onClick={getTimerFeedback} style={C.btn} disabled={timerFbLoad}>
                      {timerFbLoad ? 'Analyzing...' : 'Get AI Feedback'}<Ic n="chart" s={14} />
                    </button>
                    {timerFb && <div style={{ marginTop: 16, background: 'rgba(128,128,128,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', textAlign: 'left' }}>{timerFb}</div>}
                  </div>
                )}
              </div>
            </div>
          )}
 
          {/* ── AI CHAT ── */}
          {screen === 'chat' && (
            <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <T>AI Chat</T>
                <button onClick={() => { setChatMsgs([]); LS.set('sc_chat', []); }} style={{ ...C.ibtn, fontSize: 11 }}><Ic n="trash" s={12} />Clear</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {chatMsgs.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, paddingTop: 40 }}>◌ English, Mandarin, VLSI — kuch bhi poocho!</div>}
                {chatMsgs.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: m.role === 'user' ? 'linear-gradient(135deg,#6ee7b7,#3b82f6)' : 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: m.role === 'user' ? '#000' : '#8b5cf6', fontWeight: 700 }}>
                      {m.role === 'user' ? user.name[0] : '◌'}
                    </div>
                    <div style={{ maxWidth: '72%', padding: '10px 14px', borderRadius: 14, fontSize: 13, background: m.role === 'user' ? 'rgba(110,231,183,0.08)' : 'var(--surface)', border: `1px solid ${m.role === 'user' ? 'rgba(110,231,183,0.2)' : 'var(--border)'}`, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatLoad && <div style={{ color: 'var(--text3)', fontSize: 12 }}>🤖 Thinking...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Ask anything..." style={{ ...C.inp, flex: 1 }} />
                <button onClick={sendChat} disabled={chatLoad || !chatInput.trim()} style={{ ...C.btn, opacity: chatLoad ? 0.5 : 1 }}><Ic n="send" s={15} /></button>
              </div>
            </div>
          )}
 
          {/* ── NOTES ── */}
          {screen === 'notes' && (
            <div className="fadeUp">
              <T>My Notes</T>
              <div style={C.card}>
                <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Title..." style={{ ...C.inp, marginBottom: 10 }} />
                <textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Write notes..." style={{ ...C.ta, marginBottom: 10 }} />
                <button onClick={saveNote} style={C.btn}><Ic n="plus" s={14} />Save Note</button>
              </div>
              {notes.map((n, i) => (
                <div key={i} style={C.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{n.title}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => editNote(i)} style={{ ...C.ibtn, padding: '4px 8px' }}><Ic n="edit" s={12} /></button>
                      <button onClick={() => deleteNote(i)} style={{ ...C.ibtn, padding: '4px 8px', color: '#ef4444' }}><Ic n="trash" s={12} /></button>
                    </div>
                  </div>
                  {n.body && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10, whiteSpace: 'pre-wrap' }}>{n.body}</div>}
                </div>
              ))}
            </div>
          )}
 
          {/* ── PROFILE ── */}
          {screen === 'profile' && (
            <div className="fadeUp">
              <T>My Profile</T>
              <div style={{ ...C.card, display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                {user.picture
                  ? <img src={user.picture} style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover' }} alt="" />
                  : <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,#6ee7b7,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#000' }}>{profile.name[0]}</div>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{profile.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{profile.bio}</div>
                  <div style={{ fontSize: 12, color: '#6ee7b7', marginTop: 4 }}>🎯 {profile.goal}</div>
                </div>
                <button onClick={() => { setProfileForm(profile); setProfileEdit(!profileEdit); }} style={C.ibtn}><Ic n="edit" s={13} />Edit</button>
              </div>
              {profileEdit ? (
                <div style={C.card}>
                  {[{ label: 'Full Name', key: 'name' }, { label: 'Bio', key: 'bio' }, { label: 'Goal', key: 'goal' }, { label: 'Skills', key: 'skills' }].map(f => (
                    <div key={f.key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{f.label}</div>
                      <input value={profileForm[f.key]} onChange={e => setProfileForm({ ...profileForm, [f.key]: e.target.value })} style={C.inp} />
                    </div>
                  ))}
                  <button onClick={saveProfile} style={C.btn}><Ic n="check" s={14} />Save</button>
                </div>
              ) : (
                <div style={C.card}>
                  {[{ l: 'Sessions', v: sessions.length }, { l: 'Streak', v: `${streak}d` }, { l: 'Avg Score', v: avgScore ? `${avgScore}%` : '—' }, { l: 'Score', v: userScore }].map(s => (
                    <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text3)' }}>{s.l}</span>
                      <span style={{ color: '#6ee7b7', fontWeight: 600 }}>{s.v}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={C.card}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>🔔 Daily Reminder</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={reminder.enabled} onChange={e => setReminder({ ...reminder, enabled: e.target.checked })} style={{ accentColor: '#6ee7b7' }} />
                    Enable
                  </label>
                  <input type="time" value={reminder.time} onChange={e => setReminder({ ...reminder, time: e.target.value })} style={{ ...C.inp, width: 'auto' }} />
                </div>
                <input value={reminder.msg} onChange={e => setReminder({ ...reminder, msg: e.target.value })} placeholder="Reminder message..." style={{ ...C.inp, marginBottom: 10 }} />
                <button onClick={saveReminder} style={C.btn}><Ic n="bell" s={14} />{reminderSet ? '✓ Saved!' : 'Save'}</button>
              </div>
            </div>
          )}
 
          {/* ── RESUME ── */}
          {screen === 'resume' && (
            <div className="fadeUp">
              <T>Resume Builder</T>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['edit', 'preview'].map(s => (
                  <button key={s} onClick={() => setResumeSection(s)}
                    style={{ padding: '7px 18px', borderRadius: 10, border: `1px solid ${resumeSection === s ? '#6ee7b7' : 'var(--border)'}`, background: resumeSection === s ? 'rgba(110,231,183,0.08)' : 'transparent', color: resumeSection === s ? '#6ee7b7' : 'var(--text3)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                    {s === 'edit' ? '✏️ Edit' : '👁️ Preview'}
                  </button>
                ))}
                <button onClick={improveResume} disabled={aiResumeLoad} style={{ ...C.btn, marginLeft: 'auto' }}>
                  {aiResumeLoad ? '⟳ Thinking...' : '🤖 AI Review'}
                </button>
              </div>
              {resumeSection === 'edit' && (
                <div>
                  <div style={C.card}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Personal Info</div>
                    {[{ l: 'Name', k: 'name' }, { l: 'Email', k: 'email' }, { l: 'Phone', k: 'phone' }, { l: 'Location', k: 'location' }].map(f => (
                      <div key={f.k} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{f.l}</div>
                        <input value={resumeData[f.k]} onChange={e => setResumeData({ ...resumeData, [f.k]: e.target.value })} style={C.inp} />
                      </div>
                    ))}
                  </div>
                  <div style={C.card}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Summary</div>
                    <textarea value={resumeData.summary} onChange={e => setResumeData({ ...resumeData, summary: e.target.value })} style={{ ...C.ta, minHeight: 80 }} />
                  </div>
                  <div style={C.card}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Skills</div>
                    <textarea value={resumeData.skills} onChange={e => setResumeData({ ...resumeData, skills: e.target.value })} style={{ ...C.ta, minHeight: 60 }} />
                  </div>
                </div>
              )}
              {resumeSection === 'preview' && (
                <div style={{ ...C.card, fontFamily: 'serif', color: darkMode ? '#ccc' : '#111', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 4 }}>{resumeData.name}</div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{resumeData.email} | {resumeData.phone} | {resumeData.location}</div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>{resumeData.linkedin}</div>
                  <div style={{ fontWeight: 700, borderBottom: '1px solid #333', marginBottom: 8 }}>Summary</div>
                  <div style={{ fontSize: 13, marginBottom: 16 }}>{resumeData.summary}</div>
                  <div style={{ fontWeight: 700, borderBottom: '1px solid #333', marginBottom: 8 }}>Skills</div>
                  <div style={{ fontSize: 13 }}>{resumeData.skills}</div>
                </div>
              )}
              {aiResumeFb && (
                <div style={{ ...C.card, borderColor: 'rgba(110,231,183,0.2)' }}>
                  <div style={{ color: '#6ee7b7', fontWeight: 600, marginBottom: 10 }}>🤖 AI Feedback</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{aiResumeFb}</div>
                </div>
              )}
            </div>
          )}
 
          {/* ── PROGRESS ── */}
          {screen === 'progress' && (
            <div className="fadeUp">
              <T>Progress</T>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, marginBottom: 20 }}>
                {[{ icon: '📚', label: 'Sessions', value: sessions.length }, { icon: '🔥', label: 'Streak', value: `${streak}d` }, { icon: '📈', label: 'Week', value: weekSess }, { icon: '⭐', label: 'Avg', value: avgScore ? `${avgScore}%` : '—' }].map(s => (
                  <div key={s.label} style={{ ...C.card, textAlign: 'center', marginBottom: 0 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#6ee7b7' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={C.card}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Last 7 Days</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                  {last7.map(d => (
                    <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{d.count || ''}</span>
                      <div style={{ width: '100%', borderRadius: 3, background: d.count > 0 ? '#6ee7b7' : 'rgba(128,128,128,0.1)', height: `${(d.count / maxC) * 80 + 4}px` }} />
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>
              {sessions.slice(0, 5).length > 0 && (
                <div style={C.card}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Recent Activity</div>
                  {sessions.slice(0, 5).map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <span style={{ color: 'var(--text2)' }}>{s.mod}</span>
                      <span style={{ color: 'var(--text3)' }}>{s.score ? `${s.score}%` : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
 
          {/* ── ECOSYSTEM ── */}
          {screen === 'ecosystem' && (
            <div className="fadeUp">
              <T>Connected Ecosystem</T>
              <div style={C.card}>
                {[
                  { l: 'LinkedIn', u: 'https://linkedin.com/in/shiwank-gupta-a93132264', n: 'linkedin', desc: 'Your professional profile' },
                  { l: 'Gmail', u: 'https://mail.google.com', n: 'mail', desc: 'Check emails' },
                  { l: 'WhatsApp', u: 'https://web.whatsapp.com', n: 'whatsapp', desc: 'Messages' },
                  { l: 'GitHub', u: 'https://github.com', n: 'github', desc: 'Your code repos' },
                ].map(lk => (
                  <a key={lk.l} href={lk.u} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(110,231,183,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Ic n={lk.n} s={18} c="#6ee7b7" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{lk.l}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lk.desc}</div>
                    </div>
                    <Ic n="chevR" s={14} c="var(--text3)" />
                  </a>
                ))}
              </div>
            </div>
          )}
 
          {/* ── CALENDAR ── */}
          {screen === 'calendar' && (
            <div className="fadeUp">
              <T>My Calendar</T>
              <div style={C.card}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Add Event</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <input type="date" value={calDate} onChange={e => setCalDate(e.target.value)} style={{ ...C.inp, width: 'auto' }} />
                  <input value={calTxt} onChange={e => setCalTxt(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLocalEv()} placeholder="Event name..." style={{ ...C.inp, flex: 1, minWidth: 150 }} />
                  <button onClick={addLocalEv} style={C.btn}><Ic n="plus" s={14} />Add</button>
                </div>
                {Object.keys(calEvs).length === 0
                  ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>No events yet. Add one above!</div>
                  : Object.entries(calEvs).sort(([a], [b]) => a > b ? 1 : -1).map(([date, evs]) => (
                    <div key={date} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 600, marginBottom: 8 }}>{new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                      {evs.map((ev, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(128,128,128,0.04)', padding: '8px 12px', borderRadius: 8, marginBottom: 4, fontSize: 13 }}>
                          <span>{ev}</span>
                          <button onClick={() => { const u = { ...calEvs }; u[date] = u[date].filter((_, j) => j !== i); if (!u[date].length) delete u[date]; setCalEvs(u); LS.set('sc_cal', u); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0 }}>
                            <Ic n="x" s={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          )}
 
          {/* ── LEADERBOARD ── */}
          {screen === 'leaderboard' && (
            <div className="fadeUp">
              <T>Leaderboard</T>
              <div style={C.card}>
                {fullLB.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)', background: e.name.includes('You') ? 'rgba(110,231,183,0.03)' : 'transparent', borderRadius: e.name.includes('You') ? 8 : 0, paddingLeft: e.name.includes('You') ? 8 : 0 }}>
                    <div style={{ fontSize: 20 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: e.name.includes('You') ? '#6ee7b7' : 'var(--text)' }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>🔥 {e.streak}d streak</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#6ee7b7' }}>{e.score}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
 
        </main>
      </div>
    </div>
  );
}
 
/* ── HELPER COMPONENTS ── */
function T({ children }) {
  return <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>{children}</div>;
}
 
function ModCard({ mod, onClick, active }) {
  return (
    <button onClick={onClick}
      style={{ background: active ? 'rgba(110,231,183,0.06)' : 'var(--surface)', border: `1px solid ${active ? mod.color : 'var(--border)'}`, borderRadius: 14, padding: '15px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s', width: '100%' }}
      onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.borderColor = mod.color; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; if (!active) e.currentTarget.style.borderColor = 'var(--border)'; }}>
      <div style={{ fontSize: 24, marginBottom: 7 }}>{mod.icon}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{mod.title}</div>
    </button>
  );
}
 