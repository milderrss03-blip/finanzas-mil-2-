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
import { auth, db, signInWithGoogle, logout } from './firebase';
import { 
  UserProfile, 
  Account, 
  Category, 
  Movement, 
  Goal, 
  WeeklyBudget,
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
  LogOut, 
  LogIn,
  Bell,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  ChevronRight,
  MoreVertical,
  X,
  Settings,
  CreditCard,
  DollarSign,
  Smartphone,
  PiggyBank,
  Briefcase,
  CheckCircle2,
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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, subMonths, isAfter } from 'date-fns';
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
  CartesianGrid
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
  'Efectivo': DollarSign,
  'Banco': CreditCard,
  'Digital': Smartphone,
  'Ahorro': PiggyBank,
  'Inversión': Briefcase
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weeklyBudget, setWeeklyBudget] = useState<WeeklyBudget | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [buttonAnimateKey, setButtonAnimateKey] = useState(0);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (user) {
        // Ensure user profile exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
          const newProfile: UserProfile = {
            id: user.uid,
            name: user.displayName || 'Usuario',
            email: user.email || '',
            photoURL: user.photoURL || '',
            plan: 'basic'
          };
          try {
            await setDoc(userRef, newProfile);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'users');
          }
          setUserProfile(newProfile);
        } else {
          setUserProfile(docSnap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
      if (cats.length === 0) {
        // Initialize predefined categories if none exist
        PREDEFINED_CATEGORIES.forEach(async (name) => {
          try {
            await addDoc(collection(db, 'categories'), { name, userId: user.uid });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'categories');
          }
        });
      } else {
        setCategories(cats);
      }
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

    return () => {
      unsubAccounts();
      unsubCategories();
      unsubMovements();
      unsubGoals();
      unsubBudget();
    };
  }, [user, isAuthReady]);

  // Dashboard Stats
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

    const weekStart = startOfWeek(new Date());
    const weeklyMovements = movements.filter(m => parseISO(m.date) >= weekStart);
    const weeklyIncome = weeklyMovements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
    const weeklyExpense = weeklyMovements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0);

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

    return { totalBalance, dailyIncome, dailyExpense, topCategory, weeklyIncome, weeklyExpense, monthlyIncome, monthlyExpense };
  }, [accounts, movements, categories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className={cn(
      "min-h-screen pb-24 font-sans transition-colors duration-300",
      darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Header */}
      <header className={cn(
        "px-4 pt-6 pb-4 sticky top-0 z-50 transition-all duration-300",
        darkMode ? "bg-slate-950/80 backdrop-blur-xl border-b border-slate-800" : "bg-white/80 backdrop-blur-xl border-b border-slate-100"
      )}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Wallet className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className={cn("text-xl font-extrabold font-display leading-tight tracking-tighter", darkMode ? "text-white" : "text-slate-900")}>
                Finanzas Mil <span className="text-indigo-600 italic">pro</span>
              </h1>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">Tu Asesor Personal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userProfile && (
              <button 
                onClick={togglePlan}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                  userProfile.plan === 'premium' 
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" 
                    : darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
                )}
              >
                {userProfile.plan === 'premium' ? <Crown className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                {userProfile.plan === 'premium' ? 'Premium' : 'Básico'}
              </button>
            )}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={cn(
                "p-3 rounded-2xl transition-all active:scale-95",
                darkMode ? "bg-slate-900 text-amber-400 hover:bg-slate-800" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={logout}
              className={cn(
                "p-3 rounded-2xl transition-all active:scale-95",
                darkMode ? "bg-slate-900 text-rose-400 hover:bg-slate-800" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <DashboardView movements={movements} accounts={accounts} categories={categories} darkMode={darkMode} />}
          {activeTab === 'calendar' && <CalendarView movements={movements} accounts={accounts} categories={categories} darkMode={darkMode} />}
          {activeTab === 'stats' && <StatsView movements={movements} categories={categories} darkMode={darkMode} />}
          {activeTab === 'budget' && <WeeklyBudgetView budget={weeklyBudget} userId={user.uid} darkMode={darkMode} categories={categories} />}
          {activeTab === 'advisor' && <FinanceAdvisorView movements={movements} accounts={accounts} goals={goals} darkMode={darkMode} plan={userProfile?.plan || 'basic'} />}
          {activeTab === 'accounts' && <AccountsView accounts={accounts} userId={user.uid} darkMode={darkMode} />}
          {activeTab === 'goals' && <GoalsView goals={goals} userId={user.uid} darkMode={darkMode} />}
        </AnimatePresence>
      </main>

      {/* Floating Action Button */}
      <motion.button 
        key={buttonAnimateKey}
        onClick={() => setIsMovementModalOpen(true)}
        animate={buttonAnimateKey > 0 ? {
          scale: [1, 1.2, 1],
          rotate: [0, 15, -15, 0]
        } : {}}
        transition={{ duration: 0.5 }}
        className={cn(
          "fixed bottom-28 right-6 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white z-40",
          darkMode ? "shadow-lg shadow-indigo-500/20" : "shadow-lg shadow-indigo-200"
        )}
      >
        <Plus className="w-8 h-8" />
      </motion.button>

      {/* Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 border-t px-6 py-3 z-50 transition-colors duration-300",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Inicio" darkMode={darkMode} />
          <NavButton active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} icon={ClipboardList} label="Presupuesto" darkMode={darkMode} />
          <NavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={PieChart} label="Stats" darkMode={darkMode} />
          <NavButton active={activeTab === 'advisor'} onClick={() => setActiveTab('advisor')} icon={Sparkles} label="Asesor" darkMode={darkMode} />
          <NavButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={Wallet} label="Cuentas" darkMode={darkMode} />
          <NavButton active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon={Target} label="Metas" darkMode={darkMode} />
        </div>
      </nav>

      {/* Movement Modal */}
      <AnimatePresence>
        {isMovementModalOpen && (
          <MovementModal 
            onClose={() => setIsMovementModalOpen(false)} 
            onSuccess={() => setButtonAnimateKey(prev => prev + 1)}
            accounts={accounts} 
            categories={categories} 
            userId={user.uid}
            darkMode={darkMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function NavButton({ active, onClick, icon: Icon, label, darkMode }: { active: boolean, onClick: () => void, icon: any, label: string, darkMode: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300",
        active 
          ? "text-indigo-600 dark:text-indigo-400 scale-110" 
          : darkMode ? "text-slate-500 hover:text-slate-400" : "text-slate-400 hover:text-slate-600"
      )}
    >
      <Icon className={cn("w-6 h-6", active ? "fill-indigo-600/10 dark:fill-indigo-400/10" : "")} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function MovementItem({ movement, categories, accounts, darkMode }: { movement: Movement, categories: Category[], accounts: Account[], darkMode: boolean, key?: string }) {
  const category = categories.find(c => c.id === movement.categoryId);
  const account = accounts.find(a => a.id === movement.accountOriginId);
  
  const isIncome = movement.type === 'income';
  const isTransfer = movement.type === 'transfer';

  return (
    <div className={cn(
      "p-3 rounded-2xl border flex items-center justify-between transition-all duration-300 cursor-pointer",
      darkMode ? "bg-slate-900 border-slate-800 hover:border-indigo-500/30" : "bg-white border-slate-100 hover:border-indigo-100 shadow-sm"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm",
          isIncome ? (darkMode ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-50 text-emerald-600") : 
          isTransfer ? (darkMode ? "bg-blue-900/40 text-blue-400" : "bg-blue-50 text-blue-600") : 
          (darkMode ? "bg-rose-900/40 text-rose-400" : "bg-rose-50 text-rose-600")
        )}>
          {isIncome ? <TrendingUp className="w-5 h-5" /> : 
           isTransfer ? <ArrowRightLeft className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        </div>
        <div>
          <p className={cn("font-display font-bold text-sm capitalize transition-colors", darkMode ? "text-slate-200" : "text-slate-900")}>
            {category?.name || (isTransfer ? 'Transferencia' : 'Sin categoría')}
          </p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{account?.name || 'Cuenta eliminada'}</p>
        </div>
      </div>
      <div className="text-right space-y-0.5">
        <p className={cn(
          "font-display font-bold text-base transition-colors tracking-tight",
          isIncome ? "text-emerald-500" : isTransfer ? "text-blue-500" : (darkMode ? "text-slate-100" : "text-slate-900")
        )}>
          {isIncome ? '+' : isTransfer ? '' : '-'}${movement.amount.toLocaleString()}
        </p>
        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
          {format(parseISO(movement.date), 'dd MMM', { locale: es })}
        </p>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 text-center transition-colors duration-700 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]"></div>

      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl shadow-indigo-500/30 relative z-10"
      >
        <TrendingUp className="text-white w-14 h-14" />
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="relative z-10"
      >
        <h1 className="text-5xl font-extrabold font-display tracking-tighter text-slate-900 dark:text-white mb-4">
          Finanzas Mil <span className="text-indigo-600">pro</span>
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mb-12 max-w-xs mx-auto font-medium leading-relaxed">
          Gestiona tu libertad financiera con elegancia y precisión.
        </p>
        
        <button 
          onClick={handleLogin}
          disabled={isLoggingIn}
          className={cn(
            "group relative w-full max-w-xs py-4 px-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-2xl shadow-xl shadow-indigo-500/5 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden",
            isLoggingIn && "opacity-70 cursor-not-allowed"
          )}
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
          {isLoggingIn ? 'Iniciando sesión...' : 'Continuar con Google'}
        </button>
      </motion.div>
      
      <p className="mt-10 text-xs text-slate-400 font-medium tracking-wide relative z-10">
        Al continuar, aceptas nuestros términos y política de privacidad.
      </p>
    </div>
  );
}

function MovementModal({ onClose, accounts, categories, userId, darkMode, onSuccess }: { onClose: () => void, accounts: Account[], categories: Category[], userId: string, darkMode: boolean, onSuccess?: () => void }) {
  const [type, setType] = useState<MovementType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountOriginId, setAccountOriginId] = useState('');
  const [accountDestinationId, setAccountDestinationId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountOriginId || (type === 'transfer' && !accountDestinationId)) return;
    
    setIsSubmitting(true);
    try {
      const numAmount = parseFloat(amount);
      
      await runTransaction(db, async (transaction) => {
        // 1. Get account data (READS FIRST)
        const originRef = doc(db, 'accounts', accountOriginId);
        const originSnap = await transaction.get(originRef);
        if (!originSnap.exists()) throw new Error("Account origin not found");
        const originData = originSnap.data() as Account;

        let destData: Account | null = null;
        let destRef: any = null;
        if (type === 'transfer') {
          destRef = doc(db, 'accounts', accountDestinationId);
          const destSnap = await transaction.get(destRef);
          if (!destSnap.exists()) throw new Error("Account destination not found");
          destData = destSnap.data() as Account;
        }

        // 2. Perform writes (WRITES AFTER)
        const movementRef = doc(collection(db, 'movements'));
        transaction.set(movementRef, {
          type,
          amount: numAmount,
          categoryId: type === 'transfer' ? '' : categoryId,
          accountOriginId,
          accountDestinationId: type === 'transfer' ? accountDestinationId : '',
          date: new Date(date).toISOString(),
          note,
          userId
        });

        if (type === 'income') {
          transaction.update(originRef, { balance: originData.balance + numAmount });
        } else if (type === 'expense') {
          transaction.update(originRef, { balance: originData.balance - numAmount });
        } else if (type === 'transfer') {
          transaction.update(originRef, { balance: originData.balance - numAmount });
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
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className={cn(
          "w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-4 transition-colors duration-300",
          darkMode ? "bg-slate-900" : "bg-white"
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Nuevo Movimiento</h2>
          <button onClick={onClose} className={cn(
            "p-1.5 rounded-full transition-colors",
            darkMode ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"
          )}><X className="w-4 h-4" /></button>
        </div>

        <div className={cn("flex p-1 rounded-xl transition-colors", darkMode ? "bg-slate-800" : "bg-slate-100")}>
          <button 
            onClick={() => setType('expense')}
            className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all", type === 'expense' ? (darkMode ? "bg-slate-700 text-rose-400" : "bg-white shadow-sm text-rose-600") : "text-slate-500")}
          >Gasto</button>
          <button 
            onClick={() => setType('income')}
            className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all", type === 'income' ? (darkMode ? "bg-slate-700 text-emerald-400" : "bg-white shadow-sm text-emerald-600") : "text-slate-500")}
          >Ingreso</button>
          <button 
            onClick={() => setType('transfer')}
            className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all", type === 'transfer' ? (darkMode ? "bg-slate-700 text-blue-400" : "bg-white shadow-sm text-blue-600") : "text-slate-500")}
          >Transf.</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Monto</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">$</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "w-full border-none rounded-xl py-3 pl-10 pr-4 text-xl font-bold focus:ring-2 focus:ring-indigo-500 transition-colors",
                  darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                )}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cuenta {type === 'transfer' ? 'Origen' : ''}</label>
              <select 
                value={accountOriginId}
                onChange={(e) => setAccountOriginId(e.target.value)}
                className={cn(
                  "w-full border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500 transition-colors",
                  darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                )}
                required
              >
                <option value="">Seleccionar</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (${a.balance})</option>)}
              </select>
            </div>

            {type === 'transfer' ? (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cuenta Destino</label>
                <select 
                  value={accountDestinationId}
                  onChange={(e) => setAccountDestinationId(e.target.value)}
                  className={cn(
                    "w-full border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500 transition-colors",
                    darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  )}
                  required
                >
                  <option value="">Seleccionar</option>
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
                    "w-full border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500 transition-colors",
                    darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  )}
                  required={type !== 'transfer'}
                >
                  <option value="">Seleccionar</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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
                "w-full border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500 transition-colors",
                darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
              )}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nota (Opcional)</label>
            <input 
              type="text" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="¿En qué gastaste?"
              className={cn(
                "w-full border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500 transition-colors",
                darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
              )}
            />
          </div>

          <button 
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-base shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Movimiento'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function WeeklyBudgetView({ budget, userId, darkMode, categories }: { budget: WeeklyBudget | null, userId: string, darkMode: boolean, categories: Category[] }) {
  const [income, setIncome] = useState(budget?.income || 0);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenses, setExpenses] = useState(budget?.expenses || []);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (budget) {
      setIncome(budget.income);
      setExpenses(budget.expenses);
    }
  }, [budget]);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = income - totalExpenses;

  // Group expenses by category name (or use the expense name if it matches a category)
  const categorySummary = useMemo(() => {
    const summary: Record<string, number> = {};
    expenses.forEach(exp => {
      // We try to find if the expense name matches a category name
      // In handleAddExpense, if a category button is clicked, the name is the category name.
      const catName = categories.find(c => c.name === exp.name)?.name || exp.name;
      summary[catName] = (summary[catName] || 0) + exp.amount;
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [expenses, categories]);

  const saveBudget = async (newIncome: number, newExpenses: { name: string, amount: number }[]) => {
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

  const handleAddExpense = (name?: string) => {
    const finalName = name || expenseName;
    if (!finalName || !expenseAmount) return;
    const newExpenses = [...expenses, { name: finalName, amount: parseFloat(expenseAmount) }];
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

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), { name: newCategoryName.trim(), userId });
      setNewCategoryName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }
  };

  const handleRemoveCategory = async (catId: string) => {
    try {
      await deleteDoc(doc(db, 'categories', catId));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className={cn("text-sm font-extrabold font-display tracking-tight transition-colors", darkMode ? "text-white" : "text-slate-900")}>Presupuesto Semanal</h2>
          <p className="text-[8px] text-slate-500 font-medium uppercase tracking-wider">Planifica tus gastos</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-indigo-600" />
        </div>
      </div>

      {/* Income Card */}
      <div className={cn(
        "p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
      )}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 block">Ingreso Semanal</label>
        <div className="flex items-center gap-3 relative z-10">
          <span className="text-2xl font-extrabold font-display text-emerald-500 tracking-tighter">S/</span>
          <input 
            type="number" 
            value={income || ''} 
            onChange={(e) => handleIncomeChange(e.target.value)}
            placeholder="0.00"
            className={cn(
              "text-3xl font-extrabold font-display bg-transparent border-none focus:ring-0 w-full p-0 tracking-tighter",
              darkMode ? "text-white" : "text-slate-900"
            )}
          />
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(
          "p-4 rounded-xl border transition-all duration-300",
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
        )}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Gastos Totales</p>
          <p className="text-xl font-extrabold font-display text-rose-500 tracking-tighter">S/ {totalExpenses.toLocaleString()}</p>
        </div>
        <div className={cn(
          "p-4 rounded-xl border transition-all duration-300",
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
        )}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Saldo Restante</p>
          <p className={cn(
            "text-xl font-extrabold font-display tracking-tighter",
            remaining >= 0 ? "text-emerald-500" : "text-rose-500"
          )}>S/ {remaining.toLocaleString()}</p>
        </div>
      </div>

      {/* Category Summary (New Section) */}
      {categorySummary.length > 0 && (
        <div className={cn(
          "p-5 rounded-2xl border transition-all duration-300 space-y-3",
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
        )}>
          <h3 className={cn("font-extrabold font-display text-lg tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Resumen por Categoría</h3>
          <div className="space-y-2">
            {categorySummary.map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0">
                <span className={cn("text-sm font-bold", darkMode ? "text-slate-300" : "text-slate-600")}>{cat}</span>
                <span className={cn("text-lg font-extrabold font-display", darkMode ? "text-white" : "text-slate-900")}>S/ {amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Expense */}
      <div className={cn(
        "p-5 rounded-2xl border transition-all duration-300 space-y-4",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={cn("font-extrabold font-display text-xs tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Planificar Gasto</h3>
            <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Selecciona una categoría</p>
          </div>
          <button 
            onClick={() => setIsManagingCategories(!isManagingCategories)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-50 text-slate-500"
            )}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {isManagingCategories ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Nueva categoría..." 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg border font-bold text-sm transition-all focus:ring-2 focus:ring-indigo-500",
                  darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                )}
              />
              <button 
                onClick={handleAddCategory}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <div 
                  key={cat.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1 rounded-md border text-xs font-bold",
                    darkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                  )}
                >
                  <span>{cat.name}</span>
                  <button 
                    onClick={() => handleRemoveCategory(cat.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleAddExpense(cat.name)}
                className={cn(
                  "px-3 py-2 rounded-md text-xs font-bold transition-all active:scale-95 border",
                  darkMode 
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" 
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Nombre del gasto..." 
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              className={cn(
                "flex-1 py-3 px-4 rounded-lg border font-bold text-sm transition-all focus:ring-2 focus:ring-indigo-500",
                darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              )}
            />
            <input 
              type="number" 
              placeholder="Monto" 
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className={cn(
                "w-24 py-3 px-4 rounded-lg border font-bold text-sm transition-all focus:ring-2 focus:ring-indigo-500",
                darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              )}
            />
          </div>
          <button 
            onClick={() => handleAddExpense()}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar al Presupuesto</span>
          </button>
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        <h3 className={cn("font-extrabold font-display text-lg px-1 tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Gastos Planificados</h3>
        <div className="space-y-2">
          {expenses.map((exp, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "p-4 rounded-xl border flex items-center justify-between transition-all duration-300 group",
                darkMode ? "bg-slate-900 border-slate-800 hover:border-indigo-500/20" : "bg-white border-slate-100 shadow-sm hover:border-indigo-100"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <p className={cn("font-extrabold font-display text-sm tracking-tight transition-colors", darkMode ? "text-slate-200" : "text-slate-900")}>{exp.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Planificado</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className={cn("text-lg font-extrabold font-display tracking-tight transition-colors", darkMode ? "text-slate-100" : "text-slate-900")}>
                  S/ {exp.amount.toLocaleString()}
                </p>
                <button 
                  onClick={() => handleRemoveExpense(i)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors active:scale-90"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
          {expenses.length === 0 && (
            <div className={cn(
              "border border-dashed rounded-2xl p-8 text-center transition-colors",
              darkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
            )}>
              <p className="text-slate-400 text-xs font-medium">No hay gastos planificados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FinanceAdvisorView({ movements, accounts, goals, darkMode, plan }: { movements: Movement[], accounts: Account[], goals: Goal[], darkMode: boolean, plan: 'basic' | 'premium' }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const statsSummary = useMemo(() => {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.currentAmount >= g.targetAmount).length;
    const recentMovements = movements.slice(0, 5).map(m => `${m.type === 'income' ? '+' : '-'}$${m.amount} (${m.date})`).join(', ');
    
    return `Saldo total: $${totalBalance}. Metas: ${completedGoals}/${totalGoals}. Movimientos recientes: ${recentMovements}.`;
  }, [movements, accounts, goals]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    if (plan === 'basic' && messages.length >= 3) {
      alert("El plan básico solo permite 3 mensajes con el asesor. ¡Pásate a Premium para chats ilimitados!");
      return;
    }

    const userMsg = { role: 'user' as const, text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const prompt = `Eres un asesor financiero experto para la app "Finanzas Mil pro". 
      Contexto del usuario: ${statsSummary}
      Responde de forma concisa, profesional y motivadora en español. 
      Pregunta del usuario: ${input}`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      const modelMsg = { role: 'model' as const, text: result.text || "Lo siento, no pude procesar tu solicitud." };
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Error with Gemini:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Hubo un error al conectar con el asesor. Por favor intenta de nuevo." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h2 className={cn("text-base font-extrabold font-display transition-colors", darkMode ? "text-white" : "text-slate-900")}>Asesor IA</h2>
          </div>
          {plan === 'basic' && (
            <span className="text-[8px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Plan Básico</span>
          )}
        </div>

      <div className={cn(
        "flex-1 overflow-y-auto p-3 rounded-2xl border space-y-2 transition-colors",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
      )}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 p-4">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <p className={cn("font-bold text-sm", darkMode ? "text-slate-200" : "text-slate-900")}>¿En qué puedo ayudarte?</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pregúntame sobre tus ahorros</p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={cn(
              "flex",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}>
              <div className={cn(
                "max-w-[85%] p-3 rounded-xl text-xs font-medium",
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-tr-none" 
                  : darkMode ? "bg-slate-800 text-slate-200 rounded-tl-none" : "bg-slate-100 text-slate-800 rounded-tl-none"
              )}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        {isTyping && (
          <div className="flex justify-start">
            <div className={cn(
              "p-3 rounded-xl text-sm font-medium animate-pulse",
              darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-400"
            )}>
              Pensando...
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribe tu consulta..."
          className={cn(
            "flex-1 py-3 px-4 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 transition-colors text-base font-medium",
            darkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900 shadow-sm"
          )}
        />
        <button 
          onClick={handleSend}
          disabled={isTyping}
          className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform disabled:opacity-50"
        >
          <ArrowRightLeft className="w-5 h-5 rotate-90" />
        </button>
      </div>
    </div>
  );
}

function DashboardView({ movements, accounts, categories, darkMode }: { movements: Movement[], accounts: Account[], categories: Category[], darkMode: boolean }) {
  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
    
    const daily = movements.filter(m => isAfter(parseISO(m.date), today) || isSameDay(parseISO(m.date), today));
    const weekly = movements.filter(m => isAfter(parseISO(m.date), weekStart));
    const monthly = movements.filter(m => isAfter(parseISO(m.date), monthStart));

    const getTotals = (movs: Movement[]) => ({
      income: movs.filter(m => m.type === 'income').reduce((acc, curr) => acc + curr.amount, 0),
      expense: movs.filter(m => m.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0)
    });

    const dailyTotals = getTotals(daily);
    const weeklyTotals = getTotals(weekly);
    const monthlyTotals = getTotals(monthly);

    const categoryTotals: Record<string, number> = {};
    monthly.filter(m => m.type === 'expense').forEach(m => {
      const category = categories.find(c => c.id === m.categoryId)?.name || 'Sin Categoría';
      categoryTotals[category] = (categoryTotals[category] || 0) + m.amount;
    });
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Ninguna';

    return {
      totalBalance,
      dailyIncome: dailyTotals.income,
      dailyExpense: dailyTotals.expense,
      weeklyIncome: weeklyTotals.income,
      weeklyExpense: weeklyTotals.expense,
      monthlyIncome: monthlyTotals.income,
      monthlyExpense: monthlyTotals.expense,
      topCategory
    };
  }, [movements, accounts]);

  return (
    <motion.div 
      key="dashboard"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-2.5"
    >
      {/* Global Balance Card */}
      <div className={cn(
        "rounded-2xl p-3.5 text-white shadow-lg relative overflow-hidden transition-all duration-500",
        darkMode ? "bg-indigo-900 shadow-indigo-900/40" : "bg-indigo-600 shadow-indigo-200"
      )}>
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl"></div>
        
        <p className="text-indigo-100 text-[8px] font-bold uppercase tracking-[0.2em] mb-0.5 opacity-80">Saldo Total Global</p>
        <h2 className="text-xl font-extrabold font-display mb-2 tracking-tighter">
          ${stats.totalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
        </h2>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 backdrop-blur-xl rounded-xl p-2 border border-white/10">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-2.5 h-2.5 bg-emerald-400/20 rounded-md flex items-center justify-center">
                <TrendingUp className="w-1.5 h-1.5 text-emerald-400" />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-100">Hoy</span>
            </div>
            <p className="font-display font-bold text-sm tracking-tight">+${stats.dailyIncome.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-xl p-2 border border-white/10">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-2.5 h-2.5 bg-rose-400/20 rounded-md flex items-center justify-center">
                <TrendingDown className="w-1.5 h-1.5 text-rose-400" />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-100">Hoy</span>
            </div>
            <p className="font-display font-bold text-sm tracking-tight">-${stats.dailyExpense.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="space-y-1.5">
        <h3 className={cn("font-display font-extrabold text-sm px-1", darkMode ? "text-white" : "text-slate-900")}>Resumen de Periodos</h3>
        <div className="grid grid-cols-1 gap-1.5">
          {/* Today */}
          <div className={cn(
            "p-2.5 rounded-xl border flex items-center justify-between transition-all duration-300",
            darkMode ? "bg-slate-900 border-slate-800 hover:border-indigo-500/30" : "bg-white border-slate-100 shadow-sm hover:border-indigo-100"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm",
                darkMode ? "bg-indigo-900/40 text-indigo-400" : "bg-indigo-50 text-indigo-600"
              )}>
                <CalendarIcon className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5">Hoy</p>
                <p className={cn("text-[10px] font-bold font-display transition-colors duration-300", darkMode ? "text-slate-200" : "text-slate-900")}>
                  Balance: ${(stats.dailyIncome - stats.dailyExpense).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right space-y-0">
              <p className="text-[9px] font-bold font-display text-emerald-500">+${stats.dailyIncome.toLocaleString()}</p>
              <p className="text-[9px] font-bold font-display text-rose-500">-${stats.dailyExpense.toLocaleString()}</p>
            </div>
          </div>

          {/* Weekly */}
          <div className={cn(
            "p-2.5 rounded-xl border flex items-center justify-between transition-all duration-300",
            darkMode ? "bg-slate-900 border-slate-800 hover:border-blue-500/30" : "bg-white border-slate-100 shadow-sm hover:border-blue-100"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm",
                darkMode ? "bg-blue-900/40 text-blue-400" : "bg-blue-50 text-blue-600"
              )}>
                <LayoutDashboard className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5">Esta Semana</p>
                <p className={cn("text-[10px] font-bold font-display transition-colors duration-300", darkMode ? "text-slate-200" : "text-slate-900")}>
                  Balance: ${(stats.weeklyIncome - stats.weeklyExpense).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right space-y-0">
              <p className="text-[9px] font-bold font-display text-emerald-500">+${stats.weeklyIncome.toLocaleString()}</p>
              <p className="text-[9px] font-bold font-display text-rose-500">-${stats.weeklyExpense.toLocaleString()}</p>
            </div>
          </div>

          {/* Monthly */}
          <div className={cn(
            "p-2.5 rounded-xl border flex items-center justify-between transition-all duration-300",
            darkMode ? "bg-slate-900 border-slate-800 hover:border-purple-500/30" : "bg-white border-slate-100 shadow-sm hover:border-purple-100"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 shadow-sm",
                darkMode ? "bg-purple-900/40 text-purple-400" : "bg-purple-50 text-purple-600"
              )}>
                <PieChart className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5">Este Mes</p>
                <p className={cn("text-[10px] font-bold font-display transition-colors duration-300", darkMode ? "text-slate-200" : "text-slate-900")}>
                  Balance: ${(stats.monthlyIncome - stats.monthlyExpense).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right space-y-0">
              <p className="text-[9px] font-bold font-display text-emerald-500">+${stats.monthlyIncome.toLocaleString()}</p>
              <p className="text-[9px] font-bold font-display text-rose-500">-${stats.monthlyExpense.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Category Card */}
      <div className={cn(
        "p-6 rounded-[2rem] border flex items-center justify-between transition-all duration-300",
        darkMode ? "bg-slate-900 border-slate-800 hover:border-amber-500/30" : "bg-white border-slate-100 shadow-sm hover:border-amber-100"
      )}>
        <div className="flex items-center gap-5">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
            darkMode ? "bg-amber-900/40 text-amber-400" : "bg-amber-50 text-amber-600"
          )}>
            <PieChart className="w-7 h-7" />
          </div>
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Mayor Gasto</p>
            <p className={cn("text-xl font-extrabold font-display capitalize transition-colors duration-300 tracking-tight", darkMode ? "text-slate-200" : "text-slate-900")}>
              {stats.topCategory}
            </p>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {(stats.dailyIncome === 0 && stats.dailyExpense === 0) || movements.length > 0 ? (
        <div className="space-y-3">
          <h3 className={cn("font-bold text-lg px-1 transition-colors", darkMode ? "text-white" : "text-slate-900")}>Alertas</h3>
          <div className="space-y-2">
            {stats.dailyIncome === 0 && stats.dailyExpense === 0 && (
              <div className={cn(
                "p-4 rounded-2xl border flex items-center gap-3 transition-colors",
                darkMode ? "bg-amber-900/20 border-amber-800/50" : "bg-amber-50 border-amber-100"
              )}>
                <AlertCircle className={cn("w-5 h-5", darkMode ? "text-amber-400" : "text-amber-600")} />
                <p className={cn("text-sm font-medium", darkMode ? "text-amber-200" : "text-amber-900")}>No has registrado movimientos hoy.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Recent Movements */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className={cn("font-bold text-lg transition-colors", darkMode ? "text-white" : "text-slate-900")}>Movimientos Recientes</h3>
          <button className="text-indigo-600 text-sm font-medium">Ver todo</button>
        </div>
        <div className="space-y-3">
          {movements.slice(0, 5).map(m => (
            <MovementItem key={m.id} movement={m} categories={categories} accounts={accounts} darkMode={darkMode} />
          ))}
          {movements.length === 0 && (
            <div className={cn(
              "text-center py-8 rounded-2xl border border-dashed transition-colors",
              darkMode ? "bg-slate-900/50 border-slate-800 text-slate-500" : "bg-white border-slate-200 text-slate-400"
            )}>
              <p className="text-sm">No hay movimientos registrados</p>
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}

function CalendarView({ movements, accounts, categories, darkMode }: { movements: Movement[], accounts: Account[], categories: Category[], darkMode: boolean }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const days = [];
    let curr = start;
    while (curr <= end) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [selectedDate]);

  const dailyStats = useMemo(() => {
    const stats: Record<string, { income: number, expense: number }> = {};
    movements.forEach(m => {
      const dateKey = format(parseISO(m.date), 'yyyy-MM-dd');
      if (!stats[dateKey]) stats[dateKey] = { income: 0, expense: 0 };
      if (m.type === 'income') stats[dateKey].income += m.amount;
      if (m.type === 'expense') stats[dateKey].expense += m.amount;
    });
    return stats;
  }, [movements]);

  const [viewingDate, setViewingDate] = useState<Date | null>(null);
  const movementsForDay = useMemo(() => {
    if (!viewingDate) return [];
    return movements.filter(m => isSameDay(parseISO(m.date), viewingDate));
  }, [viewingDate, movements]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className={cn("text-sm font-extrabold font-display capitalize transition-colors", darkMode ? "text-white" : "text-slate-900")}>
          {format(selectedDate, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setSelectedDate(subMonths(selectedDate, 1))} 
            className={cn(
              "p-2 rounded-xl border shadow-sm transition-colors",
              darkMode ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white" : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
            )}
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <button 
            onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)))} 
            className={cn(
              "p-2 rounded-xl border shadow-sm transition-colors",
              darkMode ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white" : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-7 gap-2 p-4 rounded-3xl border transition-colors duration-300",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
      )}>
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-slate-400 py-2">{d}</div>
        ))}
        {daysInMonth.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const stat = dailyStats[dateKey];
          const isToday = isSameDay(day, new Date());
          
          return (
            <button 
              key={dateKey}
              onClick={() => setViewingDate(day)}
              className={cn(
                "aspect-square rounded-xl border p-1 flex flex-col items-center justify-between transition-all",
                isToday 
                  ? (darkMode ? "bg-indigo-900/40 border-indigo-500 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-600") 
                  : (darkMode ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800 text-slate-400" : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"),
                stat?.expense > 500 ? "border-rose-500/50" : stat?.income > 0 ? "border-emerald-500/50" : ""
              )}
            >
              <span className="text-sm font-bold">{day.getDate()}</span>
              {stat && (
                <div className="flex flex-col gap-0.5">
                  {stat.income > 0 && <div className="w-1 h-1 rounded-full bg-emerald-500"></div>}
                  {stat.expense > 0 && <div className="w-1 h-1 rounded-full bg-rose-500"></div>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {viewingDate && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-3xl p-6 border shadow-sm space-y-4 transition-colors duration-300",
              darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className={cn("text-lg font-extrabold font-display transition-colors", darkMode ? "text-slate-200" : "text-slate-900")}>
                {format(viewingDate, "EEEE, d 'de' MMMM", { locale: es })}
              </h3>
              <button onClick={() => setViewingDate(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {movementsForDay.length > 0 ? (
                movementsForDay.map(m => (
                  <MovementItem key={m.id} movement={m} categories={categories} accounts={accounts} darkMode={darkMode} />
                ))
              ) : (
                <p className="text-center py-4 text-slate-500 text-sm">No hay movimientos este día</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatsView({ movements, categories, darkMode }: { movements: Movement[], categories: Category[], darkMode: boolean }) {
  const pieData = useMemo(() => {
    const data: Record<string, number> = {};
    movements.filter(m => m.type === 'expense').forEach(m => {
      const cat = categories.find(c => c.id === m.categoryId)?.name || 'Otros';
      data[cat] = (data[cat] || 0) + m.amount;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [movements, categories]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  const DARK_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#22d3ee'];

  const barData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(new Date(), i);
      return {
        name: format(d, 'MMM', { locale: es }),
        month: d.getMonth(),
        year: d.getFullYear(),
        income: 0,
        expense: 0
      };
    }).reverse();

    movements.forEach(m => {
      const date = parseISO(m.date);
      const monthData = last6Months.find(d => d.month === date.getMonth() && d.year === date.getFullYear());
      if (monthData) {
        if (m.type === 'income') monthData.income += m.amount;
        if (m.type === 'expense') monthData.expense += m.amount;
      }
    });

    return last6Months;
  }, [movements]);

  const totalIncome = useMemo(() => movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0), [movements]);
  const totalExpense = useMemo(() => movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0), [movements]);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <h2 className={cn("text-sm font-extrabold font-display tracking-tighter transition-colors", darkMode ? "text-white" : "text-slate-900")}>Estadísticas</h2>
        <div className="flex gap-2">
          <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold uppercase tracking-wider">
            Pro Analytics
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cn(
          "p-5 rounded-3xl border transition-all duration-300",
          darkMode ? "bg-slate-900 border-slate-800 shadow-indigo-500/5" : "bg-white border-slate-100 shadow-sm"
        )}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Ingresos</p>
          <p className="text-xl font-extrabold font-display text-emerald-500 tracking-tighter">${totalIncome.toLocaleString()}</p>
        </div>
        <div className={cn(
          "p-5 rounded-3xl border transition-all duration-300",
          darkMode ? "bg-slate-900 border-slate-800 shadow-indigo-500/5" : "bg-white border-slate-100 shadow-sm"
        )}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Gastos</p>
          <p className="text-xl font-extrabold font-display text-rose-500 tracking-tighter">${totalExpense.toLocaleString()}</p>
        </div>
        <div className={cn(
          "col-span-2 p-5 rounded-3xl border flex items-center justify-between transition-all duration-300",
          darkMode ? "bg-indigo-900/20 border-indigo-500/20" : "bg-indigo-50 border-indigo-100"
        )}>
          <div>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Balance Neto</p>
            <p className={cn("text-2xl font-extrabold font-display tracking-tighter", balance >= 0 ? "text-emerald-500" : "text-rose-500")}>
              ${balance.toLocaleString()}
            </p>
          </div>
          <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
            <TrendingUp className="text-indigo-500 w-6 h-6" />
          </div>
        </div>
      </div>
      
      <div className={cn(
        "p-6 rounded-3xl border transition-all duration-300",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
      )}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Gastos por Categoría</h3>
          <PieChart className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={90}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={darkMode ? DARK_COLORS[index % DARK_COLORS.length] : COLORS[index % COLORS.length]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: darkMode ? '#1e293b' : '#fff', 
                  border: 'none', 
                  borderRadius: '16px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  color: darkMode ? '#f1f5f9' : '#1e293b'
                }}
                itemStyle={{ color: darkMode ? '#f1f5f9' : '#1e293b' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                formatter={(value) => <span className={cn("text-xs font-medium", darkMode ? "text-slate-400" : "text-slate-600")}>{value}</span>}
              />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={cn(
        "p-6 rounded-3xl border transition-all duration-300",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
      )}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Flujo de Caja (6 meses)</h3>
          <BarChartIcon className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f1f5f9'} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 600 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: darkMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 600 }}
              />
              <Tooltip 
                cursor={{ fill: darkMode ? '#334155' : '#f8fafc', radius: 8 }}
                contentStyle={{ 
                  backgroundColor: darkMode ? '#1e293b' : '#fff', 
                  border: 'none', 
                  borderRadius: '16px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} barSize={12} />
              <Bar dataKey="expense" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const AccountCard = ({ acc, darkMode, onDelete }: { acc: Account, darkMode: boolean, onDelete?: (id: string) => void }) => {
  const Icon = ACCOUNT_ICONS[acc.type] || Wallet;
  return (
    <div className={cn(
      "p-4 rounded-2xl border flex items-center justify-between transition-all duration-300 group",
      darkMode ? "bg-slate-900 border-slate-800 hover:border-indigo-500/30" : "bg-white border-slate-100 shadow-sm hover:border-indigo-100"
    )}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm" style={{ backgroundColor: `${acc.color}15`, color: acc.color }}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className={cn("text-sm font-extrabold font-display transition-colors tracking-tight", darkMode ? "text-slate-200" : "text-slate-900")}>{acc.name}</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">{acc.type}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <p className={cn("text-base font-extrabold font-display transition-colors tracking-tighter", darkMode ? "text-slate-100" : "text-slate-900")}>
          ${acc.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
        </p>
        {onDelete && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('¿Estás seguro de que deseas eliminar esta cuenta?')) {
                onDelete(acc.id);
              }
            }}
            className="p-2 text-slate-400 hover:text-rose-500 transition-colors active:scale-90"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

function AccountsView({ accounts, userId, darkMode }: { accounts: Account[], userId: string, darkMode: boolean }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Efectivo');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState('#6366f1');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;
    try {
      await addDoc(collection(db, 'accounts'), {
        name, type, balance: parseFloat(balance), color, userId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'accounts');
    }
    setIsModalOpen(false);
    setName(''); setBalance('');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'accounts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'accounts');
    }
  };

  const bankAccounts = accounts.filter(acc => acc.type === 'Banco');
  const otherAccounts = accounts.filter(acc => acc.type !== 'Banco');

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className={cn("text-sm font-extrabold font-display tracking-tighter transition-colors", darkMode ? "text-white" : "text-slate-900")}>Mis Cuentas</h2>
          <p className="text-[8px] text-slate-500 font-medium uppercase tracking-wider">Gestiona tus fuentes</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-xl transition-all active:scale-90",
          darkMode ? "bg-indigo-600 text-white shadow-indigo-900/40" : "bg-indigo-600 text-white shadow-indigo-200"
        )}>
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Bancos Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className={cn("font-extrabold font-display text-lg tracking-tight transition-colors", darkMode ? "text-slate-200" : "text-slate-800")}>Bancos</h3>
        </div>
        <div className="space-y-2">
          {bankAccounts.map(acc => (
            <div key={acc.id}>
              <AccountCard acc={acc} darkMode={darkMode} onDelete={handleDelete} />
            </div>
          ))}
          {bankAccounts.length === 0 && (
            <div className={cn(
              "border border-dashed rounded-2xl p-6 text-center transition-colors",
              darkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
            )}>
              <p className="text-slate-400 text-sm font-medium">No tienes cuentas bancarias registradas</p>
            </div>
          )}
        </div>
      </div>

      {/* Other Accounts Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-lg bg-slate-500/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <h3 className={cn("font-extrabold font-display text-lg tracking-tight transition-colors", darkMode ? "text-slate-200" : "text-slate-800")}>Otras Cuentas</h3>
        </div>
        <div className="space-y-2">
          {otherAccounts.map(acc => (
            <div key={acc.id}>
              <AccountCard acc={acc} darkMode={darkMode} onDelete={handleDelete} />
            </div>
          ))}
          {otherAccounts.length === 0 && (
            <div className={cn(
              "border border-dashed rounded-2xl p-6 text-center transition-colors",
              darkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
            )}>
              <p className="text-slate-400 text-sm font-medium">No hay otras cuentas registradas</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl transition-colors duration-300",
                darkMode ? "bg-slate-900" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className={cn("text-sm font-bold transition-colors", darkMode ? "text-white" : "text-slate-900")}>Nueva Cuenta</h2>
                <button onClick={() => setIsModalOpen(false)} className={cn(
                  "p-1.5 rounded-full transition-colors",
                  darkMode ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-600"
                )}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Nombre</label>
                  <input type="text" placeholder="Ej. BCP Ahorros" value={name} onChange={e => setName(e.target.value)} className={cn(
                    "w-full border-none rounded-xl py-2 px-4 text-xs focus:ring-2 focus:ring-indigo-500 transition-colors",
                    darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  )} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Tipo de Cuenta</label>
                  <select value={type} onChange={e => setType(e.target.value as AccountType)} className={cn(
                    "w-full border-none rounded-xl py-2 px-4 text-xs focus:ring-2 focus:ring-indigo-500 transition-colors",
                    darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  )}>
                    {Object.keys(ACCOUNT_ICONS).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Saldo Inicial</label>
                  <input type="number" placeholder="0.00" value={balance} onChange={e => setBalance(e.target.value)} className={cn(
                    "w-full border-none rounded-xl py-2 px-4 text-xs focus:ring-2 focus:ring-indigo-500 transition-colors",
                    darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  )} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Color</label>
                  <div className="flex gap-2 px-1">
                    {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map(c => (
                      <button key={c} type="button" onClick={() => setColor(c)} className={cn("w-6 h-6 rounded-full border-2 transition-all", color === c ? (darkMode ? "border-white scale-110" : "border-slate-900 scale-110") : "border-transparent hover:scale-105")} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <button className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 mt-2 active:scale-95 transition-transform text-xs">Crear Cuenta</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GoalsView({ goals, userId, darkMode }: { goals: Goal[], userId: string, darkMode: boolean }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !target) return;
    try {
      await addDoc(collection(db, 'goals'), {
        name, targetAmount: parseFloat(target), currentAmount: parseFloat(current || '0'), userId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'goals');
    }
    setIsModalOpen(false);
    setName(''); setTarget(''); setCurrent('');
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className={cn("text-sm font-extrabold font-display tracking-tighter transition-colors", darkMode ? "text-white" : "text-slate-900")}>Mis Metas</h2>
          <p className="text-[8px] text-slate-500 font-medium uppercase tracking-wider">Ahorra para lo que importa</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-xl transition-all active:scale-90",
          darkMode ? "bg-indigo-600 text-white shadow-indigo-900/40" : "bg-indigo-600 text-white shadow-indigo-200"
        )}>
          <Plus className="w-7 h-7" />
        </button>
      </div>

      <div className="space-y-3">
        {goals.map(goal => {
          const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
          return (
            <div key={goal.id} className={cn(
              "p-5 rounded-2xl border shadow-sm space-y-4 transition-all duration-300 hover:border-indigo-500/20",
              darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                    darkMode ? "bg-indigo-900/40 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                  )}>
                    <Target className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={cn("text-base font-extrabold font-display tracking-tight transition-colors", darkMode ? "text-white" : "text-slate-900")}>{goal.name}</h3>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">Meta de Ahorro</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-base font-extrabold font-display tracking-tighter transition-colors", darkMode ? "text-white" : "text-slate-900")}>
                    {progress.toFixed(0)}%
                  </p>
                </div>
              </div>
              <div className={cn("h-2.5 rounded-full overflow-hidden transition-colors", darkMode ? "bg-slate-800" : "bg-slate-100")}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                />
              </div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                <span>${goal.currentAmount.toLocaleString()}</span>
                <span>Meta: ${goal.targetAmount.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && (
          <div className={cn(
            "border border-dashed rounded-2xl p-6 text-center transition-colors",
            darkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
          )}>
            <p className="text-slate-500 text-xs">No tienes metas registradas aún</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl transition-colors duration-300",
                darkMode ? "bg-slate-900" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className={cn("text-sm font-bold transition-colors", darkMode ? "text-white" : "text-slate-900")}>Nueva Meta</h2>
                <button onClick={() => setIsModalOpen(false)} className={cn(
                  "p-1.5 rounded-full transition-colors",
                  darkMode ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-600"
                )}><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Nombre de la Meta</label>
                  <input type="text" placeholder="Ej. Viaje a Japón" value={name} onChange={e => setName(e.target.value)} className={cn(
                    "w-full border-none rounded-xl py-2 px-4 text-xs focus:ring-2 focus:ring-indigo-500 transition-colors",
                    darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  )} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Monto Objetivo</label>
                  <input type="number" placeholder="0.00" value={target} onChange={e => setTarget(e.target.value)} className={cn(
                    "w-full border-none rounded-xl py-2 px-4 text-xs focus:ring-2 focus:ring-indigo-500 transition-colors",
                    darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  )} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Monto Actual (Opcional)</label>
                  <input type="number" placeholder="0.00" value={current} onChange={e => setCurrent(e.target.value)} className={cn(
                    "w-full border-none rounded-xl py-2 px-4 text-xs focus:ring-2 focus:ring-indigo-500 transition-colors",
                    darkMode ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  )} />
                </div>
                <button className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 mt-2 active:scale-95 transition-transform text-xs">Crear Meta</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
