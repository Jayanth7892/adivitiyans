import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock } from 'lucide-react';

interface RefreshButtonProps {
  lastRefreshedAt: string | null;
  onRefresh: () => Promise<void>;
  cooldownSeconds?: number;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  lastRefreshedAt,
  onRefresh,
  cooldownSeconds = 120, // 2 minutes cooldown
}) => {
  const [loading, setLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setInterval(() => {
      setCooldownLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

  const handleClick = async () => {
    if (loading || cooldownLeft > 0) return;
    setLoading(true);
    try {
      await onRefresh();
      setCooldownLeft(cooldownSeconds);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading || cooldownLeft > 0}
        title={
          cooldownLeft > 0
            ? `Please wait ${cooldownLeft}s before refreshing again to prevent rate-limiting.`
            : 'Re-sync platform data'
        }
        className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${
          loading
            ? 'bg-textPrimary text-surface opacity-80 cursor-wait'
            : cooldownLeft > 0
            ? 'bg-borderLine text-textSecondary cursor-not-allowed'
            : 'bg-textPrimary text-surface hover:opacity-80 shadow-sm active:scale-95'
        }`}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        <span>
          {loading
            ? 'Syncing...'
            : cooldownLeft > 0
            ? `Wait ${cooldownLeft}s`
            : 'Refresh Data'}
        </span>
      </button>

      <div className="flex items-center gap-1 text-[11px] text-textSecondary">
        <Clock className="w-3 h-3 text-textSecondary/60" />
        <span>Last Refresh: {formatDate(lastRefreshedAt)}</span>
      </div>
    </div>
  );
};
