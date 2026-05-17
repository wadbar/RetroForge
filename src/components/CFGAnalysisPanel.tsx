import React, { useState, useMemo } from 'react';
import { CFGEngine, CFG } from '../../core/CFGEngine';
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
    <div className="flex flex-col gap-4 p-6 bg-[#141414] rounded-xl border border-white/5 h-full">
      <div className="flex justify-between items-center">
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-400" />
            Control Flow Analysis
        </h2>
        <button onClick={runAnalysis} className="px-4 py-1.5 bg-cyan-500/10 text-cyan-400 text-xs font-bold uppercase rounded border border-cyan-500/20 hover:bg-cyan-500/20 transition-all">
            Executar Análise
        </button>
      </div>

      {cfg ? (
        <>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-black/40 rounded border border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase block">Loops Identificados</span>
                    <span className="text-xl text-white font-mono font-bold">{cfg.metadata.loopCount}</span>
                </div>
                <div className="p-3 bg-black/40 rounded border border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase block">Chamadas Funções</span>
                    <span className="text-xl text-white font-mono font-bold">{cfg.metadata.callCount}</span>
                </div>
            </div>
            
            <div className="flex-1 min-h-[300px]">
                <CFGVisualizer nodes={cfg.nodes} links={cfg.links} />
            </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl text-gray-600 text-sm">
           <p className="flex items-center gap-2"><Activity className="w-4 h-4"/> Aguardando execução do motor de análise...</p>
        </div>
      )}
    </div>
  );
};
