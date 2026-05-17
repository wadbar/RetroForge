import React, { useState, useEffect } from 'react';
import { Cpu, Activity, RefreshCw, Play, Pause, StepForward, MessageSquare, Code, Loader2 } from 'lucide-react';
import { symbolicExecutionAssistant } from '../../services/aiDecompilerService';
import Markdown from 'react-markdown';

interface CPUStateViewProps {
  arch: string;
  asmCode?: string;
  settings?: any;
}

export const CPUStateView: React.FC<CPUStateViewProps> = ({ arch, asmCode = '', settings }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [pcIndex, setPcIndex] = useState(0);
  const [instructions, setInstructions] = useState<{line: string, address: string}[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [registers, setRegisters] = useState<Record<string, string>>(() => {
    if (arch.includes('MIPS')) {
      return {
        '$zero': '00000000', '$at': '00000000', '$v0': '00000000', '$v1': '00000000',
        '$a0': '8005A320', '$a1': '00000001', '$a2': '00000000', '$a3': '00000000',
        '$t0': '00000000', '$t1': '00000000', '$t2': '00000000', '$t3': '00000000',
        '$s0': '80100000', '$s1': '00000000', '$s2': '00000000', '$s3': '00000000',
        '$sp': '801FFFF0', '$fp': '801FFFF0', '$ra': '80010044', 'pc': '80010010'
      };
    } else {
      return {
        'EAX': '00000000', 'EBX': '00000000', 'ECX': '00000000', 'EDX': '00000000',
        'ESI': '00000000', 'EDI': '00000000', 'ESP': '0019FFCC', 'EBP': '0019FFD8',
        'EIP': '00401000', 'EFLAGS': '00000246'
      };
    }
  });

  useEffect(() => {
    // Parse asmCode into non-empty lines
    const lines = asmCode.split('\n').filter(l => l.trim().length > 0);
    // Dummy base addresses for the UI
    let baseAddr = arch.includes('MIPS') ? 0x80010010 : 0x00401000;
    const insts = lines.map(line => {
       const addr = baseAddr.toString(16).toUpperCase().padStart(8, '0');
       baseAddr += 4;
       return { line, address: addr };
    });
    setInstructions(insts);
    setPcIndex(0);
    setAiAnalysis('');
  }, [asmCode, arch]);

  useEffect(() => {
     if (instructions.length > 0 && pcIndex < instructions.length && registers) {
         setRegisters(prev => {
             const next = { ...prev };
             if ('pc' in next) next['pc'] = instructions[pcIndex].address;
             if ('EIP' in next) next['EIP'] = instructions[pcIndex].address;
             return next;
         });
     }
  }, [pcIndex, instructions]);

  const handleStep = () => {
    if (pcIndex < instructions.length - 1) {
      setPcIndex(prev => prev + 1);
      setAiAnalysis('');
    }
  };

  const handleReset = () => {
    setPcIndex(0);
    setAiAnalysis('');
    setIsRunning(false);
  };

  const askAiContext = async () => {
      if (pcIndex >= instructions.length) return;
      setIsAnalyzing(true);
      const inst = instructions[pcIndex].line;
      try {
          // Add context: the previous lines and next lines to give the AI an idea
          const start = Math.max(0, pcIndex - 3);
          const end = Math.min(instructions.length, pcIndex + 4);
          const contextCode = instructions.slice(start, end).map((it, i) => `[${start + i === pcIndex ? 'CURRENT -> ' : ''}${it.address}] ${it.line}`).join('\n');
          
          const analysis = await symbolicExecutionAssistant(
             `Analyze this instruction conceptually within its block:\n${contextCode}`, 
             { registers, currentInstructionIndex: pcIndex }, 
             arch, 
             settings
          );
          setAiAnalysis(analysis);
      } catch (e: any) {
          setAiAnalysis(`**Error:** ${e.message}`);
      } finally {
          setIsAnalyzing(false);
      }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 bg-[#0a0a0a] gap-6">
       <div className="flex justify-between items-center shrink-0">
         <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            Visual Debugger & CPU State ({arch})
         </div>
         <div className="flex items-center gap-4">
           <button 
              onClick={() => setIsRunning(!isRunning)}
              className={`px-3 py-1 border rounded text-[10px] font-bold transition-all flex items-center gap-2 ${isRunning ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'}`}
           >
             {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
             {isRunning ? 'PAUSE' : 'RUN LOGIC'}
           </button>
           <button 
              onClick={handleStep}
              className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 rounded text-[10px] transition-all flex items-center gap-2 font-bold uppercase"
           >
             <StepForward className="w-3 h-3" /> STEP
           </button>
           <button 
              onClick={handleReset}
              className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-400 hover:bg-white/10 transition-all flex items-center gap-1 uppercase font-bold"
           >
             <RefreshCw className="w-3 h-3" /> RESET
           </button>
         </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden">
          {/* Instructions Panel */}
          <div className="flex flex-col border border-white/5 bg-[#141414] rounded-xl overflow-hidden shadow-inner">
             <div className="p-3 border-b border-white/5 bg-black/40 flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">
               <div className="flex items-center gap-2">
                 <Code className="w-4 h-4 text-cyan-500" />
                 Disassembly View
               </div>
               <span className="text-[9px] text-gray-600 font-mono">PC: {instructions[pcIndex]?.address || '----'}</span>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar p-2 font-mono text-xs">
                {instructions.map((inst, index) => {
                   const isActive = index === pcIndex;
                   return (
                      <div 
                         key={index}
                         className={`flex gap-4 px-3 py-1 rounded cursor-pointer ${isActive ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'}`}
                         onClick={() => setPcIndex(index)}
                      >
                         <span className={isActive ? 'text-cyan-500' : 'text-gray-600'}>0x{inst.address}</span>
                         <span>{inst.line}</span>
                      </div>
                   )
                })}
                {instructions.length === 0 && (
                   <div className="p-4 flex flex-col items-center justify-center opacity-30 text-center h-full">
                      <Code className="w-8 h-8 mb-2" />
                      <span>No instructions loaded.</span>
                      <span className="text-[10px]">Load ASM code in the decompiler to debug.</span>
                   </div>
                )}
             </div>
          </div>

          <div className="flex flex-col gap-6 h-full min-h-0 overflow-hidden">
             {/* Registers Panel */}
             <div className="flex flex-col shrink-0 border border-white/5 bg-[#141414] rounded-xl overflow-hidden shadow-inner max-h-[40%]">
               <div className="p-3 border-b border-white/5 bg-black/40 flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">
                 <Activity className="w-4 h-4 text-purple-400" />
                 Registers
               </div>
               <div className="p-4 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar">
                  {Object.entries(registers).map(([reg, val]) => {
                    const isPC = reg === 'pc' || reg === 'EIP';
                    return (
                      <div key={reg} className={`bg-black/40 border p-2 rounded flex flex-col gap-1 transition-colors ${isPC ? 'border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'border-white/5 hover:border-purple-500/30'}`}>
                         <span className={`text-[9px] uppercase font-bold ${isPC ? 'text-cyan-500' : 'text-gray-500'}`}>{reg}</span>
                         <span className={`text-xs font-mono break-all ${isPC ? 'text-cyan-300' : 'text-purple-400'}`}>0x{val}</span>
                      </div>
                    );
                  })}
               </div>
             </div>

             {/* AI Contextual Debugger */}
             <div className="flex flex-col flex-1 border border-cyan-500/20 bg-[#141414] rounded-xl overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.05)] relative">
               <div className="p-3 border-b border-cyan-500/20 bg-black/40 flex justify-between items-center text-xs font-bold text-cyan-400 uppercase tracking-widest shrink-0">
                 <div className="flex items-center gap-2">
                   <MessageSquare className="w-4 h-4 text-cyan-500" />
                   AI Semantic Execution
                 </div>
                 <button 
                    onClick={askAiContext}
                    disabled={isAnalyzing || instructions.length === 0}
                    className="px-3 py-1 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-black border border-cyan-500/30 rounded text-[9px] transition-all font-bold uppercase disabled:opacity-50 flex items-center gap-2"
                 >
                    {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ANALYZE STATE'}
                 </button>
               </div>
               
               <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                  {isAnalyzing ? (
                     <div className="flex flex-col items-center justify-center h-full gap-4 opacity-70">
                        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                        <span className="text-[10px] text-cyan-400 tracking-widest font-mono uppercase">Deciphering Context & Registers...</span>
                     </div>
                  ) : aiAnalysis ? (
                     <div className="markdown-body font-sans text-sm text-gray-300">
                           <Markdown>{aiAnalysis}</Markdown>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30 text-center">
                        <MessageSquare className="w-8 h-8 text-cyan-500" />
                        <span className="text-xs text-gray-400 font-mono">Click "Analyze State" to use AI symbolic execution <br/> on current instruction context.</span>
                     </div>
                  )}
               </div>
             </div>
          </div>
       </div>
    </div>
  );
};

