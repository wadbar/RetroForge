import React from 'react';
import { motion } from 'motion/react';
import { Database, Binary, Calculator } from 'lucide-react';

interface HexInspectorProps {
  data: Uint8Array | null;
  offset: number;
}

export const HexInspector: React.FC<HexInspectorProps> = ({ data, offset }) => {
  if (!data || offset < 0 || offset >= data.length) {
    return (
      <div className="p-4 flex flex-col gap-2 bg-[#141414] border border-white/5 rounded-2xl h-full">
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
           <Database className="w-3 h-3" /> Data Inspector
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-600 text-[10px] italic">
           Passe o mouse ou clique em um offset.
        </div>
      </div>
    );
  }

  const getInt8 = () => new DataView(data.buffer).getInt8(offset);
  const getUint8 = () => data[offset];
  
  const getInt16 = () => {
    try { return new DataView(data.buffer).getInt16(offset, false); } catch { return 0; }
  };
  const getInt16LE = () => {
    try { return new DataView(data.buffer).getInt16(offset, true); } catch { return 0; }
  };
  const getUint16 = () => {
    try { return new DataView(data.buffer).getUint16(offset, false); } catch { return 0; }
  };
  const getUint16LE = () => {
    try { return new DataView(data.buffer).getUint16(offset, true); } catch { return 0; }
  };
  const getInt32 = () => {
    try { return new DataView(data.buffer).getInt32(offset, false); } catch { return 0; }
  };
  const getInt32LE = () => {
    try { return new DataView(data.buffer).getInt32(offset, true); } catch { return 0; }
  };
  const getFloat32 = () => {
    try { return new DataView(data.buffer).getFloat32(offset, false); } catch { return 0; }
  };
  const getFloat32LE = () => {
    try { return new DataView(data.buffer).getFloat32(offset, true); } catch { return 0; }
  };

  const getBinary = () => data[offset].toString(2).padStart(8, '0');

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 flex flex-col gap-4 bg-[#141414] border border-white/5 rounded-2xl h-full shadow-2xl"
    >
      <div className="flex justify-between items-center">
        <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-2">
           <Calculator className="w-3 h-3" /> Data Inspector
        </div>
        <span className="text-[10px] font-mono text-gray-500">0x{offset.toString(16).toUpperCase().padStart(8, '0')}</span>
      </div>

      <div className="space-y-2 overflow-y-auto no-scrollbar group">
        <InspectorRow label="Signed Int8" value={getInt8().toString()} />
        <InspectorRow label="Unsigned Int8" value={getUint8().toString()} />
        
        <div className="relative pt-2">
           <div className="text-[9px] text-gray-500 font-bold uppercase mb-1">16-bit Interpretations</div>
           <InstructorDataRow label="Signed Int16" be={getInt16().toString()} le={getInt16LE().toString()} />
           <InstructorDataRow label="Unsigned Int16" be={getUint16().toString()} le={getUint16LE().toString()} />
        </div>

        <div className="relative pt-2">
           <div className="text-[9px] text-gray-500 font-bold uppercase mb-1">32-bit Interpretations</div>
           <InstructorDataRow label="Signed Int32" be={getInt32().toString()} le={getInt32LE().toString()} />
           <InstructorDataRow label="Float32" be={getFloat32().toFixed(6)} le={getFloat32LE().toFixed(6)} />
        </div>

        <div className="pt-2 border-t border-white/5">
           <div className="text-[9px] text-gray-600 font-bold uppercase mb-1">Binary Representation</div>
           <div className="font-mono text-xs text-amber-500 tracking-tighter bg-black/40 p-2 rounded border border-white/5">
              {getBinary().split('').map((b, i) => (
                <span key={i} className={b === '1' ? 'text-amber-400' : 'opacity-20'}>{b}</span>
              ))}
           </div>
        </div>
      </div>
    </motion.div>
  );
};

const InspectorRow = ({ label, value }: { label: string, value: string }) => (
  <div className="flex justify-between items-center p-2 bg-black/20 rounded border border-white/5 group-hover:border-cyan-500/30 transition-all">
    <span className="text-[9px] text-gray-500 font-bold transition-colors">{label}</span>
    <span className="text-[11px] text-cyan-300 font-mono select-all" title="Value">{value}</span>
  </div>
);

const InstructorDataRow = ({ label, be, le }: { label: string, be: string, le: string }) => (
  <div className="flex flex-col p-2 bg-black/20 rounded border border-white/5 mb-1 hover:bg-black/40 group-hover:border-cyan-500/30 transition-all relative group/row">
    <span className="text-[9px] text-gray-400 font-bold mb-1">{label}</span>
    <div className="flex justify-between items-center">
       <div className="flex flex-col leading-tight cursor-help relative" title={`Big Endian:\n${be}`}>
          <span className="text-[8px] text-gray-600">BE</span>
          <span className="text-[10px] text-emerald-400 font-mono">{be}</span>
       </div>
       <div className="flex flex-col items-end leading-tight cursor-help relative" title={`Little Endian:\n${le}`}>
          <span className="text-[8px] text-gray-600">LE</span>
          <span className="text-[10px] text-fuchsia-400 font-mono">{le}</span>
       </div>
    </div>
  </div>
);
