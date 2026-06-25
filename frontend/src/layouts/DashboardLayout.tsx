import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  GitMerge,
  FileSignature,
  Users,
  LineChart,
  Settings,
  Shield,
  Search,
  Bell,
  Sun,
  Menu,
  X,
  LogOut,
  Hexagon,
} from 'lucide-react';

import { PageTransition } from '../components/ui/PageTransition';
import { SearchModal } from '../components/ui/SearchModal';
import { NotificationPanel } from '../components/ui/NotificationPanel';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' }],
  },
  {
    label: 'Manufacturing',
    items: [
      { icon: FileText, label: 'Drawings', path: '/dashboard/drawings' },
      { icon: GitMerge, label: 'Routing', path: '/dashboard/routing' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { icon: FileSignature, label: 'RFQs', path: '/dashboard/rfqs' },
      { icon: FileText, label: 'Quotes', path: '/dashboard/quotes' },
      { icon: Users, label: 'Suppliers', path: '/dashboard/suppliers' },
    ],
  },
  {
    label: 'Analytics',
    items: [{ icon: LineChart, label: 'Reports', path: '/dashboard/analytics' }],
  },
  {
    label: 'System',
    items: [
      { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
      { icon: Shield, label: 'Users', path: '/dashboard/users' },
    ],
  },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname.split('/').pop() || 'dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <div className="flex h-screen w-full bg-brand-bg text-white overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside
        className={`hidden md:flex flex-col border-r border-white/5 bg-[#0a0a0f]/50 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] z-20 ${collapsed ? 'w-16' : 'w-64'
          }`}
      >
        <div className="flex items-center gap-3 h-16 px-4 border-b border-white/5 shrink-0">
          <Hexagon className="w-6 h-6 text-brand-indigo shrink-0" />
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-brand-indigo to-brand-violet bg-clip-text text-transparent truncate">
              RFQ Intel
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="mb-6">
              {!collapsed && (
                <div className="px-4 mb-2 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  {section.label}
                </div>
              )}
              <div className="flex flex-col gap-1 px-2">
                {section.items.map((item, iIdx) => (
                  <NavLink
                    key={iIdx}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group ${isActive
                        ? 'bg-brand-indigo/10 text-brand-indigo border-l-2 border-brand-indigo'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-indigo to-brand-violet flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <span className="text-xs font-bold">AK</span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-white">Anil Kumar</div>
                <div className="text-xs text-gray-500 truncate">Lead Engineer</div>
              </div>
            )}
            {!collapsed && (
              <LogOut className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-brand-danger shrink-0" />
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 bg-brand-surface/50 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:block p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold tracking-tight text-white">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-4 relative">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors text-sm text-gray-400 w-48 md:w-64"
            >
              <Search className="w-4 h-4" />
              <span>Search (Cmd+K)</span>
            </button>

            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 text-gray-400 hover:text-white relative transition-colors"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-indigo rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
            </button>
            <NotificationPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

            <button className="hidden md:block p-2 text-gray-400 hover:text-white transition-colors">
              <Sun className="w-5 h-5" />
            </button>

            <button
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-brand-bg relative p-4 lg:p-8 scrollbar-hide">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full h-16 bg-brand-surface border-t border-white/5 flex items-center justify-around z-30 pb-safe">
        {[
          { icon: LayoutDashboard, path: '/dashboard' },
          { icon: FileText, path: '/dashboard/drawings' },
          { icon: GitMerge, path: '/dashboard/routing' },
          { icon: FileSignature, path: '/dashboard/rfqs' },
          { icon: LineChart, path: '/dashboard/analytics' },
        ].map((item, idx) => (
          <NavLink
            key={idx}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              `p-3 flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-brand-indigo' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.path === location.pathname && (
              <span className="w-1 h-1 rounded-full bg-brand-indigo mt-1 shadow-[0_0_5px_rgba(99,102,241,0.5)]"></span>
            )}
          </NavLink>
        ))}
      </nav>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
