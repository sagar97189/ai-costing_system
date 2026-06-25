import React, { useState, useEffect } from 'react';
import { Search, MoreVertical, Clock, TrendingUp, IndianRupee, GitMerge, ListFilter } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

// --- MOCK DATA ---

const initialKanbanData = {
    pending: [
        {
            id: 'RT-1004', part: 'Spindle Housing', drg: 'DRG-4921-REV-B', material: 'EN8', time: '45m', estCost: 1250,
            ops: ['Bandsaw', 'CNC Turning', 'VMC Milling', 'CMM']
        },
        {
            id: 'RT-1005', part: 'Motor Bracket', drg: 'DRG-4919-REV-C', material: '20MnCr5', time: '22m', estCost: 850,
            ops: ['Laser Cut', 'Bending', 'TIG Robot']
        }
    ],
    approved: [
        {
            id: 'RT-1002', part: 'Drive Shaft', drg: 'DRG-4801-REV-A', material: 'EN24', time: '120m', estCost: 3500,
            ops: ['Face Turning', 'OD Turning', 'Heat Treatment', 'Surface Grinding']
        }
    ],
    modified: [
        {
            id: 'RT-1003', part: 'Flange Coupling', drg: 'DRG-4922-REV-A', material: 'SS316', time: '65m', estCost: 2100,
            ops: ['Waterjet', 'CNC Milling', 'Radial Drilling']
        }
    ],
    rejected: [
        {
            id: 'RT-1001', part: 'Base Plate', drg: 'DRG-4799-REV-D', material: 'MS IS2062', time: '15m', estCost: 450,
            ops: ['Oxy Flame Cut', 'Manual Drilling']
        }
    ]
};

// --- COMPONENTS ---

function KanbanCard({ item }: { item: any }) {
    return (
        <div className="bg-brand-surface border border-white/5 rounded-xl p-4 shadow-lg hover:border-brand-indigo/30 transition-all cursor-grab active:cursor-grabbing group">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="text-xs font-mono text-brand-indigo mb-1">{item.id}</div>
                    <h4 className="text-white font-medium text-sm">{item.part}</h4>
                </div>
                <button className="text-gray-500 hover:text-white transition-colors">
                    <MoreVertical className="w-4 h-4" />
                </button>
            </div>

            <div className="text-xs text-gray-400 mb-4">{item.drg} • {item.material}</div>

            {/* Routing Pills */}
            <div className="flex flex-wrap gap-1.5 mb-4">
                {item.ops.map((op: string, idx: number) => (
                    <div key={idx} className="flex items-center text-[10px] bg-[#0a0a0f]/80 border border-white/10 rounded-full overflow-hidden">
                        <span className="bg-white/5 px-1.5 py-0.5 text-gray-400 font-mono border-r border-white/10">{idx + 1}</span>
                        <span className="px-2 py-0.5 text-gray-300">{op}</span>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    {item.time}
                </div>
                <div className="flex items-center gap-1 text-sm font-medium text-white">
                    <IndianRupee className="w-3.5 h-3.5 text-gray-500" />
                    {item.estCost.toLocaleString('en-IN')}
                </div>
            </div>
        </div>
    );
}

export default function Routing() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    const columns = [
        { id: 'pending', title: 'Pending Review', color: 'bg-brand-warning', items: initialKanbanData.pending },
        { id: 'modified', title: 'Modified AI Route', color: 'bg-brand-info', items: initialKanbanData.modified },
        { id: 'approved', title: 'Approved Route', color: 'bg-brand-success', items: initialKanbanData.approved },
        { id: 'rejected', title: 'Rejected', color: 'bg-brand-danger', items: initialKanbanData.rejected },
    ];

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
                <div>
                    <h2 className="text-2xl font-semibold text-white tracking-tight">Routing Board</h2>
                    <p className="text-sm text-gray-400 mt-1">Review and approve AI-generated manufacturing routes.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="p-2 border border-white/10 rounded-md bg-brand-surface hover:bg-white/5 transition-colors text-gray-400">
                        <ListFilter className="w-4 h-4" />
                    </button>
                    <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search part or route..."
                            className="pl-9 pr-4 py-2 bg-brand-surface border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo w-full transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Kanban Board Container */}
            <div className="flex-1 overflow-x-auto pb-4 scrollbar-hide">
                <div className="flex gap-6 min-w-max h-full">
                    {columns.map((column) => (
                        <div key={column.id} className="w-[320px] flex flex-col h-full">
                            {/* Column Header */}
                            <div className="flex items-center justify-between mb-4 px-1">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${column.color} shadow-[0_0_8px_currentColor] opacity-80`} />
                                    <h3 className="font-medium text-white text-sm">{column.title}</h3>
                                </div>
                                <span className="text-xs font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                    {column.items.length}
                                </span>
                            </div>

                            {/* Column Content */}
                            <div className="flex-1 bg-[#0a0a0f]/30 border border-white/[0.03] rounded-xl p-3 flex flex-col gap-3 overflow-y-auto min-h-[200px]">
                                {loading ? (
                                    <>
                                        <Skeleton className="w-full h-40" />
                                        <Skeleton className="w-full h-40" />
                                    </>
                                ) : column.items.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-white/5 rounded-xl">
                                        <GitMerge className="w-6 h-6 text-gray-600 mb-2" />
                                        <span className="text-sm text-gray-500">No routing cards</span>
                                    </div>
                                ) : (
                                    column.items.map(item => <KanbanCard key={item.id} item={item} />)
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
