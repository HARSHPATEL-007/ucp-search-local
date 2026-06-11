/**
 * Index Synchronization Service
 * Syncs transactional entity data from operational DB to Elasticsearch
 * and pushes offline-capable subsets to mobile SQLite FTS5
 */

import { Client } from '@elastic/elasticsearch';
import { Pool } from 'pg';
import { SQLiteSyncAdapter } from '../mobile/sqlite-sync-adapter';

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
const elasticClient = new Client({ node: process.env.ELASTIC_URL });

const INDEX_NAME = 'ucp_transactional_entities';

interface SyncableEntity {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  doc_type: string;
  service_domains: string[];
  workflow_id?: string;
  client_id?: string;
  owner_id: string;
  org_id: string;
  status: string;
  region_code?: string;
  tags: string[];
  last_modified: Date;
  created_at: Date;
  workflow_url?: string;
  icon?: string;
  color?: string;
  json_payload: Record<string, any>;
}

export class IndexSyncService {
  private sqliteAdapter: SQLiteSyncAdapter;

  constructor() {
    this.sqliteAdapter = new SQLiteSyncAdapter();
  }

  /**
   * Full sync: Push all changed entities to Elasticsearch
   */
  async syncToElastic(since: Date): Promise<number> {
    const client = await pgPool.connect();

    try {
      const { rows } = await client.query(`
        SELECT * FROM ucp_entities 
        WHERE last_modified > $1 
        ORDER BY last_modified ASC
      `, [since]);

      const entities = rows as SyncableEntity[];

      if (entities.length === 0) return 0;

      // Bulk index to Elasticsearch
      const body = entities.flatMap(entity => [
        { index: { _index: INDEX_NAME, _id: entity.id } },
        {
          title: entity.title,
          subtitle: entity.subtitle,
          content: entity.content,
          doc_type: entity.doc_type,
          service_domains: entity.service_domains,
          workflow_id: entity.workflow_id,
          client_id: entity.client_id,
          owner_id: entity.owner_id,
          org_id: entity.org_id,
          status: entity.status,
          region_code: entity.region_code,
          tags: entity.tags,
          last_modified: entity.last_modified,
          created_at: entity.created_at,
          workflow_url: entity.workflow_url,
          icon: entity.icon,
          color: entity.color,
          json_payload: entity.json_payload
        }
      ]);

      await elasticClient.bulk({ refresh: true, body });

      return entities.length;
    } finally {
      client.release();
    }
  }

  /**
   * Mobile sync: Push relevant subset to device SQLite
   */
  async syncToMobile(userId: string, deviceId: string): Promise<number> {
    const client = await pgPool.connect();

    try {
      // Get user's recent workflows and service domains for relevance filtering
      const { rows: contextRows } = await client.query(`
        SELECT workflow_id, service_domain, access_count 
        FROM user_workspace_context 
        WHERE user_id = $1 
        ORDER BY last_accessed DESC 
        LIMIT 50
      `, [userId]);

      const recentWorkflows = contextRows.map(r => r.workflow_id).filter(Boolean);
      const activeDomains = [...new Set(contextRows.map(r => r.service_domain).filter(Boolean))];

      // Fetch relevant entities for offline access
      const { rows } = await client.query(`
        SELECT * FROM ucp_entities 
        WHERE org_id = (
          SELECT org_id FROM users WHERE id = $1
        )
        AND (
          workflow_id = ANY($2)
          OR service_domains && $3
          OR owner_id = $1
        )
        AND last_modified > NOW() - INTERVAL '30 days'
        LIMIT 1000
      `, [userId, recentWorkflows, activeDomains]);

      const entities = rows as SyncableEntity[];

      // Push to mobile device via sync adapter
      await this.sqliteAdapter.syncToDevice(userId, deviceId, entities);

      return entities.length;
    } finally {
      client.release();
    }
  }

  /**
   * Real-time change data capture (CDC) handler
   */
  async handleChangeEvent(change: {
    table: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    data: SyncableEntity;
  }) {
    if (change.table !== 'ucp_entities') return;

    switch (change.operation) {
      case 'INSERT':
      case 'UPDATE':
        await elasticClient.index({
          index: INDEX_NAME,
          id: change.data.id,
          body: change.data
        });
        break;
      case 'DELETE':
        await elasticClient.delete({
          index: INDEX_NAME,
          id: change.data.id
        });
        break;
    }
  }
}
