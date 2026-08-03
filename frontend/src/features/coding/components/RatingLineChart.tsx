import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface RatingPoint {
  date: string;
  rating: number;
  contestName?: string;
}

interface RatingLineChartProps {
  data: RatingPoint[];
  title?: string;
  lineColor?: string;
}

export const RatingLineChart: React.FC<RatingLineChartProps> = ({
  data,
  title = 'Rating History',
  lineColor = '#1F8DD6',
}) => {
  const currentRating = data.length > 0 ? data[data.length - 1].rating : 0;
  const maxRating = data.length > 0 ? Math.max(...data.map((d) => d.rating)) : 0;

  const minVal = Math.max(0, Math.floor(Math.min(...data.map((d) => d.rating), 1000) / 100) * 100 - 100);

  return (
    <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-textPrimary">{title}</h3>
          <p className="text-[11px] text-textSecondary">Contest rating progression over time</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div>
            <span className="text-[10px] text-textSecondary uppercase font-semibold block">Current</span>
            <span className="font-extrabold text-brand-primary">{currentRating}</span>
          </div>
          <div className="h-6 w-px bg-borderLine" />
          <div>
            <span className="text-[10px] text-textSecondary uppercase font-semibold block">Max</span>
            <span className="font-extrabold text-green-600">{maxRating}</span>
          </div>
        </div>
      </div>

      <div className="h-48 w-full">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6B7280', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                domain={[minVal, 'auto']}
                tick={{ fill: '#6B7280', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const pt = payload[0].payload as RatingPoint;
                    return (
                      <div className="bg-gray-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-1">
                        <p className="font-bold">{pt.contestName || 'Contest'}</p>
                        <p className="text-textSecondary text-[10px]">{pt.date}</p>
                        <p className="font-extrabold text-brand-primary">Rating: {pt.rating}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="rating"
                stroke={lineColor}
                strokeWidth={2.5}
                dot={{ fill: lineColor, r: 4, strokeWidth: 2, stroke: '#FFFFFF' }}
                activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2, fill: '#FFFFFF' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-textSecondary">
            No contest history available yet.
          </div>
        )}
      </div>
    </div>
  );
};
