import React from 'react';

export interface BreakdownItem {
  label: string;
  solved: number;
  total: number;
  color: string;
}

interface DonutBreakdownProps {
  items: BreakdownItem[];
  title?: string;
}

export const DonutBreakdown: React.FC<DonutBreakdownProps> = ({
  items,
  title = 'DSA Problems Solved',
}) => {
  const grandTotalSolved = items.reduce((acc, item) => acc + item.solved, 0);

  // Donut SVG Parameters matching BytsOne
  const radius = 42;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  // Custom colors matching BytsOne screenshot: Cyan (#00D8F6) for Easy, Yellow (#FFC01E) for Medium
  const getItemColor = (item: BreakdownItem, idx: number) => {
    if (idx === 0) return '#00D8F6'; // Cyan
    if (idx === 1) return '#FFC01E'; // Yellow
    return '#FF375F'; // Red
  };

  let currentOffset = 0;
  const totalForSlices = grandTotalSolved || 1;

  const slices = items.map((item, idx) => {
    const pct = item.solved / totalForSlices;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += pct * circumference;
    return {
      ...item,
      color: getItemColor(item, idx),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-xs flex flex-col justify-between h-full space-y-4">
      <h3 className="text-sm font-bold text-textPrimary">{title}</h3>

      <div className="flex flex-col sm:flex-row items-center gap-8 py-2">
        {/* Donut Chart with Centered Count */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Background ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />
            {/* Donut segments */}
            {slices.map((slice, i) => (
              <circle
                key={i}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-textPrimary leading-none">
              {grandTotalSolved}
            </span>
            <span className="text-xs font-semibold text-textSecondary mt-0.5">
              problems
            </span>
          </div>
        </div>

        {/* Breakdown Progress Bars */}
        <div className="flex-1 w-full space-y-4">
          {items.map((item, idx) => {
            const pct = item.total > 0 ? Math.min(100, Math.round((item.solved / item.total) * 100)) : 0;
            const barColor = item.solved > 0 ? '#22C55E' : '#E2E8F0';

            return (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-textPrimary">
                    {item.label}
                  </span>
                  <span className="font-bold text-textPrimary">
                    {item.solved} <span className="text-textSecondary font-normal">/ {item.total}</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(pct, item.solved > 0 ? 3 : 0)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
