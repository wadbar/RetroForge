import React, { useState } from 'react';
import { Zap, Terminal, BrainCircuit, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';
import { symbolService } from '../../services/symbolService';

interface HexEditorProps {
  projectId?: string;
  data: Uint8Array | null;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onAction: (action: 'patch' | 'explain' | 'suggest', data: { offset: number, hex: string[] }) => void;
  onHoverOffset?: (offset: number) => void;
}

/**
 * HexEditorView - Specialized view for low-level binary manipulation.
 */
export const HexEditorView: React.FC<HexEditorProps> = ({ projectId, data, offset, onOffsetChange, onAction, onHoverOffset }) => {
  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Carregue um arquivo binário para visualizar o stream hexadecimal.
      </div>
    );
  }

  const bytesPerLine = 16;
  const maxLines = 20;

  const renderHexBytes = () => {
    const lines = [];
    
    for (let i = 0; i < maxLines; i++) {
      const lineOffset = offset + (i * bytesPerLine);
      if (lineOffset >= data.length) break;

      const hexBytes: string[] = [];
      const asciiChars: string[] = [];
      
      for (let j = 0; j < bytesPerLine; j++) {
        if (lineOffset + j < data.length) {
          const byte = data[lineOffset + j];
          hexBytes.push(byte.toString(16).padStart(2, '0').toUpperCase());
          asciiChars.push((byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.');
        } else {
          hexBytes.push('  ');
          asciiChars.push(' ');
        }
      }

      const lineOffsetHex = lineOffset.toString(16).toUpperCase();
      const symbol = projectId ? symbolService.getSymbolAt(projectId, `0x${lineOffsetHex}`) : undefined;

      lines.push(
        <div key={i} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded transition-colors group relative items-center">
          <div className="flex items-center gap-1 w-20">
            <span className={`text-gray-500 group-hover:text-cyan-400 transition-colors font-mono ${symbol ? 'text-cyan-400 font-bold' : ''}`}>
              {lineOffsetHex.padStart(8, '0')}
            </span>
            {symbol && <Bookmark className="w-2.5 h-2.5 text-cyan-400 fill-cyan-400/20" />}
          </div>
          <span className="text-cyan-400/80 flex-1 space-x-2 tracking-widest group-hover:text-cyan-400 transition-colors font-mono">
            {hexBytes.map((hex, idx) => (
              <span 
                key={idx} 
                className={hex === '00' ? 'opacity-30 cursor-crosshair' : 'cursor-crosshair'}
                onMouseEnter={() => onHoverOffset?.(lineOffset + idx)}
              >
                {hex}
              </span>
            ))}
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
         <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Hex Stream Controller</div>
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
