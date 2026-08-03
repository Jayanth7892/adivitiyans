import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface TopicCount {
  label: string;
  count: number;
}

interface TopicBarChartProps {
  data: TopicCount[];
  title?: string;
  barColor?: string;
  initialCount?: number;
}

export const TopicBarChart: React.FC<TopicBarChartProps> = ({
  data,
  title = 'DSA Topic Analysis',
  barColor = '#1E293B',
  initialCount = 6,
}) => {
  const [expanded, setExpanded] = useState(false);

  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const maxCount = sortedData.length > 0 ? sortedData[0].count : 1;

  const visibleData = expanded ? sortedData : sortedData.slice(0, initialCount);

  return (
    <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-xs space-y-4">
      <h3 className="text-sm font-bold text-textPrimary">{title}</h3>

      {sortedData.length > 0 ? (
        <div className="space-y-2.5 pt-1">
          {visibleData.map((item) => {
            const pct = Math.min(100, Math.round((item.count / maxCount) * 100));
            return (
              <div key={item.label} className="flex items-center gap-3 text-xs">
                <span className="w-24 text-[11px] font-medium text-textSecondary text-right truncate shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="h-4 bg-background rounded-sm flex-1 overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-textPrimary w-8 shrink-0">
                    {item.count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-textSecondary border border-dashed border-borderLine rounded-xl">
          No topic analysis data available.
        </div>
      )}

      {sortedData.length > initialCount && (
        <div className="pt-1 flex justify-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold text-textSecondary hover:text-textPrimary flex items-center gap-1 transition-colors"
          >
            <span>{expanded ? 'Show Less' : `Show More`}</span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
};
