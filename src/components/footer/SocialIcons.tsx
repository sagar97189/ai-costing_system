import React from 'react';

const ICONS = ['LinkedIn', 'GitHub', 'Instagram', 'X', 'YouTube', 'Discord'];

export function SocialIcons() {
  return (
    <div className="flex flex-col items-start gap-8 z-20 relative">
      {/* Logo Area */}
      <div>
        <div className="font-anton uppercase text-2xl tracking-widest text-white/90 flex items-center gap-2">
          {/* Abstract geometric AI mark */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L22 12L12 22L2 12L12 2Z" className="stroke-[#FF5E3A]" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" className="fill-[#FF9B6A]" />
          </svg>
          AMANZI
        </div>
        <p className="mt-4 font-mono text-xs text-white/40 max-w-[200px] leading-relaxed">
          Engineering AI Solutions for the Next Generation.
        </p>
      </div>

      {/* Social Icons */}
      <div className="flex flex-wrap items-center gap-4">
        {ICONS.map((platform) => (
          <a
            key={platform}
            href="#"
            className="text-white/40 hover:text-white transition-all duration-300 hover:-translate-y-1 hover:drop-shadow-[0_0_12px_rgba(255,94,58,0.6)] flex items-center justify-center w-10 h-10 rounded-full border border-white/5 bg-white/5 hover:bg-white/10"
            aria-label={platform}
          >
            <span className="font-mono text-[10px] uppercase">{platform.charAt(0)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
