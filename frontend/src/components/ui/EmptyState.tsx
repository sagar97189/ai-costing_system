import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center h-full">
      <div className="relative mb-6">
        {/* Geometric SVG Background */}
        <svg
          className="w-32 h-32 text-brand-indigo/10 absolute -inset-6 -z-10 animate-spin-slow"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M50 5L93.3013 25V75L50 95L6.69873 75V25L50 5Z"
            stroke="currentColor"
            strokeWidth="2"
            className="animate-pulse"
          />
          <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
        </svg>

        {Icon && (
          <div className="w-16 h-16 rounded-2xl bg-brand-elevated border border-white/10 flex items-center justify-center shadow-xl">
            <Icon className="w-8 h-8 text-brand-indigo" />
          </div>
        )}
      </div>

      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 max-w-sm mb-6 text-sm">{description}</p>

      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2 bg-gradient-to-r from-brand-indigo to-brand-violet rounded-md font-medium hover:scale-105 active:scale-95 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.4)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
