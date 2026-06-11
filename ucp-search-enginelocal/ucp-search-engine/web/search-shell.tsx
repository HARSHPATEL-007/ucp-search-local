/**
 * BiB Search Shell Component
 * Desktop browser implementation: persistent header bar, Cmd+K trigger
 * High-density keyboard input with semantic auto-complete
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SearchQuery, SearchResult, SearchContext, SearchSession } from '../shared/types';
import { SearchOrchestrator } from '../shared/search-orchestrator';
import { TrieSearchBackend } from './backends/trie-backend';
import { ElasticSearchBackend } from './backends/elastic-backend';
import { SearchInput } from './components/search-input';
import { ResultList } from './components/result-list';
import { PreviewPane } from './components/preview-pane';

interface SearchShellProps {
  context: SearchContext;
  onResultAction: (result: SearchResult, action: string) => void;
  onTabRequest: (type: 'new' | 'split' | 'background', target: string) => void;
}

export const SearchShell: React.FC<SearchShellProps> = ({ 
  context, onResultAction, onTabRequest 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<SearchSession | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const orchestratorRef = useRef<SearchOrchestrator | null>(null);

  // Initialize orchestrator with BiB-specific backends
  useEffect(() => {
    const orchestrator = new SearchOrchestrator();
    orchestrator.registerBackend(new TrieSearchBackend({ priority: 1 }));
    orchestrator.registerBackend(new ElasticSearchBackend({ 
      endpoint: '/api/search/elastic',
      priority: 2 
    }));
    orchestratorRef.current = orchestrator;
  }, []);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSearch = useCallback(async (rawInput: string) => {
    if (!orchestratorRef.current) return;

    const newSession = await orchestratorRef.current.executeSearch(
      rawInput, 
      context, 
      { requireLocalFirst: true, timeoutMs: 8000 }
    );

    setSession(newSession);
    setSelectedIndex(0);

    if (newSession.results.length > 0) {
      setPreviewResult(newSession.results[0]);
    }
  }, [context]);

  const handleKeyNavigation = useCallback((e: React.KeyboardEvent) => {
    if (!session) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => {
          const next = Math.min(i + 1, session.results.length - 1);
          setPreviewResult(session.results[next]);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => {
          const prev = Math.max(i - 1, 0);
          setPreviewResult(session.results[prev]);
          return prev;
        });
        break;
      case 'Enter':
        e.preventDefault();
        const result = session.results[selectedIndex];
        if (result) {
          if (e.metaKey || e.ctrlKey) {
            // Cmd+Enter: open in background split-pane
            onTabRequest('split', result.id);
          } else {
            // Enter: open in new focused tab
            onTabRequest('new', result.id);
          }
        }
        break;
      case 'Tab':
        e.preventDefault();
        // Tab completion for prefix flags
        if (inputRef.current) {
          const val = inputRef.current.value;
          const prefixMatch = val.match(/\/([a-zA-Z_]*)$/);
          if (prefixMatch) {
            // Auto-complete prefix suggestions
            const suggestions = ['service', 'status', 'client', 'workflow', 'date'];
            const filtered = suggestions.filter(s => s.startsWith(prefixMatch[1]));
            if (filtered.length === 1) {
              inputRef.current.value = val.replace(/\/[a-zA-Z_]*$/, `/${filtered[0]}:`);
            }
          }
        }
        break;
    }
  }, [session, selectedIndex, onTabRequest]);

  if (!isOpen) return null;

  return (
    <div className="bib-search-overlay" onClick={() => setIsOpen(false)}>
      <div className="bib-search-modal" onClick={e => e.stopPropagation()}>
        <SearchInput
          ref={inputRef}
          context={context}
          onSearch={handleSearch}
          onKeyDown={handleKeyNavigation}
          placeholder={`Search in ${context.activeServiceDomain || 'all services'}...`}
        />

        <div className="bib-search-body">
          <ResultList
            results={session?.results || []}
            selectedIndex={selectedIndex}
            onSelect={(idx) => {
              setSelectedIndex(idx);
              setPreviewResult(session!.results[idx]);
            }}
            onHover={(result) => setPreviewResult(result)}
          />

          <PreviewPane 
            result={previewResult} 
            onAction={onResultAction}
          />
        </div>

        <div className="bib-search-footer">
          <kbd>↵</kbd> Open <kbd>⌘↵</kbd> Split <kbd>↑↓</kbd> Navigate <kbd>Esc</kbd> Close
        </div>
      </div>
    </div>
  );
};
