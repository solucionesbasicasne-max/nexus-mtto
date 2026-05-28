import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function BusinessUnits() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  const { data: units = [], isLoading } = useQuery({ queryKey: ['businessUnits'], queryFn: () => base44.entities.BusinessUnit.list('-created_date') });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });

  const saveMutation = useMutation({
    mutationFn: d => editing ? base44.entities.BusinessUnit.update(editing.id, d) : base44.entities.BusinessUnit.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['businessUnits'] }); setShowForm(false); setEditing(null); toast.success('Unidad guardada'); }
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.BusinessUnit.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['businessUnits'] }); toast.success('Eliminada'); }
  });

  const openForm = (item = null) => { setEditing(item); setForm(item || { name: '', active: true }); setShowForm(true); };
  const getName = (list, id) => list.find(x => x.id === id)?.name || '—';
  const filteredSites = sites.filter(s => s.company_id === form.company_id);

  const columns = [
    { key: 'name', label: 'Unidad / Área', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'code', label: 'Código' },
    { key: 'company_id', label: 'Empresa', render: r => getName(companies, r.company_id) },
    { key: 'site_id', label: 'Sitio', render: r => getName(sites, r.site_id) },
    { key: 'manager', label: 'Responsable' },
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
      <PageHeader title="Unidades de Negocio / Áreas" subtitle={`Nivel 3 · ${units.length} registros`} action={() => openForm()} actionLabel="Nueva Unidad" actionIcon={Plus} />
      {units.length === 0 && !isLoading
        ? <EmptyState icon={Layers} title="Sin unidades" description="Define las unidades de negocio o áreas de tus sitios" actionLabel="Crear Unidad" onAction={() => openForm()} />
        : <DataTable columns={columns} data={units} isLoading={isLoading} />
      }
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Unidad' : 'Nueva Unidad de Negocio'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div><Label>Empresa *</Label>
              <Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v, site_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sitio *</Label>
              <Select value={form.site_id || ''} onValueChange={v => setForm({ ...form, site_id: v })} disabled={!form.company_id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar sitio" /></SelectTrigger>
                <SelectContent>{filteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div><Label>Responsable</Label><Input value={form.manager || ''} onChange={e => setForm({ ...form, manager: e.target.value })} /></div>
            <div><Label>Descripción</Label><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center gap-3"><Switch checked={!!form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Activo</Label></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>Guardar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}