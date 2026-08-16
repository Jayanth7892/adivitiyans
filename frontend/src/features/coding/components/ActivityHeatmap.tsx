import React, { useState, useMemo } from 'react';

interface ActivityHeatmapProps {
  heatmapData?: Record<string, number>; // 'YYYY-MM-DD' or epoch -> count
  platformName?: string;
}

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  heatmapData = {},
  platformName = 'Platform',
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const years = [currentYear, currentYear - 1, currentYear - 2];

  // Normalize heatmapData keys to standard 'YYYY-MM-DD'
  const normalizedData = useMemo(() => {
    const map: Record<string, number> = {};
    if (!heatmapData) return map;

    Object.entries(heatmapData).forEach(([key, count]) => {
      const numCount = Number(count) || 0;
      if (numCount <= 0) return;

      if (/^\d{9,12}$/.test(key)) {
        // Unix epoch timestamp in seconds
        const d = new Date(Number(key) * 1000);
        const dateStr = formatLocalDate(d);
        map[dateStr] = (map[dateStr] || 0) + numCount;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(key)) {
        const dateStr = key.slice(0, 10);
        map[dateStr] = (map[dateStr] || 0) + numCount;
      } else {
        map[key] = (map[key] || 0) + numCount;
      }
    });
    return map;
  }, [heatmapData]);

  // Total submissions for selected year
  const totalSubmissionsInYear = useMemo(() => {
    return Object.entries(normalizedData).reduce((acc, [date, count]) => {
      if (date.startsWith(String(selectedYear))) {
        return acc + count;
      }
      return acc;
    }, 0);
  }, [normalizedData, selectedYear]);

  // Build grid for selected year (52+ weeks x 7 days)
  const weeks = useMemo(() => {
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);

    const startDayOfWeek = startDate.getDay();
    const adjustedStart = new Date(startDate);
    adjustedStart.setDate(adjustedStart.getDate() - startDayOfWeek);

    const result: Array<Array<{ dateStr: string; count: number; date: Date }>> = [];
    let curr = new Date(adjustedStart);
    const MAX_WEEKS = 54;

    while (result.length < MAX_WEEKS) {
      const week: Array<{ dateStr: string; count: number; date: Date }> = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = formatLocalDate(curr);
        const isTargetYear = curr.getFullYear() === selectedYear;
        const count = isTargetYear ? (normalizedData[dateStr] || 0) : 0;
        week.push({ dateStr, count, date: new Date(curr) });
        curr.setDate(curr.getDate() + 1);
      }
      result.push(week);
      if (curr > endDate && result.length >= 52) break;
    }
    return result;
  }, [selectedYear, normalizedData]);

  const maxCount = useMemo(() => {
    const counts = Object.values(normalizedData);
    return counts.length > 0 ? Math.max(1, ...counts) : 1;
  }, [normalizedData]);

  const getDotColor = (count: number) => {
    if (count === 0) return 'rgba(148, 163, 184, 0.2)'; // neutral muted dot
    const pct = count / maxCount;
    if (pct < 0.25) return '#86EFAC';
    if (pct < 0.5) return '#4ADE80';
    if (pct < 0.75) return '#22C55E';
    return '#16A34A'; // Rich emerald green
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-xs space-y-4">
      {/* Title & Dropdown Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-textPrimary">
          {totalSubmissionsInYear} submissions in {selectedYear}
        </h3>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-3 py-1 text-xs rounded-xl border border-borderLine bg-background text-textPrimary font-semibold focus:outline-none cursor-pointer"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Dots Heatmap Grid with Horizontal Scroll */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px]">
          {/* Months Row */}
          <div className="flex text-[10px] font-medium text-textSecondary mb-2 pl-9">
            {months.map((m, i) => (
              <div key={i} className="flex-1 text-left">
                {m}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {/* Days of Week Column */}
            <div className="flex flex-col justify-between text-[9px] font-semibold text-textSecondary py-0.5 w-7">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Dots Grid */}
            <div className="flex gap-1 flex-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1 flex-1 items-center">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      title={`${day.dateStr}: ${day.count} submission${day.count === 1 ? '' : 's'}`}
                      className="w-2.5 h-2.5 rounded-full transition-transform hover:scale-150 cursor-pointer"
                      style={{ backgroundColor: getDotColor(day.count) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
