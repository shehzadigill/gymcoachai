// RAG Sources Display Component
import React from 'react';
import type { RAGSource } from '../../../types/ai-service';
import { formatRAGSources } from '../../../lib/ai-utils';

interface RAGSourcesDisplayProps {
  sources: RAGSource[];
  showDetails?: boolean;
  maxSources?: number;
  className?: string;
}

export function RAGSourcesDisplay({
  sources,
  showDetails = false,
  maxSources = 5,
  className = '',
}: RAGSourcesDisplayProps) {
  if (!sources || sources.length === 0) {
    return null;
  }

  const formattedSources = formatRAGSources(sources);
  const displaySources = formattedSources.slice(0, maxSources);
  const hasMore = sources.length > maxSources;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="font-medium">Sources:</span>
        <span className="text-gray-500">({sources.length} found)</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {displaySources.map((source, index) => (
          <div
            key={index}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${source.color}`}
            title={source.description}
          >
            <span>{source.icon}</span>
            <span>{source.label}</span>
          </div>
        ))}

        {hasMore && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <span>+{sources.length - maxSources} more</span>
          </div>
        )}
      </div>

      {showDetails && (
        <div className="mt-3 space-y-2">
          <div className="text-sm font-medium text-gray-700">
            Detailed Sources:
          </div>
          <div className="space-y-1">
            {sources.map((source, index) => (
              <div
                key={index}
                className="text-xs text-gray-600 bg-gray-50 p-2 rounded"
              >
                <div className="font-medium">{source.metadata.source}</div>
                <div className="text-gray-500 mt-1">
                  {source.content.substring(0, 100)}
                  {source.content.length > 100 && '...'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-1 py-0.5 rounded text-xs ${source.color}`}
                  >
                    {source.metadata.type}
                  </span>
                  <span className="text-gray-400">
                    Confidence: {(source.metadata.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RAGSourcesDisplay;
