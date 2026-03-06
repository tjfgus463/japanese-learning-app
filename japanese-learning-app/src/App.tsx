/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  ChevronRight,
  RotateCcw,
  Sparkles,
  MessageCircle,
  Gamepad2,
  Trophy,
  Share2,
  Settings,
  Key,
  X,
  Flame,
  Calendar as CalendarIcon,
  Target,
  History,
  Home,
  Lightbulb,
  BookmarkPlus,
  Trash2,
  PlayCircle
} from 'lucide-react';
import { translateAndTokenize } from './services/geminiService';
import { scenarioService } from './services/supabaseClient';
import { Token, JapaneseSentence, GameStatus, ReviewItem } from './types';

interface ProgressData {
  streak: number;
  lastDate: string;
  history: { [date: string]: number };
  dailyGoal: number;
  reviewList: ReviewItem[];
  completedScenarios: number[];
}

declare global {
  interface Window {
    Kakao: any;
  }
}

// Character Avatar URL - Using a cuter, more stylized character
const CHARACTER_AVATAR = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png"; // Pikachu as a placeholder for "cute", or I'll find a better one. 
// Actually, let's use a cute anime girl illustration from a stable source.
const CUTE_CHARACTER = "https://images.unsplash.com/photo-1578632292335-df3abbb0d586?auto=format&fit=crop&q=80&w=200&h=200";

export default function App() {
  const [inputText, setInputText] = useState('');
  const [sentence, setSentence] = useState<JapaneseSentence | null>(null);
  const [shuffledTokens, setShuffledTokens] = useState<Token[]>([]);
  // Changed to fixed-length array with nulls
  const [selectedTokens, setSelectedTokens] = useState<(Token | null)[]>([]);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<(boolean | null)[]>([]);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [isSharedQuiz, setIsSharedQuiz] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customKey, setCustomKey] = useState(localStorage.getItem('custom_gemini_api_key') || "");
  const [currentScenarioId, setCurrentScenarioId] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [view, setView] = useState<'home' | 'learn' | 'review'>('home');
  const [hintUsed, setHintUsed] = useState(false);
  
  // Progress State
  const [progress, setProgress] = useState<ProgressData>(() => {
    const saved = localStorage.getItem('kotoba_progress');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        streak: parsed.streak || 0,
        lastDate: parsed.lastDate || '',
        history: parsed.history || {},
        dailyGoal: parsed.dailyGoal || 5,
        reviewList: parsed.reviewList || [],
        completedScenarios: parsed.completedScenarios || []
      };
    }
    return {
      streak: 0,
      lastDate: '',
      history: {},
      dailyGoal: 5,
      reviewList: [],
      completedScenarios: []
    };
  });

  // Save progress to localStorage
  useEffect(() => {
    localStorage.setItem('kotoba_progress', JSON.stringify(progress));
  }, [progress]);

  // Check streak on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (progress.lastDate && progress.lastDate !== today && progress.lastDate !== yesterday) {
      // Streak broken
      setProgress(prev => ({ ...prev, streak: 0 }));
    }
  }, []);

  // Fetch scenarios on mount and check for deep links
  useEffect(() => {
    scenarioService.getScenarios()
      .then(data => setScenarios(data))
      .catch(err => console.error("Failed to fetch scenarios", err));

    // Check for deep link parameters
    const params = new URLSearchParams(window.location.search);
    const scenarioId = params.get('sid');
    const korean = params.get('k');
    const japanese = params.get('j');
    const tokensStr = params.get('t');

    if (scenarioId) {
      // Method 1: ID-based sharing
      setStatus(GameStatus.LOADING);
      scenarioService.getScenarioById(scenarioId)
        .then(data => {
          if (!data) throw new Error("Not found");
          
          const sharedSentence: JapaneseSentence = {
            original: data.korean,
            translated: data.japanese,
            tokens: data.tokens
          };
          
          setIsSharedQuiz(true);
          setSentence(sharedSentence);
          setCurrentScenarioId(Number(scenarioId));
          setSelectedTokens(new Array(data.tokens.length).fill(null));
          setValidationResults(new Array(data.tokens.length).fill(null));
          
          const shuffled = [...data.tokens].sort(() => Math.random() - 0.5);
          setShuffledTokens(shuffled);
          setStatus(GameStatus.PLAYING);
        })
        .catch(err => {
          console.error("Failed to load shared scenario", err);
          setError("공유된 퀴즈를 불러오지 못했습니다.");
          setStatus(GameStatus.ERROR);
        });
    } else if (korean && japanese && tokensStr) {
      // Fallback: Legacy URL-based sharing (for compatibility)
      try {
        const tokens = JSON.parse(decodeURIComponent(tokensStr));
        const sharedSentence: JapaneseSentence = {
          original: korean,
          translated: japanese,
          tokens: tokens
        };
        
        setIsSharedQuiz(true);
        setSentence(sharedSentence);
        setSelectedTokens(new Array(tokens.length).fill(null));
        setValidationResults(new Array(tokens.length).fill(null));
        
        const shuffled = [...tokens].sort(() => Math.random() - 0.5);
        setShuffledTokens(shuffled);
        setStatus(GameStatus.PLAYING);
      } catch (e) {
        console.error("Failed to parse shared quiz", e);
      }
    }
  }, []);

  useEffect(() => {
    const loadScript = () => {
      if (!document.getElementById('kakao-sdk')) {
        const script = document.createElement('script');
        script.id = 'kakao-sdk';
        script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js';
        script.onload = () => initKakao();
        document.head.appendChild(script);
      }
    };

    const initKakao = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
        if (kakaoKey) {
          window.Kakao.init(kakaoKey);
          console.log("Kakao SDK initialized");
        }
      }
    };

    loadScript();
    initKakao();

    const interval = setInterval(() => {
      initKakao();
      if (window.Kakao && window.Kakao.isInitialized()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleStartGame = async (text: string, existingId?: number) => {
    if (!text.trim()) return;
    
    setStatus(GameStatus.LOADING);
    setError(null);
    setValidationResults([]);
    setHintUsed(false);
    
    try {
      const result = await translateAndTokenize(text);
      setSentence(result);
      
      if (existingId) {
        setCurrentScenarioId(existingId);
      } else {
        // Save to scenarios database automatically and get ID
        const saveData = await scenarioService.addScenario({
          korean: result.original,
          japanese: result.translated,
          tokens: result.tokens,
          level: 5,
          category: '나의 문장'
        });
        
        if (saveData.id) {
          setCurrentScenarioId(saveData.id);
        }
      }

      // Refresh scenarios list
      scenarioService.getScenarios()
        .then(data => setScenarios(data))
        .catch(err => console.error("Failed to refresh scenarios", err));

      // Initialize empty slots
      setSelectedTokens(new Array(result.tokens.length).fill(null));
      setValidationResults(new Array(result.tokens.length).fill(null));
      
      const shuffled = [...result.tokens].sort(() => Math.random() - 0.5);
      setShuffledTokens(shuffled);
      setStatus(GameStatus.PLAYING);
    } catch (err) {
      console.error(err);
      setError("번역 중 오류가 발생했습니다. 다시 시도해주세요.");
      setStatus(GameStatus.ERROR);
    }
  };

  const handleTokenClick = (token: Token) => {
    if (status !== GameStatus.PLAYING) return;
    
    // Find first empty slot
    const firstEmptyIndex = selectedTokens.indexOf(null);
    if (firstEmptyIndex === -1) return; // All slots full

    const newSelected = [...selectedTokens];
    newSelected[firstEmptyIndex] = token;
    setSelectedTokens(newSelected);
    
    setShuffledTokens(prev => prev.filter(t => t.id !== token.id));
    
    // Reset validation for this slot
    const newValidation = [...validationResults];
    newValidation[firstEmptyIndex] = null;
    setValidationResults(newValidation);
  };

  const handleRemoveToken = (index: number) => {
    if (status !== GameStatus.PLAYING) return;
    const token = selectedTokens[index];
    if (!token) return;

    const newSelected = [...selectedTokens];
    newSelected[index] = null;
    setSelectedTokens(newSelected);
    
    setShuffledTokens(prev => [...prev, token]);
    
    // Reset validation for this slot
    const newValidation = [...validationResults];
    newValidation[index] = null;
    setValidationResults(newValidation);
  };

  const checkAnswer = () => {
    if (!sentence) return;
    
    const newValidation = selectedTokens.map((token, index) => {
      if (!token) return false;
      return token.text === sentence.tokens[index].text;
    });
    
    setValidationResults(newValidation);
    
    const allCorrect = newValidation.every(v => v === true);
    if (allCorrect) {
      setStatus(GameStatus.COMPLETED);
      updateProgress();
    }
  };

  const useHint = () => {
    if (!sentence || status !== GameStatus.PLAYING || hintUsed) return;
    
    const firstEmptyIndex = selectedTokens.indexOf(null);
    if (firstEmptyIndex === -1) return;

    const correctToken = sentence.tokens[firstEmptyIndex];
    const tokenInPool = shuffledTokens.find(t => t.id === correctToken.id);
    
    if (tokenInPool) {
      handleTokenClick(tokenInPool);
      setHintUsed(true);
    }
  };

  const addToReview = () => {
    if (!sentence) return;
    const newItem: ReviewItem = {
      id: Date.now(),
      korean: sentence.original,
      japanese: sentence.translated,
      tokens: sentence.tokens,
      addedAt: new Date().toISOString()
    };
    
    setProgress(prev => ({
      ...prev,
      reviewList: [newItem, ...(prev.reviewList || []).filter(item => item.korean !== newItem.korean)]
    }));
    alert("단어장에 저장되었습니다! ♡");
  };

  const removeFromReview = (id: number | string) => {
    setProgress(prev => ({
      ...prev,
      reviewList: (prev.reviewList || []).filter(item => item.id !== id)
    }));
  };

  const updateProgress = () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    setProgress(prev => {
      const newHistory = { ...prev.history };
      newHistory[today] = (newHistory[today] || 0) + 1;
      
      let newStreak = prev.streak;
      if (prev.lastDate === yesterday) {
        newStreak += 1;
      } else if (prev.lastDate !== today) {
        newStreak = 1;
      }

      const newCompleted = [...(prev.completedScenarios || [])];
      if (currentScenarioId && !newCompleted.includes(currentScenarioId)) {
        newCompleted.push(currentScenarioId);
      }
      
      return {
        ...prev,
        streak: newStreak,
        lastDate: today,
        history: newHistory,
        completedScenarios: newCompleted
      };
    });
  };

  const resetGame = () => {
    if (isSharedQuiz && sentence) {
      // For shared quizzes, just reshuffle and restart the same quiz
      setSelectedTokens(new Array(sentence.tokens.length).fill(null));
      setValidationResults(new Array(sentence.tokens.length).fill(null));
      const shuffled = [...sentence.tokens].sort(() => Math.random() - 0.5);
      setShuffledTokens(shuffled);
      setStatus(GameStatus.PLAYING);
      return;
    }

    setStatus(GameStatus.IDLE);
    setInputText('');
    setSentence(null);
    setSelectedTokens([]);
    setShuffledTokens([]);
    setValidationResults([]);
    setError(null);
    setIsSharedQuiz(false);
    // Clear URL params if any
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.origin);
    }
  };

  const shareToKakao = () => {
    if (!window.Kakao) {
      const scriptExists = !!document.getElementById('kakao-sdk');
      alert(`카카오 SDK를 불러오는 중입니다. (스크립트 존재: ${scriptExists}) 잠시 후 다시 시도해주세요.`);
      return;
    }
    
    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;
    if (!kakaoKey) {
      alert("카카오 공유를 위해 VITE_KAKAO_JS_KEY 설정이 필요합니다.");
      return;
    }

    // Construct deep link URL
    let shareUrl = `${window.location.origin}`;
    if (currentScenarioId) {
      shareUrl += `?sid=${currentScenarioId}`;
    } else {
      // Fallback to legacy URL-based sharing if ID is missing
      const tokensStr = encodeURIComponent(JSON.stringify(sentence?.tokens));
      shareUrl += `?k=${encodeURIComponent(sentence?.original || '')}&j=${encodeURIComponent(sentence?.translated || '')}&t=${tokensStr}`;
    }

    try {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(kakaoKey);
      }

      console.log("Sharing to Kakao with Deep Link URL:", shareUrl);
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: 'Kotoba Master - 일본어 퀴즈',
          description: `"${sentence?.original}" 이 문장을 일본어로 맞췄어요! 같이 공부해요! ♡`,
          imageUrl: CUTE_CHARACTER,
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
        buttons: [
          {
            title: '퀴즈 풀러 가기',
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
        ],
      });
    } catch (err) {
      console.error("Kakao share error:", err);
      alert("카카오 공유 중 오류가 발생했습니다.");
    }
  };

  const saveCustomKey = () => {
    localStorage.setItem('custom_gemini_api_key', customKey);
    setShowSettings(false);
    alert("API 키가 저장되었습니다! ♡");
  };

  const getCalendarDays = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const dailyCount = progress.history[todayStr] || 0;
  const progressPercent = Math.min(100, (dailyCount / progress.dailyGoal) * 100);

  return (
    <div className="min-h-screen bg-[#fff9f0] text-[#1a1a1a] font-sans">
      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl border-2 border-pink-50"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                  <Settings className="text-pink-500" /> 설정
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-pink-50/50 rounded-2xl border border-pink-100">
                  <p className="text-xs font-bold text-pink-600 flex items-center gap-2">
                    <CheckCircle2 size={14} /> 
                    {customKey ? "본인의 API 키를 사용 중입니다." : "서버 기본 API 키를 사용 중입니다."}
                  </p>
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-pink-400 uppercase tracking-wider mb-2">Gemini API Key</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300" size={20} />
                    <input 
                      type="password"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="API 키를 입력해주세요"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-pink-50/30 border-2 border-transparent focus:border-pink-200 focus:ring-0 font-bold"
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400 leading-relaxed">
                    * 공유용 주소에서 번역이 안 될 경우 본인의 API 키를 입력해 보세요.<br/>
                    * 입력한 키는 브라우저에만 안전하게 저장됩니다.
                  </p>
                </div>
                
                <button 
                  onClick={saveCustomKey}
                  className="w-full py-4 bg-pink-500 text-white rounded-2xl text-lg font-black shadow-lg shadow-pink-100 hover:bg-pink-600 transition-all active:scale-95"
                >
                  저장하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto min-h-screen flex flex-col">
        
        {/* Top Navigation */}
        <nav className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-100">
                <Sparkles size={24} />
              </div>
              <div>
                <h1 className="font-black text-lg leading-tight text-pink-600">Kotoba Master</h1>
                <p className="text-[10px] text-pink-300 uppercase tracking-widest font-bold">Cute Edition</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-orange-50 rounded-2xl border-2 border-orange-100 shadow-sm flex items-center gap-2">
                <Flame size={16} className="text-orange-500 fill-orange-500" />
                <span className="text-sm font-black text-orange-600">{progress.streak}</span>
              </div>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2.5 bg-pink-50 border-2 border-pink-200 rounded-2xl text-pink-500 hover:bg-pink-100 transition-all active:scale-95 shadow-sm"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>

          {/* Daily Mission Progress Bar */}
          <div className="bg-white rounded-2xl p-4 border-2 border-pink-50 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-pink-400" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">오늘의 목표</span>
              </div>
              <span className="text-xs font-black text-pink-500">{dailyCount} / {progress.dailyGoal}</span>
            </div>
            <div className="w-full h-3 bg-pink-50 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="h-full bg-gradient-to-r from-pink-400 to-pink-500"
              />
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 px-6 pb-32">
          
          {view === 'home' ? (
            <>
              {/* Character Dialogue Section */}
              <div className="mb-8 relative pt-12">
                <div className="flex items-end gap-4">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl flex-shrink-0 bg-pink-100 ring-4 ring-pink-50"
                  >
                    <img src={CUTE_CHARACTER} alt="Character" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </motion.div>
                  
                  <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex-1 bg-white rounded-3xl rounded-bl-none p-5 shadow-sm border-2 border-pink-50 relative"
                  >
                    <div className="absolute -left-2 bottom-2 w-4 h-4 bg-white transform rotate-45 border-l-2 border-b-2 border-pink-50"></div>
                    <p className="text-xs font-black text-pink-400 mb-1 uppercase tracking-wider">Hana-chan</p>
                    <div className="text-lg font-bold leading-snug text-gray-700">
                      {status === GameStatus.IDLE && (
                        dailyCount >= progress.dailyGoal 
                          ? "오늘 목표를 다 채웠어! 대단해! (๑>ᴗ<๑)" 
                          : `안녕! 오늘 ${progress.dailyGoal - dailyCount}개만 더 하면 목표 달성이야! ♡`
                      )}
                      {status === GameStatus.LOADING && "잠깐만! 내가 열심히 분석하고 있어! ✧"}
                      {status === GameStatus.PLAYING && "틀린 단어는 빨간색으로 표시될 거야! 클릭해서 빼고 다시 맞춰봐! 화이팅! ٩(ˊᗜˋ*)و"}
                      {status === GameStatus.COMPLETED && "대박! 완벽해! 너 정말 천재구나? (≧∇≦)b"}
                      {status === GameStatus.ERROR && "미안해... 내가 실수했나 봐. 다시 해볼까? (´;ω;`)"}
                    </div>
                  </motion.div>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {/* IDLE State */}
                {status === GameStatus.IDLE && (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    {!isSharedQuiz && (
                      <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-pink-50">
                        <div className="relative">
                          <textarea 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="배우고 싶은 문장을 적어줘! ♡"
                            className="w-full px-6 py-5 rounded-2xl bg-pink-50/30 border-2 border-transparent focus:border-pink-200 focus:ring-0 text-lg transition-all min-h-[120px] resize-none font-bold placeholder:text-pink-200"
                          />
                          <button 
                            onClick={() => handleStartGame(inputText)}
                            disabled={!inputText.trim()}
                            className="absolute right-3 bottom-3 p-4 bg-pink-500 text-white rounded-2xl shadow-lg shadow-pink-200 hover:bg-pink-600 disabled:opacity-50 transition-all active:scale-95"
                          >
                            <Send size={24} />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="text-[10px] font-black text-pink-300 uppercase tracking-[0.2em]">
                          추천 시나리오
                        </h3>
                        <div className="flex gap-1 bg-pink-50/50 p-1 rounded-xl border border-pink-100">
                          {[1, 2, 3, 4, 5].map((lv) => (
                            <button
                              key={lv}
                              onClick={() => setSelectedLevel(lv)}
                              className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                                selectedLevel === lv 
                                  ? 'bg-pink-500 text-white shadow-sm' 
                                  : 'text-pink-300 hover:text-pink-500'
                              }`}
                            >
                              {lv === 5 ? 'MY' : `LV.${lv}`}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        {scenarios
                          .filter(s => s.level === selectedLevel)
                          .map((s) => {
                            const isCompleted = progress.completedScenarios?.includes(s.id);
                            return (
                              <button 
                                key={s.id}
                                onClick={() => handleStartGame(s.korean, s.id)}
                                className={`flex items-center justify-between p-5 rounded-3xl border-2 transition-all text-left group ${isCompleted ? 'bg-pink-50/30 border-pink-100' : 'bg-white border-pink-50 hover:border-pink-200 hover:shadow-md'}`}
                              >
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${isCompleted ? 'bg-pink-200 text-white' : 'bg-pink-50 text-pink-400 group-hover:bg-pink-500 group-hover:text-white'}`}>
                                    {isCompleted ? <CheckCircle2 size={20} /> : <MessageCircle size={20} />}
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="px-2 py-0.5 bg-pink-100 text-pink-500 text-[8px] font-black rounded-full uppercase">LV.{s.level}</span>
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[8px] font-black rounded-full uppercase">{s.category}</span>
                                      {isCompleted && <span className="text-[8px] font-black text-pink-400 uppercase tracking-tighter">Completed!</span>}
                                    </div>
                                    <span className={`font-black ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>{s.korean}</span>
                                  </div>
                                </div>
                                <ChevronRight size={18} className={`${isCompleted ? 'text-pink-200' : 'text-pink-100 group-hover:text-pink-400'}`} />
                              </button>
                            );
                          })}
                        {scenarios.filter(s => s.level === selectedLevel).length === 0 && (
                          <div className="py-12 text-center bg-white rounded-3xl border-2 border-dashed border-pink-100">
                            <p className="text-pink-200 font-bold">이 레벨의 시나리오가 아직 없어요! ♡</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ERROR State */}
                {status === GameStatus.ERROR && (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col items-center gap-6"
                  >
                    <div className="bg-white rounded-[40px] p-8 border-2 border-red-100 text-center w-full">
                      <XCircle size={48} className="text-red-400 mx-auto mb-4" />
                      <p className="text-gray-600 font-bold mb-6">{error || "알 수 없는 오류가 발생했습니다."}</p>
                      <button 
                        onClick={resetGame}
                        className="w-full py-4 bg-pink-500 text-white rounded-[30px] text-xl font-black shadow-lg shadow-pink-100 hover:bg-pink-600 transition-all active:scale-95"
                      >
                        {isSharedQuiz ? "다시 도전하기!" : "처음으로 돌아가기"}
                      </button>
                    </div>

                    {/* Show Recommended Scenarios in Shared Quiz after error */}
                    {isSharedQuiz && (
                      <div className="space-y-4 mt-12 w-full">
                        <div className="flex items-center justify-between px-2">
                          <h3 className="text-[10px] font-black text-pink-300 uppercase tracking-[0.2em]">
                            다른 추천 시나리오 도전하기
                          </h3>
                          <div className="flex gap-1 bg-pink-50/50 p-1 rounded-xl border border-pink-100">
                            {[1, 2, 3, 4, 5].map((lv) => (
                              <button
                                key={lv}
                                onClick={() => setSelectedLevel(lv)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                                  selectedLevel === lv 
                                    ? 'bg-pink-500 text-white shadow-sm' 
                                    : 'text-pink-300 hover:text-pink-500'
                                }`}
                              >
                                {lv === 5 ? 'MY' : `LV.${lv}`}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {scenarios
                            .filter(s => s.level === selectedLevel)
                            .map((s) => {
                              const isCompleted = progress.completedScenarios?.includes(s.id);
                              return (
                                <button 
                                  key={s.id}
                                  onClick={() => handleStartGame(s.korean, s.id)}
                                  className={`flex items-center justify-between p-5 rounded-3xl border-2 transition-all text-left group ${isCompleted ? 'bg-pink-50/30 border-pink-100' : 'bg-white border-pink-50 hover:border-pink-200 hover:shadow-md'}`}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${isCompleted ? 'bg-pink-200 text-white' : 'bg-pink-50 text-pink-400 group-hover:bg-pink-500 group-hover:text-white'}`}>
                                      {isCompleted ? <CheckCircle2 size={20} /> : <MessageCircle size={20} />}
                                    </div>
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-pink-100 text-pink-500 text-[8px] font-black rounded-full uppercase">LV.{s.level}</span>
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[8px] font-black rounded-full uppercase">{s.category}</span>
                                        {isCompleted && <span className="text-[8px] font-black text-pink-400 uppercase tracking-tighter">Completed!</span>}
                                      </div>
                                      <span className={`font-black ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>{s.korean}</span>
                                    </div>
                                  </div>
                                  <ChevronRight size={18} className={`${isCompleted ? 'text-pink-200' : 'text-pink-100 group-hover:text-pink-400'}`} />
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* PLAYING/COMPLETED State */}
                {(status === GameStatus.PLAYING || status === GameStatus.COMPLETED) && sentence && (
                  <motion.div 
                    key="playing"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                  >
                    {/* Target Sentence */}
                    <div className="bg-white rounded-[40px] p-8 shadow-sm border-2 border-pink-50 text-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-pink-100"></div>
                      <span className="text-[10px] font-black text-pink-300 uppercase tracking-widest mb-3 block">Korean</span>
                      <h2 className="text-3xl font-black text-gray-800">{sentence.original}</h2>
                      
                      {status === GameStatus.COMPLETED && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-8 pt-8 border-t-2 border-pink-50"
                        >
                          <div className="flex flex-wrap justify-center gap-x-6 gap-y-8 items-end">
                            {sentence.tokens.map((token, i) => (
                              <div key={i} className="flex flex-col items-center">
                                {token.furigana && /[\u4E00-\u9FAF]/.test(token.text) && (
                                  <span className="text-sm text-pink-500 font-black mb-0.5">
                                    {token.furigana}
                                  </span>
                                )}
                                <span className="text-3xl font-black text-gray-800 border-b-4 border-pink-100 pb-1">
                                  {token.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Answer Slots */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-3 justify-center">
                        {selectedTokens.map((token, index) => {
                          const isIncorrect = validationResults[index] === false;
                          return (
                            <motion.button
                              key={index}
                              layout
                              onClick={() => handleRemoveToken(index)}
                              disabled={status === GameStatus.COMPLETED}
                              className={`
                                min-w-[60px] min-h-[60px] px-5 py-3 rounded-2xl font-black text-xl transition-all flex items-center justify-center
                                ${token 
                                  ? `bg-white shadow-md border-2 ${isIncorrect ? 'border-red-400 text-red-500 animate-shake' : 'border-pink-50 text-gray-700'}` 
                                  : 'bg-pink-50/30 border-2 border-dashed border-pink-100 text-transparent'
                                }
                                ${!token && status === GameStatus.PLAYING ? 'hover:bg-pink-50' : ''}
                              `}
                            >
                              {token?.text || ""}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Word Pool */}
                    {status === GameStatus.PLAYING && (
                      <div className="bg-white/50 rounded-[40px] p-8 border-2 border-pink-50">
                        <div className="flex flex-wrap justify-center gap-3">
                          <AnimatePresence mode="popLayout">
                            {shuffledTokens.map((token) => (
                              <motion.button
                                layout
                                key={token.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ y: -5, scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleTokenClick(token)}
                                className="px-6 py-4 bg-white rounded-2xl shadow-sm border-2 border-pink-50 text-xl font-black text-gray-600 hover:shadow-xl hover:border-pink-200 transition-all"
                              >
                                {token.text}
                              </motion.button>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col items-center gap-6 pt-4">
                      {status === GameStatus.PLAYING && (
                        <div className="w-full flex gap-3">
                          <button 
                            onClick={checkAnswer}
                            disabled={selectedTokens.every(t => t === null)}
                            className="flex-1 py-6 bg-pink-500 text-white rounded-[30px] text-2xl font-black shadow-xl shadow-pink-200 hover:bg-pink-600 disabled:opacity-50 transition-all flex items-center justify-center gap-3 active:scale-95"
                          >
                            정답 확인! (๑•̀ㅂ•́)و
                            <ChevronRight size={28} />
                          </button>
                          <button 
                            onClick={useHint}
                            disabled={hintUsed}
                            className={`p-6 rounded-[30px] shadow-xl transition-all active:scale-95 ${hintUsed ? 'bg-gray-100 text-gray-300' : 'bg-amber-400 text-white shadow-amber-100 hover:bg-amber-500'}`}
                            title="힌트 사용"
                          >
                            <Lightbulb size={28} />
                          </button>
                        </div>
                      )}

                      {status === GameStatus.COMPLETED && (
                        <div className="w-full flex flex-col gap-3">
                          <div className="flex gap-3">
                            <button 
                              onClick={resetGame}
                              className="flex-1 py-6 bg-white border-4 border-pink-500 text-pink-500 rounded-[30px] text-2xl font-black hover:bg-pink-50 transition-all flex items-center justify-center gap-3 active:scale-95"
                            >
                              <RotateCcw size={28} />
                              {isSharedQuiz ? "다시 도전하기!" : "다음 단계로!"}
                            </button>
                            <button 
                              onClick={addToReview}
                              className="p-6 bg-pink-50 text-pink-500 border-4 border-pink-100 rounded-[30px] hover:bg-pink-100 transition-all active:scale-95"
                              title="단어장에 저장"
                            >
                              <BookmarkPlus size={28} />
                            </button>
                          </div>
                          {!isSharedQuiz && (
                            <button 
                              onClick={shareToKakao}
                              className="w-full py-4 bg-[#FEE500] text-[#191919] rounded-[30px] text-lg font-black hover:bg-[#FADA0A] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-yellow-100"
                            >
                              <Share2 size={24} />
                              카톡방에 공유하기
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Show Recommended Scenarios in Shared Quiz after completion */}
                    {isSharedQuiz && status === GameStatus.COMPLETED && (
                      <div className="space-y-4 mt-12">
                        <div className="flex items-center justify-between px-2">
                          <h3 className="text-[10px] font-black text-pink-300 uppercase tracking-[0.2em]">
                            다른 추천 시나리오 도전하기
                          </h3>
                          <div className="flex gap-1 bg-pink-50/50 p-1 rounded-xl border border-pink-100">
                            {[1, 2, 3, 4, 5].map((lv) => (
                              <button
                                key={lv}
                                onClick={() => setSelectedLevel(lv)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                                  selectedLevel === lv 
                                    ? 'bg-pink-500 text-white shadow-sm' 
                                    : 'text-pink-300 hover:text-pink-500'
                                }`}
                              >
                                {lv === 5 ? 'MY' : `LV.${lv}`}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {scenarios
                            .filter(s => s.level === selectedLevel)
                            .map((s) => {
                              const isCompleted = progress.completedScenarios?.includes(s.id);
                              return (
                                <button 
                                  key={s.id}
                                  onClick={() => handleStartGame(s.korean, s.id)}
                                  className={`flex items-center justify-between p-5 rounded-3xl border-2 transition-all text-left group ${isCompleted ? 'bg-pink-50/30 border-pink-100' : 'bg-white border-pink-50 hover:border-pink-200 hover:shadow-md'}`}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${isCompleted ? 'bg-pink-200 text-white' : 'bg-pink-50 text-pink-400 group-hover:bg-pink-500 group-hover:text-white'}`}>
                                      {isCompleted ? <CheckCircle2 size={20} /> : <MessageCircle size={20} />}
                                    </div>
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-pink-100 text-pink-500 text-[8px] font-black rounded-full uppercase">LV.{s.level}</span>
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[8px] font-black rounded-full uppercase">{s.category}</span>
                                        {isCompleted && <span className="text-[8px] font-black text-pink-400 uppercase tracking-tighter">Completed!</span>}
                                      </div>
                                      <span className={`font-black ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>{s.korean}</span>
                                    </div>
                                  </div>
                                  <ChevronRight size={18} className={`${isCompleted ? 'text-pink-200' : 'text-pink-100 group-hover:text-pink-400'}`} />
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : view === 'learn' ? (
            <motion.div 
              key="learn"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-[40px] p-8 shadow-sm border-2 border-pink-50">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                    <CalendarIcon className="text-pink-500" /> 학습 캘린더
                  </h2>
                  <div className="px-4 py-2 bg-pink-50 rounded-2xl border border-pink-100">
                    <span className="text-sm font-black text-pink-500">
                      {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                    <div key={d} className="text-center text-[10px] font-black text-pink-300 uppercase">{d}</div>
                  ))}
                  {getCalendarDays().map((day, i) => {
                    if (day === null) return <div key={`empty-${i}`} />;
                    
                    const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const studied = progress.history[dateStr] > 0;
                    const isToday = day === new Date().getDate();
                    
                    return (
                      <div 
                        key={day} 
                        className={`
                          aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all
                          ${studied ? 'bg-pink-100 border-2 border-pink-200' : 'bg-gray-50 border-2 border-transparent'}
                          ${isToday ? 'ring-2 ring-pink-500 ring-offset-2' : ''}
                        `}
                      >
                        <span className={`text-[10px] font-black ${studied ? 'text-pink-600' : 'text-gray-300'}`}>{day}</span>
                        {studied && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <img src={CUTE_CHARACTER} className="w-6 h-6 object-cover rounded-full border border-white shadow-sm opacity-80" referrerPolicy="no-referrer" />
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-pink-50/50 rounded-2xl border border-pink-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <History className="text-pink-500" size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-pink-600">꾸준함이 실력입니다!</p>
                    <p className="text-[10px] text-pink-300 font-bold">Hana-chan 도장을 모아보세요 ♡</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl p-6 border-2 border-pink-50 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="text-orange-500" size={16} />
                    <span className="text-[10px] font-black text-gray-400 uppercase">최대 스트릭</span>
                  </div>
                  <p className="text-3xl font-black text-gray-800">{progress.streak}일</p>
                </div>
                <div className="bg-white rounded-3xl p-6 border-2 border-pink-50 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="text-green-500" size={16} />
                    <span className="text-[10px] font-black text-gray-400 uppercase">총 학습 문장</span>
                  </div>
                  <p className="text-3xl font-black text-gray-800">
                    {Object.values(progress.history).reduce((a: number, b: number) => a + b, 0)}개
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                  <BookOpen className="text-pink-500" /> 나만의 단어장
                </h2>
                <span className="text-xs font-black text-pink-400">{(progress.reviewList || []).length}개의 문장</span>
              </div>

              <div className="space-y-3">
                {(progress.reviewList || []).map((item) => (
                  <div 
                    key={item.id}
                    className="bg-white rounded-3xl p-5 border-2 border-pink-50 shadow-sm flex items-center justify-between group"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-black text-pink-400 mb-1">{new Date(item.addedAt).toLocaleDateString()}</p>
                      <h3 className="text-lg font-black text-gray-700 mb-1">{item.korean}</h3>
                      <p className="text-sm font-bold text-gray-400">{item.japanese}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          const sentence: JapaneseSentence = {
                            original: item.korean,
                            translated: item.japanese,
                            tokens: item.tokens
                          };
                          setSentence(sentence);
                          setSelectedTokens(new Array(item.tokens.length).fill(null));
                          setValidationResults(new Array(item.tokens.length).fill(null));
                          const shuffled = [...item.tokens].sort(() => Math.random() - 0.5);
                          setShuffledTokens(shuffled);
                          setStatus(GameStatus.PLAYING);
                          setView('home');
                        }}
                        className="p-3 bg-pink-50 text-pink-500 rounded-2xl hover:bg-pink-500 hover:text-white transition-all"
                        title="다시 풀기"
                      >
                        <PlayCircle size={20} />
                      </button>
                      <button 
                        onClick={() => removeFromReview(item.id)}
                        className="p-3 bg-red-50 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                        title="삭제"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
                {(progress.reviewList || []).length === 0 && (
                  <div className="py-20 text-center bg-white rounded-[40px] border-2 border-dashed border-pink-100">
                    <p className="text-pink-200 font-bold mb-2">아직 저장된 문장이 없어요!</p>
                    <p className="text-[10px] text-pink-200 uppercase tracking-widest font-black">문장을 풀고 북마크 아이콘을 눌러보세요 ♡</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </main>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 p-6 pointer-events-none">
          <div className="max-w-md mx-auto bg-white/80 backdrop-blur-xl rounded-[32px] p-2 shadow-2xl border-2 border-pink-50 flex gap-2 pointer-events-auto">
            <button 
              onClick={() => setView('home')}
              className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${view === 'home' ? 'bg-pink-500 text-white shadow-lg shadow-pink-200' : 'text-pink-300 hover:bg-pink-50'}`}
            >
              <Home size={24} />
              <span className="text-[10px] font-black uppercase">Home</span>
            </button>
            <button 
              onClick={() => setView('learn')}
              className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${view === 'learn' ? 'bg-pink-500 text-white shadow-lg shadow-pink-200' : 'text-pink-300 hover:bg-pink-50'}`}
            >
              <CalendarIcon size={24} />
              <span className="text-[10px] font-black uppercase">Learn</span>
            </button>
            <button 
              onClick={() => setView('review')}
              className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${view === 'review' ? 'bg-pink-500 text-white shadow-lg shadow-pink-200' : 'text-pink-300 hover:bg-pink-50'}`}
            >
              <BookOpen size={24} />
              <span className="text-[10px] font-black uppercase">Review</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}
