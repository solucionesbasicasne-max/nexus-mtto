import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import HierarchyBreadcrumb from '@/components/hierarchy/HierarchyBreadcrumb';
import { Plus, Package, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function Assets() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list('-created_date') });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: units = [] } = useQuery({ queryKey: ['businessUnits'], queryFn: () => base44.entities.BusinessUnit.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });
  const { data: processes = [] } = useQuery({ queryKey: ['processes'], queryFn: () => base44.entities.Process.list() });

  const saveMutation = useMutation({
    mutationFn: d => editing ? base44.entities.Asset.update(editing.id, d) : base44.entities.Asset.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); setShowForm(false); setEditing(null); toast.success('Activo guardado'); }
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Asset.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); toast.success('Eliminado'); }
  });

  const openForm = (item = null) => {
    setEditing(item);
    setForm(item || { name: '', code: '', category: 'Mecánico', status: 'Operativo', criticality: 'Media' });
    setShowForm(true);
  };

  const getName = (list, id) => list.find(x => x.id === id)?.name || '—';
  const filteredSites = sites.filter(s => s.company_id === form.company_id);
  const filteredUnits = units.filter(u => u.site_id === form.site_id);
  const filteredLocations = locations.filter(l => l.business_unit_id === form.business_unit_id);
  const filteredProcesses = processes.filter(p => p.location_id === form.location_id);

  const columns = [
    { key: 'code', label: 'Código', render: r => <span className="font-mono text-xs font-semibold">{r.code}</span> },
    { key: 'name', label: 'Activo Principal', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'category', label: 'Categoría' },
    { key: 'process_id', label: 'Proceso', render: r => getName(processes, r.process_id) },
    { key: 'location_id', label: 'Ubicación', render: r => getName(locations, r.location_id) },
    { key: 'status', label: 'Estado', render: r => <StatusBadge status={r.status} /> },
    { key: 'criticality', label: 'Criticidad', render: r => <StatusBadge status={r.criticality} /> },
    { key: 'manufacturer', label: 'Fabricante' },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openForm(r); }}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="Activos Principales" subtitle={`Nivel 6 · ${assets.length} registros`} action={() => openForm()} actionLabel="Nuevo Activo" actionIcon={Plus} />
      {assets.length === 0 && !isLoading
        ? <EmptyState icon={Package} title="Sin activos" description="Registra los activos principales de tus procesos" actionLabel="Crear Activo" onAction={() => openForm()} />
        : <DataTable columns={columns} data={assets} isLoading={isLoading} />
      }
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Activo' : 'Nuevo Activo Principal'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
            {/* Hierarchy cascade */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Empresa</Label>
                <Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v, site_id: '', business_unit_id: '', location_id: '', process_id: '' })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Sitio</Label>
                <Select value={form.site_id || ''} onValueChange={v => setForm({ ...form, site_id: v, business_unit_id: '', location_id: '', process_id: '' })} disabled={!form.company_id}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{filteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Unidad</Label>
                <Select value={form.business_unit_id || ''} onValueChange={v => setForm({ ...form, business_unit_id: v, location_id: '', process_id: '' })} disabled={!form.site_id}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ubicación</Label>
                <Select value={form.location_id || ''} onValueChange={v => setForm({ ...form, location_id: v, process_id: '' })} disabled={!form.business_unit_id}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Proceso</Label>
              <Select value={form.process_id || ''} onValueChange={v => setForm({ ...form, process_id: v })} disabled={!form.location_id}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar proceso" /></SelectTrigger>
                <SelectContent>{filteredProcesses.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3 grid grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código *</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Categoría</Label>
                <Select value={form.category || 'Mecánico'} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{['Mecánico','Eléctrico','Electrónico','Hidráulico','Neumático','Otro'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Estado</Label>
                <Select value={form.status || 'Operativo'} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{['Operativo','En Mantenimiento','Fuera de Servicio','Baja'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Criticidad</Label>
                <Select value={form.criticality || 'Media'} onValueChange={v => setForm({ ...form, criticality: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{['Alta','Media','Baja'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Fabricante</Label><Input value={form.manufacturer || ''} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></div>
              <div><Label>Modelo</Label><Input value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
              <div><Label>No. Serie</Label><Input value={form.serial_number || ''} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha Instalación</Label><Input type="date" value={form.installation_date || ''} onChange={e => setForm({ ...form, installation_date: e.target.value })} /></div>
              <div><Label>Vida Útil (años)</Label><Input type="number" value={form.useful_life_years || ''} onChange={e => setForm({ ...form, useful_life_years: parseFloat(e.target.value) })} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>Guardar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}