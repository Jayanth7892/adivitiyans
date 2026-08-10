import React, { useState } from 'react';

interface ActivityHeatmapProps {
  heatmapData: Record<string, number>; // 'YYYY-MM-DD' -> count
  platformName?: string;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  heatmapData,
  platformName = 'Platform',
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const years = [currentYear, currentYear - 1, currentYear - 2];

  // Total submissions for selected year
  const totalSubmissionsInYear = Object.entries(heatmapData).reduce(
    (acc, [date, count]) => {
      if (date.startsWith(String(selectedYear))) {
        return acc + count;
      }
      return acc;
    },
    0
  );

  // Build grid for selected year (52 weeks x 7 days)
  const startDate = new Date(selectedYear, 0, 1);
  const endDate = new Date(selectedYear, 11, 31);

  const startDayOfWeek = startDate.getDay();
  const adjustedStart = new Date(startDate);
  adjustedStart.setDate(adjustedStart.getDate() - startDayOfWeek);

  const weeks: Array<Array<{ dateStr: string; count: number; date: Date }>> = [];
  let curr = new Date(adjustedStart);
  const MAX_WEEKS = 54;

  while (weeks.length < MAX_WEEKS) {
    const week: Array<{ dateStr: string; count: number; date: Date }> = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = curr.toISOString().slice(0, 10);
      const isTargetYear = curr.getFullYear() === selectedYear;
      const count = isTargetYear ? (heatmapData[dateStr] || 0) : 0;
      week.push({ dateStr, count, date: new Date(curr) });
      curr.setDate(curr.getDate() + 1);
    }
    weeks.push(week);
    // Stop once we've passed the end of the year and have at least 52 weeks
    if (curr > endDate && weeks.length >= 52) break;
  }

  const maxCount = Math.max(1, ...Object.values(heatmapData));

  const getDotColor = (count: number) => {
    if (count === 0) return '#E2E8F0'; // Light gray dot matching BytsOne
    const pct = count / maxCount;
    if (pct < 0.3) return '#86EFAC';
    if (pct < 0.6) return '#4ADE80';
    return '#22C55E'; // Vibrant green
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-xs space-y-4">
      {/* Title & Dropdown Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-textPrimary">
          {totalSubmissionsInYear} submissions in the {selectedYear}
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
                      title={`${day.dateStr}: ${day.count} submissions`}
                      className="w-2.5 h-2.5 rounded-full transition-transform hover:scale-125 cursor-pointer"
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
