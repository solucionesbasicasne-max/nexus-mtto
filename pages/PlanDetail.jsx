import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, ListChecks, Users, Truck, Package, Sparkles, Loader2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { toast } from 'sonner';

export default function PlanDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const planId = window.location.pathname.split('/plans/')[1];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: plan } = useQuery({ queryKey: ['plan', planId], queryFn: () => base44.entities.MaintenancePlan.list().then(p => p.find(x => x.id === planId)) });
  const { data: activities = [] } = useQuery({ queryKey: ['planActivities', planId], queryFn: () => base44.entities.PlanActivity.filter({ plan_id: planId }) });
  const { data: labor = [] } = useQuery({ queryKey: ['planLabor', planId], queryFn: () => base44.entities.PlanResourceLabor.filter({ plan_id: planId }) });
  const { data: services = [] } = useQuery({ queryKey: ['planServices', planId], queryFn: () => base44.entities.PlanResourceService.filter({ plan_id: planId }) });
  const { data: parts = [] } = useQuery({ queryKey: ['planParts', planId], queryFn: () => base44.entities.PlanResourcePart.filter({ plan_id: planId }) });

  const { data: specialties = [] } = useQuery({ queryKey: ['specialties'], queryFn: () => base44.entities.Specialty.list() });
  const { data: registeredServices = [] } = useQuery({ queryKey: ['servicesList'], queryFn: () => base44.entities.Service.list() });
  const { data: spareParts = [] } = useQuery({ queryKey: ['sparePartsList'], queryFn: () => base44.entities.SparePart.list() });

  const [dialog, setDialog] = useState({ open: false, type: '', form: {} });
  const [generatingAI, setGeneratingAI] = useState(false);

  const createMutation = useMutation({
    mutationFn: ({ type, data }) => {
      const entityMap = { activity: 'PlanActivity', labor: 'PlanResourceLabor', service: 'PlanResourceService', part: 'PlanResourcePart' };
      return base44.entities[entityMap[type]].create({ ...data, plan_id: planId });
    },
    onSuccess: () => { queryClient.invalidateQueries(); setDialog({ open: false, type: '', form: {} }); toast.success('Recurso agregado'); },
    onError: (err) => {
      console.error(err);
      toast.error('Error al agregar recurso: ' + (err.message || 'Error desconocido'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ type, id }) => {
      const entityMap = { activity: 'PlanActivity', labor: 'PlanResourceLabor', service: 'PlanResourceService', part: 'PlanResourcePart' };
      return base44.entities[entityMap[type]].delete(id);
    },
    onSuccess: () => { queryClient.invalidateQueries(); toast.success('Eliminado'); }
  });

  const generateActivitiesWithAI = async () => {
    if (!plan) return;
    setGeneratingAI(true);
    try {
      const prompt = `Eres un experto en mantenimiento industrial. Genera una lista de actividades de mantenimiento para el siguiente plan:

Nombre del Plan: ${plan.name}
Descripción: ${plan.description || 'No especificada'}
Tipo de Mantenimiento: ${plan.maintenance_type}
Prioridad: ${plan.priority}
Tipo de Activo: ${plan.asset_type || 'General'}

Genera entre 5 y 10 actividades detalladas, ordenadas lógicamente. Cada actividad debe ser específica, técnica y accionable.

Responde SOLO con un JSON con esta estructura:
{
  "activities": [
    {
      "sequence": 1,
      "description": "Descripción clara de la actividad",
      "activity_type": "uno de: Inspección, Lubricación, Ajuste, Reemplazo, Limpieza, Otro",
      "estimated_time_minutes": número entero
    }
  ]
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            activities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sequence: { type: 'number' },
                  description: { type: 'string' },
                  activity_type: { type: 'string' },
                  estimated_time_minutes: { type: 'number' }
                }
              }
            }
          }
        }
      });

      const aiActivities = result.activities || [];
      if (aiActivities.length === 0) { toast.error('La IA no generó actividades'); return; }

      // Offset sequence to avoid collision with existing
      const offset = activities.length;
      await base44.entities.PlanActivity.bulkCreate(
        aiActivities.map((a, i) => ({
          plan_id: planId,
          sequence: offset + a.sequence,
          description: a.description,
          activity_type: a.activity_type,
          estimated_time_minutes: a.estimated_time_minutes,
        }))
      );
      queryClient.invalidateQueries({ queryKey: ['planActivities', planId] });
      toast.success(`✨ ${aiActivities.length} actividades generadas por IA`);
    } catch (err) {
      toast.error('Error al generar actividades con IA');
    } finally {
      setGeneratingAI(false);
    }
  };

  const openDialog = (type) => {
    const defaults = {
      activity: { sequence: activities.length + 1, description: '', estimated_time_minutes: 30, activity_type: 'Inspección' },
      labor: { technician_type: '', quantity: 1, estimated_time_hours: 1, hourly_rate: 0, estimated_cost: 0 },
      service: { external_service: '', supplier: '', estimated_cost: 0 },
      part: { part_name: '', quantity: 1, unit: 'Pieza', estimated_cost: 0, unit_cost: 0 },
    };
    setDialog({ open: true, type, form: defaults[type] });
  };

  if (!plan) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/plans')}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{plan.name}</h1>
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <StatusBadge status={plan.maintenance_type} />
          <StatusBadge status={plan.priority} />
        </div>
      </div>

      {/* Activities */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ListChecks className="w-4 h-4" />Actividades ({activities.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1 text-purple-600 border-purple-200 hover:bg-purple-50" onClick={generateActivitiesWithAI} disabled={generatingAI}>
              {generatingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {generatingAI ? 'Generando...' : 'Generar con IA'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDialog('activity')}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
          </div>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Sin actividades</p> : (
            <div className="space-y-2">
              {activities.sort((a,b) => (a.sequence || 0) - (b.sequence || 0)).map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{a.sequence}</span>
                    <div>
                      <p className="text-sm font-medium">{a.description}</p>
                      <p className="text-xs text-muted-foreground">{a.activity_type} · {a.estimated_time_minutes} min</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate({ type: 'activity', id: a.id })}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Labor */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" />Mano de Obra</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => openDialog('labor')}><Plus className="w-3 h-3" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {labor.map(l => (
              <div key={l.id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                <div>
                  <p className="font-medium">{l.technician_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.quantity} pers. · {l.estimated_time_hours}h
                    {l.hourly_rate > 0 && ` · $${l.hourly_rate}/h`}
                    {l.estimated_cost > 0 && ` · Total: $${l.estimated_cost}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMutation.mutate({ type: 'labor', id: l.id })}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            ))}
            {labor.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin recursos</p>}
          </CardContent>
        </Card>

        {/* Services */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Truck className="w-4 h-4" />Servicios</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => openDialog('service')}><Plus className="w-3 h-3" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {services.map(s => (
              <div key={s.id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                <div><p className="font-medium">{s.external_service}</p><p className="text-xs text-muted-foreground">{s.supplier} · ${s.estimated_cost}</p></div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMutation.mutate({ type: 'service', id: s.id })}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            ))}
            {services.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin servicios</p>}
          </CardContent>
        </Card>

        {/* Parts */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" />Refacciones</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => openDialog('part')}><Plus className="w-3 h-3" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {parts.map(p => (
              <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                <div><p className="font-medium">{p.part_name}</p><p className="text-xs text-muted-foreground">{p.quantity} {p.unit} · ${p.estimated_cost}</p></div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMutation.mutate({ type: 'part', id: p.id })}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            ))}
            {parts.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin refacciones</p>}
          </CardContent>
        </Card>
      </div>

      {/* Add Resource Dialog */}
      <Dialog open={dialog.open} onOpenChange={(v) => setDialog({ ...dialog, open: v })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>
            {dialog.type === 'activity' && 'Nueva Actividad'}
            {dialog.type === 'labor' && 'Nuevo Recurso M.O.'}
            {dialog.type === 'service' && 'Nuevo Servicio'}
            {dialog.type === 'part' && 'Nueva Refacción'}
          </DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ type: dialog.type, data: dialog.form }); }} className="space-y-4">
            {dialog.type === 'activity' && <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Secuencia</Label><Input type="number" value={dialog.form.sequence || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, sequence: parseInt(e.target.value) } })} /></div>
                <div><Label>Tipo</Label>
                  <Select value={dialog.form.activity_type || ''} onValueChange={v => setDialog({ ...dialog, form: { ...dialog.form, activity_type: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['Inspección','Lubricación','Ajuste','Reemplazo','Limpieza','Otro'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Descripción *</Label><Input value={dialog.form.description || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, description: e.target.value } })} required /></div>
              <div><Label>Tiempo Estimado (min)</Label><Input type="number" value={dialog.form.estimated_time_minutes || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, estimated_time_minutes: parseInt(e.target.value) } })} /></div>
            </>}
            {dialog.type === 'labor' && <>
              <div>
                <Label>Especialidad / Tipo de Técnico *</Label>
                <Select value={dialog.form.technician_type || ''} onValueChange={v => {
                  const spec = specialties.find(s => s.name === v || s.id === v);
                  const rate = spec ? parseFloat(spec.hourly_rate || 0) : 0;
                  const qty = parseInt(dialog.form.quantity || 1);
                  const hours = parseFloat(dialog.form.estimated_time_hours || 1);
                  setDialog({
                    ...dialog,
                    form: {
                      ...dialog.form,
                      technician_type: spec ? spec.name : v,
                      hourly_rate: rate,
                      estimated_cost: qty * hours * rate
                    }
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar especialidad" /></SelectTrigger>
                  <SelectContent>
                    {specialties.filter(s => s.is_active !== false).map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name} {s.hourly_rate > 0 ? `($${s.hourly_rate}/h)` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cantidad</Label><Input type="number" value={dialog.form.quantity || ''} onChange={e => {
                  const qty = parseInt(e.target.value) || 0;
                  const hours = parseFloat(dialog.form.estimated_time_hours || 0);
                  const rate = parseFloat(dialog.form.hourly_rate || 0);
                  setDialog({ ...dialog, form: { ...dialog.form, quantity: qty, estimated_cost: qty * hours * rate } });
                }} /></div>
                <div><Label>Tiempo Est. (h)</Label><Input type="number" step="0.5" value={dialog.form.estimated_time_hours || ''} onChange={e => {
                  const hours = parseFloat(e.target.value) || 0;
                  const qty = parseInt(dialog.form.quantity || 0);
                  const rate = parseFloat(dialog.form.hourly_rate || 0);
                  setDialog({ ...dialog, form: { ...dialog.form, estimated_time_hours: hours, estimated_cost: qty * hours * rate } });
                }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Costo por Hora ($)</Label><Input type="number" min="0" step="0.01" value={dialog.form.hourly_rate || ''} onChange={e => {
                  const rate = parseFloat(e.target.value) || 0;
                  const qty = parseInt(dialog.form.quantity || 1);
                  const hours = parseFloat(dialog.form.estimated_time_hours || 1);
                  setDialog({ ...dialog, form: { ...dialog.form, hourly_rate: rate, estimated_cost: qty * hours * rate } });
                }} /></div>
                <div><Label>Costo Total Est. ($)</Label><Input type="number" min="0" step="0.01" value={dialog.form.estimated_cost || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, estimated_cost: parseFloat(e.target.value) || 0 } })} /></div>
              </div>
            </>}
            {dialog.type === 'service' && <>
              <div>
                <Label>Seleccionar Servicio Registrado</Label>
                <Select value={dialog.form.external_service || ''} onValueChange={v => {
                  const serv = registeredServices.find(s => s.name === v || s.id === v);
                  setDialog({
                    ...dialog,
                    form: {
                      ...dialog.form,
                      external_service: serv ? serv.name : v,
                      supplier: serv ? serv.provider : (dialog.form.supplier || ''),
                      estimated_cost: serv ? parseFloat(serv.estimated_cost || 0) : (dialog.form.estimated_cost || 0)
                    }
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar servicio de catálogo" /></SelectTrigger>
                  <SelectContent>
                    {registeredServices.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name} — {s.provider} {s.estimated_cost > 0 ? `($${s.estimated_cost})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Servicio *</Label><Input value={dialog.form.external_service || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, external_service: e.target.value } })} required /></div>
              <div><Label>Proveedor</Label><Input value={dialog.form.supplier || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, supplier: e.target.value } })} /></div>
              <div><Label>Costo Estimado</Label><Input type="number" step="0.01" value={dialog.form.estimated_cost || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, estimated_cost: parseFloat(e.target.value) || 0 } })} /></div>
            </>}
            {dialog.type === 'part' && <>
              <div>
                <Label>Seleccionar Refacción Registrada</Label>
                <Select value={dialog.form.part_name || ''} onValueChange={v => {
                  const part = spareParts.find(p => p.name === v || p.id === v);
                  const cost = part ? parseFloat(part.unit_cost || 0) : 0;
                  const qty = parseInt(dialog.form.quantity || 1);
                  setDialog({
                    ...dialog,
                    form: {
                      ...dialog.form,
                      part_name: part ? part.name : v,
                      unit: part ? part.unit : (dialog.form.unit || 'Pieza'),
                      unit_cost: cost,
                      estimated_cost: qty * cost
                    }
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar refacción de catálogo" /></SelectTrigger>
                  <SelectContent>
                    {spareParts.map(p => (
                      <SelectItem key={p.id} value={p.name}>{p.name} {p.part_number ? `(${p.part_number})` : ''} — Stock: {p.stock_current} {p.unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Refacción *</Label><Input value={dialog.form.part_name || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, part_name: e.target.value } })} required /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Cantidad</Label><Input type="number" value={dialog.form.quantity || ''} onChange={e => {
                  const qty = parseInt(e.target.value) || 0;
                  const cost = parseFloat(dialog.form.unit_cost || 0);
                  setDialog({ ...dialog, form: { ...dialog.form, quantity: qty, estimated_cost: qty * cost } });
                }} /></div>
                <div><Label>Unidad</Label><Input value={dialog.form.unit || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, unit: e.target.value } })} /></div>
                <div><Label>Costo Est.</Label><Input type="number" step="0.01" value={dialog.form.estimated_cost || ''} onChange={e => setDialog({ ...dialog, form: { ...dialog.form, estimated_cost: parseFloat(e.target.value) || 0 } })} /></div>
              </div>
            </>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialog({ ...dialog, open: false })}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}