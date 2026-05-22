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
      
      <div className="flex justify-between items-center bg-surface-container-high p-6 rounded-3xl border border-outline-variant shadow-elevation-1 shrink-0">
        <div className="flex gap-4 items-center">
          <div className="p-4 bg-tertiary-container text-on-tertiary-container rounded-2xl shadow-sm">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-display-small text-on-surface mb-1">Audio & SoundFont Studio</h2>
            <p className="text-body-large text-on-surface-variant">Visualização de Amostras de Áudio, Seq, e Sintetizador Dinâmico.</p>
          </div>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="px-6 py-3 bg-surface-container border border-outline-variant rounded-full text-on-surface font-medium flex items-center gap-2 hover:bg-surface-variant transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
           >
             <Upload className="w-5 h-5" /> LOAD BINARY
           </button>
           <button 
             onClick={runAiExtraction}
             disabled={isAiLoading || !fileData}
             className="px-6 py-3 bg-tertiary hover:bg-tertiary/90 text-on-tertiary font-bold rounded-full flex items-center gap-2 transition-all shadow-elevation-1 focus:outline-none focus:ring-2 focus:ring-tertiary focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
           >
             {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Wand2 className="w-5 h-5" />} AI EXTRACT SAMPLES
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1 border border-outline-variant rounded-3xl bg-surface-container-low p-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-6">
                <h3 className="text-title-medium font-medium text-on-surface tracking-widest uppercase flex items-center gap-2">
                    <Activity className="w-5 h-5 text-on-surface-variant" /> Playback
                </h3>
                
                <div className="flex flex-col gap-3">
                    <button 
                       onClick={isPlaying ? stopAudio : playRawAudio}
                       disabled={!fileData}
                       className={`flex-1 flex justify-center items-center gap-2 px-4 py-4 rounded-xl font-bold transition-all shadow-elevation-1 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${isPlaying ? 'bg-error-container text-on-error-container border border-error/50' : 'bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50'}`}
                    >
                       {isPlaying ? <><Square className="w-5 h-5 fill-current"/> STOP</> : <><Play className="w-5 h-5 fill-current"/> PLAY RAW</>}
                    </button>
                    <button 
                       onClick={exportWAV}
                       disabled={!fileData}
                       className={`w-full flex justify-center px-4 py-4 rounded-xl font-medium border border-outline text-on-surface hover:bg-surface-variant transition-all disabled:opacity-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary`}
                       title="Exportar WAV"
                    >
                       <Download className="w-5 h-5 mr-2"/> EXPORT WAV
                    </button>
                </div>

                <div className="space-y-3 pt-6 border-t border-outline-variant">
                    <h4 className="text-label-medium font-bold text-on-surface-variant uppercase">Amostras Sugeridas pela IA</h4>
                    {fileData ? (
                        <div className="space-y-2">
                           {aiAnalysis.length > 0 ? (
                               aiAnalysis.map((line, idx) => (
                                 <div key={idx} className="flex justify-between items-center text-label-large p-3 bg-surface-container-high rounded-lg hover:bg-surface-variant cursor-pointer transition-colors border border-outline-variant">
                                    <span className="text-tertiary font-mono">{line}</span>
                                    <Sparkles className="w-4 h-4 text-tertiary"/>
                                 </div>
                               ))
                           ) : (
                               <p className="text-body-medium text-on-surface-variant">Clique em AI Extract para mapear arquivos de áudio.</p>
                           )}
                        </div>
                    ) : (
                        <p className="text-body-medium text-on-surface-variant opacity-70">Nenhum banco de áudio carregado.</p>
                    )}
                </div>
            </div>
        </div>

        <div className="lg:col-span-3 bg-surface-container border border-outline-variant rounded-3xl flex flex-col p-8 gap-8 shadow-elevation-1">
            <h3 className="text-title-large text-on-surface font-medium flex items-center gap-3"><Volume2 className="w-6 h-6 text-tertiary"/> Analisador de Espectro (Raw PCM)</h3>
            
            <div className="flex-1 flex items-end gap-1 bg-surface-container-highest border border-outline-variant p-6 rounded-2xl shadow-inner">
               {analyzerData.map((val, i) => (
                   <div 
                      key={i} 
                      className="flex-1 bg-tertiary rounded-t-sm transition-all duration-75"
                      style={{ height: `${val ? (val / 255) * 100 : 2}%`, opacity: val ? (val / 255) : 0.2 }}
                   />
               ))}
            </div>

            <div className="h-32 bg-surface-container-highest border border-outline-variant p-4 rounded-2xl flex items-center justify-center overflow-hidden relative shadow-inner">
               <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(90deg, transparent 50%, var(--color-on-surface) 50%)', backgroundSize: '20px 100%' }}></div>
               <p className="text-on-surface-variant font-mono text-label-large z-10 flex items-center gap-3">
                   <Activity className="w-5 h-5"/> 
                   {fileData ? "Track 1: PCM Audio Data Loaded" : "Track 1: No Data"}
               </p>
            </div>
        </div>
      </div>
      {toastMsg && (
        <div className="fixed bottom-8 right-8 p-6 rounded-2xl shadow-elevation-3 flex items-center gap-4 z-50 bg-tertiary-container text-on-tertiary-container border border-tertiary/20 animate-in fade-in slide-in-from-bottom-5">
           <Wand2 className="w-6 h-6 text-tertiary" />
           <p className="text-title-small font-medium">{toastMsg}</p>
        </div>
      )}
    </div>
  );
}
