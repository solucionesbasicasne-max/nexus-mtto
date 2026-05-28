import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Settings, Pencil, Trash2, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Plans() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: plans = [], isLoading } = useQuery({ queryKey: ['plans'], queryFn: () => base44.entities.MaintenancePlan.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.MaintenancePlan.update(editing.id, data) : base44.entities.MaintenancePlan.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans'] }); setShowForm(false); setEditing(null); toast.success('Plan guardado'); },
    onError: (err) => {
      console.error(err);
      toast.error('Error al guardar plan: ' + (err.message || 'Error desconocido'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MaintenancePlan.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans'] }); toast.success('Plan eliminado'); }
  });

  const [form, setForm] = useState({});

  const openForm = (plan = null) => {
    setEditing(plan);
    setForm(plan || { name: '', maintenance_type: 'Preventivo', priority: 'Media', requires_shutdown: false, associated_risk: 'Bajo' });
    setShowForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const columns = [
    { key: 'name', label: 'Plan', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'maintenance_type', label: 'Tipo', render: r => <StatusBadge status={r.maintenance_type} /> },
    { key: 'priority', label: 'Prioridad', render: r => <StatusBadge status={r.priority} /> },
    { key: 'estimated_duration_hours', label: 'Duración Est.', render: r => r.estimated_duration_hours ? `${r.estimated_duration_hours}h` : '—' },
    { key: 'requires_shutdown', label: 'Req. Paro', render: r => r.requires_shutdown ? '✓ Sí' : 'No' },
    { key: 'associated_risk', label: 'Riesgo' },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/plans/${r.id}`); }}><Eye className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openForm(r); }}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="Planes de Mantenimiento" subtitle={`${plans.length} planes`} action={() => openForm()} actionLabel="Nuevo Plan" actionIcon={Plus} />
      {plans.length === 0 && !isLoading ? (
        <EmptyState icon={Settings} title="Sin planes" description="Crea tu primer plan de mantenimiento" actionLabel="Crear Plan" onAction={() => openForm()} />
      ) : (
        <DataTable columns={columns} data={plans} isLoading={isLoading} onRowClick={(r) => navigate(`/plans/${r.id}`)} />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Plan' : 'Nuevo Plan'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><Label>Descripción</Label><Textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo de Mantenimiento *</Label>
                <Select value={form.maintenance_type || ''} onValueChange={v => setForm({...form, maintenance_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Preventivo','Predictivo','Correctivo Estándar'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prioridad</Label>
                <Select value={form.priority || 'Media'} onValueChange={v => setForm({...form, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Crítica','Alta','Media','Baja'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Duración Estimada (horas)</Label><Input type="number" step="0.5" value={form.estimated_duration_hours || ''} onChange={e => setForm({...form, estimated_duration_hours: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Riesgo Asociado</Label>
                <Select value={form.associated_risk || 'Bajo'} onValueChange={v => setForm({...form, associated_risk: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Alto','Medio','Bajo'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.requires_shutdown || false} onCheckedChange={v => setForm({...form, requires_shutdown: v})} />
              <Label>Requiere Paro de Equipo</Label>
            </div>
            <div><Label>Instrucciones de Seguridad</Label><Textarea value={form.safety_instructions || ''} onChange={e => setForm({...form, safety_instructions: e.target.value})} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}