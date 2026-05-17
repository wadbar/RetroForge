import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, Cpu, Radio, Trash2, Zap, CheckCircle2, AlertTriangle, XCircle, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, AreaChart, Area } from 'recharts';
import { monitor } from '../../services/monitorService';
import { SystemHealth, SystemStatus } from '../../core/types';
import { eventBus } from '../../services/eventBus';

/**
 * HealthDashboard - Real-time observability UI for internal system state.
 * Subscribes to architectural events for live telemetry.
 */
export const HealthDashboard: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth>(monitor.getHealthData());
  const [recentEvents, setRecentEvents] = useState<{name: string, time: string}[]>([]);
  const [chartData, setChartData] = useState<{val: number}[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentHealth = monitor.getHealthData();
      setHealth(currentHealth);
      
      // Update real-time chart
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
    
    // Store handlers for unsubscription
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

  const getStatusColor = (status: SystemStatus) => {
    switch (status) {
      case SystemStatus.OPTIMAL: return 'text-green-400';
      case SystemStatus.DEGRADED: return 'text-yellow-400';
      case SystemStatus.CRITICAL: return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/80 border border-white/10 rounded-2xl p-6 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50" />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          <h3 className="text-white font-bold tracking-tight uppercase text-xs">Architectural Feed</h3>
        </div>
        <div className={`flex items-center gap-2 text-[10px] font-bold ${getStatusColor(health.status)}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
          {health.status.toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard 
          icon={<Cpu className="w-3 h-3 text-purple-400" />} 
          label="Ops/Cycle" 
          value={health.operationsCount.toString()} 
        />
        <StatCard 
          icon={<ShieldAlert className="w-3 h-3 text-orange-400" />} 
          label="Sanity" 
          value={health.lastError ? "ERR" : "OK"} 
          color={health.lastError ? "text-red-400" : "text-green-400"}
        />
        <StatCard 
          icon={<Activity className="w-3 h-3 text-green-400" />} 
          label="Latency" 
          value={health.metrics.latency.length > 0 ? `${Math.round(health.metrics.latency.reduce((a, b) => a + b, 0) / health.metrics.latency.length)}ms` : "IDLE"} 
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6">
        <ServiceIndicator name="AI Engine" status={monitor.getServiceStatus('AI_COMPILATION')} />
        <ServiceIndicator name="Binary Processor" status={monitor.getServiceStatus('BINARY_SCAN')} />
        <ServiceIndicator name="Event Bus" status={SystemStatus.OPTIMAL} />
        <ServiceIndicator name="Persistence" status={monitor.getServiceStatus('STORAGE')} />
      </div>

      <div className="mb-6 h-[100px] w-full bg-white/5 rounded-xl border border-white/5 overflow-hidden p-2">
        <div className="flex items-center gap-1.5 mb-2 text-[9px] text-gray-500 font-bold uppercase pl-1">
          <TrendingUp className="w-2.5 h-2.5" />
          Latency Pulse (ms)
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="val" 
              stroke="#22d3ee" 
              fillOpacity={1} 
              fill="url(#colorVal)" 
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {monitor.getHealingHistory().length > 0 && (
        <div className="mb-6 p-3 bg-red-900/10 border border-red-900/20 rounded-lg">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <Zap className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Auto-Recoveries</span>
          </div>
          <div className="space-y-1.5">
            {monitor.getHealingHistory().slice(-3).reverse().map((h, i) => (
              <div key={i} className="text-[9px] text-gray-400 flex justify-between font-mono">
                <span className="text-red-300/70">{h.origin}</span>
                <span className="opacity-50">{new Date(h.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex justify-between items-center text-[9px] text-gray-500 font-bold uppercase mb-1">
          <span>Recent Dispatch</span>
          <Trash2 className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setRecentEvents([])} />
        </div>
        <div className="bg-black/40 rounded-lg p-2 font-mono text-[9px] text-gray-400 border border-white/5 min-h-[60px] flex flex-col gap-1.5">
           <AnimatePresence>
             {recentEvents.length === 0 && <span className="opacity-30">Monitoring bus traffic...</span>}
             {recentEvents.map((ev, i) => (
               <motion.div 
                 key={i + ev.time}
                 initial={{ opacity: 0, x: -5 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="flex justify-between items-center border-l-2 border-cyan-500/30 pl-2"
               >
                 <span className="text-cyan-400">{ev.name}</span>
                 <span className="opacity-50">{ev.time}</span>
               </motion.div>
             ))}
           </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

const ServiceIndicator = ({ name, status }: { name: string, status: SystemStatus }) => {
  const getIcon = () => {
    switch (status) {
      case SystemStatus.OPTIMAL: return <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />;
      case SystemStatus.DEGRADED: return <AlertTriangle className="w-2.5 h-2.5 text-yellow-500" />;
      case SystemStatus.CRITICAL: return <XCircle className="w-2.5 h-2.5 text-red-500" />;
    }
  };

  return (
    <div className="bg-white/5 border border-white/5 rounded-lg p-2 flex items-center justify-between">
      <span className="text-[9px] text-gray-400 font-medium">{name}</span>
      {getIcon()}
    </div>
  );
};

const StatCard = ({ icon, label, value, color = "text-white" }: { icon: React.ReactNode, label: string, value: string, color?: string }) => (
  <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{label}</span>
    </div>
    <span className={`text-lg font-mono font-bold ${color}`}>{value}</span>
  </div>
);
