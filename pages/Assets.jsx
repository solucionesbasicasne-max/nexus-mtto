import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
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
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list('-created_date') });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Asset.update(editing.id, data) : base44.entities.Asset.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); setShowForm(false); setEditing(null); toast.success('Activo guardado'); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Asset.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); toast.success('Activo eliminado'); }
  });

  const [form, setForm] = useState({});

  const openForm = (asset = null) => {
    setEditing(asset);
    setForm(asset || { name: '', code: '', category: 'Mecánico', status: 'Operativo', criticality: 'Media' });
    setShowForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const getLocationName = (id) => locations.find(l => l.id === id)?.name || '';

  const columns = [
    { key: 'code', label: 'Código', render: r => <span className="font-mono text-xs font-medium">{r.code}</span> },
    { key: 'name', label: 'Nombre', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'category', label: 'Categoría' },
    { key: 'location_id', label: 'Ubicación', render: r => getLocationName(r.location_id) },
    { key: 'status', label: 'Estado', render: r => <StatusBadge status={r.status} /> },
    { key: 'criticality', label: 'Criticidad', render: r => <StatusBadge status={r.criticality} /> },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openForm(r); }}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="Activos" subtitle={`${assets.length} activos registrados`} action={() => openForm()} actionLabel="Nuevo Activo" actionIcon={Plus} />
      {assets.length === 0 && !isLoading ? (
        <EmptyState icon={Package} title="Sin activos" description="Registra tu primer activo para comenzar" actionLabel="Crear Activo" onAction={() => openForm()} />
      ) : (
        <DataTable columns={columns} data={assets} isLoading={isLoading} />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Activo' : 'Nuevo Activo'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div><Label>Código *</Label><Input value={form.code || ''} onChange={e => setForm({...form, code: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoría</Label>
                <Select value={form.category || ''} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Mecánico','Eléctrico','Electrónico','Hidráulico','Neumático','Otro'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ubicación</Label>
                <Select value={form.location_id || ''} onValueChange={v => setForm({...form, location_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Estado</Label>
                <Select value={form.status || 'Operativo'} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Operativo','En Mantenimiento','Fuera de Servicio','Baja'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Criticidad</Label>
                <Select value={form.criticality || 'Media'} onValueChange={v => setForm({...form, criticality: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Alta','Media','Baja'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Fecha Instalación</Label><Input type="date" value={form.installation_date || ''} onChange={e => setForm({...form, installation_date: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Fabricante</Label><Input value={form.manufacturer || ''} onChange={e => setForm({...form, manufacturer: e.target.value})} /></div>
              <div><Label>Modelo</Label><Input value={form.model || ''} onChange={e => setForm({...form, model: e.target.value})} /></div>
              <div><Label>No. Serie</Label><Input value={form.serial_number || ''} onChange={e => setForm({...form, serial_number: e.target.value})} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}