import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, FileSignature, IndianRupee, Clock, TrendingDown } from "lucide-react";
import { Skeleton } from '../components/ui/Skeleton';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';

const quotesData = [
  {
    id: 'QT-2024-9001',
    rfqId: 'RFQ-2024-8192',
    part: 'Spindle Housing (PRT-101)',
    supplier: 'Bharat Forge',
    totalCost: 4200,
    leadTime: '4 Weeks',
    status: 'Pending',
    breakdown: [
      { name: 'Material', value: 1800, color: '#6366F1' },
      { name: 'Machining', value: 1500, color: '#8B5CF6' },
      { name: 'Overhead', value: 500, color: '#10B981' },
      { name: 'Margin', value: 400, color: '#F59E0B' },
    ]
  },
  {
    id: 'QT-2024-9002',
    rfqId: 'RFQ-2024-8192',
    part: 'Spindle Housing (PRT-101)',
    supplier: 'Kalyani Tech',
    totalCost: 4800,
    leadTime: '3 Weeks',
    status: 'Rejected',
    breakdown: [
      { name: 'Material', value: 1950, color: '#6366F1' },
      { name: 'Machining', value: 1800, color: '#8B5CF6' },
      { name: 'Overhead', value: 600, color: '#10B981' },
      { name: 'Margin', value: 450, color: '#F59E0B' },
    ]
  },
  {
    id: 'QT-2024-9003',
    rfqId: 'RFQ-2024-8190',
    part: 'Drive Shaft (PRT-102)',
    supplier: 'Motherson',
    totalCost: 3500,
    leadTime: '5 Weeks',
    status: 'Accepted',
    breakdown: [
      { name: 'Material', value: 1200, color: '#6366F1' },
      { name: 'Machining', value: 1600, color: '#8B5CF6' },
      { name: 'Overhead', value: 400, color: '#10B981' },
      { name: 'Margin', value: 300, color: '#F59E0B' },
    ]
  }
];

const formatINR = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export default function Quotes() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const filtered = quotesData.filter(q =>
    q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.part.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Quotes Analysis</h2>
          <p className="text-sm text-gray-400 mt-1">Review received quotes and detailed cost breakdowns.</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search quotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 bg-brand-surface border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo w-full transition-all"
          />
        </div>
      </div>

      <div className="bg-brand-surface border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="w-full h-14" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0a0a0f]/50 border-b border-white/5">
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Quote ID</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">RFQ Ref</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Part</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Lead Time</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Unit Price</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                      className={`hover:bg-white/[0.02] transition-colors cursor-pointer group ${expandedRow === row.id ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="px-4 py-4 text-gray-500 group-hover:text-white transition-colors">
                        {expandedRow === row.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-brand-indigo flex items-center gap-2">
                        <FileSignature className="w-4 h-4" />
                        {row.id}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{row.rfqId}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">{row.part}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{row.supplier}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-500" /> {row.leadTime}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-semibold text-right">{formatINR(row.totalCost)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${row.status === 'Accepted' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' :
                          row.status === 'Rejected' ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/20' :
                            'bg-brand-warning/10 text-brand-warning border-brand-warning/20'
                          }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>

                    {expandedRow === row.id && (
                      <tr>
                        <td colSpan={8} className="p-0 border-b border-brand-indigo/20 bg-brand-indigo/[0.02]">
                          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-[fadeIn_0.3s_ease-out]">

                            {/* Breakdown Chart */}
                            <div className="bg-[#0a0a0f]/50 border border-white/5 rounded-xl p-5">
                              <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-6 flex items-center gap-2">
                                <TrendingDown className="w-4 h-4" /> Cost Breakdown Visualization
                              </h4>
                              <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={row.breakdown} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <Tooltip
                                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                      contentStyle={{ backgroundColor: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                      itemStyle={{ color: '#fff', fontSize: '12px' }}
                                      formatter={(value: number) => formatINR(value)}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                      {row.breakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            {/* Breakdown Table */}
                            <div className="flex flex-col justify-center">
                              <table className="w-full text-sm">
                                <tbody>
                                  {row.breakdown.map((item, i) => (
                                    <tr key={i} className="border-b border-white/5 last:border-0">
                                      <td className="py-3 flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-gray-300">{item.name}</span>
                                      </td>
                                      <td className="py-3 text-right font-medium text-white">
                                        {formatINR(item.value)}
                                      </td>
                                      <td className="py-3 text-right text-gray-500 text-xs w-16">
                                        {Math.round((item.value / row.totalCost) * 100)}%
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="border-t border-white/10 mt-2">
                                    <td className="py-3 font-semibold text-white">Total</td>
                                    <td className="py-3 text-right font-bold text-brand-indigo text-lg">
                                      {formatINR(row.totalCost)}
                                    </td>
                                    <td></td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
