import React, { useEffect, useRef } from 'react';
import { Search, FileText, Building2, Cpu, X, Box } from 'lucide-react';

const mockResults = [
  {
    category: 'RFQs', items: [
      { icon: Box, label: 'RFQ-2024-8192 - Tata Motors', desc: 'Quoting Phase • ₹45L' },
      { icon: Box, label: 'RFQ-2024-8190 - L&T Heavy Eng', desc: 'Won • ₹89L' },
    ]
  },
  {
    category: 'Drawings & Parts', items: [
      { icon: FileText, label: 'DRG-4921-REV-B (Spindle Housing)', desc: 'Extracted • EN8' },
      { icon: Cpu, label: 'PRT-2024-101', desc: 'Active BOM Component' },
    ]
  },
  {
    category: 'Suppliers', items: [
      { icon: Building2, label: 'Bharat Forge Ltd.', desc: 'Tier 1 • Pune' },
      { icon: Building2, label: 'Kalyani Technoforge', desc: 'Tier 2 • Chakan' },
    ]
  },
];

export function SearchModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent, this just catches if parent didn't
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-brand-surface border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-[slideDown_0.3s_ease-out]">

        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-white/10">
          <Search className="w-5 h-5 text-brand-indigo shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search RFQs, Drawings, Suppliers..."
            className="flex-1 bg-transparent border-none text-white px-4 py-5 focus:outline-none text-lg"
          />
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white rounded-md bg-white/5 border border-white/10 text-xs font-mono">
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
          {mockResults.map((group, idx) => (
            <div key={idx} className="mb-4 last:mb-0">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {group.category}
              </div>
              <div className="flex flex-col gap-1">
                {group.items.map((item, iIdx) => (
                  <button key={iIdx} className="flex items-center gap-4 px-3 py-3 w-full text-left rounded-lg hover:bg-brand-indigo/10 group transition-colors">
                    <div className="w-8 h-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-brand-indigo/20 group-hover:border-brand-indigo/30 transition-colors">
                      <item.icon className="w-4 h-4 text-gray-400 group-hover:text-brand-indigo" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{item.label}</div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
