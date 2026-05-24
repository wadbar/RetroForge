self.onmessage = function(e) {
  const { query, data, isRegex } = e.data;
  try {
    if (isRegex) {
      if (!query) {
        self.postMessage({ type: 'SUCCESS', results: [] });
        return;
      }
      
      const MAX_RESULTS = 50;
      const results = [];
      const regex = new RegExp(query, 'g');
      
      // We need to convert data to a searchable string representation
      // But we shouldn't convert the whole Uint8Array to string at once to avoid OOM
      // Instead we could create a hex string of the data
      // For performance in worker, we can do a lazy or chunked approach
      // Actually, regex on binary data is tricky. Let's do a hex string regex
      // A small file hex string (e.g. 1MB = 2MB string) is okay.
      
      let hexStr = '';
      for (let i = 0; i < data.length; i++) {
        hexStr += data[i].toString(16).padStart(2, '0');
      }
      
      let match;
      while ((match = regex.exec(hexStr)) !== null) {
        // Hex string index relates to byte index: index / 2
        // Ensure match is on byte boundary
        if (match.index % 2 === 0) {
          results.push(match.index / 2);
          if (results.length >= MAX_RESULTS) break;
        } else {
          // If match starts off byte boundary, technically it's a shifted match.
          // Depending on needs, we might ignore or not.
          // Adjust regex lastIndex to prevent infinite loops if we reset
        }
      }
      self.postMessage({ type: 'SUCCESS', results });
      return;
    }

    const cleanQuery = query.replace(/\s+/g, '').toUpperCase();
    const bytesToMatch = [];
    for (let i = 0; i < cleanQuery.length; i += 2) {
      const byteStr = cleanQuery.substring(i, i + 2);
      if (byteStr === '??') bytesToMatch.push(-1); 
      else bytesToMatch.push(parseInt(byteStr, 16));
    }
    
    if (bytesToMatch.length === 0) {
      self.postMessage({ type: 'SUCCESS', results: [] });
      return;
    }

    const results = [];
    // Max cap the results array to prevent OOM
    const MAX_RESULTS = 50;
    
    for (let i = 0; i <= data.length - bytesToMatch.length; i++) {
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
    self.postMessage({ type: 'SUCCESS', results });
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', message: err.message });
  }
};
