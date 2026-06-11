/**
 * BiB Preview Pane Component
 * Metadata preview on hover with actionability
 */

import React from 'react';
import { SearchResult } from '../../shared/types';

interface PreviewPaneProps {
  result: SearchResult | null;
  onAction: (result: SearchResult, action: string) => void;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({ result, onAction }) => {
  if (!result) {
    return (
      <div className="bib-preview-pane bib-preview-pane--empty">
        <p>Hover over a result to preview</p>
      </div>
    );
  }

  return (
    <div className="bib-preview-pane">
      <div className="bib-preview-header">
        <h3>{result.title}</h3>
        <span className="bib-preview-type">{result.type}</span>
      </div>

      {result.subtitle && (
        <p className="bib-preview-subtitle">{result.subtitle}</p>
      )}

      <div className="bib-preview-metadata">
        <div className="bib-meta-row">
          <span className="bib-meta-label">Source:</span>
          <span className="bib-meta-value">{result.source}</span>
        </div>
        <div className="bib-meta-row">
          <span className="bib-meta-label">Score:</span>
          <span className="bib-meta-value">{result.score.toFixed(3)}</span>
        </div>
        <div className="bib-meta-row">
          <span className="bib-meta-label">Context Relevance:</span>
          <span className="bib-meta-value">
            {(result.contextRelevance * 100).toFixed(1)}%
          </span>
        </div>
        {result.metadata.lastModified && (
          <div className="bib-meta-row">
            <span className="bib-meta-label">Last Modified:</span>
            <span className="bib-meta-value">
              {new Date(result.metadata.lastModified).toLocaleString()}
            </span>
          </div>
        )}
        {result.metadata.ownerId && (
          <div className="bib-meta-row">
            <span className="bib-meta-label">Owner:</span>
            <span className="bib-meta-value">{result.metadata.ownerId}</span>
          </div>
        )}
      </div>

      <div className="bib-preview-badges">
        {result.metadata.badges.map(badge => (
          <span key={badge} className="bib-preview-badge">{badge}</span>
        ))}
      </div>

      <div className="bib-preview-actions">
        <button 
          className="bib-action-btn bib-action-btn--primary"
          onClick={() => onAction(result, result.actionability.primaryAction.id)}
        >
          {result.actionability.primaryAction.label}
        </button>

        {result.actionability.secondaryActions.map(action => (
          <button 
            key={action.id}
            className="bib-action-btn"
            onClick={() => onAction(result, action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
