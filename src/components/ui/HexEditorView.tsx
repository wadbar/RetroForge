import React, { useState } from 'react';
import { Zap, Terminal, BrainCircuit, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';
import { symbolService } from '../../services/symbolService';

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
  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
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

  const calculatePatternMatch = (currentPos: number) => {
    if (!data || currentPos + 8 >= data.length) return 0;
    // Simple heuristic for repetitive patterns/alignment
    let matches = 0;
    for (let i = 0; i < 4; i++) {
      if (data[currentPos + i] === data[currentPos + i + 4]) matches++;
    }
    return matches / 4;
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
        <div key={i} className="flex gap-4 hover:bg-white/5 px-2 py-1 rounded transition-colors group relative items-center">
          <div className="w-1.5 h-6 rounded-full bg-white/5 overflow-hidden flex flex-col justify-end" title={`Entropy: ${(entropy * 100).toFixed(1)}%`}>
            <div className={`w-full transition-all duration-500 rounded-full ${entropy > 0.8 ? 'bg-red-500' : entropy > 0.5 ? 'bg-yellow-500' : 'bg-cyan-500'}`} style={{ height: `${entropy * 100}%`, opacity: 0.4 + (entropy * 0.6) }} />
          </div>
          <div className="flex items-center gap-1 w-20">
            <span className={`text-gray-500 group-hover:text-cyan-400 transition-colors font-mono ${symbol ? 'text-cyan-400 font-bold' : ''}`}>
              {lineOffsetHex.padStart(8, '0')}
            </span>
            {symbol && <Bookmark className="w-2.5 h-2.5 text-cyan-400 fill-cyan-400/20" />}
          </div>
          <span className="text-cyan-400/80 flex-1 space-x-2 tracking-widest group-hover:text-cyan-400 transition-colors font-mono">
            {hexBytes.map((hex, idx) => {
              const isDiff = diffFlags[idx];
              const currentPos = lineOffset + idx;
              
              // Simple pattern detection: NOP (0x00 for many systems) or padding
              const isPadding = hex === '00' || hex === 'FF';
              
              const patternIntensity = calculatePatternMatch(currentPos);
              
              const pointerInfo = (() => {
                if (idx % 4 !== 0 || currentPos + 3 >= data.length) return null;
                const val = (data[currentPos] << 24) | (data[currentPos+1] << 16) | (data[currentPos+2] << 8) | data[currentPos+3];
                if (val >= 0x80000000 && val < 0x80400000) return `Ponteiro Detectado: 0x${val.toString(16).toUpperCase()}`;
                return null;
              })();

              return (
                <span 
                  key={idx} 
                  className={`cursor-crosshair px-0.5 rounded transition-all duration-300 ${isPadding ? 'opacity-30' : ''} ${isDiff ? 'bg-amber-500/30 text-amber-300 underline decoration-dotted' : ''} ${pointerInfo ? 'text-cyan-300 ring-1 ring-cyan-500/20 shadow-[0_0_5px_rgba(6,182,212,0.1)]' : ''}`}
                  onMouseEnter={() => onHoverOffset?.(currentPos)}
                  title={pointerInfo || (isDiff && originalData ? `Original: ${originalData[currentPos].toString(16).toUpperCase()}` : undefined)}
                >
                  {hex}
                </span>
              );
            })}
          </span>
          <span className="text-gray-400 w-32 font-mono whitespace-pre group-hover:text-white transition-colors">{asciiChars.join('')}</span>
          
          <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-black/80 px-2 py-1 rounded shadow shadow-black z-10">
            <button 
              className="text-[9px] text-green-400 hover:text-white border border-green-500/30 hover:bg-green-500/50 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
              onClick={() => onAction('patch', { offset: lineOffset, hex: hexBytes })}
            >
              <Zap className="w-2.5 h-2.5" /> Auto-Patch
            </button>
            <button 
              className="text-[9px] text-purple-400 hover:text-white border border-purple-500/30 hover:bg-purple-500/50 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
              onClick={() => onAction('explain', { offset: lineOffset, hex: hexBytes })}
            >
              <Terminal className="w-2.5 h-2.5" /> IA Explain
            </button>
            <button 
              className="text-[9px] text-cyan-400 hover:text-white border border-cyan-500/30 hover:bg-cyan-500/50 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
              onClick={() => onAction('suggest', { offset: lineOffset, hex: hexBytes })}
            >
              <BrainCircuit className="w-2.5 h-2.5" /> AI Suggest
            </button>
          </div>
        </div>
      );
    }
    return lines;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 bg-[#0a0a0a]">
       <div className="flex justify-between items-center mb-4 shrink-0">
         <div className="flex items-center gap-3">
           <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Hex Stream Controller</div>
           {originalData && onToggleDiff && (
             <button 
               onClick={() => onToggleDiff(!showDiff)}
               className={`flex items-center gap-2 px-3 py-1 rounded border text-[10px] font-bold transition-all ${showDiff ? 'bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'}`}
             >
               <Zap className={`w-3 h-3 ${showDiff ? 'fill-amber-500' : ''}`} />
               DIFF MODE: {showDiff ? 'ON' : 'OFF'}
             </button>
           )}
         </div>
         <div className="flex items-center gap-4">
           <button 
              onClick={() => onOffsetChange(Math.max(0, offset - (bytesPerLine * maxLines)))}
              className="px-3 py-1 border border-white/10 rounded text-[10px] text-gray-400 hover:bg-white/5 transition-all disabled:opacity-20"
              disabled={offset === 0}
           >
             ANTERIOR
           </button>
           <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2">
             <span className="text-[10px] text-gray-500 font-mono">OFFSET: 0x</span>
             <input 
               type="text" 
               value={offset.toString(16).toUpperCase()}
               onChange={(e) => {
                 const val = parseInt(e.target.value, 16);
                 if (!isNaN(val)) onOffsetChange(val);
               }}
               className="w-20 bg-transparent text-[11px] text-cyan-400 font-mono outline-none py-1.5 uppercase"
             />
           </div>
           <button 
              onClick={() => onOffsetChange(offset + (bytesPerLine * maxLines))}
              className="px-3 py-1 border border-white/10 rounded text-[10px] text-gray-400 hover:bg-white/5 transition-all"
           >
             PRÓXIMO
           </button>
         </div>
       </div>

       <div className="flex-1 overflow-auto custom-scrollbar border border-white/5 bg-black/40 rounded-xl p-4 shadow-inner">
          <div className="space-y-0.5">
            {renderHexBytes()}
          </div>
       </div>
    </div>
  );
};
