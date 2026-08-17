import React from 'react';
import { ArrowRight } from 'lucide-react';

interface NudgeCardProps {
  title: string;
  message: string;
  ctaText: string;
  onClick: () => void;
}

export const NudgeCard: React.FC<NudgeCardProps> = ({
  title,
  message,
  ctaText,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="group relative bg-surface border border-borderLine rounded-2xl p-4 cursor-pointer hover:border-brand-primary hover:shadow-md transition-all overflow-hidden"
    >
      {/* Left accent strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-alert" />

      <div className="pl-3">
        <h4 className="text-sm font-bold text-textPrimary leading-snug mb-1">{title}</h4>
        <p className="text-xs text-textSecondary leading-relaxed mb-3">{message}</p>
        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-primary">
          <span>{ctaText}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
};
