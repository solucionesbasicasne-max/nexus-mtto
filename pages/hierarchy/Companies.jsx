import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function Companies() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: d => editing ? base44.entities.Company.update(editing.id, d) : base44.entities.Company.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); setShowForm(false); setEditing(null); toast.success('Empresa guardada'); }
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Company.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); toast.success('Empresa eliminada'); }
  });

  const openForm = (item = null) => { setEditing(item); setForm(item || { name: '', active: true }); setShowForm(true); };

  const columns = [
    { key: 'name', label: 'Empresa', render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'rfc', label: 'RFC / ID Fiscal' },
    { key: 'industry', label: 'Industria' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono' },
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
      <PageHeader title="Empresas" subtitle={`Nivel 1 de jerarquía · ${companies.length} registros`} action={() => openForm()} actionLabel="Nueva Empresa" actionIcon={Plus} />
      {companies.length === 0 && !isLoading
        ? <EmptyState icon={Building2} title="Sin empresas" description="Registra la empresa raíz de tu organización" actionLabel="Crear Empresa" onAction={() => openForm()} />
        : <DataTable columns={columns} data={companies} isLoading={isLoading} />
      }
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Empresa' : 'Nueva Empresa'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div><Label>Nombre *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>RFC / ID Fiscal</Label><Input value={form.rfc || ''} onChange={e => setForm({ ...form, rfc: e.target.value })} /></div>
              <div><Label>Industria / Giro</Label><Input value={form.industry || ''} onChange={e => setForm({ ...form, industry: e.target.value })} /></div>
            </div>
            <div><Label>Dirección</Label><Input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Teléfono</Label><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-3"><Switch checked={!!form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Empresa Activa</Label></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saveMutation.isPending}>Guardar</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}