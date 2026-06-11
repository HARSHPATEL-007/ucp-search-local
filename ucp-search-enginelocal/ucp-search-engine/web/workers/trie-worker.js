/**
 * Web Worker for Trie Search
 * Handles WASM module or JS fallback for prefix matching
 */

let trie = null;
let wasmModule = null;
let useWasm = false;

// Simple JS Trie fallback
class JSTrie {
  constructor() {
    this.root = {};
    this.documents = new Map();
  }

  insert(key, docId, metadata) {
    let node = this.root;
    for (const char of key.toLowerCase()) {
      if (!node[char]) node[char] = {};
      node = node[char];
    }
    if (!node._docs) node._docs = [];
    node._docs.push({ docId, metadata });
    this.documents.set(docId, metadata);
  }

  search(prefix, maxResults = 20) {
    let node = this.root;
    for (const char of prefix.toLowerCase()) {
      if (!node[char]) return [];
      node = node[char];
    }
    return this._collect(node, maxResults);
  }

  _collect(node, maxResults) {
    const results = [];
    const stack = [node];

    while (stack.length > 0 && results.length < maxResults) {
      const current = stack.pop();
      if (current._docs) {
        results.push(...current._docs);
      }
      for (const key of Object.keys(current)) {
        if (key !== '_docs') stack.push(current[key]);
      }
    }
    return results;
  }
}

self.onmessage = async (e) => {
  const { type } = e.data;

  if (type === 'INIT') {
    try {
      // Attempt WASM initialization
      const { wasmBinary } = e.data;
      const wasmModule = await WebAssembly.compile(wasmBinary);
      const instance = await WebAssembly.instantiate(wasmModule, {
        env: {
          memory: new WebAssembly.Memory({ initial: 256, maximum: 512 }),
          abort: () => console.error('WASM abort')
        }
      });
      wasmModule = instance;
      useWasm = true;
      self.postMessage({ type: 'INIT_COMPLETE' });
    } catch (err) {
      self.postMessage({ type: 'INIT_ERROR', error: err.message });
    }
  }

  if (type === 'INIT_FALLBACK') {
    trie = new JSTrie();
    // Seed with sample financial service entries
    const sampleData = [
      { key: 'PCAOB AS 2201', id: 'audit_1', type: 'workflow' },
      { key: 'Financial Spreading', id: 'audit_2', type: 'workflow' },
      { key: 'Lending Facility', id: 'lending_1', type: 'entity' },
      { key: 'Trade Finance LC', id: 'trade_1', type: 'transaction' },
      { key: 'DCM Bookbuilding', id: 'dcm_1', type: 'workflow' },
      { key: 'NAV Calculation', id: 'hf_1', type: 'workflow' },
      { key: 'Tax Provision', id: 'tax_1', type: 'workflow' },
      { key: 'Securities Lending', id: 'sl_1', type: 'workflow' },
    ];
    sampleData.forEach(d => trie.insert(d.key, d.id, d));
    self.postMessage({ type: 'INIT_COMPLETE' });
  }

  if (type === 'SEARCH') {
    const { query, prefix, context } = e.data;

    if (!trie && !useWasm) {
      self.postMessage({ type: 'SEARCH_ERROR', error: 'Trie not initialized' });
      return;
    }

    try {
      let results;
      if (useWasm && wasmModule) {
        // WASM search would go here
        results = [];
      } else {
        const trieResults = trie.search(prefix || query, 20);
        results = trieResults.map(r => ({
          id: r.docId,
          type: r.metadata.type || 'entity',
          title: r.metadata.key || r.docId,
          metadata: {
            badges: [r.metadata.type],
            lastModified: Date.now()
          },
          actionability: {
            primaryAction: { id: 'open', label: 'Open', type: 'open', requiresConfirmation: false },
            secondaryActions: [
              { id: 'pin', label: 'Pin', type: 'pin', requiresConfirmation: false }
            ],
            previewAvailable: true,
            keyboardShortcuts: { 'Enter': 'open', 'Cmd+Enter': 'split' }
          },
          source: 'local_trie',
          score: 1.0,
          contextRelevance: 0.8
        }));
      }

      self.postMessage({ type: 'SEARCH_RESULTS', results });
    } catch (err) {
      self.postMessage({ type: 'SEARCH_ERROR', error: err.message });
    }
  }
};
