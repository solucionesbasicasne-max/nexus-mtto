import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, isSameDay, parseISO } from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Loader2, User, Calendar, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const STATUS_COLORS = {
  'Asistencia': 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  'Retardo': 'bg-amber-500/15 text-amber-700 border-amber-200',
  'Falta': 'bg-red-500/15 text-red-700 border-red-200',
  'Justificada': 'bg-blue-500/15 text-blue-700 border-blue-200',
};

const STATUS_DOT = {
  'Asistencia': 'bg-emerald-500',
  'Retardo': 'bg-amber-500',
  'Falta': 'bg-red-500',
  'Justificada': 'bg-blue-500',
};

export default function AttendanceControl() {
  const [view, setView] = useState('calendar');
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });
  const { data: records = [], isLoading } = useQuery({ queryKey: ['attendance'], queryFn: () => base44.entities.AttendanceRecord.list('-date', 500) });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.AttendanceRecord.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); setShowForm(false); toast.success('Registro guardado'); }
  });

  const baseDate = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getRecord = (empId, day) => records.find(r =>
    r.employee_id === empId &&
    String(r.date || '').substring(0, 10) === format(day, 'yyyy-MM-dd')
  );

  const filteredEmployees = selectedEmployee === 'all' ? employees.filter(e => e.status === 'Activo') : employees.filter(e => e.id === selectedEmployee);

  const weekStats = {
    total: records.filter(r => {
      const d = parseISO(String(r.date || '').substring(0, 10));
      return d >= weekStart && d <= weekEnd;
    }).length,
    asistencia: records.filter(r => { const d = parseISO(String(r.date || '').substring(0, 10)); return d >= weekStart && d <= weekEnd && r.status === 'Asistencia'; }).length,
    retardos:   records.filter(r => { const d = parseISO(String(r.date || '').substring(0, 10)); return d >= weekStart && d <= weekEnd && r.status === 'Retardo'; }).length,
    faltas:     records.filter(r => { const d = parseISO(String(r.date || '').substring(0, 10)); return d >= weekStart && d <= weekEnd && r.status === 'Falta'; }).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Control de Asistencia</h2>
          <p className="text-sm text-muted-foreground">Registro y seguimiento de asistencia del personal</p>
        </div>
        <Button onClick={() => { setForm({ status: 'Asistencia', date: format(new Date(), 'yyyy-MM-dd'), check_in: '08:00' }); setShowForm(true); }} className="gap-2 self-start">
          <Plus className="w-4 h-4" />Registrar Asistencia
        </Button>
      </div>

      {/* Week Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Registros sem.', value: weekStats.total, color: 'text-foreground' },
          { label: 'Asistencias', value: weekStats.asistencia, color: 'text-emerald-600' },
          { label: 'Retardos', value: weekStats.retardos, color: 'text-amber-600' },
          { label: 'Faltas', value: weekStats.faltas, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border p-4">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2"><Calendar className="w-3.5 h-3.5" />Semana</TabsTrigger>
            <TabsTrigger value="list" className="gap-2"><List className="w-3.5 h-3.5" />Lista</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {format(weekStart, 'd MMM')} — {format(weekEnd, 'd MMM yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">Hoy</Button>
        </div>
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos los empleados" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {employees.filter(e => e.status === 'Activo').map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Empleado</th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} className={`text-center px-2 py-3 text-xs font-semibold uppercase min-w-[80px] ${isSameDay(day, new Date()) ? 'text-primary' : 'text-muted-foreground'}`}>
                      <div>{format(day, 'EEE')}</div>
                      <div className={`text-base font-bold mt-0.5 ${isSameDay(day, new Date()) ? 'text-primary' : 'text-foreground'}`}>{format(day, 'd')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {emp.photo_url ? <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="w-3.5 h-3.5 text-muted-foreground" /></div>}
                        </div>
                        <span className="text-sm font-medium truncate max-w-[120px]">{emp.full_name}</span>
                      </div>
                    </td>
                    {weekDays.map(day => {
                      const rec = getRecord(emp.id, day);
                      return (
                        <td key={day.toISOString()} className="text-center px-1 py-2">
                          {rec ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${STATUS_DOT[rec.status] || 'bg-muted-foreground'}`} />
                              <span className="text-[10px] font-medium text-muted-foreground">{rec.status?.substring(0, 3)}</span>
                            </div>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-border mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-border flex flex-wrap gap-4">
            {Object.entries(STATUS_DOT).map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Empleado', 'Fecha', 'Entrada', 'Salida', 'Estado', 'Notas'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.slice(0, 100).map(rec => {
                  const emp = employees.find(e => e.id === rec.employee_id);
                  return (
                    <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {emp?.photo_url ? <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="w-3 h-3 text-muted-foreground" /></div>}
                          </div>
                          <span className="text-sm font-medium">{emp?.full_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm">{rec.date || '—'}</td>
                      <td className="px-4 py-2.5 text-sm font-mono">{rec.check_in || '—'}</td>
                      <td className="px-4 py-2.5 text-sm font-mono">{rec.check_out || '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-[11px] px-2 border ${STATUS_COLORS[rec.status]}`}>{rec.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground max-w-[160px] truncate">{rec.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {records.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin registros de asistencia</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Asistencia</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Empleado *</Label>
              <Select value={form.employee_id || ''} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>{employees.filter(e => e.status === 'Activo').map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fecha *</Label><Input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></div>
              <div>
                <Label>Estado *</Label>
                <Select value={form.status || 'Asistencia'} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Asistencia', 'Retardo', 'Falta', 'Justificada'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Hora Entrada</Label><Input type="time" value={form.check_in || ''} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} /></div>
              <div><Label>Hora Salida</Label><Input type="time" value={form.check_out || ''} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} /></div>
            </div>
            <div><Label>Notas</Label><Input value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}