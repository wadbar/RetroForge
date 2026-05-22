import React, { useState, useEffect } from 'react';
import { BrainCircuit, UploadCloud, Database, Code, ShieldCheck, Sparkles, AlertTriangle, Cpu, FileText, Code2, X, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { wsService } from '../services/websocketService';

export default function AIFineTuning() {
  const [knowledgeBase, setKnowledgeBase] = useState<{name: string, type: string, size: string, isStatic?: boolean, content?: string}[]>([
    { 
      name: 'Retro_RE_Master_Guide_v1.txt', 
      type: 'Metodologia / Guia RE', 
      size: '45 KB', 
      isStatic: true, 
      content: `O Guia Definitivo de Reverse Engineering e Modding de Jogos Clássicos (IA RAG Data):
      
1. DECOMPILAÇÃO E DISASSEMBLY (ASM para C/C++)
- Ferramentas Padrão: Ghidra, IDA Pro, r2.
- O objetivo da decompilação de jogos retro (ex: sm64, zeldaret) é alcançar o "matching" (byte-matching): o código C compilado deve produzir exatamente os mesmos bytes originais da ROM.
- Arquiteturas comuns: MIPS (N64, PS1), ARM (GBA, NDS), SuperFX/65816 (SNES).
- Seções de memória: .text (código executável), .rodata (constantes, strings, floats), .data (variáveis globais inicializadas), .bss (globais zeradas).
- Como ler MIPS: registradores como a0-a3 (argumentos), v0-v1 (retornos), s0-s7 (salvos), ra (return address). Branch delay slots são vitais: a instrução apóso branch sempre executa.

2. TRADUÇÃO (ROMHACKING) E STRING EXTRACTION
- Jogos raramente usam ASCII padrão. Eles usam tabelas "TBL", onde cada HEX corresponde a uma letra customizada (ex: 0A = 'A', 0B = 'B').
- Controle Hex: 0x00 pode não ser 'null', mas 'Quebra de Linha'. 0xFF pode ser o terminador de string. 0x05 0x02 pode ser um código para destacar texto ou aguardar A.
- "Space Limitations" (Limitação de Espaço): ROM translation exige que a string PT-BR caiba no mesmo espaço. Se não couber, é necessário Repontar (Pointer Recalculation).
- Ponteiros Relativos vs Absolutos: Em plataformas de 8/16 bit, os ponteiros costumam ser little-endian. O endereço 0x1A2B é lido como 2B 1A. Se uma string foi movida para o fim da ROM no Bank 2, o Address Table precisa ser atualizado corrigindo a offset aritmética.
- IPS / BPS / xDelta: Patchs registram um diff exato entre a ROM original e a modificada. IPS falha para arquivos > 16MB. BPS (Beat Patch System) é o padrão ouro pois grava checksum.

3. SÍMBOLOS E FUNÇÕES:
- O agente IA deve agir detectando padrões de sub-rotinas de inicialização gráfica e lógica. Loop de Gameplay normalmente chama rotinas de Update e Draw.
- IA deve traduzir respeitando limites fixos de caracteres ou prevendo padding com zeros [00] até o tamanho alocado.` 
    },
    {
      name: 'Advanced_Prompts_Retro.txt',
      type: 'Metodologia / Guia RE',
      size: '62 KB',
      isStatic: true,
      content: `1. Para o "Static Decompiler" (Módulo de Recompilação)
Foco em transformar bytes em lógica legível, identificando estruturas de controle. Analise o dump de memória hexadecimal e converta-o em pseudocódigo C estruturado. Identifique: 1. Endereços de funções, 2. Estruturas de loops (for/while), 3. Condicionais (if/else). Se houver chamadas de sistema (syscalls), descreva o provável propósito delas com base nos registradores.

2. Para o "SDK Pattern Scanner" (Módulo de Modding)
Objetivo é encontrar onde certas mecânicas (como HP, Pulo, Dinheiro) estão armazenadas para criar "Hacks". Com base no comportamento padrão da arquitetura, identificar instruções de Assembly (como 'ADDIU' ou 'LUI') e gerar expressões regulares para o Pattern Scanner.

3. Para o Módulo de "Tradução" (ASCII/Shift-JIS Extractor)
Analise blocos hexadecimais, crie 'Translation Tables' (.tbl), decodifique bytes usando a lógica inferida e identifique ponteiros de texto (offsets).

4. Para a Implementação de "Mecânicas Reais" (Script Injection)
Gere códigos de 'Hook' em Assembly para interceptar rotinas originais, verifique flags em RAM livre e forneça mnemônicos e bytes hexadecimais para inserção no Hex Editor. Lembre-se SEMPRE do alinhamento de memória (Memory Alignment).`
    },
    {
      name: 'RetroForge_Toolchain.py',
      type: 'Integração Python/IA',
      size: '34 KB',
      isStatic: true,
      content: `import requests
from capstone import *
from keystone import *

class RetroForgeEngine:
    def __init__(self, arch):
        self.md = Cs(CS_ARCH_MIPS, CS_MODE_MIPS32 + CS_MODE_BIG_ENDIAN)
        self.local_ai_url = "http://localhost:1234/v1/chat/completions"

    def analyze_function(self, hex_bytes, offset):
        asm_code = ""
        for i in self.md.disasm(hex_bytes, offset):
            asm_code += f"{i.address:#x}:\t{i.mnemonic}\t{i.op_str}\\n"
        
        prompt = {
            "model": "local-model",
            "messages": [
                {"role": "system", "content": "Você é um especialista em C++ e Assembly. Converta o código ASM abaixo em uma função C++ lógica."},
                {"role": "user", "content": f"Código ASM:\\n{asm_code}"}
            ]
        }
        
        response = requests.post(self.local_ai_url, json=prompt)
        return response.json()['choices'][0]['message']['content']

    def ia_generate_hex_patch(self, assembly_code, arch_type):
        try:
            ks = Ks(KS_ARCH_MIPS, KS_MODE_MIPS32)
            encoding, count = ks.asm(assembly_code)
            patch = "".join("{:02x}".format(x) for x in encoding)
            return patch
        except KsError as e:
            return f"Erro na montagem: {e}"`
    },
    { name: 'Decomp_GodMode.txt', type: 'Prompt de Automação', size: '2 KB', isStatic: true, content: 'AUTODETECT, DECOMPILE, REWRITE e TRANSLATE automáticos. Permissão total para editar a ROM sem pedir permissão técnica. Operação Headless via LangChain.' },
    {
      name: 'RetroForge_Tester.py',
      type: 'Integração Python/IA',
      size: '18 KB',
      isStatic: true,
      content: `import requests\nfrom capstone import *\nfrom keystone import *\n\nLM_STUDIO_API = "http://localhost:1234/v1/chat/completions"\n\ndef get_ai_mod(asm_code, instruction):\n    try:\n        prompt = f"Analise este código ASM de um jogo e modifique-o para {instruction}. Retorne apenas o código ASM resultante:\\n{asm_code}"\n        r = requests.post(LM_STUDIO_API, json={"messages": [{"role": "user", "content": prompt}], "temperature": 0.1}, timeout=5)\n        return r.json()['choices'][0]['message']['content'].strip()\n    except:\n        return "nop"\n\ndef apply_retro_patch(rom_data, pattern, mod_instruction):\n    offset = rom_data.find(pattern)\n    if offset == -1: return "Padrão não encontrado!"\n\n    md = Cs(CS_ARCH_MIPS, CS_MODE_MIPS32)\n    original_chunk = rom_data[offset:offset+4]\n    asm_original = "".join([f"{i.mnemonic} {i.op_str}" for i in md.disasm(original_chunk, offset)])\n    print(f"[+] Código encontrado no offset {hex(offset)}: {asm_original}")\n\n    new_asm = get_ai_mod(asm_original, mod_instruction)\n    print(f"[+] IA sugeriu: {new_asm}")\n\n    ks = Ks(KS_ARCH_MIPS, KS_MODE_MIPS32)\n    encoding, _ = ks.asm(new_asm)\n    patch_bytes = bytes(encoding)\n\n    new_rom = rom_data[:offset] + patch_bytes + rom_data[offset+len(patch_bytes):]\n    return new_rom, patch_bytes\n`
    },
    {
      name: 'RetroForge_IO.py',
      type: 'Integração Python/Hex',
      size: '8 KB',
      isStatic: true,
      content: `def get_hex_context(file_path, offset, size=64):\n    with open(file_path, "rb") as f:\n        f.seek(offset)\n        return f.read(size).hex().upper()\n\ndef apply_patch(file_path, offset, hex_patch):\n    patch_bytes = bytes.fromhex(hex_patch)\n    with open(file_path, "r+b") as f:\n        f.seek(offset)\n        f.write(patch_bytes)\n    return "Patch Aplicado com Sucesso!"`
    },
    {
      name: 'RetroForge_Scanner.py',
      type: 'Integração Python/YARA',
      size: '18 KB',
      isStatic: true,
      content: `import re\nimport requests\nfrom capstone import *\n\nLM_STUDIO_API = "http://localhost:1234/v1/chat/completions"\n\nclass AIScanner:\n    def __init__(self, arch=CS_ARCH_MIPS, mode=CS_MODE_MIPS32):\n        self.md = Cs(arch, mode)\n\n    def ask_ai_for_pattern(self, intent, platform="PS1"):\n        prompt = f"Estou hackeando um jogo de {platform}. Quero {intent}. Qual o padrão de bytes ou opcode em Hexadecimal e wildcards (ex: 80 ?? ?? 20) eu devo procurar na ROM? Retorne APENAS o padrão hexadecimal ou mnemônicos."\n        try:\n            r = requests.post(LM_STUDIO_API, json={"messages": [{"role": "user", "content": prompt}], "temperature": 0.1})\n            return r.json()['choices'][0]['message']['content'].strip()\n        except:\n            return "00 00 00 00" # fallback\n\n    def scan_rom(self, rom_data, pattern_hex):\n        # Ex: "24 02 ?? ??" -> "2402...."\n        regex_pattern = pattern_hex.replace("??", "..").replace(" ", "")\n        hex_data = rom_data.hex()\n        matches = [m.start() // 2 for m in re.finditer(regex_pattern.lower(), hex_data)]\n        return matches\n\n    def auto_find_and_patch(self, rom_data, intent):\n        pattern = self.ask_ai_for_pattern(intent)\n        print(f"[IA] Padrão sugerido: {pattern}")\n        offsets = self.scan_rom(rom_data, pattern)\n        if not offsets:\n            return "Nenhum offset encontrado."\n        print(f"[SCAN] Encontrado em: {[hex(o) for o in offsets]}")\n        return offsets`
    },
    {
      name: 'RetroForge_Repointing.py',
      type: 'Integração Python/IA/Hex',
      size: '28 KB',
      isStatic: true,
      content: `import r2pipe\nfrom keystone import *\n\ndef auto_repoint_string(rom_data, old_addr, new_string, pointer_table_offset):\n    """\n    Lógica de Auto-Repointing:\n    1. Radare2 busca área vazia (Code Cave de 00s).\n    2. Escreve a nova string (maior que a original) lá.\n    3. Atualiza o ponteiro na TBL/Pointer Table.\n    """\n    r2 = r2pipe.open("rom.bin")\n    # Busca 256 bytes de espaço livre (0x00)\n    free_space_matches = r2.cmd("/x 00" * 256)\n    new_addr = parse_r2_match(free_space_matches)\n    \n    # Atualiza ROM virtual\n    updated_rom = write_string(rom_data, new_addr, new_string)\n    updated_rom = update_pointer(updated_rom, pointer_table_offset, old_addr, new_addr)\n    return updated_rom`
    },
    {
      name: 'Sistema_Arquivos.ksy',
      type: 'Kaitai Struct / Mapping',
      size: '4 KB',
      isStatic: true,
      content: `meta:\n  id: retro_rom\n  endian: be\nseq:\n  - id: header\n    type: rom_header\n  - id: code_segment\n    size: 0x100000\n  - id: asset_pointers\n    type: u4\n    repeat: expr\n    repeat-expr: 1024\ntypes:\n  rom_header:\n    seq:\n      - id: magic\n        contents: [0x80, 0x37, 0x12, 0x40]\n      - id: clock_rate\n        type: u4\n      - id: entry_point\n        type: u4`
    },
    {
      name: 'Auto_CodeCave.asm',
      type: 'Armips / Assembler',
      size: '12 KB',
      isStatic: true,
      content: `.mips\n.open "rom.z64", 0\n\n// Redireciona função de dano\n.org 0x80245000\nj modded_damage_calc\nnop\n\n// Realoca na Code Cave vazia (Free RAM)\n.org 0x80700000\nmodded_damage_calc:\n  // Setup custom logic by AI\n  li a0, 0x0000\n  jr ra\n  nop\n\n.close`
    },
    {
      name: 'Ghidra_Radare2_Agents.py',
      type: 'Integração LangChain',
      size: '42 KB',
      isStatic: true,
      content: `from langchain.agents import initialize_agent, Tool\nimport r2pipe\nimport subprocess\n\ndef run_ghidra_headless(rom_path, func_offset):\n    # Envia comando para Ghidra Headless Server gerar AST/C\n    cmd = f"analyzeHeadless sharedProject rom -process {rom_path} -postScript Decompile.java {func_offset}"\n    result = subprocess.run(cmd, shell=True, capture_output=True)\n    return result.stdout\n\nghidra_tool = Tool(\n    name="Ghidra Decompiler",\n    func=run_ghidra_headless,\n    description="Extrai a lógica da função em C puro do offset X"\n)\n\n# Radare2 Tool para fluxogramas (CFG)\nr2_tool = Tool(\n    name="Radare2 Graph",\n    func=lambda offset: r2pipe.open("rom.bin").cmd(f"pdf @ {offset}"),\n    description="Obtém informações estruturais e Assembly avançadas"\n)`
    },
    {
      name: 'RetroForge_Translator.py',
      type: 'Integração Python/IA/Hex',
      size: '26 KB',
      isStatic: true,
      content: `import requests\nfrom capstone import *\n\nGEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=SUA_CHAVE"\n\ndef batch_translate(strings_brutas, idioma_destino="pt-br"):\n    prompt = f"Atue como um exímio romhacker. Traduza o seguinte JSON de strings de jogo de RPG para {idioma_destino}. Considere o limite de tamanho e vocabulário retro. O output DEVE SER apenas o JSON das strings traduzidas, respeitando a quebra de linha original [0x00]. Strings originais: \\n{strings_brutas}"\n\n    try:\n        r = requests.post(GEMINI_API_URL, json={\n            "contents": [{"parts":[{"text": prompt}]}]\n        })\n        return r.json()['candidates'][0]['content']['parts'][0]['text']\n    except Exception as e:\n        return f"Falha na inferência neural: {e}"`
    },
    {
      name: 'RetroForge_LiveMemory.py',
      type: 'Integração Pymem',
      size: '15 KB',
      isStatic: true,
      content: `import pymem\nimport pymem.process\nfrom keystone import *\n\ndef init_live_environment(process_name="pcsx2.exe"):\n    try:\n        pm = pymem.Pymem(process_name)\n        return pm\n    except pymem.exception.ProcessNotFound:\n        print("[ERRO] Emulador não encontrado. Inicie o jogo antes do Hooking.")\n        return None\n\ndef live_inject(pm, patch_asm, address, arch=KS_ARCH_MIPS, mode=KS_MODE_MIPS32):\n    if not pm:\n        return "Sem conexão com processo."\n    try:\n        # 1. Monta novo ASM com Keystone Engine\n        ks = Ks(arch, mode)\n        encoding, _ = ks.asm(patch_asm)\n        # 2. Injeção Cirúrgica na Memória RAM Física Emulada\n        pm.write_bytes(address, bytes(encoding), len(encoding))\n        return f"Hook/Patch aplicado com sucesso no offset {hex(address)}!"\n    except Exception as e:\n        return f"Assembly Error/Memory Error: {e}"\n\n# Exemplo: pm = init_live_environment(); live_inject(pm, "nop", 0x2001000)`
    },
    {
      name: 'RetroForge_Keystone.py',
      type: 'Integração Python/ASM',
      size: '12 KB',
      isStatic: true,
      content: `from keystone import *\n\nclass AssemblerEngine:\n    def __init__(self, arch=KS_ARCH_MIPS, mode=KS_MODE_MIPS32):\n        self.ks = Ks(arch, mode)\n\n    def assemble(self, asm_code):\n        """Converte Assembly Mnemonics para Hexadecimal Patch."""\n        try:\n            encoding, count = self.ks.asm(asm_code)\n            hex_string = "".join([f"{b:02X}" for b in encoding])\n            return {\n                "hex": hex_string,\n                "bytes": bytes(encoding),\n                "count": count,\n                "status": "success"\n            }\n        except KsError as e:\n            return {"status": "error", "message": f"Keystone Error: {str(e)}"}\n\n# Exemplo de uso:\n# engine = AssemblerEngine()\n# result = engine.assemble("nop")\ntry:\n    # Suporte a múltiplas arquiteturas\n    z80_engine = AssemblerEngine(KS_ARCH_X86, KS_MODE_32) # Fallback / Example\n    arm_engine = AssemblerEngine(KS_ARCH_ARM, KS_MODE_ARM)\nexcept:\n    pass\n`
    },
    {
      name: 'RetroForge_AIPatcher.py',
      type: 'Integração IA/Hex/Patching',
      size: '14 KB',
      isStatic: true,
      content: `import requests\nfrom keystone import *\n\nLM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"\n\ndef generate_ai_hex_patch(asm_context, intent, arch_context="MIPS R3000A"):\n    """\n    Envia o código Assembly original e a intenção do usuário para a IA.\n    A IA deve retornar o [HEX PATCH] correspondente e o [LOGIC].\n    """\n    prompt = f"Atue como o Core de Injeção. O usuário precisa de um mod para {arch_context}. Intenção: {intent}. Código ASM original:\\n{asm_context}\\nRetorne APENAS o [HEX PATCH] e [LOGIC] (formato exigido)."\n    try:\n        r = requests.post(LM_STUDIO_URL, json={\n            "messages": [{"role": "user", "content": prompt}],\n            "temperature": 0.1\n        })\n        response_text = r.json()['choices'][0]['message']['content'].strip()\n        \n        # Simula o parsing da resposta estruturada da IA\n        if "[HEX PATCH]" in response_text:\n             hex_part = response_text.split("[HEX PATCH]")[1].split("[LOGIC]")[0].strip()\n             logic_part = response_text.split("[LOGIC]")[1].strip() if "[LOGIC]" in response_text else "Sem explicação."\n             return hex_part, logic_part\n        return "00 00 00 00", "Fallback: NOP"\n    except Exception as e:\n        return None, f"Erro AI: {e}"\n\ndef apply_compiled_patch(file_path, offset, hex_string):\n    patch_bytes = bytes.fromhex(hex_string.replace(" ", ""))\n    with open(file_path, "r+b") as f:\n        f.seek(offset)\n        f.write(patch_bytes)\n    return f"Patch Aplicado com Sucesso em {hex(offset)}!"\n`
    },
    {
      name: 'RetroForge_AutoPatch.py',
      type: 'Integração Python/IA',
      size: '22 KB',
      isStatic: true,
      content: `import requests
from capstone import *
from keystone import *

LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"
ARCH = CS_ARCH_MIPS
MODE = CS_MODE_MIPS32

def retroforge_auto_mod(hex_buffer, offset, user_intent):
    md = Cs(ARCH, MODE)
    instructions = ""
    for i in md.disasm(hex_buffer, offset):
        instructions += f"{i.mnemonic} {i.op_str}\\n"

    prompt = f"""
    Você é um Engenheiro de Mods para RetroForge AI. 
    Analise este código Assembly e modifique-o para: {user_intent}.
    Retorne APENAS o código Assembly modificado, sem explicações.
    
    CÓDIGO ORIGINAL:
    {instructions}
    """

    response = requests.post(LM_STUDIO_URL, json={
        "messages": [{"role": "user", "content": prompt}],
        "model": "local-model"
    })
    
    new_asm = response.json()['choices'][0]['message']['content']

    try:
        ks = Ks(ARCH, MODE)
        encoding, count = ks.asm(new_asm.encode())
        return bytes(encoding).hex().upper()
    except KsError as e:
        return f"Erro na montagem: {e}"`
    },
    {
      name: 'Architecture_Stack.json',
      type: 'Configuração do Sistema',
      size: '14 KB',
      isStatic: true,
      content: `// RetroForge Engine Stack
{
  "frontend": "React / Electron (Acesso I/O direto via FS)",
  "backend": {
    "language": "Python via IPC",
    "disassembly": "Capstone Engine (Converte Hex -> ASM)",
    "assembly": "Keystone Engine (Converte ASM -> Hex de Patches e Hooks)",
    "pattern_scanning": "YARA Rules para detecção de motores e variáveis",
    "hex_parsing": "Kaitai Struct para mapeamento de Header/Dados"
  },
  "re_engine": "Radare2 / Ghidra (Headless Mode Scripting)",
  "ai_orchestration": {
    "local_bridge": "LM Studio / Ollama (Porta 1234 via REST) - Privacidade e Velocidade",
    "cloud_bridge": "Gemini API - Raciocínio avançado e traduções semânticas"
  }
}`
    },
    { name: 'N64_MIPS_Opcode_Sheet.json', type: 'Símbolos/Dicionário', size: '12 KB', isStatic: true, content: 'SVR_INSTRUCTION_SET=MIPS; DELAY_SLOT=TRUE; REGS="v0,a0,a1,t0,s0,ra"' },
    { name: 'SuperMario64_Camera_Decomp.cpp', type: 'Código Referência (C/C++)', size: '28 KB', isStatic: true, content: 'void update_camera(struct Camera *c) { ... } // pseudo-referência de struct layouts e fixed-point math comuns em jogos.' },
  ]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [docModal, setDocModal] = useState<{type: 'markdown' | 'code', title: string, content: string} | null>(null);

  const openDoc = (kb: {name: string, content?: string, type: string}) => {
    if (!kb.content) return;
    setDocModal({
      type: kb.name.endsWith('.md') || kb.name.endsWith('.txt') ? 'markdown' : 'code',
      title: kb.name,
      content: kb.content
    });
  };

  useEffect(() => {
    let mountedContext = "INFORMAÇÕES DE FINE-TUNING (RAG) FORNECIDAS PELO USUÁRIO PARA GUIAR SUAS RESPOSTAS:\n\n";
    knowledgeBase.forEach(kb => {
        if (kb.content) {
            mountedContext += `=== ARQUIVO: ${kb.name} ===\n${kb.content}\n\n`;
        }
    });
    localStorage.setItem('retroforge_rag_context', mountedContext);
  }, [knowledgeBase]);

  // Set up WebSocket connection for collaborative engineering
  useEffect(() => {
    wsService.connect();

    const handleTuningUpdate = (data: any) => {
      console.log("[Tier 1] Received collaborative tuning update");
      // Add incoming knowledge items if they do not exist
      setKnowledgeBase(prev => {
        const newItems = data.items.filter((incomingItem: any) => 
          !prev.some(existingItem => existingItem.name === incomingItem.name)
        );
        if (newItems.length > 0) {
          return [...prev, ...newItems];
        }
        return prev;
      });
    };

    wsService.on("tuningUpdated", handleTuningUpdate);

    return () => {
      wsService.off("tuningUpdated", handleTuningUpdate);
    };
  }, []);

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files) as File[];
      const newItems = await Promise.all(files.map(async (f) => {
        let content = "";
        try {
            content = await f.text();
        } catch (err) {
            content = "Binário ou não lido";
        }
        return {
            name: f.name,
            type: f.name.endsWith('.pdf') ? 'Manual/Documentação' : f.name.endsWith('.json') ? 'Símbolos/Dicionário' : 'Código Referência (C/C++)',
            size: (f.size / 1024).toFixed(0) + ' KB',
            content: content.slice(0, 50000) // limit size per file to fit in localstorage mostly
        };
      }));
      setKnowledgeBase([...knowledgeBase, ...newItems]);
    };
    input.click();
  };

  const [ragError, setRagError] = useState<string | null>(null);

  const startTraining = async () => {
    setIsTraining(true);
    setTrainingProgress(0);
    setRagError(null);
    
    // Save all custom texts to mount a RAG profile
    let mountedContext = "INFORMAÇÕES DE FINE-TUNING (RAG) FORNECIDAS PELO USUÁRIO PARA GUIAR SUAS RESPOSTAS:\n\n";
    knowledgeBase.forEach(kb => {
        if (!kb.isStatic && kb.content) {
            mountedContext += `=== ARQUIVO: ${kb.name} ===\n${kb.content}\n\n`;
        }
    });

    try {
        localStorage.setItem('retroforge_rag_context', mountedContext);
        wsService.emit("syncTuning", { items: knowledgeBase });
        setTrainingProgress(100);
    } catch (e) {
        setRagError("Erro ao salvar RAG (arquivos muito grandes para a memória local).");
    }

    setIsTraining(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <div className="flex flex-col gap-4">
        <h1 className="text-display-small font-medium text-on-background flex items-center gap-3">
          <BrainCircuit className="w-10 h-10 text-primary" />
          Laboratório de Treinamento IA
        </h1>
        <p className="text-body-large text-on-surface-variant max-w-2xl">
          Forneça manuais de SDK, dicionários de símbolos e decompilações manuais para treinar a IA a entender a arquitetura específica do seu jogo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Model Status */}
        <div className="col-span-1 bg-surface-container-low border border-outline-variant rounded-3xl p-6 flex flex-col justify-between shadow-elevation-1">
          <div>
            <h3 className="text-title-large text-on-surface mb-6 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-green-500" />
              Modelo Atual
            </h3>
            <div className="space-y-4">
              <div className="bg-surface-container-high p-4 rounded-2xl border border-outline-variant shadow-sm">
                <div className="text-label-small text-on-surface-variant uppercase tracking-widest mb-1.5">Base Model</div>
                <div className="text-primary font-mono text-body-medium">gemini-3.1-pro</div>
              </div>
              <div className="bg-surface-container-high p-4 rounded-2xl border border-outline-variant shadow-sm">
                <div className="text-label-small text-on-surface-variant uppercase tracking-widest mb-1.5">Especialidade / Contexto</div>
                <div className="text-secondary font-mono text-body-medium">RetroForge-Core + RAG</div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 border-t border-outline-variant pt-4">
            <div className="text-label-large text-on-surface-variant flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="text-green-500 font-medium bg-green-500/10 px-2.5 py-1 rounded-md text-label-small">ATIVO</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-secondary">
                  <Users className="w-4 h-4" />
                  <span>Sincronização</span>
                </div>
                <span className="text-secondary font-medium uppercase bg-secondary-container px-2.5 py-1 rounded-md text-label-small">Tier 1 Sync</span>
              </div>
            </div>
          </div>
        </div>

        {/* Knowledge Base */}
        <div className="col-span-2 bg-surface-container-low border border-outline-variant rounded-3xl p-6 flex flex-col shadow-elevation-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-title-large text-on-surface flex items-center gap-2">
              <Database className="w-6 h-6 text-primary" />
              Base de Conhecimento
            </h3>
            <button 
              onClick={handleUpload}
              className="px-5 py-2.5 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container text-label-large font-medium rounded-full flex items-center gap-2 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-surface"
            >
              <UploadCloud className="w-5 h-5" />
              Upload Dados
            </button>
          </div>

          <div className="flex-1 border border-outline-variant rounded-[24px] overflow-hidden bg-surface">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-outline-variant text-label-small font-medium text-on-surface-variant uppercase tracking-wider bg-surface-container-high">
              <div className="col-span-6">Arquivo / Fonte</div>
              <div className="col-span-4">Tipo</div>
              <div className="col-span-2 text-right">Tamanho</div>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-2">
              {knowledgeBase.map((item, i) => (
                <div key={i} onClick={() => openDoc(item)} className="grid grid-cols-12 gap-4 p-3 rounded-xl hover:bg-surface-container-high transition-colors text-body-medium border border-transparent hover:border-outline-variant cursor-pointer group">
                  <div className="col-span-6 flex items-center gap-3 text-on-surface">
                    <Code className="w-5 h-5 text-on-surface-variant" />
                    <span className="truncate font-medium">{item.name}</span>
                  </div>
                  <div className="col-span-4 flex items-center">
                    <span className="text-label-small bg-primary-container text-on-primary-container px-2.5 py-1 rounded-md font-medium">
                      {item.type}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2 text-on-surface-variant font-mono text-label-small">
                    <span>{item.size}</span>
                    {!item.isStatic && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); setKnowledgeBase(prev => prev.filter((_, idx) => idx !== i)); }}
                         className="p-1.5 hover:bg-error-container text-on-surface-variant hover:text-error rounded-full opacity-0 group-hover:opacity-100 transition-all focus:outline-none focus:ring-2 focus:ring-error"
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                       </button>
                    )}
                  </div>
                </div>
              ))}
              {knowledgeBase.length === 0 && (
                <div className="p-10 text-center text-on-surface-variant text-label-medium font-mono uppercase opacity-60">
                  // NENHUMA FONTE DE TREINAMENTO ENCONTRADA. //
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fine-Tuning Action Area */}
      <div className="bg-surface-container-high border border-primary/30 rounded-3xl p-10 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-elevation-2">
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 blur-[100px] pointer-events-none rounded-full" />
        
        <BrainCircuit className="w-16 h-16 text-primary mb-6 relative z-10" />
        <h2 className="text-headline-medium font-medium text-on-surface mb-3 relative z-10">Processar Nova Base de Conhecimento</h2>
        <p className="text-body-large text-on-surface-variant max-w-xl mb-8 relative z-10">
          A IA analisará todos os SDKs, manuais e códigos recém-enviados para criar um novo "Lora" ou Contexto Especializado (RAG) para o seu jogo.
        </p>

        {isTraining ? (
          <div className="w-full max-w-md bg-surface border border-primary/30 p-6 rounded-2xl relative z-10 shadow-elevation-1">
            <div className="flex justify-between items-center mb-4 text-label-medium font-medium">
              <span className="text-primary font-mono uppercase">FINETUNING_IN_PROGRESS</span>
              <span className="text-on-surface font-mono">{trainingProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
               <motion.div 
                 className="h-full bg-primary"
                 style={{ width: `${trainingProgress}%` }}
               />
            </div>
            <p className="text-label-medium text-on-surface-variant text-center mt-5 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              Treinando embeddings na arquitetura informada...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 relative z-10">
            <button 
              onClick={startTraining}
              disabled={knowledgeBase.length === 0}
              className="h-14 px-10 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary font-bold text-label-large uppercase tracking-widest rounded-full shadow-elevation-2 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container-high"
            >
              <Cpu className="w-6 h-6" />
              INICIAR TREINAMENTO
            </button>
            {ragError && <p className="text-error text-body-medium font-mono bg-error-container text-on-error-container px-4 py-2 rounded-md">{ragError}</p>}
            {trainingProgress === 100 && !ragError && (
              <p className="text-green-600 dark:text-green-400 text-body-medium font-mono font-medium">✅ Treinamento concluído e RAG salvo no Cache Local.</p>
            )}
          </div>
        )}
      </div>

      <div className="p-5 bg-error-container/30 border border-error-container rounded-2xl flex gap-4 text-on-surface">
        <AlertTriangle className="w-6 h-6 text-error shrink-0" />
        <div>
          <strong className="text-error font-medium block mb-1">Aviso sobre Dados Customizados</strong>
          <span className="text-body-medium opacity-90">A engine de fine-tuning roda em containers isolados. O código fonte enviado (C/C++) será usado estritamente como in-context learning para melhorar a qualidade dos pseudocódigos gerados pelo RetroForge. Seus dados não treinam o modelo base global do Gemini publicamente.</span>
        </div>
      </div>

      <AnimatePresence>
         {docModal && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDocModal(null)} className="absolute inset-0 bg-scrim/80 backdrop-blur-md" />
                 <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-surface-container-high border border-outline-variant rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col relative z-10 shadow-elevation-3">
                     <div className="flex justify-between items-center p-5 border-b border-outline-variant bg-surface rounded-t-3xl">
                         <h3 className="text-title-medium text-on-surface font-medium flex items-center gap-3 font-mono">
                             {docModal.type === 'markdown' ? <FileText className="w-5 h-5 text-primary"/> : <Code2 className="w-5 h-5 text-secondary"/>} 
                             {docModal.title}
                         </h3>
                         <button onClick={() => setDocModal(null)} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"><X className="w-5 h-5"/></button>
                     </div>
                     <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-surface-container">
                         {docModal.type === 'markdown' ? (
                             <div className="prose prose-invert prose-p:text-body-medium prose-p:text-on-surface prose-h2:text-title-large prose-h2:text-primary prose-pre:bg-surface-container-highest prose-pre:border prose-pre:border-outline-variant max-w-none">
                                 <Markdown>{docModal.content}</Markdown>
                             </div>
                         ) : (
                             <pre className="font-mono text-label-medium text-primary/90 leading-relaxed whitespace-pre-wrap">{docModal.content}</pre>
                         )}
                     </div>
                 </motion.div>
             </div>
         )}
      </AnimatePresence>
    </div>
  );
}
