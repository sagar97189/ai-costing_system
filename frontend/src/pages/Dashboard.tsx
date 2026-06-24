import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Settings, Database, Activity } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-[#050d16] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back!</h1>
              <p className="text-sm text-slate-400">Here's an overview of your costing system.</p>
            </div>
          </div>
          
          <button 
            onClick={() => window.location.href = "/"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Recent Uploads', value: '12', icon: Database, color: 'text-blue-400' },
            { label: 'Pending RFQs', value: '4', icon: Activity, color: 'text-emerald-400' },
            { label: 'System Status', value: 'Online', icon: Settings, color: 'text-purple-400' },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg bg-white/5 ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                <h3 className="text-3xl font-bold text-white">{stat.value}</h3>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 min-h-[400px] flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-medium text-slate-300">Your workspace is empty</h2>
            <p className="text-slate-500 max-w-sm mx-auto">
              Start by uploading an engineering drawing to extract BOMs and run the costing engine.
            </p>
            <button className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
              Upload Drawing
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
