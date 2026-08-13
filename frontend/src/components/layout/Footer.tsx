import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-5 px-4 border-t border-borderLine bg-surface/80 backdrop-blur-md mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-1.5 text-center">
        {/* Quote */}
        <p className="text-sm font-semibold tracking-wide text-brand-primary italic" style={{ fontFamily: 'Georgia, serif' }}>
          "Code. Create. Elevate."
        </p>

        {/* Developers */}
        <p className="text-xs text-textSecondary font-medium leading-relaxed">
          Handcrafted with{' '}
          <span className="text-red-500 inline-block animate-pulse">❤️</span>{' '}
          by{' '}
          <span className="text-textPrimary font-semibold">Jaya Krushna</span>,{' '}
          <span className="text-textPrimary font-semibold">Dinesh Kumar</span>, and{' '}
          <span className="text-textPrimary font-semibold">Jayanth Kumar Naidu</span>
        </p>

        {/* Guidance */}
        <p className="text-[11px] text-textSecondary leading-relaxed">
          Under the guidance of{' '}
          <span className="text-textPrimary font-semibold">Mr. Y.P Srinath Reddy</span>
        </p>
      </div>
    </footer>
  );
};
