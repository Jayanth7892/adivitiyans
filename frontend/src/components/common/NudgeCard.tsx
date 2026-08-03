import React from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { PillButton } from './PillButton';

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
    <div className="bg-alert-soft border border-red-200/80 rounded-xl p-4 transition-all hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-alert/10 text-alert shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-textPrimary">{title}</h4>
          <p className="text-xs text-textSecondary mt-0.5 leading-relaxed">{message}</p>
          <div className="mt-3">
            <PillButton
              variant="primary"
              size="sm"
              onClick={onClick}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              {ctaText}
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
};
