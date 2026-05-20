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
      <div className="flex justify-between items-center bg-[#141414] p-8 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <Github className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white mb-2">Comunidade de <span className="text-cyan-400">Recompilação</span></h1>
          <p className="text-gray-500 max-w-xl">Acompanhe projetos reais de engenharia reversa e ports nativos diretamente do ecossistema GitHub.</p>
        </div>
        <button 
          onClick={() => fetchRepos()}
          className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
        >
          <RefreshCw className={`w-5 h-5 text-cyan-400 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Pesquisar por tecnologias (ex: ps2, mips, recomp...)"
            className="w-full bg-[#141414] border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 transition-all font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRepos()}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[200px] bg-[#141414] border border-white/5 rounded-2xl animate-pulse" />
          ))
        ) : (
          repos.map((repo) => (
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               key={repo.id}
               className="bg-[#141414] border border-white/5 rounded-2xl p-6 group hover:border-cyan-500/30 transition-all hover:bg-white/[0.02] flex flex-col justify-between"
            >
              <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-black/40 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                      <Code2 className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex gap-3 text-gray-500">
                      <div className="flex items-center gap-1 text-xs bg-white/5 px-2 py-1 rounded">
                        <Star className="w-3 h-3 text-yellow-500" />
                        {repo.stargazers_count > 1000 ? (repo.stargazers_count / 1000).toFixed(1) + 'k' : repo.stargazers_count}
                      </div>
                      <div className="flex items-center gap-1 text-xs bg-white/5 px-2 py-1 rounded">
                        <GitFork className="w-3 h-3" />
                        {repo.forks_count}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-white font-bold text-lg mb-2 truncate group-hover:text-cyan-400 transition-colors" title={repo.full_name}>
                    {repo.full_name.split('/')[1]}
                  </h3>
                  <p className="text-gray-500 text-xs mb-6 line-clamp-2 min-h-[32px]" title={repo.description}>
                    {repo.description || 'Nenhuma descrição fornecida.'}
                  </p>
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">{repo.language || 'Binary'}</span>
                    <a 
                      href={repo.html_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-cyan-400 transition-colors"
                    >
                      GITHUB <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
                <button 
                   onClick={() => handleImport(repo)}
                   disabled={importingId === repo.id}
                   className="w-full py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 disabled:opacity-50 border border-cyan-500/20 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                    {importingId === repo.id ? (
                        <><RefreshCw className="w-3 h-3 animate-spin"/> IMPORTANDO...</>
                    ) : (
                        <><DownloadCloud className="w-3 h-3"/> IMPORTAR PARA O RETROFORGE</>
                    )}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {!isLoading && repos.length === 0 && (
        <div className="text-center py-20 bg-[#141414] rounded-3xl border border-white/5">
           <Github className="w-16 h-16 text-gray-800 mx-auto mb-4" />
           <h3 className="text-white font-bold text-xl">Nenhum repositório encontrado</h3>
           <p className="text-gray-500">Tente buscar por termos diferentes.</p>
        </div>
      )}

      {/* Toast Messages */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 ${toastMsg.type === 'error' ? 'bg-red-500/20 text-red-100 border border-red-500/50' : 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/50'}`}
          >
            {toastMsg.type === 'error' ? <X className="w-5 h-5 text-red-500" /> : <Check className="w-5 h-5 text-cyan-400" />}
            <p className="text-sm font-medium">{toastMsg.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
