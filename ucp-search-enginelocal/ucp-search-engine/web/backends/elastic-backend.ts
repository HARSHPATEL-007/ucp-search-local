/**
 * Server-Side Elastic Search Backend (Web/Desktop)
 * Remote API streaming for transactional entity data
 */

import { SearchBackend, SearchQuery, SearchResult } from '../../shared/types';

interface ElasticConfig {
  endpoint: string;
  priority: number;
  apiKey?: string;
}

export class ElasticSearchBackend implements SearchBackend {
  name = 'remote_elastic';
  supportsStreaming = true;
  priority: number;
  private endpoint: string;
  private apiKey?: string;

  constructor(config: ElasticConfig) {
    this.endpoint = config.endpoint;
    this.priority = config.priority;
    this.apiKey = config.apiKey;
  }

  async search(query: SearchQuery, signal?: AbortSignal): Promise<SearchResult[]> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        query: query.rawInput,
        parsed: query.parsed,
        context: {
          userId: query.context.userId,
          orgId: query.context.orgId,
          activeWorkflowId: query.context.activeWorkflowId,
          activeServiceDomain: query.context.activeServiceDomain,
          recentWorkflowIds: query.context.recentWorkflowIds
        },
        sessionId: query.sessionId
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Elastic search failed: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  async *streamSearch(query: SearchQuery, signal?: AbortSignal): AsyncGenerator<SearchResult> {
    const response = await fetch(`${this.endpoint}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.rawInput, parsed: query.parsed }),
      signal
    });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().startsWith('data:')) {
          try {
            const result = JSON.parse(line.trim().slice(5));
            yield result as SearchResult;
          } catch (e) {
            // Skip malformed lines
          }
        }
      }
    }
  }
}
