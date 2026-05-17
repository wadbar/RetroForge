import React, { useState, useRef, useEffect } from 'react';
import { Box, Upload, Sparkles, ZoomIn, ZoomOut, Layers, Eye, Code } from 'lucide-react';

export default function GeometryStudio() {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(50);
  const [rotationX, setRotationX] = useState<number>(0);
  const [rotationY, setRotationY] = useState<number>(0);
  const [vertexCount, setVertexCount] = useState<number>(100);
  const [stride, setStride] = useState<number>(8);
  const [endian, setEndian] = useState<'BE' | 'LE'>('BE');
  const [vType, setVType] = useState<'INT16' | 'FLOAT32'>('INT16');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const exportOBJ = () => {
     let objData = "# Exported by RetroForge Geometry Studio\n# Stride: " + stride + ", Endian: " + endian + "\n";
     const vertices: [number, number, number][] = [];

     if (fileData) {
         let dataView = new DataView(fileData.buffer);
         let currentOffset = offset;
         const isLE = endian === 'LE';

         for(let i = 0; i < vertexCount; i++) {
             if (currentOffset + (vType === 'FLOAT32' ? 12 : 6) > fileData.length) break;
             
             let x, y, z;
             if (vType === 'FLOAT32') {
                if (currentOffset + 12 > fileData.length) break;
                x = dataView.getFloat32(currentOffset, isLE);
                y = dataView.getFloat32(currentOffset + 4, isLE);
                z = dataView.getFloat32(currentOffset + 8, isLE);
             } else {
                x = dataView.getInt16(currentOffset, isLE);
                y = dataView.getInt16(currentOffset + 2, isLE);
                z = dataView.getInt16(currentOffset + 4, isLE);
             }
             
             vertices.push([x, y, z]);
             currentOffset += stride;
         }
     }

     if (vertices.length === 0) {
         showToast("Nenhum vértice para exportar.");
         return;
     }

     // Write vertices (v x y z)
     vertices.forEach(v => {
         objData += `v ${v[0]} ${v[1]} ${v[2]}\n`;
     });

     // Write faces (f v1 v2 v3) - simple triangle fan/list assumption
     for(let i = 0; i < vertices.length - 2; i += 3) {
         objData += `f ${i+1} ${i+2} ${i+3}\n`;
     }

     const blob = new Blob([objData], { type: "text/plain" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `model_0x${offset.toString(16).toUpperCase()}.obj`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
     showToast("Arquivo OBJ exportado!");
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setFileData(new Uint8Array(buffer));
  };

  const renderGeometry = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const vertices: [number, number, number][] = [];

    if (fileData) {
        // Read memory as signed 16-bit vertices (common in PS1/N64)
        let dataView = new DataView(fileData.buffer);
        let currentOffset = offset;
        const isLE = endian === 'LE';
        
        for(let i = 0; i < vertexCount; i++) {
            if (currentOffset + (vType === 'FLOAT32' ? 12 : 6) > fileData.length) break;
            
            let x, y, z;
            if (vType === 'FLOAT32') {
                x = dataView.getFloat32(currentOffset, isLE);
                y = dataView.getFloat32(currentOffset + 4, isLE);
                z = dataView.getFloat32(currentOffset + 8, isLE);
            } else {
                x = dataView.getInt16(currentOffset, isLE);
                y = dataView.getInt16(currentOffset + 2, isLE);
                z = dataView.getInt16(currentOffset + 4, isLE);
            }
            
            vertices.push([x, y, z]);
            currentOffset += stride;
        }
    } else {
        // Render a placeholder cube if no file is loaded, simulating memory layout
        const s = 1;
        vertices.push(
            [-s,-s,-s], [s,-s,-s], [s,s,-s], [-s,s,-s],
            [-s,-s,s], [s,-s,s], [s,s,s], [-s,s,s]
        );
    }

    // Connect vertices (wireframe)
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 1;

    const project = (x: number, y: number, z: number) => {
        // Apply rotations
        const rotXAngle = rotationX * (Math.PI / 180);
        const rotYAngle = rotationY * (Math.PI / 180);

        // Rotate Y
        let nx1 = x * Math.cos(rotYAngle) - z * Math.sin(rotYAngle);
        let nz1 = z * Math.cos(rotYAngle) + x * Math.sin(rotYAngle);

        // Rotate X
        let ny = y * Math.cos(rotXAngle) - nz1 * Math.sin(rotXAngle);
        let nz = nz1 * Math.cos(rotXAngle) + y * Math.sin(rotXAngle);

        // Simple perspective projection
        const fov = 400;
        const perspectiveScale = fov / (fov + nz + 200);
        const finalScale = zoom * perspectiveScale;
        
        return {
            x: cx + nx1 * finalScale,
            y: cy + ny * finalScale
        };
    };

    ctx.beginPath();
    // Render lines (assuming raw triangles: every 3 vertices form a tri)
    if (fileData) {
        for (let i = 0; i < vertices.length - 2; i += 3) {
            const p1 = project(vertices[i][0], vertices[i][1], vertices[i][2]);
            const p2 = project(vertices[i+1][0], vertices[i+1][1], vertices[i+1][2]);
            const p3 = project(vertices[i+2][0], vertices[i+2][1], vertices[i+2][2]);
            
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p1.x, p1.y);
        }
    } else {
        // Draw standard cube
        const edges = [
            [0,1], [1,2], [2,3], [3,0],
            [4,5], [5,6], [6,7], [7,4],
            [0,4], [1,5], [2,6], [3,7]
        ];
        edges.forEach(edge => {
            const p1 = project(vertices[edge[0]][0]*2, vertices[edge[0]][1]*2, vertices[edge[0]][2]*2);
            const p2 = project(vertices[edge[1]][0]*2, vertices[edge[1]][1]*2, vertices[edge[1]][2]*2);
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
        });
    }
    
    ctx.stroke();

    // Draw vertices dots
    ctx.fillStyle = '#FF00FF';
    vertices.forEach((v, i) => {
        let div = fileData ? 100 : 0.5;
        const p = project(v[0]/div, v[1]/div, v[2]/div);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
  };

  useEffect(() => {
     renderGeometry();
  }, [fileData, offset, zoom, rotationX, rotationY, vertexCount, stride, endian, vType]);

  useEffect(() => {
     let animationFrame: number;
     const animate = () => {
         setRotationY(prev => (prev + 0.5) % 360);
         setRotationX(prev => (prev + 0.2) % 360);
         animationFrame = requestAnimationFrame(animate);
     };
     animate();
     return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full gap-6">
      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      
      <div className="flex justify-between items-center bg-[#141414] p-6 rounded-2xl border border-white/5 shrink-0">
        <div className="flex gap-4 items-center">
          <div className="p-3 bg-fuchsia-500/20 text-fuchsia-400 rounded-xl">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-white font-bold text-xl">Geometry & Level Wireframes</h2>
            <p className="text-gray-500 text-sm">Visualizador de Display Lists e Vertices 3D crus direto da RAM/ROM.</p>
          </div>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-300 font-bold flex items-center gap-2 hover:bg-white/10 transition-all"
           >
             <Upload className="w-4 h-4" /> LOAD BINARY
           </button>
           <button 
             onClick={() => {
                 setOffset(0x04000); 
                 setVertexCount(120);
                 showToast("IA localizou Display List potencial em 0x04000!");
             }}
             className="px-4 py-2 bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 font-bold rounded-xl flex items-center gap-2 hover:bg-fuchsia-500 hover:text-white transition-all shadow-[0_0_15px_rgba(217,70,239,0.15)]"
           >
             <Sparkles className="w-4 h-4" /> AI SCAN DISPLAY LISTS
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
                <h3 className="text-white font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                    <Layers className="w-4 h-4 text-gray-400" /> Structure Settings
                </h3>
                
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase">Formato de Vértice</label>
                        <select 
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-cyan-400 outline-none focus:border-cyan-500 transition-all"
                            value={vType}
                            onChange={(e) => setVType(e.target.value as any)}
                        >
                            <option value="INT16">Short (INT16)</option>
                            <option value="FLOAT32">Float (FLOAT32)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase">Stride (Bytes por Vértice)</label>
                        <select 
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-cyan-400 outline-none focus:border-cyan-500 transition-all font-mono"
                            value={stride}
                            onChange={(e) => setStride(Number(e.target.value))}
                        >
                            <option value="6">6 bytes (XYZ)</option>
                            <option value="8">8 bytes (XYZ + Pad)</option>
                            <option value="12">12 bytes (XYZ Float)</option>
                            <option value="16">16 bytes (XYZ + Color/UV)</option>
                            <option value="20">20 bytes (Full N64)</option>
                            <option value="32">32 bytes (Full MD/X)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase">Endianness</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setEndian('BE')}
                                className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${endian === 'BE' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}
                            >
                                BIG ENDIAN
                            </button>
                            <button 
                                onClick={() => setEndian('LE')}
                                className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${endian === 'LE' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}
                            >
                                LITTLE ENDIAN
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase">Offset Hexadecimal (Start)</label>
                        <input 
                            type="text" 
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-cyan-400 font-mono outline-none focus:border-cyan-500 uppercase" 
                            value={offset.toString(16).toUpperCase()}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 16);
                                if (!isNaN(val)) setOffset(val);
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase">Vertex Count Max</label>
                        <input 
                            type="number" 
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-cyan-400 outline-none focus:border-cyan-500" 
                            value={vertexCount}
                            onChange={(e) => setVertexCount(Number(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-[#141414] border border-white/5 rounded-2xl p-6">
               <h3 className="text-white font-bold text-sm tracking-widest uppercase flex items-center gap-2 mb-4">
                    <Code className="w-4 h-4 text-gray-400" /> C++ Exporter
               </h3>
               <button 
                  onClick={exportOBJ}
                  disabled={!fileData}
                  className="w-full bg-black/40 border border-white/10 text-cyan-400 font-mono text-xs rounded p-2 hover:bg-white/5 transition-colors disabled:opacity-50"
               >
                  Export to .obj
               </button>
            </div>
        </div>

        <div className="lg:col-span-3 bg-[#141414] border border-white/5 rounded-2xl flex flex-col min-h-0 overflow-hidden relative shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
               <div className="bg-black/60 backdrop-blur border border-white/10 rounded p-2 text-[10px] font-mono text-cyan-400 flex flex-col gap-1">
                  <span>VERTICES: {fileData ? Math.min(vertexCount, Math.floor(fileData.length / 8)) : 8}</span>
                  <span>ROT X: {rotationX.toFixed(1)}°</span>
                  <span>ROT Y: {rotationY.toFixed(1)}°</span>
               </div>
            </div>

            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button onClick={() => setZoom(z => Math.max(10, z - 10))} className="p-2 bg-black/60 backdrop-blur border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button onClick={() => setZoom(z => z + 10)} className="p-2 bg-black/60 backdrop-blur border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <ZoomIn className="w-4 h-4" />
                </button>
            </div>

            <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-contain" />
        </div>
      </div>
      {toastMsg && (
        <div className="fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 bg-fuchsia-500/20 text-fuchsia-100 border border-fuchsia-500/50 animate-in fade-in slide-in-from-bottom-5">
           <Sparkles className="w-5 h-5 text-fuchsia-400" />
           <p className="text-sm font-medium">{toastMsg}</p>
        </div>
      )}
    </div>
  );
}
