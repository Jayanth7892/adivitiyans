import React, { useState } from 'react';
import { ExternalLink, CheckCircle2, Clock, Trophy, GitCommit, GitPullRequest } from 'lucide-react';

export interface ActivityItem {
  date: string;
  title: string;
  status?: string;
  type?: string;
}

interface ActivityTabsProps {
  tabs: string[];
  activities: ActivityItem[];
}

export const ActivityTabs: React.FC<ActivityTabsProps> = ({
  tabs,
  activities,
}) => {
  const [activeTab, setActiveTab] = useState(tabs[0] || 'Recent Activity');

  // Filter activity based on active tab
  const filteredActivities = activities.filter((act) => {
    if (tabs.length === 1) return true;
    if (activeTab.toLowerCase().includes('contest')) {
      return act.type === 'contest';
    }
    if (activeTab.toLowerCase().includes('commit')) {
      return act.type === 'push' || act.type === 'commit';
    }
    if (activeTab.toLowerCase().includes('pull request') || activeTab.toLowerCase().includes('pr')) {
      return act.type === 'pr';
    }
    return act.type !== 'contest' && act.type !== 'pr';
  });

  const getItemIcon = (type?: string) => {
    if (type === 'contest') return <Trophy className="w-4 h-4 text-amber-500" />;
    if (type === 'push' || type === 'commit') return <GitCommit className="w-4 h-4 text-purple-500" />;
    if (type === 'pr') return <GitPullRequest className="w-4 h-4 text-green-500" />;
    return <CheckCircle2 className="w-4 h-4 text-brand-primary" />;
  };

  return (
    <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm space-y-4">
      {/* Sub-tab Switcher Header */}
      <div className="flex items-center justify-between border-b border-borderLine pb-3">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab
                  ? 'bg-brand-soft text-brand-primary border border-brand-primary/20 shadow-sm'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-background'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-semibold text-textSecondary">
          {filteredActivities.length} items
        </span>
      </div>

      {/* Activity List */}
      {filteredActivities.length > 0 ? (
        <div className="divide-y divide-borderLine border border-borderLine rounded-xl overflow-hidden bg-background/40">
          {filteredActivities.map((act, i) => (
            <div
              key={i}
              className="p-3 flex items-center justify-between gap-4 hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-surface border border-borderLine shrink-0 shadow-2xs">
                  {getItemIcon(act.type)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-textPrimary truncate">
                    {act.title}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-textSecondary mt-0.5">
                    <Clock className="w-3 h-3 text-textSecondary/60" />
                    <span>{act.date}</span>
                  </div>
                </div>
              </div>

              {act.status && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                    act.status.toLowerCase().includes('accepted') ||
                    act.status.toLowerCase().includes('merged') ||
                    act.status.toLowerCase().includes('completed')
                      ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                      : act.status.toLowerCase().includes('exceeded') ||
                        act.status.toLowerCase().includes('wrong')
                      ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                      : 'bg-brand-soft text-brand-primary border border-brand-primary/20'
                  }`}
                >
                  {act.status}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-textSecondary border border-dashed border-borderLine rounded-xl">
          No recent activity found under "{activeTab}".
        </div>
      )}
    </div>
  );
};
