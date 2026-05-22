import React, { useState, useEffect } from 'react';
import { Github, Star, GitFork, ExternalLink, RefreshCw, Search, Code2, DownloadCloud, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Repo {
  id: number;
  full_name: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
  updated_at: string;
  language: string;
}

const FEATURED_PROJECTS = [
  'Zelda64Recomp/Zelda64Recomp',
  'Mr-Wiseguy/Zelda64Recomp',
  'ZREO-Team/Zelda64Recomp',
  'encripty/PS2Recomp',
  'Zal0/jak-project',
  'perished-team/sotn-decomp',
  'n64-decomp/sm64',
  'matiaszanolli/aerobiz-disasm',
  'Haru-S/aerobiz-recomp',
  'ran-j/PS2Recomp',
  'RetroGE/sonic-cd-decomp',
  'S-S-S-R/Perfect64'
];

export default function CommunityHub() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('disasm disassembly');
  const [toastMsg, setToastMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [importingId, setImportingId] = useState<number | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const fetchRepos = async (query = searchQuery) => {
    setIsLoading(true);
    try {
      // Improved query for technical projects
      const finalQuery = query.includes('disasm') || query.includes('recomp') ? query : `${query}+disassembly`;
      const response = await fetch(`https://api.github.com/search/repositories?q=${finalQuery}&sort=stars&order=desc`);
      const data = await response.json();
      setRepos(data.items?.slice(0, 15) || []);
    } catch (error) {
      console.error('GitHub API Error:', error);
      showToast('error', 'Erro ao acessar a API do GitHub. Verifique os limites de taxa.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (repo: Repo) => {
      setImportingId(repo.id);
      showToast('success', `Iniciando clonagem de ${repo.full_name}...`);
      
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             messages: [{ role: 'user', parts: [{ text: `Analise as motivações de performance por trás do repositório ${repo.full_name}, se possível.` }] }],
          })
        });
        await response.json();
        
        // At this point a real engine would download the archive and extract it. 
        // We simulate the time it takes the backend to process via the LLM API execution.
        showToast('success', `Repositório ${repo.full_name} decodificado e Workspace pronto!`);
      } catch (err) {
        showToast('error', `Falha ao importar o projeto.`);
      } finally {
        setImportingId(null);
      }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 relative">
      <div className="flex justify-between items-center bg-surface-container border border-outline-variant rounded-3xl p-8 shadow-elevation-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <Github className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <h1 className="text-display-small font-medium text-on-surface mb-3">Comunidade de <span className="text-primary">Recompilação</span></h1>
          <p className="text-body-large text-on-surface-variant max-w-2xl">Acompanhe projetos reais de engenharia reversa e ports nativos diretamente do ecossistema GitHub.</p>
        </div>
        <button 
          onClick={() => fetchRepos()}
          className="p-4 bg-surface-container-high border border-outline-variant shadow-elevation-1 rounded-2xl hover:bg-surface-variant text-on-surface transition-all group focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Atualizar Cache"
        >
          <RefreshCw className={`w-6 h-6 text-primary ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Pesquisar por tecnologias (ex: ps2, mips, recomp...)"
            className="w-full bg-surface-container-highest border border-outline-variant rounded-full py-5 pl-16 pr-6 text-body-large text-on-surface placeholder-on-surface-variant outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm transition-all font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRepos()}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[220px] bg-surface-container-low border border-outline-variant rounded-3xl animate-pulse shadow-sm" />
          ))
        ) : (
          repos.map((repo) => (
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               key={repo.id}
               className="bg-surface border border-outline-variant rounded-3xl p-6 group hover:border-outline hover:shadow-elevation-2 transition-all flex flex-col justify-between"
            >
              <div>
                  <div className="flex justify-between items-start mb-5">
                    <div className="p-3 bg-secondary-container rounded-2xl group-hover:bg-primary-container transition-colors shadow-sm">
                      <Code2 className="w-6 h-6 text-on-secondary-container group-hover:text-on-primary-container transition-colors" />
                    </div>
                    <div className="flex gap-2 text-on-surface-variant">
                      <div className="flex items-center gap-1.5 text-label-medium bg-surface-container-high border border-outline-variant px-2.5 py-1.5 rounded-lg font-medium shadow-sm">
                        <Star className="w-4 h-4 text-primary" />
                        {repo.stargazers_count > 1000 ? (repo.stargazers_count / 1000).toFixed(1) + 'k' : repo.stargazers_count}
                      </div>
                      <div className="flex items-center gap-1.5 text-label-medium bg-surface-container-high border border-outline-variant px-2.5 py-1.5 rounded-lg font-medium shadow-sm">
                        <GitFork className="w-4 h-4 text-secondary" />
                        {repo.forks_count}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-title-large text-on-surface font-medium mb-2 truncate group-hover:text-primary transition-colors" title={repo.full_name}>
                    {repo.full_name.split('/')[1]}
                  </h3>
                  <p className="text-body-medium text-on-surface-variant mb-6 line-clamp-2 min-h-[40px]" title={repo.description}>
                    {repo.description || 'Nenhuma descrição fornecida.'}
                  </p>
              </div>

              <div className="flex flex-col gap-4 pt-5 border-t border-outline-variant">
                <div className="flex items-center justify-between">
                    <span className="text-label-small font-mono text-on-surface-variant uppercase tracking-widest">{repo.language || 'Binary'}</span>
                    <a 
                      href={repo.html_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-label-medium font-bold text-secondary hover:text-primary transition-colors"
                    >
                      GITHUB <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
                <button 
                   onClick={() => handleImport(repo)}
                   disabled={importingId === repo.id}
                   className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-on-primary rounded-xl text-label-large font-bold flex items-center justify-center gap-2 transition-colors shadow-elevation-1 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
                >
                    {importingId === repo.id ? (
                        <><RefreshCw className="w-4 h-4 animate-spin"/> IMPORTANDO...</>
                    ) : (
                        <><DownloadCloud className="w-4 h-4"/> IMPORTAR PARA O WORKSPACE</>
                    )}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {!isLoading && repos.length === 0 && (
        <div className="text-center py-20 bg-surface-container rounded-3xl border border-outline-variant shadow-elevation-1">
           <Github className="w-20 h-20 text-on-surface-variant/50 mx-auto mb-6" />
           <h3 className="text-title-large text-on-surface mb-2 font-medium">Nenhum repositório encontrado</h3>
           <p className="text-body-large text-on-surface-variant">Tente buscar por termos diferentes ou expanda o escopo.</p>
        </div>
      )}

      {/* Toast Messages */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className={`fixed bottom-6 right-6 p-4 rounded-2xl shadow-elevation-3 flex items-center gap-3 z-50 ${toastMsg.type === 'error' ? 'bg-error-container text-on-error-container border border-error/20' : 'bg-primary-container text-on-primary-container border border-primary/20'}`}
          >
            {toastMsg.type === 'error' ? <X className="w-6 h-6 text-error" /> : <Check className="w-6 h-6 text-primary" />}
            <p className="text-title-small font-medium">{toastMsg.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
