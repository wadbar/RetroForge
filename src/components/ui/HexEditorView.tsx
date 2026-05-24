import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Zap, Terminal, BrainCircuit, Bookmark, Search, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { symbolService } from '../../services/symbolService';
import { debounce } from '../../utils/debounce';

interface HexEditorProps {
  projectId?: string;
  data: Uint8Array | null;
  originalData?: Uint8Array | null;
  showDiff?: boolean;
  onToggleDiff?: (enabled: boolean) => void;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onAction: (action: 'patch' | 'explain' | 'suggest', data: { offset: number, hex: string[] }) => void;
  onHoverOffset?: (offset: number) => void;
}

/**
 * HexEditorView - Specialized view for low-level binary manipulation.
 */
export const HexEditorView: React.FC<HexEditorProps> = ({ 
  projectId, 
  data, 
  originalData, 
  showDiff, 
  onToggleDiff,
  offset, 
  onOffsetChange, 
  onAction, 
  onHoverOffset 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegexMode, setIsRegexMode] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../../core/workers/fuzzy.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current.onmessage = (e) => {
        setIsSearching(false);
        if (e.data.type === 'SUCCESS') {
          setSearchResults(e.data.results);
        } else {
          console.error('[Worker Error]', e.data.message);
        }
      };
    } catch (e) {
      console.warn("Failed to initialize worker", e);
    }
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const runSearch = useCallback((query: string, searchData: Uint8Array, regexMode: boolean) => {
    if (!searchData || !query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    workerRef.current?.postMessage({ query, data: searchData, isRegex: regexMode });
    
    setSearchHistory(prev => {
      const history = [query, ...prev.filter(q => q !== query)].slice(0, 10);
      return history;
    });
  }, []);

  const debouncedSearch = useMemo(() => debounce(runSearch, 300), [runSearch]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val) {
      setSearchResults([]);
      setIsSearching(false);
    } else if (data) {
      setIsSearching(true);
      debouncedSearch(val, data, isRegexMode);
    }
  };

  const toggleRegexMode = () => {
    const newMode = !isRegexMode;
    setIsRegexMode(newMode);
    if (searchQuery && data) {
      setIsSearching(true);
      debouncedSearch(searchQuery, data, newMode);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };


  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-on-surface-variant text-body-medium">
        Carregue um arquivo binário para visualizar o stream hexadecimal.
      </div>
    );
  }

  const bytesPerLine = 16;
  const maxLines = 20;

  const calculateEntropy = (lineData: Uint8Array) => {
    const counts = new Uint32Array(256);
    for(const b of lineData) counts[b]++;
    let h = 0;
    for(const c of counts) {
      if(c > 0) {
        const p = c / lineData.length;
        h -= p * Math.log2(p);
      }
    }
    return h / 8;
  };

  const renderHexBytes = () => {
    const lines = [];
    
    for (let i = 0; i < maxLines; i++) {
      const lineOffset = offset + (i * bytesPerLine);
      if (lineOffset >= data.length) break;

      const hexBytes: string[] = [];
      const asciiChars: string[] = [];
      const diffFlags: boolean[] = [];
      
      for (let j = 0; j < bytesPerLine; j++) {
        const currentIdx = lineOffset + j;
        if (currentIdx < data.length) {
          const byte = data[currentIdx];
          hexBytes.push(byte.toString(16).padStart(2, '0').toUpperCase());
          asciiChars.push((byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.');
          
          if (showDiff && originalData && currentIdx < originalData.length) {
            diffFlags.push(byte !== originalData[currentIdx]);
          } else {
            diffFlags.push(false);
          }
        } else {
          hexBytes.push('  ');
          asciiChars.push(' ');
          diffFlags.push(false);
        }
      }

      const lineOffsetHex = lineOffset.toString(16).toUpperCase();
      const symbol = projectId ? symbolService.getSymbolAt(projectId, `0x${lineOffsetHex}`) : undefined;
      
      const lineDataSlice = data.slice(lineOffset, Math.min(lineOffset + bytesPerLine, data.length));
      const entropy = calculateEntropy(lineDataSlice);

      lines.push(
        <div key={i} className="flex gap-4 hover:bg-surface-variant px-2 py-1 rounded transition-colors group relative items-center">
          <div className="w-1.5 h-6 rounded-full bg-outline-variant overflow-hidden flex flex-col justify-end" title={`Entropy: ${(entropy * 100).toFixed(1)}%`}>
            <div className={`w-full transition-all duration-500 rounded-full ${entropy > 0.8 ? 'bg-error' : entropy > 0.5 ? 'bg-primary' : 'bg-secondary'}`} style={{ height: `${entropy * 100}%`, opacity: 0.4 + (entropy * 0.6) }} />
          </div>
          <div className="flex items-center gap-1 w-20">
            <span className={`text-on-surface-variant group-hover:text-primary transition-colors font-mono ${symbol ? 'text-primary font-bold' : ''}`}>
              {lineOffsetHex.padStart(8, '0')}
            </span>
            {symbol && <Bookmark className="w-2.5 h-2.5 text-primary fill-primary/20" />}
          </div>
          
          <div className="grid grid-cols-16 gap-1 flex-1">
            {hexBytes.map((hex, idx) => {
              const isDiff = diffFlags[idx];
              const currentPos = lineOffset + idx;
              const isPadding = hex === '00' || hex === 'FF';
              const isSearchResult = searchResults.some(res => currentPos >= res && currentPos < res + (searchQuery.replace(/\\s+/g, '').length / 2));
              
              let classes = "text-center cursor-crosshair rounded font-mono text-body-medium transition-all duration-300 ";
              if (isSearchResult) {
                 classes += "bg-tertiary text-on-tertiary font-bold shadow-[0_0_8px_var(--md-sys-color-tertiary)] ";
              } else if (isDiff) {
                 classes += "bg-errorContainer text-onErrorContainer underline decoration-dotted ";
              } else if (isPadding) {
                 classes += "text-on-surface-variant opacity-30 ";
              } else {
                 classes += "text-primary ";
              }

              return (
                <span 
                  key={idx} 
                  className={classes}
                  onMouseEnter={() => onHoverOffset?.(currentPos)}
                  title={isDiff && originalData ? `Original: ${originalData[currentPos]?.toString(16).toUpperCase()}` : undefined}
                >
                  {hex}
                </span>
              );
            })}
          </div>
          
          <span className="text-on-surface-variant w-32 font-mono whitespace-pre opacity-60 group-hover:opacity-100 transition-opacity">{asciiChars.join('')}</span>
          
          <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-surface-container-high px-2 py-1 rounded shadow-lg z-10">
            <button 
              className="text-[10px] text-primary hover:text-on-primary border border-primary/30 hover:bg-primary px-2 py-1 rounded flex items-center gap-1 transition-all font-medium uppercase tracking-wider"
              onClick={() => onAction('patch', { offset: lineOffset, hex: hexBytes })}
            >
              <Zap className="w-3 h-3" /> Patch
            </button>
            <button 
              className="text-[10px] text-secondary hover:text-on-secondary border border-secondary/30 hover:bg-secondary px-2 py-1 rounded flex items-center gap-1 transition-all font-medium uppercase tracking-wider"
              onClick={() => onAction('explain', { offset: lineOffset, hex: hexBytes })}
            >
              <Terminal className="w-3 h-3" /> Explain
            </button>
            <button 
              className="text-[10px] text-tertiary hover:text-on-tertiary border border-tertiary/30 hover:bg-tertiary px-2 py-1 rounded flex items-center gap-1 transition-all font-medium uppercase tracking-wider"
              onClick={() => onAction('suggest', { offset: lineOffset, hex: hexBytes })}
            >
              <BrainCircuit className="w-3 h-3" /> Suggest
            </button>
          </div>
        </div>
      );
    }
    return lines;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 bg-surface">
       <div className="flex flex-col gap-4 mb-4 shrink-0">
         <div className="flex justify-between items-center">
           <div className="flex items-center gap-3">
             <div className="text-label-medium text-on-surface-variant font-bold uppercase tracking-widest">Hex Stream Controller</div>
             {originalData && onToggleDiff && (
               <button 
                 onClick={() => onToggleDiff(!showDiff)}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-label-small font-bold transition-all ${showDiff ? 'bg-error text-on-error border-error shadow-[0_0_10px_var(--md-sys-color-error)]' : 'bg-surface-variant text-on-surface-variant border-transparent hover:bg-outline-variant'}`}
               >
                 <Zap className={`w-4 h-4 ${showDiff ? 'fill-on-error' : ''}`} />
                 DIFF: {showDiff ? 'ON' : 'OFF'}
               </button>
             )}
           </div>
           <div className="flex items-center gap-2">
             <button 
                onClick={() => onOffsetChange(Math.max(0, offset - (bytesPerLine * maxLines)))}
                className="m3-button-tonal !px-4 !py-1.5 disabled:opacity-30"
                disabled={offset === 0}
             >
               PREV
             </button>
             <div className="flex items-center gap-2 bg-surface-variant border border-outline-variant rounded-full px-4 py-1">
               <span className="text-label-medium text-on-surface-variant font-mono">0x</span>
               <input 
                 type="text" 
                 value={offset.toString(16).toUpperCase()}
                 onChange={(e) => {
                   const val = parseInt(e.target.value, 16);
                   if (!isNaN(val)) onOffsetChange(val);
                 }}
                 className="w-20 bg-transparent text-label-large text-primary font-mono outline-none uppercase"
               />
             </div>
             <button 
                onClick={() => onOffsetChange(offset + (bytesPerLine * maxLines))}
                className="m3-button-tonal !px-4 !py-1.5"
             >
               NEXT
             </button>
           </div>
         </div>
         
         <div className="flex flex-col gap-2 bg-surface-container border border-outline-variant rounded-2xl px-4 py-2 relative overflow-hidden">
            <AnimatePresence>
              {isSearching && (
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="absolute top-0 left-0 bottom-0 w-1/3 bg-primary/10 blur-xl pointer-events-none"
                />
              )}
            </AnimatePresence>             <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 relative z-10">
                 <Search className="w-4 h-4 text-on-surface-variant" />
                 <button 
                   onClick={toggleRegexMode}
                   className={`px-2 py-0.5 rounded text-[10px] font-bold ${isRegexMode ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant'} transition-colors`}
                   title="Toggle Regex Mode"
                 >
                   .*
                 </button>
                 <input 
                   type="text"
                   placeholder={isRegexMode ? "Regex Search (e.g. EA.+00)" : "Fuzzy Search Hex (e.g. 24 ?? ?? 80)"}
                   value={searchQuery}
                   onChange={handleQueryChange}
                   className="flex-1 bg-transparent border-none outline-none text-body-medium text-on-surface font-mono"
                 />
                 {searchQuery && (
                   <button 
                     onClick={clearSearch} 
                     className="p-1 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
                     disabled={isSearching}
                   >
                     <X className="w-3.5 h-3.5" />
                   </button>
                 )}
              </div>
              <div className="flex items-center gap-3 relative z-10">
                {searchResults.length > 0 && (
                  <span className="text-label-medium text-primary font-bold">
                    {searchResults.length > 50 ? '50+ Matches' : `${searchResults.length} Match(es)`}
                  </span>
                )}
                {isSearching && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                {searchResults.length > 0 && (
                   <div className="flex gap-1 border-l border-outline-variant pl-3">
                      <button 
                         className="text-on-surface-variant hover:text-primary transition-colors text-label-small font-bold px-2 py-1 bg-surface-variant rounded"
                         onClick={() => onOffsetChange(Math.max(0, Math.floor(searchResults[0] / 16) * 16))}
                      >
                         GO TO FIRST
                      </button>
                   </div>
                )}
              </div>
            </div>
            {searchHistory.length > 0 && (
               <div className="flex gap-2 mt-2 pt-2 border-t border-outline-variant overflow-x-auto no-scrollbar relative z-10">
                 {searchHistory.map((hist, idx) => (
                   <span 
                     key={idx} 
                     onClick={() => {
                        setSearchQuery(hist);
                        if (data) {
                           setIsSearching(true);
                           debouncedSearch(hist, data, isRegexMode);
                        }
                     }}
                     className="text-[10px] cursor-pointer bg-surface hover:bg-surface-variant text-on-surface-variant font-mono px-2 py-0.5 rounded border border-outline-variant whitespace-nowrap"
                   >
                     {hist}
                   </span>
                 ))}
               </div>
            )}
            {isSearching && (
              <div className="h-0.5 w-full bg-surface-variant overflow-hidden absolute bottom-0 left-0">
                <motion.div 
                   className="h-full bg-primary"
                   initial={{ x: '-100%' }}
                   animate={{ x: '100%' }}
                   transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                />
              </div>
            )}
         </div>
       </div>

       <div className="flex-1 overflow-auto custom-scrollbar flex flex-col border border-outline-variant bg-surface-container-low rounded-2xl p-4 m3-card">
          <div className="space-y-1">
            {renderHexBytes()}
          </div>
       </div>
    </div>
  );
};

