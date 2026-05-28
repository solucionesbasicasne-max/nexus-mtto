import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Cog, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const COMPONENT_TYPES = ['Motor','Bomba','Válvula','Sensor','Actuador','Reductor','Rodamiento','Correa','Otro'];

export default function Components() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  const { data: components = [], isLoading } = useQuery({ queryKey: ['components'], queryFn: () => base44.entities.Component.list('-created_date') });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: systems = [] } = useQuery({ queryKey: ['systems'], queryFn: () => base44.entities.AssetSystem.list() });

  const saveMutation = useMutation({
    mutationFn: d => editing ? base44.entities.Component.update(editing.id, d) : base44.entities.Component.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['components'] }); setShowForm(false); setEditing(null); toast.success('Componente guardado'); }
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Component.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['components'] }); toast.success('Eliminado'); }
  });

  const openForm = (item = null) => { setEditing(item); setForm(item || { name: '', active: true, component_type: 'Motor' }); setShowForm(true); };
  const getName = (list, id) => list.find(x => x.id === id)?.name || '—';
  const filteredSystems = systems.filter(s => s.asset_id === form.asset_id);

  const columns = [
    { key: 'code', label: 'Código', render: r => <span className="font-mono text-xs font-semibold">{r.code || '—'}</span> },
    { key: 'name', label: 'Componente', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'component_type', label: 'Tipo' },
    { key: 'system_id', label: 'Sistema', render: r => getName(systems, r.system_id) },
    { key: 'asset_id', label: 'Activo', render: r => getName(assets, r.asset_id) },
    { key: 'manufacturer', label: 'Fabricante' },
    { key: 'model', label: 'Modelo' },
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
      <PageHeader title="Componentes" subtitle={`Nivel 8 · ${components.length} registros`} action={() => openForm()} actionLabel="Nuevo Componente" actionIcon={Plus} />
      {components.length === 0 && !isLoading
        ? <EmptyState icon={Cog} title="Sin componentes" description="Registra los componentes de cada sistema" actionLabel="Crear Componente" onAction={() => openForm()} />
        : <DataTable columns={columns} data={components} isLoading={isLoading} />
      }
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Componente' : 'Nuevo Componente'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
            <div><Label>Activo Principal *</Label>
              <Select value={form.asset_id || ''} onValueChange={v => setForm({ ...form, asset_id: v, system_id: '' })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar activo" /></SelectTrigger>
                <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sistema *</Label>
              <Select value={form.system_id || ''} onValueChange={v => setForm({ ...form, system_id: v })} disabled={!form.asset_id}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar sistema" /></SelectTrigger>
                <SelectContent>{filteredSystems.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código</Label><Input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div><Label>Tipo</Label>
              <Select value={form.component_type || 'Motor'} onValueChange={v => setForm({ ...form, component_type: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{COMPONENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Fabricante</Label><Input value={form.manufacturer || ''} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></div>
              <div><Label>Modelo</Label><Input value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
              <div><Label>No. Serie</Label><Input value={form.serial_number || ''} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></div>
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