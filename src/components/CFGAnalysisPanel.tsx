import React, { useState, useMemo } from 'react';
import { CFGEngine, CFG } from '../core/CFGEngine';
import { CFGVisualizer } from './CFGVisualizer';
import { Activity, Brain, AlertTriangle } from 'lucide-react';

export const CFGAnalysisPanel: React.FC<{ assemblyCode: string }> = ({ assemblyCode }) => {
  const [cfg, setCfg] = useState<CFG | null>(null);

  const runAnalysis = () => {
    try {
      const result = CFGEngine.analyze(assemblyCode);
      setCfg(result);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8 bg-surface-container rounded-3xl border border-outline-variant h-full shadow-elevation-1">
      <div className="flex justify-between items-center bg-surface-container-high p-4 rounded-2xl border border-outline-variant shadow-sm">
        <h2 className="text-on-surface text-title-large font-medium flex items-center gap-3">
            <div className="p-3 bg-secondary-container rounded-xl shadow-sm">
              <Brain className="w-5 h-5 text-on-secondary-container" />
            </div>
            Control Flow Analysis
        </h2>
        <button onClick={runAnalysis} className="px-6 py-2.5 bg-secondary text-on-secondary text-label-large font-medium rounded-full hover:bg-secondary/90 transition-all shadow-elevation-1 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface">
            Executar Análise
        </button>
      </div>

      {cfg ? (
        <>
            <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-surface-container-highest rounded-3xl border border-outline-variant shadow-inner">
                    <span className="text-label-medium text-on-surface-variant uppercase tracking-widest block mb-2 font-bold">Loops Identificados</span>
                    <span className="text-display-small text-on-surface font-mono">{cfg.metadata.loopCount}</span>
                </div>
                <div className="p-6 bg-surface-container-highest rounded-3xl border border-outline-variant shadow-inner">
                    <span className="text-label-medium text-on-surface-variant uppercase tracking-widest block mb-2 font-bold">Chamadas Funções</span>
                    <span className="text-display-small text-on-surface font-mono">{cfg.metadata.callCount}</span>
                </div>
            </div>
            
            <div className="flex-1 min-h-[400px] border border-outline-variant rounded-3xl overflow-hidden bg-surface-container-highest shadow-inner">
                <CFGVisualizer nodes={cfg.nodes} links={cfg.links} />
            </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-outline-variant bg-surface-container-lowest rounded-3xl text-on-surface-variant gap-4 min-h-[400px]">
           <Activity className="w-12 h-12 opacity-20" />
           <p className="text-body-large text-on-surface-variant font-medium">Aguardando execução do motor de análise estrutural.</p>
        </div>
      )}
    </div>
  );
};
