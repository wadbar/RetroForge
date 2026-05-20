import React, { useState, useRef, useEffect } from 'react';
import { Music, Upload, Play, Square, Volume2, Sparkles, Wand2, Activity, Download, Loader2 } from 'lucide-react';

export default function AudioStudio() {
  const [fileData, setFileData] = useState<Uint8Array | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [analyzerData, setAnalyzerData] = useState<number[]>(new Array(32).fill(0));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const exportWAV = () => {
    if (!fileData) return;
    const limitIndex = Math.min(fileData.length, 1024 * 1024 * 2); 
    const sampleRate = 22050;
    const numChannels = 1;
    const blockAlign = numChannels * 2;
    const byteRate = sampleRate * blockAlign;
    const dataSize = limitIndex * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    
    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    
    // DATA sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data (16-bit PCM)
    let offset = 44;
    for (let i = 0; i < limitIndex; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, (fileData[i] - 128) / 128.0));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'exported_sample.wav';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    showToast("Amostra WAV exportada!");
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setFileData(new Uint8Array(buffer));
    setAiAnalysis([]); // Reset analysis when new file is loaded
  };

  const playRawAudio = async () => {
    if (!fileData) return;
    try {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        setIsPlaying(true);

        const limitIndex = Math.min(fileData.length, 1024 * 1024 * 2); 
        const pcmData = new Float32Array(limitIndex);
        for (let i = 0; i < limitIndex; i++) {
           pcmData[i] = (fileData[i] - 128) / 128.0;
        }

        const buffer = audioCtxRef.current.createBuffer(1, limitIndex, 22050); 
        buffer.copyToChannel(pcmData, 0);

        sourceRef.current = audioCtxRef.current.createBufferSource();
        sourceRef.current.buffer = buffer;
        
        analyzerRef.current = audioCtxRef.current.createAnalyser();
        analyzerRef.current.fftSize = 64;
        
        sourceRef.current.connect(analyzerRef.current);
        analyzerRef.current.connect(audioCtxRef.current.destination);

        sourceRef.current.start(0);
        
        sourceRef.current.onended = () => setIsPlaying(false);
        updateAnalyzer();

    } catch(err) {
        console.error(err);
        setIsPlaying(false);
    }
  };

  const stopAudio = () => {
     if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
     }
     setIsPlaying(false);
  };

  const updateAnalyzer = () => {
     if (!isPlaying || !analyzerRef.current) return;
     const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
     analyzerRef.current.getByteFrequencyData(dataArray);
     setAnalyzerData(Array.from(dataArray));
     requestAnimationFrame(updateAnalyzer);
  };

  useEffect(() => {
     if (isPlaying) updateAnalyzer();
  }, [isPlaying]);

  const runAiExtraction = async () => {
    if (!fileData) {
      showToast("Carregue um arquivo binário primeiro.");
      return;
    }
    setIsAiLoading(true);
    showToast("Analisando padrões de áudio do binário...");
    try {
      const sampleHex = Array.from(fileData.slice(0, 1024)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', parts: [{ text: `Analise a seguinte assinatura hexadecimal parcial e sugira 2-3 possíveis localizações de áudio (offsets mágicos para arquivos .seq, .pcm, .brr) compatíveis com estruturas de áudio retro. Liste apenas os endereços fictícios curtos em formato hexa e nome do arquivo (ex: 0x01A300 - SFX.brr). Hex: ${sampleHex}` }] }],
          temperature: 0.1
        })
      });
      const data = await response.json();
      const rawText = data.response || "";
      const lines = rawText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.startsWith('0x'));
      setAiAnalysis(lines.length > 0 ? lines : ['Nenhuma assinatura conhecida encontrada.']);
    } catch(err) {
      console.error(err);
      setAiAnalysis(['Erro na análise do motor de IA.']);    
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full gap-6">
      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      
      <div className="flex justify-between items-center bg-[#141414] p-6 rounded-2xl border border-white/5 shrink-0">
        <div className="flex gap-4 items-center">
          <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-white font-bold text-xl">Audio & SoundFont Studio</h2>
            <p className="text-gray-500 text-sm">Visualização de Amostras de Áudio, Seq, e Sintetizador Dinâmico.</p>
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
             onClick={runAiExtraction}
             disabled={isAiLoading || !fileData}
             className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold rounded-xl flex items-center gap-2 hover:bg-rose-500 hover:text-white transition-all shadow-[0_0_15px_rgba(244,63,94,0.15)] disabled:opacity-50"
           >
             {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />} AI EXTRACT SAMPLES
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
            <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
                <h3 className="text-white font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                    <Activity className="w-4 h-4 text-gray-400" /> Playback
                </h3>
                
                <div className="flex gap-2">
                    <button 
                       onClick={isPlaying ? stopAudio : playRawAudio}
                       disabled={!fileData}
                       className={`flex-1 flex justify-center items-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${isPlaying ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:bg-gray-600'}`}
                    >
                       {isPlaying ? <><Square className="w-4 h-4 fill-current"/> STOP</> : <><Play className="w-4 h-4 fill-current"/> PLAY RAW</>}
                    </button>
                    <button 
                       onClick={exportWAV}
                       disabled={!fileData}
                       className={`px-4 py-3 rounded-lg font-bold border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50`}
                       title="Exportar WAV"
                    >
                       <Download className="w-4 h-4"/>
                    </button>
                </div>

                <div className="space-y-2 pt-4 border-t border-white/10">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">Amostras Sugeridas pela IA</h4>
                    {fileData ? (
                        <div className="space-y-2">
                           {aiAnalysis.length > 0 ? (
                               aiAnalysis.map((line, idx) => (
                                 <div key={idx} className="flex justify-between items-center text-xs p-2 bg-white/5 rounded hover:bg-white/10 cursor-pointer">
                                    <span className="text-rose-400 font-mono">{line}</span>
                                    <Sparkles className="w-3 h-3 text-rose-500"/>
                                 </div>
                               ))
                           ) : (
                               <p className="text-xs text-gray-500">Clique em AI Extract para mapear arquivos de áudio.</p>
                           )}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-600">Nenhum banco de áudio carregado.</p>
                    )}
                </div>
            </div>
        </div>

        <div className="lg:col-span-3 bg-[#141414] border border-white/5 rounded-2xl flex flex-col p-8 gap-8">
            <h3 className="text-white font-bold flex items-center gap-2"><Volume2 className="w-5 h-5 text-rose-400"/> Analisador de Espectro (Raw PCM)</h3>
            
            <div className="flex-1 flex items-end gap-1 bg-black/50 border border-white/5 p-4 rounded-xl">
               {analyzerData.map((val, i) => (
                   <div 
                      key={i} 
                      className="flex-1 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-sm transition-all duration-75"
                      style={{ height: `${val ? (val / 255) * 100 : 2}%` }}
                   />
               ))}
            </div>

            <div className="h-32 bg-black/50 border border-white/5 p-4 rounded-xl flex items-center justify-center overflow-hidden relative">
               <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(90deg, transparent 50%, rgba(255,255,255,.05) 50%)', backgroundSize: '20px 100%' }}></div>
               <p className="text-gray-500 font-mono text-xs z-10 flex items-center gap-2">
                   <Activity className="w-4 h-4"/> 
                   {fileData ? "Track 1: PCM Audio Data Loaded" : "Track 1: No Data"}
               </p>
            </div>
        </div>
      </div>
      {toastMsg && (
        <div className="fixed bottom-6 right-6 p-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 bg-rose-500/20 text-rose-100 border border-rose-500/50 animate-in fade-in slide-in-from-bottom-5">
           <Wand2 className="w-5 h-5 text-rose-400" />
           <p className="text-sm font-medium">{toastMsg}</p>
        </div>
      )}
    </div>
  );
}

