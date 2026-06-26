import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, FileText, CheckCircle2, AlertCircle, FileCheck2, Cpu } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { UploadModal } from '../components/ui/UploadModal';

// --- MOCK DATA ---

const drawingsData = [
  {
    id: 'DRG-4921-REV-B',
    partName: 'Spindle Housing',
    customer: 'Bharat Forge',
    material: 'EN8',
    confidence: 96,
    date: '2024-06-25',
    status: 'Extracted',
    titleBlock: {
      drawnBy: 'Ramesh K.',
      approvedBy: 'Sanjay V.',
      scale: '1:1',
      tolerance: 'IS 2102-m',
      weight: '4.2 kg',
      treatment: 'Case Hardening'
    },
    routing: [
      { step: 1, op: 'Cutting', machine: 'Bandsaw', time: '5m' },
      { step: 2, op: 'CNC Turning', machine: 'Doosan Puma', time: '18m' },
      { step: 3, op: 'VMC Milling', machine: 'Haas VF-2', time: '12m' },
      { step: 4, op: 'Inspection', machine: 'CMM', time: '10m' }
    ]
  },
  {
    id: 'DRG-4922-REV-A',
    partName: 'Flange Coupling',
    customer: 'L&T Heavy Eng',
    material: 'SS316',
    confidence: 82,
    date: '2024-06-24',
    status: 'Review Needed',
    titleBlock: {
      drawnBy: 'Amit P.',
      approvedBy: 'Pending',
      scale: '1:2',
      tolerance: 'ISO 2768-m',
      weight: '12.5 kg',
      treatment: 'Passivation'
    },
    routing: [
      { step: 1, op: 'Waterjet', machine: 'Omax', time: '22m' },
      { step: 2, op: 'CNC Milling', machine: 'Mazak', time: '35m' },
      { step: 3, op: 'Drilling', machine: 'Radial Drill', time: '8m' }
    ]
  },
  {
    id: 'DRG-4919-REV-C',
    partName: 'Motor Bracket',
    customer: 'Tata Motors',
    material: '20MnCr5',
    confidence: 98,
    date: '2024-06-23',
    status: 'Approved',
    titleBlock: {
      drawnBy: 'Vikram S.',
      approvedBy: 'Rajiv N.',
      scale: '1:1',
      tolerance: 'IS 2102-f',
      weight: '1.8 kg',
      treatment: 'Zinc Plating'
    },
    routing: [
      { step: 1, op: 'Laser Cut', machine: 'Trumpf', time: '3m' },
      { step: 2, op: 'Bending', machine: 'Amada Press', time: '4m' },
      { step: 3, op: 'Welding', machine: 'TIG Robot', time: '15m' }
    ]
  }
];

// --- COMPONENTS ---

function ConfidenceBar({ score }: { score: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  let colorClass = 'bg-brand-success';
  if (score < 90) colorClass = 'bg-brand-warning';
  if (score < 80) colorClass = 'bg-brand-danger';

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-400">{score}%</span>
    </div>
  );
}

export default function Drawings() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const filteredDrawings = drawingsData.filter(d =>
    d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.customer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Engineering Drawings</h2>
          <p className="text-sm text-gray-400 mt-1">Manage extracted features, BOMs, and routing.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search drawings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-brand-surface border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo w-full transition-all"
            />
          </div>
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-brand-indigo to-brand-violet rounded-md font-medium text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.3)] whitespace-nowrap"
          >
            Upload PDF
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-brand-surface border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="w-full h-14" />)}
          </div>
        ) : filteredDrawings.length === 0 ? (
          <div className="h-64">
            <EmptyState
              icon={FileCheck2}
              title="No Drawings Found"
              description={`No matching drawings found for "${searchTerm}". Try a different search term.`}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0a0a0f]/50 border-b border-white/5">
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Drawing No.</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Part Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Material</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">AI Confidence</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredDrawings.map((row) => (
                  <React.Fragment key={row.id}>
                    {/* Main Row */}
                    <tr
                      onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                      className={`hover:bg-white/[0.02] transition-colors cursor-pointer group ${expandedRow === row.id ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="px-4 py-4 text-gray-500 group-hover:text-white transition-colors">
                        {expandedRow === row.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-indigo" />
                        {row.id}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{row.partName}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{row.customer}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                        <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs">{row.material}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <ConfidenceBar score={row.confidence} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${row.status === 'Extracted' ? 'bg-brand-info/10 text-brand-info border-brand-info/20' :
                          row.status === 'Approved' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' :
                            'bg-brand-warning/10 text-brand-warning border-brand-warning/20'
                          }`}>
                          {row.status === 'Review Needed' ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          {row.status}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded Detail Panel */}
                    {expandedRow === row.id && (
                      <tr>
                        <td colSpan={7} className="p-0 border-b border-brand-indigo/20 bg-brand-indigo/[0.02]">
                          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-[fadeIn_0.3s_ease-out]">

                            {/* Title Block Details */}
                            <div className="lg:col-span-1 bg-[#0a0a0f]/50 border border-white/5 rounded-xl p-4">
                              <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Title Block
                              </h4>
                              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                <div>
                                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Drawn By</div>
                                  <div className="text-sm text-gray-200 mt-0.5">{row.titleBlock.drawnBy}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Tolerance</div>
                                  <div className="text-sm text-gray-200 mt-0.5">{row.titleBlock.tolerance}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Scale</div>
                                  <div className="text-sm text-gray-200 mt-0.5">{row.titleBlock.scale}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Weight</div>
                                  <div className="text-sm text-gray-200 mt-0.5">{row.titleBlock.weight}</div>
                                </div>
                                <div className="col-span-2">
                                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Treatment</div>
                                  <div className="text-sm text-brand-info mt-0.5">{row.titleBlock.treatment}</div>
                                </div>
                              </div>
                            </div>

                            {/* Extracted Routing Stepper */}
                            <div className="lg:col-span-2 bg-[#0a0a0f]/50 border border-white/5 rounded-xl p-4 flex flex-col">
                              <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
                                <Cpu className="w-4 h-4" /> Extracted Routing Sequence
                              </h4>

                              <div className="flex-1 flex items-center overflow-x-auto pb-2 scrollbar-hide">
                                <div className="flex items-center min-w-max px-2">
                                  {row.routing.map((route, i) => (
                                    <React.Fragment key={i}>
                                      {/* Node */}
                                      <div className="relative group">
                                        <div className="w-10 h-10 rounded-full bg-brand-surface border border-brand-indigo/30 flex items-center justify-center group-hover:border-brand-indigo group-hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all z-10 relative">
                                          <span className="text-brand-indigo font-mono text-sm">{route.step}</span>
                                        </div>
                                        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-max text-center">
                                          <div className="text-sm font-medium text-white">{route.op}</div>
                                          <div className="text-xs text-gray-400">{route.machine}</div>
                                          <div className="text-[10px] text-brand-info font-mono mt-1">{route.time}</div>
                                        </div>
                                      </div>

                                      {/* Connector */}
                                      {i < row.routing.length - 1 && (
                                        <div className="w-16 sm:w-24 h-px bg-white/10 mx-2 relative top-[-24px]">
                                          <div className="absolute inset-0 bg-brand-indigo/30 w-full animate-[pulse_2s_ease-in-out_infinite]" />
                                        </div>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
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

      {/* Upload Modal */}
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={(file) => {
          console.log('Uploading file:', file);
          // TODO: Implement actual file upload to API
        }}
      />
    </div>
  );
}
