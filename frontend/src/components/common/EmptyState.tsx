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
    <div className="flex flex-col items-center justify-center p-8 text-center bg-surface border border-borderLine rounded-xl">
      <div className="p-3.5 rounded-full bg-brand-soft text-brand-primary mb-3">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-textPrimary">{title}</h3>
      <p className="text-xs text-textSecondary max-w-sm mt-1 mb-4 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
