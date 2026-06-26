import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Search, TrendingUp, TrendingDown, ArrowRight, Activity, Box, Clock, IndianRupee } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

// --- MOCK DATA (Indian Manufacturing Context) ---

const kpiData = [
  { id: 'revenue', title: 'Total Estimated Value', value: 84500000, suffix: '', prefix: '₹', trend: +12.5, icon: IndianRupee, sparkline: [40, 50, 45, 60, 55, 70, 84] },
  { id: 'rfqs', title: 'Active RFQs', value: 142, suffix: '', prefix: '', trend: +5.2, icon: Box, sparkline: [120, 125, 122, 130, 135, 140, 142] },
  { id: 'winrate', title: 'Quote Win Rate', value: 34.8, suffix: '%', prefix: '', trend: -2.1, icon: Activity, sparkline: [38, 37, 35, 36, 35, 33, 34.8] },
  { id: 'tat', title: 'Avg Turnaround', value: 4.2, suffix: ' Days', prefix: '', trend: -15.0, icon: Clock, sparkline: [6.5, 6.0, 5.8, 5.5, 5.0, 4.5, 4.2], reverseTrendGood: true },
];

const pipelineData = [
  { name: 'Jan', received: 45, quoted: 30, won: 12 },
  { name: 'Feb', received: 52, quoted: 38, won: 15 },
  { name: 'Mar', received: 48, quoted: 40, won: 18 },
  { name: 'Apr', received: 61, quoted: 45, won: 22 },
  { name: 'May', received: 59, quoted: 50, won: 25 },
  { name: 'Jun', received: 75, quoted: 65, won: 30 },
];

const partFamilyData = [
  { name: 'Turned Parts', value: 45, color: '#6366F1' },
  { name: 'Milled Parts', value: 30, color: '#8B5CF6' },
  { name: 'Sheet Metal', value: 15, color: '#10B981' },
  { name: 'Castings', value: 10, color: '#F59E0B' },
];

const activityData = [
  { id: 'RFQ-2024-8192', customer: 'Tata Motors', parts: 12, value: 4500000, status: 'Quoting', date: '2024-06-24', material: 'EN24' },
  { id: 'RFQ-2024-8191', customer: 'Mahindra Defense', parts: 5, value: 1250000, status: 'Received', date: '2024-06-24', material: 'SS316' },
  { id: 'RFQ-2024-8190', customer: 'L&T Heavy Eng', parts: 24, value: 8900000, status: 'Won', date: '2024-06-23', material: '20MnCr5' },
  { id: 'RFQ-2024-8189', customer: 'Bajaj Auto', parts: 8, value: 320000, status: 'Lost', date: '2024-06-22', material: 'EN8' },
  { id: 'RFQ-2024-8188', customer: 'Bharat Forge', parts: 2, value: 150000, status: 'Quoted', date: '2024-06-21', material: 'EN24' },
];

// --- FORMATTERS ---

const formatINR = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
};

// --- ANIMATED COUNTER COMPONENT ---
function AnimatedCounter({ end, prefix = '', suffix = '', decimals = 0 }: { end: number, prefix?: string, suffix?: string, decimals?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    const duration = 1500; // ms

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function (easeOutExpo)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(end * ease);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };

    window.requestAnimationFrame(step);
  }, [end]);

  return (
    <span>
      {prefix}
      {count.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

// --- MAIN COMPONENT ---

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const filteredActivity = activityData.filter(item =>
    item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.material.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ROW 1: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, idx) => (
          <div key={idx} className="bg-brand-surface border border-white/5 rounded-xl p-5 relative overflow-hidden group hover:border-brand-indigo/30 transition-colors">
            {loading ? (
              <Skeleton className="w-full h-24" />
            ) : (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-brand-elevated rounded-lg border border-white/5 group-hover:scale-110 transition-transform">
                    <kpi.icon className="w-5 h-5 text-brand-indigo" />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${(kpi.trend > 0 && !kpi.reverseTrendGood) || (kpi.trend < 0 && kpi.reverseTrendGood)
                    ? 'bg-brand-success/10 text-brand-success'
                    : 'bg-brand-danger/10 text-brand-danger'
                    }`}>
                    {kpi.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(kpi.trend)}%
                  </div>
                </div>

                <div>
                  <h3 className="text-gray-400 text-sm font-medium mb-1">{kpi.title}</h3>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {kpi.id === 'revenue'
                      ? formatINR(kpi.value)
                      : <AnimatedCounter end={kpi.value} prefix={kpi.prefix} suffix={kpi.suffix} decimals={kpi.id === 'winrate' || kpi.id === 'tat' ? 1 : 0} />
                    }
                  </div>
                </div>

                {/* Sparkline */}
                <div className="absolute bottom-0 left-0 right-0 h-10 opacity-30 group-hover:opacity-100 transition-opacity">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kpi.sparkline.map((val, i) => ({ val, i }))}>
                      <defs>
                        <linearGradient id={`color-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="val" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill={`url(#color-${kpi.id})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ROW 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-brand-surface border border-white/5 rounded-xl p-5">
          <h3 className="text-white font-medium mb-6">RFQ Pipeline Trend</h3>
          {loading ? (
            <Skeleton className="w-full h-[300px]" />
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{ backgroundColor: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="received" name="Received" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="quoted" name="Quoted" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="won" name="Won" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-brand-surface border border-white/5 rounded-xl p-5 relative">
          <h3 className="text-white font-medium mb-6">Part Family Distribution</h3>
          {loading ? (
            <Skeleton className="w-full h-[300px]" />
          ) : (
            <div className="h-[300px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={partFamilyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {partFamilyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-white tracking-tight">
                  <AnimatedCounter end={100} />
                </span>
                <span className="text-xs text-gray-400 uppercase tracking-wider mt-1">Families</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: Table */}
      <div className="bg-brand-surface border border-white/5 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-white font-medium">Recent RFQ Activity</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search RFQs, Clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-brand-bg border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo w-full sm:w-64 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="w-full h-12" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0a0a0f]/50 border-b border-white/5">
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">RFQ ID</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Customer</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Parts</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Material</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Est. Value</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredActivity.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500 text-sm">
                      No matching RFQs found for "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  filteredActivity.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-brand-indigo">{row.id}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-white">{row.customer}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-300">{row.parts}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-300">
                        <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs">{row.material}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-300">{formatINR(row.value)}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-400">{row.date}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${row.status === 'Won' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' :
                          row.status === 'Lost' ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/20' :
                            row.status === 'Quoted' ? 'bg-brand-info/10 text-brand-info border-brand-info/20' :
                              'bg-brand-warning/10 text-brand-warning border-brand-warning/20'
                          }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
