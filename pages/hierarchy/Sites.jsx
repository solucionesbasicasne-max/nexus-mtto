import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, MapPinned, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function Sites() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  const { data: sites = [], isLoading } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list('-created_date') });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });

  const saveMutation = useMutation({
    mutationFn: d => editing ? base44.entities.Site.update(editing.id, d) : base44.entities.Site.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); setShowForm(false); setEditing(null); toast.success('Sitio guardado'); }
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Site.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); toast.success('Sitio eliminado'); }
  });

  const openForm = (item = null) => { setEditing(item); setForm(item || { name: '', active: true, country: 'México' }); setShowForm(true); };
  const getCompany = id => companies.find(c => c.id === id)?.name || '—';

  const columns = [
    { key: 'name', label: 'Sitio / Planta', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'code', label: 'Código' },
    { key: 'company_id', label: 'Empresa', render: r => getCompany(r.company_id) },
    { key: 'city', label: 'Ciudad' },
    { key: 'state', label: 'Estado' },
    { key: 'country', label: 'País' },
    { key: 'active', label: 'Activo', render: r => <span className={`text-xs font-medium ${r.active ? 'text-emerald-600' : 'text-gray-400'}`}>{r.active ? '✓ Activo' : 'Inactivo'}</span> },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); openForm(r); }}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="Sitios / Plantas" subtitle={`Nivel 2 · ${sites.length} registros`} action={() => openForm()} actionLabel="Nuevo Sitio" actionIcon={Plus} />
      {sites.length === 0 && !isLoading
        ? <EmptyState icon={MapPinned} title="Sin sitios" description="Agrega plantas o sitios a tus empresas" actionLabel="Crear Sitio" onAction={() => openForm()} />
        : <DataTable columns={columns} data={sites} isLoading={isLoading} />
      }
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Sitio' : 'Nuevo Sitio'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div><Label>Empresa *</Label>
              <Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div><Label>Dirección</Label><Input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Ciudad</Label><Input value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Estado</Label><Input value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              <div><Label>País</Label><Input value={form.country || 'México'} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-3"><Switch checked={!!form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Sitio Activo</Label></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>Guardar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}