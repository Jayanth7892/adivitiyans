import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  iconBgColor?: string;
  label: string;
  value: string | number;
  subtext?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconBgColor = 'bg-brand-soft text-brand-primary',
  label,
  value,
  subtext,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-surface border border-borderLine rounded-xl p-5 shadow-sm transition-all ${
        onClick ? 'hover:border-brand-primary cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div className={`p-3 rounded-xl shrink-0 ${iconBgColor}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-textSecondary uppercase tracking-wider">{label}</p>
          <h3 className="text-2xl font-bold text-textPrimary mt-0.5">{value}</h3>
          {subtext && <p className="text-xs text-textSecondary mt-1">{subtext}</p>}
        </div>
      </div>
    </div>
  );
};
