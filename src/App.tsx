import { Geolocation } from '@capacitor/geolocation';
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Compass, Home, LayoutList, Plus, User, MapPin, Star, ChevronDown, Calculator, X, Pencil, Trash2, BarChart2, PieChart as PieChartIcon, Settings, Palette, Image as ImageIcon, Search, MessageCircle, Navigation, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
// ✅ 替換成這行
import { motion, AnimatePresence } from 'framer-motion';
// 🌟 Firebase 與資料庫 (信箱/密碼登入與全端資料庫設定) 🌟
import { auth, db, googleProvider } from './firebase'; // 👈 新增了 googleProvider

import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,    
  sendEmailVerification,     
  signOut,
  onAuthStateChanged,
  signInWithPopup // 👈 新增這行：用來呼叫 Google 登入視窗
} from 'firebase/auth';

// 👇 新增這段：引入 Firestore 雲端資料庫的實時監聽與讀寫套件
import { collection, onSnapshot, doc, setDoc, getDoc, deleteDoc, updateDoc, getDocs, query, where, arrayUnion, increment } from 'firebase/firestore';
import { dataService } from './services/db';

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

// 🌟 強制在 App.tsx 定義 User 結構，確保稱號與顏色能被辨識

export interface User {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  phone?: string;
  birthday?: string;
  isGuest?: boolean;     // 👈 把這個補上來
  tags: string[];         
  totalGames: number;
  winRate: number;
  reports: number;
  primaryColor?: string;  
  bgColor?: string;       
}

export type MatchRecord = {
  id: string;
  date: string;
  basePoint: string;
  location: string;
  resultType: 'win' | 'lose';
  amount: number;
};

export type Application = {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
};

export type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
};

export type Conversation = {
  id: string;
  participants: { id: string, name: string, avatar: string }[];
  messages: Message[];
  updatedAt: number;
  unreadCount?: number;
};

export type TableRecord = {
  id: string | number;
  hostId: string;
  host: string;
  date: string;
  time: string;
  city: string;
  district: string;
  road?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  base: string;
  rule: string;
  missing: number;
  avatar: string;
  isOwn?: boolean;
  applications?: Application[];
};


const DEFAULT_USER: User = {
  id: 'user1',
  name: '王大明',
  avatar: 'https://i.pravatar.cc/150?img=11'
};

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onFinish, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="text-center"
      >
        {/*<div className="text-6xl mb-4">🀄️</div>*/}
        <h1 className="text-3xl font-black tracking-tighter text-gray-900">哪有賭徒天天輸🀄️</h1>
      </motion.div>
    </motion.div>
  );
}


function LoginView({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResendBtn, setShowResendBtn] = useState(false);

  const checkEmailFormat = (emailStr: string) => {
    if (!emailStr) return '請輸入電子信箱';
    if (!emailStr.includes('@')) return '信箱缺少 @ 符號';
    const parts = emailStr.split('@');
    if (parts.length !== 2) return '信箱格式錯誤';
    const [local, domain] = parts;
    if (!local || !domain) return '信箱格式不完整';
    if (!domain.includes('.')) return '信箱網域錯誤 (例如漏打 .com)';
    const lowerDomain = domain.toLowerCase();
    if (lowerDomain.endsWith('.con')) return '信箱結尾打錯囉！是 .com 不是 .con';
    if (lowerDomain === 'gamil.com' || lowerDomain === 'gmal.com') return '網域拼錯囉！應為 gmail.com';
    if (lowerDomain === 'yaho.com') return '網域拼錯囉！應為 yahoo.com';
    return '';
  };

  const runWithTimeout = (promise: Promise<any>, ms: number = 8000) => {
    let timer: any;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  };

  const handleForgotPassword = async () => {
    const emailErrorMsg = checkEmailFormat(email);
    if (emailErrorMsg) { setError(emailErrorMsg); setSuccessMsg(''); return; }

    setIsLoading(true); setError(''); setSuccessMsg(''); setShowResendBtn(false);

    try {
      await runWithTimeout(sendPasswordResetEmail(auth, email));
      setSuccessMsg('✅ 密碼重設信件已寄出！請前往信箱點擊連結。');
    } catch (err: any) {
      if (err.message === 'TIMEOUT') {
        setError('❌ 伺服器無回應，請稍後再試。');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        setError('❌ 找不到此信箱，請確認是否有註冊過。');
      } else {
        setError('❌ 發送失敗，請稍後再試。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true); setError(''); setSuccessMsg('');
    try {
      const userCredential: any = await runWithTimeout(signInWithEmailAndPassword(auth, email, password));
      await runWithTimeout(sendEmailVerification(userCredential.user));
      await signOut(auth);
      setSuccessMsg('✅ 驗證信已經重新寄出！請去信箱檢查。');
      setShowResendBtn(false);
    } catch (err: any) {
      setError('❌ 重寄失敗：伺服器無回應或密碼錯誤。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAction = async () => {
    const emailErrorMsg = checkEmailFormat(email);
    if (emailErrorMsg) { setError(emailErrorMsg); setSuccessMsg(''); return; }
    if (!password) { setError('請填寫密碼'); setSuccessMsg(''); return; }
    if (password.length < 6) { setError('密碼太短，請至少輸入 6 個字元'); setSuccessMsg(''); return; }

    setIsLoading(true); setError(''); setSuccessMsg(''); setShowResendBtn(false);

    try {
      if (isRegistering) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          await sendEmailVerification(userCredential.user);
          await signOut(auth); 
          setSuccessMsg('🎉 註冊成功！驗證信已寄出，請點擊信中連結後再回來登入。');
          setIsRegistering(false); 
        } catch (regErr: any) {
          if (regErr.code === 'auth/email-already-in-use') {
            setError('❌ 此信箱已被註冊過囉！請點擊下方「返回登入」直接登入。');
          } else {
            setError('❌ 註冊失敗，請確認網路連線');
          }
        }
      } else {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          if (!user.emailVerified) {
            await signOut(auth);
            setError('❌ 您的信箱尚未驗證！請去信箱點擊驗證連結。');
            setShowResendBtn(true);
            return; 
          }

          onLogin({
            id: user.uid,
            name: user.email?.split('@')[0] || '使用者',
            avatar: `https://i.pravatar.cc/150?u=${user.uid}`,
            email: user.email || undefined
          });
        } catch (loginErr: any) {
          setError('❌ 登入失敗，請確認信箱與密碼是否正確！');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 👇 新增這裡 👇：Google 登入專用函數
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("✅ Google 登入成功！", result.user);
      // 注意：這裡不用特別呼叫 onLogin，因為外層 App.tsx 的 onAuthStateChanged 會自動偵測到登入狀態改變並接手處理！
    } catch (error: any) {
      setError("❌ Google 登入失敗：" + error.message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  // 👆 新增結束 👆

  const handleGuestLogin = () => {
    onLogin({
      id: 'developer_admin_999',
      name: '開發者 (強制進入)',
      avatar: 'https://i.pravatar.cc/150?img=11',
      email: 'dev@test.com',
      isGuest: false 
    });
  };
  const handleTestUserLogin = () => {
    onLogin({
      id: 'test_user_002',
      name: '測試員 B (打牌仔)',
      avatar: 'https://i.pravatar.cc/150?img=32', 
      email: 'playerB@test.com',
      isGuest: false 
    });
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center px-8 bg-white pt-[env(safe-area-inset-top)]">
      <div className="text-6xl mb-6">🀄️</div>
      <h1 className="text-2xl font-black tracking-tighter text-gray-900 mb-8">哪有賭徒天天輸🀄️</h1>

      <div className="w-full space-y-4">
        <input 
          type="email" 
          placeholder="電子信箱 (example@gmail.com)" 
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); setSuccessMsg(''); setShowResendBtn(false); }}
          className="w-full py-4 px-6 rounded-2xl bg-gray-50 border border-gray-100 font-bold outline-none focus:ring-2 focus:ring-black/5 transition-all"
        />
        <input 
          type="password" 
          placeholder="密碼 (至少 6 個字元)" 
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); setSuccessMsg(''); setShowResendBtn(false); }}
          className="w-full py-4 px-6 rounded-2xl bg-gray-50 border border-gray-100 font-bold outline-none focus:ring-2 focus:ring-black/5 transition-all"
        />

        <div className="min-h-[24px] flex flex-col items-center justify-center gap-2">
          {error && <p className="text-red-500 text-xs font-black text-center animate-pulse">{error}</p>}
          {successMsg && <p className="text-emerald-500 text-xs font-black text-center animate-pulse">{successMsg}</p>}
          
          {showResendBtn && (
            <button 
              onClick={handleResendVerification}
              disabled={isLoading}
              className="px-4 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
            >
              沒收到驗證信？點此重新發送
            </button>
          )}
        </div>

        <button 
          onClick={handleEmailAction}
          disabled={isLoading}
          className="w-full py-4 rounded-2xl bg-black text-white font-black shadow-lg disabled:bg-gray-400 transition-all flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          {isLoading ? '處理中...' : (isRegistering ? '發送驗證信並註冊' : '登入帳號')}
        </button>

        <div className="flex justify-between items-center px-2 pt-1">
          <button onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMsg(''); setShowResendBtn(false); }} className="text-xs font-bold text-blue-600 hover:text-blue-700">
            {isRegistering ? '已經有帳號了？返回登入' : '沒有帳號？按此註冊'}
          </button>
          {!isRegistering && (
            <button onClick={handleForgotPassword} disabled={isLoading} className="text-xs font-bold text-gray-400 hover:text-gray-600">
              忘記密碼？
            </button>
          )}
        </div>
        
        {/* 👇 新增這裡 👇：Google 按鈕與分隔線 */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-xs text-gray-400 font-bold tracking-widest">或</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin} 
          disabled={isLoading}
          className="w-full py-4 rounded-2xl bg-white border border-gray-200 text-gray-900 font-black shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          使用 Google 帳號登入
        </button>
        {/* 👆 新增結束 👆 */}

        {/* 🌟 上線前封印後門：開發者與測試員登入區塊開始 */}
        {/*
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <div className="relative flex justify-center"><span className="bg-white px-4 text-xs text-gray-400 font-bold">或</span></div>
        </div>

        <button 
          onClick={async () => { ...
        */}
      </div>
    </div>
  );
}


const TAIWAN_REGIONS: Record<string, string[]> = {
  '基隆市': ['仁愛區', '信義區', '中正區', '中山區', '安樂區', '暖暖區', '七堵區'],
  '台北市': ['中正區', '萬華區', '大同區', '中山區', '松山區', '大安區', '信義區', '內湖區', '南港區', '士林區', '北投區', '文山區'],
  '新北市': ['板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區', '樹林區', '鶯歌區', '三峽區', '淡水區', '汐止區', '瑞芳區', '土城區', '蘆洲區', '五股區', '泰山區', '林口區', '深坑區', '石碇區', '坪林區', '三芝區', '石門區', '八里區', '平溪區', '雙溪區', '貢寮區', '金山區', '萬里區', '烏來區'],
  '桃園市': ['桃園區', '中壢區', '平鎮區', '八德區', '楊梅區', '蘆竹區', '大溪區', '龍潭區', '龜山區', '大園區', '觀音區', '新屋區', '復興區'],
  '新竹縣': ['竹北市', '竹東鎮', '新埔鎮', '關西鎮', '湖口鄉', '新豐鄉', '芎林鄉', '橫山鄉', '北埔鄉', '寶山鄉', '峨眉鄉', '尖石鄉', '五峰鄉'],
  '新竹市': ['東區', '北區', '香山區'],
  '苗栗縣': ['苗栗市', '苑裡鎮', '通霄鎮', '竹南鎮', '頭份市', '後龍鎮', '卓蘭鎮', '大湖鄉', '公館鄉', '銅鑼鄉', '南庄鄉', '頭屋鄉', '三義鄉', '西湖鄉', '造橋鄉', '三灣鄉', '獅潭鄉', '泰安鄉'],
  '台中市': ['中區', '東區', '南區', '西區', '北區', '北屯區', '西屯區', '南屯區', '太平區', '大里區', '霧峰區', '烏日區', '豐原區', '后里區', '石岡區', '東勢區', '和平區', '新社區', '潭子區', '大雅區', '神岡區', '大肚區', '沙鹿區', '龍井區', '梧棲區', '清水區', '大甲區', '外埔區', '大安區'],
  '彰化縣': ['彰化市', '鹿港鎮', '和美鎮', '線西鄉', '伸港鄉', '福興鄉', '秀水鄉', '花壇鄉', '芬園鄉', '員林市', '溪湖鎮', '田中鎮', '大村鄉', '埔鹽鄉', '埔心鄉', '永靖鄉', '社頭鄉', '二水鄉', '北斗鎮', '二林鎮', '田尾鄉', '埤頭鄉', '芳苑鄉', '大城鄉', '竹塘鄉', '溪州鄉'],
  '南投縣': ['南投市', '埔里鎮', '草屯鎮', '竹山鎮', '集集鎮', '名間鄉', '鹿谷鄉', '中寮鄉', '魚池鄉', '國姓鄉', '水里鄉', '信義鄉', '仁愛鄉'],
  '雲林縣': ['斗六市', '斗南鎮', '虎尾鎮', '西螺鎮', '土庫鎮', '北港鎮', '古坑鄉', '大埤鄉', '莿桐鄉', '林內鄉', '二崙鄉', '崙背鄉', '麥寮鄉', '東勢鄉', '褒忠鄉', '台西鄉', '元長鄉', '四湖鄉', '口湖鄉', '水林鄉'],
  '嘉義縣': ['太保市', '朴子市', '布袋鎮', '大林鎮', '民雄鄉', '溪口鄉', '新港鄉', '六腳鄉', '東石鄉', '義竹鄉', '鹿草鄉', '水上鄉', '中埔鄉', '竹崎鄉', '梅山鄉', '番路鄉', '大埔鄉', '阿里山鄉'],
  '嘉義市': ['東區', '西區'],
  '台南市': ['中西區', '東區', '南區', '北區', '安平區', '安南區', '永康區', '歸仁區', '新化區', '左鎮區', '玉井區', '楠西區', '南化區', '仁德區', '關廟區', '龍崎區', '官田區', '麻豆區', '佳里區', '西港區', '七股區', '將軍區', '學甲區', '北門區', '新營區', '後壁區', '白河區', '東山區', '六甲區', '下營區', '柳營區', '鹽水區', '善化區', '大內區', '山上區', '新市區', '安定區'],
  '高雄市': ['新興區', '前金區', '苓雅區', '鹽埕區', '鼓山區', '旗津區', '前鎮區', '三民區', '楠梓區', '小港區', '左營區', '仁武區', '大社區', '岡山區', '路竹區', '阿蓮區', '田寮區', '燕巢區', '橋頭區', '梓官區', '彌陀區', '永安區', '湖內區', '鳳山區', '大寮區', '林園區', '鳥松區', '大樹區', '旗山區', '美濃區', '六龜區', '內門區', '杉林區', '甲仙區', '桃源區', '那瑪夏區', '茂林區'],
  '屏東縣': ['屏東市', '潮州鎮', '東港鎮', '恆春鎮', '萬丹鄉', '長治鄉', '麟洛鄉', '九如鄉', '里港鄉', '鹽埔鄉', '高樹鄉', '萬巒鄉', '內埔鄉', '竹田鄉', '新埤鄉', '枋寮鄉', '新園鄉', '崁頂鄉', '林邊鄉', '南州鄉', '佳冬鄉', '琉球鄉', '車城鄉', '滿州鄉', '枋山鄉', '三地門鄉', '霧臺鄉', '瑪家鄉', '泰武鄉', '來義鄉', '春日鄉', '獅子鄉', '牡丹鄉'],
  '宜蘭縣': ['宜蘭市', '羅東鎮', '蘇澳鎮', '頭城鎮', '礁溪鄉', '壯圍鄉', '員山鄉', '冬山鄉', '五結鄉', '三星鄉', '大同鄉', '南澳鄉'],
  '花蓮縣': ['花蓮市', '鳳林鎮', '玉里鎮', '新城鄉', '吉安鄉', '壽豐鄉', '光復鄉', '豐濱鄉', '瑞穗鄉', '富里鄉', '秀林鄉', '萬榮鄉', '卓溪鄉'],
  '台東縣': ['台東市', '成功鎮', '關山鎮', '卑南鄉', '鹿野鄉', '池上鄉', '東河鄉', '長濱鄉', '太麻里鄉', '大武鄉', '綠島鄉', '海端鄉', '延平鄉', '金峰鄉', '達仁鄉', '蘭嶼鄉'],
  '澎湖縣': ['馬公市', '湖西鄉', '白沙鄉', '西嶼鄉', '望安鄉', '七美鄉'],
  '金門縣': ['金城鎮', '金湖鎮', '金沙鎮', '金寧鄉', '烈嶼鄉', '烏坵鄉'],
  '連江縣': ['南竿鄉', '北竿鄉', '莒光鄉', '東引鄉']
};

// Helper to determine text color based on background color
function getContrastColor(hexColor: string) {
  // If no color or invalid, return default dark text
  if (!hexColor || !/^#([0-9A-F]{3}){1,2}$/i.test(hexColor)) return '#111827';
  
  let r = 0, g = 0, b = 0;
  if (hexColor.length === 4) {
    r = parseInt(hexColor[1] + hexColor[1], 16);
    g = parseInt(hexColor[2] + hexColor[2], 16);
    b = parseInt(hexColor[3] + hexColor[3], 16);
  } else if (hexColor.length === 7) {
    r = parseInt(hexColor.substring(1, 3), 16);
    g = parseInt(hexColor.substring(3, 5), 16);
    b = parseInt(hexColor.substring(5, 7), 16);
  }
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, dark gray for light backgrounds
  return luminance > 0.5 ? '#111827' : '#FFFFFF';
}

// Helper to darken a hex color for better contrast on light backgrounds
function darkenColor(hex: string, percent: number) {
  if (!hex || !/^#([0-9A-F]{3}){1,2}$/i.test(hex)) return hex;
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r = Math.max(0, Math.floor(r * (1 - percent / 100)));
  g = Math.max(0, Math.floor(g * (1 - percent / 100)));
  b = Math.max(0, Math.floor(b * (1 - percent / 100)));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function getThemeTextColor(bgColor: string, primaryColor: string) {
  const contrast = getContrastColor(bgColor);
  // If background is dark, use white. If light, use a slightly darkened primary color for better contrast.
  return contrast === '#FFFFFF' ? '#FFFFFF' : darkenColor(primaryColor, 20);
}

function ChatView({ user, conversationId, conversations, setConversations, onClose, primaryColor, bgColor }: { user: User, conversationId: string, conversations: Conversation[], setConversations: (c: Conversation[]) => void, onClose: () => void, primaryColor: string, bgColor: string }) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversation = conversations.find(c => c.id === conversationId);
  const otherUser = conversation?.participants.find(p => p.id !== user.id);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  if (!conversation || !otherUser) return null;

  // 🔥 殺手鐧：發送訊息全面上雲端！
  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    // 1. 打包要送出的訊息
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: user.id,
      text: inputText.trim(),
      timestamp: Date.now()
    };
    
    // 先把輸入框清空，讓使用者感覺瞬間發出去了
    setInputText('');
    
    try {
      // 2. 轟上雲端！直接把這句對話塞進 Google 資料庫的陣列裡
      await updateDoc(doc(db, 'conversations', conversationId), {
        messages: arrayUnion(newMessage), // 把新訊息塞進陣列尾端
        updatedAt: Date.now(),
        // 🌟 神奇魔法：讓對方的未讀數量自動 +1，他的手機馬上就會跳小鈴鐺！
        [`unreadCounts.${otherUser.id}`]: increment(1) 
      });
      
    } catch (error) {
      alert("發送訊息失敗，請檢查網路！");
      // 如果發送失敗，可以考慮把剛剛清空的字還給使用者 (選用)
      // setInputText(newMessage.text); 
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* 👇 加上了安全領域 (Safe Area) 自動推移 👇 */}
      <header className="flex-none flex justify-between items-center px-4 pb-4 pt-[calc(env(safe-area-inset-top,20px)+16px)] z-10 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="font-bold text-lg px-2 active:opacity-70 flex items-center gap-1" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>
          返回
        </motion.button>
        <div className="flex items-center gap-2">
          <img src={otherUser.avatar} alt={otherUser.name} className="w-8 h-8 rounded-full object-cover bg-gray-200 border border-gray-100 shadow-sm" />
          <h1 className="text-lg font-black tracking-tight" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>{otherUser.name}</h1>
        </div>
        <div className="w-16"></div> {/* 佔位符維持置中對齊 */}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {conversation.messages.length === 0 ? (
          <p className="text-center text-gray-400 text-xs font-bold py-10">開始與 {otherUser.name} 聊天吧！</p>
        ) : (
          conversation.messages.map(msg => {
            const isMe = msg.senderId === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? 'text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-900 rounded-bl-sm shadow-sm'}`} style={isMe ? { backgroundColor: primaryColor } : {}}>
                  <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                  <p className={`text-[9px] mt-1 ${isMe ? 'text-white/70 text-right' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="pt-4 px-4 pb-[calc(env(safe-area-inset-bottom,20px)+16px)] bg-white border-t border-gray-100">
        <div className="flex gap-2">
          <input 
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="輸入訊息..."
            /* 👇 就是這裡！把 text-sm 換成了 text-base (16px) 👇 */
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': primaryColor } as any}
          />
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            className="px-6 rounded-xl font-black text-white shadow-md transition-all"
            style={{ backgroundColor: primaryColor }}
          >
            發送
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as User;
            
            // 🌟 關鍵修復：除了稱號，連主題顏色、背景、暱稱、背景圖片也要一起抓回來！
            const patchedUser: User = {
              ...userData,
              // 如果雲端沒有這些欄位，就給他原本的預設值，避免變成空白
              name: userData.name || firebaseUser.email?.split('@')[0] || '使用者',
              avatar: userData.avatar || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
              tags: userData.tags || ['天選之人', '門清一摸三'],
              totalGames: userData.totalGames || 0,
              winRate: userData.winRate || 0,
              reports: userData.reports || 0,
              primaryColor: userData.primaryColor || '#3B82F6', 
              bgColor: userData.bgColor || '#F8FAFC',
              // 👇 新增：抓取雲端背景圖，沒有的話就給空字串
              bgImage: userData.bgImage || '' 
            };
            
            // 更新狀態與本地緩存
            setCurrentUser(patchedUser);
            localStorage.setItem('mahjong_user', JSON.stringify(patchedUser));

            // 👇 新增：把從雲端抓到的顏色和「背景圖片」立刻套用到畫面上 👇
            setAppTheme(prev => ({
              ...prev,
              primaryColor: patchedUser.primaryColor,
              bgColor: patchedUser.bgColor,
              bgImage: patchedUser.bgImage || '' // 👈 同步背景圖片
            }));

            // 同步回雲端（補齊缺失欄位）
            const cleanUser = JSON.parse(JSON.stringify(patchedUser));
            await setDoc(userDocRef, cleanUser, { merge: true });
            
            console.log("📥 雲端資料同步完成，主題與背景圖已載入");
          } else {
            // 全新使用者註冊
            const newUser: User = {
              id: firebaseUser.uid,
              name: firebaseUser.email?.split('@')[0] || '使用者',
              avatar: `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
              email: firebaseUser.email || "",
              tags: ['天選之人', '門清一摸三'],
              totalGames: 0,
              winRate: 0,
              reports: 0,
              primaryColor: '#3B82F6', // 預設藍色
              bgColor: '#F8FAFC',      // 預設淺灰
              bgImage: ''              // 👈 新增：全新使用者預設沒有背景圖
            };
            setCurrentUser(newUser);
            const cleanNewUser = JSON.parse(JSON.stringify(newUser));
            await setDoc(userDocRef, cleanNewUser);
            localStorage.setItem('mahjong_user', JSON.stringify(newUser));
            
            // 🌟 新玩家註冊時，也順便套用預設的顏色
            setAppTheme(prev => ({
              ...prev,
              primaryColor: newUser.primaryColor,
              bgColor: newUser.bgColor,
              bgImage: newUser.bgImage
            }));
          }
        } catch (error) {
          console.error("讀取使用者資料失敗:", error);
        }
      } else {
        // 登出狀態：從本地讀取（讓測試員 B 還能動）
        const localUser = localStorage.getItem('mahjong_user');
        if (localUser) {
          try {
            setCurrentUser(JSON.parse(localUser));
          } catch (e) {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, []);
  // 👆 👆 👆 新增結束 👆 👆 👆
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    dataService.saveUser(user);
    // 🌟 這裡漏掉了！必須把帳號存進 localStorage，這樣測試員 B 重新整理才不會被登出！
    localStorage.setItem('mahjong_user', JSON.stringify(user));
  };


  // 🌟 Google 登入專用函數
  const handleGoogleLogin = async () => {
    try {
      // 呼叫 Google 專屬彈出視窗
      const result = await signInWithPopup(auth, googleProvider);
      
      // 🌟 神奇的地方來了：一旦登入成功，我們原本寫在 useEffect 裡面的 
      // onAuthStateChanged 就會自動感應到，並幫這個新來的 Google 帳號建立資料庫檔案！
      console.log("✅ Google 登入成功！", result.user);

    } catch (error: any) {
      alert("❌ Google 登入失敗：" + error.message);
      console.error(error);
    }
  };

  const handleUpdateUser = async (user: User) => {
    // 1. 本地立即反應（讓畫面不卡頓）
    setCurrentUser(user);
    dataService.saveUser(user);
    localStorage.setItem('mahjong_user', JSON.stringify(user));

    try {
      // 2. 🌟 深度清洗資料 (確保沒有 Firebase 討厭的 undefined)
      // 這一步會確保你的 name, avatar, tags, primaryColor, bgColor 全部被包進去
      const cleanUser = JSON.parse(JSON.stringify(user));
      
      // 3. 寫入雲端 Firestore
      // 使用 { merge: true } 是為了確保只更新有變動的地方，不會蓋掉其他重要資料
      await setDoc(doc(db, 'users', cleanUser.id), cleanUser, { merge: true });
      
      console.log("✅ 雲端同步成功:", cleanUser);
      // 為了測試，我們留著這個 alert，確認真的有跑到這裡
      // alert("✅ 雲端儲存成功！"); 
      
    } catch (error: any) {
      alert("❌ 雲端儲存失敗：" + error.message);
      console.error('❌ 雲端同步失敗：', error);
    }
  };

  // 登出功能
  const handleLogout = async () => {
    if (window.confirm('確定要登出目前帳號嗎？')) {
      // 1. 不管三七二十一，先強制清空手機記憶！
      localStorage.removeItem('mahjong_user'); // 🌟 確保登出時清得乾乾淨淨
      localStorage.clear();
      setCurrentUser(null);
      dataService.saveUser(null as any);
      
      // 2. 順便通知 Firebase 登出 (把 await 拿掉，不讓它卡畫面)
      try {
        if (auth) signOut(auth); 
      } catch (e) {
        console.error("Firebase登出錯誤", e);
      }
      
      // 3. 強制重整網頁，保證瞬間回到登入畫面！
      window.location.reload(); 
    }
  };

  const [currentTab, setCurrentTab] = useState('home');
  const [records, setRecords] = useState<MatchRecord[]>([]);
  const [editingRecord, setEditingRecord] = useState<MatchRecord | null>(null);
  
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [editingTable, setEditingTable] = useState<TableRecord | null>(null);
  
  const [lobbyFilterCity, setLobbyFilterCity] = useState('全部');
  const [lobbyFilterDistrict, setLobbyFilterDistrict] = useState('全部');
  const [appTheme, setAppTheme] = useState({
    primaryColor: '#2563eb',
    bgColor: '#f3f4f6', 
    bgImage: '',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // 1️⃣ 必須「先」宣告 conversations 存在
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // 2️⃣ 「然後」才能去拿 conversations 來計算未讀訊息！
  const unreadConversations = currentUser ? conversations.filter(conv => (conv as any).unreadCounts?.[currentUser.id] > 0) : [];

  // 🌟 1. 啟動 Firebase 實時監聽：戰績與聊天室全面上雲端！
  // 🌟 0. 網頁開啟時，只負責載入「背景圖片」(因為顏色已經交由 Firebase 全權管理了！)
  useEffect(() => {
    const loadLocalBackground = async () => {
      const savedTheme = await dataService.getTheme();
      // ⚠️ 這裡只讀取 bgImage，不讀取顏色，避免把 Firebase 的顏色蓋掉！
      if (savedTheme && savedTheme.bgImage) {
        setAppTheme(prev => ({ ...prev, bgImage: savedTheme.bgImage }));
      }
    };
    loadLocalBackground();
  }, []); // 空陣列代表只在網頁打開時執行「一次」

  // 🌟 1. 啟動 Firebase 實時監聽：戰績、聊天室與大廳開桌全面上雲端！
  useEffect(() => {
    if (!currentUser) return; // 沒登入就不抓資料

    // 🔥 監聽雲端戰績
    const qRecords = query(collection(db, 'records'), where('userId', '==', currentUser.id));
    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      const liveRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MatchRecord[];
      liveRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecords(liveRecords);
    });

    // 🔥 監聽雲端私訊聊天室
    const qConvs = query(collection(db, 'conversations'), where('participantIds', 'array-contains', currentUser.id));
    const unsubConvs = onSnapshot(qConvs, (snapshot) => {
      const liveConvs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Conversation[];
      liveConvs.sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(liveConvs);
    });

    // 🔥 監聽雲端大廳開桌資料 (順便幫你把大廳的監聽補回來了！)
    const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const liveTables = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as TableRecord[];
      console.log("🎲 Firebase 抓到的桌數：", liveTables.length, liveTables);
      setTables(liveTables);
    }, (error) => {
      console.error("❌ 大廳資料抓取失敗：", error);
    });

    // 離開時記得取消所有的監聽
    return () => { 
      unsubRecords(); 
      unsubConvs(); 
      unsubTables(); 
    };
  }, [currentUser]);

  // 👇 修正未讀訊息的計算方式，從雲端資料讀取
  const totalUnreadCount = conversations.reduce((sum, conv) => sum + ((conv as any).unreadCounts?.[currentUser?.id || ''] || 0), 0);


  
  // 本地暫存設定 (保留)
  useEffect(() => { dataService.saveRecords(records); }, [records]);
  useEffect(() => { dataService.saveTheme(appTheme); }, [appTheme]);
  useEffect(() => { dataService.saveConversations(conversations); }, [conversations]);

  const handleOpenAddRecord = () => { setEditingRecord(null); setCurrentTab('add_record'); };
  const handleEditRecord = (record: MatchRecord) => { setEditingRecord(record); setCurrentTab('add_record'); };
  const handleOpenAddTable = () => { setEditingTable(null); setCurrentTab('add_table'); };
  const handleEditTable = (table: TableRecord) => { setEditingTable(table); setCurrentTab('add_table'); };

  // 🔥 報名功能：寫入雲端，讓發文者瞬間收到！
  const handleApplyTable = async (tableId: string | number) => {
    if (!currentUser) return;
    const targetTable = tables.find(t => t.id === tableId);
    if (!targetTable) return;

    const hasApplied = targetTable.applications?.some(app => app.userId === currentUser.id);
    if (hasApplied) { alert('您已經報名過囉！'); return; }

    const newApp: Application = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      avatar: currentUser.avatar,
      status: 'pending',
      timestamp: Date.now()
    };

    try {
      await updateDoc(doc(db, 'tables', tableId.toString()), {
        applications: [...(targetTable.applications || []), newApp]
      });
      alert('✅ 報名已送出！請等待發文者審核。');
    } catch (error) { 
      console.error('報名失敗:', error);
      alert('報名失敗，請稍後再試'); 
    }
  };

  // 🔥 同意報名：寫入雲端 (加入滿桌時間紀錄)
  const handleAcceptApplication = async (tableId: string | number, applicationId: string) => {
    const targetTable = tables.find(t => t.id === tableId);
    if (!targetTable) return;
    const newMissing = Math.max(0, targetTable.missing - 1);
    const newApps = (targetTable.applications || []).map(app => {
      if (app.id === applicationId) return { ...app, status: 'accepted' as const };
      if (newMissing === 0 && app.status === 'pending') return { ...app, status: 'rejected' as const };
      return app;
    });
    
    try {
      const updateData: any = { missing: newMissing, applications: newApps };
      // 🌟 如果人數歸零，記錄滿桌的時間戳記！
      if (newMissing === 0) {
        updateData.fullAt = Date.now();
      }
      await updateDoc(doc(db, 'tables', tableId.toString()), updateData);
    } catch(error) {
      alert('操作失敗');
    }
  };

  // 🔥 婉拒報名：寫入雲端
  const handleRejectApplication = async (tableId: string | number, applicationId: string) => {
    const targetTable = tables.find(t => t.id === tableId);
    if (!targetTable) return;
    const newApps = (targetTable.applications || []).map(app => 
      app.id === applicationId ? { ...app, status: 'rejected' as const } : app
    );
    try {
      await updateDoc(doc(db, 'tables', tableId.toString()), { applications: newApps });
    } catch (error) {
      alert('操作失敗');
    }
  };

  // 私訊功能 (暫時存本地，下一步再來接雲端)
  // 🔥 私訊功能全面上雲端
  const handleOpenChat = async (otherUserId: string, otherUserName: string, otherUserAvatar: string) => {
    if (!currentUser) return;
    
    // 找找看雲端有沒有我們的聊天室
    let conv = conversations.find(c => (c as any).participantIds && (c as any).participantIds.includes(otherUserId));

    if (!conv) {
      // 如果雲端沒有對話紀錄，就建立一個新房間到 Firebase！
      const newConv = {
        id: `${currentUser.id}_${otherUserId}_${Date.now()}`,
        participantIds: [currentUser.id, otherUserId], // 供 Firebase 查詢用
        participants: [
          { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar },
          { id: otherUserId, name: otherUserName, avatar: otherUserAvatar }
        ],
        messages: [],
        updatedAt: Date.now(),
        unreadCounts: { [otherUserId]: 0, [currentUser.id]: 0 }
      };
      await setDoc(doc(db, 'conversations', newConv.id), newConv);
      setActiveConversationId(newConv.id);
    } else {
      // 進入房間時，把自己的雲端未讀訊息歸零
      if ((conv as any).unreadCounts?.[currentUser.id] > 0) {
        await updateDoc(doc(db, 'conversations', conv.id), {
          [`unreadCounts.${currentUser.id}`]: 0
        });
      }
      setActiveConversationId(conv.id);
    }
    setCurrentTab('chat');
  };

  // 🔥 刪除戰績：改從雲端刪除
  const handleDeleteRecord = async (id: string) => {
    if (window.confirm('確定要刪除這筆紀錄嗎？')) {
      try { await deleteDoc(doc(db, 'records', id.toString())); } catch(e) { alert('刪除失敗'); }
    }
  };

  // 🔥 刪除開桌：從雲端拔除
  const handleDeleteTable = async (id: string | number) => {
    if (window.confirm('確定要刪除這個開桌嗎？')) {
      try {
        await deleteDoc(doc(db, 'tables', id.toString()));
      } catch (error) {
        alert('刪除失敗');
      }
    }
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="h-[100dvh] font-sans text-gray-900 flex justify-center overflow-hidden" style={{ backgroundColor: appTheme.bgColor }}>
      {/* 手機版面容器 */}
      <div className="w-full max-w-md h-full relative shadow-2xl overflow-hidden flex flex-col" style={{ backgroundColor: appTheme.bgColor }}>
        
        {/* 背景圖案 */}
        {appTheme.bgImage && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <img 
              src={appTheme.bgImage} 
              alt="Background" 
              className="w-full h-full object-cover opacity-20"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* 根據 currentTab 決定是否顯示標準 Navbar */}
        {/* 根據 currentTab 決定是否顯示標準 Navbar */}
        {!['add_record', 'add_table', 'history', 'chat'].includes(currentTab) && (
          <header className="flex justify-between items-center px-6 pt-16 pb-4 bg-transparent sticky top-0 z-10 relative">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: getThemeTextColor(appTheme.bgColor, appTheme.primaryColor) }}>
              {currentTab === 'home' && '哪有賭徒天天輸🀄️'}
              {currentTab === 'lobby' && `尋找牌咖`}
              {currentTab === 'calculator' && '聽牌計算機'}
              {currentTab === 'stats' && '戰績統計'}
              {currentTab === 'profile' && '個人主頁'}
            </h1>

            {/* 右邊的設定與鈴鐺 */}
            <div className="flex gap-2">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowSettings(true)}
                className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </motion.button>
              
              {/* 👇 這裡加上了 onClick={() => setShowNotifications(true)} 👇 */}
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowNotifications(true)} 
                className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors relative"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {totalUnreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 w-2.5 h-2.5 rounded-full border-2 border-white"></span>
                )}
              </motion.button>
            </div>
          </header>
        )}

        {/* 通知中心彈窗 */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex justify-center items-start pt-[env(safe-area-inset-top,80px)] px-4"
              onClick={() => setShowNotifications(false)}
            >
              <motion.div
                initial={{ y: -20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -10, opacity: 0, scale: 0.95 }}
                className="w-full bg-white rounded-3xl shadow-2xl overflow-hidden mt-2 max-h-[60vh] flex flex-col border border-gray-100"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-gray-900" />
                    <h3 className="font-black text-gray-900 text-xs tracking-widest uppercase">通知中心</h3>
                  </div>
                  <button onClick={() => setShowNotifications(false)} className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-y-auto p-2 custom-scrollbar">
                  {unreadConversations.length === 0 ? (
                    <div className="py-10 text-center flex flex-col items-center justify-center opacity-50">
                      <Bell className="w-8 h-8 mb-2" />
                      <p className="text-gray-900 font-black text-xs uppercase tracking-widest">目前沒有新通知</p>
                    </div>
                  ) : (
                    unreadConversations.map(conv => {
                      const otherUser = conv.participants.find(p => p.id !== currentUser!.id);
                      if (!otherUser) return null;
                      return (
                        <motion.div
                          key={conv.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setShowNotifications(false);
                            handleOpenChat(otherUser.id, otherUser.name, otherUser.avatar);
                          }}
                          className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 cursor-pointer transition-all"
                        >
                          <div className="relative">
                            <img src={otherUser.avatar} alt={otherUser.name} className="w-12 h-12 rounded-full object-cover bg-gray-200" />
                            <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900"><span className="font-black">{otherUser.name}</span> 傳了一則訊息給您</p>
                            <p className="text-xs text-gray-500 truncate mt-1 font-medium">{conv.messages[conv.messages.length - 1]?.text}</p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        

        {/* 主要內容區 */}
        <main className="flex-1 overflow-hidden flex flex-col relative z-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {currentTab === 'home' && <HomeView records={records} onOpenAddRecord={handleOpenAddRecord} onOpenHistory={() => setCurrentTab('history')} onEditRecord={handleEditRecord} onDeleteRecord={handleDeleteRecord} primaryColor={appTheme.primaryColor} bgColor={appTheme.bgColor} />}
              {currentTab === 'lobby' && (
                currentUser?.isGuest ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="text-4xl mb-4">🔒</div>
                    <h2 className="text-xl font-black mb-2">遊客無法使用此功能</h2>
                    <p className="text-gray-400 text-sm mb-6">請登入後即可發桌找咖</p>
                    <button onClick={() => setCurrentUser(null)} className="px-6 py-3 bg-black text-white rounded-xl font-bold">
                      前往登入
                    </button>
                  </div>
                ) : (
                  <LobbyView user={currentUser!} tables={tables} onOpenAddTable={handleOpenAddTable} onEditTable={handleEditTable} onDeleteTable={handleDeleteTable} onApplyTable={handleApplyTable} onAcceptApplication={handleAcceptApplication} onRejectApplication={handleRejectApplication} onOpenChat={handleOpenChat} primaryColor={appTheme.primaryColor} bgColor={appTheme.bgColor} filterCity={lobbyFilterCity} setFilterCity={setLobbyFilterCity} filterDistrict={lobbyFilterDistrict} setFilterDistrict={setLobbyFilterDistrict} />
                )
              )}
              {currentTab === 'stats' && <StatsView records={records} primaryColor={appTheme.primaryColor} bgColor={appTheme.bgColor} />}
              {currentTab === 'calculator' && <div className="px-5 pb-28 pt-2 overflow-y-auto h-full"><ScoreView primaryColor={appTheme.primaryColor} bgColor={appTheme.bgColor} /></div>}
              {currentTab === 'tenpai' && <div className="px-5 pb-28 pt-2 overflow-y-auto h-full"><TenpaiView primaryColor={appTheme.primaryColor} bgColor={appTheme.bgColor} /></div>}
              {currentTab === 'history' && <HistoryView records={records} onClose={() => setCurrentTab('home')} onEditRecord={handleEditRecord} onDeleteRecord={handleDeleteRecord} primaryColor={appTheme.primaryColor} bgColor={appTheme.bgColor} />}
              {currentTab === 'add_record' && (
                <AddRecordView 
                  initialRecord={editingRecord}
                  onClose={() => setCurrentTab('home')} 
                  onSave={async (record) => {
                    try {
                      const recordWithUser = { ...record, userId: currentUser!.id };
                      
                      // 🚀 關鍵改變：不管三七二十一，先切回首頁，讓畫面瞬間反應！
                      setCurrentTab('home');

                      // 讓 Firebase 在背景自己慢慢把資料傳上雲端
                      await setDoc(doc(db, 'records', record.id.toString()), recordWithUser);
                    } catch(e) { 
                      alert("戰績儲存失敗！請檢查網路連線"); 
                    }
                  }} 
                  onDelete={(id) => {
                    // 這裡也一樣，先切畫面！
                    setCurrentTab('home');
                    handleDeleteRecord(id);
                  }}
                  primaryColor={appTheme.primaryColor}
                  bgColor={appTheme.bgColor}
                />
              )}
              
{currentTab === 'add_table' && (
                <AddTableView 
                  user={currentUser!}
                  initialTable={editingTable}
                  onClose={() => setCurrentTab('lobby')} 
                  onSave={async (table) => {
                    try {
                      // 1. 防呆洗淨：自動拔除所有導致 Firebase 報錯的 undefined 屬性
                      const cleanTable = JSON.parse(JSON.stringify(table));
                      
                      // 🚀 關鍵改變：先斬後奏！先設定好篩選器並切換回大廳，不要讓畫面卡住！
                      setLobbyFilterCity(table.city);
                      setLobbyFilterDistrict(table.district);
                      setCurrentTab('lobby');
                      
                      // 2. 讓 Firebase 在背景自己努力傳資料 (await 放後面)
                      await setDoc(doc(db, 'tables', table.id.toString()), cleanTable);
                      
                    } catch (error: any) {
                      alert("❌ 雲端寫入失敗！真實原因：" + error.message);
                    }
                  }} 
                  onDelete={(id) => {
                    // 🗑️ 刪除也比照辦理，先切換畫面！
                    setCurrentTab('lobby');
                    handleDeleteTable(id);
                  }}
                  primaryColor={appTheme.primaryColor}
                  bgColor={appTheme.bgColor}
                />
              )}

              {currentTab === 'profile' && <ProfileView user={currentUser!} onUpdateUser={handleUpdateUser} onLogout={handleLogout} records={records} conversations={conversations} onOpenChat={handleOpenChat} primaryColor={appTheme.primaryColor} bgColor={appTheme.bgColor} />}
              {currentTab === 'chat' && activeConversationId && (
                <ChatView 
                  user={currentUser!}
                  conversationId={activeConversationId} 
                  conversations={conversations} 
                  setConversations={setConversations} 
                  onClose={() => setCurrentTab('profile')} 
                  primaryColor={appTheme.primaryColor} 
                  bgColor={appTheme.bgColor} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* 設定彈窗 */}
        {/* 設定彈窗 */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
              onClick={() => setShowSettings(false)}
            >
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="w-full bg-white rounded-t-[2.5rem] p-8 pb-12 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-gray-900">個性化設定</h3>
                  <button onClick={() => setShowSettings(false)} className="p-2 bg-gray-100 rounded-full">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-8">
                  
                  {/* === 主題顏色區塊 === */}
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">
                      <Palette className="w-3.5 h-3.5" />
                      主題顏色
                    </label>
                    <div className="flex flex-wrap justify-center gap-3 px-2">
                      {[
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
                        '#0ea5e9', '#ec4899', '#a855f7', '#f97316', '#64748b', 
                        '#14b8a6', '#06b6d4', '#84cc16', '#f43f5e', '#6366f1'
                      ].map((color, idx) => (
                        <motion.button 
                          key={color}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.8 }}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 + idx * 0.05 }}
                          onClick={() => {
                            setAppTheme({ ...appTheme, primaryColor: color });
                            if (currentUser) {
                              handleUpdateUser({ ...currentUser, primaryColor: color });
                            }
                          }}
                          className={`w-10 h-10 rounded-2xl border-4 transition-all shadow-lg ${appTheme.primaryColor === color ? 'border-gray-900 scale-110 shadow-gray-400' : 'border-white shadow-gray-200'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))} {/* 🚨 修復點 1：補上 map 迴圈的結尾 */}
                    </div>    {/* 🚨 修復點 2：補上 div 結尾 */}
                  </motion.div> {/* 🚨 修復點 3：補上 motion.div 結尾 */}

                  {/* === 背景顏色區塊 === */}
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">
                      <Palette className="w-3.5 h-3.5" />
                      背景顏色
                    </label>
                    <div className="flex flex-wrap justify-center gap-3 px-2">
                      {[
                        '#ffffff', '#f8fafc', '#f3f4f6', '#fff1f2', '#fff7ed', 
                        '#fefce8', '#f0fdf4', '#eff6ff', '#faf5ff', '#fdf2f8', 
                        '#111827', '#1e3a8a', '#064e3b', '#450a0a'
                      ].map((color, idx) => (
                        <motion.button 
                          key={color}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.8 }}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 + idx * 0.05 }}
                          onClick={() => {
                            setAppTheme({ ...appTheme, bgColor: color });
                            if (currentUser) {
                              handleUpdateUser({ ...currentUser, bgColor: color });
                            }
                          }}
                          className={`w-10 h-10 rounded-2xl border-4 transition-all shadow-lg ${appTheme.bgColor === color ? 'border-gray-900 scale-110 shadow-gray-400' : 'border-white shadow-gray-200'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </motion.div>

                  {/* === 背景圖片區塊 === */}
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">
                      <ImageIcon className="w-3.5 h-3.5" />
                      背景圖片
                    </label>
{/* 👇 從這個 div 開始替換 👇 */}
                    <div className="flex flex-col gap-3">
                      <input 
                        type="file"
                        accept="image/*"
                        id="bg-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              const resultString = reader.result as string;
                              // 1. 畫面先換上新背景
                              setAppTheme({ ...appTheme, bgImage: resultString });
                              // 2. 🌟 把圖片的編碼存進 Firebase 雲端！
                              if (currentUser) {
                                handleUpdateUser({ ...currentUser, bgImage: resultString });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label 
                        htmlFor="bg-upload"
                        className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition-all"
                      >
                        {appTheme.bgImage ? (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-100">
                              <img src={appTheme.bgImage} className="w-full h-full object-cover" alt="Preview" />
                            </div>
                            <span className="text-xs font-bold text-gray-600">更換背景圖片</span>
                          </div>
                        ) : (
                          <>
                            <Plus className="w-5 h-5 text-gray-400" />
                            <span className="text-xs font-bold text-gray-400">從相簿上傳圖片</span>
                          </>
                        )}
                      </label>
                      {appTheme.bgImage && (
                        <button 
                          // 👇 🌟 移除圖片時，也同步把雲端的 bgImage 清空 👇
                          onClick={() => {
                            setAppTheme({ ...appTheme, bgImage: '' });
                            if (currentUser) {
                              handleUpdateUser({ ...currentUser, bgImage: '' });
                            }
                          }}
                          className="text-[10px] font-black text-red-400 uppercase tracking-widest self-center"
                        >
                          移除背景圖片
                        </button>
                      )}
                    </div>
                    {/* 👆 到這個 div 結束替換 👆 */}
                    <p className="text-[9px] text-gray-400 mt-3 ml-2 font-bold italic uppercase tracking-wider opacity-60">提示：圖片透明度會自動調整以確保文字清晰可讀</p>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 底部導覽列 (新增表單時隱藏，呈現更真實的 Modal 體驗) */}
        {!['add_record', 'add_table', 'history', 'chat'].includes(currentTab) && (
            <nav className="absolute bottom-0 w-full bg-white backdrop-blur-md border-t border-gray-100 px-2 pt-4 pb-10 flex justify-between items-center pb-safe z-20">
              <div className="flex flex-1 justify-around items-center">
                <NavItem icon={<Home />} label="首頁" isActive={currentTab === 'home'} onClick={() => setCurrentTab('home')} color={appTheme.primaryColor} />
                <NavItem icon={<Compass />} label="找咖" isActive={currentTab === 'lobby'} onClick={() => setCurrentTab('lobby')} color={appTheme.primaryColor} />
                <NavItem icon={<Search />} label="聽牌" isActive={currentTab === 'tenpai'} onClick={() => setCurrentTab('tenpai')} color={appTheme.primaryColor} />
              </div>
              
              {/* 中間突出的新增按鈕 */}
              <div className="relative -top-6 shrink-0 mx-2">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleOpenAddRecord}
                  className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg text-white transition-all"
                  style={{ backgroundColor: appTheme.primaryColor, boxShadow: `0 8px 20px ${appTheme.primaryColor}40` }}
                >
                  <Plus className="w-7 h-7" strokeWidth={2.5} />
                </motion.button>
              </div>

              <div className="flex flex-1 justify-around items-center">
                <NavItem icon={<BarChart2 />} label="統計" isActive={currentTab === 'stats'} onClick={() => setCurrentTab('stats')} color={appTheme.primaryColor} />
                <NavItem icon={<Calculator />} label="算分" isActive={currentTab === 'calculator'} onClick={() => setCurrentTab('calculator')} color={appTheme.primaryColor} />
                <NavItem icon={<User />} label="我的" isActive={currentTab === 'profile'} onClick={() => setCurrentTab('profile')} color={appTheme.primaryColor} badge={totalUnreadCount} />
              </div>
            </nav>
        )}
      </div>
    </div>
  );
}

// --- 子元件 ---

function NavItem({ icon, label, isActive, onClick, color, badge }: { icon: React.ReactElement, label: string, isActive: boolean, onClick: () => void, color?: string, badge?: number }) {
  return (
    <motion.button 
      whileTap={{ scale: 0.9 }}
      onClick={onClick} 
      className={`flex flex-col items-center gap-1 transition-colors flex-1 relative ${isActive ? '' : 'text-gray-400 hover:text-gray-600'}`}
      style={{ color: isActive ? color : undefined }}
    >
      <div className="relative">
        {React.cloneElement(icon, { className: 'w-5 h-5', strokeWidth: isActive ? 2.5 : 2 })}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[8px] font-bold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center shadow-sm border border-white">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className={`text-[9px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </motion.button>
  );
}

function HomeView({ records, onOpenAddRecord, onOpenHistory, onEditRecord, onDeleteRecord, primaryColor, bgColor }: { records: MatchRecord[], onOpenAddRecord: () => void, onOpenHistory: () => void, onEditRecord: (record: MatchRecord) => void, onDeleteRecord: (id: string) => void, primaryColor: string, bgColor: string }) {
  const totalNet = records.reduce((sum, r) => sum + (r.resultType === 'win' ? r.amount : -r.amount), 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthNet = records
    .filter(r => r.date.startsWith(currentMonth))
    .reduce((sum, r) => sum + (r.resultType === 'win' ? r.amount : -r.amount), 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const recentRecords = records.filter(r => r.date >= sevenDaysAgoStr);
  const hasOlderRecords = records.length > recentRecords.length;

  return (
    <div className="h-full flex flex-col px-5 pb-24 pt-2 overflow-y-auto custom-scrollbar">
      {/* 戰況總覽卡片 */}
      <div 
        className="shrink-0 bg-white rounded-[2rem] p-5 shadow-xl border border-gray-100"
        style={{ boxShadow: `0 20px 30px ${primaryColor}1a` }}
      >
        <div className="flex justify-between items-center">
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">本月淨輸贏</span>
            <span className="text-lg font-black tracking-tight truncate" style={{ color: primaryColor }}>
              {monthNet >= 0 ? '+' : '-'}${Math.abs(monthNet).toLocaleString()}
            </span>
          </div>
          <div className="w-[1px] h-8 bg-gray-100 mx-3 shrink-0"></div>
          <div className="flex flex-col flex-1 items-end overflow-hidden">
            <span className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">累積淨輸贏</span>
            <span className="text-lg font-black tracking-tight truncate" style={{ color: primaryColor }}>
              {totalNet >= 0 ? '+' : '-'}${Math.abs(totalNet).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 快捷按鈕區 */}
      <div className="shrink-0 flex gap-3 mt-4">
        <button onClick={onOpenAddRecord} className="flex-1 bg-white py-3 rounded-2xl shadow-sm border border-gray-100 font-bold flex justify-center items-center gap-2 active:scale-95 transition-transform" style={{ color: primaryColor }}>
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span className="text-sm">紀錄戰績</span>
        </button>
        <button onClick={onOpenHistory} className="flex-1 bg-white py-3 rounded-2xl shadow-sm border border-gray-100 font-bold flex justify-center items-center gap-2 active:scale-95 transition-transform" style={{ color: primaryColor }}>
          <span className="text-base">📅</span>
          <span className="text-sm">歷史戰績</span>
        </button>
      </div>

      {/* 最近牌局列表 */}
      <div className="flex-1 flex flex-col min-h-0 mt-5 mb-4">
        <div className="flex justify-between items-end mb-4 px-2 shrink-0">
          <h2 className="text-xl font-black tracking-tight" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>最近戰績 RECENT</h2>
          <button onClick={onOpenHistory} className="text-[10px] font-black uppercase tracking-widest" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>查看全部</button>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 bg-white backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-white overflow-hidden flex flex-col mx-1"
        >
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {recentRecords.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl opacity-50">🀄️</span>
              </div>
              <p className="text-gray-400 text-sm font-medium leading-relaxed">
                {hasOlderRecords ? '近七天沒有戰績，\n請至歷史戰績查看更早的紀錄。' : '目前還沒有任何戰績，\n點擊上方按鈕紀錄你的第一場！'}
              </p>
            </div>
          ) : (
            <>
              {recentRecords.map((record, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={record.id} 
                  className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">{record.location || '未填寫地點'}</span>
                    <span className="text-xs text-gray-500 mt-1">{record.date} · {record.basePoint}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-black" style={{ color: primaryColor }}>
                      {record.resultType === 'win' ? '+' : '-'}${record.amount.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onEditRecord(record)} 
                        className="text-gray-400 transition-colors p-1.5 bg-white rounded-lg shadow-sm"
                        style={{ '--tw-text-opacity': 1 } as any}
                        onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
                        onMouseLeave={(e) => e.currentTarget.style.color = ''}
                      >
                        <Pencil className="w-4 h-4" />
                      </motion.button>
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onDeleteRecord(record.id)} 
                        className="text-gray-400 hover:text-red-500 transition-colors p-1.5 bg-white rounded-lg shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
              {hasOlderRecords && (
                <div className="text-center pt-4 pb-2">
                  <button onClick={onOpenHistory} className="text-sm font-bold text-gray-400 hover:text-gray-600">
                    查看更早的紀錄...
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  </div>
);
}

function AddRecordView({ initialRecord, onClose, onSave, onDelete, primaryColor, bgColor }: { initialRecord: MatchRecord | null, onClose: () => void, onSave: (record: MatchRecord) => void, onDelete: (id: string) => void, primaryColor: string, bgColor: string }) {
  const [date, setDate] = useState(initialRecord?.date || new Date().toISOString().split('T')[0]);
  const [basePoint, setBasePoint] = useState(initialRecord?.basePoint || '30/10');
  const [location, setLocation] = useState(initialRecord?.location || '');
  const [resultType, setResultType] = useState<'win' | 'lose'>(initialRecord?.resultType || 'win');
  const [amount, setAmount] = useState(initialRecord?.amount?.toString() || '');

  const handleSave = () => {
    if (!amount || isNaN(Number(amount))) {
      alert('請輸入有效的金額');
      return;
    }
    onSave({
      id: initialRecord?.id || Date.now().toString(),
      date,
      basePoint: basePoint || '未指定',
      location,
      resultType,
      amount: Number(amount)
    });
  };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* 🌟 頂部標題列：加入了 pt-[calc(env(safe-area-inset-top)+16px)] 完美避開動態島 */}
      <header className="flex-none flex justify-between items-center px-4 pb-4 pt-[calc(env(safe-area-inset-top)+16px)] z-10" style={{ backgroundColor: bgColor }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="font-bold text-lg px-2 active:opacity-70" style={{ color: primaryColor }}>
          取消
        </motion.button>
        <h1 className="text-lg font-black tracking-tight" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>{initialRecord ? '編輯戰績' : '紀錄戰績'}</h1>
        <div className="w-12 text-right">
          {initialRecord && (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (window.confirm('確定要刪除這筆紀錄嗎？')) {
                  onDelete(initialRecord.id);
                }
              }} 
              className="text-red-500 font-bold text-sm px-2 active:opacity-70"
            >
              刪除
            </motion.button>
          )}
        </div>
      </header>

      <div className="flex-1 px-4 py-2 space-y-6 overflow-y-auto pb-8 custom-scrollbar">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* 日期 */}
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-900">選擇日期 Date</label>
                <div className="p-1.5 bg-gray-50 rounded-lg">
                  <Bell className="w-3 h-3 text-gray-400" />
                </div>
              </div>
              <div className="relative">
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="text-right text-gray-900 outline-none bg-transparent font-black text-sm pr-6"
                  style={{ color: primaryColor }}
                />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(offset => {
                const d = new Date();
                d.setDate(d.getDate() - offset);
                const dateStr = d.toISOString().split('T')[0];
                const isSelected = date === dateStr;
                const dayName = offset === 0 ? '今天' : offset === 1 ? '昨天' : 
                                d.toLocaleDateString('zh-TW', { weekday: 'short' });
                
                return (
                  <motion.button
                    key={dateStr}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDate(dateStr)}
                    className={`flex flex-col items-center justify-center min-w-[64px] py-4 rounded-2xl border transition-all ${
                      isSelected ? 'shadow-lg' : 'bg-gray-50 border-transparent text-gray-400'
                    }`}
                    style={{ 
                      backgroundColor: isSelected ? primaryColor : undefined,
                      borderColor: isSelected ? primaryColor : 'transparent',
                      color: isSelected ? 'white' : undefined,
                      boxShadow: isSelected ? `0 10px 20px ${primaryColor}33` : undefined
                    }}
                  >
                    <span className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-80">{dayName}</span>
                    <span className="text-base font-black tracking-tighter">{d.getDate()}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="h-[1px] bg-gray-100 ml-4"></div>

          {/* 底/台 */}
          <div className="p-4">
            <label className="block text-sm font-bold text-gray-900 mb-3">底 / 台</label>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar mb-3">
              {['30/10', '50/20', '100/20', '200/50'].map(bp => (
                <button 
                  key={bp} 
                  onClick={() => setBasePoint(bp)}
                  className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                    basePoint === bp ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {bp}
                </button>
              ))}
              <button 
                onClick={() => setBasePoint('')}
                className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                  !['30/10', '50/20', '100/20', '200/50'].includes(basePoint) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                自定義
              </button>
            </div>
            {!['30/10', '50/20', '100/20', '200/50'].includes(basePoint) && (
              <div className="flex items-center bg-gray-50 rounded-xl px-4 py-2 border border-gray-100 animate-in fade-in slide-in-from-top-1">
                <input 
                  type="text" 
                  value={basePoint}
                  onChange={(e) => setBasePoint(e.target.value)}
                  placeholder="輸入底/台 (例如 300/100)" 
                  className="flex-1 bg-transparent outline-none font-bold text-gray-900"
                />
              </div>
            )}
          </div>

          <div className="h-[1px] bg-gray-100 ml-4"></div>

          {/* 地點 */}
          <div className="p-4 flex items-center">
            <label className="text-sm font-bold text-gray-900 w-20">地點</label>
            <input 
              type="text" 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例如 小明家" 
              className="flex-1 text-right text-gray-900 placeholder-gray-400 outline-none bg-transparent font-medium"
            />
          </div>
        </div>

        {/* 結果區塊 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4">
          <label className="block text-sm font-bold text-gray-900 mb-3">輸贏金額</label>
          <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
             <button className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${resultType === 'win' ? 'bg-white shadow-sm' : 'text-gray-500'}`} style={resultType === 'win' ? { color: primaryColor } : {}} onClick={() => setResultType('win')}>贏 (+)</button>
             <button className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${resultType === 'lose' ? 'bg-white shadow-sm' : 'text-gray-500'}`} style={resultType === 'lose' ? { color: primaryColor } : {}} onClick={() => setResultType('lose')}>輸 (-)</button>
          </div>
          <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <span className="text-xl font-bold mr-2 whitespace-nowrap" style={{ color: primaryColor }}>{resultType === 'win' ? '+' : '-'}$</span>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0" 
              className="flex-1 w-full bg-transparent outline-none font-bold text-2xl text-gray-900" 
            />
          </div>
        </div>

        <motion.button 
          whileTap={{ scale: 0.98 }}
          onClick={handleSave} 
          className="w-full font-black py-5 rounded-[1.5rem] shadow-xl transition-all text-lg uppercase tracking-widest mt-4"
          style={{ backgroundColor: getContrastColor(primaryColor), color: primaryColor, boxShadow: `0 20px 30px ${getContrastColor(primaryColor)}4d` }}
        >
          儲存紀錄
        </motion.button>
      </div>
    </div>
  );
}

function AddTableView({ user, initialTable, onClose, onSave, onDelete, primaryColor, bgColor }: { user: User, initialTable: TableRecord | null, onClose: () => void, onSave: (table: TableRecord) => void, onDelete: (id: string | number) => void, primaryColor: string, bgColor: string }) {
  const [rule, setRule] = useState(initialTable?.rule || '台灣16張');
  const [date, setDate] = useState(initialTable?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(initialTable?.time || '20:00');
  const [city, setCity] = useState(initialTable?.city || '台北市');
  const [district, setDistrict] = useState(initialTable?.district || TAIWAN_REGIONS['台北市'][0]);
  const [road, setRoad] = useState(initialTable?.road || '');
  const [location, setLocation] = useState(initialTable?.location || '');
  const [latitude, setLatitude] = useState<number | undefined>(initialTable?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(initialTable?.longitude);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [missing, setMissing] = useState(initialTable?.missing || 1);

  // 🌟 升級版智慧定位：只拿「路名」去查座標，大幅提高準確率
  const handleGetLocation = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsGettingLocation(true);

    if (road) {
      try {
        // 只用「縣市+區域+路段」去查，不要加店名，這樣地圖才看得懂
        const searchAddress = `${city}${district}${road}`; 
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
          setLatitude(parseFloat(data[0].lat));
          setLongitude(parseFloat(data[0].lon));
          setIsGettingLocation(false);
          alert('✅ 定位成功！已根據您的「路段」設定好精準座標。');
          return;
        }
      } catch (error) {
        console.error('地址解析失敗:', error);
      }
    }

    // 如果沒寫路名，或是找不到，才用手機的 GPS
    const useGPS = window.confirm('無法根據地址找到座標。\n\n請問您現在人就在「打牌現場」嗎？如果是，請按「確定」使用目前手機的 GPS 定位。');
    if (useGPS) {
      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        alert('✅ 已成功獲取您「目前手機所在」的座標！');
      } catch (error) {
        alert('無法獲取手機位置，請確認 GPS 是否開啟');
      }
    }
    setIsGettingLocation(false);
  };
  
  const initialBaseParts = initialTable?.base ? initialTable.base.split('/') : ['30', '10'];
  const [base1, setBase1] = useState(initialBaseParts[0] || '30');
  const [base2, setBase2] = useState(initialBaseParts[1] || '10');

  const handleSave = () => {
    if (!rule || !date || !time || !city || !district || !base1 || !base2) {
      alert('請填寫完整資訊'); return;
    }
    onSave({
      id: initialTable?.id || Date.now(),
      hostId: user.id,
      host: initialTable?.host || user.name,
      date, time, city, district, road,
      location: location || road || '未填寫地點',
      // 👇 就是這裡！加上 || null，防止 Firebase 看到 undefined 崩潰！
      latitude: latitude || null, 
      longitude: longitude || null,
      base: `${base1}/${base2}`, rule, missing,
      avatar: initialTable?.avatar || user.avatar,
      isOwn: true,
      applications: initialTable?.applications || []
    });
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return [`${hour}:00`, `${hour}:30`];
  }).flat();

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* 🌟 強制加入 paddingTop 避開動態島 */}
      <header className="flex-none flex justify-between items-center px-4 pb-4 z-10 border-b border-gray-100" style={{ backgroundColor: bgColor, paddingTop: 'max(env(safe-area-inset-top), 35px)' }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="font-bold text-lg px-2 active:opacity-70" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>取消</motion.button>
        <h1 className="text-lg font-black tracking-tight" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>{initialTable ? '編輯開桌' : '發布開桌'}</h1>
        <div className="w-12 text-right">
          {initialTable && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { if (window.confirm('確定要刪除嗎？')) onDelete(initialTable.id); }} className="text-red-500 font-bold text-sm px-2 active:opacity-70">刪除</motion.button>
          )}
        </div>
      </header>

      {/* 內部表單，無需修改 */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto pb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 flex items-center">
            <label className="text-sm font-bold text-gray-900 w-24">玩法</label>
            <input type="text" value={rule} onChange={e => setRule(e.target.value)} placeholder="例如 台灣16張" className="flex-1 text-right text-gray-900 outline-none bg-transparent font-medium" />
          </div>
          <div className="h-[1px] bg-gray-100 ml-4"></div>
          <div className="p-4 flex items-center">
            <label className="text-sm font-bold text-gray-900 w-24">日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 text-right text-gray-900 outline-none bg-transparent font-medium" />
          </div>
          <div className="h-[1px] bg-gray-100 ml-4"></div>
          <div className="p-4 flex items-center">
            <label className="text-sm font-bold text-gray-900 w-24">時間</label>
            <select value={time} onChange={e => setTime(e.target.value)} className="flex-1 text-right text-gray-900 outline-none bg-transparent font-medium appearance-none">
              {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="h-[1px] bg-gray-100 ml-4"></div>
          <div className="p-4 flex items-center">
            <label className="text-sm font-bold text-gray-900 w-24">縣市</label>
            <select value={city} onChange={e => { setCity(e.target.value); setDistrict(TAIWAN_REGIONS[e.target.value][0]); }} className="flex-1 text-right text-gray-900 outline-none bg-transparent font-medium appearance-none">
              {Object.keys(TAIWAN_REGIONS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="h-[1px] bg-gray-100 ml-4"></div>
          <div className="p-4 flex items-center">
            <label className="text-sm font-bold text-gray-900 w-24">區域</label>
            <select value={district} onChange={e => setDistrict(e.target.value)} className="flex-1 text-right text-gray-900 outline-none bg-transparent font-medium appearance-none">
              {TAIWAN_REGIONS[city].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="h-[1px] bg-gray-100 ml-4"></div>
          <div className="p-4 flex items-center">
            <label className="text-sm font-bold text-gray-900 w-24">路段/地標</label>
            <input type="text" value={road} onChange={e => setRoad(e.target.value)} placeholder="例如 重新路一段" className="flex-1 text-right text-gray-900 outline-none bg-transparent font-medium" />
          </div>
          <div className="h-[1px] bg-gray-100 ml-4"></div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center flex-1">
              <label className="text-sm font-bold text-gray-900 w-24">店名/詳情</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="例如 三元四喜" className="flex-1 text-right text-gray-900 outline-none bg-transparent font-medium" />
            </div>
            <button onClick={handleGetLocation} className={`ml-2 p-2 rounded-full transition-colors ${latitude && longitude ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`} title={latitude && longitude ? "已定位" : "轉換座標"}>
              {isGettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            </button>
          </div>
          <div className="h-[1px] bg-gray-100 ml-4"></div>
          <div className="p-4 flex items-center justify-between">
            <label className="text-sm font-bold text-gray-900">缺額人數</label>
            <div className="flex items-center gap-4">
              <button onClick={() => setMissing(Math.max(1, missing - 1))} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200"><ChevronDown className="w-4 h-4" /></button>
              <span className="font-black text-gray-900 w-4 text-center">{missing}</span>
              <button onClick={() => setMissing(Math.min(3, missing + 1))} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200"><ChevronDown className="w-4 h-4 rotate-180" /></button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-bold text-gray-900">底 / 台</label>
            <div className="flex items-center gap-2">
              <input type="number" value={base1} onChange={e => setBase1(e.target.value)} placeholder="底" className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none font-bold text-center text-[16px]" style={{ '--tw-border-opacity': 1 } as any} onFocus={(e) => e.currentTarget.style.borderColor = primaryColor} onBlur={(e) => e.currentTarget.style.borderColor = ''} />
<span className="font-bold text-gray-400">/</span>
<input type="number" value={base2} onChange={e => setBase2(e.target.value)} placeholder="台" className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none font-bold text-center text-[16px]" style={{ '--tw-border-opacity': 1 } as any} onFocus={(e) => e.currentTarget.style.borderColor = primaryColor} onBlur={(e) => e.currentTarget.style.borderColor = ''} />
            </div>
          </div>
        </div>

        <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} className="w-full font-black py-4 rounded-[1.5rem] shadow-xl text-base uppercase tracking-widest" style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor), boxShadow: `0 15px 25px ${primaryColor}4d` }}>
          {initialTable ? '儲存修改' : '發布開桌'}
        </motion.button>
      </div>
    </div>
  );
}

const TileButton: React.FC<{ label: string, onClick: () => void, type: 'wan' | 'tong' | 'tiao' | 'zi' }> = ({ label, onClick, type }) => {
  const renderFace = () => {
    if (type === 'wan') {
      return (
        <div className="flex flex-col items-center justify-between h-[34px] py-1 scale-[0.9]">
          <span className="text-[14px] font-serif font-bold text-black leading-none">{label[0]}</span>
          <span className="text-[16px] font-serif font-bold text-red-600 leading-none">萬</span>
        </div>
      );
    }
    if (type === 'tong') {
      const num = parseInt(label[0]);
      if (num === 1) {
        return (
          <div className="w-7 h-7 rounded-full border-[2px] border-emerald-800 flex items-center justify-center relative bg-white shadow-inner">
            <div className="w-5 h-5 rounded-full border-[1.5px] border-red-500 flex items-center justify-center">
              <div className="w-2 h-2 bg-red-600 rounded-full"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="w-full h-[1px] bg-emerald-900 rotate-45"></div>
              <div className="w-full h-[1px] bg-emerald-900 -rotate-45"></div>
              <div className="w-[1px] h-full bg-emerald-900"></div>
              <div className="w-full h-[1px] bg-emerald-900"></div>
            </div>
          </div>
        );
      }
      
      const Dot = ({ color }: { color: string }) => (
        <div className={`w-2 h-2 rounded-full ${color} border-[0.5px] border-black/20 shadow-inner flex items-center justify-center`}>
          <div className="w-0.5 h-0.5 bg-white/30 rounded-full"></div>
        </div>
      );

      const blue = "bg-blue-900";
      const green = "bg-emerald-700";
      const red = "bg-red-600";

      if (num === 2) return <div className="flex flex-col gap-2"><Dot color={green}/><Dot color={blue}/></div>;
      if (num === 3) return <div className="flex flex-col gap-0.5 -rotate-45"><Dot color={green}/><Dot color={red}/><Dot color={blue}/></div>;
      if (num === 4) return <div className="grid grid-cols-2 gap-2"><Dot color={green}/><Dot color={blue}/><Dot color={blue}/><Dot color={green}/></div>;
      if (num === 5) return (
        <div className="relative w-6 h-6">
          <div className="absolute top-0 left-0"><Dot color={green}/></div>
          <div className="absolute top-0 right-0"><Dot color={blue}/></div>
          <div className="absolute bottom-0 left-0"><Dot color={blue}/></div>
          <div className="absolute bottom-0 right-0"><Dot color={green}/></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Dot color={red}/></div>
        </div>
      );
      if (num === 6) return (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <Dot color={green}/><Dot color={green}/>
          <Dot color={red}/><Dot color={red}/>
          <Dot color={red}/><Dot color={red}/>
        </div>
      );
      if (num === 7) return (
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-0.5 rotate-[20deg] mb-1">
            <Dot color={green}/><Dot color={green}/><Dot color={green}/>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Dot color={red}/><Dot color={red}/>
            <Dot color={red}/><Dot color={red}/>
          </div>
        </div>
      );
      if (num === 8) return (
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <Dot color={blue}/><Dot color={blue}/>
          <Dot color={blue}/><Dot color={blue}/>
          <Dot color={blue}/><Dot color={blue}/>
          <Dot color={blue}/><Dot color={blue}/>
        </div>
      );
      if (num === 9) return (
        <div className="grid grid-cols-3 gap-1">
          <Dot color={green}/><Dot color={green}/><Dot color={green}/>
          <Dot color={red}/><Dot color={red}/><Dot color={red}/>
          <Dot color={blue}/><Dot color={blue}/><Dot color={blue}/>
        </div>
      );
    }
    if (type === 'tiao') {
      const num = parseInt(label[0]);
      if (num === 1) return <span className="text-2xl mt-1">🦚</span>;
      
      const Stick = ({ color }: { color: string }) => (
        <div className={`w-1.5 h-3.5 ${color} rounded-[2px] border-[0.5px] border-black/20 shadow-sm relative overflow-hidden`}>
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-black/10"></div>
        </div>
      );
      
      const green = "bg-emerald-700";
      const red = "bg-red-600";

      if (num === 2) return <div className="flex flex-col gap-1"><Stick color={green}/><Stick color={green}/></div>;
      if (num === 3) return <div className="flex flex-col items-center gap-1"><Stick color={green}/><div className="flex gap-1"><Stick color={green}/><Stick color={green}/></div></div>;
      if (num === 4) return <div className="grid grid-cols-2 gap-1"><Stick color={green}/><Stick color={green}/><Stick color={green}/><Stick color={green}/></div>;
      if (num === 5) return (
        <div className="relative w-[22px] h-[30px] scale-[1.05]">
          <div className="absolute top-0 left-0"><Stick color={green}/></div>
          <div className="absolute top-0 right-0"><Stick color={green}/></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"><Stick color={red}/></div>
          <div className="absolute bottom-0 left-0"><Stick color={green}/></div>
          <div className="absolute bottom-0 right-0"><Stick color={green}/></div>
        </div>
      );
      if (num === 6) return <div className="grid grid-cols-3 gap-1"><Stick color={green}/><Stick color={green}/><Stick color={green}/><Stick color={green}/><Stick color={green}/><Stick color={green}/></div>;
      if (num === 7) return (
        <div className="flex flex-col items-center gap-0.5 scale-[0.85]">
          <Stick color={red}/>
          <div className="grid grid-cols-3 gap-1">
            <Stick color={green}/><Stick color={green}/><Stick color={green}/>
            <Stick color={green}/><Stick color={green}/><Stick color={green}/>
          </div>
        </div>
      );
      if (num === 8) return (
        <div className="flex flex-col items-center justify-center gap-1 scale-[0.85]">
          {/* 上方的 W 形 (直立式) */}
          <div className="relative w-8 h-5">
            <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
              <path d="M6 4V16L16 6L26 16V4" stroke="#064e3b" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 4V16L16 6L26 16V4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              {[ [6,4], [6,16], [16,6], [26,16], [26,4] ].map(([x,y], i) => (
                <circle key={i} cx={x} cy={y} r="3.2" fill="#064e3b" />
              ))}
            </svg>
          </div>
          {/* 下方的 M 形 (直立式) */}
          <div className="relative w-8 h-5">
            <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
              <path d="M6 16V4L16 14L26 4V16" stroke="#064e3b" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 16V4L16 14L26 4V16" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              {[ [6,16], [6,4], [16,14], [26,4], [26,16] ].map(([x,y], i) => (
                <circle key={i} cx={x} cy={y} r="3.2" fill="#064e3b" />
              ))}
            </svg>
          </div>
        </div>
      );
      if (num === 9) return (
        <div className="grid grid-cols-3 gap-1 scale-[0.8]">
          <Stick color={green}/><Stick color={red}/><Stick color={green}/>
          <Stick color={green}/><Stick color={red}/><Stick color={green}/>
          <Stick color={green}/><Stick color={red}/><Stick color={green}/>
        </div>
      );
    }
    if (label === '白') {
      return (
        <div className="w-6 h-8 border-[3px] border-blue-800 rounded-[3px] flex items-center justify-center bg-white">
          <div className="w-full h-full border border-blue-800/20 m-[1px]"></div>
        </div>
      );
    }
    const ziColors: Record<string, string> = {
      '中': 'text-red-700', '發': 'text-emerald-800',
      '東': 'text-black', '南': 'text-black', '西': 'text-black', '北': 'text-black',
    };
    return (
      <span className={`text-[26px] font-serif font-bold ${ziColors[label] || 'text-gray-900'}`}>
        {label}
      </span>
    );
  };

  return (
    <button 
      onClick={onClick}
      className="w-[32px] h-[44px] bg-white border border-gray-300 rounded-[3px] shadow-[0_2px_0_#bbb] flex flex-col items-center justify-center shrink-0 active:translate-y-[1px] active:shadow-none transition-all hover:bg-gray-50 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-800 opacity-90"></div>
      <div className="mt-0.5 flex items-center justify-center w-full h-full scale-[0.85]">{renderFace()}</div>
    </button>
  );
};

function StatsView({ records, primaryColor, bgColor }: { records: MatchRecord[], primaryColor: string, bgColor: string }) {
  const [viewMode, setViewMode] = useState<'winLoss' | 'basePoint'>('winLoss');
  const [timeMode, setTimeMode] = useState<'month' | 'year'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filter records by current month or year
  const filterRecords = () => {
    if (timeMode === 'month') {
      const monthStr = currentDate.toISOString().slice(0, 7);
      return records.filter(r => r.date.startsWith(monthStr));
    } else {
      const yearStr = currentDate.getFullYear().toString();
      return records.filter(r => r.date.startsWith(yearStr));
    }
  };

  const filteredRecords = filterRecords();

  // Win/Loss data
  const winCount = filteredRecords.filter(r => r.resultType === 'win').length;
  const loseCount = filteredRecords.filter(r => r.resultType === 'lose').length;
  const winLossData = [
    { name: '贏', value: winCount, color: primaryColor }, 
    { name: '輸', value: loseCount, color: '#4ade80' }, // Green
  ];

  // Base/Point data (Net amount by basePoint)
  const basePointStats = filteredRecords.reduce((acc, r) => {
    if (!acc[r.basePoint]) {
      acc[r.basePoint] = 0;
    }
    acc[r.basePoint] += r.resultType === 'win' ? r.amount : -r.amount;
    return acc;
  }, {} as Record<string, number>);

  const basePointData = Object.entries(basePointStats)
    .map(([name, value]) => ({ name, value: Math.abs(value), actualValue: value, isWin: value >= 0 }))
    .sort((a, b) => b.value - a.value);

  const COLORS = [primaryColor, '#4ade80', '#facc15', '#f87171', '#c084fc', '#fb923c'];

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (timeMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (timeMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentDate(newDate);
  };

  return (
    <div className="h-full flex flex-col px-6 pb-32 pt-2 overflow-y-auto bg-transparent custom-scrollbar">
      {/* Top Toggle */}
      <div className="flex justify-center mb-4 shrink-0">
        <div className="bg-white backdrop-blur-xl rounded-2xl p-1 shadow-lg shadow-gray-200/40 border border-white flex items-center">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setTimeMode('month')}
            className={`px-8 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${timeMode === 'month' ? 'shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            style={{ backgroundColor: timeMode === 'month' ? primaryColor : 'transparent', color: timeMode === 'month' ? getContrastColor(primaryColor) : undefined }}
          >
            月檢視
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setTimeMode('year')}
            className={`px-8 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${timeMode === 'year' ? 'shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            style={{ backgroundColor: timeMode === 'year' ? primaryColor : 'transparent', color: timeMode === 'year' ? getContrastColor(primaryColor) : undefined }}
          >
            年檢視
          </motion.button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="flex justify-between items-center mb-4 shrink-0 px-2">
        <motion.button 
          whileTap={{ scale: 0.8 }}
          onClick={handlePrev} 
          className="w-10 h-10 bg-white backdrop-blur-md rounded-2xl flex items-center justify-center shadow-md border border-white text-gray-600 transition-all active:bg-gray-50"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
        </motion.button>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-0.5">
            {timeMode === 'month' ? 'Monthly Report' : 'Yearly Report'}
          </span>
          <h2 className="text-xl font-black tracking-tighter" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>
            {timeMode === 'month' ? `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月` : `${currentDate.getFullYear()}年度`}
          </h2>
        </div>
        <motion.button 
          whileTap={{ scale: 0.8 }}
          onClick={handleNext} 
          className="w-10 h-10 bg-white backdrop-blur-md rounded-2xl flex items-center justify-center shadow-md border border-white text-gray-600 transition-all active:bg-gray-50"
        >
          <ChevronDown className="w-4 h-4 -rotate-90" />
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/60 backdrop-blur-md rounded-2xl p-1 mb-4 shrink-0 border border-white/50">
        <button 
          onClick={() => setViewMode('winLoss')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black transition-all rounded-xl uppercase tracking-wider ${viewMode === 'winLoss' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          style={{ color: viewMode === 'winLoss' ? primaryColor : undefined }}
        >
          <PieChartIcon className="w-3 h-3" />
          勝負比例
        </button>
        <button 
          onClick={() => setViewMode('basePoint')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black transition-all rounded-xl uppercase tracking-wider ${viewMode === 'basePoint' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          style={{ color: viewMode === 'basePoint' ? primaryColor : undefined }}
        >
          <BarChart2 className="w-3 h-3" />
          底台分析
        </button>
      </div>

      {/* Chart Area */}
      <motion.div 
        layout
        className="flex-1 bg-white backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-gray-200/40 border border-white p-4 flex flex-col overflow-hidden mb-4 relative min-h-[300px]"
      >
        <div className="flex-1 relative shrink-0">
          {filteredRecords.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm font-medium">
              {timeMode === 'month' ? '這個月還沒有任何戰績' : '今年還沒有任何戰績'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={viewMode === 'winLoss' ? winLossData : basePointData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40} // 縮小內半徑
                  outerRadius={65} // 縮小外半徑
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  labelLine={true}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                    const RADIAN = Math.PI / 180;
                    const sin = Math.sin(-RADIAN * midAngle);
                    const cos = Math.cos(-RADIAN * midAngle);
                    // 縮短文字延伸的線條長度
                    const sx = cx + (outerRadius + 2) * cos;
                    const sy = cy + (outerRadius + 2) * sin;
                    const mx = cx + (outerRadius + 15) * cos;
                    const my = cy + (outerRadius + 15) * sin;
                    const ex = mx + (cos >= 0 ? 1 : -1) * 10;
                    const ey = my;
                    const textAnchor = cos >= 0 ? 'start' : 'end';

                    return (
                      <g>
                        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#9ca3af" fill="none" strokeWidth={1} />
                        <text x={ex + (cos >= 0 ? 1 : -1) * 4} y={ey} dy={4} textAnchor={textAnchor} fill="#4b5563" fontSize={10} fontWeight="bold">
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      </g>
                    );
                  }}
                >
                  {(viewMode === 'winLoss' ? winLossData : basePointData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={viewMode === 'winLoss' ? entry.color : COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  formatter={(value: number, name: string, props: any) => {
                    if (viewMode === 'winLoss') return [`${value} 局`, name];
                    const actual = props.payload.actualValue;
                    return [`${actual >= 0 ? '+' : '-'}$${Math.abs(actual).toLocaleString()}`, name];
                  }}
                />
                {/* 縮小圖例文字 */}
                <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', color: '#374151', paddingTop: '5px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {/* Summary Stats */}
      {filteredRecords.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
          <div className="bg-white backdrop-blur-xl rounded-3xl p-4 shadow-lg shadow-gray-200/30 border border-white flex flex-col items-center justify-center">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">勝率</span>
            <span className="text-2xl font-black text-gray-900 tracking-tighter">
              {((winCount / (winCount + loseCount || 1)) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="bg-white backdrop-blur-xl rounded-3xl p-4 shadow-lg shadow-gray-200/30 border border-white flex flex-col items-center justify-center">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">淨輸贏</span>
            <span className="text-2xl font-black tracking-tighter" style={{ color: primaryColor }}>
              {filteredRecords.reduce((acc, r) => acc + (r.resultType === 'win' ? r.amount : -r.amount), 0) >= 0 ? '+' : '-'}${Math.abs(filteredRecords.reduce((acc, r) => acc + (r.resultType === 'win' ? r.amount : -r.amount), 0)).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Detailed Data */}
      <div className="shrink-0 mb-3 px-4 flex items-center justify-between" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>
        <div className="flex items-center gap-2">
          <LayoutList className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">詳細數據</span>
        </div>
        <span className="text-[10px] font-bold text-gray-400">共 {filteredRecords.length} 筆</span>
      </div>
      
      <div className="bg-white backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-gray-200/40 border border-white p-6 flex flex-col overflow-hidden shrink-0 max-h-[200px] mx-1">
        {filteredRecords.length === 0 ? (
          <div className="text-center text-gray-400 text-xs py-8 font-bold italic">目前沒有資料</div>
        ) : (
          <div className="overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {viewMode === 'winLoss' ? (
              <>
                <div className="flex justify-between items-center px-2 py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                    <span className="text-sm font-bold text-gray-700">贏局</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black" style={{ color: primaryColor }}>{winCount} 局</span>
                    <span className="text-[9px] font-bold text-gray-400">佔比 {((winCount / (winCount + loseCount || 1)) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center px-2 py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor, opacity: 0.5 }}></div>
                    <span className="text-sm font-bold text-gray-700">輸局</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black" style={{ color: primaryColor, opacity: 0.8 }}>{loseCount} 局</span>
                    <span className="text-[9px] font-bold text-gray-400">佔比 {((loseCount / (winCount + loseCount || 1)) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center px-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">總計勝率</span>
                    <span className="text-[9px] font-bold text-gray-300">Total Win Percentage</span>
                  </div>
                  <span className="text-xl font-black tracking-tighter" style={{ color: primaryColor }}>
                    {((winCount / (winCount + loseCount || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              </>
            ) : (
              basePointData.map((item, idx) => (
                <div key={item.name} className="flex justify-between items-center px-2 py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                    <span className="text-sm font-bold text-gray-700">{item.name}</span>
                  </div>
                  <span className={`text-sm font-black ${item.isWin ? '' : 'text-[#4ade80]'}`} style={{ color: item.isWin ? primaryColor : undefined }}>
                    {item.isWin ? '+' : '-'}${Math.abs(item.actualValue).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreView({ primaryColor, bgColor }: { primaryColor: string, bgColor: string }) {
  const [base, setBase] = useState('30');
  const [tai, setTai] = useState('10');
  const [taiCount, setTaiCount] = useState('0');
  const [isSelfDraw, setIsSelfDraw] = useState(false);

  const scoreResult = parseInt(base || '0') + (parseInt(tai || '0') * parseInt(taiCount || '0'));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-10"
    >
      <div className="bg-white backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/40 border border-white">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: primaryColor }}></div>
          <h2 className="font-black text-sm uppercase tracking-widest" style={{ color: primaryColor }}>算分計算機</h2>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">底</label>
              <input 
                type="number" 
                value={base}
                onChange={e => setBase(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-black text-lg outline-none focus:ring-4 transition-all"
                style={{ '--tw-ring-color': `${primaryColor}1a` } as any}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">台</label>
              <input 
                type="number" 
                value={tai}
                onChange={e => setTai(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-black text-lg outline-none focus:ring-4 transition-all"
                style={{ '--tw-ring-color': `${primaryColor}1a` } as any}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">總台數</label>
            <div className="relative">
              <input 
                type="number" 
                value={taiCount}
                onChange={e => setTaiCount(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-5 font-black text-2xl outline-none focus:ring-4 transition-all"
                style={{ color: primaryColor, '--tw-ring-color': `${primaryColor}1a` } as any}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex gap-2">
                <button onClick={() => setTaiCount(prev => Math.max(0, parseInt(prev || '0') - 1).toString())} className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-gray-400 hover:text-gray-600">-</button>
                <button onClick={() => setTaiCount(prev => (parseInt(prev || '0') + 1).toString())} className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-gray-400 hover:text-gray-600">+</button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex flex-col">
              <span className="text-xs font-black text-gray-900">自摸模式 Self-draw</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">一人付全額 / 三人各付</span>
            </div>
            <button 
              onClick={() => setIsSelfDraw(!isSelfDraw)}
              className={`w-14 h-8 rounded-full relative transition-all ${isSelfDraw ? '' : 'bg-gray-200'}`}
              style={isSelfDraw ? { backgroundColor: primaryColor } : {}}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all ${isSelfDraw ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">計算結果</span>
                <span className="text-sm font-bold text-gray-900">{isSelfDraw ? '每人應付' : '放槍應付'}</span>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black text-gray-900 tracking-tighter">${scoreResult.toLocaleString()}</span>
                {isSelfDraw && (
                  <div className="text-[10px] font-black mt-1 uppercase tracking-widest" style={{ color: primaryColor }}>總計 ${ (scoreResult * 3).toLocaleString() }</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 台數參考表 */}
      <div className="bg-white backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/40 border border-white">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
          <h2 className="font-black text-sm uppercase tracking-widest" style={{ color: primaryColor }}>台數參考表</h2>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            { name: '莊家', tai: '1' }, { name: '連一拉一', tai: '3' },
            { name: '連二拉二', tai: '5' }, { name: '連三拉三', tai: '7' },
            { name: '門清', tai: '1' }, { name: '自摸', tai: '1' },
            { name: '門清自摸', tai: '3' }, { name: '中洞/邊張/單調', tai: '1' },
            { name: '碰碰胡', tai: '4' }, { name: '混一色', tai: '4' },
            { name: '清一色', tai: '8' }, { name: '三暗刻', tai: '2' },
            { name: '四暗刻', tai: '5' }, { name: '五暗刻', tai: '8' },
            { name: '大三元', tai: '8' }, { name: '小三元', tai: '4' },
            { name: '大四喜', tai: '16' }, { name: '小四喜', tai: '8' },
            { name: '全求人', tai: '2' }, { name: '槓上開花', tai: '1' },
            { name: '花牌/字牌', tai: '1' }, { name: '中發白', tai: '1' }
          ].map(item => (
            <div key={item.name} className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-[11px] font-bold text-gray-600">{item.name}</span>
              <span className="text-[11px] font-black text-emerald-500">{item.tai} 台</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-gray-400 mt-4 italic font-bold uppercase tracking-widest opacity-60">* 連n拉n計算公式：1 + 2n 台</p>
      </div>
    </motion.div>
  );
}

function TenpaiView({ primaryColor, bgColor }: { primaryColor: string, bgColor: string }) {
  const [selectedTiles, setSelectedTiles] = useState<string[]>([]);
  const [results, setResults] = useState<{ waiting: string[], count: number } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [mode, setMode] = useState<13 | 16>(16);

  const tongTiles = ['1筒', '2筒', '3筒', '4筒', '5筒', '6筒', '7筒', '8筒', '9筒'];
  const tiaoTiles = ['1條', '2條', '3條', '4條', '5條', '6條', '7條', '8條', '9條'];
  const wanTiles = ['一萬', '二萬', '三萬', '四萬', '五萬', '六萬', '七萬', '八萬', '九萬'];
  const ziTiles = ['東', '南', '西', '北', '中', '發', '白'];
  const allTileTypes = [...tongTiles, ...tiaoTiles, ...wanTiles, ...ziTiles];

  const addTile = (tile: string) => {
    if (selectedTiles.length < mode) {
      const count = selectedTiles.filter(t => t === tile).length;
      if (count < 4) {
        setSelectedTiles([...selectedTiles, tile].sort((a, b) => allTileTypes.indexOf(a) - allTileTypes.indexOf(b)));
        setResults(null);
      }
    }
  };

  const removeTile = (index: number) => {
    const newTiles = [...selectedTiles];
    newTiles.splice(index, 1);
    setSelectedTiles(newTiles);
    setResults(null);
  };

  const calculateTenpai = () => {
    if (selectedTiles.length !== mode) return;
    setIsCalculating(true);
    setTimeout(() => {
      const waiting: string[] = [];
      for (const tile of allTileTypes) {
        const testHand = [...selectedTiles, tile];
        const counts = new Array(34).fill(0);
        testHand.forEach(t => {
          counts[allTileTypes.indexOf(t)]++;
        });
        if (counts[allTileTypes.indexOf(tile)] > 4) continue;
        if (canWin(counts)) {
          waiting.push(tile);
        }
      }
      let totalRemaining = 0;
      waiting.forEach(tile => {
        const inHandCount = selectedTiles.filter(t => t === tile).length;
        totalRemaining += Math.max(0, 4 - inHandCount);
      });
      setResults({ waiting, count: totalRemaining });
      setIsCalculating(false);
    }, 500);
  };

  const canWin = (counts: number[]): boolean => {
    for (let i = 0; i < 34; i++) {
      if (counts[i] >= 2) {
        counts[i] -= 2;
        if (isAllSets(counts)) {
          counts[i] += 2;
          return true;
        }
        counts[i] += 2;
      }
    }
    return false;
  };

  const isAllSets = (counts: number[]): boolean => {
    let first = -1;
    for (let i = 0; i < 34; i++) {
      if (counts[i] > 0) { first = i; break; }
    }
    if (first === -1) return true;
    if (counts[first] >= 3) {
      counts[first] -= 3;
      if (isAllSets(counts)) { counts[first] += 3; return true; }
      counts[first] += 3;
    }
    if (first < 27 && first % 9 < 7) {
      if (counts[first + 1] > 0 && counts[first + 2] > 0) {
        counts[first]--; counts[first + 1]--; counts[first + 2]--;
        if (isAllSets(counts)) { counts[first]++; counts[first + 1]++; counts[first + 2]++; return true; }
        counts[first]++; counts[first + 1]++; counts[first + 2]++;
      }
    }
    return false;
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden pb-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white backdrop-blur-xl p-6 rounded-[2.5rem] shadow-xl shadow-gray-200/40 border border-white"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
            <h2 className="font-black text-sm uppercase tracking-widest" style={{ color: primaryColor }}>你的手牌</h2>
          </div>
          <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
            <button onClick={() => setMode(13)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${mode === 13 ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}>13張</button>
            <button onClick={() => setMode(16)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${mode === 16 ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'}`}>16張</button>
          </div>
        </div>
        
        <p className="text-gray-400 text-[10px] font-bold leading-relaxed mb-6 uppercase tracking-wider">
          請從下方的「所有牌組」中選擇你要查詢的牌型。選好後，按一下「查詢」就能看到聽牌結果
        </p>
        
        <div className="bg-gray-50/50 rounded-3xl p-4 min-h-[140px] border border-gray-100 mb-6 relative group/hand">
          <div className="flex flex-wrap gap-1.5 justify-center">
            <AnimatePresence>
              {selectedTiles.map((tile, idx) => {
                const type = tile.includes('萬') ? 'wan' : tile.includes('筒') ? 'tong' : tile.includes('條') ? 'tiao' : 'zi';
                return (
                  <motion.div 
                    key={`${tile}-${idx}`}
                    initial={{ opacity: 0, scale: 0.5, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="relative group"
                  >
                    <TileButton label={tile} onClick={() => removeTile(idx)} type={type as any} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {selectedTiles.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-[10px] font-black uppercase tracking-[0.2em] italic">
                Select tiles below
              </div>
            )}
          </div>
          <div className="absolute bottom-2 right-3 flex items-center gap-3">
            {selectedTiles.length > 0 && (
              <button 
                onClick={() => { setSelectedTiles([]); setResults(null); }} 
                className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors shadow-sm"
                title="清除全部"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="text-[10px] font-black text-gray-300 tracking-[0.2em]">{selectedTiles.length} / {mode}</div>
          </div>
        </div>

        <AnimatePresence>
          {results && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-6 p-4 bg-orange-50/50 backdrop-blur-sm rounded-3xl border border-orange-100 flex items-center justify-between"
            >
              <div className="flex-1">
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-2">聽牌結果</p>
                <div className="flex flex-wrap gap-1.5">
                  {results.waiting.map(t => {
                    const type = t.includes('萬') ? 'wan' : t.includes('筒') ? 'tong' : t.includes('條') ? 'tiao' : 'zi';
                    return (
                      <div key={t} className="bg-white rounded-lg p-0.5 shadow-sm border border-orange-100 scale-[0.85] origin-left">
                        <TileButton label={t} onClick={() => {}} type={type as any} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-right ml-2 shrink-0">
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-1">剩餘</p>
                <p className="text-3xl font-black text-orange-700 leading-none tracking-tighter">{results.count}<span className="text-[10px] ml-0.5">張</span></p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 所有牌組選取器 */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex gap-6 mb-4">
            <div className="relative">
              <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">所有牌組</span>
              <div className="absolute -bottom-1.5 left-0 w-full h-1 bg-orange-500 rounded-full"></div>
            </div>
          </div>

          <div className="space-y-4">
            {/* 萬子 */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">萬子</p>
              <div className="grid grid-cols-9 gap-1">
                {wanTiles.map(t => (
                  <TileButton key={t} label={t} onClick={() => addTile(t)} type="wan" />
                ))}
              </div>
            </div>
            
            {/* 筒子 */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">筒子</p>
              <div className="grid grid-cols-9 gap-1">
                {tongTiles.map(t => (
                  <TileButton key={t} label={t} onClick={() => addTile(t)} type="tong" />
                ))}
              </div>
            </div>

            {/* 條子 */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">條子</p>
              <div className="grid grid-cols-9 gap-1">
                {tiaoTiles.map(t => (
                  <TileButton key={t} label={t} onClick={() => addTile(t)} type="tiao" />
                ))}
              </div>
            </div>

            {/* 字牌 */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">字牌</p>
              <div className="grid grid-cols-7 gap-1">
                {ziTiles.map(t => (
                  <TileButton key={t} label={t} onClick={() => addTile(t)} type="zi" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={calculateTenpai}
          disabled={selectedTiles.length !== mode || isCalculating}
          className={`w-full mt-8 font-black py-5 rounded-[1.5rem] shadow-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] ${
            selectedTiles.length !== mode || isCalculating
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-orange-500 text-white shadow-orange-500/30 hover:bg-orange-600'
          }`}
        >
          {isCalculating ? 'Calculating...' : '查詢聽牌結果'}
        </motion.button>
      </motion.div>
    </div>
  );
}


function LobbyView({ user, tables, onOpenAddTable, onEditTable, onDeleteTable, onApplyTable, onAcceptApplication, onRejectApplication, onOpenChat, primaryColor, bgColor, filterCity, setFilterCity, filterDistrict, setFilterDistrict }: { user: User, tables: TableRecord[], onOpenAddTable: () => void, onEditTable: (table: TableRecord) => void, onDeleteTable: (id: string | number) => void, onApplyTable: (tableId: string | number) => void, onAcceptApplication: (tableId: string | number, applicationId: string) => void, onRejectApplication: (tableId: string | number, applicationId: string) => void, onOpenChat: (otherUserId: string, otherUserName: string, otherUserAvatar: string) => void, primaryColor: string, bgColor: string, filterCity: string, setFilterCity: (city: string) => void, filterDistrict: string, setFilterDistrict: (district: string) => void }) {
  
  const [distance, setDistance] = useState(16);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'tomorrow'>('all');

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleLocate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLocating(true);
    try {
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          setIsLocating(false); return;
        }
      }
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      setIsLocating(false);
    } catch (error: any) {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    handleLocate({ stopPropagation: () => {} } as React.MouseEvent);
  }, []);

  // 🔍 終極透視鏡：加上縣市過濾 + 滿桌 5 分鐘自動隱藏
  // 🔍 終極透視鏡：先算距離，再過濾縣市與距離，最後排序！
  const filteredTables = tables.map(t => {
    // 🌟 第一步：先幫每張桌子算好距離
    let dist = null;
    if (userLocation && t.latitude && t.longitude) {
      dist = calculateDistance(userLocation.lat, userLocation.lng, t.latitude, t.longitude);
    }
    return { ...t, distanceToMe: dist, isOwn: t.hostId === user.id };
  }).filter(t => {
    // 🌟 第二步：警衛開始檢查！
    
    // 1. 縣市與區域過濾
    if (filterCity !== '全部' && t.city !== filterCity) return false;
    if (filterDistrict !== '全部' && t.district !== filterDistrict) return false;
    
    // 2. 距離過濾 (攔截網正式生效！)
    // 如果有算出距離，且距離大於拉桿的 distance (你的變數叫 distance)，就擋掉！
    if (t.distanceToMe !== null && t.distanceToMe > distance) {
      return false; 
    }

    // 3. 滿桌(缺0人)立刻隱藏！(別人大廳立刻看不見)
    if (t.missing === 0 && !t.isOwn) {
      return false; 
    }
    
    // 4. 時間過濾 (今天/明天)
    if (filterDate !== 'all') {
      const today = new Date();
      const targetDate = new Date(today);
      if (filterDate === 'tomorrow') {
        targetDate.setDate(today.getDate() + 1);
      }
      const dateStr = targetDate.toISOString().split('T')[0];
      if (t.date !== dateStr) return false;
    }
    
    return true;
  }).sort((a, b) => {
    // 🌟 第三步：排序 (最新的放上面)
    return (b.id as number) - (a.id as number); 
  });

  return (
    <div className="h-full flex flex-col pt-4 bg-transparent">
      <div className="px-6 space-y-3 mb-4">
        
        {/* 🌟 狀態提醒 */}
        {!userLocation && (
          <div className="bg-red-50 text-red-500 text-[10px] font-black px-4 py-2 rounded-xl mb-2 flex items-center justify-between">
            <span>⚠️ 尚未獲取您的定位，無法計算附近距離</span>
            <button onClick={handleLocate} className="underline">重新定位</button>
          </div>
        )}

        <div className="flex gap-3">
          <motion.div whileTap={{ scale: 0.98 }} onClick={() => setShowFilters(!showFilters)} className="flex-1 flex justify-between items-center bg-white backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-white cursor-pointer">
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest" style={{ color: primaryColor }}>
              <motion.button whileTap={{ scale: 0.8 }} onClick={handleLocate} className={`p-1.5 rounded-full transition-colors shadow-sm border ${userLocation ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`} title="使用 GPS 定位">
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              </motion.button>
              <span>{filterCity} {filterDistrict !== '全部' ? filterDistrict : ''}</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </motion.div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onOpenAddTable} className="px-8 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all" style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor), boxShadow: `0 10px 20px ${primaryColor}4d` }}>
            開桌
          </motion.button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white backdrop-blur-xl rounded-2xl shadow-lg border border-white p-4 space-y-4">
              <div className="flex bg-gray-100 rounded-xl p-1">
                {(['all', 'today', 'tomorrow'] as const).map((d) => (
                  <button key={d} onClick={() => setFilterDate(d)} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${filterDate === d ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`} style={{ color: filterDate === d ? primaryColor : undefined }}>
                    {d === 'all' ? '全部' : d === 'today' ? '今天' : '明天'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 ml-1">縣市</label>
                  <select value={filterCity} onChange={(e) => { setFilterCity(e.target.value); setFilterDistrict('全部'); }} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none">
                    <option value="全部">全部縣市</option>
                    {Object.keys(TAIWAN_REGIONS).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 ml-1">區域</label>
                  <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none" disabled={filterCity === '全部'}>
                    <option value="全部">全部區域</option>
                    {filterCity !== '全部' && TAIWAN_REGIONS[filterCity].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black text-gray-400">距離範圍</label>
                  <span className="text-[10px] font-black" style={{ color: primaryColor }}>{distance} km</span>
                </div>
                <input type="range" min="1" max="25" value={distance} onChange={(e) => setDistance(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer" style={{ accentColor: primaryColor }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-5 custom-scrollbar">
        {filteredTables.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 font-black text-sm italic">目前沒有符合條件的牌局</p>
          </div>
        ) : (
          filteredTables.map((table, idx) => (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={table.id} className={`bg-white backdrop-blur-xl rounded-[2.5rem] p-6 shadow-xl border relative overflow-hidden mx-1 ${table.isOwn ? 'ring-2' : 'border-white'}`} style={table.isOwn ? { borderColor: `${primaryColor}4d`, '--tw-ring-color': `${primaryColor}1a` } as any : {}}>
              {table.isOwn && <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: primaryColor }}></div>}
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={table.avatar} alt={table.host} className="w-12 h-12 rounded-2xl bg-gray-200 object-cover shadow-md" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-base">{table.host}</h3>
                    <div className="text-[10px] font-black text-gray-400 mt-1">{table.city} · {table.district}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg bg-red-500">缺 {table.missing} 人</div>
                  {table.isOwn && (
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => onEditTable(table)} className="text-gray-400 p-2 bg-gray-50 rounded-xl shadow-sm"><Pencil className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteTable(table.id); }} className="text-gray-400 p-2 bg-gray-50 rounded-xl shadow-sm hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                  <span className="bg-gray-100 px-3 py-1.5 rounded-xl text-gray-600 flex gap-2"><span>{table.date.slice(5).replace('-', '/')}</span><span>{table.time}</span></span>
                  <span className="truncate max-w-[150px]">{table.location}</span>
                  {/* 🌟 距離標籤 */}
                  {table.distanceToMe !== null && (
                    <span className="ml-auto text-[10px] font-black px-2 py-1 rounded-lg" style={{ backgroundColor: `${primaryColor}1a`, color: primaryColor }}>
                      距您 {table.distanceToMe.toFixed(1)} km
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-lg font-black text-gray-900">
                  <span style={{ color: primaryColor }}>{table.base}</span>
                  <div className="w-1.5 h-1.5 bg-gray-200 rounded-full"></div>
                  <span>{table.rule}</span>
                </div>
              </div>
              
              {/* 🌟 滿血復活的底部邏輯區塊 */}
              {table.isOwn ? (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">報名名單</h4>
                  {(!table.applications || table.applications.length === 0) ? (
                    <p className="text-sm text-gray-400 font-bold text-center py-2">目前尚無人報名</p>
                  ) : (
                    <div className="space-y-3">
                      {table.applications.map(app => (
                        <div key={app.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <img src={app.avatar} alt={app.userName} className="w-8 h-8 rounded-full bg-gray-200 object-cover" />
                            <span className="font-bold text-gray-900 text-sm">{app.userName}</span>
                          </div>
                          {app.status === 'pending' && table.missing > 0 ? (
                            <div className="flex gap-2">
                              <button onClick={() => onAcceptApplication(table.id, app.id)} className="px-3 py-1.5 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-sm transition-colors" style={{ backgroundColor: primaryColor }}>同意</button>
                              <button onClick={() => onRejectApplication(table.id, app.id)} className="px-3 py-1.5 bg-gray-200 text-gray-600 text-[10px] font-black rounded-lg uppercase tracking-widest shadow-sm hover:bg-gray-300 transition-colors">婉拒</button>
                            </div>
                          ) : (
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${app.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                              {app.status === 'accepted' ? '已同意' : '已婉拒'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  {(() => {
                    const myApp = table.applications?.find(app => app.userId === user.id);
                    if (myApp) {
                      if (myApp.status === 'pending') {
                        return <div className="flex-1 font-black py-4 rounded-2xl bg-gray-100 text-gray-400 text-center uppercase tracking-[0.2em] text-xs">審核中 PENDING</div>;
                      } else if (myApp.status === 'accepted') {
                        return <div className="flex-1 font-black py-4 rounded-2xl bg-emerald-50 text-emerald-600 text-center uppercase tracking-[0.2em] text-xs border border-emerald-200">報名成功 ACCEPTED</div>;
                      } else {
                        return <div className="flex-1 font-black py-4 rounded-2xl bg-red-50 text-red-500 text-center uppercase tracking-[0.2em] text-xs border border-red-200">已婉拒 REJECTED</div>;
                      }
                    } else if (table.missing === 0) {
                      return <div className="flex-1 font-black py-4 rounded-2xl bg-gray-100 text-gray-400 text-center uppercase tracking-[0.2em] text-xs">已滿桌 FULL</div>;
                    } else {
                      return (
                        <motion.button 
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-[0.2em] text-xs"
                          style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor), boxShadow: `0 10px 20px ${primaryColor}4d` }}
                          onClick={() => onApplyTable(table.id)}
                        >
                          立即報名 JOIN NOW
                        </motion.button>
                      );
                    }
                  })()}
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    className="bg-white border border-gray-200 text-gray-900 p-4 rounded-2xl hover:bg-gray-50 shadow-md transition-all"
                    onClick={() => onOpenChat(table.hostId, table.host, table.avatar)}
                    title="私訊問詳情"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

const MAHJONG_BADGES = [
  '天選之人',
  '最愛清一色',
  '門清一摸三',
  '海底撈月',
  '槓上開花',
  '碰碰胡',
  '國士無雙',
  '牌桌魔術師',
  '聽牌達人',
  '連莊王',
  '防守大師',
  '自摸機器',
  '大三元',
  '大四喜',
  '字一色',
  '清一色',
  '九蓮寶燈',
  '十八羅漢',
  '天胡',
  '地胡',
  '人胡'
];

function ProfileView({ user, onUpdateUser, onLogout, records, conversations, onOpenChat, primaryColor, bgColor }: { user: User, onUpdateUser: (u: User) => void, onLogout: () => void, records: MatchRecord[], conversations: Conversation[], onOpenChat: (otherUserId: string, otherUserName: string, otherUserAvatar: string) => void, primaryColor: string, bgColor: string }) {
// 優先使用雲端來的 user.tags，如果沒有才給空陣列或預設值
  const [selectedBadges, setSelectedBadges] = useState<string[]>(user.tags || []);  const [isEditingBadges, setIsEditingBadges] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editEmail, setEditEmail] = useState(user.email || '');
  const [editBirthday, setEditBirthday] = useState(user.birthday || '');
  useEffect(() => {
    if (user.tags) {
      setSelectedBadges(user.tags);
    }
  }, [user.tags]);
  const totalGames = records.length;
  const winGames = records.filter(r => r.resultType === 'win').length;
  const winRate = totalGames > 0 ? ((winGames / totalGames) * 100).toFixed(1) + '%' : '0%';

  const handleSaveProfile = () => {
    onUpdateUser({
      ...user,
      name: editName,
      phone: editPhone,
      email: editEmail,
      birthday: editBirthday
    });
    setIsEditingProfile(false);
  };

  return (
    <div className="h-full overflow-y-auto px-6 pb-32 pt-4 space-y-8 custom-scrollbar relative">
      {/* 個人資料卡片 */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/40 border border-white flex flex-col gap-6"
      >
        <div className="flex items-center gap-6">
          <div className="relative">
            <input 
              type="file"
              accept="image/*"
              id="avatar-upload"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    onUpdateUser({ ...user, avatar: reader.result as string });
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <label htmlFor="avatar-upload" className="cursor-pointer block relative group">
              <img src={user.avatar} alt="Avatar" className="w-24 h-24 rounded-[2rem] object-cover border-4 border-white shadow-lg transition-transform group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/20 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-white" />
              </div>
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <h2 className="text-3xl font-black tracking-tighter" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>{user.name}</h2>
              <button onClick={() => setIsEditingProfile(!isEditingProfile)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                <Settings className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar whitespace-nowrap pb-1 -mx-2 px-2">
              {selectedBadges.map(badge => (
                <span key={badge} className="text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border shrink-0" style={{ backgroundColor: `${primaryColor}1a`, color: primaryColor, borderColor: `${primaryColor}33` }}>
                  {badge}
                </span>
              ))}
              <button 
                onClick={() => setIsEditingBadges(true)}
                className="text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border border-dashed border-gray-300 text-gray-400 hover:bg-gray-50 shrink-0 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                新增稱號
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isEditingProfile && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-4 pt-4 border-t border-gray-100"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">用戶名</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-2 bg-gray-50 rounded-xl font-bold text-gray-900 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">電話 (僅自己可見)</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full p-2 bg-gray-50 rounded-xl font-bold text-gray-900 outline-none" placeholder="未設定" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">信箱 (僅自己可見)</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full p-2 bg-gray-50 rounded-xl font-bold text-gray-900 outline-none" placeholder="未設定" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">生日 (僅自己可見)</label>
                <input type="date" value={editBirthday} onChange={e => setEditBirthday(e.target.value)} className="w-full p-2 bg-gray-50 rounded-xl font-bold text-gray-900 outline-none" />
              </div>
              <button onClick={handleSaveProfile} className="w-full py-3 rounded-xl bg-black text-white font-bold shadow-lg shadow-gray-200 mt-2">
                儲存變更
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 數據統計 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '總局數 Total', value: totalGames.toString() },
          { label: '勝率 Win Rate', value: winRate },
          { label: '被檢舉 Reports', value: '0' },
        ].map((stat, idx) => (
          <motion.div 
            key={stat.label} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.05 }}
            className="bg-white backdrop-blur-xl p-5 rounded-3xl shadow-lg shadow-gray-200/30 border border-white text-center"
          >
            <p className="text-[8px] font-black text-gray-400 mb-2 uppercase tracking-[0.2em] leading-tight">{stat.label}</p>
            <p className="text-xl font-black text-gray-900 tracking-tighter">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* 我的訊息 */}
      <div className="bg-white backdrop-blur-xl p-6 rounded-[2.5rem] shadow-xl shadow-gray-200/40 border border-white">
        <h3 className="text-lg font-black tracking-tight mb-4" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>我的訊息 MESSAGES</h3>
        {conversations.length === 0 ? (
          <p className="text-gray-400 font-black text-xs uppercase tracking-widest italic text-center py-6">目前沒有任何訊息</p>
        ) : (
          <div className="space-y-3">
            {conversations.map(conv => {
              const otherUser = conv.participants.find(p => p.id !== user.id);
              if (!otherUser) return null;
              const lastMessage = conv.messages[conv.messages.length - 1];
              
              return (
                <motion.div 
                  key={conv.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onOpenChat(otherUser.id, otherUser.name, otherUser.avatar)}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <img src={otherUser.avatar} alt={otherUser.name} className="w-12 h-12 rounded-full object-cover bg-gray-200" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold text-gray-900 truncate">{otherUser.name}</h4>
                      <div className="flex items-center gap-2 shrink-0">
                        {conv.unreadCount && conv.unreadCount > 0 ? (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        ) : null}
                        {lastMessage && (
                          <span className="text-[10px] text-gray-400 font-bold">
                            {new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className={`text-xs truncate ${conv.unreadCount && conv.unreadCount > 0 ? 'font-black text-gray-900' : 'font-medium text-gray-500'}`}>
                      {lastMessage ? lastMessage.text : '尚無訊息'}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🔥 新增：登出按鈕 */}
      <div className="shrink-0 pt-4 mb-4">
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={onLogout}
          className="w-full py-4 rounded-2xl bg-red-50 text-red-500 font-black text-sm uppercase tracking-widest border border-red-100 shadow-sm transition-colors hover:bg-red-100"
        >
          登出帳號 LOGOUT
        </motion.button>
      </div>

      {/* 稱號編輯彈窗 */}
      <AnimatePresence>
        {isEditingBadges && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setIsEditingBadges(false)}
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full h-[85%] bg-white rounded-t-[2.5rem] p-6 pb-[110px] shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">選擇稱號</h3>
                <button onClick={() => setIsEditingBadges(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <p className="text-xs font-bold text-gray-400 mb-4 shrink-0">最多選擇 3 個稱號展示在個人主頁上</p>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="flex flex-wrap gap-2">
                  {MAHJONG_BADGES.map(badge => {
                    const isSelected = selectedBadges.includes(badge);
                    return (
                      <motion.button
                        key={badge}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedBadges(selectedBadges.filter(b => b !== badge));
                          } else if (selectedBadges.length < 3) {
                            setSelectedBadges([...selectedBadges, badge]);
                          }
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                          isSelected 
                            ? 'shadow-md' 
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        style={isSelected ? { 
                          backgroundColor: `${primaryColor}1a`, 
                          color: primaryColor, 
                          borderColor: `${primaryColor}4d` 
                        } : {}}
                      >
                        {badge}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

<div className="shrink-0 mt-6 pt-4 border-t border-gray-100">
                <motion.button 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    // 1. 關閉彈窗
                    setIsEditingBadges(false);
                    // 2. 🌟 關鍵救援：把選好的稱號，打包送上 Firebase 雲端！
                    onUpdateUser({
                      ...user,
                      tags: selectedBadges
                    });
                  }}
                  className="w-full font-black py-4 rounded-2xl shadow-xl transition-all text-sm uppercase tracking-widest"
                  style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor), boxShadow: `0 10px 20px ${primaryColor}4d` }}
                >
                  確認儲存
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HistoryView({ records, onClose, onEditRecord, onDeleteRecord, primaryColor, bgColor }: { records: MatchRecord[], onClose: () => void, onEditRecord: (record: MatchRecord) => void, onDeleteRecord: (id: string) => void, primaryColor: string, bgColor: string }) {
  const [dateFilter, setDateFilter] = useState('');
  const [basePointFilter, setBasePointFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'win' | 'lose'>('all');

  // 取得所有不重複的底台比供篩選
  const uniqueBasePoints = Array.from(new Set(records.map(r => r.basePoint))).filter(Boolean);

  // 根據條件篩選紀錄
  const filteredRecords = records.filter(r => {
    if (dateFilter && r.date !== dateFilter) return false;
    if (basePointFilter !== 'all' && r.basePoint !== basePointFilter) return false;
    if (resultFilter !== 'all' && r.resultType !== resultFilter) return false;
    return true;
  });

  // 計算篩選後的淨輸贏
  const filteredNet = filteredRecords.reduce((sum, r) => sum + (r.resultType === 'win' ? r.amount : -r.amount), 0);

  // 將篩選後的紀錄按日期分組
  const groupedRecords = filteredRecords.reduce((acc, record) => {
    if (!acc[record.date]) acc[record.date] = [];
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, MatchRecord[]>);

  // 日期由新到舊排序
  const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bgColor }}>
      <header className="flex-none flex justify-between items-center px-4 py-4 z-10" style={{ backgroundColor: bgColor }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="font-bold text-lg px-2 active:opacity-70" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>返回</motion.button>
        <h1 className="text-lg font-black tracking-tight" style={{ color: getThemeTextColor(bgColor, primaryColor) }}>歷史戰績 HISTORY</h1>
        <div className="w-12"></div>
      </header>

      <div className="flex-1 px-6 py-2 space-y-6 overflow-y-auto pb-32 custom-scrollbar">
        {/* 篩選後總計 */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-gray-100"
          style={{ boxShadow: `0 20px 40px ${primaryColor}1a` }}
        >
          <span className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-[0.2em]">篩選區間淨輸贏</span>
          <span className="text-4xl font-black tracking-tighter" style={{ color: primaryColor }}>
            {filteredNet >= 0 ? '+' : '-'}${Math.abs(filteredNet).toLocaleString()}
          </span>
        </motion.div>

        {/* 篩選器 */}
        <div className="bg-white backdrop-blur-xl rounded-[2rem] p-6 shadow-xl shadow-gray-200/30 border border-white space-y-5">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">日期</label>
              <input 
                type="date" 
                value={dateFilter} 
                onChange={e => setDateFilter(e.target.value)} 
                className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-xs outline-none font-black text-gray-900 focus:ring-4 transition-all" 
                style={{ '--tw-ring-color': `${primaryColor}1a` } as any}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">底台比</label>
              <select 
                value={basePointFilter} 
                onChange={e => setBasePointFilter(e.target.value)} 
                className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-xs outline-none font-black text-gray-900 appearance-none focus:ring-4 transition-all"
                style={{ '--tw-ring-color': `${primaryColor}1a` } as any}
              >
                <option value="all">全部 ALL</option>
                {uniqueBasePoints.map(bp => <option key={bp} value={bp}>{bp}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 mb-2 block uppercase tracking-widest">結果</label>
            <div className="flex bg-gray-100/50 p-1 rounded-xl border border-gray-100">
              <button onClick={() => setResultFilter('all')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${resultFilter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>全部</button>
              <button onClick={() => setResultFilter('win')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${resultFilter === 'win' ? 'bg-white shadow-sm' : 'text-gray-400'}`} style={resultFilter === 'win' ? { color: primaryColor } : {}}>贏 (+)</button>
              <button onClick={() => setResultFilter('lose')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${resultFilter === 'lose' ? 'bg-white shadow-sm' : 'text-gray-400'}`} style={resultFilter === 'lose' ? { color: primaryColor } : {}}>輸 (-)</button>
            </div>
          </div>
          {(dateFilter || basePointFilter !== 'all' || resultFilter !== 'all') && (
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => { setDateFilter(''); setBasePointFilter('all'); setResultFilter('all'); }} 
              className="w-full py-3 mt-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-[0.2em]"
              style={{ backgroundColor: `${primaryColor}1a`, color: primaryColor }}
            >
              清除篩選
            </motion.button>
          )}
        </div>

        {/* 列表 */}
        <div className="space-y-8 mt-6">
          {sortedDates.length === 0 ? (
            <div className="text-center text-gray-400 py-16 font-black uppercase tracking-[0.3em] italic text-xs">沒有找到紀錄</div>
          ) : (
            sortedDates.map(date => (
              <div key={date}>
                <h3 className="text-[10px] font-black text-gray-400 mb-4 px-2 uppercase tracking-[0.3em] flex items-center gap-2">
                  <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                  {date}
                </h3>
                <div className="space-y-4">
                  {groupedRecords[date].map((record, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={record.id} 
                      className="bg-white backdrop-blur-xl p-5 rounded-[2rem] shadow-lg shadow-gray-200/30 border border-white flex justify-between items-center mx-1"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-900 tracking-tight">{record.location || '未填寫地點'}</span>
                        <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{record.basePoint}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xl font-black tracking-tighter" style={{ color: primaryColor }}>
                          {record.resultType === 'win' ? '+' : '-'}${record.amount.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.button 
                            whileTap={{ scale: 0.8 }}
                            onClick={() => onEditRecord(record)} 
                            className="text-gray-400 transition-colors p-2 bg-gray-50 rounded-xl shadow-sm"
                            style={{ '--tw-text-opacity': 1 } as any}
                            onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
                            onMouseLeave={(e) => e.currentTarget.style.color = ''}
                          >
                            <Pencil className="w-4 h-4" />
                          </motion.button>
                          <motion.button 
                            whileTap={{ scale: 0.8 }}
                            onClick={() => onDeleteRecord(record.id)} 
                            className="text-gray-400 hover:text-red-500 transition-colors p-2 bg-gray-50 rounded-xl shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
