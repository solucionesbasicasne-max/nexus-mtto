import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, Trash2, Tag, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function Specialties() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  const { data: specialties = [], isLoading } = useQuery({
    queryKey: ['specialties'],
    queryFn: () => base44.entities.Specialty.list()
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list()
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Specialty.update(editing.id, data) : base44.entities.Specialty.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['specialties'] }); setShowForm(false); toast.success('Guardado'); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Specialty.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['specialties'] }); toast.success('Especialidad eliminada'); }
  });

  const openNew = () => { setForm({ is_active: true }); setEditing(null); setShowForm(true); };
  const openEdit = (s) => { setForm({ ...s }); setEditing(s); setShowForm(true); };

  const countEmployees = (id) => employees.filter(e => e.specialty_id === id).length;

  const COLORS = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Especialidades</h2>
          <p className="text-sm text-muted-foreground">{specialties.filter(s => s.is_active).length} especialidades activas</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nueva Especialidad</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {specialties.map((s, i) => (
            <div key={s.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${COLORS[i % COLORS.length]}`}>
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.code && <p className="text-xs font-mono text-muted-foreground">{s.code}</p>}
                      {s.hourly_rate > 0 && <Badge variant="secondary" className="text-[10px] py-0.5 px-1.5 bg-primary/10 text-primary border-none font-medium">${s.hourly_rate}/h</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Edit2 className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              {s.description && <p className="text-sm text-muted-foreground mb-3">{s.description}</p>}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">{countEmployees(s.id)} empleados</Badge>
                <div className="flex items-center gap-1.5">
                  {s.is_active ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{s.is_active ? 'Activa' : 'Inactiva'}</span>
                </div>
              </div>
            </div>
          ))}
          {specialties.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-16 text-muted-foreground">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin especialidades</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Especialidad' : 'Nueva Especialidad'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div><Label>Código</Label><Input value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="Ej. ELEC-01" /></div>
            <div><Label>Categoría</Label><Input value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
            <div><Label>Descripción</Label><Textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div><Label>Costo por Hora ($)</Label><Input type="number" min="0" step="0.01" value={form.hourly_rate || ''} onChange={e => setForm(f => ({ ...f, hourly_rate: parseFloat(e.target.value) || 0 }))} placeholder="Ej. 150.00" /></div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active !== false} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Especialidad activa</Label>
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