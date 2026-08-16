import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PLATFORM_CONFIGS,
  PlatformId,
  PlatformStatsSnapshot,
} from './platformData';
import { fetchLivePlatformSnapshot } from './liveFetchers';
import { PlatformSwitcher } from './components/PlatformSwitcher';
import { PlatformStatsPage } from './components/PlatformStatsPage';
import { PillButton } from '../../components/common/PillButton';
import { Plus, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface CodingProfilesSectionProps {
  onRefreshAll?: () => void;
  studentName?: string;
  studentRollNumber?: string;
  readOnly?: boolean;
}

export const CodingProfilesSection: React.FC<CodingProfilesSectionProps> = ({
  onRefreshAll,
  studentName: customStudentName,
  studentRollNumber,
  readOnly = false,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const activeRollNo = studentRollNumber || user?.rollNumber || '';

  // Fetch real student profile from API
  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['studentProfile', activeRollNo],
    queryFn: () => api.getStudentProfile(activeRollNo),
    enabled: Boolean(activeRollNo),
  });

  // Fetch real linked handles from API
  const { data: linkedProfiles = [], isLoading: profilesLoading, refetch: refetchCodingProfiles } = useQuery({
    queryKey: ['codingProfiles', activeRollNo],
    queryFn: () => api.getCodingProfiles(activeRollNo),
    enabled: Boolean(activeRollNo),
  });

  const activeStudentName = customStudentName || student?.name || user?.name || 'Student';
  const studentInitials = activeStudentName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'S';

  const platformParam = (searchParams.get('platform') as PlatformId) || 'coding-stats';

  const [activePlatform, setActivePlatform] = useState<PlatformId>(
    PLATFORM_CONFIGS.some((p) => p.id === platformParam) ? platformParam : 'coding-stats'
  );

  // Keep activePlatform in sync with searchParams URL updates
  useEffect(() => {
    if (platformParam && PLATFORM_CONFIGS.some((p) => p.id === platformParam)) {
      setActivePlatform(platformParam);
    }
  }, [platformParam]);

  // Live platform snapshots store
  const [snapshots, setSnapshots] = useState<Partial<Record<PlatformId, PlatformStatsSnapshot>>>({});
  const [loadingPlatform, setLoadingPlatform] = useState<boolean>(false);

  // Add/Link handle Modal state
  const [linkingPlatformId, setLinkingPlatformId] = useState<PlatformId | null>(null);
  const [handleInput, setHandleInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Synchronize snapshots whenever linkedProfiles or student data changes.
  // IMPORTANT: skip the effect entirely while either query is still in-flight.
  // Without this guard, the very first render fires with linkedProfiles=[] and
  // student=undefined, shows the "link account" empty state, and then never
  // re-shows the loading indicator — causing a permanent-looking blank screen
  // until the page is refreshed.
  useEffect(() => {
    // While either query is still loading, just show the loading spinner and wait.
    // The effect will re-run once isLoading flips to false.
    if (studentLoading || profilesLoading) {
      setLoadingPlatform(true);
      return;
    }

    let isMounted = true;

    async function loadLiveSnapshots() {
      const activeList: any[] = linkedProfiles && linkedProfiles.length > 0 ? [...linkedProfiles] : [];

      if (student) {
        const checkAndAdd = (platformName: string, handleValue: any) => {
          if (handleValue && handleValue !== 'Not Linked' && String(handleValue).trim() !== '') {
            const cleanHandle = String(handleValue).trim();
            const exists = activeList.some((p: any) => String(p.platform).toLowerCase() === platformName.toLowerCase());
            if (!exists) {
              activeList.push({ platform: platformName, handle: cleanHandle });
            }
          }
        };
        checkAndAdd('LeetCode', (student as any).leetcode_handle || (student as any).leetcode);
        checkAndAdd('GitHub', (student as any).github_handle || (student as any).github);
        checkAndAdd('Codeforces', (student as any).codeforces_handle || (student as any).codeforces);
        checkAndAdd('CodeChef', (student as any).codechef_handle || (student as any).codechef);
        checkAndAdd('GeeksforGeeks', (student as any).geeksforgeeks_handle || (student as any).geeksforgeeks);
        checkAndAdd('HackerRank', (student as any).hackerrank_handle || (student as any).hackerrank);
      }

      setLoadingPlatform(true);
      const newSnapshots: Partial<Record<PlatformId, PlatformStatsSnapshot>> = {};

      for (const item of activeList) {
        const pId = item.platform.toLowerCase().replace(/\s+/g, '') as PlatformId;
        const normalizedId: PlatformId =
          pId === 'leetcode' ? 'leetcode' :
          pId === 'github' ? 'github' :
          pId === 'codeforces' ? 'codeforces' :
          pId === 'codechef' ? 'codechef' :
          pId === 'geeksforgeeks' ? 'geeksforgeeks' :
          pId === 'hackerrank' ? 'hackerrank' : 'coding-stats';

        if (item.handle) {
          try {
            const liveData = await fetchLivePlatformSnapshot(normalizedId, item.handle);
            newSnapshots[normalizedId] = liveData;
          } catch (e) {
            console.error(`Failed to fetch live data for ${normalizedId}:`, e);
          }
        }
      }

      // Generate Overview snapshot if at least 1 platform is linked
      const linkedKeys = Object.keys(newSnapshots) as PlatformId[];
      if (linkedKeys.length > 0) {
        let grandTotalSolved = 0;
        const breakdownItems: any[] = [];
        const mergedAwards: any[] = [];
        const mergedHeatmap: Record<string, number> = {};
        const mergedActivities: any[] = [];

        linkedKeys.forEach((key) => {
          const snap = newSnapshots[key];
          if (snap) {
            const solved = typeof snap.kpis[0]?.value === 'number' ? snap.kpis[0].value : 0;
            grandTotalSolved += solved;

            const config = PLATFORM_CONFIGS.find((p) => p.id === key);
            breakdownItems.push({
              label: config?.name || key,
              solved,
              total: 1000,
              color: config?.color || '#5B4FE9',
            });

            if (snap.awards) mergedAwards.push(...snap.awards);
            if (snap.activity) mergedActivities.push(...snap.activity);

            if (snap.heatmap) {
              Object.entries(snap.heatmap).forEach(([dateStr, count]) => {
                mergedHeatmap[dateStr] = (mergedHeatmap[dateStr] || 0) + Number(count || 0);
              });
            }
          }
        });

        newSnapshots['coding-stats'] = {
          platform: 'coding-stats',
          handle: activeStudentName,
          profileUrl: '',
          lastRefreshedAt: new Date().toISOString(),
          syncStatus: 'synced',
          kpis: [
            { label: 'Total Problems Solved Across Platforms', value: grandTotalSolved },
            { label: 'Connected Profiles', value: linkedKeys.length },
          ],
          breakdown: breakdownItems,
          awards: mergedAwards,
          topicAnalysis: [
            { label: 'Problem Solving', count: grandTotalSolved },
          ],
          activity: mergedActivities.slice(0, 15),
          heatmap: mergedHeatmap,
        };
      }

      if (isMounted) {
        setSnapshots(newSnapshots);
        setLoadingPlatform(false);
      }
    }

    loadLiveSnapshots();

    return () => {
      isMounted = false;
    };
  }, [linkedProfiles, student, studentLoading, profilesLoading, activeStudentName]);

  const handleSelectPlatform = (id: PlatformId) => {
    setActivePlatform(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'coding-profiles');
      next.set('platform', id);
      return next;
    });
  };

  const handleRefreshPlatform = async (id: PlatformId) => {
    const existing = snapshots[id];
    if (!existing || !existing.handle) return;

    setLoadingPlatform(true);
    try {
      const updated = await fetchLivePlatformSnapshot(id, existing.handle);
      setSnapshots((prev) => ({
        ...prev,
        [id]: updated,
      }));
      onRefreshAll?.();
    } catch (e: any) {
      alert(`Could not refresh ${id}: ${e.message}`);
    } finally {
      setLoadingPlatform(false);
    }
  };

  const handleSaveHandle = async () => {
    if (!linkingPlatformId || !handleInput.trim() || readOnly) return;
    setSaving(true);
    try {
      const targetId = linkingPlatformId === 'coding-stats' ? 'leetcode' : linkingPlatformId;
      const platformConfig = PLATFORM_CONFIGS.find((p) => p.id === targetId);

      const validPlatformEnumMap: Record<string, string> = {
        'github': 'GitHub',
        'leetcode': 'LeetCode',
        'geeksforgeeks': 'GeeksforGeeks',
        'hackerrank': 'HackerRank',
        'codeforces': 'Codeforces',
        'codechef': 'CodeChef',
        'kaggle': 'Kaggle',
      };

      const platformName = platformConfig?.name || 'LeetCode';
      const finalPlatformEnum = validPlatformEnumMap[targetId.toLowerCase()] || (platformName === 'Coding Stats' ? 'LeetCode' : platformName);

      // ── Sanitize handle: strip full profile URLs, keep only the username ──────
      // Users sometimes paste the full profile URL (e.g. https://github.com/user)
      // instead of just the username. Strip known URL prefixes for all platforms.
      const urlStripPatterns: Record<string, RegExp[]> = {
        github:        [/^https?:\/\/(www\.)?github\.com\//i],
        leetcode:      [/^https?:\/\/(www\.)?leetcode\.com\//i],
        geeksforgeeks: [
          /^https?:\/\/(www\.)?geeksforgeeks\.org\/profile\//i,
          /^https?:\/\/(www\.)?geeksforgeeks\.org\/user\//i,
          /^https?:\/\/auth\.geeksforgeeks\.org\/user\//i,
        ],
        codeforces:    [/^https?:\/\/(www\.)?codeforces\.com\/profile\//i],
        codechef:      [/^https?:\/\/(www\.)?codechef\.com\/users\//i],
        hackerrank:    [
          /^https?:\/\/(www\.)?hackerrank\.com\/profile\//i,
          /^https?:\/\/(www\.)?hackerrank\.com\//i,
        ],
        kaggle:        [/^https?:\/\/(www\.)?kaggle\.com\//i],
      };

      let sanitizedHandle = handleInput.trim().replace(/^@/, '');
      const patterns = urlStripPatterns[targetId.toLowerCase()] || [];
      for (const p of patterns) { sanitizedHandle = sanitizedHandle.replace(p, ''); }
      sanitizedHandle = sanitizedHandle.replace(/\/$/, '').trim();

      if (!sanitizedHandle) {
        alert('Please enter a valid username (not just a URL).');
        setSaving(false);
        return;
      }

      // Persist to backend API
      await api.saveCodingProfile(activeRollNo, {
        platform: finalPlatformEnum as any,
        handle: sanitizedHandle,
        streak: 0,
        repositories_count: 0,
        commits_count: 0,
        prs_merged: 0,
        score_rating: 0,
      });


      // Refetch profiles to update UI dynamically
      await refetchCodingProfiles();
      handleSelectPlatform(targetId);
      setLinkingPlatformId(null);
      setHandleInput('');
    } catch (e: any) {
      alert('Failed to save platform handle: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHandle = async () => {
    if (!linkingPlatformId || readOnly) return;
    if (!confirm(`Are you sure you want to remove your ${linkingPlatformId.toUpperCase()} profile link?`)) return;
    setSaving(true);
    try {
      await api.deleteCodingProfile(activeRollNo, linkingPlatformId);
      await refetchCodingProfiles();
      setSnapshots((prev) => {
        const copy = { ...prev };
        delete copy[linkingPlatformId];
        return copy;
      });
      setLinkingPlatformId(null);
      setHandleInput('');
    } catch (e: any) {
      alert('Failed to remove platform handle: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const currentConfig = PLATFORM_CONFIGS.find((p) => p.id === activePlatform) || PLATFORM_CONFIGS[0];
  const currentSnapshot = snapshots[activePlatform];

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      {/* Sub-navigation (Platform Switcher Sidebar) */}
      <PlatformSwitcher
        platforms={PLATFORM_CONFIGS}
        linkedSnapshots={snapshots}
        activePlatform={activePlatform}
        studentName={activeStudentName}
        studentInitials={studentInitials}
        readOnly={readOnly}
        onSelectPlatform={handleSelectPlatform}
        onLinkPlatform={(id) => {
          if (!readOnly) {
            const targetId = id === 'coding-stats' ? 'leetcode' : id;
            setLinkingPlatformId(targetId);
            setHandleInput(snapshots[targetId]?.handle || '');
          }
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 w-full">
        {loadingPlatform && !currentSnapshot ? (
          <div className="bg-surface border border-borderLine rounded-2xl p-12 text-center shadow-xs flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#1E65FF] animate-spin" />
            <p className="text-sm font-semibold text-textPrimary">
              Fetching real-time data for {currentConfig.name}...
            </p>
            <p className="text-xs text-textSecondary">Connecting to public APIs</p>
          </div>
        ) : currentSnapshot ? (
          <PlatformStatsPage
            key={activePlatform}
            config={currentConfig}
            snapshot={currentSnapshot}
            onRefresh={() => handleRefreshPlatform(activePlatform)}
            onEditHandle={() => {
              setLinkingPlatformId(activePlatform);
              setHandleInput(currentSnapshot.handle || '');
            }}
            readOnly={readOnly}
          />
        ) : (
          /* Unlinked Platform State */
          <div className="bg-surface border border-borderLine rounded-2xl p-10 text-center shadow-xs space-y-4">
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-sm"
              style={{ backgroundColor: currentConfig.bgColor }}
            >
              {currentConfig.emoji}
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-textPrimary">
                {currentConfig.name} Profile Not Connected
              </h3>
              <p className="text-xs text-textSecondary max-w-md mx-auto mt-1">
                {readOnly
                  ? `No ${currentConfig.name} handle linked by ${activeStudentName} yet.`
                  : `Link your real ${currentConfig.name} handle to automatically fetch live solved counts, contest ratings, activity heatmaps, and badges.`}
              </p>
            </div>

            {!readOnly && (
              <div className="pt-2">
                <PillButton
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setLinkingPlatformId(currentConfig.id === 'coding-stats' ? 'leetcode' : currentConfig.id);
                    setHandleInput('');
                  }}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Connect {currentConfig.name} Handle
                </PillButton>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connect / Edit Handle Modal */}
      {linkingPlatformId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{
                  backgroundColor:
                    PLATFORM_CONFIGS.find((p) => p.id === linkingPlatformId)?.bgColor || '#EEF2FF',
                }}
              >
                {PLATFORM_CONFIGS.find((p) => p.id === linkingPlatformId)?.emoji}
              </div>
              <div>
                <h3 className="text-base font-bold text-textPrimary">
                  {snapshots[linkingPlatformId]?.handle ? 'Update' : 'Connect'} {PLATFORM_CONFIGS.find((p) => p.id === linkingPlatformId)?.name} Handle
                </h3>
                <p className="text-xs text-textSecondary">
                  Enter your official platform username / handle
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-textPrimary mb-1">
                Handle / Username *
              </label>
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveHandle()}
                placeholder={`e.g. ${linkingPlatformId}_handle`}
                className="w-full px-3 py-2 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-[#1E65FF]/30 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-borderLine">
              {snapshots[linkingPlatformId]?.handle && (
                <button
                  type="button"
                  onClick={handleDeleteHandle}
                  disabled={saving}
                  className="text-xs text-red-600 font-semibold hover:underline mr-auto"
                >
                  Unlink Handle
                </button>
              )}
              <PillButton
                variant="outline"
                size="sm"
                onClick={() => setLinkingPlatformId(null)}
              >
                Cancel
              </PillButton>
              <PillButton
                variant="primary"
                size="sm"
                onClick={handleSaveHandle}
                disabled={saving || !handleInput.trim()}
              >
                {saving ? 'Saving...' : snapshots[linkingPlatformId]?.handle ? 'Update Handle' : 'Connect Profile'}
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
