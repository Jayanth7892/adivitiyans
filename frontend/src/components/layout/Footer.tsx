import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-3 px-4 border-t border-borderLine bg-surface shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-1 text-center">
        <p
          className="text-xs font-semibold tracking-widest text-brand-primary"
          style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
        >
          "Code. Create. Elevate."
        </p>
        <p className="text-[10px] text-textMuted leading-snug">
          Handcrafted with <span className="text-red-500">❤️</span> from{' '}
          <span className="text-brand-primary font-semibold">Data Science</span> by{' '}
          <span className="text-textSecondary font-semibold">Jaya Krushna</span>,{' '}
          <span className="text-textSecondary font-semibold">Dinesh Kumar</span> &amp;{' '}
          <span className="text-textSecondary font-semibold">Jayanth Kumar Naidu</span>
          <span className="mx-1.5 text-borderLine">|</span>
          Guided by{' '}
          <span className="text-textSecondary font-semibold">Mr. Y.P Srinath Reddy</span>
        </p>
      </div>
    </footer>
  );
};
