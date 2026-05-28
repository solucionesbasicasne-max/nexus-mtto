import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/shared/EmptyState';
import { GanttChart as GanttIcon } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfDay, addDays, max, min } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const STATUS_COLORS = {
  'Generada':   '#64748b',
  'Planificada':'#3b82f6',
  'Aprobada':   '#6366f1',
  'Programada': '#8b5cf6',
  'En proceso': '#f59e0b',
  'Completa':   '#10b981',
  'Revisión':   '#f97316',
  'Cerrada':    '#6b7280',
  'Pendiente':  '#ef4444',
  'Completada': '#10b981',
  'Cancelada':  '#9ca3af',
};

const STATUS_LABELS = Object.keys(STATUS_COLORS);

const DAY_WIDTH = 48; // px per day

export default function GanttChartPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [dragging, setDragging] = useState(null); // { woId, startX, origDate }
  const containerRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['workOrders'],
    queryFn: () => base44.entities.WorkOrder.list('-scheduled_date', 200)
  });
  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => base44.entities.Asset.list()
  });

  const updateWO = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      toast.success('Fecha actualizada');
    },
  });

  const getAssetName = (id) => assets.find(a => a.id === id)?.name || '';

  const filtered = useMemo(() => {
    return workOrders.filter(wo => {
      if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
      if (techFilter !== 'all' && wo.responsible_technician !== techFilter) return false;
      return wo.scheduled_date || wo.actual_start_date;
    });
  }, [workOrders, statusFilter, techFilter]);

  const technicians = [...new Set(workOrders.map(w => w.responsible_technician).filter(Boolean))];

  const { startDate, totalDays } = useMemo(() => {
    if (filtered.length === 0) return { startDate: new Date(), totalDays: 30 };
    const dates = filtered.flatMap(wo => {
      const d = [];
      if (wo.scheduled_date) d.push(parseISO(wo.scheduled_date));
      if (wo.actual_start_date) d.push(parseISO(wo.actual_start_date));
      if (wo.actual_end_date) d.push(parseISO(wo.actual_end_date));
      return d;
    });
    const s = startOfDay(addDays(min(dates), -1));
    const e = startOfDay(addDays(max(dates), 5));
    return { startDate: s, totalDays: Math.max(differenceInDays(e, s), 14) };
  }, [filtered]);

  const dayHeaders = useMemo(() => {
    return Array.from({ length: totalDays + 1 }, (_, i) => addDays(startDate, i));
  }, [startDate, totalDays]);

  const todayOffset = differenceInDays(startOfDay(new Date()), startDate);

  const getBarProps = (wo) => {
    const woStart = wo.actual_start_date
      ? parseISO(wo.actual_start_date)
      : wo.scheduled_date ? parseISO(wo.scheduled_date) : null;
    if (!woStart) return null;
    const woEnd = wo.actual_end_date
      ? parseISO(wo.actual_end_date)
      : wo.estimated_duration_hours
        ? addDays(woStart, Math.max(Math.ceil(wo.estimated_duration_hours / 8), 1))
        : addDays(woStart, 1);

    const left = differenceInDays(startOfDay(woStart), startDate) * DAY_WIDTH;
    const width = Math.max(differenceInDays(startOfDay(woEnd), startOfDay(woStart)), 1) * DAY_WIDTH;
    const color = STATUS_COLORS[wo.status] || '#9ca3af';
    return { left, width, color };
  };

  // Drag handlers
  const handleMouseDown = useCallback((e, wo) => {
    e.preventDefault();
    const barProps = getBarProps(wo);
    if (!barProps) return;
    setDragging({ woId: wo.id, startX: e.clientX, origLeft: barProps.left, origDate: wo.scheduled_date || (wo.actual_start_date ? wo.actual_start_date.slice(0, 10) : null) });
  }, [startDate, workOrders]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const delta = e.clientX - dragging.startX;
    const daysDelta = Math.round(delta / DAY_WIDTH);
    // Update DOM directly for smooth drag
    const bar = document.getElementById(`bar-${dragging.woId}`);
    if (bar) {
      bar.style.left = `${dragging.origLeft + daysDelta * DAY_WIDTH}px`;
    }
  }, [dragging]);

  const handleMouseUp = useCallback((e) => {
    if (!dragging) return;
    const delta = e.clientX - dragging.startX;
    const daysDelta = Math.round(delta / DAY_WIDTH);
    if (daysDelta !== 0 && dragging.origDate) {
      const origDate = parseISO(dragging.origDate.slice(0, 10));
      const newDate = format(addDays(origDate, daysDelta), 'yyyy-MM-dd');
      updateWO.mutate({ id: dragging.woId, data: { scheduled_date: newDate } });
    }
    setDragging(null);
  }, [dragging, updateWO]);

  const totalWidth = (totalDays + 1) * DAY_WIDTH;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Diagrama de Gantt</h1>
        <p className="text-sm text-muted-foreground">Arrastra las barras para reprogramar órdenes de trabajo</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label className="text-xs">Estado</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_LABELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Técnico</Label>
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {technicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Legend */}
        <div className="ml-auto flex flex-wrap gap-2">
          {Object.entries(STATUS_COLORS).slice(0, 8).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: c }} />
              {s}
            </div>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={GanttIcon} title="Sin datos para Gantt" description="No hay OTs con fechas programadas" />
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div
            className="overflow-x-auto select-none"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div style={{ minWidth: `${256 + totalWidth}px` }}>
              {/* Day header */}
              <div className="flex border-b bg-muted/40 sticky top-0 z-20">
                <div className="w-64 flex-shrink-0 border-r p-2 text-xs font-semibold text-muted-foreground">Orden de Trabajo</div>
                <div className="relative" style={{ width: totalWidth }}>
                  <div className="flex">
                    {dayHeaders.map((day, i) => {
                      const isToday = differenceInDays(day, startOfDay(new Date())) === 0;
                      return (
                        <div
                          key={i}
                          className={`text-center py-1.5 text-[10px] border-r flex-shrink-0 ${isToday ? 'bg-blue-50 font-bold text-blue-700' : 'text-muted-foreground'}`}
                          style={{ width: DAY_WIDTH }}
                        >
                          {i === 0 || day.getDate() === 1
                            ? <div className="font-semibold uppercase">{format(day, 'dd MMM', { locale: es })}</div>
                            : format(day, 'dd', { locale: es })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rows */}
              {filtered.map((wo, rowIdx) => {
                const barProps = getBarProps(wo);
                return (
                  <div key={wo.id} className={`flex border-b transition-colors ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-muted/10'} hover:bg-blue-50/30`}>
                    {/* Label */}
                    <div className="w-64 flex-shrink-0 border-r p-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-primary font-mono">{wo.wo_number}</span>
                        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[wo.status] || '#ccc' }} />
                      </div>
                      <p className="text-[11px] text-foreground font-medium truncate leading-tight">{wo.description}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{getAssetName(wo.asset_id)}</p>
                    </div>

                    {/* Bar area */}
                    <div className="relative" style={{ width: totalWidth, height: 56 }}>
                      {/* Today vertical line */}
                      {todayOffset >= 0 && todayOffset <= totalDays && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10 opacity-60"
                          style={{ left: todayOffset * DAY_WIDTH }}
                        />
                      )}
                      {/* Grid verticals */}
                      {dayHeaders.map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 w-px bg-border/30" style={{ left: i * DAY_WIDTH }} />
                      ))}
                      {/* Draggable bar */}
                      {barProps && (
                        <div
                          id={`bar-${wo.id}`}
                          className="absolute top-3 h-8 rounded-lg shadow flex items-center px-2.5 text-[10px] text-white font-semibold cursor-grab active:cursor-grabbing truncate z-20 select-none"
                          style={{
                            left: barProps.left,
                            width: Math.max(barProps.width, 60),
                            backgroundColor: barProps.color,
                            userSelect: 'none',
                          }}
                          onMouseDown={(e) => handleMouseDown(e, wo)}
                          title={`${wo.wo_number} — ${wo.status}\nArrastra para reprogramar`}
                        >
                          {wo.wo_number}
                          {barProps.width > 80 && <span className="ml-1 opacity-80 font-normal truncate">{wo.status}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}