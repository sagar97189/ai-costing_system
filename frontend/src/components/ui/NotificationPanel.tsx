import React from 'react';
import { Bell, Check, X, Info, AlertTriangle, FileText, IndianRupee } from 'lucide-react';

const notifications = [
  { id: 1, type: 'alert', title: 'Route Rejected', desc: 'AI Route RT-1001 for Base Plate was rejected by Lead Engineer.', time: '10m ago', icon: AlertTriangle, color: 'text-brand-danger bg-brand-danger/10 border-brand-danger/20' },
  { id: 2, type: 'success', title: 'Quote Accepted', desc: 'Tata Motors accepted quote for RFQ-2024-8190.', time: '1h ago', icon: IndianRupee, color: 'text-brand-success bg-brand-success/10 border-brand-success/20' },
  { id: 3, type: 'info', title: 'Extraction Complete', desc: 'Drawing DRG-4921-REV-B successfully parsed with 96% confidence.', time: '2h ago', icon: FileText, color: 'text-brand-info bg-brand-info/10 border-brand-info/20' },
  { id: 4, type: 'alert', title: 'High Supplier Lead Time', desc: 'Bharat Forge quote for DRG-4801 indicates 8+ weeks delivery.', time: '3h ago', icon: AlertTriangle, color: 'text-brand-warning bg-brand-warning/10 border-brand-warning/20' },
  { id: 5, type: 'info', title: 'New RFQ Received', desc: 'RFQ-2024-8195 from Mahindra Defense added to pipeline.', time: '4h ago', icon: Bell, color: 'text-brand-indigo bg-brand-indigo/10 border-brand-indigo/20' },
  { id: 6, type: 'success', title: 'Routing Approved', desc: 'Route RT-1002 approved for production estimation.', time: '5h ago', icon: Check, color: 'text-brand-success bg-brand-success/10 border-brand-success/20' },
  { id: 7, type: 'info', title: 'Supplier Profile Updated', desc: 'Kalyani Tech updated ISO certs in portal.', time: '1d ago', icon: Info, color: 'text-gray-400 bg-white/5 border-white/10' },
  { id: 8, type: 'alert', title: 'Material Price Alert', desc: 'EN24 spot price increased by 4% in local market.', time: '1d ago', icon: IndianRupee, color: 'text-brand-warning bg-brand-warning/10 border-brand-warning/20' },
];

export function NotificationPanel({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-14 w-80 sm:w-96 bg-brand-surface border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col z-50 animate-[slideDown_0.2s_ease-out]">

        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0a0a0f]/50">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">Notifications</h3>
            <span className="bg-brand-indigo/20 text-brand-indigo text-[10px] font-bold px-2 py-0.5 rounded-full border border-brand-indigo/30">8 New</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] scrollbar-hide">
          <div className="flex flex-col divide-y divide-white/5">
            {notifications.map((n) => (
              <div key={n.id} className="p-4 hover:bg-white/[0.02] transition-colors cursor-pointer group flex gap-3">
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${n.color}`}>
                  <n.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-medium text-white group-hover:text-brand-indigo transition-colors">{n.title}</h4>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">{n.time}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{n.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-white/10 bg-[#0a0a0f]/50 text-center">
          <button className="text-xs font-medium text-brand-indigo hover:text-white transition-colors">
            Mark all as read
          </button>
        </div>

      </div>
    </>
  );
}
