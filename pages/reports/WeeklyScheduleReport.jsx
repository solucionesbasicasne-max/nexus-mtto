import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, parseISO, isSameDay } from 'date-fns';
import { Printer, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const STATUS_STYLES = {
  'Generada': 'bg-slate-100 text-slate-700',
  'Planificada': 'bg-blue-100 text-blue-700',
  'Aprobada': 'bg-indigo-100 text-indigo-700',
  'Programada': 'bg-purple-100 text-purple-700',
  'En proceso': 'bg-amber-100 text-amber-700',
  'Completa': 'bg-emerald-100 text-emerald-700',
  'Revisión': 'bg-orange-100 text-orange-700',
  'Cerrada': 'bg-gray-100 text-gray-600',
};

const TYPE_COLORS = {
  'Preventiva': '#3b82f6',
  'Correctiva': '#ef4444',
  'Predictiva': '#8b5cf6',
  'Mejora': '#10b981',
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function WeeklyScheduleReport() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  const [techFilter, setTechFilter] = useState('all');

  const { data: workOrders = [] } = useQuery({ queryKey: ['workOrders'], queryFn: () => base44.entities.WorkOrder.list('-created_date', 500) });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });

  const baseDate = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const allWeekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekDays = allWeekDays.filter(d => selectedDays.includes(d.getDay()));

  const toggleDay = (dayNum) => {
    setSelectedDays(prev => prev.includes(dayNum) ? prev.filter(d => d !== dayNum) : [...prev, dayNum].sort());
  };

  const getAssetName = (id) => assets.find(a => a.id === id)?.name || '—';
  const getLocName = (id) => locations.find(l => l.id === id)?.name || '—';
  const getEmpName = (id) => employees.find(e => e.id === id)?.full_name || '';

  const technicians = [...new Set(workOrders.map(w => w.assigned_employee_id).filter(Boolean))];

  const filteredWOs = workOrders.filter(w => {
    if (!w.scheduled_date) return false;
    const d = parseISO(w.scheduled_date);
    const inWeek = d >= weekStart && d <= weekEnd;
    const inDays = selectedDays.includes(d.getDay());
    const matchTech = techFilter === 'all' || w.assigned_employee_id === techFilter;
    return inWeek && inDays && matchTech;
  });

  const grouped = {};
  weekDays.forEach(day => {
    const key = format(day, 'yyyy-MM-dd');
    grouped[key] = filteredWOs.filter(w => w.scheduled_date === key || (w.scheduled_date && format(parseISO(w.scheduled_date), 'yyyy-MM-dd') === key));
  });

  // HH indicator
  const totalEstHH = filteredWOs.reduce((s, w) => s + (w.estimated_duration_hours || 0), 0);
  const totalRealHH = filteredWOs.reduce((s, w) => s + (w.actual_duration_hours || 0), 0);
  const weekDaysCount = weekDays.length;
  // Asume 8 horas/día de capacidad disponible por técnico en el periodo
  const uniqueTechs = [...new Set(filteredWOs.map(w => w.assigned_employee_id).filter(Boolean))].length || 1;
  const capacidadHH = weekDaysCount * 8 * uniqueTechs;
  const pctProgramado = capacidadHH > 0 ? Math.min(Math.round((totalEstHH / capacidadHH) * 100), 100) : 0;

  const printReport = () => {
    const rows = filteredWOs.map(w => {
      const emp = employees.find(e => e.id === w.assigned_employee_id);
      return `<tr>
        <td>${w.wo_number || '—'}</td>
        <td>${w.description}</td>
        <td>${w.status}</td>
        <td>${w.wo_type}</td>
        <td>${getAssetName(w.asset_id)}</td>
        <td>${getLocName(w.location_id)}</td>
        <td>${emp?.position || w.responsible_technician || '—'}</td>
        <td>${emp?.department || '—'}</td>
        <td>${emp?.full_name || '—'}</td>
        <td>${w.estimated_duration_hours || '—'}</td>
        <td>${w.actual_duration_hours || '—'}</td>
        ${weekDays.map(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const hasWO = w.scheduled_date && format(parseISO(w.scheduled_date), 'yyyy-MM-dd') === dayKey;
          return `<td style="background:${hasWO ? TYPE_COLORS[w.wo_type] || '#3b82f6' : '#f9fafb'};color:${hasWO ? 'white' : 'transparent'}">${hasWO ? '●' : ''}</td>`;
        }).join('')}
      </tr>`;
    }).join('');

    const dayHeaders = weekDays.map(d => `<th style="min-width:60px;padding:6px 4px;font-size:10px;text-align:center;border:1px solid #e2e8f0;background:#f1f5f9">${DAY_NAMES[d.getDay()]}<br/><b>${format(d, 'd/MM')}</b></th>`).join('');

    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Programa Semanal ${format(weekStart,'dd/MM')} - ${format(weekEnd,'dd/MM/yyyy')}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:10px}
      h2{font-size:14px;margin-bottom:4px}
      p{font-size:10px;color:#666;margin:2px 0}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #e2e8f0;padding:4px 6px;font-size:9px}
      th{background:#1e3a5f;color:white;text-align:left}
      tr:nth-child(even){background:#f9fafb}
      .legend{display:flex;gap:16px;margin-top:8px}
      .legend-item{display:flex;align-items:center;gap:4px;font-size:9px}
      .dot{width:10px;height:10px;border-radius:50%;display:inline-block}
      @media print{body{margin:0}}
    </style></head><body>
    <h2>PROGRAMA SEMANAL DE MANTENIMIENTO</h2>
    <p>Semana: ${format(weekStart,'dd/MM/yyyy')} al ${format(weekEnd,'dd/MM/yyyy')} | Generado: ${format(new Date(),'dd/MM/yyyy HH:mm')}</p>
    <div class="legend">
      ${Object.entries(TYPE_COLORS).map(([t,c]) => `<div class="legend-item"><span class="dot" style="background:${c}"></span>${t}</div>`).join('')}
    </div>
    <table>
      <thead><tr>
        <th>OT</th><th>Descripción</th><th>Estado</th><th>Tipo</th>
        <th>Activo</th><th>Ubicación</th><th>Puesto</th><th>Área</th><th>Técnico</th>
        <th>Est.H</th><th>Real H</th>${dayHeaders}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:12px;display:flex;gap:24px;padding:10px 0;border-top:1px solid #e2e8f0">
      <div><b>HH Programadas:</b> ${totalEstHH.toFixed(1)} hrs</div>
      <div><b>Capacidad Disponible:</b> ${capacidadHH} hrs</div>
      <div><b>HH Ejecutadas:</b> ${totalRealHH.toFixed(1)} hrs</div>
      <div><b>% HH Programadas:</b> <span style="color:${pctProgramado>=80?'#10b981':pctProgramado>=50?'#f59e0b':'#ef4444'};font-weight:bold">${pctProgramado}%</span></div>
    </div>
    <p style="margin-top:4px;color:#999">Total OTs: ${filteredWOs.length}</p>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Programa Semanal</h2>
          <p className="text-sm text-muted-foreground">{filteredWOs.length} órdenes en el período seleccionado</p>
        </div>
        <Button onClick={printReport} variant="outline" className="gap-2 self-start">
          <Printer className="w-4 h-4" />Imprimir Programa
        </Button>
      </div>

      {/* HH Indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">HH Programadas</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalEstHH.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">hrs</span></p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Capacidad Disponible</p>
          <p className="text-2xl font-bold mt-1">{capacidadHH}<span className="text-sm font-normal text-muted-foreground ml-1">hrs</span></p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">HH Ejecutadas</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{totalRealHH.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">hrs</span></p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-2">% HH Programadas</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pctProgramado}%`, backgroundColor: pctProgramado >= 80 ? '#10b981' : pctProgramado >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: pctProgramado >= 80 ? '#10b981' : pctProgramado >= 50 ? '#f59e0b' : '#ef4444' }}>{pctProgramado}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">vs capacidad ({uniqueTechs} técnico{uniqueTechs !== 1 ? 's' : ''})</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-semibold min-w-[180px] text-center">
            {format(weekStart, 'd MMM')} — {format(weekEnd, 'd MMM yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">Hoy</Button>

          <div className="ml-auto">
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Todos los técnicos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los técnicos</SelectItem>
                {technicians.map(id => {
                  const e = employees.find(emp => emp.id === id);
                  return e ? <SelectItem key={id} value={id}>{e.full_name}</SelectItem> : null;
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Day selector */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Días a mostrar</Label>
          <div className="flex gap-2 flex-wrap">
            {allWeekDays.map(day => {
              const dayNum = day.getDay();
              const active = selectedDays.includes(dayNum);
              return (
                <button key={dayNum} onClick={() => toggleDay(dayNum)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${active ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-transparent text-muted-foreground hover:border-primary/40'}`}
                >
                  {DAY_NAMES[dayNum]} {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gantt-style table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="text-left px-3 py-2.5 whitespace-nowrap min-w-[80px]">No. OT</th>
                <th className="text-left px-3 py-2.5 min-w-[180px]">Descripción</th>
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Estado</th>
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Tipo</th>
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Activo</th>
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Técnico</th>
                <th className="text-center px-2 py-2.5 whitespace-nowrap">Est.H</th>
                <th className="text-center px-2 py-2.5 whitespace-nowrap">Real H</th>
                {weekDays.map(day => (
                  <th key={day.toISOString()} className="text-center px-1 py-2.5 min-w-[52px]">
                    <div className="font-semibold">{DAY_NAMES[day.getDay()]}</div>
                    <div className="text-slate-300 font-normal">{format(day, 'd/MM')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredWOs.length === 0 ? (
                <tr><td colSpan={8 + weekDays.length} className="text-center py-10 text-muted-foreground">Sin órdenes en este período</td></tr>
              ) : filteredWOs.map(wo => {
                const emp = employees.find(e => e.id === wo.assigned_employee_id);
                const woDateKey = wo.scheduled_date ? format(parseISO(wo.scheduled_date), 'yyyy-MM-dd') : null;
                return (
                  <tr key={wo.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-mono font-bold text-primary whitespace-nowrap">{wo.wo_number || '—'}</td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <p className="font-medium truncate">{wo.description}</p>
                      <p className="text-muted-foreground text-[10px]">{getLocName(wo.location_id)}</p>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLES[wo.status] || 'bg-muted'}`}>{wo.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: TYPE_COLORS[wo.wo_type] + '20', color: TYPE_COLORS[wo.wo_type] }}>{wo.wo_type}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{getAssetName(wo.asset_id)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {emp?.photo_url && <img src={emp.photo_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />}
                        <span className="truncate max-w-[100px]">{emp?.full_name || wo.responsible_technician || '—'}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center text-muted-foreground">{wo.estimated_duration_hours || '—'}</td>
                    <td className="px-2 py-2 text-center text-muted-foreground">{wo.actual_duration_hours || '—'}</td>
                    {weekDays.map(day => {
                      const dayKey = format(day, 'yyyy-MM-dd');
                      const isScheduled = woDateKey === dayKey;
                      return (
                        <td key={day.toISOString()} className="px-1 py-2 text-center">
                          {isScheduled ? (
                            <div className="w-7 h-5 rounded mx-auto" style={{ backgroundColor: TYPE_COLORS[wo.wo_type] || '#3b82f6' }} />
                          ) : (
                            <div className="w-7 h-5 rounded mx-auto bg-muted/30" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t bg-muted/20 flex flex-wrap gap-4">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="text-xs text-muted-foreground">{type}</span>
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">Total: {filteredWOs.length} OTs</span>
        </div>
      </div>
    </div>
  );
}