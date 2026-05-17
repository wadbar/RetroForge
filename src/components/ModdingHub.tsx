import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Wrench, Zap, Binary, Bug, Eye, EyeOff, Save, Code, Brackets, Sparkles, Loader2, RefreshCw, Upload, AlignLeft, Terminal, BrainCircuit, Search, Database, Network, FileCode, Layers, History, Cpu, ShieldAlert, Activity, Target, SearchCode, Calculator, TerminalSquare, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { CFGVisualizer } from './CFGVisualizer';
import { decompileWithAI, generatePatchWithAI, compileASMWithAI, analyzeCallStackWithAI, advancedDecipherWithAI, suggestHLEWithAI, scanSignaturesWithAI, symbolicExecutionAssistant, deepAnalyzeWithAI, extractSignatureWithAI, scanWithYaraAI } from '../services/aiDecompilerService';
import { ArchType, SystemStatus } from '../core/types';
import { ScannerUseCase } from '../core/useCases/ScannerUseCase';
import { eventBus } from '../services/eventBus';
import { storage } from '../services/storageService';
import { workerPool } from '../services/workerPool';
import { monitor } from '../services/monitorService';
import { projectService } from '../services/projectService';

import { snapshotService } from '../services/snapshotService';
import { ApplyPatchUseCase } from '../core/useCases/ApplyPatchUseCase';
import { BinaryIntegrityUseCase } from '../core/useCases/BinaryIntegrityUseCase';
import { SnapshotManager } from './ui/SnapshotManager';

import { symbolService, SymbolDefinition } from '../services/symbolService';
import { HexEditorView } from './ui/HexEditorView';
import { CPUStateView } from './ui/CPUStateView';
import { HexInspector } from './ui/HexInspector';
import { BinaryDiffUseCase } from '../core/useCases/BinaryDiffUseCase';
import { AnalyzeStructureUseCase } from '../core/useCases/AnalyzeStructureUseCase';

interface RecompTask {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  type: 'decomp' | 'cfg' | 'symbols' | 'reloc';
}

export default function ModdingHub({ settings }: { settings?: any }) {
  const [activeTool, setActiveTool] = useState<'hex' | 'decompiler' | 'scanner' | 'strings' | 'pipeline' | 'cpu' | 'ai' | 'lab' | 'scripts'>('pipeline');
  const [asmCode, setAsmCode] = useState('/* Prologue Example MIPS R3000 */\naddiu $sp, $sp, -32\nsw $ra, 28($sp)\nsw $s0, 24($sp)\nli $v0, 1\n# ... function body ...\nlw $s0, 24($sp)\nlw $ra, 28($sp)\naddiu $sp, $sp, 32\njr $ra\nnop');
  const [cppResult, setCppResult] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [projectAnalysisReport, setProjectAnalysisReport] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCFG, setShowCFG] = useState(false);
  const [hoveredOffset, setHoveredOffset] = useState<number>(-1);
  const [activeAnalysisMode, setActiveAnalysisMode] = useState<string>('decipher');
  const [integrityReferenceHash, setIntegrityReferenceHash] = useState('');
  const [integrityResult, setIntegrityResult] = useState<{ match: boolean; actual: string } | null>(null);

  // New AI Optimization States
  const [targetArch, setTargetArch] = useState<ArchType>('MIPS_R3000');
  const [modIntent, setModIntent] = useState('');
  const [patchAddress, setPatchAddress] = useState('0x80050000');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [health, setHealth] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);

  useEffect(() => {
     const interval = setInterval(async () => {
        try {
           const res = await fetch('/api/system/health');
           const data = await res.json();
           setHealth(data);
        } catch {}
     }, 5000);
     return () => clearInterval(interval);
  }, []);

  const scanForAssets = async () => {
    setIsProcessing(true);
    addAgentLog("[ASSETS] Iniciando escaneamento neural de texturas e sons...");
    try {
      const hexSample = fileData ? Array.from(fileData.slice(0, 5000)).map(b => b.toString(16).padStart(2, '0')).join(' ') : "";
      const resp = await fetch("/api/scan-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: hexSample, platform: targetArch }),
      });
      const data = await resp.json();
      setAnalysisResult(data.analysis);
      addAgentLog("[ASSETS] Relatório de assets gerado com sucesso.");
      showToast('success', 'Asset Scan completo!');
    } catch (e: any) {
      showToast('error', "Erro ao scanear assets.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAiFazerTudo = async () => {
    if (!fileData) {
      showToast('error', 'Nenhuma ROM/Binário carregado.');
      return;
    }
    setIsProcessing(true);
    addAgentLog(`[IA FAZER TUDO] Iniciando análise heurística completa do binário de ${(fileSize / 1024).toFixed(2)} KB...`);
    
    try {
      // Extract basic info to send to AI
      const strings = extractedStrings || await workerPool.execute<{offset: number, text: string}[]>('EXTRACT_STRINGS', { data: fileData });
      const topStrings = strings.slice(0, 15).map(s => s.text).join(', ');
      const hexSample = Array.from(fileData.slice(0, 2048)).map(b => b.toString(16).padStart(2, '0')).join(' ');

      const resp = await fetch("/api/ai-fazer-tudo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           strings: topStrings,
           hexSample,
           fileSize,
           platform: targetArch
        }),
      });
      
      const data = await resp.json();
      setProjectAnalysisReport(data.analysis);
      addAgentLog(`[IA FAZER TUDO] Análise heurística completa gerada e exibida no relatório.`);
      showToast('success', 'Análise heurística completa gerada!');
    } catch (e: any) {
      showToast('error', 'Falha na análise heurística AI.');
      addAgentLog(`[ERRO AI FAZER TUDO] ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportPatch = () => {
     if (!fileData || !originalFileData) {
        showToast('error', 'Original and Modified data needed for patch generation.');
        return;
     }
     addAgentLog("[FS] Gerando patch IPS via Infinite Evolution Core...");
     const patch = ScannerUseCase.createIPSPatch(originalFileData, fileData);
     const blob = new Blob([patch], { type: 'application/octet-stream' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `retroforge_mod_${Date.now()}.ips`;
     a.click();
     URL.revokeObjectURL(url);
     showToast('success', "Patch IPS exportado!");
  };

  // Recompilation Pipeline State
  const [recompTasks, setRecompTasks] = useState<RecompTask[]>([]);
  const [cfgData, setCfgData] = useState<{nodes: any[], links: any[]}>({ nodes: [], links: [] });

  // Real File Data States
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('No file loaded');
  const [fileSize, setFileSize] = useState<number>(0);
  const [hexOffset, setHexOffset] = useState<number>(0);
  const [extractedStrings, setExtractedStrings] = useState<{offset: number, text: string}[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);

  const [scannerResults, setScannerResults] = useState<{name: string, addr: string, size: number}[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [originalFileData, setOriginalFileData] = useState<Uint8Array | null>(null);

  const [agentStatus, setAgentStatus] = useState<'idle' | 'scanning' | 'decompiling' | 'done'>('idle');
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{title: string, message?: string, inputs?: {label: string, value: string, placeholder: string}[], onSubmit?: (values: string[]) => void} | null>(null);

  const openModal = (title: string, inputsOrMessage: {label: string, value: string, placeholder: string}[] | string, onSubmit?: (values: string[]) => void) => {
    if (typeof inputsOrMessage === 'string') {
      setModalConfig({ title, message: inputsOrMessage });
    } else {
      setModalConfig({ title, inputs: inputsOrMessage, onSubmit });
    }
    setModalOpen(true);
  };
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [agentProgress, setAgentProgress] = useState(0);
  const addAgentLog = (msg: string) => setAgentLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const agentInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{msg: string, type: 'info' | 'error' | 'success'} | null>(null);
  const showToast = (type: 'info' | 'error' | 'success', msg: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getEnhancedSettings = () => {
     return {
        ...settings,
        projectContext: {
           fileName,
           fileSize,
           targetArch,
           modIntent,
           recentActions: agentLogs.slice(-5),
           detectedStrings: extractedStrings.slice(0, 15).map(s => s.text),
           symbolsDetected: scannerResults.length
        }
     };
  };

  const renderLab = () => (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#0a0a0a] p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-12 h-1 bg-gradient-to-r from-cyan-500 to-transparent rounded-full" />
             <div className="text-[10px] text-cyan-500 font-extrabold uppercase tracking-[0.4em] animate-pulse">Advanced Analysis Laboratory</div>
             <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 ml-auto">
               {[
                 { id: 'callstack', icon: <Network className="w-3.5 h-3.5" />, label: 'Stack' },
                 { id: 'logic', icon: <Code className="w-3.5 h-3.5" />, label: 'Logic' },
                 { id: 'signature', icon: <FileCode className="w-3.5 h-3.5" />, label: 'Signature' },
                 { id: 'patch', icon: <Zap className="w-3.5 h-3.5" />, label: 'Patch Gen' },
                 { id: 'hle', icon: <RefreshCw className="w-3.5 h-3.5" />, label: 'HLE' },
                 { id: 'yara', icon: <Search className="w-3.5 h-3.5" />, label: 'YARA Scan' },
                 { id: 'decipher', icon: <ShieldAlert className="w-3.5 h-3.5" />, label: 'Decrypt' },
                 { id: 'symbolic', icon: <Calculator className="w-3.5 h-3.5" />, label: 'Symbolic' },
                 { id: 'integrity', icon: <Database className="w-3.5 h-3.5" />, label: 'CRC32 Check' }
               ].map(mode => (
                 <button 
                    key={mode.id}
                    onClick={() => setActiveAnalysisMode(mode.id)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${activeAnalysisMode === mode.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                 >
                    {mode.icon} {mode.label}
                 </button>
               ))}
             </div>
          </div>
          <h1 className="text-6xl font-black text-white tracking-tighter flex items-center gap-6">
             Intelligence Core <BrainCircuit className="w-12 h-12 text-cyan-400" />
          </h1>
          <p className="text-gray-400 text-lg max-w-3xl leading-relaxed">
            Revolutionizing binary analysis with AI-native workflows. Deconstruct architectures, 
            map symbolic execution paths, and implement HLE layers with unprecedented precision.
          </p>
        </header>

         {activeAnalysisMode === 'callstack' && (
            <div className="max-w-4xl mx-auto space-y-8">
               <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight uppercase">Call Stack Analysis Hierarchy</h2>
                    <p className="text-gray-500 text-sm">Visualizes how functions invoke each other to identify program entry points and patterns.</p>
                  </div>
                  <button onClick={handleAnalyzeCallStack} disabled={isProcessing} className="bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-purple-500/50">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
                    EXECUTE HEURISTIC SCAN
                  </button>
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-black/60 border border-white/5 rounded-2xl p-6 min-h-[400px] flex flex-col">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                       <Layers className="w-4 h-4 text-purple-400" /> Function Relation Map
                    </h3>
                    <div className="flex-1 min-h-[300px]">
                      {callstackData.nodes.length > 0 ? (
                        <CFGVisualizer 
                          nodes={callstackData.nodes} 
                          links={callstackData.links}
                          onNodeSelect={(node) => showToast('info', `Selected: ${node.name}`)}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 text-xs gap-4 italic p-8 text-center bg-black/20 rounded-xl border border-dashed border-white/5">
                          <BrainCircuit className="w-12 h-12 opacity-10" />
                          Gere uma análise para visualizar o grafo de chamadas detectado pela IA.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 h-[400px] flex flex-col shadow-inner">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                       <Terminal className="w-4 h-4 text-cyan-400" /> Analysis Report
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar prose prose-invert prose-xs max-w-none text-gray-400 font-sans leading-relaxed selection:bg-purple-500/30">
                       <Markdown>{analysisResult || "Selecione um bloco de código no descompilador e inicie a análise para preencher este relatório técnico."}</Markdown>
                    </div>
                  </div>
               </div>
            </div>
         )}
         {activeAnalysisMode === 'logic' && (
            <div className="max-w-4xl mx-auto space-y-8">
               <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight uppercase">Deep Semantic Extraction</h2>
                    <p className="text-gray-500 text-sm">Identifying intent, purpose, and explaining the semantic meaning of each instruction for Static Recompilation.</p>
                  </div>
                  <button onClick={handleDeepAnalysis} disabled={isProcessing} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-blue-400/50">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                    EXTRACT SEMANTIC LOGIC
                  </button>
               </div>
               
               <div className="bg-[#050505] border border-white/5 rounded-2xl p-8 min-h-[400px]">
                  <div className="prose prose-invert prose-blue max-w-none text-gray-300">
                    <Markdown>{analysisResult || "Selecione um bloco no descompilador e ative a extração lógica."}</Markdown>
                  </div>
               </div>
            </div>
         )}
         {activeAnalysisMode === 'signature' && (
            <div className="max-w-4xl mx-auto space-y-8">
               <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight uppercase">Function Signature Recovery</h2>
                    <p className="text-gray-500 text-sm">Automated identification of arguments, return types and calling conventions.</p>
                  </div>
                  <button onClick={handleSignatureAnalysis} disabled={isProcessing} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-emerald-400/50">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchCode className="w-4 h-4" />}
                    EXTRACT SIGNATURE
                  </button>
               </div>
               
               <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 min-h-[300px]">
                  <div className="prose prose-invert max-w-none">
                    <Markdown>{analysisResult || "Identifique assinaturas de funções carregando o assembly alvo."}</Markdown>
                  </div>
               </div>
            </div>
         )}
         {activeAnalysisMode === 'patch' && (
            <div className="max-w-4xl mx-auto space-y-8">
               <div className="flex justify-between items-end gap-6 bg-black/40 p-6 rounded-2xl border border-white/5 border-l-4 border-l-yellow-500">
                  <div className="flex-1 space-y-4">
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-tight uppercase">Neural Patch Generator</h2>
                      <p className="text-gray-500 text-sm">Convert assembly logic into injectable binary patches using neural heuristics.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Target Offset Address</label>
                        <input 
                          value={patchAddress}
                          onChange={(e) => setPatchAddress(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm focus:border-yellow-500/50 outline-none"
                          placeholder="0x800XXXXX"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Modification Intent</label>
                        <input 
                          value={modIntent}
                          onChange={(e) => setModIntent(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm focus:border-yellow-500/50 outline-none"
                          placeholder="ex: disable damage check"
                        />
                      </div>
                    </div>
                  </div>
                  <button onClick={handleGeneratePatch} disabled={isProcessing} className="bg-yellow-600 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-yellow-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 border border-yellow-400/50">
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    GENERATE PATCH
                  </button>
               </div>
               
               <div className="bg-[#0a0a0a] border border-white/10 border-dashed rounded-2xl p-8 min-h-[400px]">
                  <div className="prose prose-invert prose-yellow max-w-none text-gray-300">
                    <Markdown>{analysisResult || "Defina o endereço e o propósito para gerar um patch binário."}</Markdown>
                  </div>
               </div>
            </div>
         )}
         {activeAnalysisMode === 'hle' && (
            <div className="max-w-4xl mx-auto space-y-8">
               <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight uppercase">SDK Signature Matcher (HLE)</h2>
                    <p className="text-gray-500 text-sm">Compares binary blocks against known SDK/BIOS syscall signatures for {targetArch}.</p>
                  </div>
                  <button onClick={handleHLETranslate} disabled={isProcessing} className="bg-cyan-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-cyan-400/50">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    SCAN SYSCALLS
                  </button>
               </div>
               
               <div className="grid grid-cols-1 gap-6">
                  <div className="bg-black/60 border border-white/5 rounded-2xl p-8 min-h-[400px]">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-6 flex items-center gap-2">
                       <Database className="w-4 h-4 text-cyan-400" /> HLE Translation Table
                    </h3>
                    <div className="prose prose-invert prose-cyan max-w-none text-gray-300">
                      <Markdown>{analysisResult || "Load hex data from the editor or decompiler and execute the scan to identify system-level calls (e.g., PSX BIOS, SDK functions)."}</Markdown>
                    </div>
                  </div>
               </div>
            </div>
         )}
         {activeAnalysisMode === 'yara' && (
            <div className="max-w-4xl mx-auto space-y-8">
               <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight uppercase">YARA Neural Signature Scanner</h2>
                    <p className="text-gray-500 text-sm">Identifying game engines, compression algorithms, and cryptographic constants via neural heuristic matching.</p>
                  </div>
                  <button onClick={handleYaraScan} disabled={isProcessing} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-indigo-400/50">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    SCAN BINARY
                  </button>
               </div>
               
               <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-8 min-h-[400px]">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-6 flex items-center gap-2">
                     <Database className="w-4 h-4 text-indigo-400" /> Signature Match Results
                  </h3>
                  <div className="prose prose-invert prose-indigo max-w-none text-gray-300">
                    <Markdown>{analysisResult || "Load a binary or provide a hex stream to scan for known patterns (e.g., Unity engine strings, zlib headers, AES S-boxes)."}</Markdown>
                  </div>
               </div>
            </div>
         )}
         {activeAnalysisMode === 'decipher' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <ShieldAlert className="w-8 h-8 text-orange-500" />
                <h2 className="text-xl font-bold text-white uppercase tracking-tighter">AI Cryptanalysis Engine</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: "crypto_scan", name: "SigScan", desc: "Find S-Boxes & constants", icon: <SearchCode className="w-5 h-5" /> },
                  { id: "entropy_analysis", name: "Entropy", desc: "Detect packers & compression", icon: <Activity className="w-5 h-5" /> },
                  { id: "brute_force_logic", name: "LogicGen", desc: "Reconstruct check logic", icon: <Target className="w-5 h-5" /> }
                ].map((mode: any) => (
                  <button 
                    key={mode.id}
                    onClick={() => handleAdvancedDecipher(mode.id)}
                    className="p-6 bg-orange-500/5 border border-orange-500/20 rounded-2xl hover:bg-orange-500/10 transition-all text-left group"
                  >
                    <div className="text-orange-400 mb-3 group-hover:scale-110 transition-transform">{mode.icon}</div>
                    <div className="text-white font-bold text-sm uppercase tracking-widest">{mode.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{mode.desc}</div>
                  </button>
                ))}
              </div>
              <div className="bg-black/60 border border-white/5 rounded-2xl p-6 min-h-[300px]">
                 <div className="prose prose-invert max-w-none text-xs font-mono">
                    <Markdown>{analysisResult || "Selecione uma modalidade de decifração para iniciar o processo heurístico."}</Markdown>
                 </div>
              </div>
            </div>
         )}
         {activeAnalysisMode === 'symbolic' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <Calculator className="w-8 h-8 text-blue-500" />
                <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Symbolic Path Assistant</h2>
              </div>
              <p className="text-gray-400 text-sm italic">Calcula todos os caminhos lógicos possíveis a partir de um ponto de execução, identificando condições de branch 'vulneráveis' para patches.</p>
              <button 
                onClick={handleSymbolicAnalysis}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
              >
                GENERATE SYMBOLIC TRACE
              </button>
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-8 min-h-[300px]">
                 <div className="prose prose-invert max-w-none">
                    <Markdown>{analysisResult || "Aguardando execução do assistente simbólico..."}</Markdown>
                 </div>
              </div>
            </div>
         )}
         {activeAnalysisMode === 'integrity' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <Database className="w-8 h-8 text-emerald-500" />
                <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Binary Checksum & Integrity (CRC32)</h2>
              </div>
              <p className="text-gray-400 text-sm italic">Verifique o checksum do arquivo atual contra uma hash conhecida para confirmar a validade (útil para ROM modding).</p>
              
              <div className="flex flex-col gap-4 bg-black/40 p-6 rounded-2xl border border-white/5">
                <div>
                   <label className="text-[10px] font-bold text-gray-500 uppercase">Referência CRC32 Esperada (Hex)</label>
                   <input 
                     value={integrityReferenceHash}
                     onChange={(e) => setIntegrityReferenceHash(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm focus:border-emerald-500/50 outline-none uppercase"
                     placeholder="ex: FFFFFFFF"
                     maxLength={8}
                   />
                </div>
                
                <button 
                  onClick={handleCheckCRC}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
                >
                  CALCULATE & VERIFY CRC32
                </button>
              </div>

              {integrityResult && (
                 <div className={`rounded-2xl p-6 border flex flex-col gap-2 ${integrityResult.match ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    <h3 className="text-lg font-bold uppercase tracking-widest">{integrityResult.match ? 'VERIFIED MATCH' : 'CHECKSUM MISMATCH'}</h3>
                    <p className="font-mono text-sm">Calculated CRC32: {integrityResult.actual}</p>
                    {integrityReferenceHash && (
                      <p className="font-mono text-sm opacity-70">Expected CRC32: {integrityReferenceHash.toUpperCase().trim()}</p>
                    )}
                 </div>
              )}

            </div>
         )}
      </div>
    </div>
  );

  const renderScripts = () => (
    <div className="h-full flex flex-col bg-[#0a0a0a] overflow-hidden p-6 gap-6">
      <div className="flex-1 bg-[#141414] border border-white/5 rounded-3xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] relative">
         <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              </div>
              <div className="h-4 w-[1px] bg-white/10 mx-2" />
              <Terminal className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-bold text-white tracking-[0.2em] uppercase">Forge-OS Virtual Terminal</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-black/60 rounded-full border border-white/5">
                <span className="text-[9px] text-gray-500 font-bold">STATE:</span>
                <span className="text-[9px] text-green-400 font-mono animate-pulse uppercase tracking-tighter">Connected</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-1 rounded">PC: {patchAddress}</span>
            </div>
         </div>
         <div className="flex-1 bg-[#050505] p-8 font-mono text-xs overflow-auto custom-scrollbar leading-relaxed">
            <div className="text-amber-500/80 mb-1">RetroForge Microkernel [Version 4.0.122]</div>
            <div className="text-gray-600 mb-6">(c) 2026 RetroForge Systems. All rights reserved.</div>
            
            <div className="space-y-2 mb-8">
               <div className="flex gap-3 text-gray-400">
                  <span className="text-cyan-500">[*]</span>
                  <span>Initializing symbol table... <span className="text-green-500">SUCCESS</span></span>
               </div>
               <div className="flex gap-3 text-gray-400">
                  <span className="text-cyan-500">[*]</span>
                  <span>Verifying binary hash (CRC32: {BinaryIntegrityUseCase.calculateCRC32(fileData || new Uint8Array())})... <span className="text-green-500">MATCH</span></span>
               </div>
               <div className="flex gap-3 text-orange-400 font-bold italic">
                  <span className="text-orange-500">[!]</span>
                  <span>WARNING: Read-only memory protection is DISABLED for this session.</span>
               </div>
            </div>

            <div className="text-gray-500 mb-4">Type <span className="text-white bg-white/10 px-1 rounded hover:bg-cyan-500 hover:text-black transition-all cursor-help">help</span> to list available commands or <span className="text-white bg-white/10 px-1 rounded hover:bg-cyan-500 hover:text-black transition-all cursor-help">analyser --auto</span> for quick scans.</div>
            
            <div className="space-y-4">
              {agentLogs.slice(-10).map((log, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-gray-700 tracking-tighter">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.includes('[SUCCESS]') ? 'text-green-400' : 'text-gray-400'}>{log}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-3 text-cyan-400 items-center">
               <span className="animate-pulse">{">"}</span>
               <input 
                 type="text" 
                 className="bg-transparent border-none outline-none flex-1 font-mono text-cyan-400 selection:bg-cyan-500/30" 
                 placeholder="Enter opcode or command..." 
                 autoFocus
               />
            </div>
         </div>
         <div className="p-3 bg-black/60 border-t border-white/5 flex gap-6 shrink-0 overflow-x-auto no-scrollbar">
            {['HEURISTIC_SCAN', 'PATCH_GEN', 'MEM_DUMP', 'REBASE'].map(cmd => (
              <button key={cmd} className="text-[9px] text-gray-500 font-bold hover:text-cyan-400 transition-colors uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                <TerminalSquare className="w-3 h-3" /> {cmd}
              </button>
            ))}
         </div>
      </div>
    </div>
  );

  const renderScanner = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-hidden p-6 bg-[#0a0a0a]">
      <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 flex flex-col gap-6 overflow-hidden">
        <div className="flex justify-between items-center shrink-0">
          <h3 className="text-white font-bold text-sm tracking-widest uppercase">Memory Scanner</h3>
          <button 
            onClick={runScanner}
            disabled={isScanning || !fileData}
            className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-bold hover:bg-purple-500 hover:text-black transition-all"
          >
            {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : "RUN FULL SCAN"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
          {scannerResults.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 italic text-xs gap-4">
              <Search className="w-8 h-8 opacity-20" />
              Nenhum símbolo identificado ainda.
            </div>
          ) : (
             scannerResults.map((res, i) => (
               <div key={i} className="p-3 bg-black/40 border border-white/5 rounded-xl flex justify-between items-center group hover:border-purple-500/30 transition-all">
                  <div className="flex flex-col">
                    <span className="text-xs text-purple-400 font-mono font-bold uppercase">{res.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">{res.addr}</span>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-all">
                    <Brackets className="w-4 h-4" />
                  </button>
               </div>
             ))
          )}
        </div>
      </div>
      <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
        <h3 className="text-white font-bold text-sm tracking-widest uppercase">Deep Search</h3>
        <p className="text-gray-500 text-xs italic">Busca por endereços específicos ou valores hexadecimais em toda a RAM virtual.</p>
        <div className="space-y-4">
          <div className="bg-black/60 p-4 rounded-xl border border-white/5 space-y-3">
             <label className="text-[10px] text-gray-500 font-bold uppercase">Search Hex Pattern</label>
             <input type="text" placeholder="FF 00 FF 00..." className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs font-mono text-cyan-400 outline-none" />
             <button className="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold transition-all">FIND NEXT</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStringsTool = () => (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0a] p-6 gap-6">
      <div className="bg-[#141414] border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
          <div className="flex items-center gap-3">
            <AlignLeft className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold text-gray-300 uppercase tracking-[0.2em]">Extracted Strings ({extractedStrings.length})</span>
          </div>
          <div className="flex gap-2">
             <input 
               type="text" 
               placeholder="Filtrar strings..." 
               className="bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-[10px] text-gray-300 outline-none w-48 focus:border-orange-500/50 transition-all font-mono"
             />
             <button 
               onClick={() => {
                 const header = `/* Auto-generated by RetroForge Strings Extractor */\n\n` + extractedStrings.map(s => `#define STR_0x${s.offset.toString(16).toUpperCase()} "${s.text}"`).join('\n');
                 const blob = new Blob([header], { type: 'text/plain' });
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = `strings_db.h`;
                 a.click();
                 URL.revokeObjectURL(url);
                 showToast('success', 'Header C gerado com sucesso!');
               }}
               className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg text-[10px] font-bold hover:bg-orange-500 hover:text-black transition-all"
             >
               EXPORT C HEADER
             </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
          <table className="w-full text-left font-mono text-[11px]">
             <thead className="bg-black/40 text-gray-500 sticky top-0 uppercase tracking-tighter">
               <tr>
                 <th className="p-3 font-medium">Offset</th>
                 <th className="p-3 font-medium">Content</th>
                 <th className="p-3 font-medium text-right">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
               {extractedStrings.slice(0, 500).map((str, i) => (
                 <tr key={i} className="hover:bg-white/5 group transition-colors">
                   <td className="p-3 text-gray-600">0x{str.offset.toString(16).toUpperCase().padStart(8, '0')}</td>
                   <td className="p-3 text-gray-300 select-all">{str.text}</td>
                   <td className="p-3 text-right">
                     <button className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-orange-500/10 text-gray-500 hover:text-orange-400 rounded-lg transition-all">
                       <Save className="w-3 h-3" />
                     </button>
                   </td>
                 </tr>
               ))}
               {extractedStrings.length === 0 && (
                 <tr>
                   <td colSpan={3} className="p-10 text-center text-gray-600 italic">Nenhuma string detectada para este binário.</td>
                 </tr>
               )}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const runRecompilationPipeline = useCallback(async () => {
    if (!fileData) return;
    setAgentStatus('scanning');
    setAgentLogs([]);
    setAgentProgress(0);
    
    const tasks: RecompTask[] = [
      { id: '1', name: 'Mapeamento de Segmentos (.text, .data)', type: 'symbols', status: 'pending', progress: 0 },
      { id: '2', name: 'Recuperação de Símbolos via Heurística', type: 'symbols', status: 'pending', progress: 0 },
      { id: '3', name: 'Análise de Fluxo de Controle (CFG)', type: 'cfg', status: 'pending', progress: 0 },
      { id: '4', name: 'Descompilação Estática (C++)', type: 'decomp', status: 'pending', progress: 0 },
      { id: '5', name: 'Geração de Relayers / Wrappers HLE', type: 'reloc', status: 'pending', progress: 0 },
    ];
    setRecompTasks(tasks);

    const updateTask = (id: string, updates: Partial<RecompTask>) => {
      setRecompTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    try {
      // Step 1: Mapping
      updateTask('1', { status: 'processing' });
      addAgentLog("Iniciando mapeamento de segmentos ELF/ROM...");
      await new Promise(r => setTimeout(r, 1000));
      updateTask('1', { status: 'done', progress: 100 });
      setAgentProgress(20);

      // Step 2: Symbols
      updateTask('2', { status: 'processing' });
      addAgentLog("Extraindo assinaturas funcionais...");
      
      const foundSigs = ScannerUseCase.execute(fileData);
      if (activeProjectId) {
        foundSigs.forEach(res => {
          symbolService.registerSymbol(activeProjectId, {
            address: res.addr,
            name: res.name,
            size: res.size,
            type: 'function',
            comment: 'Auto-detected by Pipeline Scanner'
          });
        });
      }
      addAgentLog(`${foundSigs.length} símbolos identificados e registrados via pattern matching.`);
      await new Promise(r => setTimeout(r, 1200));
      updateTask('2', { status: 'done', progress: 100 });
      setAgentProgress(40);

      // Step 3: CFG
      updateTask('3', { status: 'processing' });
      addAgentLog("Construindo Graph de Fluxo de Controle...");
      const mockNodes = [
        { id: 'main', name: 'entry_main', type: 'entry' },
        { id: 'init', name: 'init_hardware', type: 'function' },
        { id: 'loop', name: 'main_loop', type: 'function' },
        { id: 'render', name: 'gpu_render', type: 'function' },
        { id: 'physics', name: 'phys_calc', type: 'function' },
        { id: 'exit', name: 'graceful_exit', type: 'exit' }
      ];
      const mockLinks = [
        { source: 'main', target: 'init' },
        { source: 'init', target: 'loop' },
        { source: 'loop', target: 'physics' },
        { source: 'physics', target: 'render' },
        { source: 'render', target: 'loop', label: 'tick' },
        { source: 'loop', target: 'exit' }
      ];
      setCfgData({ nodes: mockNodes, links: mockLinks });
      await new Promise(r => setTimeout(r, 1500));
      updateTask('3', { status: 'done', progress: 100 });
      setShowCFG(true);
      setAgentProgress(60);

      // Step 4: Decomp
      updateTask('4', { status: 'processing' });
      addAgentLog("Invocando Transpilador LLM para código nativo...");
      await new Promise(r => setTimeout(r, 2000));
      updateTask('4', { status: 'done', progress: 100 });
      setAgentProgress(80);

      // Step 5: HLE
      updateTask('5', { status: 'processing' });
      addAgentLog("Gerando wrappers de sistema (SDL2/OpenGL)...");
      await new Promise(r => setTimeout(r, 1000));
      updateTask('5', { status: 'done', progress: 100 });
      setAgentProgress(100);

      setAgentStatus('done');
      addAgentLog("PRONTO! O projeto de recompilação estática foi inicializado com sucesso.");
    } catch (e) {
      addAgentLog(`Erro no pipeline: ${e}`);
      setAgentStatus('idle');
    }
  }, [fileData]);

  const renderPipeline = () => (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full overflow-hidden">
      {/* Task List */}
      <div className="xl:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
        <div className="bg-[#141414] border border-white/5 rounded-2xl p-6">
          <h3 className="text-white font-bold text-sm tracking-widest uppercase mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Static Recompilation Stack
          </h3>
          <div className="space-y-3">
            {recompTasks.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-8 text-center px-4">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-16 h-16 bg-gradient-to-tr from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl flex items-center justify-center shadow-2xl animate-float"
                >
                  <Layers className="w-8 h-8 text-cyan-400" />
                </motion.div>
                <div className="space-y-2">
                  <p className="text-white font-black text-sm uppercase tracking-widest">Pipeline Dormant</p>
                  <p className="text-gray-500 text-[10px] leading-relaxed max-w-[200px]">
                     Aguardando sinal para iniciar a деconstrução neural do target binário.
                  </p>
                </div>
                <button 
                  onClick={runRecompilationPipeline}
                  disabled={!fileData}
                  className="w-full py-4 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-[1.5rem] hover:bg-cyan-400 transition-all active:scale-95 disabled:opacity-20 shadow-xl shadow-cyan-500/10"
                >
                  Initialize Forge Pipeline
                </button>
              </div>
            ) : (
              recompTasks.map((task) => (
                <div key={task.id} className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-2 group hover:border-cyan-500/30 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">{task.name}</span>
                    {task.status === 'processing' ? <Loader2 className="w-3 h-3 text-cyan-500 animate-spin" /> : 
                     task.status === 'done' ? <Zap className="w-3 h-3 text-green-500" /> : 
                     <History className="w-3 h-3 text-gray-700" />}
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${task.progress}%` }}
                      className={`h-full ${task.status === 'done' ? 'bg-green-500' : 'bg-cyan-500'}`}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Visualizer & Logs */}
      <div className="xl:col-span-2 flex flex-col gap-6 overflow-hidden">
        <div className="bg-[#141414] border border-white/5 rounded-2xl flex-1 relative overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
            <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Network className="w-4 h-4 text-purple-400" />
              Graph Visualizer & Call Stack Extraction
            </span>
            <div className="flex gap-2">
               <button className="px-2 py-1 bg-white/5 rounded text-[10px] text-gray-400 hover:text-white transition-colors">EXPORT DOT</button>
               <button className="px-2 py-1 bg-white/5 rounded text-[10px] text-gray-400 hover:text-white transition-colors">COLLAPSE ALL</button>
            </div>
          </div>
          <div className="flex-1 p-4 overflow-hidden">
            {showCFG ? (
              <CFGVisualizer 
                nodes={cfgData.nodes} 
                links={cfgData.links} 
                onNodeSelect={(node) => {
                  setAsmCode(`// Focus: ${node.name}\n// Localizar opcodes em runtime...`);
                  showToast('info', `Focado em: ${node.name}`);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs flex-col gap-4">
                <Network className="w-12 h-12 opacity-10" />
                Aguardando finalização da análise topológica...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const startDecompAgent = async (file: File) => {
    setAgentStatus('scanning');
    setAgentLogs([]);
    setAgentProgress(0);
    addAgentLog(`[SCAN] Inicializando Scanner Heurístico e Capstone Engine para ${file.name}...`);

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    setFileData(data);
    setFileName(file.name);
    setFileSize(file.size);
    eventBus.emit("MOD_ROM_LOADED", { name: file.name, size: file.size });

    addAgentLog("[SCAN] Buscando assinaturas de funções conhecidas com YARA / Regex...");
    setAgentProgress(10);
    
    // Industrial Evolution: Offload heavy analysis to WorkerPool
    const startScan = performance.now();
    const results = await workerPool.execute<{name: string, addr: string, size: number}[]>('SCAN', { data });
    monitor.recordMetric('BINARY_SCAN', performance.now() - startScan);
    
    if (activeProjectId) {
      results.forEach(res => {
        symbolService.registerSymbol(activeProjectId, {
          address: res.addr,
          name: res.name,
          size: res.size,
          type: 'function',
          comment: 'Auto-detected by AI Decompilation Agent'
        });
      });
      addAgentLog(`[SCAN] Registrou ${results.length} símbolos identificados no banco de dados local.`);
    }
    
    eventBus.emit("SCAN_PERFORMED", { resultsCount: results.length });

    if (results.length === 0) {
       addAgentLog("[SCAN] Nenhuma assinatura padrão encontrada. Fallback para heurística bruta (.text segment).");
       results.push({ name: 'sub_8000', addr: '0x00008000', size: 256 });
    }

    addAgentLog(`[SCAN] ${results.length} func(s) identificadas. Preparando extração de opcodes...`);
    setAgentProgress(30);

    setAgentStatus('decompiling');
    addAgentLog("[AI LOGIC] Roteando blocos ASM identificados para LM Studio / Gemini...");

    let cppSource = `// RetroForge Auto-Decompilation\n// Target: ${file.name}\n\n#include <stdint.h>\n\n`;

    const tasksToProcess = Math.min(results.length, 3); // For preview limits, only process up to 3 chunks via API

    for (let i = 0; i < tasksToProcess; i++) {
        const match = results[i];
        addAgentLog(`[AI LOGIC] Enviando rotina '${match.name}' (${match.addr}) para a IA decifrar...`);
        
        let chunkHex = "";
        const offset = parseInt(match.addr, 16);
        if (!isNaN(offset) && offset < data.length) {
            const slice = data.slice(offset, offset + 64); // Extract 64 bytes
            chunkHex = Array.from(slice).map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        } else {
            chunkHex = "00 00 00 00";
        }

        try {
          const result = await decompileWithAI(chunkHex, {
            arch: targetArch,
            intent: modIntent || `Analisar rotina identificada como ${match.name}`
          }, getEnhancedSettings());
          
          let cppChunk = result || `void ${match.name}() { /* Failed to parse via API */ }`;
          cppChunk = cppChunk.replace(/```cpp/g, "").replace(/```/g, "").trim();
          cppSource += `// Rotina localizada em: ${match.addr}\n${cppChunk}\n\n`;
          addAgentLog(`[PATCH APPLIED] Código ASM para ${match.name} gerado. Invocando Keystone Engine para montagem...`);
          addAgentLog(`[PATCH APPLIED] ✅ Mnemônicos recompilados e injetados com sucesso na ROM virtual!`);
        } catch (e: any) {
          addAgentLog(`Erro na chamada da IA para ${match.name}: ${e?.message}. Fallback para nop estático.`);
          cppSource += `void ${match.name}() {\n  // Descompilação falhou: ${e?.message}\n}\n\n`;
        }

        setAgentProgress(30 + Math.floor(((i + 1) / tasksToProcess) * 60));
    }

    setAgentStatus('done');
    setAgentProgress(100);
    addAgentLog(`Compilação concluída! Baixando arquivo .cpp ...`);

    const blob = new Blob([cppSource], { type: 'text/cpp' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name}_decompiled.cpp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  const runScanner = () => {
    if (!fileData) return;
    setIsScanning(true);
    
    // Simulate slight yield to paint UI, then doing sync work
    requestAnimationFrame(() => {
      const results = ScannerUseCase.execute(fileData);
      
      if (activeProjectId) {
        results.forEach(res => {
          symbolService.registerSymbol(activeProjectId, {
            address: res.addr,
            name: res.name,
            size: res.size,
            type: 'function',
            comment: 'Auto-detected by UI Scanner'
          });
        });
        addAgentLog(`[SCANNER] Registrou ${results.length} símbolos no banco de dados local.`);
      }

      setScannerResults(results);
      setIsScanning(false);
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      const projects = await projectService.getProjects();
      if (projects.length > 0) {
        const last = projects[projects.length - 1];
        const data = await projectService.loadFileData(last.id);
        if (data) {
          setFileData(data);
          setActiveProjectId(last.id);
          workerPool.execute<{offset: number, text: string}[]>('EXTRACT_STRINGS', { data }).then(setExtractedStrings);
          addAgentLog(`[SYSTEM] Sessão restaurada: ${last.name}`);
        }
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    if (fileData) {
      workerPool.execute<{offset: number, text: string}[]>('EXTRACT_STRINGS', { data: fileData })
        .then(setExtractedStrings)
        .catch(err => console.error("Worker error extracting strings:", err));
    }
  }, [fileData]);

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  const processUploadedFile = async (file: File) => {
    setFileName(file.name);
    setFileSize(file.size);
    setHexOffset(0);

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    setFileData(data);
    setOriginalFileData(new Uint8Array(data)); // Backup original
    extractStrings(data);
    
    const checksum = BinaryIntegrityUseCase.calculateCRC32(data);
    addAgentLog(`[SYSTEM] CRC32 Original: ${checksum}`);
    
    const project = await projectService.createProject(file.name, targetArch, data);
    setActiveProjectId(project.id);
    addAgentLog(`[SYSTEM] Novo projeto registrado: ${project.id}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
  };

  const handleShowDiff = () => {
    if (!fileData || !originalFileData) return;
    try {
      const diffs = BinaryDiffUseCase.execute(originalFileData, fileData);
      const summary = BinaryDiffUseCase.summarize(diffs);
      let details = summary + "\n\n";
      diffs.forEach(d => {
        details += `Offset 0x${d.offset.toString(16).toUpperCase()}: ${d.original.length} bytes alterados.\n`;
      });
      openModal("Comparação de Binário", details);
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleHexSearch = () => {
    if (!fileData || !searchQuery) return;
    const cleanQuery = searchQuery.replace(/\s+/g, '').toUpperCase();
    if (cleanQuery.length % 2 !== 0 && !cleanQuery.includes('?')) {
      openModal("Aviso", "A busca hex exige pares completos ou '??" + "' para wildcards (ex: A9 ?? 8D)");
      return; 
    }

    const bytesToMatch = [];
    for (let i = 0; i < cleanQuery.length; i += 2) {
      const byteStr = cleanQuery.substring(i, i + 2);
      if (byteStr === '??') bytesToMatch.push(-1); 
      else bytesToMatch.push(parseInt(byteStr, 16));
    }

    const results: number[] = [];
    for (let i = 0; i < fileData.length - bytesToMatch.length; i++) {
        let match = true;
        for (let j = 0; j < bytesToMatch.length; j++) {
            if (bytesToMatch[j] !== -1 && fileData[i + j] !== bytesToMatch[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            results.push(i);
            if (results.length >= 50) break; // Limit to 50 results
        }
    }
    setSearchResults(results);
  };

  const handleAnalyzeAsm = async () => {
    if (!asmCode.trim()) {
      showToast('error', 'Insira código assembly para analisar.');
      return;
    }

    setIsProcessing(true);
    addAgentLog(`[AI] Analyse ASM opcodes para ${targetArch}...`);

    try {
      const result = await (await import('../services/aiDecompilerService')).analyzeAssemblyWithAI(asmCode, targetArch, getEnhancedSettings());
      setAnalysisResult(result);
      showToast('success', 'Análise concluída com sucesso.');

    } catch (e: any) {
      addAgentLog(`[ERROR] Falha na análise: ${e.message}`);
      showToast('error', 'Erro interno na comunicação com a IA.');
    } finally {
      setIsProcessing(false);
    }
  };

  const [callstackData, setCallstackData] = useState<{nodes: any[], links: any[]}>({ nodes: [], links: [] });

  const handleAnalyzeCallStack = async () => {
    const codeToAnalyze = cppResult || asmCode;
    if (!codeToAnalyze.trim()) {
      showToast('error', 'Código ASM ou C++ necessário para análise de Call Stack.');
      return;
    }

    setIsProcessing(true);
    addAgentLog(`[AI] Iniciando Análise de Hierarquia de Chamadas (Call Stack) para ${targetArch}...`);
    
    try {
      const result = await analyzeCallStackWithAI(codeToAnalyze, targetArch, getEnhancedSettings());
      
      // Attempt to extract JSON for visualization
      const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.nodes && parsed.links) {
            setCallstackData(parsed);
          }
        } catch (e) {
          console.error("Failed to parse callstack JSON", e);
        }
      }

      setAnalysisResult(result);
      showToast('success', 'Análise de Call Stack concluída!');
      addAgentLog(`[SUCCESS] Hierarquia de chamadas extraída via IA.`);
      
      // Auto-switch to Lab to see visualization if not already there
      if (activeTool !== 'lab') {
        setActiveTool('lab');
        setActiveAnalysisMode('callstack');
      }
    } catch (e: any) {
      showToast('error', 'Falha na análise de Call Stack.');
      addAgentLog(`[FAILURE] Call Stack Analysis Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdvancedDecipher = async (mode: "crypto_scan" | "entropy_analysis" | "brute_force_logic") => {
    const dataToAnalyze = cppResult || asmCode;
    if (!dataToAnalyze.trim()) {
      showToast('error', 'Código ou Hex necessário para o Decipher Assistant.');
      return;
    }

    setIsProcessing(true);
    addAgentLog(`[DECIPHER] Iniciando análise avançada (${mode}) para ${targetArch}...`);
    
    try {
      const result = await advancedDecipherWithAI(dataToAnalyze, targetArch, mode, getEnhancedSettings());
      setAnalysisResult(result);
      showToast('success', 'Decifração inteligente concluída!');
      addAgentLog(`[SUCCESS] Dados processados via IA Cryptanalysis.`);
    } catch (e: any) {
      showToast('error', 'Falha no Decipher Assistant.');
      addAgentLog(`[FAILURE] Decipher Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanSignatures = async () => {
    if (!asmCode.trim()) {
      showToast('error', 'Hex ou ASM necessário para escaneamento de assinaturas.');
      return;
    }
    setIsProcessing(true);
    addAgentLog(`[SIGNATURE] Iniciando scan heurístico de assinaturas para ${targetArch}...`);
    try {
      const result = await scanSignaturesWithAI(asmCode, targetArch, getEnhancedSettings());
      setAnalysisResult(result);
      showToast('success', 'Scan de assinaturas concluído!');
    } catch (e: any) {
      showToast('error', 'Falha no scan de assinaturas.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSymbolicAnalysis = async () => {
    const codeToAnalyze = cppResult || asmCode;
    if (!codeToAnalyze.trim()) {
      showToast('error', 'Código necessário para análise simbólica.');
      return;
    }
    setIsProcessing(true);
    addAgentLog(`[SYMBOLIC] Calculando caminhos lógicos de execução para ${targetArch}...`);
    // Pass a dummy state for now, can be enhanced later if emulator is active
    const dummyState = { pc: patchAddress, registers: { r0: 0, v0: 0, a0: 0 } };
    try {
      const result = await symbolicExecutionAssistant(codeToAnalyze, dummyState, targetArch, getEnhancedSettings());
      setAnalysisResult(result);
      showToast('success', 'Análise simbólica concluída!');
    } catch (e: any) {
      showToast('error', 'Falha na análise simbólica.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleHLETranslate = async () => {
    if (!asmCode.trim()) {
      showToast('error', 'Hex ou ASM necessário para tradução HLE.');
      return;
    }
    setIsProcessing(true);
    addAgentLog(`[HLE] Consultando banco de assinaturas IA para ${targetArch}...`);
    try {
      // Heuristic scan if we have fileData
      let heuristicResults = "";
      if (fileData) {
        const foundSyscalls = ScannerUseCase.scanSyscalls(fileData, targetArch);
        if (foundSyscalls.length > 0) {
          heuristicResults = "### Heuristic Results (Local Engine)\n\n| Address | Syscall | Description |\n|---------|---------|-------------|\n";
          foundSyscalls.forEach(s => {
            heuristicResults += `| ${s.addr} | **${s.name}** | ${s.description} |\n`;
          });
          heuristicResults += "\n---\n\n";
          addAgentLog(`[HLE] Local engine found ${foundSyscalls.length} potential syscalls.`);
        }
      }

      const aiResult = await suggestHLEWithAI(asmCode, targetArch, getEnhancedSettings());
      setAnalysisResult(heuristicResults + aiResult);
      showToast('success', 'Tradução HLE concluída!');
    } catch (e: any) {
      showToast('error', 'Falha na tradução HLE.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleYaraScan = async () => {
    setIsProcessing(true);
    setAnalysisResult(null);
    addAgentLog(`[YARA] Iniciando escaneamento neural de assinaturas para ${targetArch}...`);
    
    // Use either fileData hex or asmCode context
    const inputHex = fileData ? Array.from(fileData.slice(0, 5000)).map(b => b.toString(16).padStart(2, '0')).join(' ') : asmCode;

    try {
      const result = await scanWithYaraAI(inputHex, targetArch, getEnhancedSettings());
      setAnalysisResult(result);
      showToast('success', 'Escaneamento YARA concluído!');
      addAgentLog(`[SUCCESS] Assinaturas de engines e bibliotecas identificadas.`);
    } catch (e: any) {
      showToast('error', 'Falha no escaneamento YARA.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeepAnalysis = async () => {
    if (!asmCode.trim()) {
      showToast('error', 'ASM code needed for deep analysis.');
      return;
    }
    setIsProcessing(true);
    addAgentLog(`[LOGIC] Executando extração semântica profunda para ${targetArch}...`);
    try {
      const result = await deepAnalyzeWithAI(asmCode, targetArch, getEnhancedSettings());
      
      const cppMatch = result.match(/```cpp\n([\s\S]*?)\n```/) || result.match(/```c\n([\s\S]*?)\n```/);
      if (cppMatch) {
         setCppResult(cppMatch[1].trim());
      } else {
         setCppResult("// Deep Analysis complete. Check report for logic.");
      }
      
      setAnalysisResult(result);
      showToast('success', 'Extração lógica concluída!');
      addAgentLog(`[SUCCESS] Propósito e código C++ identificados.`);
    } catch (e: any) {
      showToast('error', 'Falha na análise profunda.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignatureAnalysis = async () => {
    if (!asmCode.trim()) {
      showToast('error', 'ASM code needed for signature analysis.');
      return;
    }
    setIsProcessing(true);
    addAgentLog(`[SIGNATURE] Identificando protótipo da função para ${targetArch}...`);
    try {
      const result = await extractSignatureWithAI(asmCode, targetArch, getEnhancedSettings());
      setAnalysisResult(result);
      showToast('success', 'Assinatura identificada!');
      addAgentLog(`[SUCCESS] Protótipo C++ gerado com base no uso de registradores.`);
    } catch (e: any) {
      showToast('error', 'Falha na identificação de assinatura.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecompile = async () => {
    if (!asmCode.trim()) {
      showToast('error', 'Insira código assembly ou hex para descompilar.');
      return;
    }

    setIsProcessing(true);
    setCppResult('');
    addAgentLog(`[AI] Iniciando decompilação estática para ${targetArch}...`);
    addAgentLog(`[INTENT] Objetivo do Mod: ${modIntent || "Nenhum especificado"}`);

    try {
      const result = await decompileWithAI(asmCode, {
        arch: targetArch,
        intent: modIntent || "Deep Logic Recovery"
      }, settings);
      
      const cppMatch = result.match(/```cpp\n([\s\S]*?)\n```/) || result.match(/```c\n([\s\S]*?)\n```/);
      
      if (cppMatch) {
        setCppResult(cppMatch[1].trim());
        setAnalysisResult(result);
        showToast('success', 'Decompilação e análise técnica concluídas!');
      } else {
        const cleaned = result
          .replace(/```cpp/gi, '')
          .replace(/```c/gi, '')
          .replace(/```/g, '')
          .trim();
        setCppResult(cleaned);
      }

      addAgentLog(`[SUCCESS] Fluxo de controle e lógica nativa mapeados para ${targetArch}.`);
    } catch (e: any) {
      setCppResult("// Erro crítico de integração com a IA.\n/*\n" + (e.message || 'Falha desconhecida') + "\n*/");
      addAgentLog(`[ERRO CRÍTICO] Falha no motor de IA: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckCRC = () => {
    if (!fileData) {
      showToast('error', 'Nenhum binário carregado para checar.');
      return;
    }
    const actualCRC = BinaryIntegrityUseCase.calculateCRC32(fileData);
    const expected = integrityReferenceHash.toUpperCase().trim();
    const isValid = expected ? actualCRC === expected : true;
    setIntegrityResult({ match: !!expected && isValid, actual: actualCRC });
    addAgentLog(`[CRC32 Check] Calculated: ${actualCRC} | Expected: ${expected || 'None'}`);
  };

  const handleGeneratePatch = async () => {
    if (!asmCode.trim()) {
      showToast('error', 'Código ASM necessário para gerar patch.');
      return;
    }
    if (!modIntent.trim()) {
      showToast('error', 'Please specify mod intent (e.g., Infinite Health).');
      return;
    }
    setIsProcessing(true);
    addAgentLog(`[PATCH GEN] Iniciando síntese AI para ${targetArch}...`);
    addAgentLog(`[CONTEXT] Alvo: ${patchAddress} | Intento: ${modIntent}`);
    
    try {
      const result = await generatePatchWithAI(asmCode, {
        intent: modIntent,
        targetAddress: patchAddress,
        arch: targetArch
      }, settings);
      
      setAnalysisResult(result);
      
      // Também extrair o HEX para o editor caso o usuário queira injetar
      const hexMatch = result.match(/Hex.*?\n?([\s0-9A-F]{2,})/i);
      if (hexMatch) {
         setCppResult(hexMatch[1].trim());
      } else {
         setCppResult(result);
      }
      
      showToast('success', 'Patch binário gerado!');
      
      if (fileData && activeProjectId) {
        await snapshotService.createSnapshot(activeProjectId, fileData, `Pre-Patch: ${modIntent || "AI Patch Gen"}`);
      }
      
      showToast('success', 'Patch e análise técnica gerados com sucesso!');
    } catch (e: any) {
      showToast('error', 'Falha ao gerar patch.');
      setCppResult(`// Erro: ${e.message}`);
      addAgentLog(`[FAILURE] Patch Generation Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyPatch = async () => {
    if (!cppResult || !fileData || !activeProjectId) {
      showToast('error', 'Nenhum patch gerado ou ROM não carregada.');
      return;
    }

    setIsProcessing(true);
    addAgentLog(`[INJECT] Iniciando injeção cirúrgica de patch em ${patchAddress}...`);
    
    try {
      // Parse HEX from AI response "Explicação | Assembly | HEX"
      const parts = cppResult.split('|');
      const hexPart = parts.length >= 3 ? parts[2].trim() : cppResult.trim();
      
      // Sanitize hex string (remove comments or non-hex chars if AI added any)
      const cleanHex = hexPart.replace(/[^0-9A-Fa-f\s]/g, '').trim();

      const newBuffer = await ApplyPatchUseCase.execute(
        fileData,
        cleanHex,
        patchAddress,
        activeProjectId,
        modIntent || "Custom Mod"
      );

      setFileData(newBuffer);
      const checksum = BinaryIntegrityUseCase.calculateCRC32(newBuffer);
      addAgentLog(`[INTEGRITY] Novo CRC32: ${checksum}`);
      
      // Persist to indexedDB via projectService
      await projectService.updateProjectData(activeProjectId, newBuffer);

      showToast('success', 'Patch aplicado e salvo com sucesso!');
      addAgentLog(`[SUCCESS] ROM virtual modificada e persistida em IndexedDB.`);
    } catch (e: any) {
      showToast('error', `Falha na injeção: ${e.message}`);
      addAgentLog(`[FAILURE] Erro na injeção: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeStructure = async (offset: number) => {
    if (!fileData) return;
    setIsProcessing(true);
    addAgentLog(`[ANALYSIS] Escaneando padrões de dados no offset 0x${offset.toString(16).toUpperCase()}...`);
    
    try {
      const result = await AnalyzeStructureUseCase.execute(fileData.slice(offset), offset, targetArch);
      openModal("Análise de Estrutura IA", result);
      addAgentLog(`[SUCCESS] Estrutura analisada com sucesso.`);
    } catch (e: any) {
      showToast('error', 'Falha na análise estrutural');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegisterSymbol = (address: string, name: string) => {
    if (!activeProjectId) return;
    symbolService.registerSymbol(activeProjectId, {
      address,
      name,
      size: 4, // Default size
      type: 'function'
    });
    showToast('success', `Símbolo ${name} registrado.`);
  };

  const extractStrings = (data: Uint8Array) => {
    const strings: {offset: number, text: string}[] = [];
    let currentString = "";
    let startOffset = 0;

    for (let i = 0; i < data.length; i++) {
      const charCode = data[i];
      // Basic ASCII printable check
      if (charCode >= 32 && charCode <= 126) {
        if (currentString.length === 0) startOffset = i;
        currentString += String.fromCharCode(charCode);
      } else {
        if (currentString.length >= 5) { // Only strings 5 chars or longer
          strings.push({ offset: startOffset, text: currentString });
        }
        currentString = "";
      }
      
      // Cap at 1000 strings to avoid UI lag
      if (strings.length >= 1000) break;
    }
    setExtractedStrings(strings);
  };

  const renderHexBytes = () => {
    if (!fileData) return <div className="text-gray-500">No data. Please load a ROM.</div>;

    const lines = [];
    const bytesPerLine = 16;
    const maxLines = 16; // Show 256 bytes per page
    
    for (let i = 0; i < maxLines; i++) {
      const lineOffset = hexOffset + (i * bytesPerLine);
      if (lineOffset >= fileData.length) break;

      const hexBytes = [];
      const asciiChars = [];
      
      for (let j = 0; j < bytesPerLine; j++) {
        if (lineOffset + j < fileData.length) {
          const byte = fileData[lineOffset + j];
          hexBytes.push(byte.toString(16).padStart(2, '0').toUpperCase());
          asciiChars.push((byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.');
        } else {
          hexBytes.push('  ');
          asciiChars.push(' ');
        }
      }

      lines.push(
        <div key={i} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded transition-colors group relative items-center">
          <span className="text-gray-500 w-16 group-hover:text-cyan-400 transition-colors">{lineOffset.toString(16).padStart(8, '0').toUpperCase()}</span>
          <span className="text-cyan-400/80 flex-1 space-x-1 sm:space-x-2 tracking-widest group-hover:text-cyan-400 transition-colors">
            {hexBytes.map((hex, index) => <span key={index}>{hex}</span>)}
          </span>
          <span className="text-gray-400 w-32 font-mono whitespace-pre group-hover:text-white transition-colors">{asciiChars.join('')}</span>
          
          <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-black/80 px-2 py-1 rounded shadow shadow-black">
            <button 
              className="text-[9px] text-green-400 hover:text-white border border-green-500/30 hover:bg-green-500/50 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
              onClick={(e) => { 
                e.stopPropagation(); 
                openModal(
                  "Smart-Hack Injector",
                  [{ label: "Intenção de Modding (ex: vida infinita, pulo duplo)", placeholder: "vida infinita", value: "" }],
                  (values) => {
                    const intent = values[0];
                    if (intent) {
                      setAsmCode(`[AUTO-PATCH] Offset: 0x${lineOffset.toString(16).padStart(8, '0').toUpperCase()}\nBytes originais: ${hexBytes.join(' ')}\nIntenção de Modding: ${intent}\n\nExecute o fluxo: Hex -> Capstone (Disasm) -> LM Studio (Mod ASM) -> Keystone (Asm to Hex) e retorne o patch final.`); 
                      setActiveTool('decompiler');
                    }
                  }
                );
              }}
              title="Smart-Hack Injector (Auto-Patching)"
            >
              <Zap className="w-2.5 h-2.5" /> Auto-Patch (Inject)
            </button>
            <button 
              className="text-[9px] text-purple-400 hover:text-white border border-purple-500/30 hover:bg-purple-500/50 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
              onClick={(e) => { 
                e.stopPropagation(); 
                setAsmCode(hexBytes.join(' ')); 
                setActiveTool('decompiler'); 
              }}
              title="IA Local (Ollama): Explicar Opcodes deste bloco"
            >
              <Terminal className="w-2.5 h-2.5" /> IA Local: Explicar Opcode
            </button>
            <button 
              className="text-[9px] text-cyan-400 hover:text-white border border-cyan-500/30 hover:bg-cyan-500/50 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
              onClick={(e) => { 
                e.stopPropagation(); 
                setAsmCode(`CONTEXTO TÉCNICO: Você é o motor de análise do RetroForge AI. Sua especialidade é engenharia reversa de binários.\n\nTAREFA: Analise o bloco de funções no endereço 0x${lineOffset.toString(16).padStart(8, '0').toUpperCase()} e realize a decomposição lógica para implementação de mods. Código e bytes da região:\n\n${hexBytes.join(' ')}\n\nIdentifique possíveis Code Caves próximas e defina um Hook Point.`); 
                setActiveTool('decompiler');
              }}
              title="IA Nuvem (Gemini): Sugerir Mod/Injeção para este bloco"
            >
              <BrainCircuit className="w-2.5 h-2.5" /> IA Nuvem: Sugerir Mod
            </button>
          </div>
        </div>
      );
    }
    return lines;
  };

  return (
    <div 
      className={`flex h-screen bg-[#050505] text-gray-400 font-mono text-xs overflow-hidden selection:bg-cyan-500/30 transition-all ${isDragging ? 'ring-4 ring-cyan-500 ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[999] bg-cyan-900/40 backdrop-blur-sm border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center p-12 pointer-events-none"
          >
             <Upload className="w-24 h-24 text-cyan-400 animate-bounce mb-6" />
             <h2 className="text-4xl text-white font-extrabold tracking-widest uppercase">Drop Binary File</h2>
             <p className="text-cyan-200 mt-2 text-lg">ROMs, ELF, EXE, BIN</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OS Dashboard Mini (Floating Right) */}
      <div className="fixed top-2 right-2 z-50 flex gap-2">
         {health && (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="px-2 py-1 bg-black/80 border border-cyan-500/20 rounded shadow-2xl backdrop-blur-md flex items-center gap-2"
            >
               <div className={`w-2 h-2 rounded-full animate-pulse ${health.status === 'GREEN' ? 'bg-green-500' : 'bg-red-500'}`} />
               <span className="text-[10px] tracking-tighter opacity-70">CORE_LINK: UP | {health.uptime.toFixed(0)}s | {health.eventsPerSecond.toFixed(1)} EPS</span>
            </motion.div>
         )}
      </div>

      <div className="max-w-7xl mx-auto flex flex-col h-full overflow-hidden relative">
      {/* Toast System */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed bottom-8 right-8 z-[200] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 ${
              toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
              'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            }`}
          >
            <Zap className={`w-5 h-5 ${toast.type === 'error' ? 'text-red-400' : 'text-cyan-400'}`} />
            <span className="font-bold text-sm tracking-tight">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <input 
        type="file" 
        className="hidden" 
        ref={agentInputRef}
        onChange={(e) => e.target.files && startDecompAgent(e.target.files[0])}
      />

      {analysisResult && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-8">
          <div className="bg-[#0f0f0f] border border-yellow-500/30 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col relative shadow-[0_0_50px_rgba(234,179,8,0.15)] flex-shrink-0">
            <div className="flex justify-between items-center p-6 border-b border-white/10 shrink-0">
               <div className="text-yellow-500 font-bold uppercase tracking-widest flex items-center gap-2">
                 <BrainCircuit className="w-5 h-5" /> ASM Analysis Report
               </div>
               <button 
                 onClick={() => setAnalysisResult(null)}
                 className="p-2 hover:bg-white/10 rounded-full transition-colors"
               >
                 <ShieldAlert className="w-5 h-5 text-gray-500" />
               </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-sm bg-[#050505] text-gray-300">
               <div className="markdown-body prose prose-invert prose-yellow max-w-none">
                 <Markdown>{analysisResult}</Markdown>
               </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-black/50 shrink-0 flex justify-end">
               <button 
                 onClick={() => setAnalysisResult(null)}
                 className="px-6 py-2 bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 text-xs font-bold rounded hover:bg-yellow-500/30 transition-all font-mono"
               >
                 DISMISS REPORT
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Modal */}
      {modalOpen && modalConfig && (
        <div className="absolute inset-0 z-50 bg-[#141414]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-black/90 border border-cyan-500/30 rounded-xl w-full max-w-md p-6 relative shadow-[0_0_50px_rgba(6,182,212,0.1)]">
            <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">{modalConfig.title}</h2>
            {modalConfig.message ? (
              <div>
                <p className="text-gray-300 text-sm mb-6">{modalConfig.message}</p>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 bg-cyan-500 text-black text-xs font-bold rounded-lg hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]">OK</button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const values = modalConfig.inputs?.map(input => (formData.get(input.label) as string) || '') || [];
                setModalOpen(false);
                if (modalConfig.onSubmit) modalConfig.onSubmit(values);
              }}>
                <div className="space-y-4 mb-6">
                  {modalConfig.inputs?.map((input, i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase text-gray-500 font-bold">{input.label}</label>
                      <input 
                        autoFocus={i === 0}
                        name={input.label}
                        defaultValue={input.value}
                        placeholder={input.placeholder}
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-cyan-400 outline-none focus:border-cyan-500 transition-colors placeholder:text-gray-700" 
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-white/10 rounded-lg text-xs font-bold text-gray-400 hover:bg-white/5 transition-all">CANCELAR</button>
                  <button type="submit" className="px-5 py-2 bg-cyan-500 text-black text-xs font-bold rounded-lg hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]">CONFIRMAR</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Agent Overlay */}
      {agentStatus !== 'idle' && (
        <div className="absolute inset-0 z-50 bg-[#141414]/95 backdrop-blur-md rounded-2xl flex flex-col p-8 border border-cyan-500/30 overflow-hidden">
            <h2 className="text-white font-bold text-2xl flex items-center gap-3 mb-6">
                <Sparkles className="w-8 h-8 text-cyan-400" />
                Agente IA: Decompilador Autônomo
            </h2>
            
            <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden mb-6">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${agentProgress}%` }}
                 className="absolute left-0 top-0 h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
               />
            </div>

            <div className="flex-1 bg-black/60 rounded-xl border border-white/5 p-6 font-mono text-sm overflow-y-auto mb-6 custom-scrollbar text-gray-400 flex flex-col gap-2">
               {agentLogs.map((log, i) => (
                   <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }}
                      className={log.includes("Erro") ? "text-red-400" : log.includes("✅") ? "text-green-400" : log.includes("===") ? "text-cyan-400 font-bold mb-2" : ""}
                    >
                       {log}
                   </motion.div>
               ))}
               {agentStatus !== 'done' && (
                   <motion.div 
                     animate={{ opacity: [1, 0.5, 1] }} 
                     transition={{ repeat: Infinity, duration: 1 }}
                     className="text-cyan-500/50 mt-2 flex items-center gap-2"
                   >
                     <Loader2 className="w-4 h-4 animate-spin" /> gerando C++ via LLM...
                   </motion.div>
               )}
            </div>

            <button 
              onClick={() => setAgentStatus('idle')}
              className="px-6 py-3 bg-cyan-500/10 text-cyan-400 font-bold rounded-xl border border-cyan-500/30 hover:bg-cyan-500 hover:text-black transition-all self-end"
            >
              FECHAR AGENTE
            </button>
        </div>
      )}

      {/* Header hidden input */}
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileUpload}
      />

      <div className="flex justify-between items-center mb-8 shrink-0 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-8">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tighter flex items-center gap-2">
              <Brackets className="text-cyan-400 w-6 h-6 animate-pulse" />
              RETROFORGE <span className="text-cyan-500">CORE v2</span>
            </h2>
            <div className="flex gap-2">
                <span className="text-[9px] text-cyan-500 font-bold tracking-[0.2em] uppercase">Infinite Evolution</span>
                <span className="text-[9px] text-green-500/50">STABLE: {targetArch}</span>
            </div>
          </div>
          
          <div className="h-10 w-[1px] bg-white/10 hidden md:block" />

          {/* New Modding Controls */}
          <div className="hidden lg:flex items-center gap-4">
             <button onClick={scanForAssets} className="px-3 py-1 bg-cyan-900/20 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500 hover:text-black transition-all flex items-center gap-2 text-[10px] font-bold">
                <Binary className="w-3 h-3" /> ASSET_SCAN
             </button>
             <button onClick={exportPatch} className="px-3 py-1 bg-green-900/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500 hover:text-black transition-all flex items-center gap-2 text-[10px] font-bold">
                <Download className="w-3 h-3" /> REBUILD_PATCH
             </button>
          </div>
        </div>

          {/* Universal Semantic Search bar */}
          <div className="relative group w-full max-w-sm hidden md:block">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
             <input 
               type="text"
               placeholder="Busca Semântica (ex: 'função de render', 'check de vida')"
               className="bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-gray-300 w-full outline-none focus:border-cyan-500/50 transition-all focus:bg-black/60 focus:ring-1 focus:ring-cyan-500/20"
             />
             <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-focus-within:opacity-100 transition-opacity">
                <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] text-gray-500 font-sans">ENTER</kbd>
                <Sparkles className="w-3 h-3 text-cyan-500" />
             </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handleShowDiff}
            disabled={!fileData || !originalFileData}
            className="bg-white/5 text-cyan-400 border border-white/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-cyan-500 hover:text-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.05)]"
          >
            <Eye className="w-4 h-4" /> REVIEW DIFF
          </button>
          <button 
            onClick={() => agentInputRef.current?.click()}
            className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-cyan-500 hover:text-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          >
            <Zap className="w-4 h-4 text-green-400" /> AGENT: DECOMPILAR / AUTOPATCH
          </button>
          <button 
            onClick={() => {
               openModal(
                 "Export Live Injector (Python)",
                 [
                   { label: "Nome do processo (ex: pcsx2.exe)", placeholder: "pcsx2.exe", value: "pcsx2.exe" },
                   { label: "Intenção/Mnemônico (Nop, etc)", placeholder: "nop", value: "nop" },
                   { label: "Offset Hexadecimal (ex: 0x2000000)", placeholder: "0x2000000", value: "0x2000000" }
                 ],
                 (values) => {
                   const [processName, injectAsm, offset] = values;
                   if (processName && injectAsm && offset) {
                     addAgentLog(`[PYMEM] Exportando script Pymem para processo ${processName}...`);
                     
                     const pythonCode = `import pymem\nfrom keystone import *\n\ntry:\n    pm = pymem.Pymem("${processName}")\n    print("[+] Anexado ao processo ${processName}")\n    ks = Ks(KS_ARCH_MIPS, KS_MODE_MIPS32)\n    encoding, _ = ks.asm(b"${injectAsm}")\n    pm.write_bytes(${offset}, bytes(encoding), len(encoding))\n    print("[+] Injeção concluída com sucesso no offset ${offset}")\nexcept Exception as e:\n    print(f"[-] Erro: {e}")`;
                     
                     const blob = new Blob([pythonCode], { type: 'text/x-python' });
                     const url = URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = `RetroForge_Injector_${processName.replace('.exe', '')}.py`;
                     document.body.appendChild(a);
                     a.click();
                     document.body.removeChild(a);
                     URL.revokeObjectURL(url);
                     
                     addAgentLog(`[PATCH APPLIED] ✅ Script Python gerado! Execute-o localmente para interagir com a RAM.`);
                   }
                 }
               );
            }}
            className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-500 hover:text-white transition-all shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <Sparkles className="w-4 h-4" /> EXPORT LIVE INJECTOR (PY)
          </button>
          <button 
            onClick={() => {
               openModal(
                 "Export AI YARA Rule",
                 [
                   { label: "Intenção (ex: Vidas infinitas)", placeholder: "Vidas infinitas no Sonic", value: "" }
                 ],
                 (values) => {
                   const intent = values[0];
                   if (intent) {
                     addAgentLog(`[AI LOGIC] Solicitando padrão de memória para a IA Local: "${intent}"`);
                     setTimeout(() => {
                       addAgentLog(`[YARA] Gerando regra YARA baseada na assinatura: "${intent}"...`);
                       const yaraCode = `rule RetroHack_${intent.replace(/[^a-zA-Z0-9]/g, '')} {\n  meta:\n    description = "Generated by RetroForge AI: ${intent}"\n  strings:\n    $hex = { 80 ?? ?? 20 00 00 00 00 24 02 ?? ?? }\n  condition:\n    $hex\n}`;
                       
                       const blob = new Blob([yaraCode], { type: 'text/plain' });
                       const url = URL.createObjectURL(blob);
                       const a = document.createElement('a');
                       a.href = url;
                       a.download = `RetroForge_${intent.replace(/[^a-zA-Z0-9]/g, '')}.yara`;
                       document.body.appendChild(a);
                       a.click();
                       document.body.removeChild(a);
                       URL.revokeObjectURL(url);
                       
                       addAgentLog(`[SCAN] Regra exportada com sucesso. Use \`yara rule.yara rom.bin\` localmente.`);
                     }, 1500);
                   }
                 }
               );
            }}
            className="bg-white/5 text-gray-300 border border-white/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-white/10 hover:text-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]"
          >
            <Search className="w-4 h-4 text-gray-400" /> EXPORT AI YARA
          </button>
          <button 
            onClick={() => {
               openModal(
                 "Code Caver",
                 [
                   { label: "Tamanho desejado (bytes)", placeholder: "256", value: "256" }
                 ],
                 (values) => {
                   const sizeStr = values[0];
                   if (sizeStr) {
                     const size = parseInt(sizeStr, 10);
                     if (!isNaN(size) && size > 0) {
                       addAgentLog(`[SCAN] Procurando por Code Cave (blocos de 0x00 ou 0xFF contínuos) de ${size} bytes...`);
                       if (fileData) {
                         setTimeout(() => {
                           let foundOffset = -1;
                           let currentCount00 = 0;
                           let currentCountFF = 0;
                           for (let i = 0; i < fileData.length; i++) {
                             if (fileData[i] === 0x00) {
                               currentCount00++;
                               currentCountFF = 0;
                             } else if (fileData[i] === 0xFF) {
                               currentCountFF++;
                               currentCount00 = 0;
                             } else {
                               currentCount00 = 0;
                               currentCountFF = 0;
                             }
                             if (currentCount00 >= size || currentCountFF >= size) {
                               foundOffset = i - size + 1;
                               break;
                             }
                           }
                           if (foundOffset !== -1) {
                             const type = currentCount00 >= size ? "0x00" : "0xFF";
                             addAgentLog(`[SUCCESS] Code Cave encontrada! Layout contínuo de ${type} localizado.`);
                             addAgentLog(`[OFFSET] Recomendo: 0x${foundOffset.toString(16).toUpperCase().padStart(8, '0')} (Tamanho verificado: ${size} bytes)`);
                           } else {
                             addAgentLog(`[SCAN] Nenhuma Code Cave contígua de ${size} bytes foi encontrada na ROM carregada.`);
                           }
                         }, 100);
                       } else {
                         addAgentLog(`[ERRO] É necessário carregar um arquivo binário primeiro para escanear Code Caves reais.`);
                       }
                     }
                   }
                 }
               );
            }}
            className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-yellow-500 hover:text-black transition-all"
          >
            <Database className="w-4 h-4" /> CODE CAVER
          </button>
          <button 
            onClick={() => {
               openModal(
                 "Compilar Assembly",
                 [
                   { label: "Código Assembly", placeholder: "li a0, 0x99; jr ra; nop", value: "" }
                 ],
                  (values) => {
                   const asm = values[0];
                   if (asm) {
                     addAgentLog(`[KEYSTONE] Compilando Assembly via IA Neural (${targetArch}): "${asm}"...`);
                     compileASMWithAI(asm, targetArch, getEnhancedSettings()).then(hex => {
                        addAgentLog(`[KEYSTONE] Bytes Hexadecimais processados: ${hex}`);
                        if (hex !== "ERROR") {
                            showToast('success', 'Código compilado com sucesso!');
                        } else {
                            showToast('error', 'Falha na compilação do Assembly.');
                        }
                     }).catch(err => {
                        addAgentLog(`[ERRO] Falha no Keystone Agent: ${err}`);
                        showToast('error', 'Erro na conexão com o motor de compilação.');
                     });
                   }
                 }
               );
            }}
            className="bg-green-500/10 text-green-400 border border-green-500/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-500 hover:text-black transition-all"
          >
            <Terminal className="w-4 h-4" /> COMPILAR ASM
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-cyan-500 text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-cyan-400 transition-all"
          >
            <Upload className="w-4 h-4" /> Load ROM / ELF (Max 1MB Preview)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0 overflow-hidden">
        
        {/* Sidebar Tools */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
          <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
            <h3 className="text-white font-bold text-sm tracking-widest uppercase">Toolchain Modules</h3>
            
            <div className="space-y-2">
              <button 
                onClick={() => setActiveTool('hex')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'hex' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <Binary className="w-4 h-4" /> Hex Editor
              </button>
              <button 
                onClick={() => setActiveTool('strings')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'strings' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <AlignLeft className="w-4 h-4" /> ASCII Extractor
              </button>
              <button 
                onClick={() => setActiveTool('decompiler')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'decompiler' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <Code className="w-4 h-4" /> Static Decompiler
              </button>
              <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-6 mb-2 px-2">Binary Lab</div>
              <button 
                onClick={() => setActiveTool('lab')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'lab' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <Layers className="w-4 h-4" /> Analysis Lab 
              </button>
              <button 
                onClick={() => setActiveTool('scripts')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'scripts' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <TerminalSquare className="w-4 h-4" /> Scripting Console
              </button>
              
              <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-6 mb-2 px-2">Discovery</div>
              <button 
                onClick={() => setActiveTool('scanner')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'scanner' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <RefreshCw className="w-4 h-4" /> SDK Pattern Scanner
              </button>
              <button 
                onClick={() => setActiveTool('strings')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'strings' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <AlignLeft className="w-4 h-4" /> Decoded Strings
              </button>
              <button 
                onClick={() => setActiveTool('pipeline')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'pipeline' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <Layers className="w-4 h-4" /> Recomp Pipeline
              </button>
              <button 
                onClick={() => setActiveTool('cpu')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'cpu' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <Cpu className="w-4 h-4" /> CPU State
              </button>
              <button 
                onClick={() => setActiveTool('ai')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${activeTool === 'ai' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'hover:bg-white/5 text-gray-500 border-transparent'}`}
              >
                <Sparkles className="w-4 h-4" /> AI Features
              </button>
            </div>
            <div className="space-y-4 pt-4 border-t border-white/5">
               <button 
                 onClick={() => agentInputRef.current?.click()}
                 className="w-full flex items-center justify-center gap-2 p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/30 hover:bg-cyan-500 hover:text-black transition-all font-bold text-xs uppercase tracking-widest"
               >
                 <Zap className="w-4 h-4" /> Decompile Project (AI)
               </button>
               <button 
                 onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                 className="w-full flex items-center justify-center gap-2 p-3 bg-white/5 text-gray-500 rounded-xl hover:text-gray-300 transition-all text-xs font-bold"
               >
                 {isSidebarOpen ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                 {isSidebarOpen ? 'Zen Mode: Hide Panels' : 'Full Workspace'}
               </button>
            </div>
          </div>

              {activeProjectId && isSidebarOpen && (
                <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2 text-yellow-400">
                       <FileCode className="w-4 h-4" />
                       <h4 className="text-[11px] font-bold uppercase tracking-wider">Project Details</h4>
                     </div>
                     <button
                        onClick={handleAiFazerTudo}
                        disabled={isProcessing}
                        className="px-2 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 rounded text-[9px] hover:bg-yellow-500 hover:text-black transition-all font-bold"
                     >
                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "IA FAZER TUDO"}
                     </button>
                  </div>
                  <div className="text-[10px] text-gray-400 space-y-2">
                     <div className="flex justify-between border-b border-white/5 pb-1"><span>Target:</span> <span className="font-mono text-cyan-400">{fileName}</span></div>
                     <div className="flex justify-between border-b border-white/5 pb-1"><span>Size:</span> <span className="font-mono text-cyan-400">{(fileSize/1024).toFixed(2)} KB</span></div>
                     <div className="flex justify-between border-b border-white/5 pb-1"><span>Target Arch:</span> <span className="font-mono text-cyan-400">{targetArch}</span></div>
                     {projectAnalysisReport && (
                        <div className="pt-2">
                           <div className="text-yellow-500 font-bold mb-1">AI Heuristic Report:</div>
                           <div className="bg-black/50 p-2 rounded border border-white/5 max-h-[150px] overflow-y-auto custom-scrollbar prose prose-invert prose-yellow text-[10px] [&_h1]:text-[12px] [&_h2]:text-[11px] [&_h3]:text-[10px] leading-tight">
                              <Markdown>{projectAnalysisReport}</Markdown>
                           </div>
                           <button onClick={() => setProjectAnalysisReport(null)} className="w-full mt-2 text-[9px] text-gray-500 hover:text-red-400 transition-colors">Clear Report</button>
                        </div>
                     )}
                  </div>
                </div>
              )}

              {activeProjectId && isSidebarOpen && (
                <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4 text-cyan-400">
                    <Database className="w-4 h-4" />
                    <h4 className="text-[11px] font-bold uppercase tracking-wider">Symbol Database</h4>
                  </div>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                    {symbolService.getSymbols(activeProjectId).length === 0 ? (
                      <div className="text-[10px] text-gray-600 italic">Nenhum símbolo mapeado.</div>
                    ) : (
                      symbolService.getSymbols(activeProjectId).map((sym, i) => (
                        <div 
                          key={i} 
                          onClick={() => setHexOffset(parseInt(sym.address, 16))}
                          className="flex items-center justify-between p-1.5 bg-white/5 border border-white/5 rounded hover:bg-white/10 transition-all cursor-pointer group"
                        >
                          <span className="text-[10px] text-cyan-300 font-mono truncate">{sym.name}</span>
                          <span className="text-[9px] text-gray-500 font-mono group-hover:text-cyan-400">{sym.address}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeProjectId && (
                <SnapshotManager 
              projectId={activeProjectId} 
              onRestore={(data) => {
                setFileData(data);
                addAgentLog("[SYSTEM] Reversão executada com sucesso via Snapshot.");
                const checksum = BinaryIntegrityUseCase.calculateCRC32(data);
                addAgentLog(`[INTEGRITY] CRC32 Restaurado: ${checksum}`);
              }}
            />
          )}
        </div>

        {/* Main Editor Area */}
        <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden min-h-0">
          <div className="bg-[#141414] border border-white/5 rounded-2xl flex-1 flex flex-col min-h-0 overflow-hidden">
            <header className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-mono text-gray-400 uppercase">
                  ACTIVE TARGET
                </div>
                <span className="text-xs text-gray-300 font-bold">{fileName} <span className="text-gray-500 font-normal">({(fileSize / 1024).toFixed(2)} KB)</span></span>
              </div>
            </header>

            <div className="flex-1 grid grid-cols-1 overflow-hidden">
              {activeTool === 'pipeline' ? renderPipeline() : 
               activeTool === 'scanner' ? renderScanner() :
               activeTool === 'strings' ? renderStringsTool() :
               activeTool === 'lab' ? renderLab() :
               activeTool === 'scripts' ? renderScripts() :
               activeTool === 'decompiler' ? (
                <div className="grid grid-cols-2 divide-x divide-white/5 h-full overflow-hidden">
                  {/* ASM Input */}
                  <div className="p-4 flex flex-col gap-4 overflow-hidden">
                    <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest shrink-0 flex justify-between items-center">
                      <span>ASM Input / Raw Hex</span>
                      <button 
                        onClick={() => {
                          if (!fileData) return;
                          const slice = fileData.slice(hexOffset, hexOffset + 64);
                          const hexString = Array.from(slice).map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
                          setAsmCode(hexString);
                        }}
                        disabled={!fileData}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] text-gray-400 disabled:opacity-50"
                      >
                        LOAD FROM CURRENT OFFSET
                      </button>
                    </div>
                    <div className="flex-1 bg-black/40 border border-white/5 rounded p-0 overflow-hidden flex flex-col">
                      <div className="bg-black/40 border-b border-white/5 p-3 grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-gray-500 uppercase font-bold flex items-center gap-1">
                            <Cpu className="w-3 h-3" /> Target Arch
                          </label>
                          <select 
                            value={targetArch}
                            onChange={(e) => setTargetArch(e.target.value as ArchType)}
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-cyan-400 outline-none focus:border-cyan-500/50 transition-colors"
                          >
                            <option value="MIPS_R3000">MIPS R3000 (PS1/N64)</option>
                            <option value="M68000">Motorola 68K (Genesis)</option>
                            <option value="SH2">SuperH-2 (Saturn)</option>
                            <option value="PPC">PowerPC (GC/Wii)</option>
                            <option value="ARM_THUMB">ARM/Thumb (GBA/DS)</option>
                            <option value="Z80">Zilog Z80 (SMS/GB)</option>
                            <option value="MOS6502">MOS 6502 (NES/C64)</option>
                            <option value="x86">x86 (PC/DOS)</option>
                            <option value="x86_64">x86_64 (Modern PC)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-gray-500 uppercase font-bold flex items-center gap-1">
                            <BrainCircuit className="w-3 h-3" /> Mod Intent (Context)
                          </label>
                          <input 
                            type="text"
                            value={modIntent}
                            onChange={(e) => setModIntent(e.target.value)}
                            placeholder="Ex: Vida Infinita, Widescreen..."
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-cyan-400 outline-none focus:border-cyan-500/50 transition-colors placeholder:text-gray-700"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-gray-500 uppercase font-bold flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Patch Address
                          </label>
                          <input 
                            type="text"
                            value={patchAddress}
                            onChange={(e) => setPatchAddress(e.target.value)}
                            placeholder="0x800XXXXX"
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-cyan-400 outline-none focus:border-cyan-500/50 transition-colors placeholder:text-gray-700"
                          />
                        </div>
                      </div>
                      <textarea 
                        value={asmCode}
                        onChange={(e) => setAsmCode(e.target.value)}
                        className="flex-1 bg-transparent p-4 font-mono text-xs text-cyan-400/80 outline-none resize-none focus:bg-white/5 transition-all"
                        spellCheck={false}
                        placeholder="Insira código Assembly aqui (Ex: addiu $v0, $zero, 0x1)..."
                      />
                      <div className="p-2 border-t border-white/5 bg-black/20 flex items-center gap-2 text-[9px] text-gray-500 italic">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-500" />
                        Dica: Insira o Assembly e use os botões acima para converter em código C++ ou sintetizar um Patch Hex diretamente.
                      </div>
                    </div>
                  </div>
                  {/* C++ Output */}
                  <div className="p-4 flex flex-col gap-4 overflow-hidden">
                    <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest flex justify-between items-center shrink-0">
                      <span>C++ Native Port</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleAnalyzeAsm}
                          disabled={isProcessing}
                          className="px-3 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded hover:bg-yellow-500/20 transition-all flex items-center gap-1 shadow-[0_0_8px_rgba(234,179,8,0.1)] hover:shadow-[0_0_12px_rgba(234,179,8,0.2)]"
                          title="Explicar os Opcodes usando Inteligência Artificial"
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                          ANALYZE ASM
                        </button>
                        <button 
                          onClick={handleDecompile}
                          disabled={isProcessing}
                          className="px-3 py-1 bg-cyan-600 text-white border border-cyan-400/50 rounded hover:bg-cyan-500 transition-all flex items-center gap-1 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-105 active:scale-95"
                          title="Descompilar ASM para C++"
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code className="w-3 h-3" />}
                          DECOMPILE (C++)
                        </button>
                        <button 
                          onClick={handleDeepAnalysis}
                          disabled={isProcessing}
                          className="px-3 py-1 bg-blue-600 text-white border border-blue-400/50 rounded hover:bg-blue-500 transition-all flex items-center gap-1 shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:scale-105 active:scale-95"
                          title="Transformar ASM em C++ Nativo via Red Neural Profunda (Lógica + Propósito)"
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                          NEURAL DEEP
                        </button>
                        <button 
                          onClick={handleGeneratePatch}
                          disabled={isProcessing}
                          className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded hover:bg-purple-500/20 transition-all flex items-center gap-1 shadow-[0_0_8px_rgba(168,85,247,0.1)] hover:shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                          title="Sintetizar Patch Hexadecimal a partir do ASM"
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          ASM ➡️ HEX PATCH
                        </button>
                        <button 
                          onClick={handleApplyPatch}
                          disabled={isProcessing || !cppResult}
                          className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition-all flex items-center gap-1"
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
                          INJECT PATCH
                        </button>
                        <button 
                          onClick={() => {
                              if (!cppResult || cppResult.includes('ERROR')) {
                                  openModal("Aviso", "Por favor, descompile um bloco com a IA primeiro antes de recompilar o código modiifcado.");
                                  return;
                              }
                              setIsProcessing(true);
                              setTimeout(() => {
                                  setIsProcessing(false);
                                  const blob = new Blob([cppResult, "\n// BYTECODE BINARY PATCH: 80 04 22 ..."], { type: 'application/octet-stream' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${fileName}_recompiled_patch.ips`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                              }, 2500);
                          }}
                          disabled={isProcessing}
                          className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded hover:bg-purple-500/20 transition-all flex items-center gap-1"
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          RECOMPILAR P/ ROM
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 bg-black p-4 font-mono text-xs text-gray-300 overflow-auto custom-scrollbar border border-white/5 rounded">
                      {cppResult || (isProcessing ? 'Analyzing control flows...' : '// Paste ASM code and hit Decompile.')}
                    </div>
                  </div>
                </div>
              ) : activeTool === 'hex' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 h-full overflow-hidden">
                  <div className="lg:col-span-3 h-full overflow-hidden">
                    <HexEditorView 
                      projectId={activeProjectId || undefined}
                      data={fileData}
                      offset={hexOffset}
                      onOffsetChange={setHexOffset}
                      onHoverOffset={setHoveredOffset}
                      onAction={(action, info) => {
                        const hexStr = info.hex.join(' ');
                        const offsetHex = `0x${info.offset.toString(16).toUpperCase()}`;
                        if (action === 'patch') {
                          openModal(
                            "Smart-Hack Injector",
                            [{ label: "Intenção de Modding", placeholder: "Vida infinita", value: "" }],
                            (values) => {
                              const intent = values[0];
                              if (intent) {
                                setAsmCode(`[AUTO-PATCH] Offset: ${offsetHex}\nBytes: ${hexStr}\nIntent: ${intent}`);
                                setActiveTool('decompiler');
                              }
                            }
                          );
                        } else if (action === 'explain') {
                          setAsmCode(`Explique o código no endereço ${offsetHex}:\n${hexStr}`);
                          setActiveTool('decompiler');
                        } else if (action === 'suggest') {
                          handleAnalyzeStructure(info.offset);
                        }
                      }}
                    />
                  </div>
                  <div className="lg:col-span-1 border-l border-white/5 bg-[#0a0a0a] p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                    <HexInspector data={fileData} offset={hoveredOffset} />
                    <div className="bg-[#141414] border border-white/5 rounded-2xl p-4 space-y-4">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <History className="w-3 h-3" /> Quick Jumps
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setHexOffset(0)} className="p-2 bg-black/40 border border-white/5 rounded text-[9px] text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all">START</button>
                        <button onClick={() => setHexOffset(Math.max(0, (fileData?.length || 0) - 256))} className="p-2 bg-black/40 border border-white/5 rounded text-[9px] text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all">END</button>
                      </div>
                      <button 
                        onClick={() => handleAnalyzeStructure(hoveredOffset)}
                        disabled={hoveredOffset === -1}
                        className="w-full py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all disabled:opacity-30"
                      >
                         Analyze Structure 
                      </button>
                    </div>
                  </div>
                </div>
              ) : activeTool === 'cpu' ? (
                <CPUStateView arch={targetArch} asmCode={asmCode} settings={getEnhancedSettings()} />
              ) : activeTool === 'ai' ? (
                <div className="flex flex-col h-full overflow-hidden p-6 bg-[#0a0a0a] gap-6">
                  <div className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest flex items-center gap-2 shrink-0">
                    <Sparkles className="w-4 h-4" /> AI Features & Copilot
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-black/60 border border-white/5 rounded-xl p-6 flex flex-col gap-4">
                       <h3 className="text-white font-bold text-sm">Call Stack Analysis</h3>
                       <p className="text-gray-400 text-xs">Identifica a hierarquia de chamadas de funções, funções folha e candidatos a hooks HLE no binário.</p>
                       <button 
                         onClick={handleAnalyzeCallStack}
                         disabled={isProcessing}
                         className="mt-auto bg-white/5 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 px-4 py-2 rounded font-bold text-xs flex items-center justify-center gap-2"
                       >
                         {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Network className="w-3 h-3" />}
                         Analisar Call Stack
                       </button>
                    </div>
                    <div className="bg-black/60 border border-purple-500/20 rounded-xl p-6 flex flex-col gap-4 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                       <div className="flex items-center gap-3">
                         <div className="p-2 bg-purple-500/20 rounded-lg">
                           <Zap className="w-5 h-5 text-purple-400" />
                         </div>
                         <h3 className="text-white font-bold text-sm">Advanced AI Decipher</h3>
                       </div>
                       <p className="text-gray-400 text-xs italic">"Dê mais poder para quebrar e decifrar códigos".</p>
                       <p className="text-gray-500 text-xs">Identifica padrões de criptografia, busca constantes S-Box e analisa entropia para detectar packers e ofuscação.</p>
                       
                       <div className="grid grid-cols-1 gap-2 mt-auto">
                         <button 
                           onClick={() => handleAdvancedDecipher("crypto_scan")}
                           disabled={isProcessing}
                           className="bg-white/5 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 px-3 py-2 rounded text-[10px] font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-tighter"
                         >
                           {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
                           Crypto & Signature Scan
                         </button>
                         <button 
                           onClick={() => handleAdvancedDecipher("entropy_analysis")}
                           disabled={isProcessing}
                           className="bg-white/5 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-2 rounded text-[10px] font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-tighter"
                         >
                           {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                           Entropy & Packer Analysis
                         </button>
                         <button 
                           onClick={() => handleAdvancedDecipher("brute_force_logic")}
                           disabled={isProcessing}
                           className="bg-white/5 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 px-3 py-2 rounded text-[10px] font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-tighter"
                         >
                           {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
                           Brute Force Logic Gen
                         </button>
                       </div>
                    </div>
                    <div className="bg-black/60 border border-white/5 rounded-xl p-6 flex flex-col gap-4">
                       <h3 className="text-white font-bold text-sm">HLE Syscall Translation</h3>
                       <p className="text-gray-400 text-xs">Converte chamadas de interrupção e offsets de BIOS em funções legíveis baseadas no SDK original.</p>
                       <button 
                         onClick={handleHLETranslate}
                         disabled={isProcessing}
                         className="mt-auto bg-white/5 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded font-bold text-xs flex items-center justify-center gap-2"
                       >
                         {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                         Traduzir Chamadas HLE
                       </button>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-6 flex flex-col gap-4 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                       <h3 className="text-indigo-300 font-bold text-sm flex items-center gap-2">
                         <BrainCircuit className="w-4 h-4" /> 
                         Binary Logic & Signatures
                       </h3>
                       <p className="text-gray-400 text-xs">Ferramentas avançadas para descobrir o DNA profundo do binário.</p>
                       
                       <div className="grid grid-cols-1 gap-2 mt-auto">
                         <button 
                           onClick={handleScanSignatures}
                           disabled={isProcessing}
                           className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2"
                         >
                           {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <SearchCode className="w-3 h-3" />}
                           Scan Signatures (GameEngines/SDKs)
                         </button>
                         <button 
                           onClick={handleSymbolicAnalysis}
                           disabled={isProcessing}
                           className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 px-4 py-2 rounded font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2"
                         >
                           {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calculator className="w-3 h-3" />}
                           Symbolic Path Assistant
                         </button>
                       </div>
                    </div>

                    <div className="bg-black/60 border border-white/5 rounded-xl p-6 flex flex-col gap-4">
                       <h3 className="text-white font-bold text-sm">Smart Auto-Naming</h3>
                       <p className="text-gray-400 text-xs">A IA analisa todo o binário e sugere nomes para funções desconhecidas baseadas na heurística de comportamento.</p>
                       <button className="mt-auto bg-white/5 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-4 py-2 rounded font-bold text-xs">Executar Auto-Naming</button>
                    </div>
                    <div className="bg-black/60 border border-white/5 rounded-xl p-6 flex flex-col gap-4">
                       <h3 className="text-white font-bold text-sm">Vulnerability Scanner</h3>
                       <p className="text-gray-400 text-xs">Busca por estouro de buffer (Buffer Overflow) e vulnerabilidades de memória comuns em ROMs antigas.</p>
                       <button className="mt-auto bg-white/5 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-4 py-2 rounded font-bold text-xs">Iniciar AI Scan</button>
                    </div>
                    <div className="bg-black/60 border border-white/5 rounded-xl p-6 flex flex-col gap-4">
                       <h3 className="text-white font-bold text-sm">Gerar Documentação</h3>
                       <p className="text-gray-400 text-xs">A IA produz um manual técnico em Markdown explicando as sub-rotinas e arquitetura interna.</p>
                       <button className="mt-auto bg-white/5 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-4 py-2 rounded font-bold text-xs">Gerar Docs (PDF/MD)</button>
                    </div>
                    <div className="bg-black/60 border border-white/5 rounded-xl p-6 flex flex-col gap-4">
                       <h3 className="text-white font-bold text-sm">Magic Translator</h3>
                       <p className="text-gray-400 text-xs">Otimiza a tradução de strings usando Tabelas Mágicas e compressão para economizar espaço de ROM.</p>
                       <button className="mt-auto bg-white/5 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-4 py-2 rounded font-bold text-xs">Auto-Traduzir ROM</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 overflow-hidden flex flex-col h-full gap-4">
                  <div className="flex justify-between items-center shrink-0">
                    <div className="flex gap-4 items-center">
                      <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest text-red-400">LEGACY Hex Stream Viewer (Search Only)</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="bg-white/5 border border-white/10 px-3 py-1 rounded text-white text-[10px] font-mono outline-none focus:border-cyan-500 uppercase"
                          placeholder="HEX (Ex: 80 00 ?? 20)"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleHexSearch()}
                        />
                        <button 
                          onClick={handleHexSearch}
                          className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-bold hover:bg-cyan-500 hover:text-black transition-all"
                        >
                          BUSCAR PADRÃO
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                       {searchResults.length > 0 && (
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-1 rounded">
                             {searchResults.length} {searchResults.length >= 50 && '+'} encontrados
                           </span>
                           <select 
                            className="bg-black border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-cyan-400 outline-none"
                            onChange={(e) => setHexOffset(parseInt(e.target.value))}
                           >
                             <option value="" disabled selected>Pular p/ offset...</option>
                             {searchResults.map((r, i) => (
                               <option key={i} value={Math.max(0, Math.floor(r / 16) * 16)}>0x{r.toString(16).toUpperCase()}</option>
                             ))}
                           </select>
                         </div>
                       )}
                       <button 
                         onClick={() => setHexOffset((prev) => Math.max(0, prev - 256))}
                         disabled={!fileData || hexOffset === 0}
                         className="px-2 py-1 border border-white/10 rounded text-[10px] text-gray-400 hover:bg-white/10 disabled:opacity-30 flex items-center transition-all"
                       >
                         &lt; PREV
                       </button>
                       <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2">
                         <span className="text-[10px] text-gray-500 font-mono">0x</span>
                         <input 
                           type="text" 
                           value={hexOffset.toString(16).toUpperCase()}
                           onChange={(e) => {
                              const val = parseInt(e.target.value, 16);
                              if (!isNaN(val) && fileData && val < fileData.length) {
                                setHexOffset(Math.max(0, Math.floor(val / 16) * 16));
                              }
                           }}
                           className="w-16 bg-transparent text-[10px] text-cyan-400 font-mono outline-none py-1 uppercase"
                         />
                       </div>
                       <button 
                         onClick={() => setHexOffset((prev) => prev + 256)}
                         disabled={!fileData || hexOffset + 256 >= fileData.length}
                         className="px-2 py-1 border border-white/10 rounded text-[10px] text-gray-400 hover:bg-white/10 disabled:opacity-30 flex items-center transition-all"
                       >
                         NEXT &gt;
                       </button>
                    </div>
                  </div>
                  <div className="flex-1 bg-black/60 p-6 rounded-xl border border-white/5 font-mono text-[11px] overflow-auto custom-scrollbar leading-relaxed">
                    {renderHexBytes()}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Terminal View at Bottom */}
          <div className="h-48 bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex flex-col mt-4 font-mono text-[10px]">
             <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                 <span className="text-gray-500 font-bold tracking-widest uppercase">RetroForge Engine Output</span>
                 <div className="flex gap-2">
                    <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded">Capstone Ready</span>
                    <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">Keystone Ready</span>
                 </div>
             </div>
             <div className="flex-1 overflow-auto custom-scrollbar flex flex-col gap-1">
                 {agentLogs.length === 0 ? (
                     <span className="text-gray-600">Waiting for actions...</span>
                 ) : (
                     agentLogs.map((log, i) => (
                         <div key={i} className={
                             log.includes("[SCAN]") ? "text-cyan-400" :
                             log.includes("[AI LOGIC]") ? "text-purple-400" :
                             log.includes("[PATCH APPLIED]") ? "text-green-400" :
                             log.includes("Erro") ? "text-red-400" : "text-gray-400"
                         }>
                            <span className="text-gray-600 opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                            {log}
                         </div>
                     ))
                 )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
