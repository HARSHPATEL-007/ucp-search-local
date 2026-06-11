/**
 * Unified Search Engine Types
 * Cross-platform core definitions for UCP Search
 */

export type Platform = 'web' | 'mobile';

export interface SearchContext {
  platform: Platform;
  userId: string;
  orgId: string;
  activeWorkflowId?: string;
  activeServiceDomain?: ServiceDomain;  // e.g., 'audit_assurance', 'lending', 'dcm'
  activeTabId?: string;
  geofencedRegion?: GeoRegion;
  recentWorkflowIds: string[];
  deviceCapabilities: DeviceCapabilities;
}

export type ServiceDomain = 
  | 'audit_assurance' | 'tax' | 'advisory' 
  | 'lending' | 'trade_finance' | 'dcm' | 'securitization'
  | 'hedge_fund' | 'asset_management' | 'fintech';

export interface GeoRegion {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  regionCode: string;
}

export interface DeviceCapabilities {
  supportsWasm: boolean;
  supportsWebWorkers: boolean;
  supportsVoice: boolean;
  supportsHaptics: boolean;
  maxConcurrentSearches: number;
  offlineIndexAvailable: boolean;
}

export interface SearchQuery {
  rawInput: string;
  parsed: ParsedQuery;
  context: SearchContext;
  timestamp: number;
  sessionId: string;
}

export interface ParsedQuery {
  textTokens: string[];
  prefixFlags: PrefixFlag[];
  semanticTokens: SemanticToken[];
  intent: SearchIntent;
  scopeOverride?: ServiceDomain;
}

export interface PrefixFlag {
  prefix: string;      // e.g., '/service', '/status', '/client'
  value: string;       // e.g., 'lending', 'pending', 'ACME-2026'
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'startsWith';
}

export interface SemanticToken {
  type: 'entity' | 'workflow' | 'document' | 'action' | 'person';
  value: string;
  confidence: number;
  source: 'local' | 'remote' | 'ml';
}

export type SearchIntent = 
  | 'navigate' | 'search' | 'create' | 'action' 
  | 'filter' | 'summarize' | 'alert';

export interface SearchResult<T = unknown> {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  metadata: ResultMetadata;
  actionability: ActionabilityConfig;
  source: 'local_trie' | 'local_index' | 'server_elastic' | 'server_vector';
  score: number;
  contextRelevance: number;  // 0-1, boosted by active workflow proximity
  payload: T;
}

export type ResultType = 
  | 'workflow' | 'entity' | 'document' | 'tab' | 'action' 
  | 'person' | 'report' | 'transaction';

export interface ResultMetadata {
  icon?: string;
  color?: string;
  badges: string[];
  lastModified?: number;
  ownerId?: string;
  status?: string;
}

export interface ActionabilityConfig {
  primaryAction: ActionDefinition;
  secondaryActions: ActionDefinition[];
  previewAvailable: boolean;
  keyboardShortcuts?: Record<string, string>;
  swipeGestures?: Record<string, string>;
}

export interface ActionDefinition {
  id: string;
  label: string;
  type: 'open' | 'create' | 'pin' | 'share' | 'delete' | 'append' | 'split';
  target?: string;
  requiresConfirmation: boolean;
}

export interface SearchSession {
  sessionId: string;
  context: SearchContext;
  history: SearchQuery[];
  results: SearchResult[];
  activeResultIndex: number;
  state: 'idle' | 'typing' | 'indexing' | 'streaming' | 'complete' | 'error';
}

export interface ContextScopeWeights {
  activeWorkflowBoost: number;      // e.g., 2.0
  recentWorkflowBoost: number;      // e.g., 1.5
  geofencedBoost: number;           // e.g., 1.3
  serviceDomainBoost: number;       // e.g., 1.4
  globalPenalty: number;            // e.g., 0.6
}

export const DEFAULT_SCOPE_WEIGHTS: ContextScopeWeights = {
  activeWorkflowBoost: 2.0,
  recentWorkflowBoost: 1.5,
  geofencedBoost: 1.3,
  serviceDomainBoost: 1.4,
  globalPenalty: 0.6,
};
