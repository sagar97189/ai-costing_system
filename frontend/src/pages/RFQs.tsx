import React, { useState, useEffect } from 'react';
import { Search, Trophy, FileSignature, ArrowRight, Building2, Package, IndianRupee, Clock, ChevronRight } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

// --- MOCK DATA ---

const rfqListData = [
  { id: 'RFQ-2024-8192', customer: 'Tata Motors', value: 4500000, date: '24 Jun', status: 'Quoting' },
  { id: 'RFQ-2024-8191', customer: 'Mahindra Defense', value: 1250000, date: '24 Jun', status: 'Review' },
  { id: 'RFQ-2024-8190', customer: 'L&T Heavy Eng', value: 8900000, date: '23 Jun', status: 'Won' },
  { id: 'RFQ-2024-8189', customer: 'Bajaj Auto', value: 320000, date: '22 Jun', status: 'Lost' },
];

const rfqDetail = {
  id: 'RFQ-2024-8192',
  customer: 'Tata Motors',
  dueDate: '2024-07-05',
  status: 'Quoting',
  parts: [
    { partNo: 'PRT-2024-101', name: 'Spindle Housing', qty: 500, material: 'EN8' },
    { partNo: 'PRT-2024-102', name: 'Drive Shaft', qty: 500, material: 'EN24' },
  ],
  quotes: [
    { supplier: 'Bharat Forge', score: 92, delivery: '4 Weeks', p101: 4200, p102: 3800 },
    { supplier: 'Kalyani Tech', score: 85, delivery: '3 Weeks', p101: 4800, p102: 3500 }, // p102 is lowest
    { supplier: 'Motherson', score: 88, delivery: '5 Weeks', p101: 4100, p102: 4100 }, // p101 is lowest
  ]
};

// --- FORMATTERS ---
const formatINR = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export default function RFQs() {
  const [loading, setLoading] = useState(true);
  const [selectedRFQ, setSelectedRFQ] = useState<string>('RFQ-2024-8192');

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Determine lowest prices for highlights
  const p101Min = Math.min(...rfqDetail.quotes.map(q => q.p101));
  const p102Min = Math.min(...rfqDetail.quotes.map(q => q.p102));

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      {/* Left Panel: RFQ List */}
      <div className="w-full md:w-80 flex flex-col shrink-0 gap-4">
        <h2 className="text-xl font-semibold text-white tracking-tight">Active RFQs</h2>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search RFQs..."
            className="pl-9 pr-4 py-2.5 bg-brand-surface border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo w-full transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
          {loading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="w-full h-24 rounded-xl" />)
          ) : (
            rfqListData.map(rfq => (
              <div
                key={rfq.id}
                onClick={() => setSelectedRFQ(rfq.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedRFQ === rfq.id
                  ? 'bg-brand-indigo/10 border-brand-indigo shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                  : 'bg-brand-surface border-white/5 hover:border-white/20'
                  }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-white">{rfq.customer}</div>
                  <div className="text-[10px] text-gray-500">{rfq.date}</div>
                </div>
                <div className={`text-xs font-mono mb-3 ${selectedRFQ === rfq.id ? 'text-brand-indigo' : 'text-gray-400'}`}>
                  {rfq.id}
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-300 font-medium">{formatINR(rfq.value)}</span>
                  <span className={`px-2 py-0.5 rounded-full ${rfq.status === 'Quoting' ? 'bg-brand-info/10 text-brand-info' :
                    rfq.status === 'Won' ? 'bg-brand-success/10 text-brand-success' :
                      rfq.status === 'Lost' ? 'bg-brand-danger/10 text-brand-danger' :
                        'bg-white/10 text-gray-300'
                    }`}>
                    {rfq.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: RFQ Details */}
      <div className="flex-1 bg-brand-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        {loading ? (
          <div className="p-6 h-full flex flex-col gap-6">
            <Skeleton className="w-1/3 h-8" />
            <Skeleton className="w-full h-24" />
            <Skeleton className="w-full h-64" />
          </div>
        ) : (
          <>
            {/* Detail Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-white">{rfqDetail.id}</h2>
                  <span className="px-2.5 py-1 bg-brand-info/10 border border-brand-info/20 text-brand-info rounded-md text-xs font-medium">
                    {rfqDetail.status}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm text-gray-400">
                  <div className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> {rfqDetail.customer}</div>
                  <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Due: {rfqDetail.dueDate}</div>
                </div>
              </div>
              <button className="px-4 py-2 bg-white text-brand-bg rounded-md font-medium text-sm hover:bg-gray-200 transition-colors flex items-center gap-2">
                Generate Quote <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Parts Table */}
              <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
                <Package className="w-4 h-4" /> Bill of Materials
              </h3>
              <div className="bg-[#0a0a0f]/50 border border-white/5 rounded-xl overflow-hidden mb-8">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-gray-400 text-xs">
                    <tr>
                      <th className="px-4 py-3 font-medium">Part Number</th>
                      <th className="px-4 py-3 font-medium">Part Name</th>
                      <th className="px-4 py-3 font-medium">Material</th>
                      <th className="px-4 py-3 font-medium text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {rfqDetail.parts.map((p, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-mono text-brand-indigo">{p.partNo}</td>
                        <td className="px-4 py-3 text-white">{p.name}</td>
                        <td className="px-4 py-3"><span className="px-2 py-1 bg-white/5 rounded text-xs border border-white/10">{p.material}</span></td>
                        <td className="px-4 py-3 text-right">{p.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Supplier Quote Matrix */}
              <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
                <FileSignature className="w-4 h-4" /> Supplier Quote Comparison
              </h3>
              <div className="bg-[#0a0a0f]/50 border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-gray-400 text-xs border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 font-medium">Supplier</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Delivery</th>
                      <th className="px-4 py-3 font-medium text-right bg-white/[0.02]">PRT-2024-101</th>
                      <th className="px-4 py-3 font-medium text-right bg-white/[0.02]">PRT-2024-102</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {rfqDetail.quotes.map((q, i) => {
                      const isP101Lowest = q.p101 === p101Min;
                      const isP102Lowest = q.p102 === p102Min;

                      return (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-4 text-white font-medium">{q.supplier}</td>
                          <td className="px-4 py-4">
                            <span className="text-brand-success bg-brand-success/10 px-2 py-1 rounded text-xs border border-brand-success/20">{q.score}/100</span>
                          </td>
                          <td className="px-4 py-4">{q.delivery}</td>

                          {/* Unit Price P101 */}
                          <td className={`px-4 py-4 text-right bg-white/[0.01] ${isP101Lowest ? 'bg-brand-success/5' : ''}`}>
                            <div className="flex items-center justify-end gap-2">
                              {isP101Lowest && <Trophy className="w-3.5 h-3.5 text-brand-success" />}
                              <span className={isP101Lowest ? 'text-brand-success font-semibold' : ''}>
                                {formatINR(q.p101)}
                              </span>
                            </div>
                          </td>

                          {/* Unit Price P102 */}
                          <td className={`px-4 py-4 text-right bg-white/[0.01] ${isP102Lowest ? 'bg-brand-success/5' : ''}`}>
                            <div className="flex items-center justify-end gap-2">
                              {isP102Lowest && <Trophy className="w-3.5 h-3.5 text-brand-success" />}
                              <span className={isP102Lowest ? 'text-brand-success font-semibold' : ''}>
                                {formatINR(q.p102)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
