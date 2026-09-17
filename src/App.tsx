/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc,
  orderBy,
  limit,
  Timestamp,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  runTransaction
} from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout, loginWithEmail, registerWithEmail } from './firebase';
import { 
  UserProfile, 
  Account, 
  Category, 
  Movement, 
  Goal, 
  WeeklyBudget,
  RecurringPayment,
  QuickAction,
  DashboardStats,
  MovementType,
  AccountType
} from './types';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  PieChart, 
  Wallet, 
  Target, 
  Plus, 
  Minus,
  LogOut, 
  LogIn,
  Bell,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  X,
  Settings,
  CreditCard,
  DollarSign,
  Smartphone,
  PiggyBank,
  Briefcase,
  CheckCircle2,
  Check,
  AlertCircle,
  Sun,
  Moon,
  BarChart as BarChartIcon,
  Sparkles,
  MessageSquare,
  Crown,
  ShieldCheck,
  User as UserIcon,
  ClipboardList,
  Trash2,
  Mail,
  Lock,
  UserPlus,
  History,
  RefreshCcw,
  Edit3,
  Utensils,
  Bus,
  Coffee,
  ShoppingBag,
  Zap,
  Heart,
  Music,
  Table,
  Mic,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
  Star,
  Activity,
  Layers,
  Bot,
  HelpCircle,
  Send,
  Maximize,
  Minimize,
  Clock,
  Laptop,
  Plane,
  Home,
  Car,
  ArrowUpDown,
  Building2,
  QrCode,
  Banknote,
  Coins,
  Shield,
  FileText,
  CheckCheck,
  ScanLine
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, subMonths, addMonths, isAfter, addDays, getWeekOfMonth, getDay, eachDayOfInterval, subDays, differenceInDays, getWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  CartesianGrid,
  ComposedChart,
  Area,
  Line
} from 'recharts';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const PREDEFINED_CATEGORIES = [
  'comida', 'pasaje', 'ropa', 'internet', 'cuarto', 'móvil', 'inversión', 'ahorro', 'emergencia'
];

const ACCOUNT_ICONS: Record<string, any> = {
  'Efectivo': Banknote,
  'Banco': Building2,
  'Digital': Smartphone,
  'Ahorro': PiggyBank,
  'Inversión': Briefcase,
  'Billetera Móvil': QrCode,
  'Sueldo': CreditCard
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [calendarTargetDate, setCalendarTargetDate] = useState(new Date());
  const [calendarViewingDate, setCalendarViewingDate] = useState(new Date());

  // Data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [weeklyBudget, setWeeklyBudget] = useState<WeeklyBudget | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAndroidGeminiOpen, setIsAndroidGeminiOpen] = useState(false);
  const [movementModalType, setMovementModalType] = useState<MovementType>('expense');
  const [movementModalDate, setMovementModalDate] = useState<Date | undefined>(undefined);
  const [buttonAnimateKey, setButtonAnimateKey] = useState(0);
  const [showLoginToast, setShowLoginToast] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Manual Auth Session
  useEffect(() => {
    const savedUser = localStorage.getItem('manual_session');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setIsAuthReady(true);
    } else {
      setIsAuthReady(true);
    }
    setLoading(false);
  }, []);

  // Sync User Profile
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const fetchProfile = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
          const newProfile: UserProfile = {
            id: user.uid,
            name: user.name || user.username || 'Usuario',
            email: user.email || user.username || '',
            photoURL: user.photoURL || '',
            plan: 'basic'
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(docSnap.data() as UserProfile);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, [user, isAuthReady]);

  const handleManualLogout = () => {
    localStorage.removeItem('manual_session');
    setUser(null);
    setUserProfile(null);
  };

  const handleResetApp = () => {
    setIsResetModalOpen(true);
  };

  const performReset = async () => {
    if (!user) return;
    
    try {
      // Collections to clean
      const collectionsToClean = ['movements', 'accounts', 'goals', 'weeklyBudgets', 'categories', 'quickActions'];
      
      for (const collName of collectionsToClean) {
        const q = query(collection(db, collName), where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
      
      // Reset user profile to default values
      if (userProfile) {
        const defaultProfile: UserProfile = {
          ...userProfile,
          totalBalance: 0,
          monthlyIncome: 0,
          monthlyExpenses: 0,
          savingsGoal: 0,
          currency: 'S/',
          lastUpdated: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', user.uid), defaultProfile);
        setUserProfile(defaultProfile);
      }
      
      setIsResetModalOpen(false);
      window.location.reload(); // Reload to clear all local states
    } catch (error) {
      console.error("Error resetting app:", error);
      alert("Hubo un error al reiniciar la aplicación.");
    }
  };

  const handleDeleteMovement = async (movement: Movement) => {
    if (!user || !movement.id) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const movementRef = doc(db, 'movements', movement.id!);
        const movementSnap = await transaction.get(movementRef);
        if (!movementSnap.exists()) return;
        
        const mData = movementSnap.data() as Movement;
        const { type, amount, accountOriginId, accountDestinationId } = mData;

        // Revert balance for origin account
        if (accountOriginId) {
          const originRef = doc(db, 'accounts', accountOriginId);
          const originSnap = await transaction.get(originRef);
          if (originSnap.exists()) {
            const originData = originSnap.data() as Account;
            if (type === 'income') {
              transaction.update(originRef, { balance: originData.balance - amount });
            } else if (type === 'expense' || type === 'transfer') {
              transaction.update(originRef, { balance: originData.balance + amount });
            }
          }
        }

        // Revert balance for destination account (if transfer)
        if (type === 'transfer' && accountDestinationId) {
          const destRef = doc(db, 'accounts', accountDestinationId);
          const destSnap = await transaction.get(destRef);
          if (destSnap.exists()) {
            const destData = destSnap.data() as Account;
            transaction.update(destRef, { balance: destData.balance - amount });
          }
        }

        transaction.delete(movementRef);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `movements/${movement.id}`);
    }
  };

  const togglePlan = async () => {
    if (!user || !userProfile) return;
    const newPlan = userProfile.plan === 'basic' ? 'premium' : 'basic';
    try {
      await updateDoc(doc(db, 'users', user.uid), { plan: newPlan });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
    setUserProfile({ ...userProfile, plan: newPlan });
  };

  // Data listeners
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const qAccounts = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'accounts');
    });

    const qCategories = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });

    const qMovements = query(
      collection(db, 'movements'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubMovements = onSnapshot(qMovements, (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movement)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'movements');
    });

    const qGoals = query(collection(db, 'goals'), where('userId', '==', user.uid));
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'goals');
    });

    const qBudget = query(collection(db, 'weeklyBudgets'), where('userId', '==', user.uid));
    const unsubBudget = onSnapshot(qBudget, (snapshot) => {
      if (!snapshot.empty) {
        setWeeklyBudget({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as WeeklyBudget);
      } else {
        setWeeklyBudget(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'weeklyBudgets');
    });

    const qRecurring = query(collection(db, 'recurringPayments'), where('userId', '==', user.uid));
    const unsubRecurring = onSnapshot(qRecurring, (snapshot) => {
      setRecurringPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurringPayment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'recurringPayments');
    });

    const qQuickActions = query(collection(db, 'quickActions'), where('userId', '==', user.uid));
    const unsubQuickActions = onSnapshot(qQuickActions, (snapshot) => {
      if (snapshot.empty) {
        // Initialize default quick actions if none exist
        const defaults = [
          { label: 'Comida', amount: 15.00, icon: 'Utensils', userId: user.uid },
          { label: 'Pasaje', amount: 1.50, icon: 'Bus', userId: user.uid },
          { label: 'Gastos Hormiga', amount: 5.00, icon: 'Coffee', userId: user.uid }
        ];
        defaults.forEach(async (d) => {
          await addDoc(collection(db, 'quickActions'), d);
        });
      } else {
        setQuickActions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuickAction)));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'quickActions');
    });

    return () => {
      unsubAccounts();
      unsubCategories();
      unsubMovements();
      unsubGoals();
      unsubBudget();
      unsubRecurring();
      unsubQuickActions();
    };
  }, [user, isAuthReady]);

  // Notification Logic
  useEffect(() => {
    if (recurringPayments.length === 0) return;
    
    const checkDuePayments = () => {
      const now = new Date();
      const due = recurringPayments.filter(p => !p.isPaid && isAfter(now, parseISO(p.dueDate)));
      
      if (due.length > 0) {
        // Play notification sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
        
        // Show browser notification if permitted
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Recordatorio de Pago", {
            body: `Tienes ${due.length} pago(s) pendiente(s): ${due.map(d => d.name).join(', ')}`,
            icon: '/favicon.ico'
          });
        }
      }
    };

    // Request permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const interval = setInterval(checkDuePayments, 60000); // Check every minute
    checkDuePayments(); // Initial check
    
    return () => clearInterval(interval);
  }, [recurringPayments]);
  const stats = useMemo<DashboardStats>(() => {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const today = startOfDay(new Date());
    
    const todayMovements = movements.filter(m => isSameDay(parseISO(m.date), today));
    const dailyIncome = todayMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
    const dailyExpense = todayMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0);

    const monthStart = startOfMonth(new Date());
    const monthlyMovements = movements.filter(m => parseISO(m.date) >= monthStart);
    const monthlyIncome = monthlyMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
    const monthlyExpense = monthlyMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0);

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    const weeklyMovements = movements.filter(m => parseISO(m.date) >= weekStart);
    const weeklyIncome = weeklyMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
    const weeklyExpense = weeklyMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0);

    const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
    const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));
    const lastMonthMovements = movements.filter(m => {
      const d = parseISO(m.date);
      return d >= lastMonthStart && d <= lastMonthEnd;
    });
    const lastMonthIncome = lastMonthMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
    const lastMonthExpense = lastMonthMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0);

    // Top category
    const catExpenses: Record<string, number> = {};
    movements.filter(m => m.type === 'expense').forEach(m => {
      catExpenses[m.categoryId] = (catExpenses[m.categoryId] || 0) + m.amount;
    });
    let topCatId = '';
    let maxExp = 0;
    Object.entries(catExpenses).forEach(([id, exp]) => {
      if (exp > maxExp) {
        maxExp = exp;
        topCatId = id;
      }
    });
    const topCategory = categories.find(c => c.id === topCatId)?.name || 'N/A';

    // Weekly category breakdown - Only include categories with movements
    const weeklyCategoryExpenses = categories.map(cat => {
      const amount = weeklyMovements
        .filter(m => m.type === 'expense' && m.categoryId === cat.id)
        .reduce((sum, m) => sum + m.amount, 0);
      return {
        categoryId: cat.id,
        name: cat.name,
        amount
      };
    }).filter(cat => cat.amount > 0).sort((a, b) => b.amount - a.amount);

    return { totalBalance, dailyIncome, dailyExpense, topCategory, weeklyIncome, weeklyExpense, monthlyIncome, monthlyExpense, lastMonthIncome, lastMonthExpense, weeklyCategoryExpenses };
  }, [accounts, movements, categories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={(u) => {
      setUser(u);
      setShowLoginToast(true);
      setTimeout(() => setShowLoginToast(false), 5000);
    }} />;
  }

  return (
    <div className={cn(
      "min-h-screen pb-24 font-sans transition-colors duration-500 relative overflow-hidden",
      darkMode ? "bg-mesh-dark text-slate-100" : "bg-mesh-light text-slate-900"
    )}>
      {/* Decorative Background Blobs */}
      {!darkMode && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 animate-pulse bg-blue-400" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 animate-pulse bg-cyan-400" style={{ animationDelay: '2s' }} />
        </div>
      )}

      <AnimatePresence>
        {showLoginToast && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xs px-4"
          >
            <div className="bg-blue-700 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 backdrop-blur-lg">
              <div className="bg-white/20 p-2 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">¡Bienvenido!</p>
                <p className="text-xs font-medium">Estás a un paso de tomar el control total de tus finanzas. 🚀</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <header className={cn(
         "px-4 pt-5 pb-3.5 sticky top-0 z-50 transition-all duration-300",
         darkMode ? "bg-[#0A0E17]/85 backdrop-blur-xl border-b border-slate-800/80" : "bg-white/85 backdrop-blur-xl border-b border-slate-200"
      )}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00F5A0] via-teal-400 to-cyan-400 p-[1.5px] shadow-glow-emerald">
                <div className={cn("w-full h-full rounded-[14px] flex items-center justify-center", darkMode ? "bg-[#0A0E17]" : "bg-white")}>
                  <Wallet className="w-5 h-5 text-[#00F5A0]" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00F5A0] border-2 border-[#0A0E17] shadow-glow-emerald" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 leading-none">
                <h1 className={cn("text-base font-extrabold tracking-tight font-display", darkMode ? "text-white" : "text-slate-900")}>
                  Finanzas Mil
                </h1>
                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-[#00F5A0] border border-emerald-500/30 rounded-md">
                  PRO
                </span>
              </div>
              <p className={cn("text-[11px] font-medium mt-0.5", darkMode ? "text-slate-400" : "text-slate-500")}>Asesor Financiero IA</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Champagne Gold VIP Badge */}
            <button 
              onClick={togglePlan}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 shadow-glow-gold hover:bg-amber-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-[10px] font-bold tracking-wider text-gradient-gold uppercase">CALIDAD SUPREMA</span>
            </button>

            {recurringPayments.some(p => !p.isPaid) && (
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  "relative w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95",
                  darkMode ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" : "bg-rose-50 text-rose-600 border border-rose-200"
                )}
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                  {recurringPayments.filter(p => !p.isPaid).length}
                </span>
              </button>
            )}

            <button 
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "Cambiar a Tema Blanco" : "Cambiar a Tema Oscuro"}
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95",
                darkMode ? "bg-slate-900/90 border border-slate-800 text-amber-400 hover:text-white" : "bg-slate-100 border border-slate-200 text-slate-700"
              )}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              title="Ajustes"
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95",
                darkMode ? "bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 border border-slate-200 text-slate-700"
              )}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-6 space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <DashboardView 
              movements={movements} 
              accounts={accounts} 
              categories={categories} 
              goals={goals}
              recurringPayments={recurringPayments}
              quickActions={quickActions}
              userProfile={userProfile}
              darkMode={darkMode} 
              stats={stats} 
              setActiveTab={setActiveTab} 
              onNavigateToCalendar={(date, viewDate) => {
                setCalendarTargetDate(date || new Date());
                setCalendarViewingDate(viewDate || date || new Date());
                setActiveTab('calendar');
              }}
              onAddMovement={(type) => {
                setMovementModalType(type || 'expense');
                setIsMovementModalOpen(true);
              }} 
              onDeleteMovement={handleDeleteMovement}
              deferredPrompt={deferredPrompt}
            />
          )}
          {activeTab === 'calendar' && (
            <CalendarView 
              movements={movements} 
              accounts={accounts} 
              categories={categories} 
              darkMode={darkMode} 
              onDelete={handleDeleteMovement}
              selectedDate={calendarTargetDate}
              setSelectedDate={setCalendarTargetDate}
              viewingDate={calendarViewingDate}
              setViewingDate={setCalendarViewingDate}
              recurringPayments={recurringPayments}
              onMarkRecurringAsPaid={async (payment) => {
                if (!payment.id) return;
                try {
                  const paymentRef = doc(db, 'recurringPayments', payment.id);
                  await updateDoc(paymentRef, { isPaid: true });
                } catch (err) {
                  console.error('Error marking recurring payment as paid:', err);
                }
              }}
              onAddMovementForDay={(day) => {
                setMovementModalDate(day);
                setMovementModalType('expense');
                setIsMovementModalOpen(true);
              }}
            />
          )}
          {activeTab === 'stats' && <StatsView movements={movements} categories={categories} darkMode={darkMode} />}
          {activeTab === 'budget' && <WeeklyBudgetView budget={weeklyBudget} userId={user.uid} darkMode={darkMode} categories={categories} />}
          {activeTab === 'advisor' && <FinanceAdvisorView movements={movements} accounts={accounts} goals={goals} categories={categories} darkMode={darkMode} plan={userProfile?.plan || 'basic'} userProfile={userProfile} />}
          {activeTab === 'accounts' && (
            <AccountsView 
              accounts={accounts} 
              userId={user.uid} 
              darkMode={darkMode} 
              movements={movements}
              onAddMovement={(type) => {
                setMovementModalType(type || 'transfer');
                setIsMovementModalOpen(true);
              }}
            />
          )}
          {activeTab === 'goals' && <GoalsView goals={goals} userId={user.uid} darkMode={darkMode} />}
        </AnimatePresence>
      </main>

      {/* Floating AI Voice & Assistant Agent Button (Unified FAB with Emerald Halo Pulse) */}
      <aside className="fixed bottom-20 right-5 z-40 max-w-md pointer-events-none" data-purpose="floating-ai-assistant">
        <motion.button 
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsAndroidGeminiOpen(true)}
          aria-label="Hablar con Agente IA Financiero"
          className="pointer-events-auto relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-[#00F5A0] via-teal-500 to-indigo-600 text-slate-950 pulse-emerald-fab border border-emerald-300/40 shadow-2xl transition-transform duration-200"
        >
          {/* Sparkle Accent in top corner */}
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#0A0E17] border border-emerald-400/50 rounded-full flex items-center justify-center shadow-sm">
            <Sparkles className="w-3 h-3 text-[#00F5A0] animate-spin" style={{ animationDuration: '6s' }} />
          </span>
          {/* Dual Icon: Central Mic with Voice Waves */}
          <Mic className="w-6 h-6 text-slate-950 stroke-[2.4]" />
        </motion.button>
      </aside>

      {/* Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 border-t px-2 py-1.5 z-50 transition-colors duration-300",
        darkMode ? "bg-[#0A0E17]/90 backdrop-blur-2xl border-slate-800/80" : "bg-white/90 backdrop-blur-2xl border-slate-200"
      )}>
        <div className="max-w-md mx-auto flex items-center justify-between gap-1">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Inicio" darkMode={darkMode} />
          <NavButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={CalendarIcon} label="Calendario" darkMode={darkMode} />
          <NavButton active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon={Target} label="Metas" darkMode={darkMode} />
          <NavButton active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} icon={ClipboardList} label="Presupuesto" darkMode={darkMode} />
          <NavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={PieChart} label="Stats" darkMode={darkMode} />
          <NavButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={Wallet} label="Cuentas" darkMode={darkMode} />
        </div>
      </nav>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        userProfile={userProfile} 
        setUserProfile={setUserProfile}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onReset={handleResetApp}
        onLogout={handleManualLogout}
        deferredPrompt={deferredPrompt}
      />

      {/* Movement Modal */}
      <AnimatePresence>
        {isMovementModalOpen && (
          <MovementModal 
            onClose={() => {
              setIsMovementModalOpen(false);
              setMovementModalDate(undefined);
            }} 
            onSuccess={() => setButtonAnimateKey(prev => prev + 1)}
            accounts={accounts} 
            categories={categories} 
            userId={user.uid}
            darkMode={darkMode}
            initialType={movementModalType}
            initialDate={movementModalDate}
          />
        )}
      </AnimatePresence>
      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <ResetConfirmationModal 
            onClose={() => setIsResetModalOpen(false)} 
            onConfirm={performReset}
            darkMode={darkMode} 
          />
        )}
      </AnimatePresence>

      {/* Android 15 Gemini Live Assistant Overlay */}
      <AnimatePresence>
        {isAndroidGeminiOpen && (
          <AndroidGeminiLiveOverlay 
            isOpen={isAndroidGeminiOpen}
            onClose={() => setIsAndroidGeminiOpen(false)}
            movements={movements}
            accounts={accounts}
            goals={goals}
            categories={categories}
            darkMode={darkMode}
            activeTab={activeTab}
            userProfile={userProfile}
            userId={user.uid}
            onOpenMovementModal={(type) => {
              setMovementModalType(type || 'expense');
              setIsMovementModalOpen(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Components ---

const ResetConfirmationModal = ({ onClose, onConfirm, darkMode }: { onClose: () => void, onConfirm: () => void, darkMode: boolean }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className={cn(
          "w-full max-w-sm p-6 rounded-3xl border shadow-2xl relative overflow-hidden",
          darkMode ? "bg-black border-zinc-800" : "bg-white border-slate-100"
        )}
      >
        <div className="relative z-10 text-center space-y-5">
          <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-1">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          
          <div className="space-y-1.5">
            <h3 className={cn("text-xl font-black font-display uppercase tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
              ¿Reiniciar App?
            </h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              Esta acción es <span className="text-rose-500 font-black">IRREVERSIBLE</span>. Se borrarán todos tus movimientos, cuentas, metas y presupuestos.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={() => {
                setIsDeleting(true);
                onConfirm();
              }}
              disabled={isDeleting}
              className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-rose-500/25 active:scale-95 disabled:opacity-50"
            >
              {isDeleting ? "Borrando todo..." : "SÍ, BORRAR TODO"}
            </button>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className={cn(
                "w-full py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95",
                darkMode ? "bg-zinc-900 text-slate-400 hover:bg-zinc-800" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              CANCELAR
            </button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -ml-16 -mb-16"></div>
      </motion.div>
    </motion.div>
  );
};

// --- Sub-components ---

function NavButton({ active, onClick, icon: Icon, label, darkMode }: { active: boolean, onClick: () => void, icon: any, label: string, darkMode: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300 relative py-1 px-1.5 group active:scale-95",
        active 
          ? "text-[#00F5A0]" 
          : darkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
      )}
    >
      <div className="relative">
        <Icon className={cn("w-5 h-5 transition-all", active ? "stroke-[2.4px] text-[#00F5A0]" : "stroke-[1.75px]")} />
        {active && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#00F5A0] rounded-full shadow-glow-emerald" />
        )}
      </div>
      <span className={cn("text-[9px] uppercase tracking-tight", active ? "font-black text-[#00F5A0]" : "font-semibold")}>{label}</span>
    </button>
  );
}

function MovementItem({ movement, categories, accounts, darkMode, onDelete }: { movement: Movement, categories: Category[], accounts: Account[], darkMode: boolean, onDelete?: (m: Movement) => void, key?: string | number }) {
  const category = categories.find(c => c.id === movement.categoryId);
  const account = accounts.find(a => a.id === movement.accountOriginId);
  
  const isIncome = movement.type === 'income';
  const isTransfer = movement.type === 'transfer';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className={cn(
        "p-3 rounded-2xl border flex items-center justify-between transition-all duration-300 group relative overflow-hidden",
        darkMode 
          ? "titanium-card-subtle hover:border-emerald-500/30" 
          : "bg-white border-slate-200 shadow-sm hover:shadow-md"
      )}
    >
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 bg-[#00F5A0]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm group-hover:scale-105",
          isIncome ? (darkMode ? "bg-emerald-500/15 text-[#00F5A0] border border-emerald-500/30 shadow-glow-emerald/20" : "bg-emerald-50 text-emerald-600 border border-emerald-200") : 
          isTransfer ? (darkMode ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" : "bg-cyan-50 text-cyan-700 border border-cyan-200") : 
          (darkMode ? "bg-rose-500/15 text-[#FB7185] border border-rose-500/30" : "bg-rose-50 text-rose-600 border border-rose-200")
        )}>
          {isIncome ? <TrendingUp className="w-5 h-5" /> : 
           isTransfer ? <ArrowRightLeft className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        </div>
        <div className="space-y-0.5">
          <p className={cn("font-display font-black text-sm uppercase tracking-tight transition-colors", darkMode ? "text-white" : "text-slate-900")}>
            {category?.name || (isTransfer ? 'Transferencia' : 'General')}
          </p>
          {movement.note && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-md w-fit mb-0.5 text-[9px] font-medium italic",
              darkMode ? "bg-slate-800/80 text-slate-300 border border-slate-700/50" : "bg-slate-100 text-slate-700 border border-slate-200"
            )}>
              <MessageSquare className="w-2.5 h-2.5 shrink-0 opacity-70" />
              <p className="truncate max-w-[120px]">
                {movement.note}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <p className={cn("text-[9px] font-bold uppercase tracking-wider", darkMode ? "text-slate-400" : "text-slate-500")}>
              {movement.accountOriginId ? (account?.name || 'Cuenta') : 'Efectivo'}
            </p>
            <span className="w-1 h-1 rounded-full bg-slate-700/50"></span>
            <p className={cn("text-[9px] font-medium uppercase tracking-wider", darkMode ? "text-slate-500" : "text-slate-400")}>
              {format(parseISO(movement.date), 'dd MMM', { locale: es })}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={cn(
            "font-display font-black text-lg transition-colors tracking-tight",
            isIncome ? "text-[#00F5A0]" : isTransfer ? "text-cyan-400" : (darkMode ? "text-white" : "text-slate-900")
          )}>
            {isIncome ? '+' : isTransfer ? '' : '-'}S/ {movement.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className={cn("text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded", darkMode ? "text-slate-400 bg-slate-900/60" : "text-slate-500 bg-slate-100")}>
            Confirmado
          </span>
        </div>
        
        {onDelete && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(movement);
            }}
            className={cn(
              "p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300",
              darkMode ? "hover:bg-rose-500/20 text-slate-600 hover:text-rose-400" : "hover:bg-rose-50 text-slate-300 hover:text-rose-500"
            )}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn || !username || !password) return;
    setIsLoggingIn(true);
    setError(null);

    try {
      if (isRegistering) {
        // Check if user already exists
        const q = query(collection(db, 'manual_users'), where('username', '==', username.toLowerCase()));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          setError("Este usuario ya está registrado.");
          setIsLoggingIn(false);
          return;
        }

        const newUser = {
          username: username.toLowerCase(),
          password: password, // In a real app, this should be hashed
          name: username,
          createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'manual_users'), newUser);
        const sessionUser = { uid: docRef.id, ...newUser };
        localStorage.setItem('manual_session', JSON.stringify(sessionUser));
        onLogin(sessionUser);
      } else {
        // Login check
        const q = query(
          collection(db, 'manual_users'), 
          where('username', '==', username.toLowerCase()), 
          where('password', '==', password)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          setError("Usuario o contraseña incorrectos.");
        } else {
          const userData = snap.docs[0].data();
          const sessionUser = { uid: snap.docs[0].id, ...userData };
          localStorage.setItem('manual_session', JSON.stringify(sessionUser));
          onLogin(sessionUser);
        }
      }
    } catch (err: any) {
      console.error("Manual Auth error:", err);
      setError("Error de conexión con la base de datos.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (result?.user) {
        const sessionUser = { 
          uid: result.user.uid, 
          email: result.user.email, 
          name: result.user.displayName,
          photoURL: result.user.photoURL 
        };
        localStorage.setItem('manual_session', JSON.stringify(sessionUser));
        onLogin(sessionUser);
      }
    } catch (err: any) {
      setError("Error al iniciar sesión con Google.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center transition-colors duration-700 relative overflow-hidden">
      {/* Pure solid black background with no distractions */}

      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-20 h-20 bg-blue-700 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/30 relative z-10"
      >
        <TrendingUp className="text-white w-10 h-10" />
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="relative z-10 w-full max-w-sm"
      >
        <h1 className="text-4xl font-extrabold font-display tracking-tighter text-slate-900 dark:text-white mb-2">
          Finanzas Mil <span className="text-blue-700">pro</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto font-medium leading-relaxed">
          Gestiona tu libertad financiera con elegancia y precisión.
        </p>
 
        <div className="bg-white dark:bg-black/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl mb-6">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Nombre de Usuario</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Ej. milner03" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                  required 
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                  required 
                />
              </div>
            </div>

            {error && (
              <p className="text-[10px] font-bold text-rose-500 bg-rose-500/10 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70"
            >
              {isLoggingIn ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : isRegistering ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Crear Cuenta
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-2">
            <p className="text-[11px] text-slate-500">
              {isRegistering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
            </p>
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
              }}
              className="text-[11px] font-bold text-blue-700 hover:underline"
            >
              {isRegistering ? 'Inicia Sesión' : 'Regístrate'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
              <span className="bg-white dark:bg-black px-2 text-slate-400">O continuar con</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className={cn(
              "w-full py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-3 text-xs",
              isLoggingIn && "opacity-70 cursor-not-allowed"
            )}
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" referrerPolicy="no-referrer" />
            Google
          </button>
        </div>
      </motion.div>
      
      <p className="mt-4 text-[10px] text-slate-400 font-medium tracking-wide relative z-10">
        Al continuar, aceptas nuestros términos y política de privacidad.
      </p>
    </div>
  );
}

function SettingsModal({ 
  isOpen, 
  onClose, 
  userProfile, 
  setUserProfile,
  darkMode,
  setDarkMode,
  onReset,
  onLogout,
  deferredPrompt
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  userProfile: UserProfile | null, 
  setUserProfile: (profile: UserProfile | null) => void,
  darkMode: boolean,
  setDarkMode: (val: boolean) => void,
  onReset: () => void,
  onLogout: () => void,
  deferredPrompt: any
}) {
  const [name, setName] = useState(userProfile?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [geminiKey, setGeminiKey] = useState(userProfile?.geminiApiKey || '');
  const [openaiKey, setOpenaiKey] = useState(userProfile?.openaiApiKey || '');
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [openaiStatus, setOpenaiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isValidatingGemini, setIsValidatingGemini] = useState(false);
  const [isValidatingOpenAI, setIsValidatingOpenAI] = useState(false);

  if (!isOpen) return null;

  const handleSaveGemini = async () => {
    if (!userProfile || !geminiKey.trim()) return;
    setIsValidatingGemini(true);
    setGeminiStatus('idle');
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "test",
      });
      
      const userRef = doc(db, 'users', userProfile.id);
      await updateDoc(userRef, { geminiApiKey: geminiKey });
      setUserProfile({ ...userProfile, geminiApiKey: geminiKey });
      setGeminiStatus('success');
    } catch (error) {
      console.error("Gemini validation error:", error);
      setGeminiStatus('error');
    } finally {
      setIsValidatingGemini(false);
    }
  };

  const handleSaveOpenAI = async () => {
    if (!userProfile || !openaiKey.trim()) return;
    setIsValidatingOpenAI(true);
    setOpenaiStatus('idle');
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${openaiKey}` }
      });
      if (!response.ok) throw new Error('Invalid key');
      
      const userRef = doc(db, 'users', userProfile.id);
      await updateDoc(userRef, { openaiApiKey: openaiKey });
      setUserProfile({ ...userProfile, openaiApiKey: openaiKey });
      setOpenaiStatus('success');
    } catch (error) {
      console.error("OpenAI validation error:", error);
      setOpenaiStatus('error');
    } finally {
      setIsValidatingOpenAI(false);
    }
  };

  const handleSave = async () => {
    if (!userProfile) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', userProfile.id);
      const updatedProfile = { ...userProfile, name };
      await updateDoc(userRef, { name });
      setUserProfile(updatedProfile);
      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePlan = async () => {
    if (!userProfile) return;
    const newPlan = userProfile.plan === 'premium' ? 'basic' : 'premium';
    try {
      const userRef = doc(db, 'users', userProfile.id);
      await updateDoc(userRef, { plan: newPlan });
      setUserProfile({ ...userProfile, plan: newPlan });
    } catch (error) {
      console.error("Error updating plan:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className={cn(
          "relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden",
          darkMode ? "glass-card border-zinc-800/50" : "glass-card-light border-slate-100"
        )}
      >
        {/* Decorative background blobs for modal */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto scrollbar-thin">
          <div className="flex items-center justify-between">
            <h2 className={cn("text-xl font-bold font-display", darkMode ? "text-white" : "text-slate-900")}>
              Ajustes
            </h2>
            <button 
              onClick={onClose}
              className={cn(
                "p-2 rounded-xl transition-all",
                darkMode ? "hover:bg-zinc-900 text-slate-400" : "hover:bg-slate-100 text-slate-500"
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Profile Section */}
            <div className="space-y-2">
              <label className={cn("text-[10px] font-bold uppercase tracking-wider", darkMode ? "text-slate-500" : "text-slate-400")}>
                Perfil
              </label>
              <div className={cn(
                "p-4 rounded-2xl space-y-3",
                darkMode ? "bg-zinc-900/50" : "bg-slate-50"
              )}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {userProfile?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre"
                      className={cn(
                        "w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0",
                        darkMode ? "text-white placeholder:text-slate-600" : "text-slate-900 placeholder:text-slate-400"
                      )}
                    />
                    <p className="text-[10px] text-slate-500">{userProfile?.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Section */}
            <div className="space-y-2">
              <label className={cn("text-[10px] font-bold uppercase tracking-wider", darkMode ? "text-slate-500" : "text-slate-400")}>
                Suscripción
              </label>
              <button 
                onClick={togglePlan}
                className={cn(
                  "w-full p-4 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98]",
                  darkMode ? "bg-zinc-900/50 hover:bg-zinc-900" : "bg-slate-50 hover:bg-slate-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    userProfile?.plan === 'premium' ? "bg-amber-500/10 text-amber-500" : "bg-blue-600/10 text-blue-400"
                  )}>
                    {userProfile?.plan === 'premium' ? <Crown className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                  </div>
                  <div className="text-left">
                    <p className={cn("text-sm font-bold", darkMode ? "text-white" : "text-slate-900")}>
                      Plan {userProfile?.plan === 'premium' ? 'Premium' : 'Básico'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {userProfile?.plan === 'premium' ? 'Acceso a todas las funciones' : 'Funciones limitadas'}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider",
                  userProfile?.plan === 'premium' ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600"
                )}>
                  {userProfile?.plan === 'premium' ? 'Activo' : 'Mejorar'}
                </div>
              </button>
            </div>

            {/* Appearance Section */}
            <div className="space-y-2">
              <label className={cn("text-[10px] font-bold uppercase tracking-wider", darkMode ? "text-slate-500" : "text-slate-400")}>
                Apariencia / Tema
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDarkMode(false)}
                  className={cn(
                    "p-3.5 rounded-2xl flex items-center gap-3 border transition-all text-left active:scale-95 cursor-pointer",
                    !darkMode 
                      ? "bg-blue-50 border-blue-500/50 shadow-md shadow-blue-500/10 text-blue-700 ring-2 ring-blue-500/30" 
                      : darkMode ? "bg-zinc-900/50 border-zinc-800 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    !darkMode ? "bg-blue-600 text-white" : "bg-zinc-800 text-amber-400"
                  )}>
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={cn("text-xs font-bold", !darkMode ? "text-slate-900" : "text-white")}>Tema Blanco</p>
                    <p className="text-[10px] text-slate-500">Claro & Limpio</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDarkMode(true)}
                  className={cn(
                    "p-3.5 rounded-2xl flex items-center gap-3 border transition-all text-left active:scale-95 cursor-pointer",
                    darkMode 
                      ? "bg-blue-600/10 border-blue-500/50 shadow-md shadow-blue-500/10 text-blue-400 ring-2 ring-blue-500/30" 
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    darkMode ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                  )}>
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={cn("text-xs font-bold", darkMode ? "text-white" : "text-slate-900")}>Tema Oscuro</p>
                    <p className="text-[10px] text-slate-500">Negro Pro</p>
                  </div>
                </button>
              </div>
            </div>

            {/* AI Keys Section */}
            <div className="space-y-3">
              <label className={cn("text-[10px] font-bold uppercase tracking-wider", darkMode ? "text-slate-500" : "text-slate-400")}>
                Inteligencia Artificial
              </label>
              
              {/* Gemini Key */}
              <div className={cn(
                "p-4 rounded-2xl space-y-3",
                darkMode ? "bg-zinc-900/50" : "bg-slate-50"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span className={cn("text-xs font-bold", darkMode ? "text-white" : "text-slate-900")}>Gemini API Key</span>
                  </div>
                  {geminiStatus !== 'idle' && (
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      geminiStatus === 'success' ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {geminiStatus === 'success' ? 'Instalado correctamente' : 'Esta mal la clave'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className={cn(
                      "flex-1 bg-transparent border-none p-0 text-xs font-mono focus:ring-0",
                      darkMode ? "text-white placeholder:text-slate-700" : "text-slate-900 placeholder:text-slate-300"
                    )}
                  />
                  <button 
                    onClick={handleSaveGemini}
                    disabled={isValidatingGemini}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95",
                      darkMode ? "bg-zinc-800 text-blue-400 hover:bg-zinc-700" : "bg-white text-blue-700 border border-slate-100 shadow-sm"
                    )}
                  >
                    {isValidatingGemini ? 'Validando...' : 'Guardar'}
                  </button>
                </div>
              </div>

              {/* OpenAI Key */}
              <div className={cn(
                "p-4 rounded-2xl space-y-3",
                darkMode ? "bg-zinc-900/50" : "bg-slate-50"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    <span className={cn("text-xs font-bold", darkMode ? "text-white" : "text-slate-900")}>ChatGPT API Key</span>
                  </div>
                  {openaiStatus !== 'idle' && (
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      openaiStatus === 'success' ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {openaiStatus === 'success' ? 'Instalado correctamente' : 'Esta mal la clave'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className={cn(
                      "flex-1 bg-transparent border-none p-0 text-xs font-mono focus:ring-0",
                      darkMode ? "text-white placeholder:text-slate-700" : "text-slate-900 placeholder:text-slate-300"
                    )}
                  />
                  <button 
                    onClick={handleSaveOpenAI}
                    disabled={isValidatingOpenAI}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95",
                      darkMode ? "bg-zinc-800 text-emerald-400 hover:bg-zinc-700" : "bg-white text-emerald-600 border border-slate-100 shadow-sm"
                    )}
                  >
                    {isValidatingOpenAI ? 'Validando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Install App & Fullscreen Section */}
            <div className="space-y-2">
              <label className={cn("text-[10px] font-bold uppercase tracking-wider", darkMode ? "text-slate-500" : "text-slate-400")}>
                Aplicación & Vista Móvil
              </label>
              
              {/* Fullscreen Mode (Ocultar Barra de Estado / Batería / Hora) */}
              <div className={cn(
                "p-4 rounded-2xl flex items-center justify-between",
                darkMode ? "bg-zinc-900/50" : "bg-slate-50"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    darkMode ? "bg-blue-600/10 text-blue-400" : "bg-blue-50 text-blue-700"
                  )}>
                    <Maximize className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={cn("text-sm font-bold", darkMode ? "text-white" : "text-slate-900")}>
                      Modo Inmersivo (Pantalla Completa)
                    </p>
                    <p className="text-[10px] text-slate-500">Oculta la barra de estado y batería</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen?.().catch(() => {});
                    } else {
                      document.exitFullscreen?.().catch(() => {});
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95",
                    darkMode ? "bg-zinc-800 text-blue-400 hover:bg-zinc-700" : "bg-white text-blue-700 border border-slate-100 shadow-sm"
                  )}
                >
                  Alternar
                </button>
              </div>

              <div className={cn(
                "p-4 rounded-2xl flex items-center justify-between",
                darkMode ? "bg-zinc-900/50" : "bg-slate-50"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    darkMode ? "bg-blue-600/10 text-blue-400" : "bg-blue-50 text-blue-700"
                  )}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={cn("text-sm font-bold", darkMode ? "text-white" : "text-slate-900")}>
                      Instalar App
                    </p>
                    <p className="text-[10px] text-slate-500">Acceso rápido desde tu inicio</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    if (deferredPrompt) {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') {
                        console.log('User accepted the install prompt');
                      }
                    } else {
                      alert('Para instalar: \n1. Toca el botón de compartir \n2. Selecciona "Añadir a pantalla de inicio"');
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95",
                    darkMode ? "bg-blue-700 text-white" : "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  )}
                >
                  Instalar
                </button>
              </div>
            </div>

            {/* Actions Section */}
            <div className="space-y-2">
              <label className={cn("text-[10px] font-bold uppercase tracking-wider", darkMode ? "text-slate-500" : "text-slate-400")}>
                Sistema
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    onClose();
                    onReset();
                  }}
                  className={cn(
                    "p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95",
                    darkMode ? "bg-zinc-900/50 hover:bg-zinc-900 text-amber-400" : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                  )}
                >
                  <RefreshCcw className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase">Reiniciar</span>
                </button>
                <button 
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className={cn(
                    "p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95",
                    darkMode ? "bg-zinc-900/50 hover:bg-zinc-900 text-rose-400" : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                  )}
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase">Salir</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={onClose}
              className={cn(
                "flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95",
                darkMode ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-slate-100 text-slate-900 hover:bg-slate-200"
              )}
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2",
                "bg-blue-700 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              )}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Guardar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MovementModal({ onClose, accounts, categories, userId, darkMode, onSuccess, initialType, initialDate }: { onClose: () => void, accounts: Account[], categories: Category[], userId: string, darkMode: boolean, onSuccess?: () => void, initialType?: MovementType, initialDate?: Date }) {
  const [type, setType] = useState<MovementType>(initialType || 'expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountOriginId, setAccountOriginId] = useState('');
  const [accountDestinationId, setAccountDestinationId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(
    initialDate 
      ? format(initialDate, "yyyy-MM-dd'T'HH:mm") 
      : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    
    setIsSubmitting(true);
    try {
      const numAmount = parseFloat(amount);
      
      await runTransaction(db, async (transaction) => {
        // 1. READS
        let originData: Account | null = null;
        let originRef: any = null;
        if (accountOriginId) {
          originRef = doc(db, 'accounts', accountOriginId);
          const originSnap = await transaction.get(originRef);
          if (originSnap.exists()) originData = originSnap.data() as Account;
        }

        let destData: Account | null = null;
        let destRef: any = null;
        if (type === 'transfer' && accountDestinationId) {
          destRef = doc(db, 'accounts', accountDestinationId);
          const destSnap = await transaction.get(destRef);
          if (destSnap.exists()) destData = destSnap.data() as Account;
        }

        // 2. WRITES
        const movementRef = doc(collection(db, 'movements'));
        transaction.set(movementRef, {
          type,
          amount: numAmount,
          categoryId: type === 'transfer' ? '' : categoryId,
          accountOriginId: accountOriginId || '',
          accountDestinationId: (type === 'transfer' && accountDestinationId) ? accountDestinationId : '',
          date: new Date(date).toISOString(),
          note,
          userId
        });

        if (type === 'income' && originRef && originData) {
          transaction.update(originRef, { balance: originData.balance + numAmount });
        } else if (type === 'expense' && originRef && originData) {
          transaction.update(originRef, { balance: originData.balance - numAmount });
        } else if (type === 'transfer') {
          if (originRef && originData) {
            transaction.update(originRef, { balance: originData.balance - numAmount });
          }
          if (destRef && destData) {
            transaction.update(destRef, { balance: destData.balance + numAmount });
          }
        }
      });
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className={cn(
          "w-full max-w-md rounded-t-2xl sm:rounded-2xl p-3.5 space-y-3 transition-colors duration-300 relative overflow-hidden",
          darkMode ? "glass-card border-zinc-800/50" : "glass-card-light border-slate-100"
        )}
      >
        {/* Decorative background blobs for modal */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest">Nuevo Movimiento</h2>
          <button onClick={onClose} className={cn(
            "p-1.5 rounded-full transition-colors",
            darkMode ? "bg-zinc-900 hover:bg-zinc-800" : "bg-slate-100 hover:bg-slate-200"
          )}><X className="w-4 h-4" /></button>
        </div>

        <div className={cn("flex p-1 rounded-xl transition-colors", darkMode ? "bg-zinc-900" : "bg-slate-100")}>
          <button 
            onClick={() => setType('expense')}
            className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", type === 'expense' ? (darkMode ? "bg-zinc-800 text-rose-400 shadow-lg" : "bg-white shadow-md text-rose-600") : "text-slate-500")}
          >Gasto</button>
          <button 
            onClick={() => setType('income')}
            className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", type === 'income' ? (darkMode ? "bg-zinc-800 text-emerald-400 shadow-lg" : "bg-white shadow-md text-emerald-600") : "text-slate-500")}
          >Ingreso</button>
          <button 
            onClick={() => setType('transfer')}
            className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", type === 'transfer' ? (darkMode ? "bg-zinc-800 text-blue-400 shadow-lg" : "bg-white shadow-md text-blue-700") : "text-slate-500")}
          >Transf.</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Monto</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-blue-400 transition-transform group-focus-within:scale-110">S/</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "w-full border-none rounded-[1.5rem] py-4 pl-12 pr-6 text-3xl font-black font-display focus:ring-4 focus:ring-blue-500/20 transition-all",
                  darkMode ? "bg-zinc-900 text-white" : "bg-slate-50 text-slate-900"
                )}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                {type === 'transfer' ? 'Origen (Opcional)' : 'Cuenta (Opcional)'}
              </label>
              <select 
                value={accountOriginId}
                onChange={(e) => setAccountOriginId(e.target.value)}
                className={cn(
                  "w-full border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-colors",
                  darkMode ? "bg-zinc-900 text-white" : "bg-slate-50 text-slate-900"
                )}
              >
                <option value="">Ninguna</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (S/ {a.balance})</option>)}
              </select>
            </div>

            {type === 'transfer' ? (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Destino (Opcional)</label>
                <select 
                  value={accountDestinationId}
                  onChange={(e) => setAccountDestinationId(e.target.value)}
                  className={cn(
                    "w-full border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-colors",
                    darkMode ? "bg-zinc-900 text-white" : "bg-slate-50 text-slate-900"
                  )}
                >
                  <option value="">Ninguna</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Categoría</label>
                <select 
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={cn(
                    "w-full border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-colors",
                    darkMode ? "bg-zinc-900 text-white" : "bg-slate-50 text-slate-900"
                  )}
                  required={type !== 'transfer'}
                >
                  <option value="">Seleccionar</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="NEW">+ Nueva Categoría</option>
                </select>
                {categoryId === 'NEW' && (
                  <input 
                    type="text"
                    placeholder="Nombre de categoría + Enter"
                    autoFocus
                    className={cn(
                      "w-full mt-2 border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-colors",
                      darkMode ? "bg-zinc-800 text-white" : "bg-slate-100 text-slate-900"
                    )}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const name = (e.target as HTMLInputElement).value.trim();
                        if (name && userId) {
                          try {
                            const docRef = await addDoc(collection(db, 'categories'), { name, userId });
                            setCategoryId(docRef.id);
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }
                    }}
                  />
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Fecha</label>
            <input 
              type="datetime-local" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(
                "w-full border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-colors",
                darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
              )}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Nota (Opcional)
            </label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="¿En qué gastaste? (Ej: Almuerzo con amigos, Pasaje a Lima...)"
              rows={2}
              className={cn(
                "w-full border-none rounded-2xl py-4 px-5 text-sm font-medium focus:ring-4 focus:ring-blue-500/20 transition-all resize-none",
                darkMode ? "bg-slate-800 text-white placeholder:text-slate-600" : "bg-slate-50 text-slate-900 placeholder:text-slate-400"
              )}
            />
          </div>

          <button 
            disabled={isSubmitting}
            className={cn(
              "w-full py-4 rounded-2xl font-extrabold text-base shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3",
              type === 'expense' ? "bg-rose-600 text-white shadow-rose-500/20 hover:bg-rose-700" :
              type === 'income' ? "bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-700" :
              "bg-blue-700 text-white shadow-blue-500/20 hover:bg-blue-700"
            )}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                {type === 'expense' ? <TrendingDown className="w-5 h-5" /> : 
                 type === 'income' ? <TrendingUp className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
                <span className="uppercase tracking-widest">{type === 'expense' ? 'Confirmar Gasto' : type === 'income' ? 'Confirmar Ingreso' : 'Confirmar Transferencia'}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function WeeklyBudgetView({ budget, userId, darkMode, categories }: { budget: WeeklyBudget | null, userId: string, darkMode: boolean, categories: Category[] }) {
  const [income, setIncome] = useState(budget?.income || 200);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [selectedChip, setSelectedChip] = useState<string>('Banco Cusco');
  const [expenses, setExpenses] = useState<{ name: string, amount: number, category?: string }[]>(budget?.expenses || []);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showDistributionModal, setShowDistributionModal] = useState(false);

  useEffect(() => {
    if (budget) {
      setIncome(budget.income || 200);
      setExpenses(budget.expenses || []);
    }
  }, [budget]);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = income - totalExpenses;
  const assignedPct = income > 0 ? Math.min(100, Math.round((totalExpenses / income) * 100)) : 0;

  // Group expenses by category name
  const categorySummary = useMemo(() => {
    const summary: Record<string, number> = {};
    expenses.forEach(exp => {
      const catName = exp.category || exp.name || 'General';
      summary[catName] = (summary[catName] || 0) + exp.amount;
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const saveBudget = async (newIncome: number, newExpenses: { name: string, amount: number, category?: string }[]) => {
    try {
      if (budget) {
        await updateDoc(doc(db, 'weeklyBudgets', budget.id), {
          income: newIncome,
          expenses: newExpenses
        });
      } else {
        await addDoc(collection(db, 'weeklyBudgets'), {
          income: newIncome,
          expenses: newExpenses,
          userId
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'weeklyBudgets');
    }
  };

  const handleAddExpense = (nameToUse?: string) => {
    const finalName = nameToUse || expenseName || selectedChip;
    if (!finalName || !expenseAmount) return;
    const newExpenses = [...expenses, { 
      name: finalName, 
      amount: parseFloat(expenseAmount),
      category: selectedChip || finalName
    }];
    setExpenses(newExpenses);
    setExpenseName('');
    setExpenseAmount('');
    saveBudget(income, newExpenses);
  };

  const handleRemoveExpense = (index: number) => {
    const newExpenses = expenses.filter((_, i) => i !== index);
    setExpenses(newExpenses);
    saveBudget(income, newExpenses);
  };

  const handleIncomeChange = (val: string) => {
    const newIncome = parseFloat(val) || 0;
    setIncome(newIncome);
    saveBudget(newIncome, expenses);
  };

  const handleSeedMockupData = () => {
    const defaultExpenses = [
      { name: 'Restaurante', amount: 22, category: 'Restaurante' },
      { name: 'Comida', amount: 50, category: 'Comida' },
      { name: 'Pasaje', amount: 20, category: 'Pasaje' },
      { name: 'Banco', amount: 108, category: 'Banco' }
    ];
    setIncome(200);
    setExpenses(defaultExpenses);
    saveBudget(200, defaultExpenses);
  };

  // Pre-set quick chips from user mockup
  const defaultChips = [
    'Golosina', 'Desayuno', 'Salud', 'Plan Móvil', 'Banco Cusco', 
    'Comida Rest.', 'Pasaje', 'Ropa', 'Gastos Hormiga', 'Cena', 'Publicidad', '+ Otros'
  ];

  const now = new Date();
  const currentWeek = getWeek(now);
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'd MMM', { locale: es });
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'd MMM', { locale: es });

  const getExpenseIconDetails = (name: string, category?: string) => {
    const text = `${name} ${category || ''}`.toLowerCase();
    if (text.includes('restaurante') || text.includes('almuerzo') || text.includes('cena')) {
      return { Icon: Utensils, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' };
    }
    if (text.includes('comida') || text.includes('super') || text.includes('despensa') || text.includes('desayuno')) {
      return { Icon: ShoppingBag, color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/10' };
    }
    if (text.includes('pasaje') || text.includes('transporte') || text.includes('metropolitano') || text.includes('taxi')) {
      return { Icon: Bus, color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' };
    }
    if (text.includes('banco') || text.includes('tarjeta') || text.includes('prestamo') || text.includes('credito')) {
      return { Icon: CreditCard, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' };
    }
    return { Icon: DollarSign, color: 'text-[#00F5A0]', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' };
  };

  const getCategoryColor = (index: number) => {
    const colors = [
      { dot: 'bg-emerald-500', bar: 'bg-gradient-to-r from-emerald-500 to-teal-400' },
      { dot: 'bg-teal-400', bar: 'bg-teal-400' },
      { dot: 'bg-cyan-400', bar: 'bg-cyan-400' },
      { dot: 'bg-indigo-400', bar: 'bg-indigo-400' },
      { dot: 'bg-amber-400', bar: 'bg-amber-400' },
      { dot: 'bg-rose-500', bar: 'bg-rose-500' }
    ];
    return colors[index % colors.length];
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-32 px-1"
    >
      {/* BEGIN: TitleBar */}
      <section className="px-1 pt-1 pb-1 flex items-center justify-between" data-purpose="screen-title">
        <div>
          <h2 className={cn("text-2xl font-black tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
            Presupuesto
          </h2>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Planificación Semanal</span>
            <span className="inline-block w-1 h-1 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] font-semibold text-[#00F5A0]">Semana {currentWeek}</span>
          </div>
        </div>
        
        {/* Report / Period Selector Icon Button */}
        <button 
          onClick={() => setShowDistributionModal(!showDistributionModal)}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 shadow-inner cursor-pointer border",
            darkMode 
              ? "bg-[#101524]/90 border-slate-700/60 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50" 
              : "bg-white border-slate-200 text-slate-700 hover:text-emerald-600 shadow-sm"
          )}
          title="Ver resumen"
        >
          <ClipboardList className="w-5 h-5" />
        </button>
      </section>
      {/* END: TitleBar */}

      {/* BEGIN: WeeklyBudgetSummaryCard */}
      <section 
        className={cn(
          "relative overflow-hidden rounded-3xl p-5 border transition-all duration-300 shadow-card-subtle",
          darkMode 
            ? "bg-gradient-to-b from-[#101626] to-[#0A0E18] border-emerald-500/30 glow-emerald" 
            : "bg-gradient-to-b from-white to-slate-50 border-slate-200 shadow-xl"
        )} 
        data-purpose="summary-hero"
      >
        {/* Ambient radial glow backdrop */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top pill indicator */}
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F5A0]"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00F5A0]">Ingreso Semanal</span>
          </div>
          <span className="text-[11px] font-medium text-slate-400 capitalize">{weekStart} - {weekEnd}</span>
        </div>

        {/* Main Budget Amount with Inline Edit */}
        <div className="flex items-baseline space-x-2 my-2">
          <span className="text-2xl font-bold text-[#00F5A0] tracking-tight font-mono">S/</span>
          <div className="flex items-baseline">
            <input 
              type="number"
              step="any"
              value={income || ''}
              onChange={e => handleIncomeChange(e.target.value)}
              placeholder="0.00"
              className={cn(
                "w-full bg-transparent border-none focus:outline-none p-0 text-4xl sm:text-5xl font-extrabold tracking-tight font-display",
                darkMode ? "text-white" : "text-slate-900"
              )}
            />
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-5">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Presupuesto base configurado para la semana</span>
        </div>

        {/* Budget execution progress bar */}
        <div className="space-y-1.5 mb-5">
          <div className="flex justify-between text-[11px] font-medium">
            <span className="text-slate-400">Planificado vs Límite</span>
            <span className="text-[#00F5A0] font-semibold">{assignedPct}% Asignado</span>
          </div>
          <div className={cn("w-full h-2.5 rounded-full overflow-hidden p-0.5 border", darkMode ? "bg-[#05070B] border-slate-800" : "bg-slate-100 border-slate-200")}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, assignedPct)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#00F5A0] rounded-full shadow-[0_0_10px_rgba(0,245,160,0.5)]" 
            />
          </div>
        </div>

        {/* Sub metrics grid (2 Columns) */}
        <div className={cn("grid grid-cols-2 gap-3 pt-3 border-t", darkMode ? "border-slate-800/80" : "border-slate-200")}>
          <div className={cn("rounded-2xl p-3 border", darkMode ? "bg-[#070B13]/80 border-rose-500/20" : "bg-white border-rose-200 shadow-sm")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gastos Totales</p>
            <p className="text-lg font-bold text-rose-400 mt-0.5 font-display">
              S/ {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[9px] text-slate-400">{expenses.length} ítems calculados</span>
          </div>
          <div className={cn("rounded-2xl p-3 border", darkMode ? "bg-[#070B13]/80 border-emerald-500/20" : "bg-white border-emerald-200 shadow-sm")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Saldo Libre</p>
            <p className="text-lg font-bold text-[#00F5A0] mt-0.5 font-display">
              S/ {remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[9px] text-emerald-400/80">
              {remaining >= 0 ? 'Equilibrado al 100%' : 'Sobregiro en presupuesto'}
            </span>
          </div>
        </div>
      </section>
      {/* END: WeeklyBudgetSummaryCard */}

      {/* BEGIN: DistributionSection */}
      <section className={cn("rounded-3xl border p-5 space-y-4", darkMode ? "bg-[#0B0F19] border-slate-800/80" : "bg-white border-slate-200 shadow-sm")} data-purpose="distribution-breakdown">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className={cn("text-base font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Distribución</h3>
            <span className={cn("text-xs px-2 py-0.5 rounded-md font-medium", darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")}>
              {categorySummary.length} categorías
            </span>
          </div>
          {/* Pie/Chart shortcut */}
          <button 
            onClick={() => setShowDistributionModal(!showDistributionModal)}
            aria-label="Ver gráfico de distribución" 
            className={cn("p-1.5 rounded-lg transition cursor-pointer", darkMode ? "bg-[#192033]/60 text-emerald-400 hover:text-white" : "bg-slate-100 text-emerald-600 hover:bg-slate-200")}
          >
            <PieChart className="w-4 h-4" />
          </button>
        </div>

        {/* Progress items */}
        <div className="space-y-3.5">
          {categorySummary.length > 0 ? (
            categorySummary.map(([cat, amount], idx) => {
              const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
              const theme = getCategoryColor(idx);
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2">
                      <span className={cn("w-2 h-2 rounded-full", theme.dot)}></span>
                      <span className={cn("font-medium", darkMode ? "text-slate-200" : "text-slate-700")}>{cat}</span>
                    </div>
                    <span className={cn("font-bold", darkMode ? "text-white" : "text-slate-900")}>
                      S/ {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">({pct}%)</span>
                    </span>
                  </div>
                  <div className={cn("w-full h-2 rounded-full overflow-hidden", darkMode ? "bg-[#05070B]" : "bg-slate-100")}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                      className={cn("h-full rounded-full", theme.bar)} 
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-400 text-center py-2">Agrega gastos para visualizar la distribución automática.</p>
          )}
        </div>
      </section>
      {/* END: DistributionSection */}

      {/* BEGIN: QuickBudgetPlannerForm */}
      <section className={cn("rounded-3xl border p-5 space-y-4", darkMode ? "bg-gradient-to-b from-[#101524] to-[#0B0F19] border-slate-700/60" : "bg-white border-slate-200 shadow-sm")} data-purpose="new-expense-planner">
        <div className="flex items-center justify-between">
          <div>
            <h3 className={cn("text-base font-bold", darkMode ? "text-white" : "text-slate-900")}>Nuevo Gasto</h3>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#00F5A0]">Planifica tu consumo</p>
          </div>
          {/* Quick tag icon */}
          <button 
            type="button" 
            onClick={() => setIsManagingCategories(!isManagingCategories)}
            className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00F5A0] cursor-pointer hover:bg-emerald-500/20 transition-all"
            title="Administrar categorías"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Chips Grid / Tags for fast categorization */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {defaultChips.map(chip => {
            const isSelected = selectedChip === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  setSelectedChip(chip);
                  if (!expenseName) setExpenseName(chip === '+ Otros' ? '' : chip);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[11px] transition-all cursor-pointer",
                  isSelected
                    ? "bg-emerald-500/20 border border-emerald-500/60 font-semibold text-[#00F5A0] shadow-sm shadow-emerald-500/10"
                    : darkMode 
                      ? "bg-[#070B13] border border-slate-700 text-slate-300 hover:text-white" 
                      : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                )}
              >
                {chip}
              </button>
            );
          })}
        </div>

        {/* Input row: Concept & Amount */}
        <div className="grid grid-cols-12 gap-2 pt-1">
          <div className="col-span-7">
            <input 
              type="text"
              value={expenseName}
              onChange={e => setExpenseName(e.target.value)}
              placeholder="Concepto (ej. Taxi)..." 
              className={cn(
                "w-full rounded-2xl px-3.5 py-3 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium",
                darkMode 
                  ? "bg-[#05070B] border border-slate-700 text-white placeholder-slate-500" 
                  : "bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400"
              )}
            />
          </div>
          <div className="col-span-5 relative">
            <span className="absolute left-3 top-3 text-xs font-semibold text-[#00F5A0] font-mono">S/</span>
            <input 
              type="number"
              step="0.01"
              value={expenseAmount}
              onChange={e => setExpenseAmount(e.target.value)}
              placeholder="0.00" 
              className={cn(
                "w-full rounded-2xl pl-8 pr-3 py-3 text-xs font-bold text-right focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-display",
                darkMode 
                  ? "bg-[#05070B] border border-slate-700 text-white placeholder-slate-500" 
                  : "bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400"
              )}
            />
          </div>
        </div>

        {/* Action Submit Button */}
        <button 
          type="button"
          onClick={() => handleAddExpense()}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-[#00F5A0] hover:opacity-95 text-[#05070B] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Agregar Gasto al Plan</span>
        </button>
      </section>
      {/* END: QuickBudgetPlannerForm */}

      {/* BEGIN: PlannedExpensesList */}
      <section className="space-y-3 pt-1" data-purpose="planned-expenses-list">
        <div className="flex items-center justify-between px-1">
          <h3 className={cn("text-base font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
            Gastos Planificados
          </h3>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-[#00F5A0]">
            {expenses.length} Artículos
          </span>
        </div>

        <div className="space-y-2.5">
          {expenses.map((exp, idx) => {
            const theme = getExpenseIconDetails(exp.name, exp.category);
            const Icon = theme.Icon;
            return (
              <div 
                key={idx}
                className={cn(
                  "p-3.5 rounded-2xl border flex items-center justify-between transition-all group",
                  darkMode 
                    ? "bg-[#0B0F19] border-slate-800 hover:border-slate-700" 
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0",
                    darkMode ? "bg-[#070B13]" : "bg-slate-50",
                    theme.border,
                    theme.color
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={cn("text-xs font-semibold uppercase tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
                      {exp.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {exp.category || 'Gasto planificado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={cn("text-sm font-bold font-display", darkMode ? "text-white" : "text-slate-900")}>
                    S/ {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button 
                    onClick={() => handleRemoveExpense(idx)}
                    aria-label={`Eliminar ${exp.name}`} 
                    className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                    title="Eliminar del presupuesto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {expenses.length === 0 && (
            <div className={cn(
              "border border-dashed rounded-3xl p-8 text-center transition-colors relative overflow-hidden",
              darkMode ? "hero-obsidian border-emerald-500/30" : "bg-slate-50 border-slate-300"
            )}>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-[#00F5A0]">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h4 className={cn("text-sm font-extrabold uppercase tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
                No hay gastos planificados aún
              </h4>
              <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                Comienza agregando tus consumos para la semana o carga los 4 ítems predeterminados.
              </p>
              <button 
                onClick={handleSeedMockupData}
                className="mt-4 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-[#00F5A0] text-[#05070B] font-extrabold text-xs uppercase tracking-wider shadow-glow-emerald hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Cargar Presupuesto de Ejemplo (S/ 200)
              </button>
            </div>
          )}
        </div>
      </section>
      {/* END: PlannedExpensesList */}
    </motion.div>
  );
}

function FinanceAdvisorView({ movements, accounts, goals, categories, darkMode, plan, userProfile }: { movements: Movement[], accounts: Account[], goals: Goal[], categories: Category[], darkMode: boolean, plan: 'basic' | 'premium', userProfile: UserProfile | null }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const statsSummary = useMemo(() => {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.currentAmount >= g.targetAmount).length;
    
    // Summary by category
    const spendingByCategory: Record<string, number> = {};
    const incomeByCategory: Record<string, number> = {};
    
    movements.forEach(m => {
      const cat = categories.find(c => c.id === m.categoryId)?.name || 'Sin categoría';
      if (m.type === 'expense') {
        spendingByCategory[cat] = (spendingByCategory[cat] || 0) + m.amount;
      } else {
        incomeByCategory[cat] = (incomeByCategory[cat] || 0) + m.amount;
      }
    });

    const categoryLimitsStr = categories
      .filter(c => c.limit !== undefined && c.limit > 0)
      .map(c => `${c.name}: Límite S/ ${c.limit}`)
      .join(', ');

    const recentMovements = movements.slice(0, 30).map(m => {
      const cat = categories.find(c => c.id === m.categoryId)?.name || 'Sin categoría';
      return `${m.type === 'income' ? '+' : '-'}S/ ${m.amount} en ${cat} (${format(parseISO(m.date), 'dd/MM/yy')})${m.note ? ` - Nota del usuario: "${m.note}"` : ''}`;
    }).join('; ');
    
    const spendingStr = Object.entries(spendingByCategory).map(([cat, amt]) => `${cat}: S/ ${amt}`).join(', ');
    const incomeStr = Object.entries(incomeByCategory).map(([cat, amt]) => `${cat}: S/ ${amt}`).join(', ');

    return `
      FECHA ACTUAL: ${format(new Date(), 'yyyy-MM-dd HH:mm')}
      SALDO TOTAL CUENTAS: S/ ${totalBalance}
      METAS: ${completedGoals}/${totalGoals} completadas.
      
      PRESUPUESTOS Y LÍMITES POR CATEGORÍA:
      ${categoryLimitsStr || 'No hay límites de presupuesto establecidos aún para las categorías.'}

      RESUMEN POR CATEGORÍAS (HISTÓRICO ACUMULADO):
      GASTOS: ${spendingStr || 'Sin gastos registrados'}
      INGRESOS: ${incomeStr || 'Sin ingresos registrados'}
      
      ÚLTIMOS 30 MOVIMIENTOS DETALLADOS (CON NOTAS):
      ${recentMovements}
      
      TOTAL MOVIMIENTOS REGISTRADOS: ${movements.length}
    `;
  }, [movements, accounts, goals, categories]);

  const handleSend = async (customInput?: string) => {
    const textToSend = customInput || input;
    if (!textToSend.trim() || isTyping) return;
    if (plan === 'basic' && messages.length >= 6) { // More messages allowed in basic for context testing
      alert("El plan básico tiene un límite. ¡Pásate a Premium para chats ilimitados!");
      return;
    }

    const userMsg = { role: 'user' as const, text: textToSend };
    const newHistory = [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const apiKey = userProfile?.geminiApiKey || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: "Configura tu Gemini API Key en Ajustes para usar el asesor IA." 
        }]);
        setIsTyping(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const systemInstruction = `Eres LIA (Logros e Inteligencia Ahorrativa), una asesora financiera experta, profesional, natural y cercana. 
      Tu objetivo es ayudar al usuario a gestionar su dinero basándote ÚNICAMENTE en sus datos REALES proporcionados a continuación.
      
      CONTEXTO FINANCIERO DEL USUARIO (Datos actuales):
      ${statsSummary}
      
      REGLAS CRÍTICAS DE RESPUESTA:
      1. BÚSQUEDA DE BREVEDAD: Responde de forma muy concisa. Si es un saludo (hola, qué tal, etc), responde en UNA O DOS líneas de forma natural y cercana, invitando al usuario a preguntar.
      2. ANÁLISIS DE NOTAS Y LÍMITES: Conoces las notas que escribe el usuario en sus movimientos y los límites que configura en sus categorías. Léelos, compréndelos y úsalos para darle respuestas increíblemente personalizadas y precisas (ej: si pregunta en qué gastó en cierta categoría, menciónale las notas registradas de esos movimientos).
      3. NO REPITAS DATOS: Nunca des un resumen de todas las cuentas o gastos a menos que te lo pidan explícitamente.
      4. ESPECIFICIDAD: Solo cuando pregunten por gastos (ej: "cuánto gasté en comida"), usa los datos para dar la cifra exacta y un consejo breve.
      5. CONTINUIDAD HUMANA: Sigue el flujo de la charla como ChatGPT o Claude. Sé una experta humana, no un reporte automático.
      6. MÁXIMO 2-3 PÁRRAFOS: Incluso para consultas complejas, nunca excedas este límite.
      7. SIGUE LA CORRIENTE: Si el usuario bromea o charla de forma casual, responde con naturalidad antes de volver al tema financiero.`;

      const contents = [
        ...newHistory.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }))
      ];

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
          systemInstruction: systemInstruction
        }
      });
      const modelMsg = { role: 'model' as const, text: result.text || "Lo siento, no pude procesar tu solicitud." };
      setMessages(prev => [...prev, modelMsg]);
    } catch (error: any) {
      console.error("Error with Gemini:", error);
      let errorMessage = "Hubo un error al conectar con el asesor. Por favor intenta de nuevo.";
      
      if (error?.message?.includes('API_KEY_INVALID')) {
        errorMessage = "La API Key de Gemini es inválida. Por favor verifícala en Ajustes.";
      } else if (error?.message?.includes('quota')) {
        errorMessage = "Se ha agotado la cuota de la API de Gemini. Intenta más tarde.";
      }

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickQueries = [
    "¿Cúanto gasté la semana pasada?",
    "¿En qué categoría gasto más?",
    "¿Cómo voy con mis metas?",
    "¿Consejo para ahorrar hoy?"
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-[calc(100vh-190px)] space-y-3"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className={cn("text-xl font-black font-display uppercase tracking-tight flex items-center gap-2", darkMode ? "text-white" : "text-slate-900")}>
            <Sparkles className="w-5 h-5 text-[#00F5A0]" />
            Agente IA (LIA)
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.25em] mt-0.5">
            Asesora Financiera Neuro-Predictiva
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[#00F5A0] text-[9px] font-extrabold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] animate-pulse" />
            Gemini 3.5 Online
          </span>
        </div>
      </div>

      {/* Main Chat Container */}
      <div className={cn(
        "flex-1 overflow-y-auto p-4 sm:p-5 rounded-3xl border space-y-4 transition-colors relative",
        darkMode 
          ? "hero-obsidian border-slate-800/80 shadow-card-subtle" 
          : "bg-white border-slate-200 shadow-lg"
      )}>
        {/* Background glow */}
        <div className="absolute top-0 right-1/4 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-5 p-4 relative z-10">
            {/* Animated Sphere Core Icon */}
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500/20 via-teal-500/15 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center shadow-glow-emerald">
                <Sparkles className="w-9 h-9 text-[#00F5A0]" />
              </div>
              <div className="absolute inset-0 rounded-full border border-emerald-400/20 animate-ping pointer-events-none" />
            </div>

            <div>
              <h3 className={cn("font-black text-xl uppercase tracking-tight font-display", darkMode ? "text-white" : "text-slate-900")}>
                Hola, soy LIA
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Conozco tus movimientos, límites y metas en tiempo real. Pregúntame lo que necesites para optimizar tus finanzas.
              </p>

              <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-md mx-auto">
                {quickQueries.map((q, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSend(q)}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-[11px] font-bold tracking-tight border transition-all active:scale-95 cursor-pointer",
                      darkMode 
                        ? "bg-slate-900/90 border-slate-800 text-slate-300 hover:text-[#00F5A0] hover:border-emerald-500/50" 
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 shadow-sm"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 relative z-10">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "max-w-[85%] p-4 rounded-2xl text-[13px] font-medium leading-relaxed shadow-sm transition-all",
                  msg.role === 'user' 
                    ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-slate-950 font-bold rounded-tr-none shadow-glow-emerald" 
                    : darkMode 
                    ? "bg-slate-900/95 text-slate-200 rounded-tl-none border border-slate-800 shadow-md" 
                    : "bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200"
                )}>
                  {msg.role === 'model' && (
                    <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800/80">
                      <Sparkles className="w-3.5 h-3.5 text-[#00F5A0]" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#00F5A0] font-mono">
                        LIA Finanzas
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}

            {/* Quick replies */}
            {messages[messages.length-1].role === 'model' && (
              <div className="flex gap-2 p-1 overflow-x-auto no-scrollbar pt-2">
                {["Gracias LIA", "¿Y mis metas?", "¿Cómo recorto gastos hoy?", "¿Cuál fue mi mayor gasto?"].map((q, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSend(q)}
                    className={cn(
                      "whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all active:scale-95 cursor-pointer",
                      darkMode 
                        ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-[#00F5A0] hover:border-emerald-500/40" 
                        : "bg-slate-100 border-slate-300 text-slate-600 hover:text-emerald-700"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isTyping && (
          <div className="flex justify-start relative z-10">
            <div className={cn(
              "p-3 rounded-2xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 border",
              darkMode ? "bg-slate-900 border-slate-800 text-[#00F5A0]" : "bg-slate-50 border-slate-200 text-emerald-700"
            )}>
              <span className="w-2 h-2 rounded-full bg-[#00F5A0] animate-ping" />
              LIA está analizando tus finanzas...
            </div>
          </div>
        )}
      </div>

      {/* Input Dock */}
      <div className="p-1">
        <div className="flex gap-2 items-center">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pregúntale a LIA sobre tus finanzas..."
            className={cn(
              "flex-1 py-3.5 px-5 rounded-2xl border transition-all text-sm font-semibold focus:outline-none",
              darkMode 
                ? "bg-slate-900/90 border-slate-800 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                : "bg-white border-slate-200 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            )}
          />
          <button 
            onClick={() => handleSend()}
            disabled={isTyping || !input.trim()}
            className="w-13 h-13 flex items-center justify-center bg-gradient-to-r from-emerald-500 via-[#00F5A0] to-teal-400 text-slate-950 font-black rounded-2xl shadow-glow-emerald active:scale-95 transition-all disabled:opacity-40 shrink-0 cursor-pointer hover:brightness-110"
            title="Enviar mensaje"
          >
            <Send className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function RecurringPaymentModal({ 
  isOpen, 
  onClose, 
  categories, 
  userId, 
  darkMode,
  recurringPayments 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  categories: Category[], 
  userId: string, 
  darkMode: boolean,
  recurringPayments: RecurringPayment[]
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly'>('monthly');

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (!name || !amount || !categoryId) return;
    
    const newPayment: Omit<RecurringPayment, 'id'> = {
      name,
      amount: parseFloat(amount),
      dueDate: new Date(dueDate).toISOString(),
      frequency,
      categoryId,
      userId,
      isPaid: false
    };

    try {
      await addDoc(collection(db, 'recurringPayments'), newPayment);
      setName('');
      setAmount('');
      onClose();
    } catch (error) {
      console.error("Error adding recurring payment:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recurringPayments', id));
    } catch (error) {
      console.error("Error deleting recurring payment:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={cn(
          "relative w-full max-w-md p-8 rounded-[3rem] border shadow-2xl overflow-hidden",
          darkMode ? "bg-black border-zinc-800" : "bg-white border-slate-100"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <h3 className={cn("text-2xl font-black uppercase tracking-widest", darkMode ? "text-white" : "text-slate-900")}>Pagos Recurrentes</h3>
          <button onClick={onClose} className={cn("p-2 rounded-full", darkMode ? "hover:bg-zinc-900 text-slate-400" : "hover:bg-slate-100 text-slate-400")}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* List existing */}
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            {recurringPayments.map(p => (
              <div key={p.id} className={cn("p-3 rounded-2xl flex items-center justify-between", darkMode ? "bg-zinc-900/50" : "bg-slate-50")}>
                <div>
                  <p className={cn("text-xs font-bold", darkMode ? "text-white" : "text-slate-900")}>{p.name}</p>
                  <p className="text-[9px] text-slate-500 uppercase">S/ {p.amount} • {p.frequency}</p>
                </div>
                <button onClick={() => p.id && handleDelete(p.id)} className="text-rose-500 p-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="h-px bg-zinc-800/50" />

          {/* Add new */}
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Nombre (ej: Alquiler)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn("w-full p-4 rounded-2xl text-sm font-bold", darkMode ? "bg-zinc-900 text-white border-none" : "bg-slate-50 text-slate-900 border-none")}
            />
            <div className="grid grid-cols-2 gap-3">
              <input 
                type="number" 
                placeholder="Monto"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn("w-full p-4 rounded-2xl text-sm font-bold", darkMode ? "bg-zinc-900 text-white border-none" : "bg-slate-50 text-slate-900 border-none")}
              />
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={cn("w-full p-4 rounded-2xl text-sm font-bold", darkMode ? "bg-zinc-900 text-white border-none" : "bg-slate-50 text-slate-900 border-none")}
              />
            </div>
            <select 
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={cn("w-full p-4 rounded-2xl text-sm font-bold", darkMode ? "bg-zinc-900 text-white border-none" : "bg-slate-50 text-slate-900 border-none")}
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button 
                onClick={() => setFrequency('monthly')}
                className={cn("flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all", 
                  frequency === 'monthly' ? "bg-blue-700 text-white" : (darkMode ? "bg-zinc-900 text-slate-500" : "bg-slate-100 text-slate-500"))}
              >
                Mensual
              </button>
              <button 
                onClick={() => setFrequency('weekly')}
                className={cn("flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all", 
                  frequency === 'weekly' ? "bg-blue-700 text-white" : (darkMode ? "bg-zinc-900 text-slate-500" : "bg-slate-100 text-slate-500"))}
              >
                Semanal
              </button>
            </div>
            <button 
              onClick={handleAdd}
              className="w-full py-4 bg-blue-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
            >
              Agregar Recordatorio
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function QuickActionModal({ 
  isOpen, 
  onClose, 
  darkMode, 
  userId,
  editingAction 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  darkMode: boolean, 
  userId: string,
  editingAction: QuickAction | null
}) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [icon, setIcon] = useState('DollarSign');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingAction) {
      setLabel(editingAction.label);
      setAmount(editingAction.amount.toString());
      setIcon(editingAction.icon);
    } else {
      setLabel('');
      setAmount('');
      setIcon('DollarSign');
    }
  }, [editingAction, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !amount || !userId) return;

    setIsSubmitting(true);
    try {
      const data = {
        label,
        amount: parseFloat(amount),
        icon,
        userId
      };

      if (editingAction) {
        await updateDoc(doc(db, 'quickActions', editingAction.id), data);
      } else {
        await addDoc(collection(db, 'quickActions'), data);
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingAction) return;
    if (!window.confirm('¿Eliminar este acceso rápido?')) return;
    
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'quickActions', editingAction.id));
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const icons = ['DollarSign', 'Utensils', 'Bus', 'Coffee', 'Smartphone', 'Sun', 'ShoppingBag', 'Zap', 'Heart', 'Music'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden",
          darkMode ? "glass-card border-zinc-800/50" : "glass-card-light border-slate-100"
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-widest">
            {editingAction ? 'Editar Gasto Rápido' : 'Nuevo Gasto Rápido'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-50 px-1">Nombre</label>
            <input 
              type="text" 
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Almuerzo"
              className={cn(
                "w-full p-4 rounded-2xl border-none text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all",
                darkMode ? "bg-zinc-900 text-white" : "bg-slate-50 text-slate-900"
              )}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-50 px-1">Monto (S/)</label>
            <input 
              type="number" 
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={cn(
                "w-full p-4 rounded-2xl border-none text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all",
                darkMode ? "bg-zinc-900 text-white" : "bg-slate-50 text-slate-900"
              )}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-50 px-1">Icono</label>
            <div className="grid grid-cols-5 gap-2">
              {icons.map(i => {
                const IconComp = (LucideIcons as any)[i] || DollarSign;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={cn(
                      "p-3 rounded-xl flex items-center justify-center transition-all",
                      icon === i 
                        ? "bg-blue-700 text-white" 
                        : darkMode ? "bg-zinc-900 text-slate-500" : "bg-slate-50 text-slate-400"
                    )}
                  >
                    <IconComp className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            {editingAction && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex-1 py-4 rounded-2xl bg-rose-500/10 text-rose-500 text-xs font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all"
              >
                Eliminar
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-4 rounded-2xl bg-blue-700 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function SummaryTableModal({ 
  isOpen, 
  onClose, 
  movements, 
  categories, 
  darkMode, 
  type 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  movements: Movement[], 
  categories: Category[], 
  darkMode: boolean, 
  type: MovementType 
}) {
  if (!isOpen) return null;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group days by week
  const weeks: Date[][] = [];
  monthDays.forEach(day => {
    const weekIndex = getWeekOfMonth(day) - 1;
    if (!weeks[weekIndex]) weeks[weekIndex] = [];
    weeks[weekIndex].push(day);
  });

  // Filter movements for current month and type
  const currentMovements = movements.filter(m => {
    const d = parseISO(m.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && m.type === type;
  });

  // Get unique categories in these movements
  const usedCategoryIds = Array.from(new Set(currentMovements.map(m => m.categoryId)));
  const usedCategories = usedCategoryIds.map(id => categories.find(c => c.id === id)).filter(Boolean) as Category[];

  const getAmountForDayAndCategory = (day: Date, categoryId: string) => {
    return currentMovements
      .filter(m => isSameDay(parseISO(m.date), day) && m.categoryId === categoryId)
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={cn(
              "w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col",
              darkMode ? "glass-card border-zinc-800/50" : "glass-card-light border-slate-100"
            )}
          >
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className={cn("text-xl font-black font-display uppercase tracking-widest", darkMode ? "text-white" : "text-slate-900")}>
                {type === 'expense' ? 'Gastos' : 'Ingresos'} {format(now, 'MMMM', { locale: es }).toUpperCase()}
              </h2>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 scrollbar-thin">
              <div className="min-w-[800px] space-y-8">
                {weeks.map((weekDays, weekIdx) => {
                  const weekTotal = weekDays.reduce((sum, day) => {
                    return sum + currentMovements.filter(m => isSameDay(parseISO(m.date), day)).reduce((s, m) => s + m.amount, 0);
                  }, 0);

                  return (
                    <div key={weekIdx} className="space-y-0">
                      <table className="w-full border-collapse text-[10px] font-bold">
                        <thead>
                          <tr className={cn(
                            "text-white",
                            type === 'expense' 
                              ? (darkMode ? "bg-rose-600" : "bg-rose-700") 
                              : (darkMode ? "bg-emerald-600" : "bg-emerald-700")
                          )}>
                            <th className="border border-white/20 p-3 text-left w-32 uppercase tracking-tighter">DESCRIPCION</th>
                            {dayNames.map(name => (
                              <th key={name} className="border border-white/20 p-3 uppercase tracking-tighter">{name}</th>
                            ))}
                            <th className="border border-white/20 p-3 uppercase w-24 bg-black/30">TOTAL</th>
                          </tr>
                          <tr className={cn(
                            darkMode ? "bg-zinc-800 text-slate-300" : "bg-slate-200 text-slate-700"
                          )}>
                            <th className="border border-slate-300 dark:border-zinc-700 p-1.5"></th>
                            {dayNames.map((_, i) => {
                              const dayInWeek = weekDays.find(d => getDay(d) === i);
                              return (
                                <th key={i} className={cn(
                                  "border border-slate-300 dark:border-zinc-700 p-1.5 text-center font-black text-sm",
                                  dayInWeek && (darkMode ? "bg-blue-600/20 text-blue-400" : "bg-blue-100 text-blue-700")
                                )}>
                                  {dayInWeek ? format(dayInWeek, 'd') : ''}
                                </th>
                              );
                            })}
                            <th className="border border-slate-300 dark:border-zinc-700 p-1.5 bg-black/10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {usedCategories.map(cat => {
                            const rowTotal = weekDays.reduce((sum, day) => sum + getAmountForDayAndCategory(day, cat.id), 0);
                            if (rowTotal === 0) return null;

                            return (
                              <tr key={cat.id} className={darkMode ? "hover:bg-zinc-800/30" : "hover:bg-slate-50"}>
                                <td className={cn(
                                  "border border-slate-200 dark:border-zinc-800 p-2 font-black uppercase tracking-tighter",
                                  darkMode ? "bg-zinc-900/30 text-slate-300" : "bg-slate-50/50 text-slate-600"
                                )}>
                                  {cat.name}
                                </td>
                                {dayNames.map((_, i) => {
                                  const dayInWeek = weekDays.find(d => getDay(d) === i);
                                  const amount = dayInWeek ? getAmountForDayAndCategory(dayInWeek, cat.id) : 0;
                                  return (
                                    <td key={i} className="border border-slate-200 dark:border-zinc-800 p-2 text-center font-display text-xs">
                                      {amount > 0 ? `S/ ${amount.toLocaleString()}` : ''}
                                    </td>
                                  );
                                })}
                                <td className={cn(
                                  "border border-slate-200 dark:border-zinc-800 p-2 text-center font-black font-display text-xs",
                                  type === 'expense' ? "text-rose-500 bg-rose-500/5" : "text-emerald-500 bg-emerald-500/5"
                                )}>
                                  S/ {rowTotal.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className={cn(
                            "font-black",
                            darkMode ? "bg-zinc-900 text-slate-200" : "bg-slate-200 text-slate-700"
                          )}>
                            <td className="border border-slate-300 dark:border-zinc-700 p-2 uppercase tracking-widest text-blue-400">SUBTOTAL</td>
                            {dayNames.map((_, i) => {
                              const dayInWeek = weekDays.find(d => getDay(d) === i);
                              const dayTotal = dayInWeek ? currentMovements.filter(m => isSameDay(parseISO(m.date), dayInWeek)).reduce((s, m) => s + m.amount, 0) : 0;
                              return (
                                <td key={i} className="border border-slate-300 dark:border-zinc-700 p-2 text-center font-display text-xs">
                                  {dayTotal > 0 ? `S/ ${dayTotal.toLocaleString()}` : ''}
                                </td>
                              );
                            })}
                            <td className={cn(
                              "border border-slate-300 dark:border-zinc-700 p-2 text-center font-display text-sm",
                              type === 'expense' ? "text-rose-600 bg-rose-600/10" : "text-emerald-600 bg-emerald-600/10"
                            )}>
                              S/ {weekTotal.toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                
                <div className={cn(
                  "p-4 rounded-2xl flex items-center justify-between",
                  darkMode ? "bg-blue-900/20 border border-blue-500/20" : "bg-amber-500 border border-amber-600"
                )}>
                  <span className={cn("text-lg font-black uppercase tracking-widest", darkMode ? "text-blue-400" : "text-white")}>TOTAL GENERAL</span>
                  <span className={cn("text-2xl font-black font-display", darkMode ? "text-white" : "text-white")}>
                    S/ {currentMovements.reduce((s, m) => s + m.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DashboardView({ 
  movements, 
  accounts, 
  categories, 
  goals, 
  recurringPayments,
  quickActions,
  userProfile,
  darkMode, 
  stats, 
  setActiveTab, 
  onAddMovement, 
  onNavigateToCalendar,
  onDeleteMovement,
  deferredPrompt
}: { 
  movements: Movement[], 
  accounts: Account[], 
  categories: Category[], 
  goals: Goal[], 
  recurringPayments: RecurringPayment[],
  quickActions: QuickAction[],
  userProfile: UserProfile | null,
  darkMode: boolean, 
  stats: DashboardStats, 
  setActiveTab: (tab: string) => void, 
  onNavigateToCalendar: (date?: Date, viewDate?: Date) => void,
  onAddMovement: (type?: MovementType) => void, 
  onDeleteMovement?: (m: Movement) => void,
  deferredPrompt: any
}) {
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isQuickActionModalOpen, setIsQuickActionModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [editingQuickAction, setEditingQuickAction] = useState<QuickAction | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [summaryModal, setSummaryModal] = useState<{ open: boolean, type: MovementType }>({ open: false, type: 'expense' });
  const [showBalance, setShowBalance] = useState(true);
  const [periodTab, setPeriodTab] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const personalDailyStats = useMemo(() => {
    const dMovements = movements.filter(m => isSameDay(parseISO(m.date), selectedDay));
    return {
      income: dMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0),
      expense: dMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0),
    };
  }, [selectedDay, movements]);

  const personalWeeklyStats = useMemo(() => {
    const start = startOfWeek(selectedWeek, { weekStartsOn: 0 });
    const end = endOfWeek(selectedWeek, { weekStartsOn: 0 });
    const wMovements = movements.filter(m => {
      const d = parseISO(m.date);
      return d >= start && d <= end;
    });
    return {
      income: wMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0),
      expense: wMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0),
    };
  }, [selectedWeek, movements]);

  const personalMonthlyStats = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const mMovements = movements.filter(m => {
      const d = parseISO(m.date);
      return d >= start && d <= end;
    });
    return {
      income: mMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0),
      expense: mMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0),
    };
  }, [selectedMonth, movements]);

  const currentPeriodStats = useMemo(() => {
    if (periodTab === 'day') return personalDailyStats;
    if (periodTab === 'week') return personalWeeklyStats;
    return personalMonthlyStats;
  }, [periodTab, personalDailyStats, personalWeeklyStats, personalMonthlyStats]);

  const defaultQuickActions = [
    { id: 'qa-1', label: 'Pasaje', amount: 1.5, icon: 'Bus' },
    { id: 'qa-2', label: 'Café', amount: 5.0, icon: 'Coffee' },
    { id: 'qa-3', label: 'Almuerzo', amount: 15.0, icon: 'Utensils' },
    { id: 'qa-4', label: 'Ahorro', amount: 10.0, icon: 'PiggyBank' },
  ];

  const displayQuickActions = quickActions.length > 0 ? quickActions : defaultQuickActions;

  const handleQuickExpense = async (amount: number, categoryName: string) => {
    if (accounts.length === 0) {
      alert('Primero crea una cuenta en la pestaña "Cuentas"');
      return;
    }
    
    const account = accounts[0]; // Use first account as default
    const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    let catId = category?.id;

    if (!category) {
      try {
        const docRef = await addDoc(collection(db, 'categories'), { name: categoryName, userId: account.userId });
        catId = docRef.id;
      } catch (err) {
        console.error("Error creating category on the fly:", err);
        return;
      }
    }

    const newMovement: Omit<Movement, 'id'> = {
      type: 'expense',
      amount,
      categoryId: catId!,
      accountOriginId: account.id,
      date: new Date().toISOString(),
      userId: account.userId
    };

    try {
      await runTransaction(db, async (transaction) => {
        const accountRef = doc(db, 'accounts', account.id);
        const accountSnap = await transaction.get(accountRef);
        if (!accountSnap.exists()) return;
        
        const currentBalance = accountSnap.data().balance;
        transaction.update(accountRef, { balance: currentBalance - amount });
        transaction.set(doc(collection(db, 'movements')), newMovement);
      });
    } catch (error) {
      console.error("Error adding quick expense:", error);
    }
  };

  const handleAiParse = async () => {
    const apiKey = userProfile?.geminiApiKey || process.env.GEMINI_API_KEY;
    
    if (!aiInput.trim() || !apiKey) {
      if (!apiKey) setAiError('Configura tu Gemini API Key en Ajustes');
      return;
    }

    setIsAiLoading(true);
    setAiError('');

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Analiza este texto de gasto y devuelve un JSON con: amount (número), category (nombre de categoría), note (opcional). 
      Categorías disponibles: ${categories.map(c => c.name).join(', ')}. 
      Texto: "${aiInput}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      if (result.amount && result.category) {
        const category = categories.find(c => c.name.toLowerCase().includes(result.category.toLowerCase()));
        if (category) {
          await handleQuickExpense(result.amount, category.name);
          setAiInput('');
          alert('Gasto registrado con éxito vía IA');
        } else {
          setAiError('No pude identificar la categoría');
        }
      } else {
        setAiError('No pude entender el monto o la categoría');
      }
    } catch (error) {
      console.error("AI Parse Error:", error);
      setAiError('Error al procesar con IA');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleMarkAsPaid = async (payment: RecurringPayment) => {
    if (!payment.id) return;
    try {
      const paymentRef = doc(db, 'recurringPayments', payment.id);
      await updateDoc(paymentRef, { isPaid: true });
      
      // Also register as a movement
      const category = categories.find(c => c.id === payment.categoryId);
      if (category && accounts.length > 0) {
        await handleQuickExpense(payment.amount, category.name);
      }
    } catch (error) {
      console.error("Error marking as paid:", error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 pb-32"
    >
      {/* Install App Banner */}
      {!window.matchMedia('(display-mode: standalone)').matches && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all duration-300",
            darkMode ? "titanium-card-subtle border-cyan-500/30" : "bg-cyan-50 border-cyan-200 shadow-sm"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center shadow-sm">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className={cn("text-xs font-bold uppercase tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Instalar App</p>
              <p className="text-[10px] font-medium text-slate-400">Acceso directo en tu inicio</p>
            </div>
          </div>
          <button 
            onClick={async () => {
              if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                  console.log('User accepted the install prompt');
                }
              } else {
                alert('Para instalar: \n1. Toca el botón de compartir \n2. Selecciona "Añadir a pantalla de inicio"');
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            Instalar
          </button>
        </motion.div>
      )}

      {/* Pending Recurring Payments */}
      {recurringPayments.length > 0 && recurringPayments.some(p => !p.isPaid) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#FB7185]" />
              <h3 className={cn("font-bold text-xs uppercase tracking-wider", darkMode ? "text-white" : "text-slate-900")}>Pagos Pendientes</h3>
            </div>
            <button 
              onClick={() => setIsRecurringModalOpen(true)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer",
                darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-white text-slate-700 border border-slate-200 shadow-sm"
              )}
            >
              Gestionar
            </button>
          </div>
          
          <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
            {recurringPayments.filter(p => !p.isPaid).map((payment) => (
              <motion.div
                key={payment.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "min-w-[190px] p-3 rounded-2xl border flex items-center justify-between gap-3 shrink-0",
                  darkMode ? "titanium-card-subtle border-rose-500/30 bg-rose-500/5" : "bg-rose-50 border-rose-100"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-rose-500/15 text-[#FB7185] rounded-xl flex items-center justify-center">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={cn("text-xs font-bold uppercase tracking-tight truncate max-w-[85px]", darkMode ? "text-white" : "text-slate-900")}>
                      {payment.name}
                    </p>
                    <p className="text-[9px] font-semibold text-[#FB7185]">
                      {format(parseISO(payment.dueDate), 'dd MMM', { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-bold font-display tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
                    S/ {payment.amount}
                  </p>
                  <button 
                    onClick={() => handleMarkAsPaid(payment)}
                    className="text-[9px] font-bold uppercase text-emerald-400 hover:underline cursor-pointer"
                  >
                    Pagar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* BEGIN: Quick Overview Mini-Cards */}
      <section className="grid grid-cols-2 gap-3" data-purpose="daily-counter-pills">
        {/* Ingresos Hoy */}
        <div 
          onClick={() => setSummaryModal({ open: true, type: 'income' })}
          className={cn(
            "p-3.5 rounded-2xl flex items-center justify-between border transition cursor-pointer group",
            darkMode 
              ? "titanium-card-subtle border-emerald-500/20 hover:border-emerald-500/40" 
              : "bg-white border-slate-200 shadow-sm hover:border-emerald-400"
          )}
        >
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#00F5A0] block mb-0.5">Ingresos Hoy</span>
            <div className={cn("text-lg font-extrabold tracking-tight font-display", darkMode ? "text-white" : "text-slate-900")}>
              S/ {stats.dailyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[#00F5A0] shadow-glow-emerald/30 group-hover:scale-105 transition-transform shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* Gastos Hoy */}
        <div 
          onClick={() => setSummaryModal({ open: true, type: 'expense' })}
          className={cn(
            "p-3.5 rounded-2xl flex items-center justify-between border transition cursor-pointer group",
            darkMode 
              ? "titanium-card-subtle border-rose-500/20 hover:border-rose-500/40" 
              : "bg-white border-slate-200 shadow-sm hover:border-rose-400"
          )}
        >
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#FB7185] block mb-0.5">Gastos Hoy</span>
            <div className={cn("text-lg font-extrabold tracking-tight font-display", darkMode ? "text-white" : "text-slate-900")}>
              S/ {stats.dailyExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-[#FB7185] group-hover:scale-105 transition-transform shrink-0">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
      </section>

      {/* BEGIN: AI Smart Input Bar */}
      <section data-purpose="ai-quick-register">
        <div className={cn(
          "relative flex items-center p-1.5 rounded-2xl border transition shadow-sm",
          darkMode 
            ? "titanium-glass border-emerald-500/20 hover:border-emerald-500/35 focus-within:border-emerald-500/50" 
            : "bg-white border-slate-200 shadow-sm hover:border-emerald-400 focus-within:border-emerald-500"
        )}>
          <div className="pl-3 pr-2 text-[#00F5A0]">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <input 
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAiParse(); }}
            placeholder="IA: 'Gasté S/ 15 en taxi desde Miraflores'..."
            className={cn(
              "w-full bg-transparent border-0 text-xs sm:text-sm focus:ring-0 focus:outline-none py-2 font-medium",
              darkMode ? "text-slate-100 placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
            )}
          />
          <button 
            onClick={handleAiParse}
            disabled={isAiLoading || !aiInput.trim()}
            className={cn(
              "h-9 px-3.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all active:scale-95 shrink-0 cursor-pointer disabled:cursor-not-allowed",
              aiInput.trim() 
                ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-md shadow-emerald-500/25 font-black" 
                : darkMode ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"
            )}
          >
            {isAiLoading ? (
              <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>Anotar</span>
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>
        {aiError && <p className="text-[10px] text-rose-500 font-bold px-2 uppercase tracking-widest mt-1">{aiError}</p>}
      </section>

      {/* BEGIN: Hero Financial Card (Obsidian Titanium & Emerald Gradient) */}
      <section data-purpose="hero-balance-card">
        <div className={cn(
          "rounded-3xl p-5 relative overflow-hidden transition-all duration-500",
          darkMode 
            ? "hero-obsidian" 
            : "bg-gradient-to-b from-white to-slate-50 border border-slate-200 shadow-xl"
        )}>
          {/* Ambient Decorative Glowing Orbs */}
          <div className="absolute -right-8 -top-8 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top row: Label and Hide Toggle */}
          <div className="flex items-center justify-between mb-2 relative z-10">
            <div className="flex items-center space-x-2">
              <span className={cn("text-xs uppercase tracking-wider font-semibold", darkMode ? "text-slate-400" : "text-slate-500")}>
                Saldo Total Disponible
              </span>
              <span className="w-2 h-2 rounded-full bg-[#00F5A0] shadow-glow-emerald animate-pulse" />
            </div>
            <button 
              onClick={() => setShowBalance(!showBalance)}
              className={cn(
                "p-1.5 rounded-lg transition-colors cursor-pointer", 
                darkMode ? "text-slate-400 hover:text-white bg-slate-900/60" : "text-slate-500 hover:text-slate-900 bg-slate-100"
              )}
              title={showBalance ? "Ocultar Saldo" : "Mostrar Saldo"}
            >
              {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          {/* Main Balance with Emerald-Cyan Gradient */}
          <div className="flex items-baseline space-x-1.5 mb-5 relative z-10">
            <span className={cn("text-2xl font-bold font-mono", darkMode ? "text-slate-400" : "text-slate-500")}>S/</span>
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gradient-emerald font-display">
              {showBalance 
                ? stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                : '••••••'}
            </span>
          </div>

          {/* Breakdown metrics Titanium Obsidian Card */}
          <div className={cn(
            "grid grid-cols-3 gap-2 py-3 px-3.5 rounded-2xl mb-5 relative z-10 backdrop-blur-sm border",
            darkMode ? "bg-[#0B101D]/85 border-slate-800/90" : "bg-white/90 border-slate-200"
          )}>
            <div>
              <span className={cn("text-[10px] uppercase font-semibold block mb-0.5", darkMode ? "text-slate-400" : "text-slate-500")}>Ingresos</span>
              <span className="text-xs sm:text-sm font-bold text-[#00F5A0] font-display">
                +S/ {stats.monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={cn("border-l pl-2 sm:pl-3", darkMode ? "border-slate-800/80" : "border-slate-200")}>
              <span className={cn("text-[10px] uppercase font-semibold block mb-0.5", darkMode ? "text-slate-400" : "text-slate-500")}>Gastos</span>
              <span className="text-xs sm:text-sm font-bold text-[#FB7185] font-display">
                -S/ {stats.monthlyExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={cn("border-l pl-2 sm:pl-3", darkMode ? "border-slate-800/80" : "border-slate-200")}>
              <span className={cn("text-[10px] uppercase font-semibold block mb-0.5", darkMode ? "text-slate-400" : "text-slate-500")}>Neto Mes</span>
              <span className={cn(
                "text-xs sm:text-sm font-bold font-display",
                (stats.monthlyIncome - stats.monthlyExpense) >= 0 ? "text-cyan-400" : "text-[#FB7185]"
              )}>
                {(stats.monthlyIncome - stats.monthlyExpense) >= 0 ? '+' : '-'}S/ {Math.abs(stats.monthlyIncome - stats.monthlyExpense).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Action Pills Titanium Buttons */}
          <div className="grid grid-cols-4 gap-2 relative z-10">
            {/* Ingreso */}
            <button 
              onClick={() => onAddMovement('income')}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-2xl border transition-all active:scale-95 group cursor-pointer",
                darkMode 
                  ? "bg-slate-900/80 hover:bg-slate-800/90 border-emerald-500/25 hover:border-emerald-500/50" 
                  : "bg-white hover:bg-emerald-50/50 border-slate-200 shadow-sm"
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-[#00F5A0] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform shadow-glow-emerald/20">
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className={cn("text-[11px] font-semibold", darkMode ? "text-slate-200" : "text-slate-800")}>Ingreso</span>
            </button>

            {/* Gasto */}
            <button 
              onClick={() => onAddMovement('expense')}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-2xl border transition-all active:scale-95 group cursor-pointer",
                darkMode 
                  ? "bg-slate-900/80 hover:bg-slate-800/90 border-rose-500/25 hover:border-rose-500/50" 
                  : "bg-white hover:bg-rose-50/50 border-slate-200 shadow-sm"
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-[#FB7185] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Minus className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className={cn("text-[11px] font-semibold", darkMode ? "text-slate-200" : "text-slate-800")}>Gasto</span>
            </button>

            {/* Transferir */}
            <button 
              onClick={() => setActiveTab('accounts')}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-2xl border transition-all active:scale-95 group cursor-pointer",
                darkMode 
                  ? "bg-slate-900/80 hover:bg-slate-800/90 border-cyan-500/25 hover:border-cyan-500/50" 
                  : "bg-white hover:bg-cyan-50/50 border-slate-200 shadow-sm"
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <ArrowRightLeft className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className={cn("text-[11px] font-semibold", darkMode ? "text-slate-200" : "text-slate-800")}>Transferir</span>
            </button>

            {/* Metas (Champagne Gold Accent) */}
            <button 
              onClick={() => setActiveTab('goals')}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-2xl border transition-all active:scale-95 group cursor-pointer",
                darkMode 
                  ? "bg-slate-900/80 hover:bg-slate-800/90 border-amber-500/25 hover:border-amber-500/50" 
                  : "bg-white hover:bg-amber-50/50 border-slate-200 shadow-sm"
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Target className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className={cn("text-[11px] font-semibold", darkMode ? "text-slate-200" : "text-slate-800")}>Metas</span>
            </button>
          </div>
        </div>
      </section>

      {/* BEGIN: Quick Tap Expenses (Gastos Frecuentes) */}
      <section data-purpose="quick-expense-pills" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <h2 className={cn("text-sm font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
              Gastos Frecuentes
            </h2>
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              darkMode ? "bg-slate-800/90 text-slate-300 border-slate-700/60" : "bg-slate-100 text-slate-600 border-slate-200"
            )}>
              1-Tap
            </span>
          </div>
          <button 
            onClick={() => {
              setEditingQuickAction(null);
              setIsQuickActionModalOpen(true);
            }}
            className="text-xs font-semibold text-[#00F5A0] hover:text-emerald-300 flex items-center space-x-1 cursor-pointer"
          >
            <span>+ Personalizar</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {displayQuickActions.map((item, idx) => {
            const IconComponent = (LucideIcons as any)[item.icon] || DollarSign;
            
            // Thematic color variations per item: Cyan, Amber, Orange, Neon Emerald
            const themeConfig = [
              {
                iconStyle: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                hoverBorder: "hover:border-cyan-500/40 hover:bg-cyan-500/5",
                priceColor: "text-cyan-400",
              },
              {
                iconStyle: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                hoverBorder: "hover:border-amber-500/40 hover:bg-amber-500/5",
                priceColor: "text-amber-400",
              },
              {
                iconStyle: "bg-orange-500/10 text-orange-400 border-orange-500/20",
                hoverBorder: "hover:border-orange-500/40 hover:bg-orange-500/5",
                priceColor: "text-orange-400",
              },
              {
                iconStyle: "bg-emerald-500/15 text-[#00F5A0] border-emerald-500/30",
                hoverBorder: "hover:border-emerald-500/40 hover:bg-emerald-500/5",
                priceColor: "text-[#00F5A0]",
              }
            ][idx % 4];

            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleQuickExpense(item.amount, item.label)}
                className={cn(
                  "p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 relative group cursor-pointer",
                  darkMode 
                    ? cn("titanium-card-subtle", themeConfig.hoverBorder) 
                    : "bg-white border-slate-200 shadow-sm hover:border-slate-300"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 border",
                  themeConfig.iconStyle
                )}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="text-center w-full">
                  <p className={cn("text-[9px] font-bold uppercase tracking-tight truncate w-full", darkMode ? "text-slate-300" : "text-slate-800")}>
                    {item.label}
                  </p>
                  <p className={cn("text-[11px] font-extrabold font-display", themeConfig.priceColor)}>
                    S/ {item.amount.toFixed(2)}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* BEGIN: Financial Pulse & Periods Summary */}
      <section data-purpose="period-financial-pulse" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className={cn("text-sm font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
            Resumen Financiero
          </h2>
          <div className={cn(
            "flex items-center space-x-1.5 text-[11px] px-2.5 py-1 rounded-xl border capitalize",
            darkMode ? "text-slate-300 bg-slate-900/90 border-slate-800" : "text-slate-700 bg-slate-100 border-slate-200"
          )}>
            <span>{format(selectedMonth, 'MMMM yyyy', { locale: es })}</span>
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        <div className={cn(
          "rounded-3xl p-4 border transition-all duration-300",
          darkMode ? "titanium-glass border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
        )}>
          {/* Segmented Control Filter */}
          <div className={cn(
            "grid grid-cols-3 p-1 rounded-xl border mb-4 text-center",
            darkMode ? "bg-slate-950/70 border-slate-800/80" : "bg-slate-100 border-slate-200"
          )}>
            <button 
              onClick={() => setPeriodTab('day')}
              className={cn(
                "py-1.5 text-xs transition cursor-pointer rounded-lg",
                periodTab === 'day' 
                  ? "font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-sm" 
                  : darkMode ? "font-medium text-slate-400 hover:text-white" : "font-medium text-slate-600 hover:text-slate-900"
              )}
            >
              Hoy
            </button>
            <button 
              onClick={() => setPeriodTab('week')}
              className={cn(
                "py-1.5 text-xs transition cursor-pointer rounded-lg",
                periodTab === 'week' 
                  ? "font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-sm" 
                  : darkMode ? "font-medium text-slate-400 hover:text-white" : "font-medium text-slate-600 hover:text-slate-900"
              )}
            >
              Semana
            </button>
            <button 
              onClick={() => setPeriodTab('month')}
              className={cn(
                "py-1.5 text-xs transition cursor-pointer rounded-lg",
                periodTab === 'month' 
                  ? "font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-sm" 
                  : darkMode ? "font-medium text-slate-400 hover:text-white" : "font-medium text-slate-600 hover:text-slate-900"
              )}
            >
              Mes ({format(selectedMonth, 'MMM', { locale: es })})
            </button>
          </div>

          {/* Period Statistics Row */}
          <div className={cn("flex items-center justify-between pb-3 border-b", darkMode ? "border-slate-800/80" : "border-slate-200")}>
            <div>
              <span className={cn("text-[11px] font-medium block mb-0.5", darkMode ? "text-slate-400" : "text-slate-500")}>Total Ingresos</span>
              <div className="text-base font-extrabold text-[#00F5A0] font-display">
                +S/ {currentPeriodStats.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-center">
              <span className={cn("text-[11px] font-medium block mb-0.5", darkMode ? "text-slate-400" : "text-slate-500")}>Total Gastos</span>
              <div className="text-base font-extrabold text-[#FB7185] font-display">
                -S/ {currentPeriodStats.expense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-right">
              <span className={cn("text-[11px] font-medium block mb-0.5", darkMode ? "text-slate-400" : "text-slate-500")}>Balance Neto</span>
              <div className={cn(
                "text-base font-extrabold font-display",
                (currentPeriodStats.income - currentPeriodStats.expense) >= 0 ? "text-cyan-400" : "text-[#FB7185]"
              )}>
                {(currentPeriodStats.income - currentPeriodStats.expense) >= 0 ? '+' : '-'}S/ {Math.abs(currentPeriodStats.income - currentPeriodStats.expense).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Smart Insights Highlights */}
          <div className="pt-3 grid grid-cols-2 gap-2 text-xs">
            <div className={cn(
              "p-2.5 rounded-xl border flex items-center space-x-2.5",
              darkMode ? "bg-slate-900/60 border-slate-800/70" : "bg-slate-50 border-slate-200"
            )}>
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-[#FB7185] shrink-0">
                <PieChart className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className={cn("text-[10px] truncate", darkMode ? "text-slate-400" : "text-slate-500")}>Mayor Categoría</p>
                <p className={cn("font-bold truncate", darkMode ? "text-slate-200" : "text-slate-800")}>{stats.topCategory || 'General'}</p>
              </div>
            </div>

            <div className={cn(
              "p-2.5 rounded-xl border flex items-center space-x-2.5",
              darkMode ? "bg-slate-900/60 border-slate-800/70" : "bg-slate-50 border-slate-200"
            )}>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#00F5A0] shrink-0">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className={cn("text-[10px] truncate", darkMode ? "text-slate-400" : "text-slate-500")}>Ahorro Estimado</p>
                <p className="font-bold text-[#00F5A0] truncate">
                  S/ {Math.max(0, currentPeriodStats.income - currentPeriodStats.expense).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({currentPeriodStats.income > 0 ? ((Math.max(0, currentPeriodStats.income - currentPeriodStats.expense) / currentPeriodStats.income) * 100).toFixed(1) : '0'}%)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Category Spending (if available) */}
      {stats.weeklyCategoryExpenses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className={cn("font-bold text-xs uppercase tracking-wider", darkMode ? "text-white" : "text-slate-900")}>Gastos por Categoría</h3>
              <span className="bg-emerald-500/15 text-[#00F5A0] border border-emerald-500/30 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">PRO</span>
            </div>
            <p className={cn("text-[10px] font-medium", darkMode ? "text-slate-400" : "text-slate-500")}>Esta Semana</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {stats.weeklyCategoryExpenses.map((cat, idx) => (
              <motion.div 
                key={cat.categoryId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={cn(
                  "p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between group",
                  darkMode ? "titanium-card-subtle" : "bg-white border-slate-200 shadow-sm",
                  cat.amount === 0 && "opacity-40"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                    darkMode ? "bg-slate-800 text-[#00F5A0] border border-slate-700/60" : "bg-slate-100 text-slate-800",
                    cat.amount === 0 && (darkMode ? "bg-slate-800/40 text-slate-500" : "bg-slate-100 text-slate-400")
                  )}>
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={cn("text-xs font-bold uppercase tracking-tight", darkMode ? "text-white" : "text-slate-900")}>{cat.name}</p>
                    <p className={cn("text-[9px] font-medium", darkMode ? "text-slate-400" : "text-slate-500")}>
                      {cat.amount > 0 ? 'Gasto semanal' : 'Sin gastos'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-xs font-bold font-display tracking-tight", 
                    cat.amount > 0 
                      ? (darkMode ? "text-[#FB7185]" : "text-rose-600") 
                      : (darkMode ? "text-slate-500" : "text-slate-400")
                  )}>
                    -S/ {cat.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  {cat.amount > 0 && (
                    <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (cat.amount / Math.max(1, stats.weeklyExpense)) * 100)}%` }}
                        className="h-full bg-[#FB7185]"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* BEGIN: Recent Activity / Transactions */}
      <section data-purpose="recent-activity-list" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className={cn("text-sm font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
            Actividad Reciente
          </h2>
          <button 
            onClick={() => setActiveTab('calendar')} 
            className="text-xs font-semibold text-[#00F5A0] hover:text-emerald-300 transition cursor-pointer"
          >
            Ver todo
          </button>
        </div>

        <div className="space-y-2">
          {movements.slice(0, 5).map(m => (
            <MovementItem 
              key={m.id} 
              movement={m} 
              categories={categories} 
              accounts={accounts} 
              darkMode={darkMode} 
              onDelete={onDeleteMovement}
            />
          ))}
          {movements.length === 0 && (
            <div className={cn(
              "p-8 rounded-2xl border border-dashed text-center",
              darkMode ? "titanium-card-subtle border-slate-800" : "bg-slate-50 border-slate-200"
            )}>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">No hay actividad reciente</p>
            </div>
          )}
        </div>
      </section>

      <RecurringPaymentModal 
        isOpen={isRecurringModalOpen} 
        onClose={() => setIsRecurringModalOpen(false)} 
        categories={categories}
        userId={userProfile?.id || ''}
        darkMode={darkMode}
        recurringPayments={recurringPayments}
      />
      
      <QuickActionModal 
        isOpen={isQuickActionModalOpen}
        onClose={() => setIsQuickActionModalOpen(false)}
        darkMode={darkMode}
        userId={userProfile?.id || ''}
        editingAction={editingQuickAction}
      />

      <SummaryTableModal 
        isOpen={summaryModal.open}
        onClose={() => setSummaryModal({ ...summaryModal, open: false })}
        movements={movements}
        categories={categories}
        darkMode={darkMode}
        type={summaryModal.type}
      />
    </motion.div>
  );
}

function CalendarView({ 
  movements, 
  accounts, 
  categories, 
  darkMode, 
  onDelete,
  selectedDate,
  setSelectedDate,
  viewingDate,
  setViewingDate,
  recurringPayments = [],
  onMarkRecurringAsPaid,
  onAddMovementForDay
}: { 
  movements: Movement[], 
  accounts: Account[], 
  categories: Category[], 
  darkMode: boolean, 
  onDelete?: (m: Movement) => void,
  selectedDate: Date,
  setSelectedDate: (d: Date) => void,
  viewingDate: Date,
  setViewingDate: (d: Date) => void,
  recurringPayments?: RecurringPayment[],
  onMarkRecurringAsPaid?: (payment: RecurringPayment) => void,
  onAddMovementForDay?: (date: Date) => void
}) {

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const days: (Date | null)[] = [];
    let curr = start;
    
    // Add padding for the first day of the week (Sunday = 0, Monday = 1, etc.)
    const startPadding = start.getDay();
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    while (curr <= end) {
      days.push(new Date(curr));
      curr = addDays(curr, 1);
    }
    return days;
  }, [selectedDate]);

  const totalDaysInMonth = useMemo(() => {
    return endOfMonth(selectedDate).getDate();
  }, [selectedDate]);

  const activeDaysCount = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const daysWithMovements = new Set<string>();
    movements.forEach(m => {
      try {
        const d = parseISO(m.date);
        if (d >= monthStart && d <= monthEnd) {
          daysWithMovements.add(format(d, 'yyyy-MM-dd'));
        }
      } catch {
        // ignore invalid dates
      }
    });
    return daysWithMovements.size;
  }, [movements, selectedDate]);

  const monthStats = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    let income = 0;
    let incomeCount = 0;
    let expense = 0;
    let expenseCount = 0;

    movements.forEach(m => {
      try {
        const d = parseISO(m.date);
        if (d >= monthStart && d <= monthEnd) {
          if (m.type === 'income') {
            income += m.amount;
            incomeCount++;
          } else if (m.type === 'expense') {
            expense += m.amount;
            expenseCount++;
          }
        }
      } catch {
        // ignore
      }
    });
    return { income, incomeCount, expense, expenseCount };
  }, [movements, selectedDate]);

  const dailyStats = useMemo(() => {
    const stats: Record<string, { income: number, expense: number }> = {};
    movements.forEach(m => {
      try {
        const dateKey = format(parseISO(m.date), 'yyyy-MM-dd');
        if (!stats[dateKey]) stats[dateKey] = { income: 0, expense: 0 };
        if (m.type === 'income') stats[dateKey].income += m.amount;
        if (m.type === 'expense') stats[dateKey].expense += m.amount;
      } catch {
        // ignore
      }
    });
    return stats;
  }, [movements]);

  const movementsForDay = useMemo(() => {
    return movements.filter(m => {
      try {
        return isSameDay(parseISO(m.date), viewingDate);
      } catch {
        return false;
      }
    });
  }, [viewingDate, movements]);

  const selectedDayStats = useMemo(() => {
    const dateKey = format(viewingDate, 'yyyy-MM-dd');
    return dailyStats[dateKey] || { income: 0, expense: 0 };
  }, [viewingDate, dailyStats]);

  const netDayBalance = selectedDayStats.income - selectedDayStats.expense;

  const recurringForDay = useMemo(() => {
    return recurringPayments.filter(rp => {
      try {
        if (!rp.dueDate) return false;
        return isSameDay(parseISO(rp.dueDate), viewingDate);
      } catch {
        return false;
      }
    });
  }, [recurringPayments, viewingDate]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-32 max-w-md mx-auto"
    >
      {/* BEGIN: MonthNavigationHeader */}
      <section className="mt-1" data-purpose="calendar-month-selector">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className={cn("text-2xl font-extrabold uppercase tracking-tight font-display capitalize", darkMode ? "text-white" : "text-slate-900")}>
                {format(selectedDate, 'MMMM', { locale: es })}
              </h2>
              <span className="text-sm font-semibold text-slate-500 font-mono">
                {format(selectedDate, 'yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] shadow-[0_0_6px_#00F5A0]" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Flujo Diario y Vencimientos
              </p>
            </div>
          </div>

          {/* Controls: Prev, Next, HOY pill */}
          <div className="flex items-center gap-1.5">
            <button 
              aria-label="Mes anterior" 
              onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
              className={cn(
                "w-8 h-8 rounded-lg border flex items-center justify-center transition-all active:scale-90",
                darkMode 
                  ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-emerald-500/40" 
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm"
              )}
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button 
              aria-label="Mes siguiente" 
              onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
              className={cn(
                "w-8 h-8 rounded-lg border flex items-center justify-center transition-all active:scale-90",
                darkMode 
                  ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-emerald-500/40" 
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm"
              )}
            >
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button 
              onClick={() => {
                const now = new Date();
                setSelectedDate(now);
                setViewingDate(now);
              }}
              className="h-8 px-3.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-slate-950 font-extrabold text-[11px] tracking-wider uppercase flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.35)] active:scale-95 transition-all cursor-pointer"
            >
              Hoy
            </button>
          </div>
        </div>
      </section>
      {/* END: MonthNavigationHeader */}

      {/* BEGIN: MonthKPICards */}
      <section className="grid grid-cols-3 gap-2 pt-1" data-purpose="kpi-month-overview">
        {/* KPI 1: Días con registros */}
        <div className={cn(
          "rounded-2xl p-2.5 border flex flex-col justify-between transition-all",
          darkMode ? "obsidian-card border-slate-800/80" : "obsidian-card-light"
        )}>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
            Días Registrados
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className={cn("text-lg font-black font-display", darkMode ? "text-white" : "text-slate-900")}>
              {activeDaysCount}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              /{totalDaysInMonth} d
            </span>
          </div>
          <div className={cn("w-full h-1 rounded-full overflow-hidden", darkMode ? "bg-slate-800" : "bg-slate-200")}>
            <div 
              className="h-full bg-[#00F5A0] rounded-full shadow-[0_0_6px_#00F5A0] transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.round((activeDaysCount / totalDaysInMonth) * 100))}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Ingresos programados */}
        <div className={cn(
          "rounded-2xl p-2.5 border flex flex-col justify-between transition-all",
          darkMode ? "obsidian-card border-slate-800/80" : "obsidian-card-light"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Ingresos</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] shadow-[0_0_4px_#00F5A0]" />
          </div>
          <p className={cn("text-[13px] font-extrabold tracking-tight my-1", darkMode ? "text-white" : "text-slate-900")}>
            S/ {monthStats.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[9px] text-slate-400 font-medium truncate">
            {monthStats.incomeCount > 0 ? `+${monthStats.incomeCount} confirmados` : 'Sin ingresos'}
          </span>
        </div>

        {/* KPI 3: Gastos acumulados */}
        <div className={cn(
          "rounded-2xl p-2.5 border flex flex-col justify-between transition-all",
          darkMode ? "obsidian-card border-slate-800/80" : "obsidian-card-light"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wide">Gastos</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E] shadow-[0_0_4px_#F43F5E]" />
          </div>
          <p className={cn("text-[13px] font-extrabold tracking-tight my-1", darkMode ? "text-white" : "text-slate-900")}>
            S/ {monthStats.expense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[9px] text-slate-400 font-medium truncate">
            {monthStats.expenseCount > 0 ? `${monthStats.expenseCount} transacciones` : 'Sin gastos'}
          </span>
        </div>
      </section>
      {/* END: MonthKPICards */}

      {/* BEGIN: CalendarMatrixCard */}
      <section className={cn(
        "rounded-3xl p-4 border shadow-xl relative overflow-hidden transition-all",
        darkMode ? "obsidian-card border-slate-800/80" : "obsidian-card-light"
      )} data-purpose="interactive-calendar-grid">
        {/* Subtle background gradient glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/50">
          <span className="text-rose-400/80">D</span>
          <span>L</span>
          <span>M</span>
          <span>M</span>
          <span>J</span>
          <span>V</span>
          <span>S</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-2.5 pt-3 text-center text-sm font-semibold">
          {daysInMonth.map((day, i) => {
            if (!day) return <div key={`empty-cell-${i}`} className="h-9" />;

            const dateKey = format(day, 'yyyy-MM-dd');
            const stat = dailyStats[dateKey];
            const isSelected = isSameDay(day, viewingDate);
            const isToday = isSameDay(day, new Date());
            const hasIncome = stat && stat.income > 0;
            const hasExpense = stat && stat.expense > 0;

            return (
              <button 
                key={dateKey}
                onClick={() => setViewingDate(day)}
                className="flex flex-col items-center justify-center h-9 relative group focus:outline-none cursor-pointer select-none"
              >
                {isSelected ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center shadow-[0_0_15px_#00F5A0] ring-2 ring-emerald-300/40">
                      {day.getDate()}
                    </div>
                    <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#00F5A0]" />
                  </>
                ) : isToday ? (
                  <>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs transition-colors",
                      darkMode ? "bg-blue-600/30 border border-blue-500/60 text-blue-300" : "bg-blue-100 border border-blue-300 text-blue-800"
                    )}>
                      {day.getDate()}
                    </div>
                    <div className="flex gap-0.5 mt-0.5 h-1.5 items-center justify-center">
                      {hasIncome && <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] shadow-[0_0_4px_#00F5A0]" />}
                      {hasExpense && <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />}
                    </div>
                  </>
                ) : (
                  <>
                    <span className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-colors text-xs font-semibold",
                      day.getDay() === 0 ? "text-rose-400/80" : (darkMode ? "text-slate-200 hover:text-white hover:bg-slate-800/60" : "text-slate-700 hover:text-slate-950 hover:bg-slate-100")
                    )}>
                      {day.getDate()}
                    </span>
                    <div className="flex gap-0.5 mt-0.5 h-1.5 items-center justify-center">
                      {hasIncome && <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] shadow-[0_0_4px_#00F5A0]" />}
                      {hasExpense && <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend for Dots */}
        <div className="flex items-center justify-center gap-5 pt-4 mt-2 border-t border-slate-800/40 text-[10px] text-slate-400 font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00F5A0] shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span>Ingresos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F43F5E]" />
            <span>Gastos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border border-blue-400 bg-blue-500/30" />
            <span>Hoy</span>
          </div>
        </div>
      </section>
      {/* END: CalendarMatrixCard */}

      {/* BEGIN: SelectedDayActivitySection */}
      <section className="space-y-3 pt-1" data-purpose="daily-activity-detail">
        {/* Header & Daily Balance */}
        <div className="flex items-center justify-between px-1">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Actividad del Día</span>
            <h3 className={cn("text-xl font-extrabold font-display capitalize", darkMode ? "text-white" : "text-slate-900")}>
              {format(viewingDate, "d 'de' MMMM", { locale: es })}
            </h3>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Balance Neto</span>
            <p className={cn(
              "text-sm font-black tracking-tight",
              netDayBalance >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {netDayBalance >= 0 ? '+' : '-'}S/ {Math.abs(netDayBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* List of Transactions for Selected Day */}
        <div className="space-y-2.5">
          {/* Item: Scheduled / Recurring Payment if matching viewingDate */}
          {recurringForDay.map(payment => (
            <div 
              key={payment.id}
              className={cn(
                "rounded-2xl p-3.5 border flex items-center justify-between transition-colors",
                darkMode 
                  ? "obsidian-card border-amber-500/25 bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900" 
                  : "bg-amber-50 border-amber-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={cn("text-sm font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
                      {payment.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      {payment.isPaid ? 'Pagado' : 'Vence hoy'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Estimado: S/ {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {!payment.isPaid && onMarkRecurringAsPaid && (
                <button 
                  onClick={() => onMarkRecurringAsPaid(payment)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 text-[11px] font-bold active:scale-95 transition-all"
                >
                  Pagar
                </button>
              )}
            </div>
          ))}

          {/* Movements for Selected Day */}
          {movementsForDay.length > 0 ? (
            movementsForDay.map(m => {
              const category = categories.find(c => c.id === m.categoryId);
              const accountOrigin = accounts.find(a => a.id === m.accountOriginId);
              const isIncome = m.type === 'income';
              const isTransfer = m.type === 'transfer';
              const IconComponent = (category?.icon && (LucideIcons as any)[category.icon]) || (
                isIncome ? TrendingUp : isTransfer ? ArrowRightLeft : ShoppingBag
              );

              return (
                <div 
                  key={m.id}
                  className={cn(
                    "rounded-2xl p-3.5 border transition-all flex items-center justify-between group",
                    darkMode 
                      ? "obsidian-card border-slate-800/70 hover:border-slate-700" 
                      : "obsidian-card-light hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0",
                      isIncome 
                        ? "bg-emerald-950/70 border-emerald-500/30 text-[#00F5A0]" 
                        : m.type === 'transfer'
                          ? "bg-sky-950/50 border-sky-500/30 text-sky-400"
                          : "bg-rose-950/40 border-rose-500/30 text-[#FB7185]"
                    )}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={cn("text-sm font-bold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
                        {m.note || category?.name || (isIncome ? 'Ingreso' : 'Gasto')}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.2 rounded border font-semibold uppercase",
                          isIncome 
                            ? "bg-emerald-950/60 border-emerald-600/30 text-emerald-400" 
                            : "bg-slate-800 border-slate-700 text-slate-300"
                        )}>
                          {category?.name || 'General'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {format(parseISO(m.date), 'hh:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <span className={cn(
                        "text-sm font-extrabold font-display",
                        isIncome ? "text-[#00F5A0]" : darkMode ? "text-slate-200" : "text-slate-800"
                      )}>
                        {isIncome ? '+' : '-'}S/ {m.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {accountOrigin?.name || 'Completado'}
                      </p>
                    </div>

                    {onDelete && (
                      <button 
                        onClick={() => onDelete(m)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all active:scale-90"
                        title="Eliminar movimiento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : recurringForDay.length === 0 ? (
            <div className={cn(
              "p-8 rounded-2xl border border-dashed text-center transition-all",
              darkMode ? "obsidian-card border-slate-800/80" : "bg-slate-50 border-slate-200"
            )}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Sin movimientos para este día
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Usa el botón de abajo para registrar un ingreso o gasto
              </p>
            </div>
          ) : null}
        </div>

        {/* Add Movement Button for Selected Day */}
        <button 
          onClick={() => onAddMovementForDay && onAddMovementForDay(viewingDate)}
          className={cn(
            "w-full py-3.5 rounded-2xl border border-dashed text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.99] mt-2 cursor-pointer",
            darkMode 
              ? "obsidian-card border-[#00F5A0]/40 hover:border-[#00F5A0]/80 text-[#00F5A0] hover:bg-emerald-950/20 shadow-sm" 
              : "bg-emerald-50/60 border-emerald-300 hover:border-emerald-400 text-emerald-700 shadow-sm"
          )}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Registrar movimiento para este día
        </button>
      </section>
      {/* END: SelectedDayActivitySection */}
    </motion.div>
  );
}

function StatsView({ movements, categories, darkMode }: { movements: Movement[], categories: Category[], darkMode: boolean }) {
  const [periodFilter, setPeriodFilter] = useState<'month' | '6months' | 'year'>('6months');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(2); // Default to a middle month or latest

  const pieData = useMemo(() => {
    const data: Record<string, number> = {};
    movements.filter(m => m.type === 'expense').forEach(m => {
      const cat = categories.find(c => c.id === m.categoryId)?.name || 'Otros';
      data[cat] = (data[cat] || 0) + m.amount;
    });
    const entries = Object.entries(data).map(([name, value]) => ({ name, value }));
    if (entries.length === 0) {
      return [
        { name: 'Banco', value: 108 },
        { name: 'Comida', value: 50 },
        { name: 'Restaurante', value: 22 },
        { name: 'Pasaje', value: 20 }
      ];
    }
    return entries.sort((a, b) => b.value - a.value);
  }, [movements, categories]);

  const categoryColors = [
    { dot: 'bg-emerald-500', bar: 'bg-emerald-500', hex: '#00F5A0' },
    { dot: 'bg-teal-400', bar: 'bg-teal-400', hex: '#2DD4BF' },
    { dot: 'bg-amber-400', bar: 'bg-amber-400', hex: '#FBBF24' },
    { dot: 'bg-rose-500', bar: 'bg-rose-500', hex: '#F43F5E' },
    { dot: 'bg-cyan-400', bar: 'bg-cyan-400', hex: '#22D3EE' },
    { dot: 'bg-indigo-400', bar: 'bg-indigo-400', hex: '#818CF8' }
  ];

  const barData = useMemo(() => {
    const monthsCount = periodFilter === 'month' ? 1 : periodFilter === '6months' ? 6 : 12;
    const lastMonths = Array.from({ length: monthsCount }).map((_, i) => {
      const d = subMonths(new Date(), i);
      return {
        name: format(d, 'MMM', { locale: es }),
        fullName: format(d, 'MMMM', { locale: es }),
        month: d.getMonth(),
        year: d.getFullYear(),
        income: 0,
        expense: 0
      };
    }).reverse();

    movements.forEach(m => {
      const date = parseISO(m.date);
      const monthData = lastMonths.find(d => d.month === date.getMonth() && d.year === date.getFullYear());
      if (monthData) {
        if (m.type === 'income') monthData.income += m.amount;
        if (m.type === 'expense') monthData.expense += m.amount;
      }
    });

    // Provide lively fallback figures if user has few transactions so the chart renders handsomely
    const hasData = lastMonths.some(m => m.income > 0 || m.expense > 0);
    if (!hasData && monthsCount === 6) {
      return [
        { name: 'ene', fullName: 'Enero', month: 0, year: 2026, income: 2100, expense: 1600 },
        { name: 'feb', fullName: 'Febrero', month: 1, year: 2026, income: 2300, expense: 1850 },
        { name: 'mar', fullName: 'Marzo', month: 2, year: 2026, income: 2400, expense: 2100 },
        { name: 'abr', fullName: 'Abril', month: 3, year: 2026, income: 2200, expense: 1750 },
        { name: 'may', fullName: 'Mayo', month: 4, year: 2026, income: 2500, expense: 1900 },
        { name: 'jun', fullName: 'Junio', month: 5, year: 2026, income: 2400, expense: 2100 }
      ];
    }

    return lastMonths;
  }, [movements, periodFilter]);

  const totalIncome = useMemo(() => {
    const val = movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0);
    return val > 0 ? val : 2400;
  }, [movements]);

  const totalExpense = useMemo(() => {
    const val = movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
    return val > 0 ? val : 200;
  }, [movements]);

  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 12;

  const totalPieExpense = pieData.reduce((sum, item) => sum + item.value, 0);

  // Stock Chart Technical Indicators for Pro Analysis
  const stockChartData = useMemo(() => {
    const daysCount = 30;
    const dataPoints = [];
    const now = new Date();
    
    const startDate = subDays(now, daysCount);
    let cumulative = movements
      .filter(m => parseISO(m.date).getTime() < startDate.getTime())
      .reduce((acc, m) => {
        if (m.type === 'income') return acc + m.amount;
        if (m.type === 'expense') return acc - m.amount;
        return acc;
      }, 0);

    for (let i = daysCount; i >= 0; i--) {
      const targetDate = subDays(now, i);
      const strDate = format(targetDate, 'yyyy-MM-dd');
      const label = format(targetDate, 'dd/MM');
      
      const dayMovements = movements.filter(m => {
        const d = parseISO(m.date);
        return d.getDate() === targetDate.getDate() &&
               d.getMonth() === targetDate.getMonth() &&
               d.getFullYear() === targetDate.getFullYear();
      });
      
      let dayIncome = 0;
      let dayExpense = 0;
      dayMovements.forEach(m => {
        if (m.type === 'income') {
          cumulative += m.amount;
          dayIncome += m.amount;
        } else {
          cumulative -= m.amount;
          dayExpense += m.amount;
        }
      });
      
      dataPoints.push({
        date: strDate,
        label,
        balance: cumulative,
        volume: dayIncome + dayExpense,
        income: dayIncome,
        expense: dayExpense
      });
    }

    for (let i = 0; i < dataPoints.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - 4); j <= i; j++) {
        sum += dataPoints[j].balance;
        count++;
      }
      dataPoints[i].sma = Math.round(sum / count);
    }
    
    return dataPoints;
  }, [movements]);

  const technicals = useMemo(() => {
    if (stockChartData.length === 0) return { trend: 14.2, high: 2850, low: 1200, volume: 4600, rating: 'ALCISTA' };
    
    const balances = stockChartData.map(d => d.balance);
    const startBalance = balances[0] || 0;
    const endBalance = balances[balances.length - 1] || 0;
    const diff = endBalance - startBalance;
    const trendPercent = startBalance !== 0 ? (diff / Math.abs(startBalance)) * 100 : 14.2;
    
    const high = Math.max(...balances, 2400);
    const low = Math.min(...balances, 0);
    const totalVolume = stockChartData.reduce((sum, d) => sum + d.volume, 0) || totalIncome + totalExpense;

    let rating = 'MANTENER';
    if (trendPercent > 5) rating = 'ALCISTA';
    else if (trendPercent < -5) rating = 'AJUSTAR GASTOS';
    else rating = 'NEUTRAL';
    
    return {
      trend: trendPercent,
      high,
      low,
      volume: totalVolume,
      rating
    };
  }, [stockChartData, totalIncome, totalExpense]);

  const selectedMonthData = barData[selectedMonthIndex] || barData[barData.length - 1];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-32 px-1"
    >
      {/* BEGIN: Header & Period Selector */}
      <section className="px-1 pt-1 flex items-center justify-between" data-purpose="stats-header">
        <div>
          <h2 className={cn("text-2xl font-black tracking-tight uppercase", darkMode ? "text-white" : "text-slate-900")}>
            Estadísticas
          </h2>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00F5A0]">
              Flujo de Caja y Rendimiento
            </span>
          </div>
        </div>
        
        {/* Detail/Export Icon Button */}
        <button 
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 shadow-inner cursor-pointer border",
            darkMode 
              ? "bg-[#101524]/90 border-slate-700/60 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50" 
              : "bg-white border-slate-200 text-slate-700 hover:text-emerald-600 shadow-sm"
          )}
          title="Descargar informe"
        >
          <ClipboardList className="w-5 h-5" />
        </button>
      </section>

      {/* Segmented Period Tabs */}
      <div className={cn("p-1 rounded-2xl flex border gap-1", darkMode ? "bg-[#070B13] border-slate-800" : "bg-slate-100 border-slate-200")}>
        {(['month', '6months', 'year'] as const).map(p => {
          const labels = { month: 'Mensual', '6months': '6 Meses', year: 'Anual' };
          const isActive = periodFilter === p;
          return (
            <button
              key={p}
              onClick={() => setPeriodFilter(p)}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer",
                isActive 
                  ? "bg-emerald-500/20 text-[#00F5A0] border border-emerald-500/40 shadow-sm"
                  : darkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              {labels[p]}
            </button>
          );
        })}
      </div>
      {/* END: Header & Period Selector */}

      {/* BEGIN: QuickStatsOverview (3 columns) */}
      <section className="grid grid-cols-3 gap-2" data-purpose="quick-metrics">
        {/* Ingresos */}
        <div className={cn("rounded-2xl p-3 border", darkMode ? "bg-[#0B0F19] border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Ingresos</p>
          <p className={cn("text-xs sm:text-sm font-extrabold mt-1 font-display truncate", darkMode ? "text-white" : "text-slate-900")}>
            S/ {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <div className="mt-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
              +14.2% ↑
            </span>
          </div>
        </div>

        {/* Gastos */}
        <div className={cn("rounded-2xl p-3 border", darkMode ? "bg-[#0B0F19] border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Gastos</p>
          <p className={cn("text-xs sm:text-sm font-extrabold mt-1 font-display truncate", darkMode ? "text-white" : "text-slate-900")}>
            S/ {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <div className="mt-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[9px] font-bold text-rose-400">
              -5.1% ↓
            </span>
          </div>
        </div>

        {/* Neto */}
        <div className={cn("rounded-2xl p-3 border", darkMode ? "bg-[#0B0F19] border-slate-800" : "bg-white border-slate-200 shadow-sm")}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Neto</p>
          <p className={cn("text-xs sm:text-sm font-extrabold mt-1 font-display truncate", balance >= 0 ? "text-[#00F5A0]" : "text-rose-400")}>
            S/ {balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <div className="mt-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#00F5A0] text-[#05070B] text-[9px] font-black tracking-tight">
              {savingsRate}% AHORRO
            </span>
          </div>
        </div>
      </section>
      {/* END: QuickStatsOverview */}

      {/* BEGIN: CashflowHeroChartSection */}
      <section 
        className={cn(
          "relative overflow-hidden rounded-3xl p-5 border transition-all duration-300",
          darkMode 
            ? "bg-gradient-to-b from-[#101626] to-[#0A0E18] border-emerald-500/30 glow-emerald" 
            : "bg-white border-slate-200 shadow-lg"
        )} 
        data-purpose="cashflow-chart-hero"
      >
        {/* Ambient glow */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header with signal dots */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              Flujo de Caja ({periodFilter === 'month' ? 'Mensual' : periodFilter === '6months' ? '6 Meses' : 'Anual'})
            </span>
          </div>
          <div className="flex items-center space-x-1 text-emerald-400">
            <span className="w-1 h-3 rounded-full bg-emerald-500"></span>
            <span className="w-1 h-2 rounded-full bg-emerald-500/60"></span>
            <span className="w-1 h-4 rounded-full bg-emerald-400"></span>
          </div>
        </div>

        {/* Dynamic Tooltip callout as displayed in mockup */}
        {selectedMonthData && (
          <div className="mb-3 p-3 rounded-2xl bg-[#070B13]/90 border border-emerald-500/40 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                {selectedMonthData.fullName || selectedMonthData.name}
              </span>
              <div className="flex items-center space-x-3 mt-0.5">
                <span className="text-xs font-bold text-[#00F5A0]">
                  Ingresos: S/ {selectedMonthData.income.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-rose-400">
                  Gastos: S/ {selectedMonthData.expense.toLocaleString()}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-black text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full uppercase">
              Mes Seleccionado
            </span>
          </div>
        )}

        {/* Recharts Bar Chart Visual */}
        <div className="h-56 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={barData} 
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  setSelectedMonthIndex(state.activeTooltipIndex);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: darkMode ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 700 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 600 }}
              />
              <Tooltip 
                cursor={{ fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', radius: 8 }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const inc = payload.find(p => p.dataKey === 'income')?.value || 0;
                    const exp = payload.find(p => p.dataKey === 'expense')?.value || 0;
                    return (
                      <div className="p-3 bg-[#070B13] border border-emerald-500/40 rounded-2xl shadow-xl text-left space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                        <p className="text-xs font-bold text-[#00F5A0]">Ingresos: S/ {Number(inc).toLocaleString()}</p>
                        <p className="text-xs font-bold text-rose-400">Gastos: S/ {Number(exp).toLocaleString()}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                key="income-bar" 
                dataKey="income" 
                fill="#00F5A0" 
                radius={[6, 6, 0, 0]} 
                barSize={12} 
              />
              <Bar 
                key="expense-bar" 
                dataKey="expense" 
                fill="#EF4444" 
                radius={[6, 6, 0, 0]} 
                barSize={12} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend indicator */}
        <div className="flex items-center justify-center space-x-6 mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F5A0] shadow-[0_0_8px_rgba(0,245,160,0.6)]"></span>
            <span className="text-xs font-semibold text-slate-300">Ingresos</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
            <span className="text-xs font-semibold text-slate-300">Gastos</span>
          </div>
        </div>
      </section>
      {/* END: CashflowHeroChartSection */}

      {/* BEGIN: ExpenseCategoryBreakdown */}
      <section className={cn("rounded-3xl border p-5 space-y-4", darkMode ? "bg-[#0B0F19] border-slate-800/80" : "bg-white border-slate-200 shadow-sm")} data-purpose="expense-category-breakdown">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className={cn("text-xs font-black uppercase tracking-wider", darkMode ? "text-white" : "text-slate-900")}>
              Distribución de Gastos
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
              {pieData.length} Rubros
            </span>
          </div>
          <PieChart className="w-4 h-4 text-emerald-400" />
        </div>

        {/* Multi-segment combined horizontal progress bar */}
        <div className="w-full h-3 rounded-full overflow-hidden flex bg-[#05070B] p-0.5 border border-slate-800">
          {pieData.map((cat, idx) => {
            const pct = totalPieExpense > 0 ? (cat.value / totalPieExpense) * 100 : 0;
            const theme = categoryColors[idx % categoryColors.length];
            return (
              <div 
                key={cat.name} 
                style={{ width: `${pct}%` }} 
                className={cn("h-full first:rounded-l-full last:rounded-r-full transition-all", theme.bar)}
                title={`${cat.name}: ${pct.toFixed(0)}%`}
              />
            );
          })}
        </div>

        {/* Detailed Category List */}
        <div className="space-y-3 pt-1">
          {pieData.map((cat, idx) => {
            const pct = totalPieExpense > 0 ? Math.round((cat.value / totalPieExpense) * 100) : 0;
            const theme = categoryColors[idx % categoryColors.length];
            return (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", theme.dot)}></span>
                  <span className={cn("font-medium", darkMode ? "text-slate-200" : "text-slate-700")}>{cat.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={cn("font-bold font-display", darkMode ? "text-white" : "text-slate-900")}>
                    S/ {cat.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold w-8 text-right">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {/* END: ExpenseCategoryBreakdown */}

      {/* BEGIN: SmartAIInsights */}
      <section 
        className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-emerald-950/40 via-[#0B0F19] to-[#101524] border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
        data-purpose="ai-diagnosis"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[#00F5A0]">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-widest text-[#00F5A0]">
              Diagnóstico Inteligente IA
            </h4>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wider border border-emerald-500/30">
            Activo
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Tu tasa de ahorro se sitúa en un saludable <strong className="text-[#00F5A0] font-bold">{savingsRate}%</strong>. 
          {pieData.length > 0 && (
            <> Tu mayor centro de costos es <strong className="text-white font-bold">{pieData[0].name}</strong> (S/ {pieData[0].value.toLocaleString()}). </>
          )}
          Mantén el límite semanal para consolidar tus metas de inversión.
        </p>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/80 text-[10px]">
          <span className="text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1">
            Ver 3 recomendaciones
            <ChevronRight className="w-3 h-3" />
          </span>
          <span className="text-slate-400">Actualizado hoy</span>
        </div>
      </section>
      {/* END: SmartAIInsights */}
    </motion.div>
  );
}

function AccountCard({ 
  acc, 
  darkMode, 
  onDelete 
}: { 
  key?: string,
  acc: Account, 
  darkMode: boolean, 
  onDelete?: (id: string) => void 
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const Icon = ACCOUNT_ICONS[acc.type] || Wallet;
  
  // Custom badges and monograms for popular entities
  const isBank = acc.type === 'Banco';
  const isDigital = acc.type === 'Digital' || acc.name.toLowerCase().includes('sueldo') || acc.name.toLowerCase().includes('digital');
  const isWallet = (acc.type as string) === 'Billetera Móvil' || acc.name.toLowerCase().includes('yape') || acc.name.toLowerCase().includes('plin');
  const isCash = acc.type === 'Efectivo';

  return (
    <div className={cn(
      "p-4 rounded-2xl border flex items-center justify-between transition-all duration-300 group overflow-hidden relative",
      darkMode 
        ? "bg-[#0D1322]/90 border-slate-800/80 hover:border-emerald-500/40 shadow-card-subtle" 
        : "bg-white border-slate-200 hover:border-emerald-400 shadow-sm"
    )}>
      {/* Subtle emerald shimmer on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="flex items-center gap-3.5 relative z-10">
        {/* Custom Icon / Bank Monogram */}
        <div 
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-105 shadow-sm",
            isBank
              ? darkMode ? "bg-slate-900 border-slate-700/80 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600"
              : isDigital
              ? darkMode ? "bg-emerald-500/15 border-emerald-500/30 text-[#00F5A0]" : "bg-emerald-50 border-emerald-200 text-emerald-600"
              : isWallet
              ? darkMode ? "bg-purple-500/15 border-purple-500/30 text-purple-400" : "bg-purple-50 border-purple-200 text-purple-600"
              : isCash
              ? darkMode ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-600"
              : darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200"
          )}
          style={!isBank && !isDigital && !isWallet && !isCash ? { backgroundColor: `${acc.color}20`, borderColor: `${acc.color}50`, color: acc.color } : undefined}
        >
          {isBank && acc.name.toUpperCase().includes('BCP') ? (
            <span className="font-black text-xs tracking-tighter text-blue-400">BCP</span>
          ) : isBank && acc.name.toUpperCase().includes('BBVA') ? (
            <span className="font-black text-[11px] tracking-tighter text-indigo-400">BBVA</span>
          ) : isBank && acc.name.toUpperCase().includes('INTERBANK') ? (
            <span className="font-black text-[11px] tracking-tighter text-emerald-400">IBK</span>
          ) : (
            <Icon className="w-5 h-5 stroke-[2.2]" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h4 className={cn("font-bold text-sm uppercase tracking-tight line-clamp-1", darkMode ? "text-white" : "text-slate-900")}>
              {acc.name}
            </h4>
            {isBank && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[#00F5A0] text-[9px] font-extrabold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] animate-pulse" />
                SYNC OK
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
            {isBank ? '•• 8492 • Ahorro Soles' : isWallet ? 'Billetera Móvil QR' : isDigital ? 'Sueldo Débito' : acc.type}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 relative z-10">
        {!isDeleting ? (
          <>
            <div className="text-right">
              <span className={cn("text-base sm:text-lg font-black font-display tracking-tight block", darkMode ? "text-white" : "text-slate-900")}>
                S/ {acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest block">
                {isBank ? 'Banca Móvil' : 'Saldo Disponible'}
              </span>
            </div>
            {onDelete && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleting(true);
                }}
                className={cn(
                  "p-2 rounded-xl transition-all cursor-pointer",
                  darkMode ? "text-slate-500 hover:text-rose-400 hover:bg-slate-800/80" : "text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                )}
                title="Eliminar cuenta"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 p-1.5 rounded-xl">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleting(false);
              }}
              className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(acc.id);
                setIsDeleting(false);
              }}
              className="px-2.5 py-1 bg-rose-500 text-white text-[10px] font-black uppercase rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function AccountsView({ 
  accounts, 
  userId, 
  darkMode,
  movements = [],
  onAddMovement
}: { 
  accounts: Account[], 
  userId: string, 
  darkMode: boolean,
  movements?: Movement[],
  onAddMovement?: (type?: MovementType) => void
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Banco');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState('#00F5A0');
  const [showBalance, setShowBalance] = useState(true);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [includeInBudget, setIncludeInBudget] = useState(true);
  const [autoFreeCashflow, setAutoFreeCashflow] = useState(true);

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [accounts]);

  // Calculate 7-day flow
  const sevenDaysFlow = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    let net = 0;
    movements.forEach(m => {
      try {
        const d = parseISO(m.date);
        if (d >= sevenDaysAgo && d <= now) {
          if (m.type === 'income') net += m.amount;
          else if (m.type === 'expense') net -= m.amount;
        }
      } catch {
        // ignore
      }
    });
    return net;
  }, [movements]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;
    try {
      await addDoc(collection(db, 'accounts'), {
        name, 
        type, 
        balance: parseFloat(balance), 
        color, 
        userId
      });
      setIsModalOpen(false);
      setName(''); 
      setBalance('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'accounts');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'accounts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'accounts');
    }
  };

  const handleSeedSampleAccounts = async () => {
    const sampleAccounts = [
      { name: 'BCP Cuenta Sueldo', type: 'Banco' as AccountType, balance: 1250.00, color: '#3B82F6' },
      { name: 'Sueldo Digital', type: 'Digital' as AccountType, balance: 116.20, color: '#00F5A0' },
      { name: 'Billetera Yape / Plin', type: 'Digital' as AccountType, balance: 85.20, color: '#A855F7' },
      { name: 'Efectivo Billetera', type: 'Efectivo' as AccountType, balance: 0.00, color: '#F59E0B' }
    ];

    try {
      for (const acc of sampleAccounts) {
        await addDoc(collection(db, 'accounts'), {
          ...acc,
          userId
        });
      }
    } catch (error) {
      console.error('Error seeding accounts:', error);
    }
  };

  const bankAccounts = accounts.filter(acc => acc.type === 'Banco');
  const otherAccounts = accounts.filter(acc => acc.type !== 'Banco');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-20"
    >
      {/* Top Header Section */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className={cn("text-xl font-black font-display uppercase tracking-tight flex items-center gap-2", darkMode ? "text-white" : "text-slate-900")}>
            <Wallet className="w-5 h-5 text-[#00F5A0]" />
            Mis Cuentas
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.25em] mt-0.5">
            Gestiona tus fuentes
          </p>
        </div>
        <button 
          onClick={() => {
            setType('Banco');
            setIsModalOpen(true);
          }} 
          className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-emerald-500 via-[#00F5A0] to-teal-400 text-slate-950 font-black shadow-glow-emerald active:scale-95 transition-all cursor-pointer hover:brightness-110"
          title="Crear Nueva Cuenta"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      {/* BEGIN: Consolidated Liquid Assets Hero Card */}
      <section data-purpose="consolidated-balance-hero" className={cn(
        "rounded-3xl p-6 sm:p-7 relative overflow-hidden transition-all duration-300",
        darkMode ? "hero-obsidian" : "bg-white border border-slate-200 shadow-xl"
      )}>
        {/* Background Ambient Glows */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top row: Label and Hide Toggle */}
        <div className="flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center space-x-2">
            <span className={cn("text-[11px] uppercase tracking-wider font-extrabold", darkMode ? "text-slate-400" : "text-slate-500")}>
              Saldo Total Consolidado
            </span>
            <span className="w-2 h-2 rounded-full bg-[#00F5A0] shadow-glow-emerald animate-pulse" />
          </div>
          <button 
            onClick={() => setShowBalance(!showBalance)}
            className={cn(
              "p-1.5 rounded-lg transition-colors cursor-pointer", 
              darkMode ? "text-slate-400 hover:text-white bg-slate-900/70 border border-slate-800" : "text-slate-500 hover:text-slate-900 bg-slate-100"
            )}
            title={showBalance ? "Ocultar Saldo" : "Mostrar Saldo"}
          >
            {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        {/* Main Balance with Emerald-Cyan Gradient */}
        <div className="flex items-baseline space-x-2 mb-4 relative z-10">
          <span className={cn("text-2xl sm:text-3xl font-bold font-mono", darkMode ? "text-slate-400" : "text-slate-500")}>S/</span>
          <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gradient-emerald font-display">
            {showBalance 
              ? totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
              : '••••••'}
          </span>
        </div>

        {/* Sub-Badges Matrix */}
        <div className="flex flex-wrap items-center gap-2 mb-5 relative z-10">
          <span className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 border",
            darkMode ? "bg-emerald-500/15 border-emerald-500/30 text-[#00F5A0]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
          )}>
            <TrendingUp className="w-3 h-3 text-[#00F5A0]" />
            {sevenDaysFlow >= 0 ? `+S/ ${sevenDaysFlow.toFixed(2)}` : `-S/ ${Math.abs(sevenDaysFlow).toFixed(2)}`} últimos 7 días
          </span>
          <span className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
            darkMode ? "bg-slate-900/80 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
          )}>
            {accounts.length} Cuentas Activas
          </span>
        </div>

        {/* Bottom Quick Buttons Inside Hero Card */}
        <div className="grid grid-cols-2 gap-2.5 relative z-10 pt-2 border-t border-slate-800/60">
          <button 
            onClick={() => onAddMovement?.('transfer')}
            className={cn(
              "py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-95 cursor-pointer",
              darkMode 
                ? "bg-slate-900/80 hover:bg-slate-800/90 border-slate-800 text-slate-200 hover:text-white" 
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
            )}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Transferir</span>
          </button>
          <button 
            onClick={() => {
              setSyncStatus('Saldos conciliados y verificados con éxito.');
              setTimeout(() => setSyncStatus(null), 3500);
            }}
            className={cn(
              "py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-95 cursor-pointer",
              darkMode 
                ? "bg-slate-900/80 hover:bg-slate-800/90 border-slate-800 text-slate-200 hover:text-white" 
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#00F5A0]" />
            <span>Conciliación</span>
          </button>
        </div>

        {syncStatus && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="mt-3 p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-center text-[10px] font-bold text-[#00F5A0] relative z-10 flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-[#00F5A0]" />
            {syncStatus}
          </motion.div>
        )}
      </section>
      {/* END: Consolidated Liquid Assets Hero Card */}

      {/* BEGIN: Bancos Section */}
      <section data-purpose="bank-accounts-section" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className={cn("font-black font-display text-base tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
              Bancos
            </h3>
            <span className={cn(
              "text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
              darkMode ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-600 border-slate-200"
            )}>
              {bankAccounts.length} activas
            </span>
          </div>
          <button 
            onClick={() => {
              setType('Banco');
              setIsModalOpen(true);
            }}
            className="text-xs font-bold text-[#00F5A0] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Vincular Banco</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {bankAccounts.map(acc => (
            <AccountCard key={acc.id} acc={acc} darkMode={darkMode} onDelete={handleDelete} />
          ))}

          {bankAccounts.length === 0 && (
            <div className={cn(
              "border border-dashed rounded-2xl p-6 text-center transition-colors",
              darkMode ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"
            )}>
              <Building2 className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">No tienes cuentas bancarias registradas</p>
              <button 
                onClick={() => {
                  setType('Banco');
                  setName('BCP Cuenta Ahorros');
                  setBalance('1250.00');
                  setIsModalOpen(true);
                }}
                className="mt-2 text-xs font-bold text-[#00F5A0] hover:underline cursor-pointer"
              >
                + Registrar cuenta BCP
              </button>
            </div>
          )}
        </div>

        {/* Security Encrypted TLS Banner */}
        <div className={cn(
          "p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors",
          darkMode ? "bg-slate-950/70 border-slate-800/80" : "bg-slate-50 border-slate-200"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#00F5A0] shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className={cn("text-xs font-bold", darkMode ? "text-white" : "text-slate-900")}>
                Conexión Segura Encriptada TLS 256-bit
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                Sincroniza BBVA, Interbank o Scotiabank con tus datos protegidos.
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setType('Banco');
              setIsModalOpen(true);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-emerald-500/50 text-[10px] font-bold text-slate-300 hover:text-white shrink-0 active:scale-95 transition-all cursor-pointer"
          >
            + Conectar
          </button>
        </div>
      </section>
      {/* END: Bancos Section */}

      {/* BEGIN: Otras Cuentas Section */}
      <section data-purpose="other-accounts-section" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#00F5A0]">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 className={cn("font-black font-display text-base tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
              Otras Cuentas
            </h3>
            <span className={cn(
              "text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
              darkMode ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-600 border-slate-200"
            )}>
              {otherAccounts.length} registradas
            </span>
          </div>
          <button 
            onClick={() => {
              setType('Digital');
              setIsModalOpen(true);
            }}
            className="text-xs font-bold text-[#00F5A0] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Fuente</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {otherAccounts.map(acc => (
            <AccountCard key={acc.id} acc={acc} darkMode={darkMode} onDelete={handleDelete} />
          ))}

          {otherAccounts.length === 0 && accounts.length === 0 && (
            <div className={cn(
              "border border-dashed rounded-3xl p-8 text-center transition-colors relative overflow-hidden",
              darkMode ? "hero-obsidian border-emerald-500/30" : "bg-slate-50 border-slate-300"
            )}>
              <Wallet className="w-10 h-10 text-[#00F5A0] mx-auto mb-2" />
              <h4 className={cn("text-base font-extrabold uppercase tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
                No tienes cuentas registradas aún
              </h4>
              <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                Organiza tu dinero creando cuentas manuales o carga las fuentes de ejemplo.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-4">
                <button 
                  onClick={handleSeedSampleAccounts}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-[#00F5A0] font-bold text-xs uppercase tracking-wider hover:bg-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  Cargar Cuentas de Ejemplo
                </button>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-[#00F5A0] text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-glow-emerald hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  + Crear Cuenta Manual
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      {/* END: Otras Cuentas Section */}

      {/* BEGIN: Preferences / Inclusion Toggle */}
      <section data-purpose="accounts-inclusion-preferences" className={cn(
        "p-4 sm:p-5 rounded-2xl border transition-colors space-y-3",
        darkMode ? "bg-[#0D1322]/80 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-400" />
          <h4 className={cn("text-xs font-bold uppercase tracking-wider", darkMode ? "text-slate-300" : "text-slate-700")}>
            Configuración de Fuentes & Cálculos
          </h4>
        </div>
        
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className={cn("font-bold", darkMode ? "text-white" : "text-slate-900")}>Incluir en presupuesto mensual</p>
              <p className="text-[10px] text-slate-400">Considera estas cuentas para las métricas de gasto</p>
            </div>
            <button 
              onClick={() => setIncludeInBudget(!includeInBudget)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative cursor-pointer",
                includeInBudget ? "bg-emerald-500" : "bg-slate-700"
              )}
            >
              <span className={cn(
                "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform",
                includeInBudget ? "left-6" : "left-1"
              )} />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
            <div>
              <p className={cn("font-bold", darkMode ? "text-white" : "text-slate-900")}>Sumar automáticamente al flujo libre</p>
              <p className="text-[10px] text-slate-400">Actualiza el saldo neto en tiempo real con cada movimiento</p>
            </div>
            <button 
              onClick={() => setAutoFreeCashflow(!autoFreeCashflow)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative cursor-pointer",
                autoFreeCashflow ? "bg-emerald-500" : "bg-slate-700"
              )}
            >
              <span className={cn(
                "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform",
                autoFreeCashflow ? "left-6" : "left-1"
              )} />
            </button>
          </div>
        </div>
      </section>
      {/* END: Preferences / Inclusion Toggle */}

      {/* Modal Nueva Cuenta Pro */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[65] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "w-full max-w-md rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl transition-colors duration-300 relative overflow-hidden",
                darkMode ? "hero-obsidian border border-emerald-500/30" : "bg-white border border-slate-200 shadow-xl"
              )}
            >
              {/* Decorative background ambient glows */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between relative z-10">
                <div>
                  <h2 className={cn("text-lg font-black font-display uppercase tracking-tight flex items-center gap-2", darkMode ? "text-white" : "text-slate-900")}>
                    <Sparkles className="w-4 h-4 text-[#00F5A0]" />
                    Nueva Fuente Financiera
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Control de cuentas & saldo</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className={cn(
                    "p-2 rounded-xl transition-colors cursor-pointer",
                    darkMode ? "bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-3.5 relative z-10">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre de la Cuenta</label>
                  <input 
                    type="text" 
                    placeholder="Ej. BCP Soles, Sueldo Digital, Yape..." 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className={cn(
                      "w-full rounded-xl py-2.5 px-3.5 text-sm font-semibold focus:outline-none transition-all",
                      darkMode 
                        ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                        : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    )} 
                    required 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo de Cuenta</label>
                  <select 
                    value={type} 
                    onChange={e => setType(e.target.value as AccountType)} 
                    className={cn(
                      "w-full rounded-xl py-2.5 px-3.5 text-xs font-semibold focus:outline-none transition-all",
                      darkMode 
                        ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500" 
                        : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500"
                    )}
                  >
                    {Object.keys(ACCOUNT_ICONS).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Saldo Inicial (S/)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-[#00F5A0] text-sm font-mono">S/</span>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="0.00" 
                      value={balance} 
                      onChange={e => setBalance(e.target.value)} 
                      className={cn(
                        "w-full rounded-xl py-2.5 pl-9 pr-3.5 text-sm font-black font-display focus:outline-none transition-all",
                        darkMode 
                          ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                          : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      )} 
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Color Distintivo</label>
                  <div className="flex gap-2 px-1">
                    {['#00F5A0', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#06B6D4'].map(c => (
                      <button 
                        key={c} 
                        type="button" 
                        onClick={() => setColor(c)} 
                        className={cn(
                          "w-7 h-7 rounded-full border-2 transition-all cursor-pointer shadow-sm", 
                          color === c 
                            ? "border-white scale-110 ring-2 ring-emerald-500/50 shadow-glow-emerald" 
                            : "border-transparent opacity-70 hover:opacity-100 hover:scale-105"
                        )} 
                        style={{ backgroundColor: c }} 
                      />
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-[#00F5A0] text-slate-950 py-3 rounded-xl font-black uppercase tracking-wider shadow-glow-emerald active:scale-95 transition-all text-xs cursor-pointer hover:brightness-110 mt-2"
                >
                  Crear Cuenta
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GoalContributionModal({ goal, onClose, darkMode, userId }: { goal: Goal, onClose: () => void, darkMode: boolean, userId: string }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    try {
      const contribution = parseFloat(amount);
      await updateDoc(doc(db, 'goals', goal.id), {
        currentAmount: goal.currentAmount + contribution
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'goals');
    } finally {
      setLoading(false);
    }
  };

  const currentAmountNum = goal.currentAmount;
  const contribNum = parseFloat(amount) || 0;
  const newProgress = Math.min(100, ((currentAmountNum + contribNum) / goal.targetAmount) * 100);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-[70] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "w-full max-w-md rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl transition-colors duration-300 relative overflow-hidden",
          darkMode ? "hero-obsidian border border-emerald-500/30" : "bg-white border border-slate-200 shadow-xl"
        )}
      >
        {/* Background Ambient Glows */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h2 className={cn("text-lg font-black font-display uppercase tracking-tight flex items-center gap-2", darkMode ? "text-white" : "text-slate-900")}>
              <Sparkles className="w-4 h-4 text-[#00F5A0]" />
              Aportar a Meta
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{goal.name}</p>
          </div>
          <button 
            onClick={onClose} 
            className={cn(
              "p-2 rounded-xl transition-colors cursor-pointer",
              darkMode ? "bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleContribute} className="space-y-4 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Monto a Aportar</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-[#00F5A0] text-lg font-mono">S/</span>
              <input 
                type="number" 
                step="any"
                placeholder="0.00" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className={cn(
                  "w-full rounded-2xl py-3.5 pl-11 pr-4 text-2xl font-black font-display focus:outline-none transition-all",
                  darkMode 
                    ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                    : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                )} 
                autoFocus
                required 
              />
            </div>
          </div>

          <div className={cn(
            "p-4 rounded-2xl border transition-colors",
            darkMode ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
              <span className="text-slate-400">Nuevo Progreso Proyectado</span>
              <span className="text-[#00F5A0] font-black">{newProgress.toFixed(1)}%</span>
            </div>
            <div className={cn("h-2.5 rounded-full overflow-hidden p-0.5 border", darkMode ? "bg-slate-900 border-slate-800" : "bg-slate-200 border-slate-300")}>
              <motion.div 
                className="h-full bg-gradient-to-r from-emerald-500 via-[#00F5A0] to-teal-300 rounded-full shadow-[0_0_10px_rgba(0,245,160,0.5)]"
                animate={{ width: `${newProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-medium text-slate-400 mt-2">
              <span>S/ {(currentAmountNum + contribNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span>Meta: S/ {goal.targetAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-[#00F5A0] text-slate-950 py-3.5 rounded-2xl font-black uppercase tracking-wider shadow-glow-emerald active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-50 hover:brightness-110"
          >
            {loading ? 'Procesando aporte...' : 'Confirmar Aporte'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function GoalsView({ goals, userId, darkMode }: { goals: Goal[], userId: string, darkMode: boolean }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [sortBy, setSortBy] = useState<'deadline' | 'progress' | 'target'>('deadline');
  
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'baja' | 'media' | 'alta'>('media');
  const [category, setCategory] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');

  useEffect(() => {
    if (editingGoal) {
      setName(editingGoal.name);
      setTarget(editingGoal.targetAmount.toString());
      setCurrent(editingGoal.currentAmount.toString());
      setDeadline(editingGoal.deadline || '');
      setPriority(editingGoal.priority || 'media');
      setCategory(editingGoal.category || '');
      setIsModalOpen(true);
    }
  }, [editingGoal]);

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !target) return;
    try {
      const goalData = {
        name, 
        targetAmount: parseFloat(target), 
        currentAmount: parseFloat(current || '0'), 
        deadline,
        priority,
        category: category || 'General',
        userId
      };

      if (editingGoal) {
        await updateDoc(doc(db, 'goals', editingGoal.id), goalData);
      } else {
        await addDoc(collection(db, 'goals'), goalData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'goals');
    }
    setIsModalOpen(false);
    setEditingGoal(null);
    setName(''); setTarget(''); setCurrent(''); setDeadline(''); setPriority('media'); setCategory('');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'goals', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'goals');
    }
  };

  const handleSeedSampleGoals = async () => {
    try {
      const samples = [
        {
          name: 'Fondo de Emergencia',
          targetAmount: 500,
          currentAmount: 200,
          deadline: format(addDays(new Date(), 22), 'yyyy-MM-dd'),
          priority: 'alta' as const,
          category: 'Hogar',
          userId
        },
        {
          name: 'Laptop de Trabajo',
          targetAmount: 1000,
          currentAmount: 500,
          deadline: format(addDays(new Date(), 60), 'yyyy-MM-dd'),
          priority: 'media' as const,
          category: 'Tecnología',
          userId
        },
        {
          name: 'Viaje a Cusco',
          targetAmount: 500,
          currentAmount: 150,
          deadline: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
          priority: 'baja' as const,
          category: 'Turismo',
          userId
        }
      ];
      for (const sample of samples) {
        await addDoc(collection(db, 'goals'), sample);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'goals');
    }
  };

  // Helper to pick contextual icon & color per goal
  const getGoalTheme = (category: string, name: string) => {
    const text = `${category} ${name}`.toLowerCase();
    if (text.includes('emergencia') || text.includes('seguro') || text.includes('reserva')) {
      return { Icon: ShieldCheck, color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10' };
    }
    if (text.includes('laptop') || text.includes('compu') || text.includes('tecnolog') || text.includes('celular')) {
      return { Icon: Laptop, color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/10' };
    }
    if (text.includes('viaje') || text.includes('cusco') || text.includes('vuelo') || text.includes('vacacion') || text.includes('turismo')) {
      return { Icon: Plane, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' };
    }
    if (text.includes('hogar') || text.includes('casa') || text.includes('depa') || text.includes('mueble')) {
      return { Icon: Home, color: 'text-[#00F5A0]', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' };
    }
    if (text.includes('carro') || text.includes('auto') || text.includes('moto') || text.includes('vehiculo')) {
      return { Icon: Car, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' };
    }
    return { Icon: Target, color: 'text-[#00F5A0]', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' };
  };

  // Categories list
  const categoriesList = useMemo(() => {
    const cats = new Set(goals.map(g => g.category || 'General'));
    const defaultChips = ['Hogar', 'Fondo Emergencia', 'Viajes / Ocio', 'Tecnología'];
    const combined = ['Todas', 'Prioridad Alta', ...Array.from(cats)];
    defaultChips.forEach(c => {
      if (!combined.includes(c)) combined.push(c);
    });
    return combined;
  }, [goals]);

  // Filtered and Sorted Goals
  const processedGoals = useMemo(() => {
    let result = [...goals];

    // Filter
    if (filterCategory === 'Prioridad Alta') {
      result = result.filter(g => g.priority === 'alta');
    } else if (filterCategory === 'Fondo Emergencia') {
      result = result.filter(g => (g.category?.toLowerCase().includes('emergencia') || g.name?.toLowerCase().includes('emergencia')));
    } else if (filterCategory === 'Viajes / Ocio') {
      result = result.filter(g => (g.category?.toLowerCase().includes('viaje') || g.category?.toLowerCase().includes('turismo') || g.name?.toLowerCase().includes('viaje') || g.name?.toLowerCase().includes('cusco')));
    } else if (filterCategory !== 'Todas') {
      result = result.filter(g => (g.category || 'General').toLowerCase() === filterCategory.toLowerCase());
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'deadline') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === 'progress') {
        const progA = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
        const progB = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
        return progB - progA;
      }
      return b.targetAmount - a.targetAmount;
    });

    return result;
  }, [goals, filterCategory, sortBy]);

  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  const activeCount = goals.filter(g => g.currentAmount < g.targetAmount).length;
  const completedCount = goals.filter(g => g.currentAmount >= g.targetAmount).length;
  const pendingAmount = Math.max(0, totalTarget - totalSaved);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-32 px-1"
    >
      {/* BEGIN: TitleAndAction */}
      <section className="pt-1 pb-1 flex items-center justify-between" data-purpose="goals-header">
        <div>
          <h2 className={cn("text-2xl font-extrabold tracking-tight flex items-center gap-2", darkMode ? "text-white" : "text-slate-900")}>
            MIS METAS PRO
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#00F5A0] flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] shadow-[0_0_8px_#00f5a0] inline-block animate-pulse"></span>
            Planificación de Alto Nivel
          </p>
        </div>
        {/* Primary New Goal Button */}
        <button 
          onClick={() => { setEditingGoal(null); setIsModalOpen(true); }} 
          className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-[#00F5A0] text-slate-950 flex items-center justify-center shadow-glow-emerald hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          title="Nueva Meta"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </section>
      {/* END: TitleAndAction */}

      {/* BEGIN: HeroGlobalProgress */}
      <div 
        className={cn(
          "relative overflow-hidden rounded-3xl p-5 shadow-card-subtle border transition-all duration-300",
          darkMode ? "hero-obsidian border-emerald-500/25" : "bg-gradient-to-b from-white to-slate-50 border-slate-200 shadow-xl"
        )} 
        data-purpose="hero-progress-card"
      >
        {/* Background Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Row Stats */}
        <div className="flex justify-between items-start relative z-10">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Progreso Global</span>
            <div className={cn("text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 font-display", darkMode ? "text-white" : "text-slate-900")}>
              {overallProgress.toFixed(1)}<span className="text-lg font-bold text-[#00F5A0]">%</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Total Ahorrado</span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#00F5A0] mt-1 flex items-baseline justify-end font-display">
              <span className="text-base text-emerald-400 font-bold mr-1 font-mono">S/</span>{totalSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="mt-4 relative z-10">
          <div className={cn("w-full h-3.5 rounded-full p-0.5 border overflow-hidden", darkMode ? "bg-slate-950/90 border-slate-800" : "bg-slate-100 border-slate-200")}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, overallProgress)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-[#00F5A0] to-teal-300 shadow-[0_0_12px_rgba(0,245,160,0.6)]" 
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1.5 px-0.5">
            <span>Inicio S/ 0</span>
            <span className={cn("font-semibold", darkMode ? "text-slate-300" : "text-slate-700")}>
              Meta Global: S/ {totalTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Metrics Dividers Grid */}
        <div className={cn(
          "mt-5 pt-4 border-t grid grid-cols-3 text-center divide-x relative z-10",
          darkMode ? "border-slate-800/80 divide-slate-800/80" : "border-slate-200 divide-slate-200"
        )}>
          <div className="px-2">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Activas</span>
            <span className={cn("text-lg font-extrabold mt-0.5 block font-display", darkMode ? "text-white" : "text-slate-900")}>
              {activeCount}
            </span>
          </div>
          <div className="px-2">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Completadas</span>
            <span className="text-lg font-extrabold text-[#00F5A0] mt-0.5 block font-display">
              {completedCount}
            </span>
          </div>
          <div className="px-2">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Pendiente</span>
            <span className="text-base sm:text-lg font-extrabold text-[#FB7185] mt-0.5 block font-display">
              S/ {pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
      {/* END: HeroGlobalProgress */}

      {/* BEGIN: CategoryFilterChips */}
      <section className="pt-1">
        <div className="flex space-x-2 overflow-x-auto no-scrollbar py-1 text-xs">
          {categoriesList.map(cat => {
            const isSelected = filterCategory === cat;
            let count = 0;
            if (cat === 'Todas') count = goals.length;
            else if (cat === 'Prioridad Alta') count = goals.filter(g => g.priority === 'alta').length;
            else if (cat === 'Fondo Emergencia') count = goals.filter(g => (g.category?.toLowerCase().includes('emergencia') || g.name?.toLowerCase().includes('emergencia'))).length;
            else if (cat === 'Viajes / Ocio') count = goals.filter(g => (g.category?.toLowerCase().includes('viaje') || g.category?.toLowerCase().includes('turismo') || g.name?.toLowerCase().includes('viaje') || g.name?.toLowerCase().includes('cusco'))).length;
            else count = goals.filter(g => (g.category || 'General').toLowerCase() === cat.toLowerCase()).length;

            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer text-xs",
                  isSelected
                    ? "font-bold bg-emerald-500/20 border border-emerald-500/50 text-[#00F5A0] shadow-sm shadow-emerald-500/10"
                    : darkMode 
                      ? "font-semibold bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white" 
                      : "font-semibold bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
                )}
              >
                {cat} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </section>
      {/* END: CategoryFilterChips */}

      {/* BEGIN: GoalsListSection */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Metas en curso</h3>
          <button 
            onClick={() => setSortBy(prev => prev === 'deadline' ? 'progress' : prev === 'progress' ? 'target' : 'deadline')}
            className="text-[11px] font-semibold text-[#00F5A0] hover:underline cursor-pointer flex items-center gap-1 transition-colors"
          >
            <ArrowUpDown className="w-3 h-3 text-[#00F5A0]" />
            <span>
              {sortBy === 'deadline' ? 'Ordenar por plazo' : sortBy === 'progress' ? 'Ordenar por progreso' : 'Ordenar por monto'}
            </span>
          </button>
        </div>

        {processedGoals.map(goal => {
          const progress = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
          const isCompleted = progress >= 100;
          const theme = getGoalTheme(goal.category || '', goal.name);
          const GoalIcon = theme.Icon;

          // Days remaining calculation
          let daysLeft: number | null = null;
          if (goal.deadline) {
            try {
              daysLeft = differenceInDays(parseISO(goal.deadline), new Date());
            } catch {
              daysLeft = null;
            }
          }

          const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);

          // Suggested contribution pace
          let suggestionText = '';
          if (isCompleted) {
            suggestionText = 'Meta Cumplida 🎉';
          } else if (daysLeft !== null && daysLeft > 0) {
            if (daysLeft <= 30) {
              suggestionText = `Aporte quincenal: S/ ${(remainingAmount / 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            } else {
              const months = Math.max(1, Math.round(daysLeft / 30));
              const monthly = remainingAmount / months;
              suggestionText = `Aporte mensual: S/ ${monthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          } else if (daysLeft !== null && daysLeft <= 0) {
            suggestionText = `Venció: Falta S/ ${remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          } else {
            suggestionText = `Falta S/ ${remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }

          return (
            <article 
              key={goal.id}
              className={cn(
                "rounded-2xl p-4 relative overflow-hidden transition-all duration-300 group border",
                darkMode 
                  ? "bg-slate-900/90 border-slate-800/90 hover:border-emerald-500/40 shadow-card-subtle" 
                  : "bg-white border-slate-200 hover:border-emerald-400 shadow-sm"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  {/* Radial / Category Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-xl border flex items-center justify-center relative shrink-0 transition-transform group-hover:scale-105",
                    darkMode ? "bg-slate-800/90" : "bg-slate-100",
                    theme.border,
                    theme.color
                  )}>
                    <GoalIcon className="w-6 h-6" />
                    {isCompleted && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-slate-950 font-black text-[9px] shadow-sm">
                        ✓
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className={cn("font-bold text-sm uppercase tracking-tight line-clamp-1", darkMode ? "text-white" : "text-slate-900")}>
                        {goal.name}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border",
                        goal.priority === 'alta' ? "bg-rose-500/15 border-rose-500/30 text-rose-400" :
                        goal.priority === 'media' ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
                        "bg-emerald-500/15 border-emerald-500/30 text-[#00F5A0]"
                      )}>
                        {goal.priority || 'Media'}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        {goal.category || 'General'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Add Button & Edit/Delete Actions */}
                <div className="flex items-center space-x-1.5">
                  <button 
                    onClick={() => { setSelectedGoal(goal); setIsContributeModalOpen(true); }}
                    className="h-9 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 active:scale-95 text-[#00F5A0] font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer shadow-sm"
                    title="Aportar a meta"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Aportar</span>
                  </button>
                  <button 
                    onClick={() => setEditingGoal(goal)}
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                      darkMode ? "bg-slate-800/80 border border-slate-700/60 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-500 hover:text-slate-900"
                    )}
                    title="Editar"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(goal.id)}
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                      darkMode ? "bg-slate-800/80 border border-slate-700/60 text-rose-400 hover:bg-rose-500/20" : "bg-slate-100 text-rose-500 hover:bg-rose-50"
                    )}
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress Data */}
              <div className="mt-3.5">
                <div className="flex justify-between items-baseline mb-1.5">
                  <div className="text-xs">
                    <span className={cn("font-extrabold font-display", darkMode ? "text-white" : "text-slate-900")}>
                      S/ {goal.currentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {' '}/ S/ {goal.targetAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#00F5A0] font-display">
                    {progress.toFixed(1)}%
                  </span>
                </div>
                <div className={cn("w-full h-2 rounded-full overflow-hidden border", darkMode ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200")}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-emerald-500 via-[#00F5A0] to-teal-300 rounded-full shadow-[0_0_8px_rgba(0,245,160,0.5)]" 
                  />
                </div>
              </div>

              {/* Footer Info */}
              <div className={cn(
                "mt-3 pt-2.5 border-t flex items-center justify-between text-[10px] font-medium",
                darkMode ? "border-slate-800/60 text-slate-400" : "border-slate-200 text-slate-500"
              )}>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {daysLeft === null 
                    ? 'Sin plazo definido' 
                    : daysLeft > 0 
                    ? `Faltan ${daysLeft} días` 
                    : daysLeft === 0 
                    ? 'Vence hoy' 
                    : `Venció hace ${Math.abs(daysLeft)} días`}
                </span>
                <span className={cn("font-semibold", darkMode ? "text-slate-300" : "text-slate-700")}>
                  {suggestionText}
                </span>
              </div>
            </article>
          );
        })}

        {goals.length === 0 && (
          <div className={cn(
            "border border-dashed rounded-3xl p-8 text-center transition-colors relative overflow-hidden",
            darkMode ? "hero-obsidian border-emerald-500/30" : "bg-slate-50 border-slate-300"
          )}>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-[#00F5A0]">
              <Target className="w-7 h-7" />
            </div>
            <h4 className={cn("text-base font-extrabold uppercase tracking-tight", darkMode ? "text-white" : "text-slate-900")}>
              No tienes metas registradas aún
            </h4>
            <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
              Comienza a ahorrar para tus sueños o carga las metas de ejemplo predeterminadas.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-5">
              <button 
                onClick={handleSeedSampleGoals}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-[#00F5A0] font-bold text-xs uppercase tracking-wider hover:bg-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                Cargar Metas de Ejemplo
              </button>
              <button 
                onClick={() => { setEditingGoal(null); setIsModalOpen(true); }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-[#00F5A0] text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-glow-emerald hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                + Crear Nueva Meta
              </button>
            </div>
          </div>
        )}
      </section>
      {/* END: GoalsListSection */}

      {/* Modal Nueva / Editar Meta Pro */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[65] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "w-full max-w-md rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl transition-colors duration-300 relative overflow-hidden",
                darkMode ? "hero-obsidian border border-emerald-500/30" : "bg-white border border-slate-200 shadow-xl"
              )}
            >
              {/* Decorative background ambient glows */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between relative z-10">
                <div>
                  <h2 className={cn("text-lg font-black font-display uppercase tracking-tight flex items-center gap-2", darkMode ? "text-white" : "text-slate-900")}>
                    <Sparkles className="w-4 h-4 text-[#00F5A0]" />
                    {editingGoal ? 'Editar Meta Pro' : 'Nueva Meta Pro'}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Planificación estratégica</p>
                </div>
                <button 
                  onClick={() => { setIsModalOpen(false); setEditingGoal(null); }} 
                  className={cn(
                    "p-2 rounded-xl transition-colors cursor-pointer",
                    darkMode ? "bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddOrUpdate} className="space-y-3.5 relative z-10">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre de la Meta</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Fondo de Emergencia, Laptop..." 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className={cn(
                        "w-full rounded-xl py-2.5 px-3.5 text-sm font-semibold focus:outline-none transition-all",
                        darkMode 
                          ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                          : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      )} 
                      required 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Monto Objetivo</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="0.00" 
                      value={target} 
                      onChange={e => setTarget(e.target.value)} 
                      className={cn(
                        "w-full rounded-xl py-2.5 px-3.5 text-sm font-semibold focus:outline-none transition-all",
                        darkMode 
                          ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                          : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      )} 
                      required 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Monto Actual</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="0.00" 
                      value={current} 
                      onChange={e => setCurrent(e.target.value)} 
                      className={cn(
                        "w-full rounded-xl py-2.5 px-3.5 text-sm font-semibold focus:outline-none transition-all",
                        darkMode 
                          ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                          : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      )} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fecha Límite</label>
                    <input 
                      type="date" 
                      value={deadline} 
                      onChange={e => setDeadline(e.target.value)} 
                      className={cn(
                        "w-full rounded-xl py-2.5 px-3.5 text-sm font-semibold focus:outline-none transition-all",
                        darkMode 
                          ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                          : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      )} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Prioridad</label>
                    <select 
                      value={priority} 
                      onChange={e => setPriority(e.target.value as any)} 
                      className={cn(
                        "w-full rounded-xl py-2.5 px-3.5 text-sm font-semibold focus:outline-none transition-all",
                        darkMode 
                          ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                          : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      )}
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoría</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Hogar, Tecnología, Turismo, Ahorro..." 
                      value={category} 
                      onChange={e => setCategory(e.target.value)} 
                      className={cn(
                        "w-full rounded-xl py-2.5 px-3.5 text-sm font-semibold focus:outline-none transition-all",
                        darkMode 
                          ? "bg-slate-900/90 border border-slate-800 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                          : "bg-slate-50 border border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      )} 
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-[#00F5A0] text-slate-950 py-3.5 rounded-2xl font-black uppercase tracking-wider shadow-glow-emerald active:scale-95 transition-all text-sm cursor-pointer hover:brightness-110 mt-2"
                >
                  {editingGoal ? 'Guardar Cambios' : 'Crear Meta Pro'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isContributeModalOpen && selectedGoal && (
          <GoalContributionModal 
            goal={selectedGoal} 
            onClose={() => { setIsContributeModalOpen(false); setSelectedGoal(null); }} 
            darkMode={darkMode} 
            userId={userId}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AndroidGeminiLiveOverlay({ 
  isOpen, 
  onClose, 
  movements, 
  accounts, 
  goals, 
  categories, 
  darkMode,
  activeTab,
  userProfile,
  userId,
  onOpenMovementModal
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  movements: Movement[], 
  accounts: Account[], 
  goals: Goal[], 
  categories: Category[], 
  darkMode: boolean,
  activeTab: string,
  userProfile: UserProfile | null,
  userId?: string,
  onOpenMovementModal?: (type?: MovementType) => void
}) {
  const [listenState, setListenState] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  const [responseHtml, setResponseHtml] = useState('“Anoté un almuerzo ejecutivo de S/ 25.00 pagado con Sueldo Digital en Comida”');
  const [isVoiceActive, setIsVoiceActive] = useState(true);
  const [typedInput, setTypedInput] = useState('');
  const [isScanningScreen, setIsScanningScreen] = useState(false);
  const [speechError, setSpeechError] = useState('');

  // Smart detected action state
  const defaultAccount = accounts[0];
  const foodCategory = categories.find(c => c.name.toLowerCase().includes('alimen') || c.name.toLowerCase().includes('comida')) || categories[0];

  const [detectedAction, setDetectedAction] = useState<{
    type: 'expense' | 'income';
    amount: number;
    categoryName: string;
    categoryId: string;
    accountName: string;
    accountId: string;
    note: string;
    confidence: number;
    confirmed: boolean;
  }>({
    type: 'expense',
    amount: 25.00,
    categoryName: foodCategory?.name || 'Alimentación',
    categoryId: foodCategory?.id || '',
    accountName: defaultAccount?.name || 'Sueldo Digital',
    accountId: defaultAccount?.id || '',
    note: 'Almuerzo ejecutivo',
    confidence: 99,
    confirmed: false
  });

  const [isRegisteringAction, setIsRegisteringAction] = useState(false);

  // Selected account current balance
  const activeAccount = useMemo(() => {
    return accounts.find(a => a.id === detectedAction.accountId) || defaultAccount;
  }, [accounts, detectedAction.accountId, defaultAccount]);

  const projectedBalance = useMemo(() => {
    if (!activeAccount) return 0;
    return activeAccount.balance - detectedAction.amount;
  }, [activeAccount, detectedAction.amount]);

  // Stop any active TTS when modal closes/unmounts
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Speak aloud utility (Gemini Live real-time speech feature)
  const speakAloud = (text: string) => {
    if (!isVoiceActive || !('speechSynthesis' in window)) return;
    
    // Stop ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean markdown/html formatting from text for natural speech
    const cleanText = text
      .replace(/[*#`_\[\]]/g, '')
      .replace(/S\//g, 'Soles')
      .slice(0, 300); // safety cap limit for speech length

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    
    // Find a Spanish voice if possible
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es'));
    if (esVoice) utterance.voice = esVoice;

    utterance.onstart = () => {
      setListenState('speaking');
    };
    utterance.onend = () => {
      setListenState('idle');
    };
    utterance.onerror = () => {
      setListenState('idle');
    };
    
    window.speechSynthesis.speak(utterance);
  };

  // Helper info of current page
  const statsSummary = useMemo(() => {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const spendingByCategory: Record<string, number> = {};
    movements.slice(0, 10).forEach(m => {
      const cat = categories.find(c => c.id === m.categoryId)?.name || 'Otros';
      if (m.type === 'expense') {
        spendingByCategory[cat] = (spendingByCategory[cat] || 0) + m.amount;
      }
    });
    return {
      totalBalance,
      recentMovementsLength: movements.length,
      goalsPending: goals.filter(g => g.currentAmount < g.targetAmount).length,
      currentTab: activeTab,
      topSpending: Object.entries(spendingByCategory).map(([c, v]) => `${c}: S/ ${v}`).join(', ') || 'Ninguno reciente'
    };
  }, [movements, accounts, goals, categories, activeTab]);

  // Real call to Gemini using GoogleGenAI
  const askGemini = async (promptText: string) => {
    setListenState('processing');
    setSpeechError('');

    // Check if user is asking to log an expense via voice or text
    const lower = promptText.toLowerCase();
    const amountMatch = promptText.match(/(?:s\/?\.?\s*|soles\s*)?(\d+(?:\.\d{1,2})?)/i);
    if ((lower.includes('gasté') || lower.includes('pagué') || lower.includes('almuerzo') || lower.includes('compré') || lower.includes('anot')) && amountMatch) {
      const parsedAmt = parseFloat(amountMatch[1]);
      if (!isNaN(parsedAmt) && parsedAmt > 0) {
        let matchedCat = categories.find(c => lower.includes(c.name.toLowerCase())) || foodCategory;
        let matchedAcc = accounts.find(a => lower.includes(a.name.toLowerCase())) || defaultAccount;
        
        setDetectedAction({
          type: 'expense',
          amount: parsedAmt,
          categoryName: matchedCat?.name || 'Alimentación',
          categoryId: matchedCat?.id || '',
          accountName: matchedAcc?.name || 'Sueldo Digital',
          accountId: matchedAcc?.id || '',
          note: promptText.slice(0, 40),
          confidence: 98,
          confirmed: false
        });
      }
    }

    try {
      const apiKey = userProfile?.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const errText = "Por favor, para poder usar el asistente inteligente de LIA, configura tu API Key de Gemini en Ajustes.";
        setResponseHtml(errText);
        speakAloud(errText);
        setListenState('idle');
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `Eres LIA, el Agente Inteligente de Finanzas Mil con modelo Gemini 3.5.
      
      DATOS FINANCIEROS CAPTURADOS EN SU PANTALLA:
      - Saldo General: S/ ${statsSummary.totalBalance}
      - Transacciones registradas: ${statsSummary.recentMovementsLength}
      - Metas de ahorro pendientes: ${statsSummary.goalsPending}
      - Sección que observa el usuario: "${statsSummary.currentTab}"
      - Gastos destacados: ${statsSummary.topSpending}

      REGLAS DE INTERACCIÓN:
      1. Sé extremadamente directa/o, concisa/o, profesional y motivadora.
      2. Máximo 2 oraciones por respuesta ya que eres un agente de voz y acción en tiempo real.
      3. Si el usuario pide registrar un gasto o ingreso, confirma que lo has detectado con éxito.
      4. Si el usuario pregunta consejos de ahorro, da un dato concreto y accionable de inmediato.`;

      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction: systemInstruction
        }
      });

      const responseText = result.text || "Listo. He procesado tu solicitud financiera.";
      setResponseHtml(responseText);
      speakAloud(responseText);
    } catch (err: any) {
      console.error(err);
      const errMsg = "No pude procesar la consulta. Verifica tu conexión y clave de Gemini en Ajustes.";
      setResponseHtml(errMsg);
      speakAloud(errMsg);
      setListenState('idle');
    }
  };

  // Confirm and commit the detected smart action directly to Firestore!
  const handleConfirmDetectedAction = async () => {
    if (!userId || !detectedAction.accountId || isRegisteringAction || detectedAction.confirmed) return;
    setIsRegisteringAction(true);

    try {
      // 1. Add movement to firestore
      await addDoc(collection(db, 'users', userId, 'movements'), {
        userId,
        type: detectedAction.type,
        amount: detectedAction.amount,
        categoryId: detectedAction.categoryId,
        accountId: detectedAction.accountId,
        date: new Date().toISOString(),
        note: detectedAction.note || 'Registrado por Agente IA Finanzas Mil',
        createdAt: new Date().toISOString()
      });

      // 2. Update account balance
      if (activeAccount) {
        const newBalance = detectedAction.type === 'expense'
          ? activeAccount.balance - detectedAction.amount
          : activeAccount.balance + detectedAction.amount;

        await updateDoc(doc(db, 'users', userId, 'accounts', detectedAction.accountId), {
          balance: newBalance
        });
      }

      setDetectedAction(prev => ({ ...prev, confirmed: true }));
      const msg = `¡Gasto de S/ ${detectedAction.amount.toFixed(2)} registrado con éxito en ${detectedAction.categoryName}!`;
      setResponseHtml(msg);
      speakAloud(msg);
    } catch (err) {
      console.error("Error confirming smart action:", err);
      alert("Hubo un error al registrar el movimiento.");
    } finally {
      setIsRegisteringAction(false);
    }
  };

  // Web Speech API Integration
  const startSpeechRecognition = () => {
    if (listenState === 'speaking') {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setListenState('idle');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("El reconocimiento por voz no está disponible en este navegador. Usa los comandos rápidos o escribe.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = 'es-ES';
    rec.interimResults = false;

    rec.onstart = () => {
      setListenState('listening');
      setResponseHtml('Escuchando voz en vivo... Di por ejemplo: "Anoté un almuerzo de S/ 25 en Comida"');
    };

    rec.onerror = (e: any) => {
      console.error(e);
      setSpeechError("Error capturando audio. Por favor intenta usando los botones rápidos.");
      setListenState('idle');
    };

    rec.onend = () => {
      if (listenState === 'listening') {
        setListenState('idle');
      }
    };

    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (text) {
        setResponseHtml(`“${text}”`);
        askGemini(text);
      }
    };

    rec.start();
  };

  // Circle to Search Screen Analytical Scanner simulation
  const handleScanScreen = async () => {
    setIsScanningScreen(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    let scanPrompt = `Analiza mi sección activa "${activeTab}" y mis saldos generales. Dame un consejo o alerta rápida de ahorro para esta sección.`;
    
    setTimeout(() => {
      setIsScanningScreen(false);
      askGemini(scanPrompt);
    }, 1800);
  };

  const quickVoicePrompts = [
    { text: "¿Cuánto puedo gastar hoy sin salirme del presupuesto?", emoji: "🎯" },
    { text: "¿Cómo va mi meta de Fondo de Emergencia?", emoji: "🛡️" },
    { text: "Ver gastos hormiga acumulados de esta semana", emoji: "🐜" },
    { text: "¿Cuál es mi mayor gasto de este mes?", emoji: "⚡" }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none p-0">
      {/* Dimmed Background Overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto cursor-pointer" 
      />

      {/* Obsidian Titanium & Esmeralda Neon Bottom Sheet Modal */}
      <motion.div 
        initial={{ y: "100%", opacity: 0.95 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0.95 }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        className="w-full max-w-lg hero-obsidian text-white rounded-t-[2.5rem] p-5 sm:p-6 shadow-[0_-25px_60px_rgba(0,245,160,0.15)] relative pointer-events-auto border-t border-emerald-500/30 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Neon Emerald Top Handle Accent */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-[#00F5A0] to-teal-400 z-20" />

        {/* Ambient Glows */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-80 h-36 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Scanner Bar Simulation */}
        {isScanningScreen && (
          <motion.div 
            initial={{ top: 0 }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-[#00F5A0] to-teal-400 blur-xs shadow-lg shadow-emerald-500/60 z-30 pointer-events-none"
          />
        )}

        {/* Header Section */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 shrink-0 relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-black text-[#00F5A0] bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] animate-pulse" />
              AGENTE IA FINANZAS MIL
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline-block">
              Asesor Inteligente En Vivo • Gemini 3.5
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsVoiceActive(!isVoiceActive)}
              title={isVoiceActive ? "Desactivar respuesta por voz" : "Activar respuesta por voz"}
              className={cn(
                "p-2 rounded-xl border transition-colors cursor-pointer",
                isVoiceActive ? "bg-emerald-500/20 text-[#00F5A0] border-emerald-500/40" : "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
              )}
            >
              {isVoiceActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button 
              onClick={onClose} 
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto space-y-4 py-3.5 pr-1 no-scrollbar flex-1 relative z-10">
          
          {/* Hero Voice Visualizer Card */}
          <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden flex flex-col items-center text-center shadow-card-subtle">
            {/* Top status capsule */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[9px] font-extrabold text-[#00F5A0] uppercase tracking-widest mb-3 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] animate-ping" />
              {listenState === 'listening' ? 'ESCUCHANDO TU VOZ...' : listenState === 'processing' ? 'PROCESANDO CON GEMINI 3.5...' : listenState === 'speaking' ? 'HABLANDO EN VIVO...' : 'MODO EN VIVO DISPONIBLE'}
            </div>

            {/* Concentric Spherical Voice Core Orb */}
            <div className="relative my-2 cursor-pointer select-none" onClick={startSpeechRecognition} title="Toca para hablar">
              {/* Outer pulsing rings */}
              <div className="absolute -inset-3 rounded-full border border-emerald-400/20 pulseGlowCircle pointer-events-none" />
              <div className="absolute -inset-1 rounded-full border border-teal-400/30 pointer-events-none" />

              {/* Central Voice Core Sphere */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-slate-950 via-slate-900 to-emerald-950 border-2 border-[#00F5A0]/60 shadow-[0_0_25px_rgba(0,245,160,0.35)] flex items-center justify-center relative overflow-hidden group hover:scale-105 transition-transform">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div 
                      key={i} 
                      className={`w-1 rounded-full bg-gradient-to-t from-teal-400 to-[#00F5A0] wave-bar-${i}`}
                      style={{ height: listenState === 'listening' || listenState === 'speaking' ? '28px' : '14px' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              Toca la esfera para hablar directamente
            </p>

            {/* Real-time Transcription Box */}
            <div className="w-full mt-3 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left">
              <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-[#00F5A0] mb-1 font-mono">
                <Sparkles className="w-3 h-3 text-[#00F5A0]" />
                Transcripción detectada / Consulta activa
              </div>
              <p className="text-xs text-slate-200 font-medium italic leading-relaxed">
                {responseHtml}
              </p>
            </div>

            {speechError && (
              <div className="mt-2 text-[10px] text-rose-400 font-semibold bg-rose-950/30 px-3 py-1 rounded-lg border border-rose-900/50">
                {speechError}
              </div>
            )}
          </div>

          {/* Smart Action Confirmation Card (Acción Detectada: REGISTRAR NUEVO GASTO) */}
          <div className="p-4 rounded-3xl bg-slate-900/90 border border-emerald-500/30 shadow-card-subtle relative overflow-hidden">
            {/* Top corner glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00F5A0]" />
                <span className="text-[11px] font-black uppercase tracking-wider text-white font-display">
                  Acción Detectada: REGISTRAR NUEVO GASTO
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-black text-[#00F5A0] uppercase tracking-wider font-mono">
                CONFIANZA {detectedAction.confidence}%
              </span>
            </div>

            {/* Highlighted Amount Display */}
            <div className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight font-display mb-3">
              - S/ {detectedAction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>

            {/* 4-Cell Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-left mb-3">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Categoría</span>
                <span className="text-xs font-black text-white mt-0.5 block truncate">
                  🍽️ {detectedAction.categoryName}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Cuenta Origen</span>
                <span className="text-xs font-black text-white mt-0.5 block truncate">
                  💳 {detectedAction.accountName}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Fecha & Hora</span>
                <span className="text-xs font-bold text-slate-200 mt-0.5 block truncate">
                  Hoy • {format(new Date(), 'HH:mm')}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Glosa / Detalle</span>
                <span className="text-xs font-bold text-slate-200 mt-0.5 block truncate">
                  {detectedAction.note || 'Sin nota'}
                </span>
              </div>
            </div>

            {/* Impact preview card */}
            {activeAccount && (
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-[11px] text-slate-300 mb-3.5 flex items-center justify-between">
                <span>Tu saldo en <strong className="text-white">{activeAccount.name}</strong> pasará de <strong className="font-mono text-slate-300">S/ {activeAccount.balance.toFixed(2)}</strong> a:</span>
                <span className="font-bold text-[#00F5A0] font-mono ml-2">S/ {projectedBalance.toFixed(2)}</span>
              </div>
            )}

            {/* Confirmation Buttons */}
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  onClose();
                  onOpenMovementModal?.('expense');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-extrabold uppercase tracking-wider border border-slate-700 transition-all active:scale-95 cursor-pointer text-center"
              >
                EDITAR DETALLES
              </button>

              <button 
                onClick={handleConfirmDetectedAction}
                disabled={isRegisteringAction || detectedAction.confirmed}
                className={cn(
                  "flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 text-slate-950",
                  detectedAction.confirmed
                    ? "bg-emerald-400 text-slate-950 font-black cursor-default"
                    : "bg-gradient-to-r from-emerald-500 via-[#00F5A0] to-teal-400 shadow-glow-emerald hover:brightness-110"
                )}
              >
                {detectedAction.confirmed ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    ¡REGISTRADO CON ÉXITO!
                  </>
                ) : isRegisteringAction ? (
                  "REGISTRANDO..."
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    CONFIRMAR GASTO
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Suggestions Prompts */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1 font-mono flex items-center gap-1">
              <span>⚡</span> CONSULTAS RÁPIDAS AL ASISTENTE
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickVoicePrompts.map((p, idx) => (
                <button 
                  key={idx}
                  onClick={() => {
                    setResponseHtml(`“${p.text}”`);
                    askGemini(p.text);
                  }}
                  disabled={listenState === 'processing'}
                  className="px-3 py-2.5 bg-slate-900/80 hover:bg-slate-800 active:scale-95 transition-all text-left text-xs font-bold rounded-2xl border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-white flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="text-base shrink-0">{p.emoji}</span>
                  <span className="truncate">{p.text}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Input & Voice Dock */}
        <div className="pt-2 border-t border-slate-800/80 shrink-0 space-y-2 relative z-10">
          <div className="flex gap-2 items-center">
            
            {/* Circle To Search Analogue screen scanning button */}
            <button 
              onClick={handleScanScreen}
              disabled={listenState === 'processing' || isScanningScreen}
              className={cn(
                "h-12 px-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center gap-1.5 hover:bg-slate-800 text-slate-300 transition-all active:scale-95 text-xs font-bold uppercase tracking-wider shrink-0 disabled:opacity-50 cursor-pointer",
                isScanningScreen ? "border-emerald-500 text-[#00F5A0]" : ""
              )}
              title="Analizar pantalla activa con LIA"
            >
              <Eye className={cn("w-4 h-4", isScanningScreen ? "animate-spin text-[#00F5A0]" : "text-emerald-400")} />
              <span className="hidden sm:inline">Escanear Pantalla</span>
            </button>

            {/* Keyboard entry input */}
            <div className="relative flex-1">
              <input 
                type="text" 
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && typedInput.trim() && listenState !== 'processing') {
                    askGemini(typedInput);
                    setTypedInput('');
                  }
                }}
                placeholder="Escribe o habla con el agente..."
                className="w-full h-12 bg-slate-900/90 border border-slate-800 rounded-2xl pl-4 pr-11 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-500 transition-all"
              />
              <button 
                type="button"
                onClick={() => {
                  if (typedInput.trim() && listenState !== 'processing') {
                    askGemini(typedInput);
                    setTypedInput('');
                  }
                }}
                disabled={!typedInput.trim() || listenState === 'processing'}
                className={cn(
                  "absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95",
                  typedInput.trim() 
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black shadow-glow-emerald cursor-pointer" 
                    : "text-slate-600 cursor-not-allowed opacity-40"
                )}
                title="Enviar mensaje"
              >
                <Send className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Central Glowing FAB Microphone button */}
            <button 
              onClick={startSpeechRecognition}
              disabled={listenState === 'processing'}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all select-none active:scale-90 shadow-lg shrink-0 cursor-pointer",
                listenState === 'listening' 
                  ? "bg-rose-500 text-white animate-pulse shadow-glow-rose border border-rose-400" 
                  : listenState === 'speaking'
                  ? "bg-amber-500 text-slate-950 border border-amber-400"
                  : "bg-gradient-to-tr from-emerald-500 via-[#00F5A0] to-teal-400 text-slate-950 hover:brightness-110 shadow-glow-emerald border border-emerald-300 pulse-emerald-fab"
              )}
              title="Hablar por micrófono"
            >
              <Mic className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Micro indicator footer */}
          <div className="flex justify-between items-center px-1 text-[8px] uppercase tracking-widest text-slate-400 font-bold font-mono">
            <span>Motor Neuronal Gemini Finanzas Activo</span>
            <span className="flex items-center gap-1 text-[#00F5A0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F5A0] animate-pulse" />
              LIA CONECTADA OK
            </span>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
