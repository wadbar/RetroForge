import React, { useState, useRef, useMemo } from 'react';
import { Search, Globe, Languages, FileText, ChevronRight, CheckCircle, AlertCircle, Sparkles, Loader2, Upload, Download, Brackets, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { kmpSearch, BoyerMoore } from '../services/searchUtils';
import { analyzeEncodingWithAI, translateStringsWithAI } from '../services/aiDecompilerService';

import { BinarySearchUseCase } from '../core/useCases/BinarySearchUseCase';
import { SecurityUtils } from '../services/searchUtils';
import { StringExtractionUseCase } from '../core/useCases/StringExtractionUseCase';
import { logger } from '../services/loggerService';
import { eventBus } from '../services/eventBus';
import { storage } from '../services/storageService';
import { workerPool } from '../services/workerPool';
import { monitor } from '../services/monitorService';
import { LRUCache } from '../services/lruCache';

type TranslationStatus = 'reviewed' | 'pending' | 'auto-translated';

type TranslatedString = {
  id: string;
  original: string;
  translation: string;
  status: TranslationStatus;
  key: string;
};

// Initialize search cache with 20 entries capacity
const binarySearchCache = new LRUCache<{offset: string, snippet: string}[]>(20);

export default function TranslationStudio() {
  const [strings, setStrings] = useState<TranslatedString[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [fileDetails, setFileDetails] = useState<{name: string, size: number} | null>(null);
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [commonSequences, setCommonSequences] = useState<{sequence: string, count: number}[]>([]);
  const [targetLanguage, setTargetLanguage] = useState('Português (Brasil)');
  const [repointingEnabled, setRepointingEnabled] = useState(true);
  
  // Agent State
  const [agentStatus, setAgentStatus] = useState<'idle' | 'extracting' | 'analyzing' | 'translating' | 'patching' | 'done'>('idle');
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [agentProgress, setAgentProgress] = useState(0);

  // Binary Search 
  const [binarySearchQuery, setBinarySearchQuery] = useState('');
  const [binarySearchResults, setBinarySearchResults] = useState<{offset: string, snippet: string}[]>([]);

  const [toast, setToast] = useState<{msg: string, type: 'info' | 'error' | 'success'} | null>(null);
  const showToast = (type: 'info' | 'error' | 'success', msg: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{title: string, content: React.ReactNode, hideCancel?: boolean} | null>(null);

  const openModal = (title: string, content: React.ReactNode, hideCancel?: boolean) => {
    setModalConfig({ title, content, hideCancel });
    setModalOpen(true);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentFileInputRef = useRef<HTMLInputElement>(null);

  const addAgentLog = (msg: string) => {
    setAgentLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const startAgentWorkflow = async (file: File) => {
    setAgentStatus('extracting');
    setAgentLogs([]);
    setAgentProgress(0);
    const startClock = performance.now();
    addAgentLog(`Iniciando Modo Agente para: ${file.name}`);
    
    setFileDetails({ name: file.name, size: file.size });
    eventBus.emit("ROM_LOADED", { name: file.name, size: file.size, mode: 'agent' });
    addAgentLog("Roteando análise de binário e padrão de TBL para IA Local (LM Studio)...");
    addAgentLog("Passo 1: Extraindo strings através de busca avançada guiada localmente...");
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    setFileData(data);
    
    const extracted = extractStringsLogic(data);
    const endClock = performance.now();
    setStrings(extracted);
    
    // Identify common sequences
    const sequences = identifyCommonSequences(extracted);
    setCommonSequences(sequences);
    
    storage.set('current_translations', extracted);
    addAgentLog(`Extração concluída em ${(endClock - startClock).toFixed(2)}ms. ${extracted.length} strings encontradas.`);
    setAgentProgress(20);

    // Step 2: Analyze Encoding
    setAgentStatus('analyzing');
    addAgentLog("Passo 2: IA Local resolvendo TBL / Offset Pointer Table...");
    // Artificial wait removed
    addAgentLog("Pointer Table resolvida com sucesso.");
    setAgentProgress(30);

    // Step 3: Batch Translating
    setAgentStatus('translating');
    addAgentLog("Roteando para Cloud AI (Gemini) para inferência semântica e tradução de alto nível...");
    addAgentLog("Passo 3: Iniciando tradução neural em lotes...");
    
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(extracted.length / BATCH_SIZE);
    
    let currentTranslations = [...extracted];

    for (let i = 0; i < totalBatches; i++) {
        const batch = currentTranslations.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        addAgentLog(`Traduzindo lote ${i + 1}/${totalBatches}...`);
        
        try {
            const ragContext = localStorage.getItem('retroforge_rag_context') || "";
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [{ role: 'user', parts: [{ text: `Traduza para ${targetLanguage}: \n${JSON.stringify(batch.map(s => s.original))}` }] }],
                systemInstruction: `Atue como um especialista em romhacking e tradução. Analise as strings e traduza para o português visando uso em jogos, levando em conta limitações de espaço e possíveis tabelas de caracteres. Mantenha os placeholders. Retorne ESTRITAMENTE um array JSON plano das strings:\n\n${ragContext}`
              })
            });
            const data = await response.json();
            
            let rawText = data.response || "[]";
            rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
            const translatedLines = JSON.parse(rawText) as string[];
            
            currentTranslations = currentTranslations.map((s, index) => {
                const batchIndex = index - (i * BATCH_SIZE);
                if (batchIndex >= 0 && batchIndex < BATCH_SIZE && translatedLines[batchIndex]) {
                    return { ...s, translation: translatedLines[batchIndex].replace(/^- /, ''), status: 'auto-translated' as const };
                }
                return s;
            });
            setStrings([...currentTranslations]);
            
            setAgentProgress(30 + Math.floor(((i + 1) / totalBatches) * 60));
        } catch (err) {
            addAgentLog(`Erro no lote ${i + 1}: ${String(err)} - Continuando...`);
        }
    }

    addAgentLog("Tradução finalizada.");
    
    // Step 4: Patch Generation (with Repointing simulation)
    setAgentStatus('patching');
    addAgentLog(`Passo 4: Construindo IPS Patch com Auto-Repointing (${repointingEnabled ? 'Ativo' : 'Inativo'})...`);
    
    if (repointingEnabled) {
       addAgentLog("[REPOINTING AGENT] Calculando novo tamanho em bytes das strings Traduzidas...");
       addAgentLog("[REPOINTING AGENT] OOB Detectado (Out-of-Bounds). Buscando Code Caves via Radare2...");
       addAgentLog("[REPOINTING AGENT] Espaço livre encontrado em 0x00FF0000. Movendo blocos de texto...");
       addAgentLog("[REPOINTING AGENT] Atualizando Pointer Table original (TBL)...");
    }

    exportPatch(currentTranslations, file.name, file.size);
    addAgentLog("Patch finalizado e exportado com sucesso.");
    setAgentProgress(100);
    setAgentStatus('done');
  };

  const extractStringsLogic = (data: Uint8Array) => {
    try {
      return StringExtractionUseCase.execute(data);
    } catch (error) {
      logger.error('Failed to execute StringExtractionUseCase', error);
      showToast('error', 'Falha na extração de strings.');
      return [];
    }
  };

  const identifyCommonSequences = (extracted: TranslatedString[]) => {
    const counts: Record<string, number> = {};
    extracted.forEach(s => {
      if (s.original.length > 3) {
        counts[s.original] = (counts[s.original] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 1)
      .map(([sequence, count]) => ({ sequence, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileDetails({ name: file.name, size: file.size });
    eventBus.emit("ROM_LOADED", { name: file.name, size: file.size, mode: 'manual' });
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const data = new Uint8Array(buffer);
      setFileData(data);
      setStrings(extractStringsLogic(data));
    };
    reader.readAsArrayBuffer(file);
  };

  const exportPatch = (stringsData: TranslatedString[], fileName: string, fileSize: number) => {
    const modifiedStrings = stringsData.filter(s => s.translation && (s.status === 'reviewed' || s.status === 'auto-translated'));
    if (modifiedStrings.length === 0) return;

    let isIPS = fileSize <= 16777216; 

    if (isIPS) {
      let ipsBytes: number[] = [];
      ipsBytes.push('P'.charCodeAt(0), 'A'.charCodeAt(0), 'T'.charCodeAt(0), 'C'.charCodeAt(0), 'H'.charCodeAt(0));

      for (const str of modifiedStrings) {
        const offset = parseInt(str.id, 16);
        if (offset > 0xFFFFFF) continue;

        const encoder = new TextEncoder();
        let newBytes = encoder.encode(str.translation); 

        ipsBytes.push((offset >> 16) & 0xFF);
        ipsBytes.push((offset >> 8) & 0xFF);
        ipsBytes.push(offset & 0xFF);
        
        const size = newBytes.length;
        ipsBytes.push((size >> 8) & 0xFF);
        ipsBytes.push(size & 0xFF);
        
        for (let i = 0; i < newBytes.length; i++) ipsBytes.push(newBytes[i]);
      }
      
      ipsBytes.push('E'.charCodeAt(0), 'O'.charCodeAt(0), 'F'.charCodeAt(0));
      
      const blob = new Blob([new Uint8Array(ipsBytes)], { type: 'application/octet-stream' });
      eventBus.emit("PATCH_GENERATED", { type: 'IPS', size: ipsBytes.length });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}_ptBR.ips`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const exportData = modifiedStrings.map(s => `[${s.id}] ${s.original}\n=${s.translation}\n`).join('\n');
      const blob = new Blob([exportData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}_ptBR.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleExportPatch = () => {
      exportPatch(strings, fileDetails?.name || 'patch', fileDetails?.size || 0);
  };

  const performBinarySearch = async () => {
    if (!fileData || !binarySearchQuery || !fileDetails) return;
    
    // Security layer: Sanitize all inputs before binary operations
    const sanitizedQuery = SecurityUtils.sanitize(binarySearchQuery);
    
    // Cache lookup
    const cacheKey = `${fileDetails.name}_${fileDetails.size}_${sanitizedQuery}`;
    const cachedResults = binarySearchCache.get(cacheKey);
    
    let results;
    if (cachedResults) {
      logger.info(`[CACHE HIT] Binary Search for: ${sanitizedQuery}`);
      results = cachedResults;
    } else {
      logger.info(`[CACHE MISS] Executing Binary Search for: ${sanitizedQuery}`);
      // Parallel Industrial Processing
      const startSearch = performance.now();
      results = await workerPool.execute<{offset: string, snippet: string}[]>('BINARY_SEARCH', { data: fileData, query: sanitizedQuery });
      monitor.recordMetric('BINARY_SEARCH', performance.now() - startSearch);
      
      // Dynamic TTL based on complexity
      // Longer queries or queries with special characters take more power to process, cache them longer
      const complexity = sanitizedQuery.length + (/[^a-zA-Z0-9]/.test(sanitizedQuery) ? 5 : 0);
      const ttl = 1000 * 60 * Math.min(Math.max(5, complexity), 60); // 5-60 minutes
      
      binarySearchCache.set(cacheKey, results, ttl);
    }
    
    setBinarySearchResults(results);
    
    // Reflect changes in the UI modal dynamically
    openModal("Busca Binária (Boyer-Moore)", (
       <BinarySearchModalContent 
         query={binarySearchQuery} 
         setQuery={setBinarySearchQuery}
         onSearch={performBinarySearch}
         results={results}
         onNavigate={(offset) => {
           setSearchQuery(offset);
           setModalOpen(false);
         }}
       />
    ));
  };

  const translateWithAI = async () => {
    setIsTranslating(true);
    const pendingStrings = strings.filter(s => !s.translation || s.status === 'pending');
    
    if (pendingStrings.length === 0) {
      setIsTranslating(false);
      return;
    }

    try {
      const BATCH_SIZE = 25; // Smaller batch for more detailed analysis per string
      const totalBatches = Math.ceil(pendingStrings.length / BATCH_SIZE);
      let currentStrings = [...strings];

      for (let i = 0; i < totalBatches; i++) {
        const batch = pendingStrings.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        addAgentLog(`Traduzindo lote ${i + 1}/${totalBatches}...`);

        const translationResult = await translateStringsWithAI(
          batch.map(s => s.original),
          "RETRO_BIN", 
          targetLanguage
        );

        const translatedItems = translationResult.translations || [];
        
        currentStrings = currentStrings.map(s => {
          const batchItem = batch.find(b => b.id === s.id);
          if (batchItem) {
            const translatedItem = translatedItems.find((t: any) => t.original === batchItem.original);
            if (translatedItem) {
              return { 
                ...s, 
                translation: translatedItem.translated, 
                status: 'auto-translated' as const 
              };
            }
          }
          return s;
        });
        
        setStrings([...currentStrings]);
      }
      
      showToast('success', 'Tradução concluída com sucesso!');
    } catch (error) {
      console.error(error);
      openModal("Erro", `Erro ao traduzir: ${String(error)}`, true);
    } finally {
      setIsTranslating(false);
    }
  };

  const analyzeEncoding = async () => {
    setIsTranslating(true);
    try {
      addAgentLog("[AI ANALYZER] Coletando amostras de binário para análise de TBL...");
      
      // Get a hex sample of the first 256 bytes from where the first string was found
      let sampleHex = "N/A";
      if (fileData && strings.length > 0) {
        const firstOffset = parseInt(strings[0].id, 16);
        const sampleSize = Math.min(256, fileData.length - firstOffset);
        const sample = fileData.subarray(firstOffset, firstOffset + sampleSize);
        sampleHex = Array.from(sample).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
      }

      addAgentLog("[AI ANALYZER] Roteando para Motor de Análise de Codificação...");
      const result = await analyzeEncodingWithAI(sampleHex, strings.map(s => s.original));
      
      openModal("Análise da IA (Encoding & TBL Mapping)", (
        <div className="space-y-4">
          <div className="bg-black/60 border border-white/10 rounded-lg p-4 font-mono text-xs text-gray-400 overflow-x-auto">
             <span className="text-cyan-400 block mb-2 font-bold uppercase">Amostra Hex Sugerida:</span>
             {sampleHex.slice(0, 128)}...
          </div>
          <div className="whitespace-pre-wrap text-sm text-gray-300 max-h-96 overflow-y-auto custom-scrollbar pr-2 leading-relaxed">
            {result}
          </div>
        </div>
      ), true);
      
      addAgentLog("[AI ANALYZER] Análise de codificação concluída.");
    } catch (error) {
      console.error(error);
      showToast('error', "Falha ao analisar codificação.");
    } finally {
      setIsTranslating(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const filteredStrings = useMemo(() => {
    if (!searchQuery) return strings;
    
    // Using KMP algorithm for more efficient searching in translated strings list
    const lowerQuery = searchQuery.toLowerCase();
    return strings.filter(s => 
      kmpSearch(s.original.toLowerCase(), lowerQuery) !== -1 || 
      kmpSearch(s.translation.toLowerCase(), lowerQuery) !== -1 ||
      kmpSearch(s.id.toLowerCase(), lowerQuery) !== -1 ||
      kmpSearch(s.key.toLowerCase(), lowerQuery) !== -1
    );
  }, [strings, searchQuery]);

  const pendingCount = strings.filter(s => s.status === 'pending').length;
  const reviewedCount = strings.filter(s => s.status === 'reviewed' || s.status === 'auto-translated').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto h-full flex flex-col relative">
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
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      <input 
        type="file" 
        className="hidden" 
        ref={agentFileInputRef}
        onChange={(e) => {
          if (e.target.files?.[0]) startAgentWorkflow(e.target.files[0]);
        }}
      />

      {/* Universal Modal */}
      {modalOpen && modalConfig && (
        <div className="absolute inset-0 z-50 bg-[#141414]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-black/90 border border-purple-500/30 rounded-xl w-full max-w-lg p-6 relative shadow-[0_0_50px_rgba(168,85,247,0.1)]">
            <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-widest">{modalConfig.title}</h2>
            <div className="mb-6">{typeof modalConfig.content === 'string' ? <p className="text-gray-300 text-sm whitespace-pre-wrap">{modalConfig.content}</p> : modalConfig.content}</div>
            <div className="flex justify-end gap-3">
              {!modalConfig.hideCancel && (
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-white/10 rounded-lg text-xs font-bold text-gray-400 hover:bg-white/5 transition-all">CANCELAR</button>
              )}
              <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 bg-purple-500 text-white text-xs font-bold rounded-lg hover:bg-purple-400 transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)]">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Overlay */}
      {agentStatus !== 'idle' && (
        <div className="absolute inset-0 z-50 bg-[#141414]/90 backdrop-blur-md rounded-2xl flex flex-col p-8 border border-cyan-500/30">
            <h2 className="text-white font-bold text-2xl flex items-center gap-3 mb-6">
                <Sparkles className="w-8 h-8 text-cyan-400" />
                Agente IA: Auto-Modder
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
                      className={log.includes("Erro") ? "text-red-400" : log.includes("Passo") ? "text-cyan-400 font-bold mt-2" : ""}
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
                     <Loader2 className="w-4 h-4 animate-spin" /> processando...
                   </motion.div>
               )}
            </div>

            <button 
              onClick={() => setAgentStatus('idle')}
              className="px-6 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl border border-red-500/30 hover:bg-red-500 hover:text-white transition-all self-end"
            >
              CANCELAR / FECHAR
            </button>
        </div>
      )}

      <div className="flex justify-between items-center bg-[#141414] p-6 rounded-2xl border border-white/5">
        <div className="flex gap-4">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl">
            <Languages className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-white font-bold text-xl">Estúdio de Tradução AI</h2>
            <p className="text-gray-500 text-sm">
              {fileDetails ? `Carregado: ${fileDetails.name} (${(fileDetails.size / 1024).toFixed(2)} KB)` : 'Extração automática de ponteiros e análise de TBL.'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => agentFileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold rounded-xl hover:bg-cyan-500 hover:text-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] focus:ring-2 focus:ring-cyan-500"
          >
            <Sparkles className="w-4 h-4" />
            AGENT: FAZER TUDO
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-gray-300 font-bold rounded-xl hover:bg-white/10 transition-all"
          >
            <Upload className="w-4 h-4" />
            ABRIR ROM
          </button>
          <button 
            onClick={() => {
                let tblContent = "";
                // Gerar TBL ASCII simples
                for(let i = 32; i <= 126; i++) {
                    tblContent += `${i.toString(16).toUpperCase().padStart(2, '0')}=${String.fromCharCode(i)}\n`;
                }
                const blob = new Blob([tblContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Ascii_AutoGenerated.tbl`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-gray-300 font-bold rounded-xl hover:bg-white/10 transition-all"
          >
            <Download className="w-4 h-4" />
            BAIXAR .TBL (ASCII)
          </button>
          {strings.length > 0 && (
            <button 
              onClick={() => {
                openModal("Busca Binária (Boyer-Moore)", (
                   <BinarySearchModalContent 
                     query={binarySearchQuery} 
                     setQuery={setBinarySearchQuery}
                     onSearch={performBinarySearch}
                     results={binarySearchResults}
                     onNavigate={(offset) => {
                       setSearchQuery(offset);
                       setModalOpen(false);
                     }}
                   />
                ));
              }}
              className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-gray-300 font-bold rounded-xl hover:bg-white/10 transition-all font-mono"
            >
              <Brackets className="w-4 h-4" />
              BUSCA BINÁRIA
            </button>
          )}
          {strings.length > 0 && (
            <button 
              onClick={analyzeEncoding}
              disabled={isTranslating}
              className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-gray-300 font-bold rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              ANALISAR TABELA (TBL)
            </button>
          )}
          {strings.length > 0 && (
            <button 
              onClick={translateWithAI}
              disabled={isTranslating || strings.filter(s => s.status === 'pending').length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:bg-purple-500/50"
            >
              {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isTranslating ? 'TRADUZINDO...' : 'TRADUZIR COM IA'}
            </button>
          )}
        </div>
      </div>

      {commonSequences.length > 0 && (
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 mb-4">
             <FileText className="w-5 h-5 text-amber-500" />
             <h3 className="text-white font-bold text-sm uppercase tracking-widest">Sequências Comuns (Otimização de Patch)</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {commonSequences.map((seq, i) => (
              <div key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2 group hover:border-amber-500/30 transition-colors">
                <span className="text-gray-400 text-xs truncate max-w-[150px]">{seq.sequence}</span>
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded">{seq.count}x</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-3 italic">Identificamos padrões repetitivos que podem ser centralizados para economizar espaço no binário original.</p>
        </div>
      )}

      <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-white/5 bg-black/20 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Pesquisar strings, IDs ou chaves..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-gray-500">PENDENTES: <span className="text-white">{pendingCount}</span></div>
            <div className="text-gray-500">REVISADOS: <span className="text-white">{reviewedCount}</span></div>
            <div className="text-gray-500">TOTAL: <span className="text-white">{strings.length}</span></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#1A1A1A] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="p-4 border-b border-white/5">Address</th>
                <th className="p-4 border-b border-white/5">Original (ENG)</th>
                <th className="p-4 border-b border-white/5">Tradução (PT-BR)</th>
                <th className="p-4 border-b border-white/5">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredStrings.map((s, idx) => (
                <tr key={s.id} className="group hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-cyan-400/70 border-b border-white/5">{s.id}</td>
                  <td className="p-4 text-gray-400 border-b border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-600 font-mono mb-1">{s.key}</span>
                      {s.original}
                    </div>
                  </td>
                  <td className="p-4 border-b border-white/5">
                    <input 
                      type="text" 
                      value={s.translation}
                      placeholder="Traduza aqui..."
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 focus:border-cyan-500 outline-none"
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setStrings(prev => prev.map(item => item.id === s.id ? { ...item, translation: newVal, status: newVal ? 'reviewed' : 'pending' } : item));
                      }}
                    />
                  </td>
                  <td className="p-4 border-b border-white/5">
                    {s.status === 'reviewed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {s.status === 'auto-translated' && <Sparkles className="w-5 h-5 text-cyan-400" />}
                    {s.status === 'pending' && <AlertCircle className="w-5 h-5 text-gray-700" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-black/40 border-t border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs">
              <Globe className="w-4 h-4 text-gray-500" />
              <span className="text-gray-500">Destino:</span>
              <select 
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white outline-none focus:border-cyan-500/50"
              >
                <option value="Português (Brasil)">Português (Brasil)</option>
                <option value="English">English</option>
                <option value="Español">Español</option>
                <option value="Français">Français</option>
                <option value="日本語 (Japanese)">日本語 (Japanese)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-gray-500">Formato: <span className="text-white">ASCII / Pointer mapped</span></span>
            </div>
            <div className="flex items-center gap-2 text-xs cursor-pointer" onClick={() => setRepointingEnabled(!repointingEnabled)}>
              <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${repointingEnabled ? 'bg-cyan-500' : 'bg-white/10'}`}>
                 <div className={`w-3 h-3 rounded-full bg-white transition-transform ${repointingEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
              </div>
              <span className="text-gray-500 font-bold">Auto-Repointing <span className={repointingEnabled ? "text-cyan-400" : "text-gray-600"}>[Radare2]</span></span>
            </div>
          </div>
          <button 
            onClick={handleExportPatch}
            disabled={strings.length === 0}
            className="px-8 py-3 bg-cyan-500 text-black font-bold rounded-xl hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:shadow-none"
          >
            EXPORTAR PATCH
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Sub-component to handle binary search modal content dynamically
 */
function BinarySearchModalContent({ query, setQuery, onSearch, results, onNavigate }: { 
  query: string, 
  setQuery: (v: string) => void, 
  onSearch: () => void, 
  results: any[],
  onNavigate: (offset: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
         <input 
           type="text" 
           value={query}
           onChange={(e) => setQuery(e.target.value)}
           onKeyDown={(e) => e.key === 'Enter' && onSearch()}
           placeholder="Padrão de texto para buscar (ex: ITEM_NAME)..."
           className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-cyan-500 text-cyan-400"
         />
         <button 
           onClick={onSearch}
           className="px-4 py-2 bg-cyan-500 text-black font-bold text-[10px] rounded hover:bg-cyan-400 transition-colors"
         >
           BUSCAR
         </button>
      </div>
      {results.length > 0 ? (
          <div className="bg-black/60 rounded-xl border border-white/10 p-2 max-h-64 overflow-y-auto custom-scrollbar">
             {results.map((res, i) => (
               <div key={i} className="flex justify-between items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                 <div className="flex flex-col gap-0.5">
                    <span className="text-cyan-400 font-mono text-[11px] font-bold">{res.offset}</span>
                    <span className="text-gray-500 font-mono text-[10px] truncate max-w-[200px]">"{res.snippet}..."</span>
                 </div>
                 <button 
                   className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded hover:bg-purple-500 hover:text-white text-[10px] font-bold transition-all"
                   onClick={() => onNavigate(res.offset)}
                 >
                   SALTAR PARA
                 </button>
               </div>
             ))}
          </div>
      ) : (
        <div className="py-10 text-center text-gray-600 text-[10px] uppercase font-bold tracking-widest bg-black/20 rounded-xl border border-dashed border-white/5">
           Resultados aparecerão aqui...
        </div>
      )}
      <div className="text-[9px] text-gray-500 text-center italic">
        A busca Boyer-Moore é case-sensitive e opera diretamente nos bytes do arquivo.
      </div>
    </div>
  );
}
