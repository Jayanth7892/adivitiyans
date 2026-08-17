import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-8 text-center bg-surface border border-borderLine rounded-2xl shadow-xs">
      <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center text-brand-primary mb-4 shadow-xs">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-textPrimary mb-1.5">{title}</h3>
      <p className="text-xs text-textSecondary max-w-xs leading-relaxed mb-5">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
