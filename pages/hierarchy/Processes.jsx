import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, GitBranch, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const PROCESS_TYPES = ['Producción', 'Envasado', 'Almacén', 'Servicios', 'Utilidades', 'Otro'];

export default function Processes() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  const { data: processes = [], isLoading } = useQuery({ queryKey: ['processes'], queryFn: () => base44.entities.Process.list('-created_date') });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: units = [] } = useQuery({ queryKey: ['businessUnits'], queryFn: () => base44.entities.BusinessUnit.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });

  const saveMutation = useMutation({
    mutationFn: d => editing ? base44.entities.Process.update(editing.id, d) : base44.entities.Process.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['processes'] }); setShowForm(false); setEditing(null); toast.success('Proceso guardado'); }
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Process.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['processes'] }); toast.success('Eliminado'); }
  });

  const openForm = (item = null) => { setEditing(item); setForm(item || { name: '', active: true, process_type: 'Producción' }); setShowForm(true); };
  const getName = (list, id) => list.find(x => x.id === id)?.name || '—';

  const filteredSites = sites.filter(s => s.company_id === form.company_id);
  const filteredUnits = units.filter(u => u.site_id === form.site_id);
  const filteredLocations = locations.filter(l => l.business_unit_id === form.business_unit_id);

  const columns = [
    { key: 'name', label: 'Proceso', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'code', label: 'Código' },
    { key: 'process_type', label: 'Tipo' },
    { key: 'company_id', label: 'Empresa', render: r => getName(companies, r.company_id) },
    { key: 'site_id', label: 'Sitio', render: r => getName(sites, r.site_id) },
    { key: 'location_id', label: 'Ubicación', render: r => getName(locations, r.location_id) },
    { key: 'active', label: 'Activo', render: r => <span className={`text-xs font-medium ${r.active ? 'text-emerald-600' : 'text-gray-400'}`}>{r.active ? '✓' : '✗'}</span> },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openForm(r); }}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="Procesos" subtitle={`Nivel 5 · ${processes.length} registros`} action={() => openForm()} actionLabel="Nuevo Proceso" actionIcon={Plus} />
      {processes.length === 0 && !isLoading
        ? <EmptyState icon={GitBranch} title="Sin procesos" description="Define los procesos productivos en tus ubicaciones" actionLabel="Crear Proceso" onAction={() => openForm()} />
        : <DataTable columns={columns} data={processes} isLoading={isLoading} />
      }
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Proceso' : 'Nuevo Proceso'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
            <div><Label>Empresa</Label>
              <Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v, site_id: '', business_unit_id: '', location_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sitio</Label>
              <Select value={form.site_id || ''} onValueChange={v => setForm({ ...form, site_id: v, business_unit_id: '', location_id: '' })} disabled={!form.company_id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{filteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Unidad de Negocio</Label>
              <Select value={form.business_unit_id || ''} onValueChange={v => setForm({ ...form, business_unit_id: v, location_id: '' })} disabled={!form.site_id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Ubicación *</Label>
              <Select value={form.location_id || ''} onValueChange={v => setForm({ ...form, location_id: v })} disabled={!form.business_unit_id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div><Label>Tipo de Proceso</Label>
              <Select value={form.process_type || 'Producción'} onValueChange={v => setForm({ ...form, process_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROCESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Descripción</Label><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center gap-3"><Switch checked={!!form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Activo</Label></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>Guardar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}