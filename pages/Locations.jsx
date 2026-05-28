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
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Location.update(editing.id, data) : base44.entities.Location.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); setShowForm(false); setEditing(null); toast.success('Ubicación guardada'); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Location.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); toast.success('Ubicación eliminada'); }
  });

  const [form, setForm] = useState({});

  const openForm = (loc = null) => {
    setEditing(loc);
    setForm(loc || { name: '', plant: '', area: '', line: '' });
    setShowForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const getParentName = (id) => locations.find(l => l.id === id)?.name || '—';

  const columns = [
    { key: 'name', label: 'Nombre', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'plant', label: 'Planta' },
    { key: 'area', label: 'Área' },
    { key: 'line', label: 'Línea' },
    { key: 'parent_location_id', label: 'Ubicación Padre', render: r => getParentName(r.parent_location_id) },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openForm(r); }}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="Ubicaciones" subtitle={`${locations.length} ubicaciones`} action={() => openForm()} actionLabel="Nueva Ubicación" actionIcon={Plus} />
      {locations.length === 0 && !isLoading ? (
        <EmptyState icon={MapPin} title="Sin ubicaciones" description="Crea la primera ubicación" actionLabel="Crear Ubicación" onAction={() => openForm()} />
      ) : (
        <DataTable columns={columns} data={locations} isLoading={isLoading} />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Ubicación' : 'Nueva Ubicación'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Planta</Label><Input value={form.plant || ''} onChange={e => setForm({...form, plant: e.target.value})} /></div>
              <div><Label>Área</Label><Input value={form.area || ''} onChange={e => setForm({...form, area: e.target.value})} /></div>
              <div><Label>Línea</Label><Input value={form.line || ''} onChange={e => setForm({...form, line: e.target.value})} /></div>
            </div>
            <div><Label>Ubicación Padre</Label>
              <Select value={form.parent_location_id || 'none'} onValueChange={v => setForm({...form, parent_location_id: v === 'none' ? '' : v})}>
                <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  {locations.filter(l => l.id !== editing?.id).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
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