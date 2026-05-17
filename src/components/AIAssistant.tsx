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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

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
        })
      });
      
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error(error);
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
    <div className="flex flex-col h-[calc(100vh-160px)] max-w-5xl mx-auto bg-[#0F0F0F] border border-white/5 rounded-xl shadow-2xl overflow-hidden relative">
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Bot className="text-black w-6 h-6" />
          </div>
          <div>
            <h2 className="text-white font-bold leading-none">RetroForge AI</h2>
            <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" /> Expert Systems Eng
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={clearChat} className="p-2 bg-white/5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors" title="Limpar Histórico">
            <Trash2 className="w-4 h-4" />
          </button>
          <button className="p-2 bg-white/5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Configurações (Em breve)">
            <Settings className="w-4 h-4" />
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
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-lg ${m.role === 'user' ? 'bg-purple-500 shadow-purple-500/20' : 'bg-cyan-500 shadow-cyan-500/20'}`}>
                  {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-black" />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed overflow-hidden shadow-md ${
                  m.role === 'user' 
                    ? 'bg-purple-500/10 border border-purple-500/20 text-purple-100 rounded-tr-sm' 
                    : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm'
                }`}>
                  {m.role === 'assistant' ? (
                    <div className="prose prose-invert max-w-none prose-pre:bg-[#0A0A0A] prose-pre:border prose-pre:border-white/10 prose-p:leading-relaxed prose-a:text-cyan-400 hover:prose-a:text-cyan-300">
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
          <div className="flex justify-start">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center animate-pulse">
                <Sparkles className="w-4 h-4 text-black" />
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex gap-1 items-center h-[52px]">
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-black/60 backdrop-blur-md border-t border-white/5 relative z-10 w-full pt-6">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-3 mb-2 px-1">
            {[
              { label: "Gerador de Patch Hex", icon: <Terminal className="w-3 h-3 text-red-500"/>, prompt: "Você é o Core de Injeção. O usuário fornecerá um bloco de código Assembly (via Capstone) e a intenção de mod. Sua tarefa:\n\n1. Analisar a intenção e reescrever o código Assembly respeitando as restrições da arquitetura do console.\n2. Compilar mentalmente ou indicar o retorno do Patch Hexadecimal formatado que seria gerado pelo Keystone.\n3. Retornar sua resposta estritamente no formato:\n\n[HEX PATCH]\nXX XX XX XX\n\n[LOGIC]\nExplicação concisa do porquê o novo assembly é válido (ex: NOPs inseridos para manter o alinhamento da instrução e evitar crashes)." },
              { label: "O Core Operacional", icon: <Terminal className="w-3 h-3 text-red-500"/>, prompt: "ATUAÇÃO: Você é o Core Operacional do RetroForge AI, uma engine de elite para Recompilação Estática, Modding Avançado e Romhacking Assistido.\n\nCAPACIDADES AUTÔNOMAS:\n- AUTODETECT: Identifique a CPU e a arquitetura a partir de bytes hexadecimais.\n- DECOMPILE: Transforme e descompile funções complexas autonomamente em pseudocódigo estendido.\n- REWRITE: Modifique lógicas para hacks específicos.\n- TRANSLATE: Identifique ponteiros de memória de texto e traduza as strings.\n\nDIRETRIZES DE SAÍDA:\nApresente o resultado estruturado em [OFFSET], [ORIGINAL], [PATCH], e [LOGIC]." },
              { label: "Mod de Vida Infinita", icon: <Terminal className="w-3 h-3 text-purple-400"/>, prompt: "Analyze the provided ASM code snippet to identify function signatures, internal logic, and suggest potential hook points for modding. Then, provide the translated C++ pseudocode and a hexadecimal patch for the modification 'apply infinite health'." },
              { label: "Decompilação", icon: <Terminal className="w-3 h-3 text-purple-400"/>, prompt: "Atue como um especialista em engenharia reversa. Analise o dump de memória hexadecimal e converta-o em pseudocódigo C estruturado. Identifique: 1. Endereços de funções, 2. Estruturas de loops, 3. Condicionais, 4. Syscalls." },
              { label: "Pattern Scanning", icon: <Binary className="w-3 h-3 text-cyan-400"/>, prompt: "Estou buscando o endereço de memória que controla o contador de vidas. O padrão de bytes costuma ser [INSERIR BYTES]. Quais instruções de Assembly (como 'ADDIU' ou 'LUI') devo procurar para identificar decremento? Forneça uma expressão regular." },
              { label: "Script Injection", icon: <Sparkles className="w-3 h-3 text-cyan-400"/>, prompt: "Gere um código de 'Hook' em Assembly para ser injetado no offset [ENDEREÇO]. O código deve interceptar a rotina de pulo original, verificar se o botão foi pressionado (RAM [0xXXXX]) e resetar a gravidade Y. Forneça mnemônicos e Hex." }
            ].map((preset, idx) => (
              <button 
                key={idx}
                onClick={() => setInput(preset.prompt)}
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-white/10 hover:border-cyan-500/30 rounded-full text-xs text-gray-300 hover:text-white transition-all shadow-sm"
              >
                {preset.icon}
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
            className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all shadow-inner"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed text-black p-4 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transform hover:scale-105 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 flex justify-between items-center text-[9px] text-gray-600 font-mono tracking-widest px-2 uppercase">
          <span>{isLoading ? 'ANALISANDO FLUXO...' : 'PRONTO'}</span>
          <span>SYSTEM_ID: RETROFORGE_KNOWLEDGE_LINK</span>
        </div>
      </div>
    </div>
  );
}
