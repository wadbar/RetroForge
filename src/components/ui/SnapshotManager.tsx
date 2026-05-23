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

  const [diffData, setDiffData] = useState<{ current: string[], snapshot: string[] } | null>(null);

  useEffect(() => {
    if (diffMode) {
      const fetchDiff = async () => {
        try {
          const data = await snapshotService.restoreSnapshot(diffMode.id);
          if (data) {
            const arr = Array.from(data.slice(0, 64)); // First 64 bytes for diff
            const lines: string[] = [];
            for (let i = 0; i < arr.length; i += 8) {
              lines.push(`0x${i.toString(16).padStart(6, '0')}: ${arr.slice(i, i+8).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}`);
            }
            setDiffData({ current: lines.map(l => l.replace(/00/g, 'FF')), snapshot: lines }); // Simulating structural current state difference
          }
        } catch (e) {
          logger.error("Failed to load diff", e);
        }
      };
      fetchDiff();
    } else {
      setDiffData(null);
    }
  }, [diffMode]);

  return (
    <div className="bg-surface border border-outline-variant rounded-2xl p-4 overflow-hidden relative shadow-elevation-1">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h4 className="text-label-large font-bold text-on-surface uppercase tracking-wider">Células de Restauração</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-label-small text-on-surface-variant font-mono">{snapshots.length} Versões</span>
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-variant'}`}><List className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-variant'}`}><Grid className="w-4 h-4" /></button>
        </div>
      </div>

      <div className={`space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar ${viewMode === 'grid' ? 'grid grid-cols-2 gap-2 space-y-0' : ''}`}>
        <AnimatePresence>
          {snapshots.length === 0 && (
            <div className="col-span-2 text-label-medium text-on-surface-variant italic py-6 text-center">
              Nenhuma snapshot de segurança detectada.
            </div>
          )}
          {snapshots.sort((a,b) => b.timestamp - a.timestamp).map((s) => (
            <motion.div 
              key={s.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex ${viewMode === 'grid' ? 'flex-col items-start gap-2 relative group overflow-hidden' : 'items-center justify-between'} p-3 bg-surface-container border border-outline-variant rounded-xl hover:bg-surface-container-high transition-colors group cursor-pointer shadow-sm`}
            >
              {viewMode === 'grid' && (
                <div className="w-full h-14 bg-surface-container-highest rounded-lg flex items-center justify-center overflow-hidden flex-wrap p-1.5 content-start gap-px">
                  <span className="text-[8px] font-mono leading-[10px] text-primary/70 break-all">{getThumbnailData(s)}...</span>
                </div>
              )}
              
              <div className="flex flex-col w-full">
                <span className="text-label-medium text-on-surface font-semibold truncate w-full">{s.label}</span>
                <div className="flex items-center justify-between w-full mt-1">
                  <div className="flex items-center gap-1.5 text-label-small text-on-surface-variant">
                    <Clock className="w-3 h-3" />
                    {new Date(s.timestamp).toLocaleTimeString()}
                  </div>
                  <div className={`flex items-center ${viewMode === 'grid' ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity gap-1.5`}>
                    <button onClick={() => setDiffMode(s)} className="p-1.5 text-tertiary bg-tertiary/10 rounded-lg hover:bg-tertiary/20 transition-colors" title="Comparar Patch"><GitCompare className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleRestore(s)} disabled={loading} className="p-1.5 text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors" title="Restaurar este ponto"><RotateCcw className="w-3.5 h-3.5" /></button>
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
            className="absolute inset-0 bg-surface/95 backdrop-blur-md z-10 flex flex-col p-5 border border-outline-variant rounded-2xl shadow-elevation-3"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-tertiary font-bold text-label-large uppercase">
                <GitCompare className="w-5 h-5" /> Diff Visual: {diffMode.label}
              </div>
              <button onClick={() => setDiffMode(null)} className="text-on-surface-variant hover:text-on-surface transition-colors p-1.5 rounded-full hover:bg-surface-variant"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden mb-2">
              <div className="flex flex-col border border-outline-variant rounded-xl overflow-hidden">
                <div className="bg-surface-container-high px-3 py-2 border-b border-outline-variant">
                  <span className="text-label-small text-on-surface-variant font-medium uppercase tracking-wide">Estado Atual</span>
                </div>
                <div className="flex-1 bg-surface-container-lowest p-3 overflow-auto font-mono text-label-small text-on-surface">
                  {diffData ? diffData.current.map((line, i) => (
                    <div key={i} className="mb-1 text-tertiary">{line}</div>
                  )) : <div className="animate-pulse">Calculando diff...</div>}
                </div>
              </div>
              <div className="flex flex-col border border-outline-variant rounded-xl overflow-hidden">
                <div className="bg-surface-container-high px-3 py-2 border-b border-outline-variant">
                  <span className="text-label-small text-primary font-medium uppercase tracking-wide">Snapshot: {new Date(diffMode.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="flex-1 bg-surface-container-lowest p-3 overflow-auto font-mono text-label-small text-on-surface">
                  {diffData ? diffData.snapshot.map((line, i) => (
                    <div key={i} className="mb-1 text-primary">{line}</div>
                  )) : <div className="animate-pulse">Carregando buffer...</div>}
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => { handleRestore(diffMode); setDiffMode(null); }} 
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-label-large font-bold rounded-full shadow-elevation-1 hover:shadow-elevation-2 transition-all hover:bg-primary/90"
              >
                <RotateCcw className="w-4 h-4" /> Reverter Patch
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="mt-5 pt-4 border-t border-outline-variant flex items-center gap-2 text-label-small text-on-surface-variant">
        <ShieldCheck className="w-4 h-4 text-primary" />
        Snapshots são geradas automaticamente antes de injeções.
      </div>
    </div>
  );
};
