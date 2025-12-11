import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
// import { GoogleGenAI } from "@google/genai"; // Removed client-side SDK

// --- Configuration ---
// const ELEVENLABS_API_KEY = "sk_ca4eb8ba5d7ed2243d59fc8270bca7c59f02b34b1503a269"; // Removed
// const ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Moved to backend
const USER_NAME_EN = "Mohammed Al-Saud";
const USER_NAME_AR = "محمد آل سعود";
const USER_ID = "1056789012";

// --- Types & Mock Data ---

type View = 'LOGIN' | 'DASHBOARD' | 'VIOLATIONS' | 'PASSPORT' | 'APPOINTMENTS' | 'SETTINGS';
type Language = 'en-US' | 'ar-SA';

interface Violation {
  id: string;
  type: string;
  amount: number;
  date: string;
  location: string;
  paid: boolean;
}

const MOCK_DATA = {
  violations: [
    { id: "V-99283", type: "Speeding (10-20 km/h over)", amount: 150, date: "2023-10-15", location: "Riyadh - Ring Road", paid: false },
    { id: "V-11202", type: "Illegal Parking", amount: 100, date: "2023-11-01", location: "Jeddah - Corniche", paid: false },
  ] as Violation[],
  passport: {
    number: "P12345678",
    expiry: "2024-02-20",
    status: "Active"
  },
  appointments: [] as string[],
  notifications: [
    { id: 1, title: "Passport Expiry Warning", time: "2 hours ago", read: false },
    { id: 2, title: "New Traffic Violation Recorded", time: "1 day ago", read: true },
    { id: 3, title: "National Address Updated", time: "5 days ago", read: true },
  ]
};

// --- Helper Components ---

const BiometricVerificationOverlay = ({ lang, onComplete }: { lang: Language, onComplete: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onComplete();
        }, 3000); // 3 seconds simulation
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
            <div className="relative w-32 h-32 mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-absher-green opacity-20 animate-ping"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-absher-green border-r-transparent border-b-absher-green border-l-transparent animate-spin"></div>
                <div className="absolute inset-2 rounded-full bg-gray-900 flex items-center justify-center">
                    <i className="fas fa-fingerprint text-4xl text-absher-green animate-pulse"></i>
                </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">{lang === 'ar-SA' ? 'جاري التحقق من الهوية' : 'Verifying Identity'}</h2>
            <p className="text-gray-400 text-sm font-mono">{lang === 'ar-SA' ? 'تحليل البصمة الصوتية...' : 'Analyzing Voice Print...'}</p>
            
            <div className="mt-8 flex gap-1 h-8 items-end">
                 {[...Array(5)].map((_, i) => (
                     <div key={i} className="w-1.5 bg-absher-green rounded-full animate-wave" style={{ animationDelay: `${i * 0.1}s`, height: '20%' }}></div>
                 ))}
            </div>
            <style>{`
                @keyframes wave {
                    0%, 100% { height: 20%; opacity: 0.5; }
                    50% { height: 100%; opacity: 1; }
                }
                .animate-wave {
                    animation: wave 1s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

// --- Services ---

const speakText = async (text: string, lang: Language) => {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
      }),
    });

    if (!response.ok) throw new Error('TTS Failed');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await audio.play();
    return audio;
  } catch (error) {
    console.error("ElevenLabs Error:", error);
    // Fallback
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
    return null;
  }
};

const processVoiceCommand = async (transcript: string, currentContext: any, lang: Language) => {
  try {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            transcript,
            context: currentContext,
            lang
        })
    });

    if (!response.ok) throw new Error('Backend API Failed');

    return await response.json();
  } catch (e) {
    console.error("Gemini Error", e);
    return {
      action: "ERROR",
      speechResponse: lang === 'ar-SA' ? "عذراً، لم أتمكن من فهم ذلك. الرجاء المحاولة مرة أخرى." : "I'm sorry, I didn't catch that.",
      uiMessage: "Error processing request"
    };
  }
};

// --- UI Components ---

const Header = ({ user, toggleContrast, isHighContrast, lang, setLang, notifications }: any) => {
    const [showNotifs, setShowNotifs] = useState(false);
    const unreadCount = notifications.filter((n:any) => !n.read).length;

    return (
      <header className={`h-20 shadow-sm flex items-center justify-between px-6 z-30 relative transition-colors duration-300 ${isHighContrast ? 'bg-black text-yellow-400 border-b-2 border-yellow-400' : 'bg-white text-gray-800'}`}>
        <div className="flex items-center space-x-6">
          {/* Brand */}
          <div className="flex flex-col items-start cursor-pointer hover:opacity-80 transition">
            <div className="flex items-center gap-2 text-2xl font-bold tracking-tight text-absher-green">
              <i className="fas fa-palm-tree text-3xl"></i>
              <div className="flex flex-col leading-none">
                 <span>Absher</span>
                 <span className="text-[10px] text-gray-400 font-normal tracking-widest uppercase mt-1">Individuals</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Center Search - Visual Only */}
        <div className="hidden lg:flex flex-1 max-w-lg mx-12">
           <div className={`w-full h-10 rounded-full flex items-center px-4 gap-3 ${isHighContrast ? 'bg-gray-800 border border-gray-600' : 'bg-gray-100 border border-gray-200'}`}>
              <i className="fas fa-search text-gray-400"></i>
              <input disabled type="text" placeholder={lang === 'ar-SA' ? "ابحث عن خدمة..." : "Search for a service..."} className="bg-transparent w-full text-sm outline-none cursor-not-allowed text-gray-500" />
              <i className="fas fa-microphone text-absher-green opacity-50"></i>
           </div>
        </div>
        
        <div className="flex items-center space-x-4 md:space-x-6">
          {/* Language Toggle */}
          <button 
            onClick={() => setLang(lang === 'en-US' ? 'ar-SA' : 'en-US')}
            className={`px-3 py-1 rounded border text-sm font-bold transition ${isHighContrast ? 'border-yellow-400 hover:bg-yellow-900' : 'border-gray-300 hover:bg-gray-50'}`}
          >
            {lang === 'en-US' ? 'العربية' : 'English'}
          </button>
    
          {/* Accessibility */}
          <button 
            onClick={toggleContrast}
            className="w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-gray-100 text-gray-600"
            title="High Contrast"
          >
            <i className="fas fa-adjust"></i>
          </button>
    
          {/* Notification Bell */}
          <div className="relative">
              <button 
                onClick={() => setShowNotifs(!showNotifs)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-gray-100 text-gray-600 relative"
              >
                  <i className="far fa-bell text-lg"></i>
                  {unreadCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
              </button>
              
              {showNotifs && (
                  <div className={`absolute top-12 right-0 w-80 rounded-2xl shadow-xl border overflow-hidden animate-fade-in z-50 ${isHighContrast ? 'bg-gray-900 border-gray-600' : 'bg-white border-gray-100'}`}>
                      <div className="p-4 border-b font-bold flex justify-between items-center">
                          <span>{lang === 'ar-SA' ? 'الإشعارات' : 'Notifications'}</span>
                          <span className="text-xs bg-absher-light text-absher-green px-2 py-0.5 rounded-full">{unreadCount} New</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                          {notifications.map((n:any) => (
                              <div key={n.id} className={`p-4 border-b last:border-0 hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}>
                                  <h4 className="text-sm font-bold mb-1">{n.title}</h4>
                                  <p className="text-xs text-gray-500">{n.time}</p>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
    
          <div className="h-8 w-px bg-gray-200 mx-2"></div>
    
          {/* User Profile */}
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="text-right hidden md:block">
              <p className={`text-sm font-bold group-hover:text-absher-green transition ${isHighContrast ? 'text-yellow-400' : 'text-gray-800'}`}>
                {lang === 'ar-SA' ? USER_NAME_AR : USER_NAME_EN}
              </p>
              <p className="text-xs text-gray-500">ID: {USER_ID}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-absher-green to-teal-700 text-white flex items-center justify-center font-bold shadow-lg ring-2 ring-white">
              <i className="fas fa-user"></i>
            </div>
          </div>
        </div>
      </header>
    );
}

const Sidebar = ({ currentView, setView, isHighContrast, lang }: any) => {
  const menuItems = [
    { id: 'DASHBOARD', labelEn: 'My Dashboard', labelAr: 'لوحة التحكم', icon: 'fa-home' },
    { id: 'VIOLATIONS', labelEn: 'Traffic Violations', labelAr: 'المخالفات المرورية', icon: 'fa-traffic-light' },
    { id: 'PASSPORT', labelEn: 'Passport Services', labelAr: 'خدمات الجوازات', icon: 'fa-passport' },
    { id: 'APPOINTMENTS', labelEn: 'Appointments', labelAr: 'المواعيد', icon: 'fa-calendar-check' },
    { id: 'SETTINGS', labelEn: 'Settings', labelAr: 'الإعدادات', icon: 'fa-cog' },
  ];

  const dir = lang === 'ar-SA' ? 'rtl' : 'ltr';

  return (
    <aside className={`w-72 hidden md:flex flex-col h-[calc(100vh-80px)] transition-colors duration-300 ${isHighContrast ? 'bg-gray-900 text-white border-r border-gray-700' : 'bg-absher-dark text-white'}`} dir={dir}>
      <div className="p-6">
        <h2 className="text-xs uppercase tracking-wider opacity-60 font-semibold mb-6 px-4">
            {lang === 'ar-SA' ? 'خدماتي الإلكترونية' : 'My E-Services'}
        </h2>
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                currentView === item.id 
                  ? 'bg-white/10 text-white font-bold shadow-inner' 
                  : 'hover:bg-white/5 text-gray-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${currentView === item.id ? 'bg-absher-gold text-white' : 'bg-white/10 group-hover:bg-white/20'}`}>
                 <i className={`fas ${item.icon} text-sm`}></i>
              </div>
              <span className="text-sm tracking-wide">{lang === 'ar-SA' ? item.labelAr : item.labelEn}</span>
              {currentView === item.id && (
                  <div className={`ml-auto w-1.5 h-1.5 rounded-full bg-absher-gold ${lang === 'ar-SA' ? 'mr-auto ml-0' : 'ml-auto'}`}></div>
              )}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Footer Branding */}
      <div className="mt-auto p-6">
          <div className="bg-white/5 rounded-xl p-4 flex items-center justify-center gap-3 border border-white/10">
              <span className="text-xs opacity-60">Powered by</span>
              <div className="h-6 w-16 bg-white/20 rounded opacity-50 flex items-center justify-center text-[8px] font-bold">
                  VISION 2030
              </div>
          </div>
      </div>
    </aside>
  );
};

const VoiceFloatingAction = ({ isListening, isProcessing, assistantResponse, onMicClick, isHighContrast, lang, lastTranscript, showPulseHint }: any) => {
  const dir = lang === 'ar-SA' ? 'rtl' : 'ltr';

  return (
    <div className={`fixed bottom-8 ${lang === 'ar-SA' ? 'left-8' : 'right-8'} z-50 flex flex-col items-end pointer-events-none`} dir={dir}>
      
      {/* Enhanced Conversation Panel */}
      {(assistantResponse || lastTranscript || isProcessing) && (
        <div className={`mb-6 w-96 pointer-events-auto rounded-3xl shadow-2xl overflow-hidden glass-panel fade-in-up transition-all duration-300 transform ${isHighContrast ? 'bg-black border-2 border-yellow-400' : 'bg-white/90'}`}>
          {/* Header */}
          <div className={`px-5 py-4 flex justify-between items-center border-b ${isHighContrast ? 'bg-gray-800 border-yellow-400 text-yellow-400' : 'bg-gradient-to-r from-absher-green to-absher-dark text-white border-white/10'}`}>
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                 <i className="fas fa-headset text-sm"></i>
               </div>
               <div>
                 <h3 className="font-bold text-sm leading-none">{lang === 'ar-SA' ? 'مساعد أبشر' : 'Absher Assistant'}</h3>
                 <span className="text-[10px] opacity-80 font-normal">{lang === 'ar-SA' ? 'متصل' : 'Online'}</span>
               </div>
             </div>
             {isProcessing && (
                 <div className="voice-wave">
                   <div className="voice-wave-bar"></div>
                   <div className="voice-wave-bar"></div>
                   <div className="voice-wave-bar"></div>
                 </div>
             )}
          </div>

          {/* Body */}
          <div className="p-5 max-h-[300px] overflow-y-auto space-y-4 bg-gray-50/50">
             
             {lastTranscript && (
               <div className="flex flex-col items-end">
                  <div className={`p-3 rounded-2xl rounded-tr-sm text-sm shadow-sm max-w-[90%] ${isHighContrast ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'}`}>
                    {lastTranscript}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 px-1">You</span>
               </div>
             )}

             {isProcessing && !assistantResponse && (
                <div className="flex flex-col items-start w-full">
                   <div className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 w-16 h-10 flex items-center justify-center">
                     <div className="typing-indicator flex gap-1">
                       <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                       <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                       <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                     </div>
                   </div>
                </div>
             )}

             {assistantResponse && (
               <div className="flex flex-col items-start animate-fade-in">
                  <div className={`p-4 rounded-2xl rounded-tl-sm text-sm shadow-md max-w-[95%] leading-relaxed ${isHighContrast ? 'bg-yellow-900 text-yellow-100 border border-yellow-600' : 'bg-white text-gray-800 border border-gray-100'}`}>
                    {assistantResponse}
                  </div>
                  <span className="text-[10px] text-absher-green mt-1 px-1 font-bold">Absher Assistant</span>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Pulse Hint Ring */}
      {showPulseHint && !isListening && (
          <div className="absolute inset-0 rounded-full bg-absher-green/30 animate-ping pointer-events-none"></div>
      )}

      {/* Main FAB */}
      <button
        onClick={onMicClick}
        className={`pointer-events-auto w-20 h-20 rounded-full shadow-2xl flex items-center justify-center text-3xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4 border-white relative z-10 ${
          isListening 
            ? 'bg-red-500 text-white mic-pulse' 
            : isHighContrast ? 'bg-yellow-400 text-black' : 'bg-gradient-to-br from-absher-green to-absher-dark text-white'
        }`}
        aria-label="Toggle Voice Assistant"
      >
        <i className={`fas ${isListening ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
      </button>
      
      {showPulseHint && !isListening && (
        <div className="pointer-events-auto absolute bottom-24 right-0 bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap animate-bounce">
            {lang === 'ar-SA' ? 'اضغط للتحدث' : 'Tap to Speak'}
        </div>
      )}
    </div>
  );
};

// Specialized Voice Input Component
const VoiceInput = ({ label, value, onChange, placeholder, isHighContrast, onVoiceRequest }: any) => {
  return (
    <div className="group relative">
      <label className="block text-sm font-bold mb-1.5 text-gray-700 group-hover:text-absher-green transition-colors">
        {label}
      </label>
      <div className="relative">
        <input 
          type="text" 
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full pl-4 pr-12 py-3.5 rounded-xl border-2 outline-none transition-all duration-200 focus:ring-4 focus:ring-absher-green/10 ${isHighContrast ? 'bg-gray-800 border-gray-600 text-white focus:border-yellow-400' : 'bg-white border-gray-200 focus:border-absher-green text-gray-800'}`}
        />
        <button 
          onClick={onVoiceRequest}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-absher-green transition-all"
          title="Speak to fill"
        >
          <i className="fas fa-microphone"></i>
        </button>
      </div>
    </div>
  );
};

// --- View Components ---

const LoginView = ({ lang, onLogin, isHighContrast }: any) => {
    return (
        <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isHighContrast ? 'bg-gray-900' : 'bg-gray-50'}`}>
             {/* Background Art */}
             <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-absher-green to-transparent opacity-10 pointer-events-none"></div>
             
             <div className={`relative z-10 w-full max-w-md p-8 rounded-3xl shadow-2xl ${isHighContrast ? 'bg-black border-2 border-yellow-400' : 'bg-white'}`}>
                 <div className="text-center mb-8">
                     <i className="fas fa-palm-tree text-5xl text-absher-green mb-4 block"></i>
                     <h1 className="text-3xl font-bold tracking-tight mb-1">Absher</h1>
                     <p className="text-gray-500 text-sm tracking-widest uppercase">Individuals</p>
                 </div>

                 <div className="space-y-4">
                     <div className="space-y-1">
                         <label className="text-sm font-bold text-gray-700">{lang === 'ar-SA' ? 'رقم الهوية' : 'National ID'}</label>
                         <input disabled type="text" value={USER_ID} className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 cursor-not-allowed" />
                     </div>
                     <div className="space-y-1">
                         <label className="text-sm font-bold text-gray-700">{lang === 'ar-SA' ? 'كلمة المرور' : 'Password'}</label>
                         <input disabled type="password" value="********" className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 cursor-not-allowed" />
                     </div>

                     <div className="pt-4 flex flex-col gap-3">
                         <button onClick={onLogin} className="w-full py-4 bg-absher-dark text-white rounded-xl font-bold hover:bg-absher-green transition shadow-lg">
                             {lang === 'ar-SA' ? 'تسجيل الدخول' : 'Login'}
                         </button>
                         
                         <div className="relative flex py-2 items-center">
                             <div className="flex-grow border-t border-gray-200"></div>
                             <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase">{lang === 'ar-SA' ? 'أو' : 'OR'}</span>
                             <div className="flex-grow border-t border-gray-200"></div>
                         </div>

                         <div className="text-center">
                             <p className="text-sm text-gray-500 mb-2">{lang === 'ar-SA' ? 'تسجيل الدخول بالصوت' : 'Accessible Voice Login'}</p>
                             <div className="inline-flex items-center gap-2 text-absher-green bg-absher-light/50 px-4 py-2 rounded-full border border-absher-green/20">
                                 <i className="fas fa-microphone animate-pulse"></i>
                                 <span className="text-sm font-bold">"{lang === 'ar-SA' ? 'تسجيل الدخول' : 'Login'}"</span>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
        </div>
    );
}

const DashboardView = ({ isHighContrast, data, lang }: any) => {
  const Card = ({ title, value, icon, color, subtext, actionLabel }: any) => (
    <div className={`p-6 rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${isHighContrast ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-100'}`}>
      <div className="flex justify-between items-start mb-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${color}`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <button className="text-gray-300 hover:text-absher-green"><i className="fas fa-ellipsis-v"></i></button>
      </div>
      <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">{title}</h3>
      <div className="text-3xl font-extrabold mb-4">{value}</div>
      
      {subtext ? (
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 mb-3">
           <i className="fas fa-exclamation-circle"></i> {subtext}
        </div>
      ) : (
        <div className="h-[34px]"></div> // spacer
      )}

      <button className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition ${isHighContrast ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}`}>
        <span>{actionLabel || 'View Details'}</span>
        <i className="fas fa-arrow-right text-xs opacity-70"></i>
      </button>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
             {lang === 'ar-SA' ? 'مرحباً، محمد' : 'Good Morning, Mohammed'}
           </h1>
           <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {lang === 'ar-SA' ? 'آخر تسجيل دخول: اليوم 09:41 ص' : 'Last login: Today at 09:41 AM'}
           </p>
        </div>
        <div className="flex gap-3">
           <button className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 shadow-sm hover:bg-gray-50">
             <i className="fas fa-file-export mr-2"></i> Report
           </button>
           <button className="px-5 py-2.5 bg-absher-dark text-white rounded-xl text-sm font-bold shadow-lg hover:bg-absher-green transition">
             <i className="fas fa-plus mr-2"></i> New Request
           </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          title={lang === 'ar-SA' ? 'المخالفات' : 'My Violations'}
          value={data.violations.filter((v:any) => !v.paid).length} 
          icon="fa-traffic-light" 
          color="bg-red-50 text-red-600"
          subtext={data.violations.some((v:any) => !v.paid) ? (lang === 'ar-SA' ? 'إجراء مطلوب' : 'Action Required') : null}
          actionLabel={lang === 'ar-SA' ? 'سداد الآن' : 'Pay Now'}
        />
        <Card 
          title={lang === 'ar-SA' ? 'المركبات' : 'Vehicles'}
          value="2" 
          icon="fa-car" 
          color="bg-blue-50 text-blue-600" 
          actionLabel={lang === 'ar-SA' ? 'إدارة المركبات' : 'Manage'}
        />
        <Card 
          title={lang === 'ar-SA' ? 'أفراد العائلة' : 'Family Members'}
          value="4" 
          icon="fa-users" 
          color="bg-green-50 text-green-600" 
          actionLabel={lang === 'ar-SA' ? 'عرض السجلات' : 'View Records'}
        />
        <Card 
          title={lang === 'ar-SA' ? 'المواعيد' : 'Appointments'}
          value={data.appointments.length} 
          icon="fa-calendar-alt" 
          color="bg-purple-50 text-purple-600" 
          actionLabel={lang === 'ar-SA' ? 'حجز جديد' : 'Book New'}
        />
      </div>

      {/* Modern Banner */}
      <div className={`relative overflow-hidden rounded-3xl p-8 shadow-2xl ${isHighContrast ? 'bg-yellow-900 border-2 border-yellow-500' : 'bg-gradient-to-r from-absher-dark to-absher-green'}`}>
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6 text-white">
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                  <i className="fas fa-passport text-absher-gold"></i>
               </div>
               <div>
                  <h3 className="font-bold text-xl mb-1">{lang === 'ar-SA' ? 'جواز السفر ينتهي قريباً' : 'Your Passport is Expiring Soon'}</h3>
                  <p className="opacity-90 max-w-lg text-sm leading-relaxed">
                    {lang === 'ar-SA' ? 'يرجى مراجعة وثائق السفر الخاصة بك لضمان تجربة سفر سلسة وتجنب أي تأخير.' : 'Review your travel documents to ensure seamless travel and avoid any delays at the airport.'}
                  </p>
               </div>
            </div>
            <button className="bg-white text-absher-dark px-8 py-3 rounded-xl font-extrabold text-sm hover:bg-gray-50 transition shadow-lg transform hover:scale-105 active:scale-95 whitespace-nowrap">
              {lang === 'ar-SA' ? 'تجديد الآن' : 'Renew Now'}
            </button>
        </div>
      </div>
    </div>
  );
};

const ViolationsView = ({ isHighContrast, data, onPay, lang }: any) => {
  const unpaid = data.violations.filter((v:any) => !v.paid);
  const totalAmount = unpaid.reduce((sum: number, v:any) => sum + v.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex items-center justify-between">
         <h1 className="text-2xl font-extrabold text-gray-900">{lang === 'ar-SA' ? 'المخالفات المرورية' : 'Traffic Violations'}</h1>
         <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {lang === 'ar-SA' ? 'آخر تحديث: الآن' : 'Updated: Just now'}
         </div>
       </div>
       
       <div className={`p-8 rounded-3xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-6 ${isHighContrast ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`}>
          <div>
            <p className="text-sm text-gray-500 mb-1 font-bold uppercase tracking-wider">{lang === 'ar-SA' ? 'إجمالي المبلغ غير المدفوع' : 'Total Unpaid Amount'}</p>
            <p className="text-5xl font-black text-absher-green tracking-tight">{totalAmount} <span className="text-2xl font-medium text-gray-400">SAR</span></p>
          </div>
          <button 
             onClick={onPay}
             disabled={totalAmount === 0}
             className={`px-10 py-4 rounded-xl font-bold text-lg shadow-xl transition transform active:scale-95 flex items-center gap-3 ${totalAmount === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-absher-green text-white hover:bg-absher-dark'}`}
          >
            <i className="fas fa-credit-card"></i>
            {lang === 'ar-SA' ? 'سداد الكل' : 'Pay All Violations'}
          </button>
       </div>

       <div className="space-y-4">
          {unpaid.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500 text-3xl">
                 <i className="fas fa-check"></i>
              </div>
              <p className="font-bold text-lg text-gray-800">{lang === 'ar-SA' ? 'سجل نظيف!' : 'Clean Record!'}</p>
              <p className="text-gray-500">{lang === 'ar-SA' ? 'لا يوجد لديك مخالفات مرورية.' : 'You have no unpaid violations.'}</p>
            </div>
          ) : (
            unpaid.map((v:any) => (
              <div key={v.id} className={`p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-4 transition hover:shadow-md ${isHighContrast ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="flex items-start gap-5 w-full">
                  <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0 text-lg">
                    <i className="fas fa-exclamation-triangle"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-800">{v.type}</h4>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                       <span><i className="fas fa-map-marker-alt text-gray-400 mr-1"></i> {v.location}</span>
                       <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                       <span><i className="far fa-clock text-gray-400 mr-1"></i> {v.date}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 font-mono bg-gray-50 inline-block px-2 py-0.5 rounded border">ID: {v.id}</p>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap w-full sm:w-auto flex justify-between sm:block items-center border-t sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                   <p className="font-black text-xl text-gray-900">{v.amount} <span className="text-xs font-normal text-gray-500">SAR</span></p>
                   <span className="text-xs text-red-600 font-bold bg-red-100 px-3 py-1 rounded-full inline-block mt-1">{lang === 'ar-SA' ? 'غير مسدد' : 'Unpaid'}</span>
                </div>
              </div>
            ))
          )}
       </div>
    </div>
  );
};

const PassportView = ({ isHighContrast, data, onRenew, formData, setFormData, onVoiceFieldRequest, lang }: any) => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-gray-900">{lang === 'ar-SA' ? 'خدمات الجوازات' : 'Passport Services'}</h1>
      </div>
      
      <div className="grid md:grid-cols-12 gap-8">
        <div className="md:col-span-8 space-y-8">
           {/* Digital ID Card Look */}
           <div className={`relative overflow-hidden p-8 rounded-3xl border shadow-lg ${isHighContrast ? 'bg-gray-800 border-gray-600' : 'bg-gradient-to-br from-green-900 to-absher-dark text-white border-none'}`}>
             <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
             
             <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-12 bg-white/10 rounded overflow-hidden shadow-inner border border-white/20">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Flag_of_Saudi_Arabia.svg/1200px-Flag_of_Saudi_Arabia.svg.png" className="w-full h-full object-cover opacity-80" alt="KSA Flag" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg tracking-wide">{lang === 'ar-SA' ? 'جواز السفر السعودي' : 'Saudi Passport'}</h3>
                            <p className="text-xs text-white/60 font-light tracking-wider uppercase">Kingdom of Saudi Arabia</p>
                        </div>
                    </div>
                    <div className="bg-green-500/20 backdrop-blur-md border border-green-400/30 text-green-100 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Active
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Passport Number</p>
                        <p className="font-mono text-2xl tracking-widest text-white/90 font-bold shadow-black drop-shadow-md">{data.passport.number}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Expiry Date</p>
                        <p className="font-mono text-2xl tracking-widest text-red-300 font-bold drop-shadow-md">{data.passport.expiry}</p>
                    </div>
                </div>
             </div>
           </div>

           {/* Smart Form */}
           <div className={`p-8 rounded-3xl border shadow-sm ${isHighContrast ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
                 <div className="w-10 h-10 rounded-full bg-absher-light flex items-center justify-center text-absher-green">
                    <i className="fas fa-sync-alt"></i>
                 </div>
                 <h3 className="font-bold text-lg text-gray-800">{lang === 'ar-SA' ? 'طلب تجديد الجواز' : 'Renew Passport Request'}</h3>
              </div>
              
              <div className="space-y-6">
                
                <VoiceInput 
                   label={lang === 'ar-SA' ? 'مدينة الاستلام' : "Select City for Pickup"}
                   value={formData.city || ''}
                   onChange={(e: any) => setFormData({...formData, city: e.target.value})}
                   placeholder={lang === 'ar-SA' ? "مثال: الرياض" : "e.g., Riyadh, Jeddah"}
                   isHighContrast={isHighContrast}
                   onVoiceRequest={() => onVoiceFieldRequest('city')}
                />

                <div>
                   <label className="block text-sm font-bold mb-3 text-gray-700">{lang === 'ar-SA' ? 'مدة الصلاحية' : 'Duration'}</label>
                   <div className="grid grid-cols-2 gap-4">
                      <label className={`relative overflow-hidden p-4 border-2 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-2 transition-all duration-300 group hover:border-absher-green/50 ${formData.duration === '5' ? 'border-absher-green bg-absher-light/30 ring-1 ring-absher-green' : 'border-gray-200'}`}>
                         <input type="radio" name="duration" value="5" className="hidden" checked={formData.duration === '5'} onChange={() => setFormData({...formData, duration: '5'})} />
                         <span className="font-black text-2xl text-gray-800">5 <span className="text-sm font-normal text-gray-500">Years</span></span>
                         <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">300 SAR</span>
                         {formData.duration === '5' && <div className="absolute top-2 right-2 text-absher-green"><i className="fas fa-check-circle"></i></div>}
                      </label>
                      <label className={`relative overflow-hidden p-4 border-2 rounded-xl cursor-pointer flex flex-col items-center justify-center gap-2 transition-all duration-300 group hover:border-absher-green/50 ${formData.duration === '10' ? 'border-absher-green bg-absher-light/30 ring-1 ring-absher-green' : 'border-gray-200'}`}>
                         <input type="radio" name="duration" value="10" className="hidden" checked={formData.duration === '10'} onChange={() => setFormData({...formData, duration: '10'})} />
                         <span className="font-black text-2xl text-gray-800">10 <span className="text-sm font-normal text-gray-500">Years</span></span>
                         <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">600 SAR</span>
                         {formData.duration === '10' && <div className="absolute top-2 right-2 text-absher-green"><i className="fas fa-check-circle"></i></div>}
                      </label>
                   </div>
                </div>

                <div className="pt-4">
                    <button 
                    onClick={onRenew}
                    className="w-full bg-absher-dark text-white font-bold py-4 rounded-xl shadow-lg hover:bg-absher-green transition transform hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                    <span>{lang === 'ar-SA' ? 'متابعة للدفع' : 'Proceed to Payment'}</span>
                    <i className="fas fa-arrow-right"></i>
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-4">
                        <i className="fas fa-lock mr-1"></i> {lang === 'ar-SA' ? 'عملية آمنة ومشفرة' : 'Secure & Encrypted Transaction'}
                    </p>
                </div>
              </div>
           </div>
        </div>

        {/* Helper Sidebar */}
        <div className="md:col-span-4 space-y-6">
             <div className={`p-6 rounded-3xl border ${isHighContrast ? 'bg-gray-800 border-gray-700' : 'bg-blue-50/50 border-blue-100'}`}>
                <h4 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <i className="fas fa-lightbulb text-yellow-500"></i>
                    {lang === 'ar-SA' ? 'تعليمات' : 'Instructions'}
                </h4>
                <ul className="text-sm text-blue-800/80 space-y-4">
                    <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                        <span>Ensure you have a valid national address registered.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                        <span>Old passport must be handed over upon receipt of the new one.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                        <span>Payment must be made through SADAD within 24 hours.</span>
                    </li>
                </ul>
            </div>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ isHighContrast, lang, setLang }: any) => {
    return (
        <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
             <h1 className="text-2xl font-extrabold text-gray-900">{lang === 'ar-SA' ? 'إعدادات المساعد الصوتي' : 'Voice Assistant Settings'}</h1>
             
             <div className={`p-8 rounded-3xl shadow-sm border space-y-8 ${isHighContrast ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                 
                 {/* Voice Speed */}
                 <div className="flex justify-between items-center">
                     <div>
                         <h3 className="font-bold text-lg">{lang === 'ar-SA' ? 'سرعة الصوت' : 'Voice Speed'}</h3>
                         <p className="text-sm text-gray-500">Adjust the speaking rate of the assistant.</p>
                     </div>
                     <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border">
                         <button className="w-8 h-8 rounded bg-white shadow text-gray-600 hover:text-absher-green"><i className="fas fa-minus"></i></button>
                         <span className="font-mono font-bold w-8 text-center">1.0x</span>
                         <button className="w-8 h-8 rounded bg-white shadow text-gray-600 hover:text-absher-green"><i className="fas fa-plus"></i></button>
                     </div>
                 </div>

                 <hr className="border-gray-100" />

                 {/* Voice Verification */}
                 <div className="flex justify-between items-center">
                     <div>
                         <h3 className="font-bold text-lg flex items-center gap-2">
                             {lang === 'ar-SA' ? 'التحقق الصوتي' : 'Voice Verification'}
                             <span className="bg-absher-green/10 text-absher-green text-[10px] px-2 py-0.5 rounded uppercase font-bold">New</span>
                         </h3>
                         <p className="text-sm text-gray-500">Use your voice print to authorize sensitive transactions.</p>
                     </div>
                     <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" name="toggle" id="toggle" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-absher-green left-6" defaultChecked/>
                        <label htmlFor="toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-absher-green cursor-pointer"></label>
                     </div>
                 </div>

                 <hr className="border-gray-100" />

                 {/* Language */}
                 <div className="flex justify-between items-center">
                     <div>
                         <h3 className="font-bold text-lg">{lang === 'ar-SA' ? 'لغة المحادثة' : 'Interaction Language'}</h3>
                         <p className="text-sm text-gray-500">Choose the primary language for voice commands.</p>
                     </div>
                     <div className="flex gap-2">
                         <button onClick={() => setLang('en-US')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${lang === 'en-US' ? 'bg-absher-dark text-white' : 'bg-gray-100 text-gray-600'}`}>English</button>
                         <button onClick={() => setLang('ar-SA')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${lang === 'ar-SA' ? 'bg-absher-dark text-white' : 'bg-gray-100 text-gray-600'}`}>العربية</button>
                     </div>
                 </div>
             </div>
        </div>
    );
};

// --- Main App Container ---

function AbsherApp() {
  const [currentView, setCurrentView] = useState<View>('LOGIN');
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [lang, setLang] = useState<Language>('en-US');
  
  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');
  
  // UI State
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCallback, setVerificationCallback] = useState<() => void>(() => {});
  const [showPulseHint, setShowPulseHint] = useState(true);

  // Data State
  const [mockData, setMockData] = useState(MOCK_DATA);
  const [formData, setFormData] = useState<any>({});
  
  // Specific field focus for voice
  const [activeField, setActiveField] = useState<string | null>(null);
  
  // Speech Recognition Ref
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; 
      recognitionRef.current.interimResults = false;
      
      // Dynamic Language Switching
      recognitionRef.current.lang = lang; 

      recognitionRef.current.onstart = () => setIsListening(true);
      
      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setLastTranscript(transcript);
        setIsListening(false);
        handleVoiceInput(transcript);
        setShowPulseHint(false); // Disable hint after first use
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      console.warn("Speech Recognition not supported in this browser.");
    }
  }, [currentView, mockData, lang, activeField]); 

  // Toggle Listener
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setLastTranscript('');
      setAssistantResponse('');
      // If we are starting fresh, we clear active field context unless triggered by field button
      if (!isListening) setActiveField(null); 
      recognitionRef.current?.start();
    }
  };

  // Field Specific Listener
  const handleFieldVoiceRequest = (fieldName: string) => {
      setActiveField(fieldName);
      setLastTranscript('');
      setAssistantResponse('');
      recognitionRef.current?.start();
  };

  const handleVoiceInput = async (text: string) => {
    setIsProcessing(true);

    // If specific field was active, we bypass full NLU for simple filling
    if (activeField) {
        // Simple logic: just fill the text into the field
        setFormData((prev: any) => ({ ...prev, [activeField]: text }));
        setAssistantResponse(lang === 'ar-SA' ? `تم إدخال: ${text}` : `Filled: ${text}`);
        speakText(lang === 'ar-SA' ? `تم إدخال ${text}` : `Entered ${text}`, lang);
        setIsProcessing(false);
        setActiveField(null);
        return;
    }

    // Context for AI
    const context = {
      view: currentView,
      formData: formData
    };

    // Call Gemini
    const result = await processVoiceCommand(text, context, lang);
    
    setIsProcessing(false);
    setAssistantResponse(result.uiMessage || result.speechResponse);
    
    // Execute Action
    if (result.action === 'LOGIN') {
        setCurrentView('DASHBOARD');
        const welcome = lang === 'ar-SA' ? 'تم تسجيل الدخول بنجاح. مرحباً بك.' : 'Login successful. Welcome back.';
        setAssistantResponse(welcome);
        speakText(welcome, lang);
    }
    if (result.action === 'NAVIGATE_VIOLATIONS') setCurrentView('VIOLATIONS');
    if (result.action === 'NAVIGATE_PASSPORT') setCurrentView('PASSPORT');
    if (result.action === 'NAVIGATE_DASHBOARD') setCurrentView('DASHBOARD');
    if (result.action === 'NAVIGATE_APPOINTMENTS') setCurrentView('APPOINTMENTS');
    if (result.action === 'NAVIGATE_SETTINGS') setCurrentView('SETTINGS');
    
    if (result.action === 'FILL_FORM' && result.formData) {
       setFormData((prev: any) => ({ ...prev, ...result.formData }));
    }

    // Play Voice Response
    if (result.speechResponse && result.action !== 'LOGIN') { // don't double speak on login
       await speakText(result.speechResponse, lang);
    }
  };

  // Trigger Biometric Verification for Sensitive Actions
  const triggerVerification = (callback: () => void) => {
     setVerificationCallback(() => callback);
     setShowVerification(true);
  };

  const onVerificationComplete = () => {
      setShowVerification(false);
      verificationCallback();
  };

  // Mock Payment Function
  const handlePayViolations = () => {
    triggerVerification(() => {
        const newData = { ...mockData };
        newData.violations.forEach(v => v.paid = true);
        setMockData(newData);
        const msg = lang === 'ar-SA' ? "تم التحقق من الهوية. تم السداد بنجاح." : "Identity verified. Payment successful.";
        setAssistantResponse(msg);
        speakText(msg, lang);
    });
  };

  // Mock Renew Function
  const handleRenewPassport = () => {
     // Verify fields
     if (!formData.city || !formData.duration) {
         const msg = lang === 'ar-SA' ? "يرجى اختيار المدينة والمدة أولاً." : "Please select a city and duration first.";
         setAssistantResponse(msg);
         speakText(msg, lang);
         return;
     }

     triggerVerification(() => {
        const msg = lang === 'ar-SA' ? "تم التحقق. تم إنشاء طلب التجديد." : "Verified. Renewal request initiated.";
        setAssistantResponse(msg);
        speakText(msg, lang);
     });
  };

  // Manual Login Handler
  const handleLogin = () => {
      setCurrentView('DASHBOARD');
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-absher-green selection:text-white ${isHighContrast ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {showVerification && <BiometricVerificationOverlay lang={lang} onComplete={onVerificationComplete} />}

      {currentView === 'LOGIN' ? (
          <LoginView lang={lang} onLogin={handleLogin} isHighContrast={isHighContrast} />
      ) : (
          <>
            <Header 
                user={USER_NAME_EN} 
                toggleContrast={() => setIsHighContrast(!isHighContrast)} 
                isHighContrast={isHighContrast} 
                lang={lang}
                setLang={setLang}
                notifications={mockData.notifications}
            />
            
            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar 
                currentView={currentView} 
                setView={setCurrentView} 
                isHighContrast={isHighContrast} 
                lang={lang}
                />
                
                <main className="flex-1 overflow-y-auto relative scroll-smooth">
                <div className="max-w-7xl mx-auto p-6 md:p-10 pb-32">
                    {currentView === 'DASHBOARD' && <DashboardView isHighContrast={isHighContrast} data={mockData} lang={lang} />}
                    {currentView === 'VIOLATIONS' && <ViolationsView isHighContrast={isHighContrast} data={mockData} onPay={handlePayViolations} lang={lang} />}
                    {currentView === 'PASSPORT' && <PassportView isHighContrast={isHighContrast} data={mockData} onRenew={handleRenewPassport} formData={formData} setFormData={setFormData} onVoiceFieldRequest={handleFieldVoiceRequest} lang={lang} />}
                    {currentView === 'SETTINGS' && <SettingsView isHighContrast={isHighContrast} lang={lang} setLang={setLang} />}
                    {currentView === 'APPOINTMENTS' && (
                        <div className="flex flex-col items-center justify-center h-full py-32 opacity-60">
                        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-4xl text-gray-400">
                            <i className="fas fa-calendar-times"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">{lang === 'ar-SA' ? 'لا توجد مواعيد' : 'No Appointments'}</h2>
                        <p className="text-gray-500">{lang === 'ar-SA' ? 'ليس لديك أي مواعيد قادمة.' : 'You have no upcoming appointments scheduled.'}</p>
                        </div>
                    )}
                </div>
                </main>

                <VoiceFloatingAction 
                    isListening={isListening}
                    isProcessing={isProcessing}
                    lastTranscript={lastTranscript}
                    assistantResponse={assistantResponse}
                    onMicClick={toggleListening}
                    isHighContrast={isHighContrast}
                    lang={lang}
                    showPulseHint={showPulseHint && currentView === 'DASHBOARD'}
                />
            </div>
          </>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<AbsherApp />);