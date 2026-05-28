import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function Locations() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list('-created_date') });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: units = [] } = useQuery({ queryKey: ['businessUnits'], queryFn: () => base44.entities.BusinessUnit.list() });

  const saveMutation = useMutation({
    mutationFn: d => editing ? base44.entities.Location.update(editing.id, d) : base44.entities.Location.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); setShowForm(false); setEditing(null); toast.success('Ubicación guardada'); }
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Location.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); toast.success('Eliminada'); }
  });

  const openForm = (item = null) => { setEditing(item); setForm(item || { name: '' }); setShowForm(true); };
  const getName = (list, id) => list.find(x => x.id === id)?.name || '—';

  const filteredSites = sites.filter(s => s.company_id === form.company_id);
  const filteredUnits = units.filter(u => u.site_id === form.site_id);

  const columns = [
    { key: 'name', label: 'Ubicación', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'code', label: 'Código' },
    { key: 'company_id', label: 'Empresa', render: r => getName(companies, r.company_id) },
    { key: 'site_id', label: 'Sitio', render: r => getName(sites, r.site_id) },
    { key: 'business_unit_id', label: 'Unidad', render: r => getName(units, r.business_unit_id) },
    { key: 'plant', label: 'Planta' },
    { key: 'area', label: 'Área' },
    { key: 'line', label: 'Línea' },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openForm(r); }}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="Ubicaciones" subtitle={`Nivel 4 · ${locations.length} registros`} action={() => openForm()} actionLabel="Nueva Ubicación" actionIcon={Plus} />
      {locations.length === 0 && !isLoading
        ? <EmptyState icon={MapPin} title="Sin ubicaciones" description="Define las ubicaciones físicas dentro de tus unidades" actionLabel="Crear Ubicación" onAction={() => openForm()} />
        : <DataTable columns={columns} data={locations} isLoading={isLoading} />
      }
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Ubicación' : 'Nueva Ubicación'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div><Label>Empresa</Label>
              <Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v, site_id: '', business_unit_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sitio</Label>
              <Select value={form.site_id || ''} onValueChange={v => setForm({ ...form, site_id: v, business_unit_id: '' })} disabled={!form.company_id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{filteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Unidad de Negocio</Label>
              <Select value={form.business_unit_id || ''} onValueChange={v => setForm({ ...form, business_unit_id: v })} disabled={!form.site_id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Planta</Label><Input value={form.plant || ''} onChange={e => setForm({ ...form, plant: e.target.value })} /></div>
              <div><Label>Área</Label><Input value={form.area || ''} onChange={e => setForm({ ...form, area: e.target.value })} /></div>
              <div><Label>Línea</Label><Input value={form.line || ''} onChange={e => setForm({ ...form, line: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>Guardar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}