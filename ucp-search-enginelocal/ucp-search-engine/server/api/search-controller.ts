/**
 * Server-Side Search Controller
 * Elastic indexing for transactional entity data with context-aware boosting
 */

import { Request, Response } from 'express';
import { Client } from '@elastic/elasticsearch';
import { SearchQuery, SearchResult, SearchContext } from '../../shared/types';

const elasticClient = new Client({ node: process.env.ELASTIC_URL || 'http://localhost:9200' });

const INDEX_NAME = 'ucp_transactional_entities';

/**
 * POST /api/search/elastic
 * Main search endpoint with context scoping
 */
export async function searchHandler(req: Request, res: Response) {
  try {
    const { query, parsed, context, sessionId } = req.body as {
      query: string;
      parsed: SearchQuery['parsed'];
      context: SearchContext;
      sessionId: string;
    };

    // Build Elasticsearch query with context-aware boosting
    const esQuery = buildContextualQuery(query, parsed, context);

    const response = await elasticClient.search({
      index: INDEX_NAME,
      body: {
        query: esQuery,
        size: 50,
        highlight: {
          fields: {
            title: { fragment_size: 150, number_of_fragments: 1 },
            content: { fragment_size: 150, number_of_fragments: 2 }
          }
        },
        sort: [
          { _score: 'desc' },
          { last_modified: 'desc' }
        ]
      }
    });

    const results: SearchResult[] = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      type: hit._source.doc_type,
      title: hit._source.title,
      subtitle: hit._source.subtitle,
      metadata: {
        icon: hit._source.icon,
        color: hit._source.color,
        badges: hit._source.service_domains || [],
        lastModified: hit._source.last_modified,
        ownerId: hit._source.owner_id,
        status: hit._source.status
      },
      actionability: {
        primaryAction: {
          id: 'open',
          label: 'Open',
          type: 'open',
          target: hit._source.workflow_url,
          requiresConfirmation: false
        },
        secondaryActions: [
          { id: 'share', label: 'Share', type: 'share', requiresConfirmation: false },
          { id: 'pin', label: 'Pin', type: 'pin', requiresConfirmation: false }
        ],
        previewAvailable: true,
        keyboardShortcuts: { 'Enter': 'open', 'Cmd+Enter': 'split' }
      },
      source: 'server_elastic',
      score: hit._score,
      contextRelevance: calculateContextRelevance(hit._source, context)
    }));

    res.json({ results, total: response.hits.total, sessionId });
  } catch (error) {
    console.error('Elastic search error:', error);
    res.status(500).json({ error: 'Search failed', details: (error as Error).message });
  }
}

/**
 * POST /api/search/elastic/stream
 * Server-sent events streaming for real-time results
 */
export async function streamSearchHandler(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { query, parsed } = req.body;
    const context = req.body.context as SearchContext;

    const esQuery = buildContextualQuery(query, parsed, context);

    const response = await elasticClient.search({
      index: INDEX_NAME,
      body: {
        query: esQuery,
        size: 50
      }
    });

    for (const hit of response.hits.hits) {
      const result: SearchResult = {
        id: hit._id,
        type: hit._source.doc_type,
        title: hit._source.title,
        metadata: {
          badges: hit._source.service_domains || [],
          lastModified: hit._source.last_modified
        },
        actionability: {
          primaryAction: { id: 'open', label: 'Open', type: 'open', requiresConfirmation: false },
          secondaryActions: [],
          previewAvailable: true
        },
        source: 'server_elastic',
        score: hit._score,
        contextRelevance: calculateContextRelevance(hit._source, context)
      };

      res.write(`data: ${JSON.stringify(result)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`);
    res.end();
  }
}

/**
 * Build Elasticsearch bool query with context-aware boosting
 */
function buildContextualQuery(
  rawQuery: string,
  parsed: SearchQuery['parsed'],
  context: SearchContext
) {
  const mustClauses: any[] = [];
  const shouldClauses: any[] = [];
  const filterClauses: any[] = [];

  // Text search across multiple fields
  if (parsed.textTokens.length > 0) {
    mustClauses.push({
      multi_match: {
        query: parsed.textTokens.join(' '),
        fields: ['title^3', 'subtitle^2', 'content', 'tags^2'],
        type: 'best_fields',
        fuzziness: 'AUTO'
      }
    });
  }

  // Prefix flag filters
  parsed.prefixFlags.forEach(flag => {
    const fieldMap: Record<string, string> = {
      service: 'service_domains',
      status: 'status',
      client: 'client_id',
      workflow: 'workflow_id',
      assignee: 'owner_id'
    };

    const field = fieldMap[flag.prefix] || flag.prefix;

    if (flag.operator === 'eq') {
      filterClauses.push({ term: { [field]: flag.value } });
    } else if (flag.operator === 'contains') {
      mustClauses.push({ wildcard: { [field]: `*${flag.value}*` } });
    }
  });

  // Context-aware boosting
  if (context.activeWorkflowId) {
    shouldClauses.push({
      term: {
        workflow_id: {
          value: context.activeWorkflowId,
          boost: 3.0
        }
      }
    });
  }

  if (context.activeServiceDomain) {
    shouldClauses.push({
      term: {
        service_domains: {
          value: context.activeServiceDomain,
          boost: 2.0
        }
      }
    });
  }

  if (context.recentWorkflowIds.length > 0) {
    shouldClauses.push({
      terms: {
        workflow_id: context.recentWorkflowIds.slice(0, 10),
        boost: 1.5
      }
    });
  }

  // Org isolation
  filterClauses.push({ term: { org_id: context.orgId } });

  return {
    bool: {
      must: mustClauses,
      should: shouldClauses,
      filter: filterClauses,
      minimum_should_match: 0
    }
  };
}

function calculateContextRelevance(source: any, context: SearchContext): number {
  let score = 0.5;

  if (source.workflow_id === context.activeWorkflowId) score += 0.3;
  if (source.service_domains?.includes(context.activeServiceDomain)) score += 0.2;
  if (context.recentWorkflowIds.includes(source.workflow_id)) score += 0.15;
  if (source.owner_id === context.userId) score += 0.1;

  return Math.min(1.0, score);
}
