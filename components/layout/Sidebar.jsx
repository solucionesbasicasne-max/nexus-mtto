import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Wrench, CalendarClock, ClipboardList,
  GanttChart, ChevronLeft, ChevronRight, LogOut, Menu, X,
  Building2, MapPinned, Layers, MapPin, GitBranch, Package,
  Cpu, Cog, Boxes, Warehouse, ChevronDown, ChevronUp, Users, BarChart2, TrendingUp, UserCheck, Settings2
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const hierachyItems = [
  { path: '/hierarchy/companies', label: 'Empresas', icon: Building2, level: 1 },
  { path: '/hierarchy/sites', label: 'Sitios / Plantas', icon: MapPinned, level: 2 },
  { path: '/hierarchy/business-units', label: 'Unidades / Áreas', icon: Layers, level: 3 },
  { path: '/hierarchy/locations', label: 'Ubicaciones', icon: MapPin, level: 4 },
  { path: '/hierarchy/processes', label: 'Procesos', icon: GitBranch, level: 5 },
  { path: '/hierarchy/assets', label: 'Activos Principales', icon: Package, level: 6 },
  { path: '/hierarchy/systems', label: 'Sistemas', icon: Cpu, level: 7 },
  { path: '/hierarchy/components', label: 'Componentes', icon: Cog, level: 8 },
  { path: '/hierarchy/spare-parts', label: 'Despieces', icon: Boxes, level: 9 },
];

const mainItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/personnel', label: 'Personal', icon: Users },
  { path: '/plans', label: 'Planes de Mant.', icon: Wrench },
  { path: '/preventive', label: 'Mant. Preventivo', icon: CalendarClock },
  { path: '/work-orders', label: 'Órdenes de Trabajo', icon: ClipboardList },
  { path: '/inventory', label: 'Inventario', icon: Warehouse },
  { path: '/services', label: 'Servicios', icon: Wrench },
  { path: '/gantt', label: 'Diagrama Gantt', icon: GanttChart },
  { path: '/reports', label: 'Reportes', icon: BarChart2 },
  { path: '/analytics', label: 'Analytics', icon: TrendingUp },
  { path: '/users', label: 'Usuarios', icon: UserCheck },
  { path: '/kpis', label: 'KPIs Gestión', icon: TrendingUp },
  { path: '/settings', label: 'Configuración', icon: Settings2 },
];

export default function Sidebar({ appName = 'CMMS Pro', appLogoUrl = '' }) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hierarchyOpen, setHierarchyOpen] = useState(
    location.pathname.startsWith('/hierarchy')
  );

  const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
          {appLogoUrl ? (
            <img src={appLogoUrl} alt="logo" className="w-full h-full object-contain p-0.5" />
          ) : (
            <Wrench className="w-5 h-5 text-sidebar-primary-foreground" />
          )}
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-inter text-base font-bold text-sidebar-foreground truncate">{appName}</h1>
            <p className="text-[11px] text-sidebar-foreground/50 font-medium">Gestión de Mantenimiento</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {/* Main items */}
        {mainItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              isActive(item.path)
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}

        {/* Hierarchy group */}
        {!collapsed && (
          <div className="pt-2">
            <button
              onClick={() => setHierarchyOpen(!hierarchyOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest hover:text-sidebar-foreground/70 transition-colors"
            >
              <span>Jerarquía</span>
              {hierarchyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {hierarchyOpen && (
              <div className="space-y-0.5 mt-0.5">
                {hierachyItems.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 pl-3 pr-2 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive(item.path)
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold bg-sidebar-foreground/10 text-sidebar-foreground/60">
                      {item.level}
                    </span>
                    <item.icon className="w-[16px] h-[16px] flex-shrink-0" />
                    <span className="truncate text-[13px]">{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsed hierarchy icons */}
        {collapsed && (
          <div className="pt-2 space-y-0.5">
            {hierachyItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                title={`Niv.${item.level} — ${item.label}`}
                className={`flex items-center justify-center py-2 rounded-lg transition-all ${
                  isActive(item.path) ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/50 hover:bg-sidebar-accent'
                }`}
              >
                <item.icon className="w-[16px] h-[16px]" />
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* User + Logout */}
      <div className="px-2 pb-4 border-t border-sidebar-border pt-3 flex-shrink-0">
        {!collapsed && user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.full_name || user.username}</p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate capitalize">{user.role || 'usuario'}</p>
          </div>
        )}
        <button
          onClick={() => logout(true)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all w-full"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card shadow-lg border border-border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-sidebar transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} relative flex-shrink-0`}>
        <NavContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>
    </>
  );
}