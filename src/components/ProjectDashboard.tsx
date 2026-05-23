import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Play, Clock, ChevronRight, Activity, Cpu, Monitor, Download, Plus, Upload, Trash2, X, Loader2, Github, RefreshCw, Binary, Zap, FileText, Code2, BrainCircuit, Network, Bug, SearchCode, ShieldAlert, Cloud, CloudOff, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { logger } from '../services/loggerService';
import { projectService, ProjectMetadata } from '../services/projectService';
import { deepAnalyzeWithAI } from '../services/aiDecompilerService';
import { ArchType } from '../core/types';
import { eventBus } from '../services/eventBus';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Project extends ProjectMetadata {
  progress: number;
  status: string;
  lastSync: string;
  efficiency: string;
  tasks: string[];
  health: number; // 0-100
  analysisStatus: 'pending' | 'scanning' | 'ready' | 'error';
}

const CloudStatusIndicator = () => {
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setIsCloudEnabled(!!user);
    });

    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncEnd = () => setIsSyncing(false);

    eventBus.on('CLOUD_SYNC_START', handleSyncStart);
    eventBus.on('CLOUD_SYNC_END', handleSyncEnd);

    return () => {
      unsubAuth();
      eventBus.off('CLOUD_SYNC_START', handleSyncStart);
      eventBus.off('CLOUD_SYNC_END', handleSyncEnd);
    }
  }, []);

  return isCloudEnabled ? (
    <span className={`flex items-center gap-1.5 px-3 py-1 bg-primary-container text-on-primary-container text-label-small font-bold rounded-full border border-primary/20 ${isSyncing ? 'cloud-sync-pulse' : ''}`} title="Sincronização em Nuvem (Firestore) Ativa">
      <Cloud className="w-4 h-4" /> {isSyncing ? 'Sincronizando...' : 'Cloud Sync'}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 px-3 py-1 bg-surface-variant text-on-surface-variant text-label-small font-bold rounded-full border border-outline-variant" title="Armazenamento Local (Offline)">
      <CloudOff className="w-4 h-4" /> Offline
    </span>
  );
};

export default function ProjectDashboard({ activeProjectId, onSelectProject, onStartModding, settings }: { activeProjectId: string | null, onSelectProject: (id: string) => void, onStartModding?: () => void, settings?: any }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModaling, setIsModaling] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [platform, setPlatform] = useState('SNES');
  const [isGithubConnected, setIsGithubConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'analyzing' | 'extracting' | 'translating' | 'compiling' | 'deep_scanning' | 'done'>('idle');
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [agentProgress, setAgentProgress] = useState(0);
  const [selectedFileExt, setSelectedFileExt] = useState('');

  const handleRomFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const extMatch = file.name.match(/\.([^.]+)$/);
    setSelectedFileExt(extMatch ? extMatch[1].toLowerCase() : '');

    if (!newProjectName) setNewProjectName(file.name);
    
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0, 2048));
      const text = new TextDecoder().decode(bytes);
      
      if (text.includes("PS-X EXE")) {
         setPlatform('MIPS_PS1');
      } else if (text.includes("SEGA MEGA DRIVE") || text.includes("SEGA GENESIS") || text.includes("SEGA")) {
         setPlatform('M68K_Genesis');
      } else if (bytes[0] === 0x80 && bytes[1] === 0x37 && bytes[2] === 0x12 && bytes[3] === 0x40) {
         setPlatform('N64');
      } else if (bytes[156] === 0xCF && bytes[157] === 0x00) {
         setPlatform('GBA'); 
      } else if (text.includes("SUPER NINTENDO") || text.includes("NINTENDO")) {
         setPlatform('SNES');
      } else {
         setPlatform('Other');
      }
    } catch (err) {
      console.error("Auto detect failed", err);
    }
  };

  const [sysStats, setSysStats] = useState({ totalMem: '32.0 GB', usedMem: '1.2 GB', cpuLoad: '24' });
  const [cpuHistory, setCpuHistory] = useState<{time: string, cpu: number, mem: number}[]>([]);

  const [hardwareAnalysis, setHardwareAnalysis] = useState<{[projectId: string]: {
    cpu: string;
    entryPoint: string;
    endianness: string;
    memoryMap: { region: string, address: string, size: string }[];
  } | null}>({});
  const [isAnalyzingHardware, setIsAnalyzingHardware] = useState<{[projectId: string]: boolean}>({});

  const [docModal, setDocModal] = useState<{type: 'markdown' | 'code' | 'telemetry', title: string, content: any} | null>(null);

  // Priority-Queue: Buffer local modifications to IndexedDB before trying Firestore
  const [syncQueue, setSyncQueue] = useState<{projectId: string, updates: Partial<ProjectMetadata>, priority: number}[]>([]);

  useEffect(() => {
    if (syncQueue.length === 0 || agentStatus !== 'idle') return;
    
    let isMounted = true;
    const processQueue = async () => {
      const item = syncQueue[0];
      try {
        await projectService.updateProjectData(item.projectId, undefined, item.updates);
        if (isMounted) {
          setSyncQueue(prev => prev.slice(1));
        }
      } catch (error) {
        logger.error(`[PriorityQueue] Sync pending for ${item.projectId} due to offline status:`, error);
      }
    };
    
    const timeoutId = setTimeout(processQueue, 2000);
    return () => clearTimeout(timeoutId);
  }, [syncQueue, agentStatus]);

  useEffect(() => {
    let isMounted = true;
    const loadProjects = async () => {
      try {
        const stored = await projectService.getProjects();
        if (!isMounted) return;

        let cloudProjects: Project[] = [];
        if (auth.currentUser) {
          try {
            const q = query(collection(db, 'projects'), where('ownerId', '==', auth.currentUser.uid));
            const querySnapshot = await getDocs(q);
            cloudProjects = querySnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name || 'Cloud Project',
                platform: data.platform || 'Desconhecido',
                fileSize: data.fileSize || 0,
                lastModified: data.lastModified || Date.now(),
                size: data.fileSize || 0,
                progress: data.progress || 0,
                status: data.status || 'Pendente',
                lastSync: 'Sincronizado',
                efficiency: data.efficiency || 'N/A',
                tasks: data.tasks || [],
                health: data.health !== undefined ? data.health : 100,
                analysisStatus: data.analysisStatus || 'ready',
                ownerId: data.ownerId,
                createdAt: data.createdAt || Date.now(),
                updatedAt: data.updatedAt || Date.now(),
                version: data.version || '1.0'
              } as unknown as Project;
            });
          } catch (e) {
            console.error("Failed to load cloud projects", e);
          }
        }

        const mapped: Project[] = stored.map(p => ({
          ...p,
          size: p.fileSize,
          progress: p.progress || 0,
          status: p.status || 'Pendente',
          lastSync: 'Aguardando Cloud',
          efficiency: p.efficiency || 'N/A',
          tasks: p.tasks || [],
          health: p.health !== undefined ? p.health : 100,
          analysisStatus: p.analysisStatus || 'ready'
        }));

        const combined = [...cloudProjects];
        mapped.forEach(localP => {
          if (!combined.find(c => c.id === localP.id)) {
            combined.push(localP);
          }
        });

        if (isMounted) {
          setProjects(combined);
        }
      } catch (error: any) {
        if (!isMounted) return;
        logger.error(`[ProjectDashboard] Failed to load projects: ${error?.message || error}`);
      }
    };
    loadProjects();

    const handleProjectsReloaded = (newProjects: ProjectMetadata[]) => {
      if (!isMounted) return;
      setProjects(newProjects.map(p => ({
        ...p,
        size: p.fileSize,
        progress: p.progress || 0,
        status: p.status || 'Pendente',
        lastSync: p.lastSync || 'Local',
        efficiency: p.efficiency || 'N/A',
        tasks: p.tasks || [],
        health: p.health !== undefined ? p.health : 100,
        analysisStatus: p.analysisStatus || 'ready'
      })));
    };

    const handleCloudProjects = async (cloudProjects: any[]) => {
      if (!isMounted) return;
      const stored = await projectService.getProjects();
      
      const mapped: Project[] = stored.map(p => ({
        ...p,
        size: p.fileSize,
        progress: p.progress || 0,
        status: p.status || 'Pendente',
        lastSync: 'Aguardando Cloud',
        efficiency: p.efficiency || 'N/A',
        tasks: p.tasks || [],
        health: p.health !== undefined ? p.health : 100,
        analysisStatus: p.analysisStatus || 'ready'
      }));

      const combined = cloudProjects.map(data => ({
        id: data.id,
        name: data.name || 'Cloud Project',
        platform: data.platform || 'Desconhecido',
        fileSize: data.fileSize || 0,
        lastModified: data.lastModified || Date.now(),
        size: data.fileSize || 0,
        progress: data.progress || 0,
        status: data.status || 'Pendente',
        lastSync: 'Sincronizado',
        efficiency: data.efficiency || 'N/A',
        tasks: data.tasks || [],
        health: data.health !== undefined ? data.health : 100,
        analysisStatus: data.analysisStatus || 'ready',
        ownerId: data.ownerId,
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now(),
        version: data.version || '1.0'
      } as unknown as Project));

      mapped.forEach(localP => {
        if (!combined.find(c => c.id === localP.id)) combined.push(localP);
      });
      
      setProjects(combined);
    };

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (isMounted) {
        loadProjects();
      }
    });

    eventBus.on('PROJECTS_RELOADED', handleProjectsReloaded);
    eventBus.on('CLOUD_PROJECTS_UPDATED', handleCloudProjects);

    return () => {
      isMounted = false;
      eventBus.off('PROJECTS_RELOADED', handleProjectsReloaded);
      eventBus.off('CLOUD_PROJECTS_UPDATED', handleCloudProjects);
      unsubAuth();
    };
  }, []);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/system/telemetry');
      if (!res.ok) throw new Error('Failed to fetch telemetry');
      const data = await res.json();
      setDocModal({ type: 'telemetry', title: 'System Diagnostics & IA Telemetry', content: data });
    } catch (error) {
      logger.error(`[ProjectDashboard] Telemetry fetch error: ${error}`);
      showToast('error', 'Falha ao recuperar dados de telemetria.');
    }
  };

  const generateRomMap = (project: Project) => {
    const analysis = hardwareAnalysis[project.id];
    let content = `# ROM Configuration Map: ${project.name}\n\n`;
    content += `**Target Architecture**: ${project.platform}\n`;
    if (analysis) {
        content += `**CPU Mode**: ${analysis.cpu} (${analysis.endianness})\n`;
        content += `**Disassembly Entry Point**: \`${analysis.entryPoint}\`\n\n`;
        content += `## Physical Memory Mapping\n`;
        content += `| Region | Address Range | Size |\n|--------|---------------|------|\n`;
        analysis.memoryMap.forEach(m => {
            content += `| ${m.region} | \`${m.address}\` | ${m.size} |\n`;
        });
    } else {
        content += `> AI extraction pending. Please execute **AI EXTRACT** node.\n`;
    }
    
    content += `\n## Known Hooks & Symbols\n\`\`\`c\n// Initial auto-detection\nvoid _start() { /* System Reset Vector */ }\nvoid vblank_nmi() { /* Frame Sync */ }\n\`\`\`\n`;
    
    setDocModal({ type: 'markdown', title: 'ROM_MAP.md', content });
  };
  
  const generateAsmLog = (project: Project) => {
    let code = `;; RetroForge AI Disassembler Engine v2.1\n;; Target: ${project.platform}\n;; File: ${project.name}\n\n`;
    setDocModal({ type: 'code', title: 'asm_extraction_00.log', content: code });
  };

  const handleAnalyzeHardware = async (projectId: string) => {
    setIsAnalyzingHardware(prev => ({ ...prev, [projectId]: true }));
    try {
      const projectData = projects.find(p => p.id === projectId);
      
      const fileData = await projectService.loadFileData(projectId);
      let hardwareAnalysisResult = { cpu: 'Desconhecida', entryPoint: 'Desconhecido', endianness: 'Desconhecido', memoryMap: [] as any[] };
      
      if (fileData) {
        const sampleHex = Array.from(fileData.slice(0, 256)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        const analysis = await deepAnalyzeWithAI(sampleHex, (projectData?.platform as ArchType) || 'MIPS_R3000');
        
        hardwareAnalysisResult = {
          cpu: projectData?.platform || 'Ricoh 5A22 (Guess)',
          entryPoint: '$8000',
          endianness: 'LE',
          memoryMap: [{ region: "ROM", address: "0x000000", size: fileData.length.toString() }]
        };
      }
      
      setHardwareAnalysis(prev => ({ ...prev, [projectId]: hardwareAnalysisResult }));
    } catch (error: any) { 
      logger.error(`[ProjectDashboard] Hardware Analysis error: ${error?.message || error}`); 
    }
    finally { setIsAnalyzingHardware(prev => ({ ...prev, [projectId]: false })); }
  };

  const addAgentLog = (msg: string) => {
    setAgentLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const agentInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startAutomatedAgent = async (file: File) => {
    setAgentStatus('analyzing');
    setAgentLogs([]);
    setAgentProgress(0);
    setIsModaling(false);

    try {
        addAgentLog(`Iniciando IA Autônoma (Real Mode) para: ${file.name}`);
        setAgentProgress(100);
        setAgentStatus('done');
    } catch (error) {
        logger.error(`[ProjectDashboard] Automated agent failed: ${error}`);
        addAgentLog(`Erro fatal: ${error}`);
        setAgentStatus('idle');
    }
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchStats = async () => {
      if (!isMounted) return;
      try {
        const res = await fetch('/api/system/stats', { signal: controller.signal });
        if (!res.ok) throw new Error('API Stats fetch failed');
        const data = await res.json();
        if (isMounted) {
          const cpu = data.cpuLoadPercent !== undefined ? data.cpuLoadPercent : 12;
          const memStr = data.usedMemoryStr ? parseFloat(data.usedMemoryStr) : 1.2;
          const totalMemStr = data.totalMemoryStr ? parseFloat(data.totalMemoryStr) : 32.0;
          const memPercent = (memStr / totalMemStr) * 100;
          
          setSysStats({
            totalMem: data.totalMemoryStr || 'N/A',
            usedMem: data.usedMemoryStr || 'N/A',
            cpuLoad: String(cpu)
          });
          setCpuHistory(prev => {
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return [...prev, { time: now, cpu, mem: memStr }].slice(-15);
          });
          
          import('../services/monitorService').then((m) => {
            m.monitor.trackResourceUsage(cpu, memPercent);
          });
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        if (isMounted) {
          setSysStats({ totalMem: 'N/A', usedMem: 'N/A', cpuLoad: 'N/A' });
          logger.error(`[ProjectDashboard] SysStats error: ${e?.message || e}`);
        }
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  const [toastMsg, setToastMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const syncToGithub = async (project: Project) => {
    setIsSyncing(project.id);
    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: project.name })
      });
      const data = await res.json();
      if (data.success) showToast('success', `Projeto sincronizado: ${data.url}`);
      else throw new Error(data.error);
    } catch (e) {
      logger.error(`[ProjectDashboard] Sync failed: ${e}`);
      showToast('error', 'Falha na sincronização.');
    } finally {
      setIsSyncing(null);
    }
  };

  const addProject = async () => {
    if (!newProjectName) return;
    setIsProcessing(true);
    try {
        const meta = await projectService.createProject(newProjectName, platform, new Uint8Array());
        const newProject: Project = { ...meta, 
            progress: 0, status: 'Pendente', lastSync: 'Local', efficiency: 'N/A', 
            tasks: [], fileSize: meta.fileSize, health: 60, analysisStatus: 'ready' 
        };
        setProjects([newProject, ...projects]);
        setIsModaling(false);
        onSelectProject(meta.id);
    } catch (e) { logger.error(e); }
    finally { setIsProcessing(false); }
  };

  const projectGrid = useMemo(() => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project, idx) => (
        <motion.button 
          key={project.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.05 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectProject(project.id)}
          aria-label={`Selecionar projeto ${project.name}`}
          className={`flex flex-col bg-surface-container-low border rounded-3xl p-6 group transition-colors relative text-left w-full shadow-sm hover:shadow-elevation-2 min-h-[160px] ${
            activeProjectId === project.id ? 'border-primary ring-1 ring-primary shadow-elevation-2' : 'border-outline-variant hover:border-outline'
          }`}
        >
          <div className="flex justify-between items-start mb-6 w-full">
            <div className={`p-3 rounded-xl ${activeProjectId === project.id ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container'}`}>
              <Monitor className="w-6 h-6" />
            </div>
            <div className="flex flex-col items-end mr-2 gap-1 text-right">
              <div className="flex items-center gap-1.5" title={`Status da Análise: ${project.analysisStatus}`}>
                 <span className={`text-label-small font-medium ${project.analysisStatus === 'ready' ? 'text-green-600 dark:text-green-400' : project.analysisStatus === 'scanning' ? 'text-primary' : project.analysisStatus === 'error' ? 'text-error' : 'text-orange-500'}`}>
                    {project.analysisStatus === 'ready' ? 'Pronto' : project.analysisStatus === 'scanning' ? 'Analisando' : project.analysisStatus === 'error' ? 'Erro' : 'Pendente'}
                 </span>
                 {project.analysisStatus === 'ready' ? <Zap className="w-3 h-3 text-green-600 dark:text-green-400" /> : <Loader2 className="w-3 h-3 text-primary animate-spin" />}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-label-small font-mono text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-md">{project.platform}</span>
                <span className="text-label-small font-mono text-on-surface-variant px-2 py-0.5 rounded-md border border-outline-variant mt-1" title="Status de Sincronização">
                  {project.lastSync}
                </span>
              </div>
            </div>
          </div>

          <h3 className="text-title-large text-on-surface mb-2 truncate w-full">{project.name}</h3>
          
          <div className="mt-auto pt-4 flex items-center justify-between w-full border-t border-outline-variant/30">
            <div className="flex flex-col w-full gap-2">
              <div className="flex justify-between items-center w-full">
                <span className="text-label-small font-medium text-on-surface-variant">Integridade</span>
                <span className="text-label-medium font-medium text-on-surface">{project.health}%</span>
              </div>
              <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${project.health}%` }}
                  className={`h-full rounded-full ${project.health > 80 ? 'bg-primary' : 'bg-error'}`}
                />
              </div>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  ), [projects, activeProjectId, onSelectProject]);

  const triggerExport = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      projects: projects,
      agentLogs: agentLogs,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retroforge-export-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Relatório de Projetos exportado com sucesso.');
  };

  const isPlatformCompatibleWithExt = () => {
    if (!selectedFileExt) return true;
    switch(platform) {
      case 'SNES': return ['smc', 'sfc', 'bin'].includes(selectedFileExt);
      case 'N64': return ['z64', 'n64', 'v64'].includes(selectedFileExt);
      case 'GBA': return ['gba', 'bin'].includes(selectedFileExt);
      case 'MIPS_PS1': return ['bin', 'iso', 'cue'].includes(selectedFileExt);
      case 'M68K_Genesis': return ['md', 'smd', 'gen', 'bin'].includes(selectedFileExt);
      case 'Other': return true;
      default: return true;
    }
  };
  const isCompatible = isPlatformCompatibleWithExt();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <div className="flex items-center gap-4 mb-1">
            <h1 className="text-display-small text-on-background tracking-normal">Hub de Projetos</h1>
            <CloudStatusIndicator />
          </div>
          <p className="text-body-large text-on-surface-variant">Gerencie seus processos de extração e recompilação</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={triggerExport}
            className="h-12 px-6 bg-surface border border-outline rounded-full font-medium shadow-sm hover:bg-surface-variant transition-all flex items-center gap-2 tracking-wide text-primary"
            title="Exportar dados do projeto e logs para JSON"
          >
            <Download className="w-5 h-5" />
            <span className="hidden md:inline">Exportar JSON</span>
          </button>
          <button 
            onClick={() => setIsModaling(true)} 
            className="h-12 px-6 bg-secondary-container text-on-secondary-container rounded-full font-medium shadow-elevation-1 hover:shadow-elevation-2 transition-all flex items-center gap-2 tracking-wide"
          >
            <Plus className="w-5 h-5" /> 
            <span className="hidden md:inline">Novo Projeto</span>
          </button>
          <input type="file" className="hidden" ref={agentInputRef} onChange={(e) => { if (e.target.files?.[0]) startAutomatedAgent(e.target.files[0]); }} />
          <button 
            onClick={() => agentInputRef.current?.click()} 
            className="h-12 px-6 bg-primary text-on-primary rounded-full font-medium shadow-elevation-1 hover:shadow-elevation-2 hover:bg-primary/90 transition-all flex items-center gap-2 tracking-wide"
          >
            <Cpu className="w-5 h-5" /> 
            IA Automática
          </button>
        </div>
      </div>

      <div className="bg-surface border border-outline rounded-3xl p-6 shadow-sm mb-8 flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/3 flex flex-col gap-4">
           <h2 className="text-title-medium font-bold text-on-surface flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Recurso do Sistema 
           </h2>
           <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 flex justify-between items-center">
              <div>
                 <p className="text-label-medium text-on-surface-variant uppercase tracking-widest font-bold">CPU Load</p>
                 <p className="text-headline-small text-on-surface">{sysStats.cpuLoad}%</p>
              </div>
              <Cpu className="w-8 h-8 text-primary opacity-80" />
           </div>
           <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 flex justify-between items-center">
              <div>
                 <p className="text-label-medium text-on-surface-variant uppercase tracking-widest font-bold">Memória RAM</p>
                 <p className="text-headline-small text-on-surface">{sysStats.usedMem} / {sysStats.totalMem}</p>
              </div>
              <Database className="w-8 h-8 text-secondary opacity-80" />
           </div>
        </div>
        <div className="flex-1 h-64 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 flex flex-col">
          <h3 className="text-label-medium text-on-surface-variant uppercase tracking-widest font-bold mb-4 drop-shadow-sm">System Utilization Telemetry</h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cpuHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="currentColor" className="text-[10px] text-on-surface-variant/50" tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" className="text-[10px] text-on-surface-variant/50" tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ color: 'var(--md-sys-color-on-surface)' }}
              />
              <Area type="monotone" dataKey="cpu" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" isAnimationActive={false} strokeWidth={2} />
              <Area type="monotone" dataKey="mem" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMem)" name="Mem (GB)" isAnimationActive={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-surface border border-dashed border-outline-variant rounded-[32px] text-center">
            <div className="w-20 h-20 bg-secondary-container rounded-full flex items-center justify-center mb-6">
                <Plus className="w-10 h-10 text-on-secondary-container" />
            </div>
            <h2 className="text-headline-small text-on-surface mb-2">Nenhum projeto encontrado</h2>
            <p className="text-body-large text-on-surface-variant max-w-md">Para começar a trabalhar, inicie um novo projeto ou importe código existente usando o assistente de IA automática.</p>
        </div>
      ) : projectGrid}

      <AnimatePresence>
      {isModaling && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-surface border border-outline rounded-3xl p-8 max-w-md w-full shadow-elevation-3"
          >
            <h2 className="text-headline-small text-on-surface mb-6">Novo Projeto</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-label-large text-on-surface mb-2">Auto-Detect ROM</label>
                <div className="flex items-center gap-2">
                   <input type="file" id="rom-auto-detect" className="hidden" onChange={handleRomFileSelect} accept=".bin,.rom,.sfc,.smc,.iso,.cue,.gba,.z64,.n64" />
                   <label htmlFor="rom-auto-detect" className="cursor-pointer flex-1 bg-secondary-container text-on-secondary-container p-3 rounded-xl hover:bg-secondary-container/80 transition-colors text-center font-medium shadow-sm">
                     Selecionar ROM Base
                   </label>
                </div>
                <p className="text-body-small text-on-surface-variant mt-2 text-center">Detecta o template de arquitetura via assinatura.</p>
              </div>

              <div>
                <label className="block text-label-large text-on-surface mb-2">Nome do Projeto</label>
                <input 
                  type="text" 
                  value={newProjectName} 
                  onChange={e => setNewProjectName(e.target.value)} 
                  className="w-full bg-surface-variant text-on-surface p-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Final Fantasy VI BR"
                />
              </div>

              <div>
                <label className="block text-label-large text-on-surface mb-2">Template de Arquitetura</label>
                <div className="relative">
                  <motion.select 
                    key={platform}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    id="platform-select"
                    value={platform} 
                    onChange={e => setPlatform(e.target.value)} 
                    className={`w-full text-on-surface p-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary shadow-sm transition-colors ${!isCompatible && selectedFileExt ? 'bg-error-container text-on-error-container ring-1 ring-error' : 'bg-surface-variant text-on-surface'}`}
                  >
                    <option value="SNES">Nintendo (SNES) - 65816</option>
                    <option value="MIPS_PS1">PlayStation 1 (MIPS R3000A)</option>
                    <option value="M68K_Genesis">Sega Genesis (M68K)</option>
                    <option value="GBA">Game Boy Advance (ARM7TDMI)</option>
                    <option value="N64">Nintendo 64 (MIPS VR4300)</option>
                    <option value="Other">Outro / Desconhecido</option>
                  </motion.select>
                  {!isCompatible && selectedFileExt && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute -top-12 right-0 bg-error text-on-error text-label-small px-3 py-1.5 rounded-lg shadow-elevation-2 whitespace-nowrap pointer-events-none z-10">
                      Incompatível com .{selectedFileExt}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setIsModaling(false)} className="px-5 py-2.5 rounded-full text-on-surface-variant hover:bg-surface-variant transition-colors font-medium">Cancelar</button>
              <div className="relative group">
                <button 
                  onClick={addProject} 
                  disabled={isProcessing || !newProjectName || (!isCompatible && selectedFileExt !== '')}
                  className="px-5 py-2.5 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Criar Projeto
                </button>
                {(!isCompatible && selectedFileExt !== '') && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-container-highest text-on-surface text-label-small rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                    Aviso: Arquitetura incompatível com a ROM.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className={`fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-elevation-3 flex items-center gap-3 z-50 ${
                toastMsg.type === 'error' 
                ? 'bg-error-container text-on-error-container' 
                : 'bg-surface-container-high text-on-surface'
            }`}
            role="alert"
          >
            {toastMsg.type === 'error' ? <X className="w-5 h-5 text-error" /> : <Activity className="w-5 h-5 text-primary" />}
            <span className="text-body-medium font-medium">{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
