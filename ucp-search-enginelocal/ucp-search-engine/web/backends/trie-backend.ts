/**
 * Local Trie Search Backend (Web/Desktop)
 * WebAssembly-powered prefix matching for tabs/history
 */

import { SearchBackend, SearchQuery, SearchResult } from '../../shared/types';

interface TrieBackendConfig {
  priority: number;
  wasmModulePath?: string;
}

export class TrieSearchBackend implements SearchBackend {
  name = 'local_trie';
  supportsStreaming = false;
  priority: number;

  private wasmModule: any = null;
  private trieWorker: Worker | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: TrieBackendConfig) {
    this.priority = config.priority;
    this.initPromise = this.initialize(config.wasmModulePath);
  }

  private async initialize(wasmPath?: string): Promise<void> {
    if (typeof window !== 'undefined' && 'WebAssembly' in window) {
      try {
        const wasmUrl = wasmPath || '/wasm/trie_search.wasm';
        const response = await fetch(wasmUrl);
        const wasmBinary = await response.arrayBuffer();

        this.trieWorker = new Worker('/workers/trie-worker.js');
        this.trieWorker.postMessage({
          type: 'INIT',
          wasmBinary
        }, [wasmBinary]);

        await new Promise<void>((resolve, reject) => {
          this.trieWorker!.onmessage = (e) => {
            if (e.data.type === 'INIT_COMPLETE') resolve();
            if (e.data.type === 'INIT_ERROR') reject(e.data.error);
          };
        });

      } catch (err) {
        console.warn('WASM trie initialization failed, falling back to JS:', err);
        this.trieWorker = new Worker('/workers/trie-worker.js');
        this.trieWorker.postMessage({ type: 'INIT_FALLBACK' });
      }
    }
  }

  async search(query: SearchQuery, signal?: AbortSignal): Promise<SearchResult[]> {
    await this.initPromise;
    if (!this.trieWorker) return [];

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Trie search timeout')), 2000);

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'SEARCH_RESULTS') {
          clearTimeout(timeoutId);
          this.trieWorker!.removeEventListener('message', handler);
          resolve(e.data.results as SearchResult[]);
        }
        if (e.data.type === 'SEARCH_ERROR') {
          clearTimeout(timeoutId);
          this.trieWorker!.removeEventListener('message', handler);
          reject(new Error(e.data.error));
        }
      };

      this.trieWorker.addEventListener('message', handler);
      this.trieWorker.postMessage({
        type: 'SEARCH',
        query: query.parsed.textTokens.join(' '),
        prefix: query.parsed.textTokens[0] || '',
        context: query.context,
        signal
      });

      signal?.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        this.trieWorker!.removeEventListener('message', handler);
        reject(new Error('Aborted'));
      });
    });
  }
}
