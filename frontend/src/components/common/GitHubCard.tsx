import React, { useState } from 'react';
import { ExternalLink, Loader2, AlertCircle, RefreshCw, Github, Star, GitFork } from 'lucide-react';

export interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
}

export interface GitHubProfile {
  username: string;
  name: string;
  bio: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
  location: string | null;
  blog: string | null;
  totalStars: number;
  topRepos: GitHubRepo[];
  languages: Record<string, number>; // lang -> byte count
}

async function fetchGitHubProfile(username: string): Promise<GitHubProfile> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=30`, { headers }),
  ]);

  if (!userRes.ok) throw new Error('GitHub user not found. Check your username and try again.');
  const user = await userRes.json();
  const repos: GitHubRepo[] = reposRes.ok ? await reposRes.json() : [];

  // Aggregate language stats across all repos
  const langCounts: Record<string, number> = {};
  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);

  // Simple per-repo language count (full byte breakdown needs per-repo API calls — skip to keep fast)
  repos.forEach((r) => {
    if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  });

  const topRepos = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5);

  return {
    username,
    name: user.name || username,
    bio: user.bio || null,
    avatar_url: user.avatar_url,
    public_repos: user.public_repos,
    followers: user.followers,
    following: user.following,
    location: user.location,
    blog: user.blog,
    totalStars,
    topRepos,
    languages: langCounts,
  };
}

// Language color map
const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3776ab', Java: '#ed8b00',
  'C++': '#00599c', C: '#a8b9cc', Go: '#00add8', Rust: '#dea584', PHP: '#777bb4',
  Ruby: '#cc342d', Swift: '#fa7343', Kotlin: '#f18e33', HTML: '#e34f26', CSS: '#1572b6',
  Dart: '#0175c2', 'C#': '#178600', Shell: '#89e051', Jupyter: '#f37626',
};

function LanguageBar({ languages }: { languages: Record<string, number> }) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const sorted = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div>
      {/* Stacked bar */}
      <div className="h-2 rounded-full flex overflow-hidden gap-[1px]">
        {sorted.map(([lang, count]) => (
          <div key={lang} className="h-full transition-all duration-700"
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: LANG_COLORS[lang] || '#8B949E',
              minWidth: 2,
            }} />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {sorted.map(([lang, count]) => (
          <div key={lang} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: LANG_COLORS[lang] || '#8B949E' }} />
            <span className="text-[10px] text-textSecondary font-medium">{lang}</span>
            <span className="text-[10px] text-textSecondary">({((count / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface GitHubCardProps {
  initialUsername?: string;
  onUsernameChange?: (username: string) => void;
}

export const GitHubCard: React.FC<GitHubCardProps> = ({ initialUsername = '', onUsernameChange }) => {
  const [inputVal, setInputVal] = useState(initialUsername);
  const [profile, setProfile] = useState<GitHubProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    const u = inputVal.trim();
    if (!u) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchGitHubProfile(u);
      setProfile(data);
      onUsernameChange?.(u);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch GitHub profile.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchGitHubProfile(profile.username);
      setProfile(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-borderLine rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-borderLine bg-gray-900/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
            <Github className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-textPrimary">GitHub Analytics</h3>
            {profile && <p className="text-[11px] text-textSecondary">@{profile.username}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile && (
            <button onClick={handleRefresh} disabled={loading}
              className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-background transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {profile && (
            <a href={`https://github.com/${profile.username}`} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-background transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            placeholder="Enter GitHub username..."
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
          <button
            onClick={handleConnect}
            disabled={loading || !inputVal.trim()}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-gray-900 text-white transition-all hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {loading && !profile && (
          <div className="flex items-center justify-center py-8 gap-2 text-textSecondary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Fetching GitHub profile...</span>
          </div>
        )}

        {profile && (
          <>
            {/* User info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-borderLine">
              <img src={profile.avatar_url} alt={profile.name}
                className="w-12 h-12 rounded-full border-2 border-borderLine shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-textPrimary truncate">{profile.name}</p>
                {profile.bio && <p className="text-xs text-textSecondary truncate">{profile.bio}</p>}
                {profile.location && <p className="text-[11px] text-textSecondary">📍 {profile.location}</p>}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Repos', value: profile.public_repos },
                { label: 'Stars', value: profile.totalStars },
                { label: 'Followers', value: profile.followers },
                { label: 'Following', value: profile.following },
              ].map(({ label, value }) => (
                <div key={label} className="p-2.5 rounded-xl bg-background border border-borderLine text-center">
                  <p className="text-sm font-black text-textPrimary">{value}</p>
                  <p className="text-[10px] text-textSecondary mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Language breakdown */}
            {Object.keys(profile.languages).length > 0 && (
              <div className="p-4 rounded-xl bg-background border border-borderLine">
                <p className="text-xs font-bold text-textPrimary mb-3">Top Languages</p>
                <LanguageBar languages={profile.languages} />
              </div>
            )}

            {/* Top repos */}
            {profile.topRepos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-textPrimary">Top Repositories</p>
                {profile.topRepos.map((repo) => (
                  <a key={repo.name} href={repo.html_url} target="_blank" rel="noreferrer"
                    className="block p-3 rounded-xl bg-background border border-borderLine hover:border-brand-primary hover:shadow-sm transition-all group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-brand-primary group-hover:underline truncate">{repo.name}</p>
                        {repo.description && (
                          <p className="text-[11px] text-textSecondary line-clamp-1 mt-0.5">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {repo.language && (
                            <span className="flex items-center gap-1 text-[10px] text-textSecondary">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: LANG_COLORS[repo.language] || '#8B949E' }} />
                              {repo.language}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5 text-[10px] text-textSecondary">
                            <Star className="w-3 h-3" />{repo.stargazers_count}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-textSecondary">
                            <GitFork className="w-3 h-3" />{repo.forks_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
