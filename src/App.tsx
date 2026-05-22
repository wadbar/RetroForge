import React, { useState, useMemo, Suspense, useEffect } from 'react';
import { 
  Terminal, 
  Cpu, 
  Languages, 
  Wrench, 
  LayoutDashboard, 
  MessageSquare,
  ChevronRight,
  Plus,
  Play,
  Binary,
  Settings,
  ShieldCheck,
  Github,
  BrainCircuit,
  Image as ImageIcon, 
  Box, 
  Music as MusicIcon,
  Loader2,
  Activity,
  Menu,
  Moon,
  Sun,
  Search
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HealthDashboard } from './components/ui/HealthDashboard';

const AIAssistant = React.lazy(() => import('./components/AIAssistant'));
const ProjectDashboard = React.lazy(() => import('./components/ProjectDashboard'));
const TranslationStudio = React.lazy(() => import('./components/TranslationStudio'));
const ModdingHub = React.lazy(() => import('./components/ModdingHub'));
const CommunityHub = React.lazy(() => import('./components/CommunityHub'));
const AIFineTuning = React.lazy(() => import('./components/AIFineTuning'));
const GraphicsStudio = React.lazy(() => import('./components/GraphicsStudio'));
const GeometryStudio = React.lazy(() => import('./components/GeometryStudio'));
const AudioStudio = React.lazy(() => import('./components/AudioStudio'));

import { SearchModal } from './components/ui/SearchModal';
import { Container, SERVICES } from './core/di/Container';
import { logger } from './services/loggerService';
import { monitor } from './services/monitorService';
import { eventBus } from './services/eventBus';
import { storage } from './services/storageService';
import { eventLogger } from './services/eventLogger';
import { configService } from './services/configService';
import './services/selfHealingService';
import { projectService } from './services/projectService';
import { auth, signInWithGoogle, logoutAndClearSession, db } from './services/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { startStorageAudit } from './utils/storage';

// Initialize DI Container
Container.register(SERVICES.LOGGER, logger);
Container.register(SERVICES.MONITOR, monitor);
Container.register(SERVICES.EVENT_BUS, eventBus);
Container.register(SERVICES.STORAGE, storage);
Container.register(SERVICES.CONFIG, configService);
// New industrial services
Container.register('projectService', projectService);

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = location.pathname === '/' ? 'dashboard' : location.pathname.substring(1);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Apply theme to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  const navItems = useMemo(() => [
    { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'community', path: '/community', label: 'Comunidade', icon: Github },
    { id: 'ai', path: '/ai', label: 'IA Assistente', icon: MessageSquare },
    { id: 'training', path: '/training', label: 'Treinar IA', icon: BrainCircuit },
    { id: 'translation', path: '/translation', label: 'Tradução', icon: Languages },
    { id: 'modding', path: '/modding', label: 'Modding & Hacks', icon: Wrench },
    { id: 'graphics', path: '/graphics', label: 'Gráficos', icon: ImageIcon },
    { id: 'geometry', path: '/geometry', label: 'Geometria 3D', icon: Box },
    { id: 'audio', path: '/audio', label: 'Áudio & SFX', icon: MusicIcon },
  ], []);

  const secondaryNavItems = useMemo(() => [
    { id: 'settings', path: '/settings', label: 'Configurações', icon: Settings },
  ], []);

  const [settings, setSettings] = useState({
    lmStudioUrl: 'http://localhost:1234/v1',
    turboMode: true,
    autoSave: true,
    sdkPath: '/opt/retroforge-sdk',
    customAiPrompt: ''
  });

  const [sysStats, setSysStats] = useState({ totalMem: 'N/A', usedMem: 'N/A', cpuLoad: 'N/A' });
  const [aiStatus, setAiStatus] = useState({ local: 'Online', cloud: 'Connected' });
  const [user, setUser] = useState<any>(null);
  const [projectLimit, setProjectLimit] = useState(20);

  useEffect(() => {
    let unsubscribeSnapshot: any = null;
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    
    if (user) {
      const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid), orderBy('updatedAt', 'desc'), limit(projectLimit));
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const cloudProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        eventBus.emit('CLOUD_PROJECTS_UPDATED', cloudProjects);
      });
    }

    const handleLoadMore = () => setProjectLimit(prev => prev + 20);
    eventBus.on('LOAD_MORE_PROJECTS', handleLoadMore);

    return () => {
      unsubscribe();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      eventBus.off('LOAD_MORE_PROJECTS', handleLoadMore);
    };
  }, [user, projectLimit]);

  useEffect(() => {
    const saved = localStorage.getItem('RF_SETTINGS');
    if (saved) {
      try {
        setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }

    const savedTheme = localStorage.getItem('RF_THEME');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchStats = async () => {
      if (!isMounted) return;
      try {
        const res = await fetch('/api/system/stats', { signal: controller.signal });
        if (res.ok) {
           const data = await res.json();
           if (isMounted) {
             setSysStats({
               totalMem: data.totalMemoryStr || 'N/A',
               usedMem: data.usedMemoryStr || 'N/A',
               cpuLoad: data.cpuLoadPercent !== undefined ? String(data.cpuLoadPercent) : 'N/A'
             });
           }
        }
      } catch (e: any) {
        // Ignored in MD3 conversion
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    startStorageAudit();
    return () => {
      isMounted = false;
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('RF_THEME', newTheme ? 'dark' : 'light');
  };

  const renderNavButton = (item: any) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;
    return (
      <button
        key={item.id}
        onClick={() => navigate(item.path)}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full flex ${isSidebarOpen ? 'flex-row items-center px-4 justify-start' : 'flex-col items-center justify-center px-0'} py-3 gap-1 rounded-full transition-colors relative mb-1 min-h-[44px] ${
          isActive 
            ? 'bg-secondary-container text-on-secondary-container font-medium' 
            : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface font-normal'
        }`}
      >
        <span className={`flex items-center justify-center w-8 h-8 rounded-full ${isActive && !isSidebarOpen ? 'bg-secondary-container text-on-secondary-container' : ''}`}>
          <Icon className="w-6 h-6 shrink-0" />
        </span>
        <AnimatePresence mode="popLayout">
          {isSidebarOpen ? (
            <motion.span 
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
              className="ml-3 text-sm whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          ) : (
            <span className="text-[11px] leading-tight tracking-wide font-medium">
              {isActive ? item.label : ''}
            </span>
          )}
        </AnimatePresence>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-background text-on-background font-sans overflow-hidden transition-colors duration-300">
      {/* Material Design 3 Navigation Rail / Drawer */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        transition={{ type: 'tween', ease: [0.2, 0, 0, 1], duration: shouldReduceMotion ? 0 : 0.3 }}
        className="h-full bg-surface-container flex flex-col z-20 relative overflow-hidden shrink-0 border-r border-outline-variant"
      >
        <div className={`flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center'} min-h-[64px] gap-3 shrink-0 py-4`}>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-on-surface/5 text-on-surface transition-colors cursor-pointer shrink-0"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-medium text-title-large text-on-surface whitespace-nowrap overflow-hidden"
              >
                RetroForge
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Action Button (FAB) replacement for main action if needed, otherwise spacing */}
        <div className={`px-3 mb-4 flex ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}>
          <button className={`flex items-center justify-center gap-3 bg-primary-container text-on-primary-container rounded-[16px] hover:shadow-elevation-1 transition-all ${isSidebarOpen ? 'px-4 py-4 w-full justify-start' : 'w-14 h-14'}`}>
            <Plus className="w-6 h-6 shrink-0 text-primary" />
            {isSidebarOpen && <span className="font-medium">Novo Projeto</span>}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar pb-4" aria-label="Navegação Principal">
          {navItems.map(renderNavButton)}
        </nav>

        <div className="p-3 border-t border-outline-variant space-y-1 shrink-0 bg-surface-container">
          {secondaryNavItems.map(renderNavButton)}
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-surface">
        {/* Top App Bar (Material 3) */}
        <header className="h-[64px] flex items-center justify-between px-4 bg-surface text-on-surface z-10 shrink-0">
          <div className="flex items-center gap-4 text-label-medium text-on-surface-variant" aria-live="polite">
            <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-full">
               <Activity className="w-4 h-4 text-primary" />
               <span className="font-mono">{sysStats.cpuLoad}% CPU</span>
               <div className="w-[1px] h-3 bg-outline-variant mx-1" />
               <span className="font-mono">{sysStats.usedMem}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 flex-shrink-0" />
            </button>
            <button 
              onClick={toggleTheme}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>
            
            {user ? (
               <div className="relative group ml-2">
                 <button className="flex items-center gap-2 rounded-full hover:bg-surface-variant/50 p-1 pl-3 transition-colors">
                   <span className="text-label-medium font-medium max-w-[100px] truncate">{user.displayName || user.email}</span>
                   {user.photoURL ? (
                     <img src={user.photoURL} alt="User Avatar" className="w-10 h-10 rounded-full object-cover border border-outline-variant" referrerPolicy="no-referrer" />
                   ) : (
                     <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm">
                       {user.email?.[0].toUpperCase()}
                     </div>
                   )}
                 </button>
                 <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-surface-container-high rounded-xl shadow-elevation-3 border border-outline-variant opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                   <button onClick={logoutAndClearSession} className="w-full text-left px-4 py-2 text-body-medium hover:bg-surface-variant text-on-surface">
                     Sair
                   </button>
                 </div>
               </div>
            ) : (
               <button 
                 onClick={signInWithGoogle}
                 className="h-10 px-6 ml-2 rounded-full bg-primary text-on-primary font-medium hover:bg-primary/90 transition-colors shadow-elevation-1 flex items-center gap-2 text-label-large"
               >
                 Login
               </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-background rounded-tl-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] border-t border-l border-outline-variant">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4 md:p-8 h-full max-w-7xl mx-auto"
            >
                <ErrorBoundary>
                <Suspense fallback={
                  <div className="flex h-full items-center justify-center text-primary flex-col gap-4">
                    <Loader2 className="w-12 h-12 animate-spin" />
                    <span className="font-medium text-label-large tracking-widest uppercase text-on-surface-variant">Carregando Módulo</span>
                  </div>
                }>
                  <Routes>
                    <Route path="/" element={<ProjectDashboard activeProjectId={activeProjectId} onSelectProject={setActiveProjectId} onStartModding={() => navigate('/modding')} settings={settings} />} />
                    <Route path="/community" element={<CommunityHub />} />
                    <Route path="/ai" element={<AIAssistant activeProjectId={activeProjectId} settings={settings} />} />
                    <Route path="/training" element={<AIFineTuning />} />
                    <Route path="/translation" element={<TranslationStudio />} />
                    <Route path="/modding" element={<ModdingHub settings={settings} />} />
                    <Route path="/graphics" element={<GraphicsStudio />} />
                    <Route path="/geometry" element={<GeometryStudio />} />
                    <Route path="/audio" element={<AudioStudio />} />
                    <Route path="/settings" element={
                      <div className="max-w-2xl mx-auto space-y-8 pb-12">
                        <div className="space-y-2">
                          <h1 className="text-display-small font-normal text-on-background tracking-tight">Configurações</h1>
                          <p className="text-body-large text-on-surface-variant">Ajuste as ferramentas de recompilação e serviços integrados.</p>
                        </div>
                        
                        <div className="bg-surface-container-low rounded-3xl p-6 space-y-6 shadow-elevation-1">
                          <div className="flex items-center justify-between p-4 bg-primary-container text-on-primary-container rounded-2xl">
                            <div>
                              <h3 className="font-medium flex items-center gap-2 text-title-medium">
                                <BrainCircuit className="w-5 h-5 text-primary" />
                                Modelo de Nuvem Padrão
                              </h3>
                              <p className="text-body-medium mt-1 opacity-90">gemini-3.1-pro-preview (Conectado)</p>
                            </div>
                            <ShieldCheck className="w-8 h-8 text-primary" />
                          </div>
                          
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-label-large font-medium text-on-surface">Caminho do SDK (Global)</label>
                              <input 
                                type="text" 
                                value={settings.sdkPath}
                                onChange={(e) => setSettings({...settings, sdkPath: e.target.value})}
                                className="w-full bg-surface border border-outline rounded-xl p-4 text-body-large text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-label-large font-medium text-on-surface">Servidor IA Local (Ollama/LM Studio)</label>
                              <input 
                                type="text" 
                                value={settings.lmStudioUrl}
                                onChange={(e) => setSettings({...settings, lmStudioUrl: e.target.value})}
                                className="w-full bg-surface border border-outline rounded-xl p-4 text-body-large text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                placeholder="http://localhost:1234/v1"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-label-large font-medium text-on-surface">Prompt de Sistema Personalizado</label>
                              <textarea 
                                rows={4}
                                value={settings.customAiPrompt}
                                onChange={(e) => setSettings({...settings, customAiPrompt: e.target.value})}
                                className="w-full bg-surface border border-outline rounded-xl p-4 text-body-large text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                                placeholder="Descreva regras personalizadas para assistência..."
                              />
                            </div>
                            
                            <label className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-outline-variant cursor-pointer hover:bg-on-surface/5 transition-colors">
                              <div>
                                <p className="text-title-medium font-medium text-on-surface">Modo Turbo Automatizado</p>
                                <p className="text-body-medium text-on-surface-variant mt-1">Delega tarefas simples para IA Local e pesadas para Nuvem</p>
                              </div>
                              <div className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${settings.turboMode ? 'bg-primary' : 'bg-surface-variant border border-outline'}`}>
                                <div className={`w-6 h-6 bg-surface rounded-full transition-transform shadow-sm ${settings.turboMode ? 'translate-x-6' : 'translate-x-0'}`} />
                              </div>
                            </label>

                            <label className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-outline-variant cursor-pointer hover:bg-on-surface/5 transition-colors">
                              <div>
                                <p className="text-title-medium font-medium text-on-surface">Auto-save do Blueprint</p>
                                <p className="text-body-medium text-on-surface-variant mt-1">Salva modificações nos projetos automaticamente</p>
                              </div>
                              <div className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${settings.autoSave ? 'bg-primary' : 'bg-surface-variant border border-outline'}`}>
                                <div className={`w-6 h-6 bg-surface rounded-full transition-transform shadow-sm ${settings.autoSave ? 'translate-x-6' : 'translate-x-0'}`} />
                              </div>
                            </label>
                          </div>

                          <div className="flex items-center gap-4 pt-6">
                            <button 
                              onClick={() => {
                                localStorage.setItem('RF_SETTINGS', JSON.stringify(settings));
                                logger.info("Configurações salvas.");
                              }}
                              className="flex-1 py-4 bg-primary text-on-primary font-medium rounded-full hover:bg-primary/90 transition-colors shadow-elevation-1 hover:shadow-elevation-2 min-h-[44px]"
                            >
                              Salvar Alterações
                            </button>
                            <button 
                              onClick={() => setSettings({ lmStudioUrl: 'http://localhost:1234/v1', turboMode: true, autoSave: true, sdkPath: '/opt/retroforge-sdk', customAiPrompt: '' })}
                              className="px-8 py-4 border border-outline rounded-full hover:bg-on-surface/5 transition-colors text-primary font-medium min-h-[44px]"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      </div>
                    } />
                  </Routes>
                </Suspense>
                </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
