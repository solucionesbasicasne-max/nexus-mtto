import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import HierarchyBreadcrumb from '@/components/hierarchy/HierarchyBreadcrumb';
import { Plus, Cpu, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const SYSTEM_TYPES = ['Mecánico','Eléctrico','Hidráulico','Neumático','Control','Refrigeración','Lubricación','Otro'];

export default function Systems() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  const { data: systems = [], isLoading } = useQuery({ queryKey: ['systems'], queryFn: () => base44.entities.AssetSystem.list('-created_date') });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: processes = [] } = useQuery({ queryKey: ['processes'], queryFn: () => base44.entities.Process.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });

  const saveMutation = useMutation({
    mutationFn: d => editing ? base44.entities.AssetSystem.update(editing.id, d) : base44.entities.AssetSystem.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['systems'] }); setShowForm(false); setEditing(null); toast.success('Sistema guardado'); }
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.AssetSystem.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['systems'] }); toast.success('Eliminado'); }
  });

  const openForm = (item = null) => { setEditing(item); setForm(item || { name: '', active: true, system_type: 'Mecánico' }); setShowForm(true); };
  const getName = (list, id) => list.find(x => x.id === id)?.name || '—';
  const filteredAssets = assets.filter(a => a.process_id === form.process_id);

  const columns = [
    { key: 'code', label: 'Código', render: r => <span className="font-mono text-xs font-semibold">{r.code || '—'}</span> },
    { key: 'name', label: 'Sistema', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'system_type', label: 'Tipo' },
    { key: 'asset_id', label: 'Activo Principal', render: r => getName(assets, r.asset_id) },
    { key: 'description', label: 'Descripción', render: r => <span className="text-muted-foreground text-xs truncate max-w-[150px] block">{r.description || '—'}</span> },
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
      <PageHeader title="Sistemas" subtitle={`Nivel 7 · ${systems.length} registros`} action={() => openForm()} actionLabel="Nuevo Sistema" actionIcon={Plus} />
      {systems.length === 0 && !isLoading
        ? <EmptyState icon={Cpu} title="Sin sistemas" description="Registra los sistemas que conforman cada activo principal" actionLabel="Crear Sistema" onAction={() => openForm()} />
        : <DataTable columns={columns} data={systems} isLoading={isLoading} />
      }
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Sistema' : 'Nuevo Sistema'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
            <div><Label>Proceso (filtrar activos)</Label>
              <Select value={form.process_id || ''} onValueChange={v => setForm({ ...form, process_id: v, asset_id: '' })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar proceso" /></SelectTrigger>
                <SelectContent>{processes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Activo Principal *</Label>
              <Select value={form.asset_id || ''} onValueChange={v => setForm({ ...form, asset_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar activo" /></SelectTrigger>
                <SelectContent>{(form.process_id ? filteredAssets : assets).map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div><Label>Tipo de Sistema</Label>
              <Select value={form.system_type || 'Mecánico'} onValueChange={v => setForm({ ...form, system_type: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{SYSTEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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