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
  Activity
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

import { Container, SERVICES } from './core/di/Container';
import { logger } from './services/loggerService';
import { monitor } from './services/monitorService';
import { eventBus } from './services/eventBus';
import { storage } from './services/storageService';
import { eventLogger } from './services/eventLogger';
import { configService } from './services/configService';
import './services/selfHealingService';
import { projectService } from './services/projectService';

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const navItems = useMemo(() => [
    { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'community', path: '/community', label: 'Comunidade (GitHub)', icon: Github },
    { id: 'ai', path: '/ai', label: 'IA Assistente', icon: MessageSquare },
    { id: 'training', path: '/training', label: 'Treinar IA', icon: BrainCircuit },
    { id: 'translation', path: '/translation', label: 'Tradução', icon: Languages },
    { id: 'modding', path: '/modding', label: 'Modding & Hacks', icon: Wrench },
    { id: 'graphics', path: '/graphics', label: 'Gráficos (VRAM)', icon: ImageIcon },
    { id: 'geometry', path: '/geometry', label: 'Geometria 3D', icon: Box },
    { id: 'audio', path: '/audio', label: 'Áudio & SFX', icon: MusicIcon },
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

  useEffect(() => {
    const saved = localStorage.getItem('RF_SETTINGS');
    if (saved) {
      try {
        setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
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
        if (e.name === 'AbortError') return;
        if (isMounted) {
          console.error("[TELEMETRIA] Failed to fetch stats", e?.message || e);
        }
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  const sidebarTransition = {
    type: 'tween',
    ease: 'easeInOut',
    duration: shouldReduceMotion ? 0 : 0.4
  } as const;

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-gray-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        transition={sidebarTransition}
        className="border-r border-white/10 bg-[#0F0F0F] flex flex-col z-20 relative overflow-hidden"
      >
        <div className="p-6 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)] shrink-0">
            <Cpu className="text-black w-5 h-5" />
          </div>
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.span 
                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.95 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
                className="font-bold tracking-tight text-white text-lg whitespace-nowrap"
              >
                RetroForge <span className="text-cyan-400">AI</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto no-scrollbar" aria-label="Navegação Principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-4 p-3 rounded-lg transition-all group relative ${
                  isActive 
                    ? 'bg-cyan-500/10 text-cyan-400' 
                    : 'hover:bg-white/5 text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-cyan-400' : 'group-hover:text-gray-300'}`} />
                <AnimatePresence mode="popLayout">
                  {isSidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0, x: -5, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -5, scale: 0.98 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
                      className="font-medium whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div 
                    layoutId="activeIndicator"
                    className="absolute left-0 w-1 h-6 bg-cyan-500 rounded-r-full shadow-[0_0_8px_rgba(6,182,212,1)]" 
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-4 shrink-0 bg-[#0F0F0F]">
          <div className={`${!isSidebarOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'} transition-all duration-300`}>
             <HealthDashboard />
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? "Recolher Painel" : "Expandir Painel"}
            aria-expanded={isSidebarOpen}
            className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg text-gray-500 transition-colors"
          >
            <ChevronRight className={`w-5 h-5 transition-transform duration-500 ${isSidebarOpen ? 'rotate-180' : ''}`} />
            {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-widest">Recolher Painel</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background Ambient Effect */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] pointer-events-none -z-10" />

        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0A0A0A]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4 text-xs font-mono text-gray-500" aria-live="polite" aria-atomic="true">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-green-500" />
               CPU: <span className="text-white">{sysStats.cpuLoad}%</span>
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3" />
              MEM: <span className="text-white">{sysStats.usedMem}</span> / {sysStats.totalMem}
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className={`flex items-center gap-2 ${aiStatus.local === 'Online' ? 'text-purple-400' : 'text-gray-600'}`}>
              <Terminal className="w-3 h-3" /> Local AI: {aiStatus.local}
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className={`flex items-center gap-2 ${aiStatus.cloud === 'Connected' ? 'text-cyan-400' : 'text-gray-600'}`}>
              <BrainCircuit className="w-3 h-3" /> Cloud AI: {aiStatus.cloud}
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <select 
              className="bg-black border border-white/10 text-gray-300 px-3 py-1 rounded outline-none hover:border-gray-500 transition-colors cursor-pointer"
              value={settings.turboMode ? "turbo" : "offline"}
              onChange={(e) => setSettings({...settings, turboMode: e.target.value === 'turbo'})}
              aria-label="Selecionar modo de operação da IA"
            >
              <option value="turbo">Modo Turbo</option>
              <option value="offline">Modo Desconectado</option>
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-8 h-full"
            >
                <ErrorBoundary>
                <Suspense fallback={
                  <div className="flex h-full items-center justify-center text-cyan-500 flex-col gap-4">
                    <Loader2 className="w-12 h-12 animate-spin" />
                    <span className="font-mono text-sm tracking-widest uppercase">Carregando Módulo...</span>
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
                      <div className="max-w-2xl mx-auto space-y-8">
                        <div className="space-y-2">
                          <h1 className="text-3xl font-bold text-white">Configurações</h1>
                          <p className="text-gray-500">Ajuste as ferramentas de recompilação e IA.</p>
                        </div>
                        
                        <div className="bg-[#141414] border border-white/5 rounded-xl p-6 space-y-6">
                          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                            <div>
                              <h3 className="text-white font-medium flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4 text-cyan-400" />
                                Modelo de Nuvem Padrão
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">gemini-3.1-pro-preview (Conectado)</p>
                            </div>
                            <ShieldCheck className="w-6 h-6 text-green-400" />
                          </div>
                          
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Caminho do SDK de Recompilação (Global)</label>
                              <input 
                                type="text" 
                                value={settings.sdkPath}
                                onChange={(e) => setSettings({...settings, sdkPath: e.target.value})}
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm font-mono text-cyan-400 outline-none focus:border-cyan-500 transition-colors"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Servidor de IA Local (LM Studio / Ollama)</label>
                              <input 
                                type="text" 
                                value={settings.lmStudioUrl}
                                onChange={(e) => setSettings({...settings, lmStudioUrl: e.target.value})}
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm font-mono text-cyan-400 outline-none focus:border-cyan-500 transition-colors"
                                placeholder="http://localhost:1234/v1"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Prompt de Sistema Personalizado (IA Assistant)</label>
                              <textarea 
                                rows={3}
                                value={settings.customAiPrompt}
                                onChange={(e) => setSettings({...settings, customAiPrompt: e.target.value})}
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm font-sans text-gray-300 outline-none focus:border-purple-500 transition-colors resize-none"
                                placeholder="Ex: Responda sempre em tom brutalista e foque em otimização de ciclos de processador..."
                              />
                            </div>
                            
                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                              <div>
                                <p className="text-sm font-bold text-gray-300">Modo Turbo Automatizado</p>
                                <p className="text-xs text-gray-500 mt-1">Delega tarefas simples para IA Local e pesadas para Nuvem</p>
                              </div>
                              <button 
                                onClick={() => setSettings({...settings, turboMode: !settings.turboMode})}
                                className={`w-12 h-6 rounded-full transition-colors relative ${settings.turboMode ? 'bg-cyan-500' : 'bg-gray-700'}`}
                              >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.turboMode ? 'translate-x-6' : 'translate-x-0'}`} />
                              </button>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                              <div>
                                <p className="text-sm font-bold text-gray-300">Auto-save do Blueprint</p>
                                <p className="text-xs text-gray-500 mt-1">Salva as extrações nos projetos a cada 5 segundos</p>
                              </div>
                              <button 
                                onClick={() => setSettings({...settings, autoSave: !settings.autoSave})}
                                className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoSave ? 'bg-cyan-500' : 'bg-gray-700'}`}
                              >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.autoSave ? 'translate-x-6' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                            <button 
                              onClick={() => {
                                localStorage.setItem('RF_SETTINGS', JSON.stringify(settings));
                                logger.info("Configurações salvas no perfil global.");
                              }}
                              className="flex-1 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              SALVAR ALTERAÇÕES
                            </button>
                            <button 
                              onClick={() => setSettings({ lmStudioUrl: 'http://localhost:1234/v1', turboMode: true, autoSave: true, sdkPath: '/opt/retroforge-sdk', customAiPrompt: '' })}
                              className="px-6 py-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-white font-bold"
                            >
                              RESET
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
    </div>
  );
}
