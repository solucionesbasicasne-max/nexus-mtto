import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_COLORS_ON = ['bg-blue-500 text-white', 'bg-emerald-500 text-white', 'bg-emerald-500 text-white', 'bg-emerald-500 text-white', 'bg-emerald-500 text-white', 'bg-emerald-500 text-white', 'bg-amber-500 text-white'];

const DEFAULT_FORM = {
  name: '', code: '', start_time: '07:00', end_time: '15:00', daily_hours: 8,
  work_days: [1, 2, 3, 4, 5], rest_days: [0, 6], color: '#3b82f6', is_active: true
};

export default function ShiftConfig() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const queryClient = useQueryClient();

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => base44.entities.Shift.list()
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Shift.update(editing.id, data)
      : base44.entities.Shift.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setShowForm(false);
      toast.success(editing ? 'Turno actualizado' : 'Turno creado');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Shift.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Turno eliminado'); }
  });

  const openEdit = (shift) => {
    setEditing(shift);
    setForm({ ...DEFAULT_FORM, ...shift });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  };

  const toggleDay = (day, field) => {
    const arr = form[field] || [];
    const newArr = arr.includes(day) ? arr.filter(d => d !== day) : [...arr, day];
    setForm(f => ({ ...f, [field]: newArr }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuración de Turnos</h2>
          <p className="text-sm text-muted-foreground">Define turnos laborales, días de trabajo y descanso</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nuevo Turno</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin turnos configurados</p>
          <p className="text-sm mt-1">Crea el primer turno de trabajo</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map(shift => (
            <div key={shift.id} className="bg-card border rounded-xl p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: shift.color || '#3b82f6' }} />
                  <div>
                    <p className="font-bold text-base">{shift.name}</p>
                    {shift.code && <p className="text-xs text-muted-foreground font-mono">{shift.code}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(shift)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(shift.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono font-semibold">{shift.start_time} — {shift.end_time}</span>
                <span className="text-muted-foreground ml-auto">{shift.daily_hours}h/día</span>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Días laborales</p>
                <div className="flex gap-1">
                  {DAY_LABELS.map((d, i) => {
                    const isWork = (shift.work_days || []).includes(i);
                    return (
                      <span key={i} className={`w-7 h-7 rounded-md text-[10px] font-bold flex items-center justify-center transition-all ${isWork ? DAY_COLORS_ON[i] : 'bg-muted text-muted-foreground'}`}>{d.substring(0,2)}</span>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-xs text-muted-foreground">{(shift.work_days || []).length} días laborales / semana</span>
                <Badge className={shift.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground'}>
                  {shift.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Turno' : 'Nuevo Turno'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Nombre del Turno *</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Ej: Turno Matutino" required /></div>
              <div><Label>Código</Label><Input value={form.code || ''} onChange={e => setForm(f => ({...f, code: e.target.value}))} placeholder="Ej: T1" /></div>
              <div><Label>Color</Label><input type="color" value={form.color || '#3b82f6'} onChange={e => setForm(f => ({...f, color: e.target.value}))} className="w-full h-9 rounded-md border border-input cursor-pointer" /></div>
              <div><Label>Hora Inicio *</Label><Input type="time" value={form.start_time} onChange={e => setForm(f => ({...f, start_time: e.target.value}))} required /></div>
              <div><Label>Hora Fin *</Label><Input type="time" value={form.end_time} onChange={e => setForm(f => ({...f, end_time: e.target.value}))} required /></div>
              <div className="col-span-2"><Label>Horas Programadas por Día *</Label><Input type="number" step="0.5" min="1" max="24" value={form.daily_hours} onChange={e => setForm(f => ({...f, daily_hours: parseFloat(e.target.value)}))} required /></div>
            </div>

            <div>
              <Label className="block mb-2">Días Laborales</Label>
              <div className="flex gap-2 flex-wrap">
                {DAY_LABELS.map((d, i) => {
                  const active = (form.work_days || []).includes(i);
                  return (
                    <button key={i} type="button"
                      onClick={() => toggleDay(i, 'work_days')}
                      className={`w-10 h-10 rounded-lg text-xs font-bold border-2 transition-all ${active ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-muted border-transparent text-muted-foreground hover:border-emerald-300'}`}
                    >{d}</button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="block mb-2">Días de Descanso</Label>
              <div className="flex gap-2 flex-wrap">
                {DAY_LABELS.map((d, i) => {
                  const active = (form.rest_days || []).includes(i);
                  return (
                    <button key={i} type="button"
                      onClick={() => toggleDay(i, 'rest_days')}
                      className={`w-10 h-10 rounded-lg text-xs font-bold border-2 transition-all ${active ? 'bg-red-400 border-red-400 text-white' : 'bg-muted border-transparent text-muted-foreground hover:border-red-300'}`}
                    >{d}</button>
                  );
                })}
              </div>
            </div>

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