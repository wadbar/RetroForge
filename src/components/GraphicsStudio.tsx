import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Upload, Download, Sparkles, ZoomIn, ZoomOut, Settings2, Palette, Zap, Box } from 'lucide-react';
import { motion } from 'motion/react';

export default function GraphicsStudio() {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [bpp, setBpp] = useState<number>(4); // Default 4bpp SNES/GBA style
  const [offset, setOffset] = useState<number>(0);
  const [width, setWidth] = useState<number>(16); // in tiles
  const [zoom, setZoom] = useState<number>(2);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [paletteHex, setPaletteHex] = useState<string>("000000,FFFFFF,FF0000,00FF00,0000FF,FFFF00,00FFFF,FF00FF");
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setFileData(new Uint8Array(buffer));
  };

  const renderTiles = () => {
    if (!fileData || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const colors = paletteHex.split(',').map(c => {
       const clean = c.trim().replace('#', '');
       if (clean.length === 6) return [parseInt(clean.substring(0,2),16), parseInt(clean.substring(2,4),16), parseInt(clean.substring(4,6),16), 255];
       return [0,0,0,255];
    });
    // fallback colors if not enough
    while(colors.length < Math.pow(2, bpp)) colors.push([Math.random()*255, Math.random()*255, Math.random()*255, 255]);

    const tileSize = 8;
    const heightInTiles = 32; // Limit height for perf
    
    canvasRef.current.width = width * tileSize;
    canvasRef.current.height = heightInTiles * tileSize;
    
    const imgData = ctx.createImageData(width * tileSize, heightInTiles * tileSize);
    let dataIdx = offset;

    for (let ty = 0; ty < heightInTiles; ty++) {
        for (let tx = 0; tx < width; tx++) {
            // Render one 8x8 tile
            for (let py = 0; py < tileSize; py++) {
                let rowByte1 = 0, rowByte2 = 0, rowByte3 = 0, rowByte4 = 0;
                
                if (bpp === 1) {
                   rowByte1 = dataIdx < fileData.length ? fileData[dataIdx++] : 0;
                } else if (bpp === 2) { // GameBoy format planar
                   rowByte1 = dataIdx < fileData.length ? fileData[dataIdx] : 0;
                   rowByte2 = dataIdx + 1 < fileData.length ? fileData[dataIdx+1] : 0;
                   dataIdx += 2;
                } else if (bpp === 4) { // SNES 4bpp planar (simplified)
                   rowByte1 = dataIdx < fileData.length ? fileData[dataIdx] : 0;
                   rowByte2 = dataIdx + 1 < fileData.length ? fileData[dataIdx+1] : 0;
                   rowByte3 = dataIdx + 16 < fileData.length ? fileData[dataIdx+16] : 0;
                   rowByte4 = dataIdx + 17 < fileData.length ? fileData[dataIdx+17] : 0;
                   dataIdx += 2;
                }

                for (let px = 0; px < tileSize; px++) {
                    const shift = 7 - px;
                    let colorIndex = 0;
                    
                    if (bpp === 1) {
                        colorIndex = (rowByte1 >> shift) & 1;
                    } else if (bpp === 2) {
                        colorIndex = ((rowByte1 >> shift) & 1) | (((rowByte2 >> shift) & 1) << 1);
                    } else if (bpp === 4) {
                        colorIndex = ((rowByte1 >> shift) & 1) | (((rowByte2 >> shift) & 1) << 1) | (((rowByte3 >> shift) & 1) << 2) | (((rowByte4 >> shift) & 1) << 3);
                    }

                    const c = colors[colorIndex % colors.length];
                    const pixelIdx = ((ty * tileSize + py) * (width * tileSize) + (tx * tileSize + px)) * 4;
                    imgData.data[pixelIdx] = c[0];
                    imgData.data[pixelIdx+1] = c[1];
                    imgData.data[pixelIdx+2] = c[2];
                    imgData.data[pixelIdx+3] = c[3];
                }
            }
            if (bpp === 4) dataIdx += 16; // Skip the second bitplane pair we already read
        }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  useEffect(() => {
     renderTiles();
  }, [fileData, bpp, offset, width, paletteHex]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{title: string, message?: string, inputPlaceholder?: string, onSubmit?: (val: string) => void} | null>(null);

  const exportOBJ = () => {
    if (!fileData) return;
    
    // Export the current tile view as a 3D grid of quads
    let obj = "# Exported from RetroForge Graphics Studio\n";
    const tileSize = 8;
    const heightInTiles = 32;

    for (let ty = 0; ty < heightInTiles; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const x = tx * tileSize;
        const y = -ty * tileSize;
        // 4 vertices for the quad
        obj += `v ${x} ${y} 0\n`;
        obj += `v ${x + tileSize} ${y} 0\n`;
        obj += `v ${x + tileSize} ${y - tileSize} 0\n`;
        obj += `v ${x} ${y - tileSize} 0\n`;
      }
    }

    // Faces
    for (let i = 0; i < width * heightInTiles; i++) {
      const v = i * 4 + 1;
      obj += `f ${v} ${v + 1} ${v + 2} ${v + 3}\n`;
    }

    const blob = new Blob([obj], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiles_0x${offset.toString(16).toUpperCase()}.obj`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPNG = () => {
    if (!canvasRef.current || !fileData) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `vram_export_0x${offset.toString(16).toUpperCase()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const askAiToRecolor = async () => {
     setModalConfig({
       title: "Recolorir com IA",
       inputPlaceholder: "ex: 'estilo gameboy original', 'tons de azul neon'",
       onSubmit: async (val) => {
         if (!val) return;
         setModalConfig({ title: "Processando", message: `IA gerando paleta baseada em: ${val}`});
         
         try {
           const response = await fetch('/api/chat', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               messages: [{ role: 'user', parts: [{ text: `Gere UMA paleta HEX para 4 cores para este tema: ${val}. Responda APENAS as 4 cores separadas por virgula (ex: 0F380F,8BAC0F,306230,9BBC0F).` }] }],
             })
           });
           const data = await response.json();
           const newPalette = data.response?.trim() || "0F380F,8BAC0F,306230,9BBC0F";
           setPaletteHex(newPalette);
         } catch(e) {
           console.error("AI Palette error", e);
         } finally {
           setModalOpen(false);
         }
       }
     });
     setModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full gap-6 relative">
      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

      {modalOpen && modalConfig && (
        <div className="absolute inset-0 z-50 bg-surface-container/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container-highest border border-secondary/30 rounded-xl w-full max-w-md p-6 relative shadow-[0_0_50px_rgba(59,130,246,0.1)]">
            <h2 className="text-headline-small font-bold text-on-surface mb-6 uppercase tracking-widest">{modalConfig.title}</h2>
            {modalConfig.inputPlaceholder !== undefined ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const val = formData.get('inputVal') as string;
                setModalOpen(false);
                if (modalConfig.onSubmit) modalConfig.onSubmit(val);
              }}>
                <div className="flex flex-col gap-1.5 mb-6">
                  <label className="text-label-small uppercase text-on-surface-variant opacity-60 font-bold">Descreva a nova paleta</label>
                  <input 
                    autoFocus
                    name="inputVal"
                    placeholder={modalConfig.inputPlaceholder}
                    className="bg-surface-variant/50 border border-outline rounded-lg px-3 py-2 text-body-medium text-primary outline-none focus:border-primary transition-colors" 
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-outline rounded-lg text-label-medium font-bold text-on-surface-variant opacity-80 hover:bg-surface-container transition-all">CANCELAR</button>
                  <button type="submit" className="px-5 py-2 bg-secondary hover:bg-secondary/90 text-on-surface text-label-medium font-bold rounded-lg hover:bg-blue-400 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]">GERAR</button>
                </div>
              </form>
            ) : (
              <div>
                <p className="text-on-surface-variant text-body-medium mb-6">{modalConfig.message}</p>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 bg-secondary hover:bg-secondary/90 text-on-surface text-label-medium font-bold rounded-lg hover:bg-blue-400 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]">OK</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center bg-surface-container p-6 rounded-2xl border border-outline-variant shrink-0">
        <div className="flex gap-4 items-center">
          <div className="p-3 bg-secondary hover:bg-secondary/90/20 text-secondary rounded-xl">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-on-surface font-bold text-headline-small">Texture & Sprite Studio</h2>
            <p className="text-on-surface-variant opacity-60 text-body-medium">Visualização de VRAM, Tilemaps e extração de Gráficos Raw.</p>
          </div>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="px-4 py-2 bg-surface-container border border-outline rounded-xl text-on-surface-variant font-bold flex items-center gap-2 hover:bg-surface-container-high transition-all"
           >
             <Upload className="w-4 h-4" /> LOAD BINARY
           </button>
           <button 
             onClick={askAiToRecolor}
             className="px-4 py-2 bg-secondary hover:bg-secondary/90/10 border border-secondary/30 text-secondary font-bold rounded-xl flex items-center gap-2 hover:bg-secondary hover:bg-secondary/90 hover:text-on-surface transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)]"
           >
             <Sparkles className="w-4 h-4" /> AI PALETTE
           </button>
           <button 
             onClick={async () => {
               setModalConfig({ title: "Processando...", message: "Analisando rotinas de renderização associadas a este offset de VRAM..." });
               setModalOpen(true);
               
               let aiMessage = "Não foi possível gerar a sugestão. Verifique sua conexão.";
               
               try {
                 const response = await fetch('/api/chat', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                     messages: [{ role: 'user', parts: [{ text: `Descreva resumidamente um hook de VRAM ideal em assembly MIPS para interceptar a renderização no offset 0x${offset.toString(16).toUpperCase()}` }] }],
                   })
                 });
                 const data = await response.json();
                 aiMessage = data.response?.trim() || aiMessage;
               } catch(e) {
                 console.error("AI Hook error", e);
               } 
               
               setModalConfig({ 
                 title: "Hook Sugestivo (Renderização)", 
                 message: aiMessage 
               });
             }}
             className="px-4 py-2 bg-tertiary/10 border border-tertiary/30 text-tertiary font-bold rounded-xl flex items-center gap-2 hover:bg-tertiary hover:text-on-surface transition-all shadow-[0_0_15px_rgba(168,85,247,0.15)]"
           >
             <Zap className="w-4 h-4" /> AI HOOK SUGGESTION
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-surface-container border border-outline-variant rounded-2xl p-6 space-y-6">
                <h3 className="text-on-surface font-bold text-body-medium tracking-widest uppercase flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-on-surface-variant opacity-80" /> Decode Settings
                </h3>
                
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-label-small text-on-surface-variant opacity-60 font-bold uppercase">Formato / BPP (Bits Per Pixel)</label>
                        <select className="w-full bg-surface-variant/50 border border-outline rounded-lg p-2 text-body-medium text-primary outline-none focus:border-primary" value={bpp} onChange={(e) => setBpp(Number(e.target.value))}>
                            <option value={1}>1BPP (Mono)</option>
                            <option value={2}>2BPP (GameBoy / NES planar)</option>
                            <option value={4}>4BPP (SNES / GBA planar)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-label-small text-on-surface-variant opacity-60 font-bold uppercase">Offset Hexadecimal (Start)</label>
                        <input 
                            type="text" 
                            className="w-full bg-surface-variant/50 border border-outline rounded-lg p-2 text-body-medium text-primary font-mono outline-none focus:border-primary uppercase" 
                            value={offset.toString(16).toUpperCase()}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 16);
                                if (!isNaN(val)) setOffset(val);
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-label-small text-on-surface-variant opacity-60 font-bold uppercase">Largura (em Tiles)</label>
                        <input 
                            type="number" 
                            className="w-full bg-surface-variant/50 border border-outline rounded-lg p-2 text-body-medium text-primary outline-none focus:border-primary" 
                            value={width}
                            onChange={(e) => setWidth(Number(e.target.value))}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-label-small text-on-surface-variant opacity-60 font-bold uppercase flex items-center gap-2"><Palette className="w-3 h-3" /> Paleta de Cores (Hex)</label>
                        <textarea 
                            className="w-full bg-surface-variant/50 border border-outline rounded-lg p-2 text-label-medium text-on-surface-variant opacity-80 font-mono outline-none focus:border-primary resize-none h-24" 
                            value={paletteHex}
                            onChange={(e) => setPaletteHex(e.target.value)}
                        />
                    </div>
                </div>
            </div>
            
            <div className="bg-surface-container border border-outline-variant rounded-2xl p-6">
                 <h3 className="text-on-surface font-bold text-body-medium tracking-widest uppercase mb-4">Export Tools</h3>
                 <div className="grid grid-cols-1 gap-2">
                   <button 
                     onClick={exportPNG}
                     className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface-container border border-outline text-on-surface-variant font-bold rounded-lg hover:bg-surface-container-high transition-all text-body-medium disabled:opacity-50" 
                     disabled={!fileData}
                   >
                       <Download className="w-4 h-4 text-primary" /> Export PNG
                   </button>
                   <button 
                     onClick={exportOBJ}
                     className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-surface-container border border-outline text-on-surface-variant font-bold rounded-lg hover:bg-surface-container-high transition-all text-body-medium disabled:opacity-50" 
                     disabled={!fileData}
                   >
                       <Box className="w-4 h-4 text-fuchsia-400" /> Export OBJ (Mesh)
                   </button>
                 </div>
            </div>
        </div>

        <div className="lg:col-span-3 bg-surface-container border border-outline-variant rounded-2xl flex flex-col min-h-0 overflow-hidden relative">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button onClick={() => setShowGrid(!showGrid)} className={`p-2 bg-surface-container-high backdrop-blur border border-outline rounded-lg transition-colors ${showGrid ? 'text-on-surface bg-surface-container-highest' : 'text-on-surface-variant opacity-80 hover:text-on-surface hover:bg-surface-container-high'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                </button>
                <button onClick={() => setZoom(z => Math.max(1, z - 1))} className="p-2 bg-surface-container-high backdrop-blur border border-outline rounded-lg text-on-surface-variant opacity-80 hover:text-on-surface hover:bg-surface-container-high transition-colors">
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button onClick={() => setZoom(z => Math.min(8, z + 1))} className="p-2 bg-surface-container-high backdrop-blur border border-outline rounded-lg text-on-surface-variant opacity-80 hover:text-on-surface hover:bg-surface-container-high transition-colors">
                    <ZoomIn className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 bg-surface-container-lowest overflow-auto custom-scrollbar flex items-center justify-center relative p-8">
                {fileData ? (
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out', position: 'relative' }}>
                        <canvas ref={canvasRef} className="image-rendering-pixelated shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-outline-variant" />
                        {showGrid && (
                            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
                        )}
                    </div>
                ) : (
                    <div className="text-outline flex flex-col items-center gap-4">
                        <ImageIcon className="w-12 h-12 opacity-50" />
                        <p>Nenhuma ROM carregada. Carregue para visualizar gráficos.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
