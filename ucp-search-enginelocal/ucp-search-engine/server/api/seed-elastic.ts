/**
 * Seed Elasticsearch with demo financial service data
 * Run: npm run seed
 */

import { Client } from '@elastic/elasticsearch';

const client = new Client({ node: process.env.ELASTIC_URL || 'http://localhost:9200' });
const INDEX = 'ucp_transactional_entities';

const demoEntities = [
  {
    id: 'audit_001',
    title: 'PCAOB AS 2201 - Integrated Audit',
    subtitle: 'Financial statement audit under PCAOB standards',
    content: 'Integrated audit engagement for Q3 2026. Revenue recognition testing, internal controls evaluation, and management representation letter review.',
    doc_type: 'workflow',
    service_domains: ['audit_assurance'],
    workflow_id: 'wf_audit_001',
    client_id: 'ACME-Corp',
    owner_id: 'auditor_smith',
    org_id: 'demo_org',
    status: 'active',
    region_code: 'US-NY',
    tags: ['pcaob', 'as2201', 'integrated', 'revenue'],
    last_modified: new Date().toISOString(),
    created_at: '2026-01-15T00:00:00Z',
    workflow_url: '/audit/audit_001',
    icon: '🔍',
    color: '#5856D6'
  },
  {
    id: 'lending_001',
    title: 'Revolving Credit Facility - $50M',
    subtitle: 'Committed revolving line for ACME Holdings',
    content: 'Senior secured revolving credit facility with borrowing base certificate requirements. Covenant testing quarterly.',
    doc_type: 'entity',
    service_domains: ['lending'],
    workflow_id: 'wf_lending_001',
    client_id: 'ACME-Holdings',
    owner_id: 'banker_jones',
    org_id: 'demo_org',
    status: 'active',
    region_code: 'US-NY',
    tags: ['revolver', 'credit', 'committed', 'senior-secured'],
    last_modified: new Date().toISOString(),
    created_at: '2026-02-01T00:00:00Z',
    workflow_url: '/lending/lending_001',
    icon: '💰',
    color: '#007AFF'
  },
  {
    id: 'dcm_001',
    title: 'DCM Bookbuilding - High-Yield Bond',
    subtitle: '$300M 8.5% Senior Notes due 2031',
    content: 'High-yield bond issuance for industrial client. Roadshow completed, bookbuilding in progress. Order accumulation from 45 accounts.',
    doc_type: 'workflow',
    service_domains: ['dcm'],
    workflow_id: 'wf_dcm_001',
    client_id: 'Industries-Inc',
    owner_id: 'dcm_lee',
    org_id: 'demo_org',
    status: 'active',
    region_code: 'US-NY',
    tags: ['high-yield', 'bond', 'bookbuilding', 'roadshow'],
    last_modified: new Date().toISOString(),
    created_at: '2026-03-10T00:00:00Z',
    workflow_url: '/dcm/dcm_001',
    icon: '📊',
    color: '#AF52DE'
  },
  {
    id: 'trade_001',
    title: 'Letter of Credit - MT700',
    subtitle: 'Standby LC for commodity trade',
    content: 'Documentary letter of credit issuance via SWIFT MT700. Beneficiary: Global Trading Ltd. Amount: $2.5M. UCP 600 compliant.',
    doc_type: 'transaction',
    service_domains: ['trade_finance'],
    workflow_id: 'wf_trade_001',
    client_id: 'Global-Trading',
    owner_id: 'trade_chen',
    org_id: 'demo_org',
    status: 'pending',
    region_code: 'SG-SG',
    tags: ['lc', 'mt700', 'standby', 'commodity'],
    last_modified: new Date().toISOString(),
    created_at: '2026-04-05T00:00:00Z',
    workflow_url: '/trade/trade_001',
    icon: '📜',
    color: '#FF9500'
  },
  {
    id: 'hf_001',
    title: 'NAV Calculation - Series A',
    subtitle: 'Monthly NAV for hedge fund LP',
    content: 'Net asset value calculation with waterfall processing. High-water mark verification and incentive fee accrual.',
    doc_type: 'workflow',
    service_domains: ['hedge_fund'],
    workflow_id: 'wf_hf_001',
    client_id: 'Alpha-Fund',
    owner_id: 'fund_admin_wang',
    org_id: 'demo_org',
    status: 'active',
    region_code: 'KY-GC',
    tags: ['nav', 'waterfall', 'incentive', 'high-water-mark'],
    last_modified: new Date().toISOString(),
    created_at: '2026-05-01T00:00:00Z',
    workflow_url: '/hf/hf_001',
    icon: '📈',
    color: '#34C759'
  },
  {
    id: 'tax_001',
    title: 'Tax Provision - ASC 740',
    subtitle: 'Q2 2026 tax provision preparation',
    content: 'Current and deferred tax scheduling. Valuation allowance assessment. Uncertain tax position analysis under FIN 48.',
    doc_type: 'workflow',
    service_domains: ['tax'],
    workflow_id: 'wf_tax_001',
    client_id: 'ACME-Corp',
    owner_id: 'tax_patel',
    org_id: 'demo_org',
    status: 'pending',
    region_code: 'US-NY',
    tags: ['asc740', 'provision', 'deferred', 'fin48'],
    last_modified: new Date().toISOString(),
    created_at: '2026-05-15T00:00:00Z',
    workflow_url: '/tax/tax_001',
    icon: '📝',
    color: '#FF3B30'
  }
];

export async function seedElastic(): Promise<number> {
  // Create index if not exists
  const exists = await client.indices.exists({ index: INDEX });
  if (!exists) {
    const mapping = await import('../indexing/elastic-mapping.json');
    await client.indices.create({
      index: INDEX,
      body: mapping.default || mapping
    });
    console.log(`Created index: ${INDEX}`);
  }

  // Bulk index
  const body = demoEntities.flatMap(e => [
    { index: { _index: INDEX, _id: e.id } },
    e
  ]);

  await client.bulk({ refresh: true, body });
  console.log(`Seeded ${demoEntities.length} entities`);

  return demoEntities.length;
}

// Run if called directly
if (require.main === module) {
  seedElastic().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
