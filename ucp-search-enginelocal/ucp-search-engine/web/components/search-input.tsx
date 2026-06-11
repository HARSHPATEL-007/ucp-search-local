/**
 * BiB Search Input Component
 * High-density keyboard input with semantic auto-complete, prefix chips, inline flags
 */

import React, { forwardRef, useState, useCallback } from 'react';
import { SearchContext, PrefixFlag } from '../../shared/types';

interface SearchInputProps {
  context: SearchContext;
  onSearch: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ context, onSearch, onKeyDown, placeholder }, ref) => {
    const [value, setValue] = useState('');
    const [flags, setFlags] = useState<PrefixFlag[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const extractFlags = (input: string): { cleanText: string; flags: PrefixFlag[] } => {
      const flagRegex = /\/([a-zA-Z_]+):([^\s]+)/g;
      const foundFlags: PrefixFlag[] = [];
      let match;
      let cleanText = input;

      while ((match = flagRegex.exec(input)) !== null) {
        foundFlags.push({
          prefix: match[1],
          value: match[2],
          operator: 'eq'
        });
        cleanText = cleanText.replace(match[0], '').trim();
      }
      return { cleanText, flags: foundFlags };
    };

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      const { flags: extractedFlags } = extractFlags(newValue);
      setFlags(extractedFlags);

      // Semantic auto-complete suggestions
      if (newValue.includes('/')) {
        const prefixStart = newValue.lastIndexOf('/');
        const partial = newValue.slice(prefixStart + 1);

        const allPrefixes = [
          'service', 'status', 'client', 'workflow', 'date', 'assignee', 'priority'
        ];

        const filtered = allPrefixes.filter(p => p.startsWith(partial) && p !== partial);
        setSuggestions(filtered.map(p => `/${p}:`));
        setShowSuggestions(filtered.length > 0);
      } else {
        setShowSuggestions(false);
      }

      // Debounced search
      onSearch(newValue);
    }, [onSearch]);

    const applySuggestion = (suggestion: string) => {
      const prefixStart = value.lastIndexOf('/');
      const newValue = value.slice(0, prefixStart) + suggestion;
      setValue(newValue);
      setShowSuggestions(false);
      if (ref && 'current' in ref && ref.current) {
        ref.current.focus();
      }
    };

    return (
      <div className="bib-search-input-container">
        <div className="bib-prefix-chips">
          {flags.map((flag, idx) => (
            <span key={idx} className={`bib-chip bib-chip--${flag.prefix}`}>
              {flag.prefix}: {flag.value}
              <button onClick={() => {
                const newValue = value.replace(`/${flag.prefix}:${flag.value}`, '').trim();
                setValue(newValue);
                setFlags(flags.filter((_, i) => i !== idx));
              }}>×</button>
            </span>
          ))}
        </div>

        <input
          ref={ref}
          type="text"
          className="bib-search-input"
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        {showSuggestions && (
          <div className="bib-suggestions-dropdown">
            {suggestions.map((s, i) => (
              <div 
                key={i} 
                className="bib-suggestion-item"
                onClick={() => applySuggestion(s)}
              >
                {s}
              </div>
            ))}
          </div>
        )}

        <div className="bib-context-badge">
          {context.activeServiceDomain && (
            <span className="bib-scope-indicator">
              Scoped: {context.activeServiceDomain}
            </span>
          )}
        </div>
      </div>
    );
  }
);
