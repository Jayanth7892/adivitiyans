// ─── Platform Stats Types ───────────────────────────────────────────────────

export type PlatformId =
  | 'coding-stats'
  | 'github'
  | 'leetcode'
  | 'geeksforgeeks'
  | 'hackerrank'
  | 'codeforces'
  | 'codechef';

export interface PlatformStatsSnapshot {
  platform: PlatformId;
  handle: string;
  profileUrl: string;
  lastRefreshedAt: string | null;
  syncStatus: 'synced' | 'pending' | 'failed';
  kpis: { label: string; value: string | number; isLink?: boolean }[];
  breakdown?: { label: string; solved: number; total: number; color: string }[];
  ratingHistory?: { date: string; rating: number; contestName?: string }[];
  awards: { title: string; icon: string; earnedAt?: string }[];
  topicAnalysis: { label: string; count: number }[];
  activity: { date: string; title: string; status?: string; type?: string }[];
  heatmap: Record<string, number>; // 'YYYY-MM-DD' → count
}

// ─── Platform Visual Config ─────────────────────────────────────────────────
export interface PlatformConfig {
  id: PlatformId;
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  emoji: string;
  profileBaseUrl: string;
  primaryVizType: 'donut' | 'rating-history' | 'contribution-heatmap';
  topicLabel: string;
  activityTabs: string[];
  description: string;
}

export const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    id: 'coding-stats',
    name: 'Coding Stats',
    shortName: 'Overview',
    color: '#5B4FE9',
    bgColor: '#EEF2FF',
    emoji: '📊',
    profileBaseUrl: '',
    primaryVizType: 'donut',
    topicLabel: 'Combined Topic Analysis',
    activityTabs: ['Recent Activity'],
    description: 'Aggregated live coding activity across all connected platforms',
  },
  {
    id: 'github',
    name: 'GitHub',
    shortName: 'GitHub',
    color: '#24292E',
    bgColor: '#F6F8FA',
    emoji: '🐙',
    profileBaseUrl: 'https://github.com/',
    primaryVizType: 'contribution-heatmap',
    topicLabel: 'Language Breakdown',
    activityTabs: ['Recent Commits', 'Pull Requests'],
    description: 'Open source contributions, repos, and collaboration activity',
  },
  {
    id: 'leetcode',
    name: 'LeetCode',
    shortName: 'LeetCode',
    color: '#FFA116',
    bgColor: '#FFF8ED',
    emoji: '⚡',
    profileBaseUrl: 'https://leetcode.com/',
    primaryVizType: 'donut',
    topicLabel: 'DSA Topic Analysis',
    activityTabs: ['Recent Submissions', 'Contests'],
    description: 'Competitive programming and technical interview preparation',
  },
  {
    id: 'geeksforgeeks',
    name: 'GeeksforGeeks',
    shortName: 'GfG',
    color: '#2F8D46',
    bgColor: '#EDFAF1',
    emoji: '🌿',
    profileBaseUrl: 'https://auth.geeksforgeeks.org/user/',
    primaryVizType: 'donut',
    topicLabel: 'Topic-wise Problems',
    activityTabs: ['Recent Submissions'],
    description: 'DSA problems, articles, and institute ranking',
  },
  {
    id: 'hackerrank',
    name: 'HackerRank',
    shortName: 'HackerRank',
    color: '#00EA64',
    bgColor: '#E6FFF4',
    emoji: '🏆',
    profileBaseUrl: 'https://www.hackerrank.com/',
    primaryVizType: 'donut',
    topicLabel: 'Domain Skill Breakdown',
    activityTabs: ['Recent Submissions'],
    description: 'Badges, certifications, and domain-wise skill tracks',
  },
  {
    id: 'codeforces',
    name: 'Codeforces',
    shortName: 'CF',
    color: '#1F8DD6',
    bgColor: '#EBF5FC',
    emoji: '🔵',
    profileBaseUrl: 'https://codeforces.com/profile/',
    primaryVizType: 'rating-history',
    topicLabel: 'Problem Tags Solved',
    activityTabs: ['Recent Submissions', 'Contest History'],
    description: 'Competitive programming rating, contests, and problem solving',
  },
  {
    id: 'codechef',
    name: 'CodeChef',
    shortName: 'CC',
    color: '#5B4638',
    bgColor: '#FBF5F2',
    emoji: '🍴',
    profileBaseUrl: 'https://www.codechef.com/users/',
    primaryVizType: 'rating-history',
    topicLabel: 'Problem Breakdown',
    activityTabs: ['Recent Submissions', 'Contest History'],
    description: 'Monthly contests, long challenges, and coding rating',
  },
];
