import React, { useEffect, useState } from 'react';
import { History, RotateCcw, ShieldCheck, Clock, Trash2, Grid, List, GitCompare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { snapshotService, Snapshot } from '../../services/snapshotService';
import { projectService } from '../../services/projectService';
import { logger } from '../../services/loggerService';

interface SnapshotManagerProps {
  projectId: string;
  onRestore: (data: Uint8Array) => void;
}

/**
 * SnapshotManager - UI component for binary version control.
 */
export const SnapshotManager: React.FC<SnapshotManagerProps> = ({ projectId, onRestore }) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [diffMode, setDiffMode] = useState<Snapshot | null>(null);

  const loadSnapshots = async () => {
    // In a real scenario projectService would store these relationships.
    // For now we rely on storage metadata.
    const all = await projectService.getProjects();
    // SnapshotService could filter by project
    // Simulating fetching snapshots for this project
    const items = JSON.parse(localStorage.getItem('RF_SNAPSHOTS') || '[]')
      .filter((s: any) => s.projectId === projectId);
    setSnapshots(items);
  };

  useEffect(() => {
    loadSnapshots();
  }, [projectId]);

  const handleRestore = async (snapshot: Snapshot) => {
    setLoading(true);
    try {
      const data = await snapshotService.restoreSnapshot(snapshot.id);
      if (data) {
        onRestore(data);
        logger.info(`[SNAPSHOT] Restored: ${snapshot.label}`);
      }
    } catch (e) {
      logger.error("Failed to restore snapshot", e);
    } finally {
      setLoading(false);
    }
  };

  const getThumbnailData = (snapshot: Snapshot) => {
    return Array.from({length: 16}).map((_, i) => Math.abs((snapshot.timestamp + i * 13) % 255).toString(16).padStart(2, '0')).join(' ');
  };

  return (
    <div className="bg-black/40 border border-white/5 rounded-xl p-4 overflow-hidden relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Células de Restauração</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-500 font-mono">{snapshots.length} Versões</span>
          <button onClick={() => setViewMode('list')} className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><List className="w-3 h-3" /></button>
          <button onClick={() => setViewMode('grid')} className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><Grid className="w-3 h-3" /></button>
        </div>
      </div>

      <div className={`space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar ${viewMode === 'grid' ? 'grid grid-cols-2 gap-2 space-y-0' : ''}`}>
        <AnimatePresence>
          {snapshots.length === 0 && (
            <div className="col-span-2 text-[10px] text-gray-600 italic py-4 text-center">
              Nenhuma snapshot de segurança detectada.
            </div>
          )}
          {snapshots.sort((a,b) => b.timestamp - a.timestamp).map((s) => (
            <motion.div 
              key={s.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex ${viewMode === 'grid' ? 'flex-col items-start gap-2 relative group overflow-hidden' : 'items-center justify-between'} p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 transition-colors group`}
            >
              {viewMode === 'grid' && (
                <div className="w-full h-12 bg-black/50 rounded flex items-center justify-center overflow-hidden flex-wrap p-1 content-start gap-px">
                  <span className="text-[6px] font-mono leading-[8px] text-cyan-500/50 break-all">{getThumbnailData(s)}...</span>
                </div>
              )}
              
              <div className="flex flex-col w-full">
                <span className="text-[10px] text-gray-300 font-medium truncate w-full">{s.label}</span>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 text-[8px] text-gray-500">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(s.timestamp).toLocaleTimeString()}
                  </div>
                  <div className={`flex items-center ${viewMode === 'grid' ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity gap-1`}>
                    <button onClick={() => setDiffMode(s)} className="p-1 text-purple-400 bg-purple-500/10 rounded hover:bg-purple-500/20" title="Comparar Patch"><GitCompare className="w-3 h-3" /></button>
                    <button onClick={() => handleRestore(s)} disabled={loading} className="p-1 text-cyan-400 bg-cyan-500/10 rounded hover:bg-cyan-500/20" title="Restaurar este ponto"><RotateCcw className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {diffMode && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-0 bg-black/95 z-10 flex flex-col p-4 border border-purple-500/30 rounded-xl"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-purple-400 font-medium text-[11px] uppercase">
                <GitCompare className="w-4 h-4" /> Diff Visual: {diffMode.label}
              </div>
              <button onClick={() => setDiffMode(null)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 mb-2">Estado Atual da Memória</span>
                <div className="flex-1 bg-[#1e1e1e] rounded p-2 overflow-auto font-mono text-[10px] text-gray-300">
                  {/* Mock diff view */}
                  <div className="text-cyan-400">0x000000: 55 8B EC 83 EC 40 53 56 57</div>
                  <div className="opacity-50">0x000009: 8D 7D C0 B9 10 00 00 00 B8</div>
                  <div className="text-purple-400 line-through">0x000012: CC CC CC CC F3 AB 8B 45 08</div>
                  <div className="opacity-50">0x00001B: 03 45 0C 5F 5E 5B 8B E5 5D</div>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-cyan-500 mb-2 ml-2">Snapshot: {new Date(diffMode.timestamp).toLocaleTimeString()}</span>
                <div className="flex-1 bg-[#1e1e1e] rounded p-2 overflow-auto font-mono text-[10px] text-gray-300">
                  <div className="text-cyan-400">0x000000: 55 8B EC 83 EC 40 53 56 57</div>
                  <div className="opacity-50">0x000009: 8D 7D C0 B9 10 00 00 00 B8</div>
                  <div className="text-green-400 border-l border-green-500 pl-1">0x000012: 90 90 90 90 F3 AB 8B 45 08</div>
                  <div className="opacity-50">0x00001B: 03 45 0C 5F 5E 5B 8B E5 5D</div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button onClick={() => { handleRestore(diffMode); setDiffMode(null); }} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500 text-black text-[10px] font-bold rounded shadow-lg hover:bg-cyan-400">
                <RotateCcw className="w-3 h-3" /> Reverter para este Patch
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[9px] text-gray-500 italic">
        <ShieldCheck className="w-3 h-3 text-green-500/50" />
        Snapshots são geradas automaticamente antes de injeções.
      </div>
    </div>
  );
};
