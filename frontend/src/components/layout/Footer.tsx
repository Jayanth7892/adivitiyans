import React from 'react';
import { Heart, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-4 px-4 border-t border-borderLine bg-surface shrink-0 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-1.5 text-center">
        {/* Motto Banner */}
        <div className="flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3 text-brand-primary" />
          <span className="text-[11px] font-black tracking-widest uppercase bg-gradient-to-r from-brand-primary via-indigo-500 to-sky-500 bg-clip-text text-transparent">
            Code &bull; Create &bull; Elevate
          </span>
          <Sparkles className="w-3 h-3 text-sky-500" />
        </div>

        {/* Handcrafted Credits */}
        <p className="text-[11px] text-textMuted leading-relaxed flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
          <span>Handcrafted with</span>
          <Heart className="w-3 h-3 text-red-500 fill-red-500 inline-block" />
          <span>from</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-soft text-brand-primary text-[10px] font-bold">
            RGMCET
          </span>
          <span>by</span>
          <span className="text-textPrimary font-bold">Jaya Krushna</span>,
          <span className="text-textPrimary font-bold">Dinesh Kumar</span>
          <span>&amp;</span>
          <span className="text-textPrimary font-bold">Jayanth Kumar Naidu</span>
          <span className="hidden sm:inline text-borderStrong mx-0.5">&bull;</span>
          <span className="w-full sm:w-auto mt-0.5 sm:mt-0">
            Guided by <span className="text-brand-primary font-bold">Mr. Y.P Srinath Reddy</span>
          </span>
        </p>
      </div>
    </footer>
  );
};

