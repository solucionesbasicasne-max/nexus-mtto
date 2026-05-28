import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, ClipboardList, Eye, Search, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';

const WO_STATUSES = ['Generada', 'Planificada', 'Aprobada', 'Programada', 'En proceso', 'Completa', 'Revisión', 'Cerrada'];

const STATUS_STYLES = {
  'Generada': 'bg-slate-100 text-slate-700 border-slate-200',
  'Planificada': 'bg-blue-100 text-blue-700 border-blue-200',
  'Aprobada': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Programada': 'bg-purple-100 text-purple-700 border-purple-200',
  'En proceso': 'bg-amber-100 text-amber-700 border-amber-200',
  'Completa': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Revisión': 'bg-orange-100 text-orange-700 border-orange-200',
  'Cerrada': 'bg-gray-100 text-gray-600 border-gray-200',
  'Pendiente': 'bg-red-100 text-red-700 border-red-200',
  'Completada': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PRIORITY_STYLES = {
  'Crítica': 'bg-red-100 text-red-700 border-red-200',
  'Alta': 'bg-orange-100 text-orange-700 border-orange-200',
  'Media': 'bg-amber-100 text-amber-700 border-amber-200',
  'Baja': 'bg-green-100 text-green-700 border-green-200',
};

function WOStatusBadge({ status }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
}

function PriorityBadge({ priority }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PRIORITY_STYLES[priority] || 'bg-muted text-muted-foreground'}`}>{priority}</span>;
}

export default function WorkOrders() {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: workOrders = [], isLoading } = useQuery({ queryKey: ['workOrders'], queryFn: () => base44.entities.WorkOrder.list('-created_date', 200) });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });

  const [form, setForm] = useState({});

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const woCount = workOrders.length + 1;
      const woNumber = `OT-${String(woCount).padStart(4, '0')}`;
      return base44.entities.WorkOrder.create({ ...data, wo_number: woNumber, request_date: format(new Date(), 'yyyy-MM-dd'), status: 'Generada' });
    },
    onSuccess: async (newWO) => {
      await base44.entities.WorkOrderStatusHistory.create({
        wo_id: newWO.id,
        from_status: null,
        to_status: 'Generada',
        changed_by: 'Sistema',
        changed_at: new Date().toISOString(),
        notes: 'OT creada'
      });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setShowForm(false);
      toast.success('OT creada con estado "Generada"');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Error al crear orden de trabajo: ' + (err.message || 'Error desconocido'));
    }
  });

  const openForm = () => {
    setForm({ wo_type: 'Correctiva', priority: 'Media', description: '', scheduled_date: format(new Date(), 'yyyy-MM-dd') });
    setShowForm(true);
  };

  const getAssetName = (id) => assets.find(a => a.id === id)?.name || '—';
  const getEmpName = (id) => employees.find(e => e.id === id)?.full_name || '';

  const filtered = workOrders.filter(w => {
    const matchStatus = statusFilter === 'all' || w.status === statusFilter;
    const matchSearch = !search || w.wo_number?.toLowerCase().includes(search.toLowerCase()) || w.description?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const statusCounts = WO_STATUSES.reduce((acc, s) => {
    acc[s] = workOrders.filter(w => w.status === s).length;
    return acc;
  }, {});

  const columns = [
    { key: 'wo_number', label: 'No. OT', render: r => <span className="font-mono text-xs font-bold text-primary">{r.wo_number || '—'}</span> },
    { key: 'description', label: 'Descripción', render: r => <span className="font-medium text-sm max-w-[200px] truncate block">{r.description}</span> },
    { key: 'wo_type', label: 'Tipo', render: r => <span className="text-xs text-muted-foreground">{r.wo_type}</span> },
    { key: 'asset_id', label: 'Activo', render: r => <span className="text-sm">{getAssetName(r.asset_id)}</span> },
    { key: 'scheduled_date', label: 'Fecha Prog.', render: r => <span className="text-sm">{r.scheduled_date ? format(parseISO(r.scheduled_date), 'dd/MM/yy') : '—'}</span> },
    { key: 'priority', label: 'Prioridad', render: r => <PriorityBadge priority={r.priority} /> },
    { key: 'status', label: 'Estado', render: r => <WOStatusBadge status={r.status} /> },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/work-orders/${r.id}`); }}><Eye className="w-3.5 h-3.5" /></Button>
    )}
  ];

  return (
    <div>
      <PageHeader
        title="Órdenes de Trabajo"
        subtitle={`${workOrders.length} órdenes totales`}
        action={openForm}
        actionLabel="Nueva OT"
        actionIcon={Plus}
      />

      {/* Status pipeline */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${statusFilter === 'all' ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground/40'}`}
        >
          Todas ({workOrders.length})
        </button>
        {WO_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${statusFilter === s ? `${STATUS_STYLES[s]} shadow-sm` : 'border-border text-muted-foreground hover:border-foreground/40'}`}
          >
            {s} ({statusCounts[s] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 max-w-sm" placeholder="Buscar OT o descripción..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={ClipboardList} title="Sin órdenes" description="Crea una orden de trabajo" actionLabel="Crear OT" onAction={openForm} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={(r) => navigate(`/work-orders/${r.id}`)} />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva Orden de Trabajo</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div><Label>Descripción *</Label><Textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo</Label>
                <Select value={form.wo_type || 'Correctiva'} onValueChange={v => setForm({...form, wo_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Preventiva','Correctiva','Predictiva','Mejora'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
              <div><Label>Activo</Label>
                <Select value={form.asset_id || ''} onValueChange={v => setForm({...form, asset_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ubicación</Label>
                <Select value={form.location_id || ''} onValueChange={v => setForm({...form, location_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fecha Programada</Label><Input type="date" value={form.scheduled_date || ''} onChange={e => setForm({...form, scheduled_date: e.target.value})} /></div>
              <div><Label>Duración Est. (h)</Label><Input type="number" step="0.5" value={form.estimated_duration_hours || ''} onChange={e => setForm({...form, estimated_duration_hours: parseFloat(e.target.value)})} /></div>
            </div>
            <div><Label>Técnico Responsable</Label>
              <Select value={form.assigned_employee_id || ''} onValueChange={v => setForm({...form, assigned_employee_id: v, responsible_technician: employees.find(e => e.id === v)?.full_name || ''})}>
                <SelectTrigger><SelectValue placeholder="Seleccionar técnico" /></SelectTrigger>
                <SelectContent>{employees.filter(e => e.status === 'Activo').map(e => <SelectItem key={e.id} value={e.id}>{e.full_name} — {e.position}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>Crear OT</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}