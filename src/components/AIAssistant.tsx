import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Binary, Terminal, Code, Settings, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

const SYSTEM_PROMPT = `Você é o RetroForge AI, a inteligência central por trás de uma ferramenta de recompilação estática e porte nativo com conhecimento avançado em romhacking.
Sua referência de excelência é o projeto "Aerobiz Supersonic Disassembly" (Sega Genesis) e as listas de recompilação do "Read Only Memo" e projetos como "PS2Recomp".
Seu objetivo é guiar o usuário em:
1. Byte-identical reassembly: O código gerado deve ser capaz de remontar um binário idêntico ao original.
2. Análise de Fluxo: Identificar vetores de interrupção, Entry Points e loops principais. 
3. Portabilidade: Sugerir abstrações para GTE (PS1), VU0/VU1 (PS2) e RCP (N64) para rodar em hardware moderno.

Regras Adicionais Avançadas:
- Quando questionado sobre Assembly ou Hex, você deve fornecer diagramas de fluxo de dados mentais. Use Mermaid.js (\`\`\`mermaid) para visualização.
- Ajude com Pattern Scanning, extração via TBL, e conversões de mnêmonicos e Script Injections.
- Se for pedida Descompilação, encontre endereços, loops, condicionais e syscalls. Lembre o usuário de alinhamento de memória e delay slots.

Use seu conhecimento técnico sobre a cena demoscene. Respostas técnicas, focadas em C++ e Assembly.`;

export default function AIAssistant({ activeProjectId, settings }: { activeProjectId: string | null, settings?: any }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Olá! Sou o RetroForge AI. Percebi que você está trabalhando em um projeto. Como posso ajudar na portabilidade ou tradução técnica hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assistantMemory, setAssistantMemory] = useState<any>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true;
    try {
      const savedMemory = localStorage.getItem(`retroforge_memory_${activeProjectId}`);
      if (savedMemory && isMounted) setAssistantMemory(JSON.parse(savedMemory));
    } catch (e) {
      console.error("[TELEMETRIA] Erro ao parsear memória local:", e);
    }
    
    if (isMounted) {
      setMessages([
        { role: 'assistant', content: 'Olá! Sou o RetroForge AI. Percebi que você está trabalhando em um projeto. Como posso ajudar na portabilidade ou tradução técnica hoje?' }
      ]);
    }
    return () => { isMounted = false; }
  }, [activeProjectId]);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem(`retroforge_memory_${activeProjectId}`, JSON.stringify(assistantMemory));
    }
  }, [assistantMemory, activeProjectId]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const ragContext = localStorage.getItem('retroforge_rag_context') || "";
      const customPrompt = settings?.customAiPrompt ? `\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${settings.customAiPrompt}` : "";
      const dynamicSystemPrompt = `${SYSTEM_PROMPT}${customPrompt}\n\n${ragContext}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          systemInstruction: dynamicSystemPrompt,
          settings: settings
        }),
        signal: abortControllerRef.current.signal
      });
      
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error("[TELEMETRIA] Chat fetch error:", error?.message || error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar com a IA. Verifique sua conexão e tente novamente.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
     setMessages([
       { role: 'assistant', content: 'Memória limpa. Sistema RetroForge pronto para novas intrusões.' }
     ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] max-w-5xl mx-auto bg-surface border border-outline-variant rounded-3xl shadow-elevation-2 overflow-hidden relative">
      <div className="p-4 border-b border-outline-variant bg-surface flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center shadow-elevation-1 relative">
            <Bot className="text-on-primary-container w-6 h-6" />
            <motion.div 
               className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-surface ${isLoading ? 'bg-primary' : 'bg-green-500'}`}
               initial={{ scale: 0.8 }}
               animate={{ scale: [0.8, 1.2, 0.8] }}
               transition={{ repeat: Infinity, duration: 2 }}
            />
          </div>
          <div>
            <h2 className="text-title-medium text-on-surface font-medium">RetroForge AI</h2>
            <span className="text-label-small text-on-surface-variant font-mono uppercase tracking-widest flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-primary animate-pulse' : 'bg-green-500'}`} /> 
              {isLoading ? 'Analisando Fluxo...' : 'Conectado'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={clearChat} className="p-2.5 rounded-full hover:bg-error-container text-on-surface-variant hover:text-on-error-container transition-colors" aria-label="Limpar Histórico">
            <Trash2 className="w-5 h-5" />
          </button>
          <button className="p-2.5 rounded-full hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors" aria-label="Configurações (Em breve)">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div 
              initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              key={i} 
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-elevation-1 ${m.role === 'user' ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary'}`}>
                  {m.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div className={`p-4 rounded-[24px] text-body-medium leading-relaxed overflow-hidden shadow-elevation-1 ${
                  m.role === 'user' 
                    ? 'bg-secondary-container text-on-secondary-container rounded-tr-sm' 
                    : 'bg-surface-container-high text-on-surface border border-outline-variant rounded-tl-sm'
                }`}>
                  {m.role === 'assistant' ? (
                    <div className="prose prose-invert prose-p:text-on-surface prose-headings:text-on-surface prose-strong:text-on-surface prose-code:text-primary max-w-none prose-pre:bg-surface-container prose-pre:border prose-pre:border-outline-variant prose-p:leading-relaxed prose-a:text-primary hover:prose-a:text-primary/80">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shadow-elevation-1">
                <Sparkles className="w-5 h-5 text-on-primary-container animate-spin" />
              </div>
              <div className="p-4 bg-surface-container-high border border-outline-variant rounded-[24px] rounded-tl-sm flex gap-1.5 items-center h-[56px] shadow-elevation-1">
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-2.5 h-2.5 bg-primary rounded-full" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-2.5 h-2.5 bg-primary rounded-full" />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-2.5 h-2.5 bg-primary rounded-full" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-surface/90 backdrop-blur-md border-t border-outline-variant relative z-10 w-full pt-6 rounded-b-3xl">
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-3 mb-2 px-1">
            {[
              { label: "Gerador de Patch Hex", icon: <Terminal className="w-4 h-4"/>, prompt: "Você é o Core de Injeção. O usuário fornecerá um bloco de código Assembly (via Capstone) e a intenção de mod. Sua tarefa:\n\n1. Analisar a intenção e reescrever o código Assembly respeitando as restrições da arquitetura do console.\n2. Compilar mentalmente ou indicar o retorno do Patch Hexadecimal formatado que seria gerado pelo Keystone.\n3. Retornar sua resposta estritamente no formato:\n\n[HEX PATCH]\nXX XX XX XX\n\n[LOGIC]\nExplicação concisa do porquê o novo assembly é válido (ex: NOPs inseridos para manter o alinhamento da instrução e evitar crashes)." },
              { label: "O Core Operacional", icon: <Terminal className="w-4 h-4"/>, prompt: "ATUAÇÃO: Você é o Core Operacional do RetroForge AI, uma engine de elite para Recompilação Estática, Modding Avançado e Romhacking Assistido.\n\nCAPACIDADES AUTÔNOMAS:\n- AUTODETECT: Identifique a CPU e a arquitetura a partir de bytes hexadecimais.\n- DECOMPILE: Transforme e descompile funções complexas autonomamente em pseudocódigo estendido.\n- REWRITE: Modifique lógicas para hacks específicos.\n- TRANSLATE: Identifique ponteiros de memória de texto e traduza as strings.\n\nDIRETRIZES DE SAÍDA:\nApresente o resultado estruturado em [OFFSET], [ORIGINAL], [PATCH], e [LOGIC]." },
              { label: "Mod de Vida Infinita", icon: <Terminal className="w-4 h-4"/>, prompt: "Analyze the provided ASM code snippet to identify function signatures, internal logic, and suggest potential hook points for modding. Then, provide the translated C++ pseudocode and a hexadecimal patch for the modification 'apply infinite health'." },
              { label: "Decompilação", icon: <Terminal className="w-4 h-4"/>, prompt: "Atue como um especialista em engenharia reversa. Analise o dump de memória hexadecimal e converta-o em pseudocódigo C estruturado. Identifique: 1. Endereços de funções, 2. Estruturas de loops, 3. Condicionais, 4. Syscalls." },
              { label: "Pattern Scanning", icon: <Binary className="w-4 h-4"/>, prompt: "Estou buscando o endereço de memória que controla o contador de vidas. O padrão de bytes costuma ser [INSERIR BYTES]. Quais instruções de Assembly (como 'ADDIU' ou 'LUI') devo procurar para identificar decremento? Forneça uma expressão regular." },
              { label: "Script Injection", icon: <Sparkles className="w-4 h-4"/>, prompt: "Gere um código de 'Hook' em Assembly para ser injetado no offset [ENDEREÇO]. O código deve interceptar a rotina de pulo original, verificar se o botão foi pressionado (RAM [0xXXXX]) e resetar a gravidade Y. Forneça mnemônicos e Hex." }
            ].map((preset, idx) => (
              <button 
                key={idx}
                onClick={() => setInput(preset.prompt)}
                className="shrink-0 flex items-center gap-2 px-4 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-outline rounded-full text-label-large text-on-surface transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-surface"
              >
                {React.cloneElement(preset.icon, { className: 'text-primary w-4 h-4' })}
                {preset.label}
              </button>
            ))}
        </div>
        <div className="relative flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Pergunte sobre arquitetura MIPS, hooks de renderização ou tradução..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-surface-container-high border border-outline-variant rounded-full pl-6 pr-6 py-4 text-body-large text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed text-on-primary w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-elevation-1 hover:shadow-elevation-2 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface shrink-0"
          >
            <Send className="w-6 h-6 ml-1" />
          </button>
        </div>
        <div className="mt-4 flex justify-between items-center text-label-small text-on-surface-variant font-mono tracking-widest px-4 uppercase">
          <span>{isLoading ? 'ANALISANDO FLUXO...' : 'PRONTO'}</span>
          <span>SYSTEM_ID: RETROFORGE_KNOWLEDGE_LINK</span>
        </div>
      </div>
    </div>
  );
}

