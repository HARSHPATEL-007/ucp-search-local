/**
 * Unified Search Orchestrator
 * Coordinates local and remote search streams
 */

import { SearchQuery, SearchResult, SearchSession, SearchContext } from './types';
import { ContextScoringEngine, QueryParser } from './context-engine';

export interface SearchBackend {
  name: string;
  search(query: SearchQuery, signal?: AbortSignal): Promise<SearchResult[]>;
  supportsStreaming: boolean;
  priority: number;
}

export class SearchOrchestrator {
  private backends: SearchBackend[] = [];
  private parser = new QueryParser();
  private scorer = new ContextScoringEngine();
  private activeSessions = new Map<string, SearchSession>();

  registerBackend(backend: SearchBackend) {
    this.backends.push(backend);
    this.backends.sort((a, b) => a.priority - b.priority);
  }

  async executeSearch(
    rawInput: string,
    context: SearchContext,
    options: {
      maxResults?: number;
      timeoutMs?: number;
      requireLocalFirst?: boolean;
    } = {}
  ): Promise<SearchSession> {
    const sessionId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const parsed = this.parser.parse(rawInput);

    // Apply context scope override if no explicit scope flags
    if (!parsed.scopeOverride && context.activeServiceDomain) {
      parsed.scopeOverride = context.activeServiceDomain;
    }

    const query: SearchQuery = {
      rawInput,
      parsed,
      context,
      timestamp: Date.now(),
      sessionId
    };

    const session: SearchSession = {
      sessionId,
      context,
      history: [query],
      results: [],
      activeResultIndex: 0,
      state: 'indexing'
    };

    this.activeSessions.set(sessionId, session);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 5000);

      // Phase 1: Local backends (trie, SQLite FTS5)
      const localBackends = this.backends.filter(b => 
        b.name.startsWith('local_') || b.name.startsWith('device_')
      );

      const localResults = await Promise.all(
        localBackends.map(b => b.search(query, controller.signal))
      );

      // Phase 2: Remote backends (elastic, vector)
      const remoteBackends = this.backends.filter(b => 
        b.name.startsWith('remote_') || b.name.startsWith('server_')
      );

      const remotePromises = remoteBackends.map(b => 
        b.search(query, controller.signal).catch(err => {
          console.warn(`Backend ${b.name} failed:`, err);
          return [];
        })
      );

      // If requireLocalFirst, wait for local before remote
      if (options.requireLocalFirst) {
        const flatLocal = localResults.flat();
        if (flatLocal.length > 0) {
          session.results = this.scorer.scoreResults(flatLocal, context);
          session.state = 'streaming';
        }
      }

      const remoteResults = await Promise.all(remotePromises);
      clearTimeout(timeoutId);

      // Merge, deduplicate, and score
      const allResults = [...localResults.flat(), ...remoteResults.flat()];
      const deduped = this.deduplicateResults(allResults);
      session.results = this.scorer.scoreResults(deduped, context);
      session.state = 'complete';

    } catch (error) {
      session.state = 'error';
      console.error('Search orchestration failed:', error);
    }

    return session;
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  getSession(sessionId: string): SearchSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  destroySession(sessionId: string) {
    this.activeSessions.delete(sessionId);
  }
}
