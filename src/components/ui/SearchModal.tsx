import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Book, Monitor, Code, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { projectService } from '../../services/projectService';

export const SearchModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    
    const search = async () => {
      const allProjects = await projectService.getProjects();
      const hits: any[] = [];
      const q = query.toLowerCase();

      // Search projects metadata
      allProjects.forEach(p => {
        if (p.name.toLowerCase().includes(q) || p.platform.toLowerCase().includes(q)) {
          hits.push({ type: 'project', title: p.name, desc: `Plataforma: ${p.platform} | Status: ${p.status || 'Pendente'}`, icon: Monitor, id: p.id });
        }
      });

      // Mock search in Knowledge Base
      if ('documentação'.includes(q) || 'retroforge'.includes(q) || 'architecture'.includes(q) || 'mips'.includes(q)) {
         hits.push({ type: 'docs', title: 'Arquitetura do RetroForge', desc: 'Base de Conhecimento - Visão Geral do Sistema Base', icon: Book, id: 'doc-1' });
         hits.push({ type: 'docs', title: 'MIPS R3000 Instruction Set', desc: 'Base de Conhecimento - Opcode e Registers', icon: Code, id: 'doc-2' });
      }

      setResults(hits);
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="w-full max-w-2xl bg-surface border border-outline-variant rounded-2xl shadow-elevation-3 overflow-hidden flex flex-col max-h-[70vh]"
          >
            <div className="flex items-center px-4 border-b border-outline-variant">
              <Search className="w-6 h-6 text-primary" />
              <input
                ref={inputRef}
                type="text"
                className="w-full bg-transparent border-none px-4 py-4 text-body-large text-on-surface outline-none placeholder:text-on-surface-variant/50"
                placeholder="Busque projetos, documentação ou metadados..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-variant">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {(results.length > 0 || query.trim().length >= 2) && (
              <div className="overflow-y-auto custom-scrollbar flex-1 p-2 bg-surface-container-lowest">
                {results.length > 0 ? (
                   results.map((hit, idx) => {
                     const Icon = hit.icon;
                     return (
                       <button key={idx} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-variant/50 transition-colors text-left group">
                         <div className="flex items-center gap-4">
                           <div className={`p-2 rounded-lg ${hit.type === 'project' ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container text-on-secondary-container'}`}>
                             <Icon className="w-5 h-5" />
                           </div>
                           <div>
                             <h4 className="text-title-small font-medium text-on-surface">{hit.title}</h4>
                             <p className="text-body-small text-on-surface-variant mt-0.5">{hit.desc}</p>
                           </div>
                         </div>
                         <ChevronRight className="w-5 h-5 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                       </button>
                     )
                   })
                ) : (
                  <div className="px-4 py-8 text-center text-on-surface-variant">
                    Nehum resultado encontrado para "{query}"
                  </div>
                )}
              </div>
            )}
            
            <div className="px-4 py-3 bg-surface-container-low border-t border-outline-variant flex justify-between items-center text-label-small text-on-surface-variant gap-4">
              <div className="flex items-center gap-1.5"><kbd className="px-2 py-0.5 bg-surface rounded border border-outline">Esc</kbd> para fechar</div>
              <div className="flex items-center gap-1.5">Pesquisando em <span className="font-bold text-primary">Base de Conhecimento</span> e Metadados</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
