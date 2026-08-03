import React from 'react';
import { ExternalLink, Trophy, Code2, Flame, Award } from 'lucide-react';
import { PlatformConfig, PlatformStatsSnapshot } from '../platformData';
import { RefreshButton } from './RefreshButton';
import { DonutBreakdown } from './DonutBreakdown';
import { RatingLineChart } from './RatingLineChart';
import { AwardsPanel } from './AwardsPanel';
import { ActivityHeatmap } from './ActivityHeatmap';
import { TopicBarChart } from './TopicBarChart';
import { ActivityTabs } from './ActivityTabs';

interface PlatformStatsPageProps {
  config: PlatformConfig;
  snapshot: PlatformStatsSnapshot;
  onRefresh: () => Promise<void>;
}

export const PlatformStatsPage: React.FC<PlatformStatsPageProps> = ({
  config,
  snapshot,
  onRefresh,
}) => {
  return (
    <div className="space-y-6">
      {/* 3.1 Top Right Controls (Refresh Data Button + Last Refresh) */}
      <div className="flex justify-end pr-1">
        <RefreshButton
          lastRefreshedAt={snapshot.lastRefreshedAt}
          onRefresh={onRefresh}
        />
      </div>

      {/* 3.2 KPI Stat Card Row (3 Cards Side-by-Side) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {snapshot.kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-surface border border-borderLine rounded-2xl p-5 shadow-xs flex items-start justify-between"
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold text-textSecondary">
                {kpi.label}
              </p>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-textPrimary">
                  {kpi.value}
                </h3>
                {kpi.isLink && snapshot.profileUrl && (
                  <a
                    href={snapshot.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-textSecondary hover:text-[#1E65FF] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Icon Box */}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                idx === 0
                  ? 'bg-purple-600'
                  : idx === 1
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
            >
              {idx === 0 ? (
                <Code2 className="w-4 h-4" />
              ) : idx === 1 ? (
                <Trophy className="w-4 h-4" />
              ) : (
                <Flame className="w-4 h-4" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 3.3 Primary Visualization Row (Two Columns: Left Donut/Rating, Right Awards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Wider ~ 7 cols) */}
        <div className="lg:col-span-7">
          {config.primaryVizType === 'rating-history' && snapshot.ratingHistory ? (
            <RatingLineChart
              data={snapshot.ratingHistory}
              title={`${config.name} Rating History`}
              lineColor={config.color}
            />
          ) : config.primaryVizType === 'contribution-heatmap' ? (
            <ActivityHeatmap
              heatmapData={snapshot.heatmap}
              platformName={config.name}
            />
          ) : (
            <DonutBreakdown
              items={snapshot.breakdown || []}
              title="DSA Problems Solved"
            />
          )}
        </div>

        {/* Right Column (Narrower ~ 5 cols) */}
        <div className="lg:col-span-5">
          <AwardsPanel
            awards={snapshot.awards}
            title="Awards"
          />
        </div>
      </div>

      {/* 3.4 Activity Heatmap */}
      {config.primaryVizType !== 'contribution-heatmap' && (
        <ActivityHeatmap
          heatmapData={snapshot.heatmap}
          platformName={config.name}
        />
      )}

      {/* 3.5 Topic/Category Analysis */}
      <TopicBarChart
        data={snapshot.topicAnalysis}
        title={config.topicLabel}
        barColor="#1E293B"
      />

      {/* 3.6 Recent Activity */}
      <ActivityTabs
        tabs={config.activityTabs}
        activities={snapshot.activity}
      />
    </div>
  );
};
