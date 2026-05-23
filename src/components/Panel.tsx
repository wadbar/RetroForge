import React, { useEffect, useState, useCallback } from 'react';
import { Activity, ShieldAlert, Cpu, Radio, Trash2, Zap, CheckCircle2, AlertTriangle, XCircle, TrendingUp, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, AreaChart, Area } from 'recharts';
import { monitor } from '../services/monitorService';
import { SystemHealth, SystemStatus } from '../core/types';
import { eventBus } from '../services/eventBus';

export const Panel: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth>(monitor.getHealthData());
  const [recentEvents, setRecentEvents] = useState<{name: string, time: string}[]>([]);
  const [chartData, setChartData] = useState<{val: number}[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [modPresets, setModPresets] = useState<{name: string, payload: string}[]>([
    { name: 'Infinite Health', payload: 'EA EA EA' },
    { name: 'Max Coins', payload: 'FF FF 00 00' },
    { name: 'Unlock All Items', payload: '01 01 01 01' }
  ]);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetPayload, setNewPresetPayload] = useState('');
  const [presetError, setPresetError] = useState('');

  useEffect(() => {
    const savedPresets = localStorage.getItem('RF_MOD_PRESETS');
    if (savedPresets) {
      try {
        setModPresets(JSON.parse(savedPresets));
      } catch (e) {}
    }
  }, []);

  const savePreset = useCallback(() => {
    if (!newPresetName || !newPresetPayload) return;
    
    if (!/^[0-9A-Fa-f\s]+$/.test(newPresetPayload)) {
      setPresetError('Payload inv\u00e1lido: Use apenas caracteres hexadecimais e espa\u00e7os.');
      return;
    }
    setPresetError('');
    
    setModPresets(prev => {
      const newPresets = [...prev, { name: newPresetName, payload: newPresetPayload }];
      try {
        localStorage.setItem('RF_MOD_PRESETS', JSON.stringify(newPresets));
      } catch (e) {
        console.error("Failed to persist presets:", e);
      }
      return newPresets;
    });
    setNewPresetName('');
    setNewPresetPayload('');
  }, [newPresetName, newPresetPayload]);

  const deletePreset = useCallback((idx: number) => {
    setModPresets(prev => {
      const newPresets = prev.filter((_, i) => i !== idx);
      try {
        localStorage.setItem('RF_MOD_PRESETS', JSON.stringify(newPresets));
      } catch (e) {
        console.error("Failed to persist presets:", e);
      }
      return newPresets;
    });
  }, []);

  const deployPreset = useCallback((preset: {name: string, payload: string}) => {
    try {
      eventBus.emit('MOD_PRESET_DEPLOYED', preset);
    } catch (e) {
      console.error("Failed to deploy preset:", e);
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('RF_THEME');
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    if (savedTheme === 'dark' || (!savedTheme && mediaQuery.matches)) {
      setIsDarkMode(true);
    } else {
      setIsDarkMode(false);
    }

    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('RF_THEME')) {
        setIsDarkMode(e.matches);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    let isActive = true;
    let interval: NodeJS.Timeout | null = null;
    
    const tick = () => {
      if (!isActive) return;
      try {
        const currentHealth = monitor.getHealthData();
        setHealth(currentHealth);
        setChartData(prev => {
          const lastLat = currentHealth.metrics.latency[currentHealth.metrics.latency.length - 1] || 0;
          const newData = [...prev, { val: lastLat }];
          return newData.slice(-15);
        });
      } catch (error) {
        console.error("Monitor polling failed", error);
      }
    };

    interval = setInterval(tick, 2000);

    const handleEvent = (data: any, name: string) => {
      if (!isActive) return;
      setRecentEvents(prev => [{ name, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
    };

    const subs = ["ROM_LOADED", "AI_ANALYSIS_COMPLETE", "PATCH_GENERATED", "SCAN_PERFORMED", "SELF_HEALING_REQUIRED"];
    const handlers: Record<string, (data: any) => void> = {};
    
    subs.forEach(s => {
       handlers[s] = (data) => handleEvent(data, s);
       eventBus.on(s, handlers[s]);
    });

    return () => {
      isActive = false;
      if (interval) clearInterval(interval);
      subs.forEach(s => eventBus.off(s, handlers[s]));
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('RF_THEME', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('RF_THEME', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const getStatusColor = (status: SystemStatus) => {
    switch (status) {
      case SystemStatus.OPTIMAL: return 'text-primary';
      case SystemStatus.DEGRADED: return 'text-secondary';
      case SystemStatus.CRITICAL: return 'text-error';
      default: return 'text-on-surface-variant';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="m3-card flex flex-col"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-container rounded-2xl flex items-center justify-center">
              <Radio className="w-6 h-6 text-on-primary-container animate-pulse" />
            </div>
            <div>
              <h2 className="text-title-large text-on-surface font-medium">Server Panels</h2>
              <p className="text-body-medium text-on-surface-variant">Live telemetry and metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 bg-surface-variant rounded-full text-label-large font-bold ${getStatusColor(health.status)}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-ping" />
              {health.status.toUpperCase()}
            </div>
            <button 
              onClick={toggleTheme}
              className="m3-button-tonal flex items-center gap-2"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span className="hidden sm:inline">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard 
            icon={<Cpu className="w-5 h-5 text-primary" />} 
            label="Ops/Cycle" 
            value={health.operationsCount.toString()} 
          />
          <StatCard 
            icon={<ShieldAlert className="w-5 h-5" />} 
            label="Sanity Check" 
            value={health.lastError ? "ERR" : "OK"} 
            color={health.lastError ? "text-error" : "text-primary"}
          />
          <StatCard 
            icon={<Activity className="w-5 h-5 text-primary" />} 
            label="Latency" 
            value={health.metrics.latency.length > 0 ? `${Math.round(health.metrics.latency.reduce((a, b) => a + b, 0) / health.metrics.latency.length)}ms` : "IDLE"} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="flex flex-col gap-4">
            <h3 className="text-title-medium text-on-surface">Core Services</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ServiceIndicator name="AI Engine" status={monitor.getServiceStatus('AI_COMPILATION')} />
              <ServiceIndicator name="Binary Module" status={monitor.getServiceStatus('BINARY_SCAN')} />
              <ServiceIndicator name="Event Bus" status={SystemStatus.OPTIMAL} />
              <ServiceIndicator name="Persistence" status={monitor.getServiceStatus('STORAGE')} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-title-medium text-on-surface flex items-center justify-between">
              Recent Dispatches
              <button className="m3-button-tonal flex items-center gap-2" onClick={() => setRecentEvents([])}>
                 <Trash2 className="w-4 h-4" />
                 <span className="text-label-large">Clear</span>
              </button>
            </h3>
            <div className="m3-card !bg-surface-container-high !p-4 flex-1 min-h-[140px] flex flex-col gap-2">
               <AnimatePresence>
                 {recentEvents.length === 0 && <span className="text-body-medium text-on-surface-variant p-2">Monitoring bus traffic...</span>}
                 {recentEvents.map((ev, i) => (
                   <motion.div 
                     key={i + ev.time}
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     className="flex justify-between items-center bg-surface p-3 rounded-[16px] border-l-4 border-primary shadow-sm"
                   >
                     <span className="text-label-large font-medium text-on-surface">{ev.name}</span>
                     <span className="text-label-medium text-on-surface-variant">{ev.time}</span>
                   </motion.div>
                 ))}
               </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="h-[200px] w-full m3-card !bg-surface-container-high overflow-hidden relative !p-6">
          <div className="flex items-center gap-2 mb-4 text-label-large text-on-surface font-medium">
            <TrendingUp className="w-4 h-4 text-primary" />
            Latency Pulse (ms)
          </div>
          <div className="absolute inset-x-6 top-14 bottom-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--md-sys-color-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--md-sys-color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="val" 
                  stroke="var(--md-sys-color-primary)" 
                  fillOpacity={1} 
                  fill="url(#colorVal)" 
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {monitor.getHealingHistory().length > 0 && (
          <div className="mt-8 p-6 bg-error-container border border-[var(--md-sys-color-error)]/30 rounded-3xl">
            <div className="flex items-center gap-2 text-on-error-container mb-4">
              <Zap className="w-5 h-5" />
              <span className="text-title-medium font-bold">Auto-Recoveries</span>
            </div>
            <div className="space-y-3">
              {monitor.getHealingHistory().slice(-3).reverse().map((h, i) => (
                <div key={i} className="text-body-medium flex justify-between items-center bg-[var(--md-sys-color-error)]/10 p-3 rounded-2xl">
                  <span className="text-on-error-container font-medium">{h.origin}</span>
                  <span className="text-on-error-container/70">{new Date(h.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 m3-card !bg-surface-container-high !p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-title-medium text-on-surface">
            <Radio className="w-5 h-5 text-primary" />
            Quick Mod Presets (Patches Recorrentes)
          </div>
          <p className="text-body-medium text-on-surface-variant">Salvamento e envio r&aacute;pido de payloads predefinidos (ex: Infinite Health) para a engine de inje&ccedil;&atilde;o.</p>

          <div className="flex flex-col sm:flex-row gap-3">
             <input 
               type="text" 
               placeholder="Nome (ex: Infinite Health)" 
               className="m3-input flex-1"
               value={newPresetName}
               onChange={e => { setNewPresetName(e.target.value); setPresetError(''); }}
             />
             <input 
               type="text" 
               placeholder="Payload (apenas Hex e espaços)" 
               className="m3-input flex-1"
               value={newPresetPayload}
               onChange={e => {
                 const val = e.target.value;
                 setNewPresetPayload(val);
                 if (val && !/^[0-9A-Fa-f\s]+$/.test(val)) {
                   setPresetError('Payload inválido: Use apenas caracteres hexadecimais e espaços.');
                 } else {
                   setPresetError('');
                 }
               }}
             />
             <button 
               onClick={savePreset}
               disabled={!newPresetName || !newPresetPayload || Boolean(presetError)}
               className="m3-button-filled disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
             >
               Add Preset
             </button>
          </div>
          {presetError && (
             <p className="text-error text-body-small mt-2 px-2">{presetError}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {modPresets.map((preset, i) => (
              <div key={i} className="bg-surface border border-outline-variant rounded-[16px] p-4 flex flex-col gap-3 relative group">
                 <button onClick={() => deletePreset(i)} className="m3-button-tonal absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center" title="Remove Preset">
                   <Trash2 className="w-4 h-4" />
                 </button>
                 <div className="flex flex-col pr-6">
                    <span className="text-label-large font-bold text-on-surface">{preset.name}</span>
                    <span className="text-body-small text-on-surface-variant font-mono truncate">{preset.payload}</span>
                 </div>
                 <button 
                   onClick={() => deployPreset(preset)}
                   className="m3-button-tonal w-full mt-auto flex justify-center items-center gap-2"
                 >
                   <Zap className="w-4 h-4" /> Aplicar Mod
                 </button>
              </div>
            ))}
            {modPresets.length === 0 && (
              <div className="col-span-full p-6 text-center border border-dashed border-outline-variant rounded-[16px] text-on-surface-variant">
                Nenhum preset salvo. Adicione patches usando o formul&aacute;rio acima.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const ServiceIndicator = ({ name, status }: { name: string, status: SystemStatus }) => {
  const getIcon = () => {
    switch (status) {
      case SystemStatus.OPTIMAL: return <CheckCircle2 className="w-5 h-5 text-primary" />;
      case SystemStatus.DEGRADED: return <AlertTriangle className="w-5 h-5 text-secondary" />;
      case SystemStatus.CRITICAL: return <XCircle className="w-5 h-5 text-error" />;
    }
  };

  return (
    <div className="m3-card !bg-surface-container-high !p-4 flex items-center justify-between">
      <span className="text-label-large text-on-surface font-medium">{name}</span>
      {getIcon()}
    </div>
  );
};

const StatCard = ({ icon, label, value, color = "text-on-surface" }: { icon: React.ReactNode, label: string, value: string, color?: string }) => (
  <div className="m3-card !bg-surface-container-high flex flex-col gap-3">
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-label-medium text-on-surface-variant font-bold uppercase tracking-wider">{label}</span>
    </div>
    <span className={`text-display-small font-medium ${color}`}>{value}</span>
  </div>
);
