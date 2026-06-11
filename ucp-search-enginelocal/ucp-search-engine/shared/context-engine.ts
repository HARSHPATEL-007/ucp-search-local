/**
 * Context Scoring Engine
 * Deep contextual interpretation for search result ranking
 * Implements proximity and historical recency scoping per UCP spec
 */

import {
  SearchContext, SearchResult, ContextScopeWeights, 
  DEFAULT_SCOPE_WEIGHTS, ServiceDomain
} from './types';

export class ContextScoringEngine {
  private weights: ContextScopeWeights;

  constructor(weights: ContextScopeWeights = DEFAULT_SCOPE_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Apply context-aware boosting to search results
   * If auditor is in Audit & Assurance / PCAOB AS 2201 tab,
   * results from that client entity get boosted
   */
  scoreResults(
    results: SearchResult[],
    context: SearchContext
  ): SearchResult[] {
    return results.map(r => {
      let boost = 1.0;

      // Active workflow match (highest priority)
      if (context.activeWorkflowId && r.metadata.workflowId === context.activeWorkflowId) {
        boost *= this.weights.activeWorkflowBoost;
      }

      // Recent workflow proximity
      if (context.recentWorkflowIds.includes(r.metadata.workflowId || '')) {
        boost *= this.weights.recentWorkflowBoost;
      }

      // Service domain alignment
      if (context.activeServiceDomain && this.domainMatches(r, context.activeServiceDomain)) {
        boost *= this.weights.serviceDomainBoost;
      }

      // Geofenced proximity (mobile)
      if (context.geofencedRegion && r.metadata.regionCode === context.geofencedRegion.regionCode) {
        boost *= this.weights.geofencedBoost;
      }

      // Global results penalty (encourage contextual focus)
      if (!r.metadata.workflowId && !r.metadata.regionCode) {
        boost *= this.weights.globalPenalty;
      }

      return {
        ...r,
        score: r.score * boost,
        contextRelevance: Math.min(1.0, (boost - 0.6) / 1.4)
      };
    }).sort((a, b) => b.score - a.score);
  }

  private domainMatches(result: SearchResult, domain: ServiceDomain): boolean {
    const domainTags = result.metadata.badges || [];
    return domainTags.includes(domain) || domainTags.includes(domain.replace('_', '-'));
  }

  /**
   * Generate default scope filter based on active context
   */
  generateDefaultScope(context: SearchContext): string | undefined {
    if (context.activeWorkflowId) {
      return `workflow:${context.activeWorkflowId}`;
    }
    if (context.activeServiceDomain) {
      return `service:${context.activeServiceDomain}`;
    }
    if (context.recentWorkflowIds.length > 0) {
      return `workflows:[${context.recentWorkflowIds.slice(0, 3).join(',')}]`;
    }
    return undefined;
  }
}

export class QueryParser {
  /**
   * Parse raw input into structured query with prefix flags
   * Supports: /service:lending /status:pending /client:ACME
   */
  parse(rawInput: string): import('./types').ParsedQuery {
    const prefixFlagRegex = /\/([a-zA-Z_]+):([^\s]+)/g;
    const flags: import('./types').PrefixFlag[] = [];
    let match;
    let cleanedInput = rawInput;

    while ((match = prefixFlagRegex.exec(rawInput)) !== null) {
      flags.push({
        prefix: match[1],
        value: match[2],
        operator: this.inferOperator(match[2])
      });
      cleanedInput = cleanedInput.replace(match[0], '');
    }

    const tokens = cleanedInput.trim().split(/\s+/).filter(t => t.length > 0);

    return {
      textTokens: tokens,
      prefixFlags: flags,
      semanticTokens: [],  // Populated by ML/NLP layer
      intent: this.inferIntent(tokens, flags),
      scopeOverride: flags.find(f => f.prefix === 'service')?.value as ServiceDomain
    };
  }

  private inferOperator(value: string): import('./types').PrefixFlag['operator'] {
    if (value.includes('*')) return 'contains';
    if (value.includes('>')) return 'gt';
    if (value.includes('<')) return 'lt';
    if (value.startsWith('!')) return 'ne';
    return 'eq';
  }

  private inferIntent(
    tokens: string[], 
    flags: import('./types').PrefixFlag[]
  ): import('./types').SearchIntent {
    const actionVerbs = ['create', 'new', 'start', 'initiate', 'open'];
    const filterVerbs = ['filter', 'show', 'only', 'where'];
    const firstToken = tokens[0]?.toLowerCase();

    if (actionVerbs.includes(firstToken)) return 'create';
    if (filterVerbs.includes(firstToken)) return 'filter';
    if (flags.length > 0 && tokens.length === 0) return 'filter';
    if (tokens.length === 1 && tokens[0].startsWith('/')) return 'navigate';
    return 'search';
  }
}
