import React from 'react';

// Maps shorthand accent keys to CSS colors
const ACCENT_MAP: Record<string, string> = {
  brand: 'var(--color-brand-primary)',
  success: 'var(--color-success)',
  amber: '#F59E0B',
  indigo: '#6366F1',
  alert: 'var(--color-alert)',
  sky: '#0EA5E9',
};

interface StatCardProps {
  icon: React.ReactNode;
  iconBgColor?: string;
  label: string;
  value: string | number;
  subtext?: string;
  onClick?: () => void;
  accentColor?: string; // e.g. 'brand', 'success', 'amber', 'indigo', or any CSS color
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconBgColor = 'bg-brand-soft text-brand-primary',
  label,
  value,
  subtext,
  onClick,
  accentColor,
}) => {
  const accentCss = accentColor
    ? (ACCENT_MAP[accentColor] ?? accentColor)
    : undefined;

  return (
    <div
      onClick={onClick}
      className={`relative bg-surface border border-borderLine rounded-2xl p-5 overflow-hidden transition-all ${
        onClick ? 'hover:border-brand-primary hover:shadow-md cursor-pointer' : 'shadow-xs'
      }`}
    >
      {/* Top accent line — colour matches the icon */}
      {accentCss && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ background: accentCss }}
        />
      )}

      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl shrink-0 ${iconBgColor}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[11px] font-semibold text-textSecondary uppercase tracking-widest mb-1">
            {label}
          </p>
          <h3 className="text-2xl font-extrabold text-textPrimary tracking-tight tabular-nums leading-none">
            {value}
          </h3>
          {subtext && (
            <p className="text-xs text-textSecondary mt-1.5 leading-snug">{subtext}</p>
          )}
        </div>
      </div>
    </div>
  );
};
