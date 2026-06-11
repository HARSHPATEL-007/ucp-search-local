/**
 * BiB Result List Component
 * Hover-states revealing metadata previews
 */

import React from 'react';
import { SearchResult } from '../../shared/types';

interface ResultListProps {
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover: (result: SearchResult) => void;
}

export const ResultList: React.FC<ResultListProps> = ({ 
  results, selectedIndex, onSelect, onHover 
}) => {
  if (results.length === 0) {
    return (
      <div className="bib-result-empty">
        <p>No results found</p>
        <span className="bib-hint">
          Try using prefix flags like /service:lending or /status:pending
        </span>
      </div>
    );
  }

  return (
    <div className="bib-result-list">
      {results.map((result, idx) => (
        <div
          key={result.id}
          className={`bib-result-item ${idx === selectedIndex ? 'bib-result-item--selected' : ''}`}
          onClick={() => onSelect(idx)}
          onMouseEnter={() => onHover(result)}
        >
          <div className="bib-result-icon">
            {result.metadata.icon || '🔍'}
          </div>

          <div className="bib-result-content">
            <div className="bib-result-title">
              {result.title}
              {result.metadata.badges.map(badge => (
                <span key={badge} className="bib-badge">{badge}</span>
              ))}
            </div>

            {result.subtitle && (
              <div className="bib-result-subtitle">{result.subtitle}</div>
            )}

            <div className="bib-result-meta">
              <span className="bib-score">Score: {result.score.toFixed(2)}</span>
              <span className="bib-relevance">
                Relevance: {(result.contextRelevance * 100).toFixed(0)}%
              </span>
              <span className="bib-source">{result.source}</span>
            </div>
          </div>

          <div className="bib-result-actions">
            {result.actionability.keyboardShortcuts && (
              <div className="bib-shortcuts">
                {Object.entries(result.actionability.keyboardShortcuts).map(([key, action]) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
