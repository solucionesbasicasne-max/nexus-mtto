import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { Activity, Clock, Wrench, TrendingUp, AlertTriangle, CheckCircle2, BarChart2, Zap } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];

function KPIGauge({ value, max = 100, label, unit = '%', color }) {
  const pct = Math.min((value / max) * 100, 100);
  const c = color || (pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444');
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="60" viewBox="0 0 100 60">
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke={c}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 125.7} 125.7`}
        />
        <text x="50" y="52" textAnchor="middle" fontSize="14" fontWeight="bold" fill={c}>
          {typeof value === 'number' ? value.toFixed(1) : value}{unit}
        </text>
      </svg>
      <p className="text-xs text-muted-foreground text-center leading-tight">{label}</p>
    </div>
  );
}

function KPICard({ title, value, unit, icon: IconComp, color, subtitle, trend }) {
  const Icon = IconComp;
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1" style={{ color }}>{value}<span className="text-base font-normal text-muted-foreground ml-1">{unit}</span></p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20' }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(trend, 100)}%`, backgroundColor: color }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function KPIsDashboard() {
  const [months, setMonths] = useState('3');

  const { data: workOrders = [] } = useQuery({ queryKey: ['workOrders'], queryFn: () => base44.entities.WorkOrder.list('-created_date', 500) });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });
  const { data: mps = [] } = useQuery({ queryKey: ['preventive'], queryFn: () => base44.entities.PreventiveMaintenance.list() });

  const periodStart = subMonths(new Date(), parseInt(months));
  const periodWOs = workOrders.filter(w => w.request_date && parseISO(w.request_date) >= periodStart);

  const closedWOs = periodWOs.filter(w => ['Completa','Cerrada','Completada'].includes(w.status));
  const totalWOs = periodWOs.length;

  // --- KPIs de Gestión ---
  // 1. % Cumplimiento de OTs
  const pctCumplimiento = totalWOs > 0 ? (closedWOs.length / totalWOs) * 100 : 0;

  // 2. MTTR - Mean Time To Repair (hrs promedio de duración real)
  const withDuration = closedWOs.filter(w => w.actual_duration_hours > 0);
  const mttr = withDuration.length > 0 ? withDuration.reduce((s, w) => s + w.actual_duration_hours, 0) / withDuration.length : 0;

  // 3. Disponibilidad de equipos: (hrs periodo - hrs paro) / hrs periodo * 100
  const periodDays = parseInt(months) * 30;
  const periodHours = periodDays * 24;
  const totalShutdownHrs = periodWOs.reduce((s, w) => s + (w.equipment_shutdown_hours || 0), 0);
  const disponibilidad = periodHours > 0 ? Math.max(((periodHours - totalShutdownHrs) / periodHours) * 100, 0) : 100;

  // 4. % OTs Preventivas vs Correctivas
  const preventivas = periodWOs.filter(w => w.wo_type === 'Preventiva').length;
  const correctivas = periodWOs.filter(w => w.wo_type === 'Correctiva').length;
  const pctPreventivo = totalWOs > 0 ? (preventivas / totalWOs) * 100 : 0;

  // 5. % HH Programadas (estimadas vs real)
  const totalEstHH = periodWOs.reduce((s, w) => s + (w.estimated_duration_hours || 0), 0);
  const totalRealHH = closedWOs.reduce((s, w) => s + (w.actual_duration_hours || 0), 0);
  const pctEjecucion = totalEstHH > 0 ? (totalRealHH / totalEstHH) * 100 : 0;

  // 6. Costo total
  const totalCost = periodWOs.reduce((s, w) => s + (w.total_cost || 0), 0);

  // Monthly trend
  const monthsRange = eachMonthOfInterval({ start: periodStart, end: new Date() });
  const monthlyData = monthsRange.map(m => {
    const mStart = startOfMonth(m);
    const mEnd = endOfMonth(m);
    const mWOs = workOrders.filter(w => {
      if (!w.request_date) return false;
      const d = parseISO(w.request_date);
      return d >= mStart && d <= mEnd;
    });
    const mClosed = mWOs.filter(w => ['Completa','Cerrada','Completada'].includes(w.status));
    const mShutdown = mWOs.reduce((s, w) => s + (w.equipment_shutdown_hours || 0), 0);
    const mHours = 30 * 24;
    return {
      mes: format(m, 'MMM yy', { locale: es }),
      OTs: mWOs.length,
      Cerradas: mClosed.length,
      'Disponibilidad%': mHours > 0 ? parseFloat(Math.max(((mHours - mShutdown) / mHours) * 100, 0).toFixed(1)) : 100,
    };
  });

  // Type distribution
  const typeDist = ['Preventiva','Correctiva','Predictiva','Mejora'].map(t => ({
    name: t,
    value: periodWOs.filter(w => w.wo_type === t).length,
  })).filter(d => d.value > 0);

  // Top assets by shutdown hours
  const assetShutdown = {};
  periodWOs.forEach(w => {
    if (w.asset_id && w.equipment_shutdown_hours > 0) {
      assetShutdown[w.asset_id] = (assetShutdown[w.asset_id] || 0) + w.equipment_shutdown_hours;
    }
  });
  const topAssets = Object.entries(assetShutdown)
    .map(([id, hrs]) => ({ name: assets.find(a => a.id === id)?.name || id, hrs }))
    .sort((a, b) => b.hrs - a.hrs)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart2 className="w-6 h-6 text-primary" />Indicadores de Gestión — KPIs</h1>
          <p className="text-sm text-muted-foreground">Panel de desempeño del mantenimiento</p>
        </div>
        <div>
          <Label className="text-xs">Período</Label>
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mes</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Último año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Gauges row */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            <KPIGauge value={pctCumplimiento} label="Cumplimiento OTs" />
            <KPIGauge value={disponibilidad} label="Disponibilidad Equipos" />
            <KPIGauge value={pctPreventivo} label="% Preventivo" color="#3b82f6" />
            <KPIGauge value={pctEjecucion} label="Ejecución HH" color="#8b5cf6" />
            <KPIGauge value={mttr} max={24} label="MTTR (hrs prom.)" unit="h" color="#f59e0b" />
            <KPIGauge value={Math.min((closedWOs.length / Math.max(totalWOs, 1)) * 100, 100)} label="OTs Cerradas" color="#10b981" />
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="OTs en el Período" value={totalWOs} icon={ClipboardList_} color="#3b82f6" subtitle={`${closedWOs.length} cerradas`} trend={pctCumplimiento} />
        <KPICard title="Disponibilidad" value={disponibilidad.toFixed(1)} unit="%" icon={Zap} color={disponibilidad >= 90 ? '#10b981' : disponibilidad >= 75 ? '#f59e0b' : '#ef4444'} subtitle={`${totalShutdownHrs.toFixed(1)} hrs de paro`} trend={disponibilidad} />
        <KPICard title="HH Estimadas" value={totalEstHH.toFixed(0)} unit="hrs" icon={Clock} color="#8b5cf6" subtitle={`${totalRealHH.toFixed(0)} hrs reales`} trend={pctEjecucion} />
        <KPICard title="Costo Total" value={`$${(totalCost/1000).toFixed(1)}k`} unit="" icon={TrendingUp} color="#f59e0b" subtitle={`${totalWOs} órdenes`} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly OT trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">OTs por Mes</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="OTs" fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="Cerradas" fill="#10b981" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Availability trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Disponibilidad de Equipos (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Disponibilidad']} />
                <Line type="monotone" dataKey="Disponibilidad%" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Type distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribución por Tipo de OT</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={typeDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {typeDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {typeDist.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-semibold">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top assets by shutdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Activos con Mayor Tiempo de Paro</CardTitle></CardHeader>
          <CardContent>
            {topAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500" />
                <p className="text-sm">Sin paros registrados en el período</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topAssets.map((a, i) => {
                  const maxHrs = topAssets[0].hrs;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium truncate max-w-[180px]">{a.name}</span>
                        <span className="text-muted-foreground ml-2 flex-shrink-0">{a.hrs.toFixed(1)} hrs</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(a.hrs / maxHrs) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Formula note */}
      <Card className="border-0 shadow-sm bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground font-semibold mb-2">📐 Fórmulas de Cálculo</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div><span className="font-medium text-foreground">Disponibilidad</span> = (Hrs. Período − Hrs. Paro) / Hrs. Período × 100</div>
            <div><span className="font-medium text-foreground">MTTR</span> = Σ Hrs. Reales de Reparación / Nº OTs Cerradas</div>
            <div><span className="font-medium text-foreground">% Cumplimiento</span> = OTs Cerradas / Total OTs × 100</div>
            <div><span className="font-medium text-foreground">% Preventivo</span> = OTs Preventivas / Total OTs × 100</div>
            <div><span className="font-medium text-foreground">Ejecución HH</span> = HH Reales / HH Estimadas × 100</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mini alias to avoid import issue
function ClipboardList_({ className, style }) {
  return <svg xmlns="http://www.w3.org/2000/svg" className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>;
}