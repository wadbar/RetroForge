import React, { useEffect, useState } from 'react';
import { History, RotateCcw, ShieldCheck, Clock, Trash2 } from 'lucide-react';
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

  return (
    <div className="bg-black/40 border border-white/5 rounded-xl p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Células de Restauração</h4>
        </div>
        <span className="text-[9px] text-gray-500 font-mono">{snapshots.length} Versões</span>
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence>
          {snapshots.length === 0 && (
            <div className="text-[10px] text-gray-600 italic py-4 text-center">
              Nenhuma snapshot de segurança detectada.
            </div>
          )}
          {snapshots.sort((a,b) => b.timestamp - a.timestamp).map((s) => (
            <motion.div 
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 transition-colors group"
            >
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-300 font-medium truncate max-w-[120px]">{s.label}</span>
                <div className="flex items-center gap-1.5 text-[8px] text-gray-500">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(s.timestamp).toLocaleString()}
                </div>
              </div>
              <button 
                onClick={() => handleRestore(s)}
                disabled={loading}
                className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded hover:bg-cyan-500/20 opacity-0 group-hover:opacity-100 transition-all border border-cyan-500/20"
                title="Restaurar este ponto"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[9px] text-gray-500 italic">
        <ShieldCheck className="w-3 h-3 text-green-500/50" />
        Snapshots são geradas automaticamente antes de injeções.
      </div>
    </div>
  );
};
