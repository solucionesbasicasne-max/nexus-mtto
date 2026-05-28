import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Wrench, Pencil, Trash2, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['Mecánica','Eléctrica','Electrónica','Hidráulica','Neumática','Consumible','Otro'];

export default function SpareParts() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: spareParts = [], isLoading } = useQuery({ queryKey: ['spareParts'], queryFn: () => base44.entities.SparePart.list('-created_date') });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: systems = [] } = useQuery({ queryKey: ['systems'], queryFn: () => base44.entities.AssetSystem.list() });
  const { data: components = [] } = useQuery({ queryKey: ['components'], queryFn: () => base44.entities.Component.list() });

  const saveMutation = useMutation({
    mutationFn: d => editing ? base44.entities.SparePart.update(editing.id, d) : base44.entities.SparePart.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['spareParts'] }); setShowForm(false); setEditing(null); toast.success('Despiece guardado'); }
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.SparePart.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['spareParts'] }); toast.success('Eliminado'); }
  });

  const openForm = (item = null) => {
    setEditing(item);
    setForm(item || { name: '', part_number: '', unit: 'Pieza', stock_current: 0, stock_min: 1, stock_max: 10, unit_cost: 0, active: true, category: 'Mecánica' });
    setShowForm(true);
  };

  const getName = (list, id) => list.find(x => x.id === id)?.name || '—';
  const filteredSystems = systems.filter(s => s.asset_id === form.asset_id);
  const filteredComponents = components.filter(c => c.system_id === form.system_id);

  const getStockBadge = (part) => {
    if (!part.stock_min) return null;
    if ((part.stock_current || 0) === 0) return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Sin stock</Badge>;
    if ((part.stock_current || 0) <= (part.stock_min || 0)) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Stock bajo</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">OK</Badge>;
  };

  const lowStockCount = spareParts.filter(p => (p.stock_current || 0) <= (p.stock_min || 0)).length;

  const columns = [
    { key: 'part_number', label: 'No. Parte', render: r => <span className="font-mono text-xs font-semibold">{r.part_number}</span> },
    { key: 'name', label: 'Despiece / Refacción', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'category', label: 'Categoría' },
    { key: 'component_id', label: 'Componente', render: r => getName(components, r.component_id) },
    { key: 'asset_id', label: 'Activo', render: r => getName(assets, r.asset_id) },
    { key: 'stock_current', label: 'Stock Actual', render: r => (
      <div className="flex items-center gap-2">
        <span className="font-bold">{r.stock_current ?? 0}</span>
        <span className="text-xs text-muted-foreground">{r.unit}</span>
      </div>
    )},
    { key: 'stock_min', label: 'Mín / Máx', render: r => <span className="text-xs text-muted-foreground">{r.stock_min ?? 0} / {r.stock_max ?? '—'}</span> },
    { key: 'unit_cost', label: 'Costo Unit.', render: r => `$${(r.unit_cost || 0).toFixed(2)}` },
    { key: 'alert', label: 'Alerta', render: r => getStockBadge(r) },
    { key: 'location_storage', label: 'Ubicación Almacén' },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={e => { e.stopPropagation(); navigate(`/inventory?part=${r.id}`); }}>
          <ArrowUpCircle className="w-3 h-3" />Mov
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openForm(r); }}><Pencil className="w-3 h-3" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="w-3 h-3" /></Button>
      </div>
    )}
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="flex-1">
          <PageHeader title="Despieces / Refacciones" subtitle={`Nivel 9 · ${spareParts.length} refacciones`} action={() => openForm()} actionLabel="Nueva Refacción" actionIcon={Plus} />
        </div>
      </div>
      {lowStockCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <strong>{lowStockCount} refacción(es)</strong> con stock bajo o sin stock. Revisa el inventario.
          <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => navigate('/inventory')}>Ver Inventario</Button>
        </div>
      )}
      {spareParts.length === 0 && !isLoading
        ? <EmptyState icon={Wrench} title="Sin refacciones" description="Registra el despiece y catálogo de refacciones de tus componentes" actionLabel="Crear Refacción" onAction={() => openForm()} />
        : <DataTable columns={columns} data={spareParts} isLoading={isLoading} />
      }

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Refacción' : 'Nueva Refacción / Despiece'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Activo (filtrar)</Label>
                <Select value={form.asset_id || ''} onValueChange={v => setForm({ ...form, asset_id: v, system_id: '', component_id: '' })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Sistema</Label>
                <Select value={form.system_id || ''} onValueChange={v => setForm({ ...form, system_id: v, component_id: '' })} disabled={!form.asset_id}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{filteredSystems.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Componente</Label>
              <Select value={form.component_id || ''} onValueChange={v => setForm({ ...form, component_id: v })} disabled={!form.system_id}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar componente" /></SelectTrigger>
                <SelectContent>{filteredComponents.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3 grid grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>No. Parte *</Label><Input value={form.part_number || ''} onChange={e => setForm({ ...form, part_number: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoría</Label>
                <Select value={form.category || 'Mecánica'} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Unidad</Label><Input value={form.unit || 'Pieza'} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Stock Actual</Label><Input type="number" value={form.stock_current ?? 0} onChange={e => setForm({ ...form, stock_current: parseFloat(e.target.value) })} /></div>
              <div><Label>Stock Mínimo</Label><Input type="number" value={form.stock_min ?? 1} onChange={e => setForm({ ...form, stock_min: parseFloat(e.target.value) })} /></div>
              <div><Label>Stock Máximo</Label><Input type="number" value={form.stock_max || ''} onChange={e => setForm({ ...form, stock_max: parseFloat(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Costo Unitario</Label><Input type="number" step="0.01" value={form.unit_cost ?? 0} onChange={e => setForm({ ...form, unit_cost: parseFloat(e.target.value) })} /></div>
              <div><Label>Proveedor</Label><Input value={form.supplier || ''} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
              <div><Label>Tiempo Entrega (días)</Label><Input type="number" value={form.lead_time_days || ''} onChange={e => setForm({ ...form, lead_time_days: parseInt(e.target.value) })} /></div>
            </div>
            <div><Label>Ubicación en Almacén</Label><Input value={form.location_storage || ''} onChange={e => setForm({ ...form, location_storage: e.target.value })} placeholder="Ej: Anaquel A-3, Caja 12" /></div>
            <div><Label>Descripción</Label><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>Guardar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}