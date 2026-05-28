import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, CalendarClock, Pencil, Trash2, Play, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, addDays, parseISO } from 'date-fns';

export default function PreventiveMaint() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: mps = [], isLoading } = useQuery({ queryKey: ['preventive'], queryFn: () => base44.entities.PreventiveMaintenance.list('-created_date') });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: () => base44.entities.MaintenancePlan.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });
  const { data: workOrders = [] } = useQuery({ queryKey: ['workOrders'], queryFn: () => base44.entities.WorkOrder.list('-created_date', 200) });

  const [form, setForm] = useState({});

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const nextDate = data.requested_start_date && data.frequency_days
        ? format(addDays(parseISO(data.requested_start_date), data.frequency_days), 'yyyy-MM-dd')
        : '';
      // Set plan_id to first plan in list for compatibility
      const planIds = data.plan_ids || (data.plan_id ? [data.plan_id] : []);
      const saveData = {
        ...data,
        plan_ids: planIds,
        plan_id: planIds[0] || data.plan_id || '',
        current_plan_sequence: data.current_plan_sequence || 1,
        next_mp_date: nextDate,
        generation_date: data.generation_date || format(new Date(), 'yyyy-MM-dd')
      };
      return editing
        ? base44.entities.PreventiveMaintenance.update(editing.id, saveData)
        : base44.entities.PreventiveMaintenance.create(saveData);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['preventive'] }); setShowForm(false); setEditing(null); toast.success('MP guardado'); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PreventiveMaintenance.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['preventive'] }); toast.success('MP eliminado'); }
  });

  const generateWOMutation = useMutation({
    mutationFn: async (mp) => {
      // Determine which plan to use based on current sequence
      const planIds = mp.plan_ids && mp.plan_ids.length > 0 ? mp.plan_ids : (mp.plan_id ? [mp.plan_id] : []);
      const currentSeq = mp.current_plan_sequence || 1;
      const planIndex = (currentSeq - 1) % planIds.length;
      const activePlanId = planIds[planIndex];
      const plan = plans.find(p => p.id === activePlanId);

      const woCount = workOrders.length + 1;
      const woNumber = `OT-${String(woCount).padStart(4, '0')}`;
      const wo = await base44.entities.WorkOrder.create({
        wo_number: woNumber,
        mp_id: mp.id,
        plan_id: activePlanId,
        wo_type: 'Preventiva',
        description: `${mp.name} — ${plan?.name || 'Plan'} (Sec. ${currentSeq})`,
        request_date: format(new Date(), 'yyyy-MM-dd'),
        scheduled_date: mp.next_mp_date || format(new Date(), 'yyyy-MM-dd'),
        location_id: mp.location_id,
        asset_id: mp.asset_id,
        status: 'Pendiente',
        priority: plan?.priority || 'Media',
        estimated_duration_hours: plan?.estimated_duration_hours || 0,
      });

      // Copy plan activities to WO
      const planActivities = await base44.entities.PlanActivity.filter({ plan_id: activePlanId });
      if (planActivities.length > 0) {
        await base44.entities.WOActivity.bulkCreate(planActivities.map(a => ({
          wo_id: wo.id,
          description: a.description,
          completed: false,
          sequence: a.sequence,
        })));
      }

      // Advance sequence and update next date
      const nextSeq = currentSeq + 1;
      const nextDate = mp.frequency_days ? format(addDays(new Date(), mp.frequency_days), 'yyyy-MM-dd') : '';
      await base44.entities.PreventiveMaintenance.update(mp.id, {
        last_wo_id: wo.id,
        next_mp_date: nextDate,
        current_plan_sequence: nextSeq,
        plan_id: planIds[(nextSeq - 1) % planIds.length] || activePlanId,
      });
      return wo;
    },
    onSuccess: () => { queryClient.invalidateQueries(); toast.success('Orden de Trabajo generada'); }
  });

  const openForm = (mp = null) => {
    setEditing(mp);
    if (mp) {
      const planIds = mp.plan_ids && mp.plan_ids.length > 0 ? mp.plan_ids : (mp.plan_id ? [mp.plan_id] : []);
      setForm({ ...mp, plan_ids: planIds });
    } else {
      setForm({ name: '', status: 'Activo', schedule_type: 'Manual', frequency_days: 30, requested_start_date: format(new Date(), 'yyyy-MM-dd'), plan_ids: [], current_plan_sequence: 1 });
    }
    setShowForm(true);
  };

  const addPlanToList = (planId) => {
    if (!planId || (form.plan_ids || []).includes(planId)) return;
    setForm(f => ({ ...f, plan_ids: [...(f.plan_ids || []), planId] }));
  };

  const removePlanFromList = (planId) => {
    setForm(f => ({ ...f, plan_ids: (f.plan_ids || []).filter(id => id !== planId) }));
  };

  const getAssetName = (id) => assets.find(a => a.id === id)?.name || '';
  const getPlanName = (id) => plans.find(p => p.id === id)?.name || '';

  const getActivePlanName = (mp) => {
    const planIds = mp.plan_ids && mp.plan_ids.length > 0 ? mp.plan_ids : (mp.plan_id ? [mp.plan_id] : []);
    if (planIds.length === 0) return '—';
    const seq = mp.current_plan_sequence || 1;
    const idx = (seq - 1) % planIds.length;
    return `${getPlanName(planIds[idx])} (${seq}/${planIds.length})`;
  };

  const columns = [
    { key: 'name', label: 'Nombre', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'asset_id', label: 'Activo', render: r => getAssetName(r.asset_id) },
    { key: 'plan', label: 'Plan Activo', render: r => <span className="text-sm">{getActivePlanName(r)}</span> },
    { key: 'frequency_days', label: 'Frecuencia', render: r => `${r.frequency_days} días` },
    { key: 'next_mp_date', label: 'Próxima Fecha', render: r => r.next_mp_date ? format(parseISO(r.next_mp_date), 'dd/MM/yyyy') : '—' },
    { key: 'status', label: 'Estado', render: r => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); generateWOMutation.mutate(r); }} disabled={generateWOMutation.isPending}>
          <Play className="w-3 h-3" />Generar OT
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openForm(r); }}><Pencil className="w-3 h-3" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="w-3 h-3" /></Button>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="Mantenimiento Preventivo" subtitle={`${mps.length} programas MP`} action={() => openForm()} actionLabel="Nuevo MP" actionIcon={Plus} />
      {mps.length === 0 && !isLoading ? (
        <EmptyState icon={CalendarClock} title="Sin MPs" description="Crea un programa de mantenimiento preventivo" actionLabel="Crear MP" onAction={() => openForm()} />
      ) : (
        <DataTable columns={columns} data={mps} isLoading={isLoading} />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar MP' : 'Nuevo MP'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div><Label>Descripción</Label><Input value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Activo *</Label>
                <Select value={form.asset_id || ''} onValueChange={v => setForm({...form, asset_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ubicación</Label>
                <Select value={form.location_id || ''} onValueChange={v => setForm({...form, location_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Multi-plan with sequence */}
            <div>
              <Label className="mb-1 block">Planes de Mantenimiento (en orden de secuencia)</Label>
              <p className="text-xs text-muted-foreground mb-2">Cada vez que se genere una OT, se usará el siguiente plan en la secuencia y rotará automáticamente.</p>

              {/* Selected plans in order */}
              {(form.plan_ids || []).length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {(form.plan_ids || []).map((pid, idx) => (
                    <div key={pid} className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border text-sm">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                      <span className="flex-1 truncate">{getPlanName(pid)}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePlanFromList(pid)}><X className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add plan dropdown */}
              <Select value="" onValueChange={addPlanToList}>
                <SelectTrigger><SelectValue placeholder="+ Agregar plan a la secuencia" /></SelectTrigger>
                <SelectContent>
                  {plans.filter(p => !(form.plan_ids || []).includes(p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.maintenance_type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div><Label>Frecuencia (días) *</Label><Input type="number" value={form.frequency_days || ''} onChange={e => setForm({...form, frequency_days: parseInt(e.target.value)})} required /></div>
              <div><Label>Fecha Inicio</Label><Input type="date" value={form.requested_start_date || ''} onChange={e => setForm({...form, requested_start_date: e.target.value})} /></div>
              <div><Label>Secuencia Actual</Label><Input type="number" min="1" value={form.current_plan_sequence || 1} onChange={e => setForm({...form, current_plan_sequence: parseInt(e.target.value)})} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Estado</Label>
                <Select value={form.status || 'Activo'} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Activo','Inactivo','Pausado'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo Programación</Label>
                <Select value={form.schedule_type || 'Manual'} onValueChange={v => setForm({...form, schedule_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Manual','Automático'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
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