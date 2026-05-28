import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Search, Pencil, Trash2, ExternalLink, Wrench,
  Phone, Mail, Building2, DollarSign, Calendar, CheckCircle2, Clock, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const STATUS_STYLES = {
  'Pendiente':   'bg-amber-100 text-amber-700 border-amber-200',
  'En Proceso':  'bg-blue-100 text-blue-700 border-blue-200',
  'Completado':  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Cancelado':   'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_ICONS = {
  'Pendiente':  Clock,
  'En Proceso': Wrench,
  'Completado': CheckCircle2,
  'Cancelado':  XCircle,
};

const PRIORITY_STYLES = {
  'Crítica': 'bg-red-100 text-red-700',
  'Alta':    'bg-orange-100 text-orange-700',
  'Media':   'bg-amber-100 text-amber-700',
  'Baja':    'bg-green-100 text-green-700',
};

const EMPTY_FORM = {
  name: '', service_type: 'Mantenimiento', provider: '', contact_name: '',
  contact_phone: '', contact_email: '', wo_id: '', asset_id: '',
  scheduled_date: '', completion_date: '', estimated_cost: 0, actual_cost: 0,
  status: 'Pendiente', priority: 'Media', description: '', notes: '',
  invoice_number: '', warranty_months: 0
};

export default function Services() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('-created_date', 200)
  });
  const { data: workOrders = [] } = useQuery({
    queryKey: ['workOrders'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 200)
  });
  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => base44.entities.Asset.list()
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Service.update(editing.id, data)
      : base44.entities.Service.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? 'Servicio actualizado' : 'Servicio creado');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Service.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Servicio eliminado');
    }
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, scheduled_date: format(new Date(), 'yyyy-MM-dd') });
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...EMPTY_FORM, ...s });
    setShowForm(true);
  };

  const filtered = services.filter(s => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.provider?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const statusCounts = { all: services.length };
  ['Pendiente','En Proceso','Completado','Cancelado'].forEach(st => {
    statusCounts[st] = services.filter(s => s.status === st).length;
  });

  const totalEstimado = filtered.reduce((s, x) => s + (x.estimated_cost || 0), 0);
  const totalReal = filtered.filter(x => x.status === 'Completado').reduce((s, x) => s + (x.actual_cost || 0), 0);

  const getWONumber = (id) => workOrders.find(w => w.id === id)?.wo_number || '';
  const getAssetName = (id) => assets.find(a => a.id === id)?.name || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="w-6 h-6 text-primary" />Servicios Externos</h1>
          <p className="text-sm text-muted-foreground">Gestión de servicios de proveedores vinculados a órdenes de trabajo</p>
        </div>
        <Button onClick={openNew} className="gap-2 self-start"><Plus className="w-4 h-4" />Nuevo Servicio</Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm p-4">
          <p className="text-xs text-muted-foreground">Total Servicios</p>
          <p className="text-2xl font-bold text-primary mt-1">{services.length}</p>
        </Card>
        <Card className="border-0 shadow-sm p-4">
          <p className="text-xs text-muted-foreground">En Proceso</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{statusCounts['En Proceso'] || 0}</p>
        </Card>
        <Card className="border-0 shadow-sm p-4">
          <p className="text-xs text-muted-foreground">Costo Estimado</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">${totalEstimado.toLocaleString()}</p>
        </Card>
        <Card className="border-0 shadow-sm p-4">
          <p className="text-xs text-muted-foreground">Costo Real (completados)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">${totalReal.toLocaleString()}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar servicio o proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all','Pendiente','En Proceso','Completado','Cancelado'].map(st => (
            <button key={st} onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${statusFilter === st
                ? (st === 'all' ? 'bg-foreground text-background border-foreground' : STATUS_STYLES[st])
                : 'border-border text-muted-foreground hover:border-foreground/40'}`}>
              {st === 'all' ? `Todos (${services.length})` : `${st} (${statusCounts[st] || 0})`}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Wrench className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">Sin servicios registrados</p>
            <Button onClick={openNew} variant="outline" className="mt-4 gap-2"><Plus className="w-4 h-4" />Agregar Servicio</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const StatusIcon = STATUS_ICONS[s.status] || Clock;
            return (
              <Card key={s.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.service_type}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      <button onClick={() => deleteMutation.mutate(s.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                    </div>
                  </div>

                  {/* Status + Priority */}
                  <div className="flex gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[s.status] || 'bg-muted'}`}>
                      <StatusIcon className="w-3 h-3" />{s.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${PRIORITY_STYLES[s.priority] || 'bg-muted'}`}>{s.priority}</span>
                  </div>

                  {/* Provider */}
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium truncate">{s.provider}</span>
                  </div>

                  {s.contact_phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3 flex-shrink-0" />{s.contact_phone}
                    </div>
                  )}

                  {/* Dates */}
                  {(s.scheduled_date || s.completion_date) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>{s.scheduled_date ? format(parseISO(s.scheduled_date), 'dd/MM/yyyy') : '—'}</span>
                      {s.completion_date && <><span>→</span><span className="text-emerald-600">{format(parseISO(s.completion_date), 'dd/MM/yyyy')}</span></>}
                    </div>
                  )}

                  {/* Costs */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t">
                    <span className="text-muted-foreground">Est: <span className="font-semibold text-foreground">${(s.estimated_cost || 0).toLocaleString()}</span></span>
                    {s.actual_cost > 0 && <span className="text-muted-foreground">Real: <span className="font-semibold text-emerald-600">${(s.actual_cost || 0).toLocaleString()}</span></span>}
                  </div>

                  {/* Linked WO */}
                  {s.wo_id && (
                    <button
                      onClick={() => navigate(`/work-orders/${s.wo_id}`)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />OT Vinculada: {getWONumber(s.wo_id)}
                    </button>
                  )}

                  {/* Asset */}
                  {s.asset_id && (
                    <p className="text-xs text-muted-foreground">Activo: <span className="font-medium">{getAssetName(s.asset_id)}</span></p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nombre del Servicio *</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div>
                <Label>Tipo de Servicio</Label>
                <Select value={form.service_type} onValueChange={v => setForm({...form, service_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Mantenimiento','Inspección','Instalación','Reparación','Limpieza','Calibración','Otro'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Crítica','Alta','Media','Baja'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Proveedor *</Label>
                <Input value={form.provider} onChange={e => setForm({...form, provider: e.target.value})} required />
              </div>
              <div>
                <Label>Contacto</Label>
                <Input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} placeholder="Nombre del contacto" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Pendiente','En Proceso','Completado','Cancelado'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>OT Vinculada</Label>
                <Select value={form.wo_id || ''} onValueChange={v => setForm({...form, wo_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar OT (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin vincular</SelectItem>
                    {workOrders.map(w => <SelectItem key={w.id} value={w.id}>{w.wo_number} — {w.description?.slice(0,40)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Activo</Label>
                <Select value={form.asset_id || ''} onValueChange={v => setForm({...form, asset_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar activo (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin activo</SelectItem>
                    {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha Programada</Label>
                <Input type="date" value={form.scheduled_date} onChange={e => setForm({...form, scheduled_date: e.target.value})} />
              </div>
              <div>
                <Label>Fecha Completado</Label>
                <Input type="date" value={form.completion_date} onChange={e => setForm({...form, completion_date: e.target.value})} />
              </div>
              <div>
                <Label>Costo Estimado ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.estimated_cost} onChange={e => setForm({...form, estimated_cost: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Label>Costo Real ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.actual_cost} onChange={e => setForm({...form, actual_cost: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Label>No. Factura</Label>
                <Input value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} placeholder="FAC-0001" />
              </div>
              <div>
                <Label>Garantía (meses)</Label>
                <Input type="number" min="0" value={form.warranty_months} onChange={e => setForm({...form, warranty_months: parseInt(e.target.value) || 0})} />
              </div>
              <div className="col-span-2">
                <Label>Descripción</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} />
              </div>
              <div className="col-span-2">
                <Label>Notas</Label>
                <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
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