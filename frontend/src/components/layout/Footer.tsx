import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-2 sm:py-3 px-4 border-t border-borderLine bg-background shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-0 sm:gap-0.5 text-center">
        <p
          className="text-[11px] sm:text-xs font-semibold tracking-wider text-brand-primary"
          style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
        >
          "Code. Create. Elevate."
        </p>
        <p className="text-[10px] sm:text-[11px] text-textSecondary leading-snug">
          Handcrafted with <span className="text-red-500">❤️</span> from <span className="text-brand-primary font-semibold">Data Science</span> by{' '}
          <span className="text-textPrimary font-semibold">Jaya Krushna</span>,{' '}
          <span className="text-textPrimary font-semibold">Dinesh Kumar</span> &amp;{' '}
          <span className="text-textPrimary font-semibold">Jayanth Kumar Naidu</span>
          <span className="mx-1 sm:mx-1.5 text-borderLine">|</span>
          Guided by{' '}
          <span className="text-textPrimary font-semibold">Mr. Y.P Srinath Reddy</span>
        </p>
      </div>
    </footer>
  );
};
