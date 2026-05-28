import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfMonth, isSameMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, TrendingUp, DollarSign, Users, Building2, MapPin, Cpu, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_COLORS = {
  'Generada': '#94a3b8', 'Planificada': '#3b82f6', 'Aprobada': '#6366f1',
  'Programada': '#a855f7', 'En proceso': '#f59e0b', 'Completa': '#10b981',
  'Revisión': '#f97316', 'Cerrada': '#6b7280', 'Cancelada': '#ef4444',
};
const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#a855f7','#f97316','#06b6d4','#84cc16'];

const KPI = ({ title, value, sub, icon: Icon, color = 'primary' }) => {
  const colors = {
    primary: 'bg-blue-50 text-blue-600 border-blue-100',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    warning: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default function AnalyticsDashboard() {
  const { data: workOrders = [] } = useQuery({ queryKey: ['workOrders'], queryFn: () => base44.entities.WorkOrder.list('-created_date', 200) });
  const { data: resources = [] } = useQuery({ queryKey: ['allResources'], queryFn: () => base44.entities.WOResource.list('-created_date', 500) });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: businessUnits = [] } = useQuery({ queryKey: ['businessUnits'], queryFn: () => base44.entities.BusinessUnit.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: () => base44.entities.MaintenancePlan.list() });
  const { data: preventive = [] } = useQuery({ queryKey: ['preventive'], queryFn: () => base44.entities.PreventiveMaintenance.list() });

  // 1. WOs por estado
  const statusData = Object.entries(
    workOrders.reduce((acc, wo) => { acc[wo.status] = (acc[wo.status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] || '#94a3b8' }));

  // 2. Tiempo promedio por técnico
  const completedWOs = workOrders.filter(w => w.actual_duration_hours && w.assigned_employee_id);
  const techMap = completedWOs.reduce((acc, wo) => {
    const emp = employees.find(e => e.id === wo.assigned_employee_id);
    const name = emp ? emp.full_name.split(' ').slice(0, 2).join(' ') : wo.responsible_technician || 'N/A';
    if (!acc[name]) acc[name] = { total: 0, count: 0 };
    acc[name].total += wo.actual_duration_hours;
    acc[name].count += 1;
    return acc;
  }, {});
  const techData = Object.entries(techMap).map(([name, v]) => ({
    name, promedio: parseFloat((v.total / v.count).toFixed(1)), ordenes: v.count
  }));

  // 3. Costos mensuales por tipo de recurso
  const last6months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d;
  });
  const monthlyCosts = last6months.map(month => {
    const label = format(month, 'MMM');
    const monthWOs = workOrders.filter(w => w.created_date && isSameMonth(parseISO(w.created_date), month));
    const woIds = new Set(monthWOs.map(w => w.id));
    const monthRes = resources.filter(r => woIds.has(r.wo_id));
    return {
      mes: label,
      'Mano de Obra': monthRes.filter(r => r.resource_type === 'Mano de Obra').reduce((s, r) => s + (r.actual_cost || 0), 0),
      'Refacciones': monthRes.filter(r => r.resource_type === 'Refacción').reduce((s, r) => s + (r.actual_cost || 0), 0),
      'Servicios': monthRes.filter(r => r.resource_type === 'Servicio').reduce((s, r) => s + (r.actual_cost || 0), 0),
    };
  });

  const totalCost = resources.reduce((s, r) => s + (r.actual_cost || 0), 0);
  const openWOs = workOrders.filter(w => !['Completa', 'Cerrada', 'Cancelada'].includes(w.status)).length;
  const completedCount = workOrders.filter(w => w.status === 'Completa' || w.status === 'Cerrada').length;
  const avgDuration = completedWOs.length > 0
    ? (completedWOs.reduce((s, w) => s + w.actual_duration_hours, 0) / completedWOs.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Indicadores clave para toma de decisiones de mantenimiento</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="OTs Abiertas" value={openWOs} icon={ClipboardList} color="warning" sub={`${workOrders.length} total`} />
        <KPI title="OTs Completadas" value={completedCount} icon={TrendingUp} color="success" sub="acumulado" />
        <KPI title="Duración Promedio" value={`${avgDuration}h`} icon={Users} color="primary" sub="por orden" />
        <KPI title="Costo Total Recursos" value={`$${totalCost.toLocaleString()}`} icon={DollarSign} color="purple" sub="acumulado" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie - WOs por Estado */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Órdenes de Trabajo por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1">
                  {statusData.map(s => (
                    <div key={s.name} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.fill }} />
                        <span className="text-xs text-muted-foreground">{s.name}</span>
                      </div>
                      <span className="text-sm font-bold">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar - Tiempo Promedio por Técnico */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tiempo Promedio de Reparación por Técnico</CardTitle>
          </CardHeader>
          <CardContent>
            {techData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin OTs completadas con duración registrada</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={techData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `${v}h`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, n) => [`${v}h`, n === 'promedio' ? 'Promedio' : 'Órdenes']} />
                  <Bar dataKey="promedio" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Promedio" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart Row 2 - Costos mensuales */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Costos Mensuales de Recursos Consumidos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyCosts} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `$${v.toLocaleString()}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, undefined]} />
              <Legend />
              <Bar dataKey="Mano de Obra" fill="#3b82f6" radius={[3,3,0,0]} stackId="a" />
              <Bar dataKey="Refacciones" fill="#f59e0b" radius={[3,3,0,0]} stackId="a" />
              <Bar dataKey="Servicios" fill="#10b981" radius={[3,3,0,0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hierarchy Summary */}
      <div>
        <h2 className="text-lg font-bold mb-4">Resumen de Jerarquía Organizacional</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <HierarchyCard title="Empresas" icon={Building2} items={companies} getLabel={c => c.name} color="blue" link="/hierarchy/companies" />
          <HierarchyCard title="Sitios / Plantas" icon={MapPin} items={sites} getLabel={s => s.name} color="emerald" link="/hierarchy/sites" />
          <HierarchyCard title="Activos" icon={Cpu} items={assets} getLabel={a => `${a.code} — ${a.name}`} color="amber" link="/hierarchy/assets" />
          <HierarchyCard title="Ubic. / Áreas" icon={Package} items={locations} getLabel={l => l.name} color="purple" link="/hierarchy/locations" />
        </div>
      </div>

      {/* Plans + Preventive */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Planes de Mantenimiento */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Planes de Mantenimiento</CardTitle>
            <Badge variant="outline">{plans.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin planes registrados</p>
            ) : plans.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.maintenance_type} · {p.estimated_duration_hours}h est.</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  p.priority === 'Crítica' ? 'bg-red-100 text-red-700 border-red-200' :
                  p.priority === 'Alta' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                  p.priority === 'Media' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  'bg-green-100 text-green-700 border-green-200'
                }`}>{p.priority}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Mantenimientos Preventivos */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Mantenimientos Preventivos</CardTitle>
            <Badge variant="outline">{preventive.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {preventive.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin MPs registrados</p>
            ) : preventive.map(mp => {
              const asset = assets.find(a => a.id === mp.asset_id);
              const today = format(new Date(), 'yyyy-MM-dd');
              const overdue = mp.next_mp_date && mp.next_mp_date < today;
              return (
                <div key={mp.id} className={`flex items-center justify-between p-3 rounded-lg text-sm border ${overdue ? 'bg-red-50 border-red-100' : 'bg-muted/30 border-transparent'}`}>
                  <div>
                    <p className="font-medium">{mp.name}</p>
                    <p className="text-xs text-muted-foreground">{asset?.name || '—'} · c/{ mp.frequency_days}d · próx: {mp.next_mp_date || 'N/A'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    mp.status === 'Activo' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    mp.status === 'Pausado' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-muted text-muted-foreground border-border'
                  }`}>{overdue ? '⚠️ Vencido' : mp.status}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Work Orders table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Órdenes de Trabajo — Detalle</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  {['No. OT', 'Descripción', 'Tipo', 'Técnico', 'Estado', 'Prioridad', 'Duración', 'Costo'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {workOrders.map(wo => {
                  const woResources = resources.filter(r => r.wo_id === wo.id);
                  const cost = woResources.reduce((s, r) => s + (r.actual_cost || 0), 0);
                  return (
                    <tr key={wo.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5"><Link to={`/work-orders/${wo.id}`} className="font-mono text-xs font-bold text-primary hover:underline">{wo.wo_number}</Link></td>
                      <td className="px-4 py-2.5 max-w-[200px]"><p className="text-sm truncate">{wo.description}</p></td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{wo.wo_type}</td>
                      <td className="px-4 py-2.5 text-sm">{wo.responsible_technician || '—'}</td>
                      <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={{ backgroundColor: `${STATUS_COLORS[wo.status]}22`, color: STATUS_COLORS[wo.status], borderColor: `${STATUS_COLORS[wo.status]}44` }}>{wo.status}</span></td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${wo.priority === 'Crítica' ? 'bg-red-100 text-red-700 border-red-200' : wo.priority === 'Alta' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>{wo.priority}</span></td>
                      <td className="px-4 py-2.5 text-sm font-mono">{wo.actual_duration_hours ? `${wo.actual_duration_hours}h` : '—'}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold">{cost > 0 ? `$${cost.toLocaleString()}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HierarchyCard({ title, icon: Icon, items, getLabel, color, link }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colors[color]}`}><Icon className="w-4 h-4" /></div>
            <CardTitle className="text-sm">{title}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-48 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Sin registros. <Link to={link} className="text-primary hover:underline">Agregar →</Link></p>
        ) : items.slice(0, 8).map(item => (
          <div key={item.id} className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-md truncate">
            {getLabel(item)}
          </div>
        ))}
        {items.length > 8 && <p className="text-xs text-primary text-center pt-1">+{items.length - 8} más</p>}
      </CardContent>
    </Card>
  );
}