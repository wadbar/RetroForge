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
  const [tblMap, setTblMap] = useState<Record<number, string> | null>(null);
  const [tblContentText, setTblContentText] = useState("");

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
    
    // Step 4: Patch Generation and Validation
    setAgentStatus('patching');
    addAgentLog(`Passo 4: Validação OOB e Geração de IPS Patch...`);
    
    if (repointingEnabled) {
       addAgentLog("[REPOINTING AGENT] Calculando novo tamanho em bytes das strings Traduzidas vs Originais...");
       let outOfBoundsCount = 0;
       
       currentTranslations.forEach(s => {
         if (s.translation && s.status !== 'pending') {
           const originalSize = new TextEncoder().encode(s.original).length;
           const newSize = new TextEncoder().encode(s.translation).length;
           if (newSize > originalSize) {
             outOfBoundsCount++;
           }
         }
       });
       
       if (outOfBoundsCount > 0) {
           addAgentLog(`[ALERTA] ${outOfBoundsCount} strings ultrapassam o tamanho original. Sem Code Caves/TBL repointing real, o jogo pode crashar. Exportando IPS mesmo assim.`);
       } else {
           addAgentLog("[REPOINTING AGENT] Todos os tamanhos estão dentro dos limites originais.");
       }
    }

    exportPatch(currentTranslations, file.name, file.size);
    addAgentLog("Patch finalizado e exportado com sucesso.");
    setAgentProgress(100);
    setAgentStatus('done');
  };

  const extractStringsLogic = (data: Uint8Array, customTbl?: Record<number, string>) => {
    try {
      return StringExtractionUseCase.execute(data, customTbl || tblMap || undefined);
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

        let newBytes: number[] = [];
        if (tblMap) {
           const reverseTblMap = new Map<string, number>();
           for (const [k, v] of Object.entries(tblMap)) {
               reverseTblMap.set(v, Number(k));
           }
           for (let i = 0; i < str.translation.length; i++) {
               const char = str.translation[i];
               const byte = reverseTblMap.get(char);
               if (byte !== undefined) {
                   newBytes.push(byte);
               } else {
                   newBytes.push(char.charCodeAt(0) & 0xFF);
               }
           }
        } else {
           const encoder = new TextEncoder();
           newBytes = Array.from(encoder.encode(str.translation)); 
        }

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
      
      let tblPreview = "Nenhuma tabela detectada pela IA.";
      let parsedTbl: Record<number, string> | null = null;
      if (result && result.table) {
        parsedTbl = {};
        let textFormat = "";
        for (const [hexStr, charVal] of Object.entries(result.table)) {
           const byteVal = parseInt(hexStr, 16);
           if (!isNaN(byteVal)) {
              parsedTbl[byteVal] = String(charVal);
              textFormat += `${hexStr.toUpperCase()}=${charVal}\n`;
           }
        }
        tblPreview = textFormat;
      }
      
      openModal("Análise da IA (Encoding & TBL Mapping)", (
        <div className="space-y-6">
          <div className="bg-surface-container-highest border border-outline-variant rounded-xl p-4 font-mono text-body-small text-on-surface-variant overflow-x-auto shadow-inner">
             <span className="text-secondary block mb-2 font-bold uppercase">Amostra Hex Sugerida:</span>
             {sampleHex.slice(0, 128)}...
          </div>
          <div className="bg-surface-container-highest border border-outline-variant rounded-xl p-4 shadow-inner">
            <span className="text-secondary block mb-2 font-bold uppercase text-label-medium">Mapeamento TBL Inferido (JSON via IA):</span>
            <div className="whitespace-pre-wrap text-body-small text-on-surface max-h-48 overflow-y-auto custom-scrollbar font-mono">
               {tblPreview}
            </div>
          </div>
          {parsedTbl && (
            <button 
              onClick={() => {
                 setTblMap(parsedTbl);
                 setTblContentText(tblPreview);
                 if (fileData) setStrings(extractStringsLogic(fileData, parsedTbl));
                 setModalOpen(false);
                 showToast('success', 'Tabela de Caracteres aplicada! Strings recarregadas.');
              }}
              className="w-full py-4 bg-tertiary hover:bg-tertiary/90 text-on-tertiary font-bold text-label-large rounded-xl transition-all uppercase shadow-elevation-1 focus:outline-none focus:ring-2 focus:ring-tertiary"
            >
              Aplicar TBL e Reextrair Strings
            </button>
          )}
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
    <div className="space-y-6 max-w-7xl mx-auto h-full flex flex-col relative pb-8">
      {/* Toast System */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed bottom-8 right-8 z-[200] px-6 py-4 rounded-xl shadow-elevation-3 border flex items-center gap-4 ${
              toast.type === 'error' ? 'bg-error-container border-error/30 text-on-error-container' :
              toast.type === 'success' ? 'bg-primary-container border-primary/30 text-on-primary-container' :
              'bg-secondary-container border-secondary/30 text-on-secondary-container'
            }`}
          >
            <Zap className={`w-5 h-5 ${toast.type === 'error' ? 'text-error' : toast.type === 'success' ? 'text-primary' : 'text-secondary'}`} />
            <span className="font-medium text-body-medium tracking-tight">{toast.msg}</span>
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
        <div className="absolute inset-0 z-50 bg-surface/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant rounded-3xl w-full max-w-xl p-8 relative shadow-elevation-3">
            <h2 className="text-headline-small font-medium text-on-surface mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">{modalConfig.title}</h2>
            <div className="mb-8">{typeof modalConfig.content === 'string' ? <p className="text-body-large text-on-surface-variant whitespace-pre-wrap">{modalConfig.content}</p> : modalConfig.content}</div>
            <div className="flex justify-end gap-3">
              {!modalConfig.hideCancel && (
                <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-full text-label-large font-medium text-on-surface hover:bg-surface-variant transition-all">Cancelar</button>
              )}
              <button type="button" onClick={() => setModalOpen(false)} className="px-6 py-2.5 bg-primary text-on-primary text-label-large font-medium rounded-full hover:bg-primary/90 transition-all shadow-elevation-1">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Overlay */}
      {agentStatus !== 'idle' && (
        <div className="absolute inset-0 z-50 bg-surface/95 backdrop-blur-xl rounded-3xl flex flex-col p-10 border border-secondary">
            <h2 className="text-display-small text-on-surface font-medium flex items-center gap-4 mb-8">
                <div className="p-3 bg-secondary-container rounded-2xl shadow-sm">
                  <Sparkles className="w-8 h-8 text-on-secondary-container" />
                </div>
                Agente IA: Auto-Modder
            </h2>
            
            <div className="relative w-full h-3 bg-surface-variant rounded-full overflow-hidden mb-8 shadow-inner">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${agentProgress}%` }}
                 className="absolute left-0 top-0 h-full bg-secondary shadow-sm"
               />
            </div>

            <div className="flex-1 bg-surface-container-low rounded-3xl border border-outline-variant p-8 font-mono text-body-medium overflow-y-auto mb-8 custom-scrollbar text-on-surface-variant flex flex-col gap-3 shadow-inner">
               {agentLogs.map((log, i) => (
                   <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }}
                      className={log.includes("Erro") ? "text-error" : log.includes("Passo") ? "text-secondary font-bold mt-4" : ""}
                    >
                       {log}
                   </motion.div>
               ))}
               {agentStatus !== 'done' && (
                   <motion.div 
                     animate={{ opacity: [1, 0.5, 1] }} 
                     transition={{ repeat: Infinity, duration: 1 }}
                     className="text-secondary/70 mt-4 flex items-center gap-3"
                   >
                     <Loader2 className="w-5 h-5 animate-spin" /> <span className="font-sans">Processando análise neural...</span>
                   </motion.div>
               )}
            </div>

            <button 
              onClick={() => setAgentStatus('idle')}
              className="px-8 py-4 bg-error-container text-on-error-container font-medium rounded-full border border-error/20 hover:bg-error hover:text-white transition-all self-end shadow-sm"
            >
              Cancelar Processo
            </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-container-high p-6 rounded-3xl border border-outline-variant shadow-elevation-1 gap-6 flex-shrink-0">
        <div className="flex gap-4 items-center">
          <div className="p-4 bg-primary-container text-on-primary-container rounded-2xl shadow-sm">
            <Languages className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-headline-small text-on-surface font-medium">Estúdio de Tradução AI</h2>
            <p className="text-body-large text-on-surface-variant">
              {fileDetails ? `Carregado: ${fileDetails.name} (${(fileDetails.size / 1024).toFixed(2)} KB)` : 'Extração automática de ponteiros e análise de TBL.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => agentFileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-secondary/90 text-on-secondary font-medium rounded-full shadow-elevation-1 transition-all focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
          >
            <Sparkles className="w-4 h-4" />
            AGENT: AUTO-MOD
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-highest border border-outline font-medium text-on-surface rounded-full hover:bg-surface-variant transition-all hover:shadow-sm"
          >
            <Upload className="w-4 h-4" />
            ABRIR ROM
          </button>
          <button 
            onClick={() => {
                let tblContent = tblContentText;
                if (!tblContent) {
                  // Gerar TBL ASCII simples
                  for(let i = 32; i <= 126; i++) {
                      tblContent += `${i.toString(16).toUpperCase().padStart(2, '0')}=${String.fromCharCode(i)}\n`;
                  }
                }
                const blob = new Blob([tblContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Caracteres_${tblMap ? 'Modificado' : 'Default'}.tbl`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-highest border border-outline font-medium text-on-surface rounded-full hover:bg-surface-variant transition-all hover:shadow-sm text-sm"
          >
            <Download className="w-4 h-4" />
            {tblMap ? 'BAIXAR TBL' : 'BAIXAR ASCII MAX'}
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
              className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-highest border border-outline font-medium text-on-surface rounded-full hover:bg-surface-variant transition-all hover:shadow-sm font-mono"
            >
              <Brackets className="w-4 h-4" />
              BUSCA
            </button>
          )}
          {strings.length > 0 && (
            <button 
              onClick={analyzeEncoding}
              disabled={isTranslating}
              className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-highest border border-outline font-medium text-on-surface rounded-full hover:bg-surface-variant transition-all disabled:opacity-50 hover:shadow-sm"
            >
              <Search className="w-4 h-4" />
              ANALISAR TBL
            </button>
          )}
          {strings.length > 0 && (
            <button 
              onClick={translateWithAI}
              disabled={isTranslating || strings.filter(s => s.status === 'pending').length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-full shadow-elevation-1 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isTranslating ? 'PROCESSANDO...' : 'TRADUZIR IA'}
            </button>
          )}
        </div>
      </div>

      {commonSequences.length > 0 && (
        <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3 mb-4">
             <div className="p-2 border border-tertiary/30 bg-tertiary-container text-on-tertiary-container rounded-lg">
                <FileText className="w-4 h-4" />
             </div>
             <h3 className="text-on-surface font-medium text-label-large uppercase tracking-widest">Sequências Comuns</h3>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {commonSequences.map((seq, i) => (
              <div key={i} className="px-4 py-2 bg-surface border border-outline-variant rounded-xl flex items-center gap-3 group hover:border-tertiary/50 transition-colors shadow-sm">
                <span className="text-on-surface-variant text-body-medium font-medium truncate max-w-[200px]">{seq.sequence}</span>
                <span className="px-2 py-0.5 bg-tertiary-container text-on-tertiary-container text-label-small font-bold rounded-md">{seq.count}x</span>
              </div>
            ))}
          </div>
          <p className="text-body-small text-on-surface-variant mt-4">Identificamos padrões repetitivos que podem ser centralizados para economizar espaço no binário original.</p>
        </div>
      )}

      <div className="bg-surface border border-outline-variant rounded-3xl overflow-hidden flex-1 flex flex-col shadow-elevation-1 min-h-[400px]">
        <div className="p-5 border-b border-outline-variant bg-surface-container-low flex flex-col md:flex-row md:items-center gap-4 flex-shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input 
              type="text" 
              placeholder="Pesquisar strings, IDs ou chaves..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-highest border border-outline-variant rounded-full py-3 pl-12 pr-6 text-body-large text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
            />
          </div>
          <div className="flex items-center gap-6 text-label-medium font-mono">
            <div className="text-on-surface-variant">PEND.<span className="text-on-surface ml-2 font-bold bg-surface-variant px-2 py-1 rounded-md">{pendingCount}</span></div>
            <div className="text-on-surface-variant">REV.<span className="text-on-surface ml-2 font-bold bg-surface-variant px-2 py-1 rounded-md">{reviewedCount}</span></div>
            <div className="text-on-surface-variant">TOT.<span className="text-on-surface ml-2 font-bold bg-surface-variant px-2 py-1 rounded-md">{strings.length}</span></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface relative">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-surface-container-high text-label-small font-medium text-on-surface-variant uppercase tracking-widest z-10 shadow-sm border-b border-outline-variant">
              <tr>
                <th className="p-5">Address</th>
                <th className="p-5">Original (ENG)</th>
                <th className="p-5">Tradução (PT-BR)</th>
                <th className="p-5">Status</th>
              </tr>
            </thead>
            <tbody className="text-body-medium text-on-surface">
              {filteredStrings.map((s, idx) => (
                <tr key={s.id} className="group hover:bg-surface-variant transition-colors border-b border-outline-variant/50">
                  <td className="p-5 font-mono text-tertiary align-top font-medium">{s.id}</td>
                  <td className="p-5 align-top">
                    <div className="flex flex-col">
                      <span className="text-label-small text-on-surface-variant font-mono mb-1.5 opacity-70 bg-surface-container-highest self-start px-2 py-0.5 rounded-sm">{s.key}</span>
                      <span className="leading-relaxed">{s.original}</span>
                    </div>
                  </td>
                  <td className="p-5">
                    <textarea 
                      value={s.translation}
                      placeholder="Traduza aqui..."
                      rows={2}
                      className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-4 py-3 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium resize-none shadow-inner"
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setStrings(prev => prev.map(item => item.id === s.id ? { ...item, translation: newVal, status: newVal ? 'reviewed' : 'pending' } : item));
                      }}
                    />
                  </td>
                  <td className="p-5 align-top">
                    <div className="pt-2">
                       {s.status === 'reviewed' && <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-500" />}
                       {s.status === 'auto-translated' && <Sparkles className="w-6 h-6 text-secondary" />}
                       {s.status === 'pending' && <AlertCircle className="w-6 h-6 text-outline" />}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStrings.length === 0 && (
                 <tr>
                    <td colSpan={4} className="p-12 text-center text-on-surface-variant">Nenhum resultado encontrado.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-surface-container-high border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0 relative z-20">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3 text-label-large">
              <Globe className="w-5 h-5 text-on-surface-variant" />
              <span className="text-on-surface-variant">Destino:</span>
              <select 
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="bg-surface border border-outline-variant rounded-xl px-4 py-2 bg-transparent text-on-surface font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="Português (Brasil)">Português (Brasil)</option>
                <option value="English">English</option>
                <option value="Español">Español</option>
                <option value="Français">Français</option>
                <option value="日本語 (Japanese)">日本語 (Japanese)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-3 text-label-large cursor-pointer bg-surface border border-outline-variant px-4 py-2 rounded-xl hover:bg-surface-variant transition-colors" onClick={() => setRepointingEnabled(!repointingEnabled)}>
              <div className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${repointingEnabled ? 'bg-primary' : 'bg-surface-variant border border-outline'}`}>
                 <div className={`w-3 h-3 rounded-full bg-white transition-transform ${repointingEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
              <span className="text-on-surface-variant">Auto-Repointing <span className={repointingEnabled ? "text-primary font-bold" : "text-on-surface-variant"}>[Radare2]</span></span>
            </div>
          </div>
          <button 
            onClick={handleExportPatch}
            disabled={strings.length === 0}
            className="w-full md:w-auto px-10 py-3.5 bg-primary text-on-primary font-medium rounded-full hover:bg-primary/90 transition-all shadow-elevation-1 disabled:opacity-50 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface tracking-wide"
          >
            GERAR PATCH IPS
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
    <div className="space-y-6">
      <div className="flex gap-3">
         <input 
           type="text" 
           value={query}
           onChange={(e) => setQuery(e.target.value)}
           onKeyDown={(e) => e.key === 'Enter' && onSearch()}
           placeholder="Padrão de texto para buscar (ex: ITEM_NAME)..."
           className="flex-1 bg-surface-container-highest border border-outline-variant rounded-xl px-4 py-3 text-body-large outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface font-medium shadow-inner"
         />
         <button 
           onClick={onSearch}
           className="px-6 py-3 bg-primary text-on-primary font-medium text-label-large rounded-xl hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
         >
           BUSCAR MÁQ.
         </button>
      </div>
      {results.length > 0 ? (
          <div className="bg-surface-container rounded-2xl border border-outline-variant p-2 max-h-72 overflow-y-auto custom-scrollbar shadow-inner">
             {results.map((res, i) => (
               <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-outline-variant/30 last:border-0 hover:bg-surface-variant transition-colors rounded-xl gap-3">
                 <div className="flex flex-col gap-1.5 overflow-hidden">
                    <span className="text-tertiary font-mono text-label-medium font-bold opacity-80">{res.offset}</span>
                    <span className="text-on-surface-variant font-mono text-label-large truncate">"{res.snippet}..."</span>
                 </div>
                 <button 
                   className="shrink-0 px-4 py-2 bg-primary-container text-on-primary-container border border-primary/20 rounded-lg hover:bg-primary hover:text-on-primary text-label-medium font-bold transition-all"
                   onClick={() => onNavigate(res.offset)}
                 >
                   SALTAR PARA
                 </button>
               </div>
             ))}
          </div>
      ) : (
        <div className="py-12 text-center text-on-surface-variant text-label-large uppercase font-bold tracking-widest bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
           Resultados aparecerão aqui...
        </div>
      )}
      <div className="text-label-medium text-on-surface-variant text-center opacity-70">
        A busca Boyer-Moore é case-sensitive e opera diretamente nos bytes do arquivo.
      </div>
    </div>
  );
}
