import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ClipboardList, CalendarClock, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import KPICard from '@/components/shared/KPICard';
import StatusBadge from '@/components/shared/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: workOrders = [] } = useQuery({ queryKey: ['workOrders'], queryFn: () => base44.entities.WorkOrder.list('-created_date', 100) });
  const { data: mps = [] } = useQuery({ queryKey: ['preventive'], queryFn: () => base44.entities.PreventiveMaintenance.list('-created_date', 100) });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });

  const today = new Date().toISOString().split('T')[0];

  const openWOs = workOrders.filter(w => w.status === 'Pendiente' || w.status === 'En Proceso');
  const completedWOs = workOrders.filter(w => w.status === 'Completada');
  const overdueWOs = workOrders.filter(w => w.status === 'Pendiente' && w.scheduled_date && w.scheduled_date < today);

  const activeMPs = mps.filter(m => m.status === 'Activo');
  const overdueMPs = mps.filter(m => m.status === 'Activo' && m.next_mp_date && m.next_mp_date < today);

  const avgDuration = completedWOs.length > 0
    ? (completedWOs.reduce((sum, w) => sum + (w.actual_duration_hours || 0), 0) / completedWOs.length).toFixed(1)
    : '0';

  const statusCounts = [
    { name: 'Pendiente', value: workOrders.filter(w => w.status === 'Pendiente').length, color: '#f59e0b' },
    { name: 'En Proceso', value: workOrders.filter(w => w.status === 'En Proceso').length, color: '#3b82f6' },
    { name: 'Completada', value: workOrders.filter(w => w.status === 'Completada').length, color: '#10b981' },
    { name: 'Cancelada', value: workOrders.filter(w => w.status === 'Cancelada').length, color: '#9ca3af' },
  ].filter(s => s.value > 0);

  const recentWOs = [...workOrders].slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Resumen general del sistema de mantenimiento</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="OTs Abiertas" value={openWOs.length} icon={ClipboardList} color="primary" subtitle={`${overdueWOs.length} atrasadas`} />
        <KPICard title="MPs Activos" value={activeMPs.length} icon={CalendarClock} color="success" subtitle={`${overdueMPs.length} vencidos`} />
        <KPICard title="Tiempo Prom. Reparación" value={`${avgDuration}h`} icon={Clock} color="warning" />
        <KPICard title="Total Activos" value={assets.length} icon={TrendingUp} color="purple" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Órdenes de Trabajo Recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentWOs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin órdenes de trabajo</p>
              ) : recentWOs.map(wo => (
                <Link to={`/work-orders/${wo.id}`} key={wo.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{wo.wo_number || 'OT'} — {wo.description}</p>
                    <p className="text-xs text-muted-foreground">{wo.scheduled_date ? format(parseISO(wo.scheduled_date), 'dd/MM/yyyy') : 'Sin fecha'}</p>
                  </div>
                  <StatusBadge status={wo.status} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Estado de OTs</CardTitle>
          </CardHeader>
          <CardContent>
            {statusCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {statusCounts.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {statusCounts.map(s => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-muted-foreground">{s.name}: {s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {(overdueWOs.length > 0 || overdueMPs.length > 0) && (
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueWOs.length > 0 && (
              <p className="text-sm text-amber-700">⚠️ {overdueWOs.length} orden(es) de trabajo atrasada(s)</p>
            )}
            {overdueMPs.length > 0 && (
              <p className="text-sm text-amber-700">⚠️ {overdueMPs.length} mantenimiento(s) preventivo(s) vencido(s)</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}