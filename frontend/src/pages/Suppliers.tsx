import React, { useState, useEffect } from 'react';
import { Search, Star, MapPin, Award, ShieldCheck, Mail, Phone, ExternalLink } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

const suppliersData = [
  {
    id: 'SUP-001',
    name: 'Bharat Forge Ltd.',
    location: 'Pune, Maharashtra',
    rating: 4.8,
    winRate: 68,
    capabilities: ['Forging', 'CNC Machining', 'Heat Treatment'],
    certifications: ['ISO 9001', 'IATF 16949'],
    status: 'Preferred',
    tier: 'Tier 1',
  },
  {
    id: 'SUP-002',
    name: 'Kalyani Technoforge',
    location: 'Chakan, Pune',
    rating: 4.5,
    winRate: 45,
    capabilities: ['Precision Forging', 'Machining'],
    certifications: ['ISO 9001'],
    status: 'Active',
    tier: 'Tier 2',
  },
  {
    id: 'SUP-003',
    name: 'Motherson Sumi Systems',
    location: 'Noida, UP',
    rating: 4.9,
    winRate: 72,
    capabilities: ['Injection Molding', 'Assembly', 'Tooling'],
    certifications: ['ISO 9001', 'ISO 14001', 'IATF 16949'],
    status: 'Preferred',
    tier: 'Tier 1',
  },
  {
    id: 'SUP-004',
    name: 'Sundram Fasteners',
    location: 'Chennai, TN',
    rating: 4.6,
    winRate: 55,
    capabilities: ['Cold Extrusion', 'Powder Metallurgy', 'Fasteners'],
    certifications: ['ISO 9001', 'TS 16949'],
    status: 'Active',
    tier: 'Tier 1',
  },
  {
    id: 'SUP-005',
    name: 'Rolex Rings',
    location: 'Rajkot, Gujarat',
    rating: 4.3,
    winRate: 38,
    capabilities: ['Bearing Rings', 'Auto Components'],
    certifications: ['ISO 9001'],
    status: 'Probation',
    tier: 'Tier 2',
  },
  {
    id: 'SUP-006',
    name: 'Endurance Tech',
    location: 'Aurangabad, MH',
    rating: 4.7,
    winRate: 61,
    capabilities: ['Die Casting', 'Suspension', 'Transmission'],
    certifications: ['ISO 9001', 'OHSAS 18001'],
    status: 'Active',
    tier: 'Tier 1',
  }
];

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= Math.round(rating) ? 'fill-brand-warning text-brand-warning' : 'fill-white/5 text-white/10'}`}
        />
      ))}
      <span className="text-white font-medium text-sm ml-2">{rating}</span>
    </div>
  );
}

export default function Suppliers() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const filtered = suppliersData.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.capabilities.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Supplier Directory</h2>
          <p className="text-sm text-gray-400 mt-1">Manage vendor capabilities, ratings, and performance.</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers, capabilities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 bg-brand-surface border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo w-full transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => <Skeleton key={i} className="w-full h-64 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">No suppliers found.</div>
        ) : (
          filtered.map((supplier) => (
            <div key={supplier.id} className="bg-brand-surface border border-white/5 rounded-xl p-5 hover:border-brand-indigo/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-brand-indigo transition-colors">{supplier.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> {supplier.location}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border ${supplier.status === 'Preferred' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' :
                  supplier.status === 'Probation' ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/20' :
                    'bg-brand-info/10 text-brand-info border-brand-info/20'
                  }`}>
                  {supplier.status}
                </div>
              </div>

              <div className="flex items-center justify-between mb-5 bg-[#0a0a0f]/50 p-3 rounded-lg border border-white/5">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Rating</div>
                  <RatingStars rating={supplier.rating} />
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Win Rate</div>
                  <div className="text-white font-medium text-sm flex items-center gap-1 justify-end">
                    <Award className="w-4 h-4 text-brand-indigo" /> {supplier.winRate}%
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Capabilities</div>
                <div className="flex flex-wrap gap-2">
                  {supplier.capabilities.map((cap, i) => (
                    <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-xs text-gray-300">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-white/5">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <ShieldCheck className="w-4 h-4 text-brand-success" />
                  {supplier.certifications.length} Certs
                </div>
                <div className="flex items-center gap-3">
                  <button className="text-gray-400 hover:text-white transition-colors"><Mail className="w-4 h-4" /></button>
                  <button className="text-gray-400 hover:text-white transition-colors"><Phone className="w-4 h-4" /></button>
                  <button className="text-gray-400 hover:text-brand-indigo transition-colors"><ExternalLink className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
