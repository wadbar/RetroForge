self.onmessage = async function(e) {
  const { query, data, isRegex } = e.data;
  try {
    const MAX_RESULTS = 50;
    const results: number[] = [];
    const CHUNK_SIZE = 1024 * 64; // 64KB chunks

    if (isRegex) {
      if (!query) {
        self.postMessage({ type: 'SUCCESS', results: [] });
        return;
      }
      
      const regex = new RegExp(query, 'g');
      const OVERLAP = 1024; // 1KB overlap
      
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE + OVERLAP, data.length);
        let chunkHex = '';
        for (let i = offset; i < end; i++) {
          chunkHex += data[i].toString(16).padStart(2, '0');
        }
        
        let match;
        while ((match = regex.exec(chunkHex)) !== null) {
          if (match.index % 2 === 0) {
            const absIndex = offset + (match.index / 2);
            if (!results.includes(absIndex)) {
              results.push(absIndex);
            }
            if (results.length >= MAX_RESULTS) break;
          }
        }
        
        const progress = Math.min(100, Math.round(((offset + CHUNK_SIZE) / data.length) * 100));
        self.postMessage({ type: 'PROGRESS', progress });
        
        if (results.length >= MAX_RESULTS) break;
        // Yield to event loop to avoid blocking worker thread
        await new Promise(r => setTimeout(r, 0));
      }
      
      self.postMessage({ type: 'SUCCESS', results });
      return;
    }

    const cleanQuery = query.replace(/\s+/g, '').toUpperCase();
    const bytesToMatch: number[] = [];
    for (let i = 0; i < cleanQuery.length; i += 2) {
      const byteStr = cleanQuery.substring(i, i + 2);
      if (byteStr === '??') bytesToMatch.push(-1); 
      else bytesToMatch.push(parseInt(byteStr, 16));
    }
    
    if (bytesToMatch.length === 0) {
      self.postMessage({ type: 'SUCCESS', results: [] });
      return;
    }

    for (let offset = 0; offset <= data.length - bytesToMatch.length; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, data.length - bytesToMatch.length + 1);
      
      for (let i = offset; i < end; i++) {
        let match = true;
        for (let j = 0; j < bytesToMatch.length; j++) {
           if (bytesToMatch[j] !== -1 && data[i+j] !== bytesToMatch[j]) {
              match = false;
              break;
           }
        }
        if (match) {
           results.push(i);
           if (results.length >= MAX_RESULTS) break; 
        }
      }
      
      const progress = Math.min(100, Math.round(((offset + CHUNK_SIZE) / data.length) * 100));
      self.postMessage({ type: 'PROGRESS', progress });

      if (results.length >= MAX_RESULTS) break;
      // Yield to event loop to avoid blocking worker thread
      await new Promise(r => setTimeout(r, 0));
    }
    
    self.postMessage({ type: 'SUCCESS', results });
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', message: err.message });
  }
};
