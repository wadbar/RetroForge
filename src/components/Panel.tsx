import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, Cpu, Radio, Trash2, Zap, CheckCircle2, AlertTriangle, XCircle, TrendingUp, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, AreaChart, Area } from 'recharts';
import { monitor } from '../../services/monitorService';
import { SystemHealth, SystemStatus } from '../../core/types';
import { eventBus } from '../../services/eventBus';

export const Panel: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth>(monitor.getHealthData());
  const [recentEvents, setRecentEvents] = useState<{name: string, time: string}[]>([]);
  const [chartData, setChartData] = useState<{val: number}[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('RF_THEME');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
    }

    const interval = setInterval(() => {
      const currentHealth = monitor.getHealthData();
      setHealth(currentHealth);
      setChartData(prev => {
        const lastLat = currentHealth.metrics.latency[currentHealth.metrics.latency.length - 1] || 0;
        const newData = [...prev, { val: lastLat }];
        return newData.slice(-15);
      });
    }, 2000);

    const handleEvent = (_data: any, name: string) => {
      setRecentEvents(prev => [{ name, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
    };

    const subs = ["ROM_LOADED", "AI_ANALYSIS_COMPLETE", "PATCH_GENERATED", "SCAN_PERFORMED", "SELF_HEALING_REQUIRED"];
    const handlers: Record<string, (data: any) => void> = {};
    subs.forEach(s => {
       handlers[s] = (data) => handleEvent(data, s);
       eventBus.on(s, handlers[s]);
    });

    return () => {
      clearInterval(interval);
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
        className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-3xl p-6 md:p-8 shadow-elevation-2 overflow-hidden flex flex-col"
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
              className="p-3 bg-surface-variant text-on-surface-variant rounded-full hover:bg-on-surface/10 transition-colors"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
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
              <button className="p-2 hover:bg-surface-variant rounded-full transition-colors text-on-surface-variant hover:text-error" onClick={() => setRecentEvents([])}>
                 <Trash2 className="w-4 h-4" />
              </button>
            </h3>
            <div className="bg-surface-container-high rounded-3xl p-4 border border-outline-variant flex-1 min-h-[140px] flex flex-col gap-2">
               <AnimatePresence>
                 {recentEvents.length === 0 && <span className="text-body-medium text-on-surface-variant p-2">Monitoring bus traffic...</span>}
                 {recentEvents.map((ev, i) => (
                   <motion.div 
                     key={i + ev.time}
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     className="flex justify-between items-center bg-surface p-3 rounded-2xl border-l-4 border-primary shadow-sm"
                   >
                     <span className="text-label-large font-medium text-on-surface">{ev.name}</span>
                     <span className="text-label-medium text-on-surface-variant">{ev.time}</span>
                   </motion.div>
                 ))}
               </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="h-[200px] w-full bg-surface-container-high rounded-3xl border border-outline-variant overflow-hidden p-6 relative">
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
    <div className="bg-surface-container-high border border-outline-variant rounded-2xl p-4 flex items-center justify-between hover:shadow-elevation-1 transition-shadow">
      <span className="text-label-large text-on-surface font-medium">{name}</span>
      {getIcon()}
    </div>
  );
};

const StatCard = ({ icon, label, value, color = "text-on-surface" }: { icon: React.ReactNode, label: string, value: string, color?: string }) => (
  <div className="bg-surface-container-high border border-outline-variant rounded-3xl p-6 flex flex-col gap-3 hover:shadow-elevation-1 transition-all">
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-label-medium text-on-surface-variant font-bold uppercase tracking-wider">{label}</span>
    </div>
    <span className={`text-display-small font-medium ${color}`}>{value}</span>
  </div>
);
