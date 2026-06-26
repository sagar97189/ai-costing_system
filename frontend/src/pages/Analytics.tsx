import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap
} from 'recharts';
import { Skeleton } from '../components/ui/Skeleton';

// --- MOCK DATA ---

const costTrendData = [
  { month: 'Jan', 'Material Cost': 4000, 'Machining Cost': 2400 },
  { month: 'Feb', 'Material Cost': 3000, 'Machining Cost': 1398 },
  { month: 'Mar', 'Material Cost': 2000, 'Machining Cost': 9800 },
  { month: 'Apr', 'Material Cost': 2780, 'Machining Cost': 3908 },
  { month: 'May', 'Material Cost': 1890, 'Machining Cost': 4800 },
  { month: 'Jun', 'Material Cost': 2390, 'Machining Cost': 3800 },
];

const supplierPerformanceData = [
  { subject: 'Quality', A: 120, B: 110, fullMark: 150 },
  { subject: 'Delivery', A: 98, B: 130, fullMark: 150 },
  { subject: 'Cost', A: 86, B: 130, fullMark: 150 },
  { subject: 'Responsiveness', A: 99, B: 100, fullMark: 150 },
  { subject: 'Capacity', A: 85, B: 90, fullMark: 150 },
  { subject: 'Tech Capability', A: 65, B: 85, fullMark: 150 },
];

const materialCostData = [
  { name: 'EN8', size: 400 },
  { name: 'EN24', size: 300 },
  { name: 'SS316', size: 300 },
  { name: '20MnCr5', size: 200 },
  { name: 'MS IS2062', size: 278 },
  { name: 'Aluminum', size: 189 },
];

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111118] border border-white/10 p-3 rounded-lg shadow-xl">
        <p className="text-white font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: ₹{entry.value.toLocaleString('en-IN')}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom Treemap Content
const CustomizedTreemapContent = (props: any) => {
  const { root, depth, x, y, width, height, index, name } = props;
  const colors = ['#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: colors[index % colors.length],
          stroke: '#0a0a0f',
          strokeWidth: 2,
          strokeOpacity: 1,
        }}
        className="transition-opacity hover:opacity-80 cursor-pointer"
      />
      {width > 50 && height > 30 && (
        <text x={x + width / 2} y={y + height / 2 + 7} textAnchor="middle" fill="#fff" fontSize={12} className="font-medium drop-shadow-md">
          {name}
        </text>
      )}
    </g>
  );
};

export default function Analytics() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Analytics & Reports</h2>
          <p className="text-sm text-gray-400 mt-1">Cost trends, supplier performance, and material distribution.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Trend Line Chart */}
        <div className="bg-brand-surface border border-white/5 rounded-xl p-5">
          <h3 className="text-white font-medium mb-6">Aggregate Cost Trend</h3>
          {loading ? (
            <Skeleton className="w-full h-[350px]" />
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={costTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Material Cost" stroke="#6366F1" strokeWidth={3} dot={{ r: 4, fill: '#6366F1', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Machining Cost" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Supplier Performance Radar Chart */}
        <div className="bg-brand-surface border border-white/5 rounded-xl p-5">
          <h3 className="text-white font-medium mb-6">Supplier Performance Comparison</h3>
          {loading ? (
            <Skeleton className="w-full h-[350px]" />
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={supplierPerformanceData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                  <Radar name="Bharat Forge" dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} strokeWidth={2} />
                  <Radar name="L&T" dataKey="B" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} strokeWidth={2} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Material Cost Treemap */}
        <div className="lg:col-span-2 bg-brand-surface border border-white/5 rounded-xl p-5">
          <h3 className="text-white font-medium mb-6">Spend by Material Group</h3>
          {loading ? (
            <Skeleton className="w-full h-[400px]" />
          ) : (
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={materialCostData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={<CustomizedTreemapContent />}
                >
                  <Tooltip content={<CustomTooltip />} />
                </Treemap>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
