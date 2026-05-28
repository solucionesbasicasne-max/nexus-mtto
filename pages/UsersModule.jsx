import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Edit2, Mail, Shield, UserCheck, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['Admin', 'Supervisor', 'Técnico', 'Visualizador'];

const ROLE_COLORS = {
  'Admin': 'bg-red-100 text-red-700 border-red-200',
  'Supervisor': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Técnico': 'bg-blue-100 text-blue-700 border-blue-200',
  'Visualizador': 'bg-gray-100 text-gray-600 border-gray-200',
};

const ALL_PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'personnel', label: 'Personal' },
  { key: 'plans', label: 'Planes de Mant.' },
  { key: 'preventive', label: 'Mant. Preventivo' },
  { key: 'work-orders', label: 'Órdenes de Trabajo' },
  { key: 'inventory', label: 'Inventario' },
  { key: 'gantt', label: 'Diagrama Gantt' },
  { key: 'reports', label: 'Reportes' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'hierarchy', label: 'Jerarquía' },
  { key: 'settings', label: 'Configuración' },
  { key: 'users', label: 'Usuarios' },
];

export default function UsersModule() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ email: '', display_name: '', username: '', app_password: '', app_role: 'Técnico', allowed_pages: [], is_active: true });
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['userProfiles'],
    queryFn: () => base44.entities.UserProfile.list('-created_date', 100)
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list()
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.UserProfile.update(editing.id, data)
      : base44.entities.UserProfile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? 'Usuario actualizado' : 'Usuario registrado');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.UserProfile.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
      toast.success('Usuario eliminado');
    }
  });

  const openNew = () => {
    setEditing(null);
    setForm({ email: '', display_name: '', username: '', app_password: '', app_role: 'Técnico', allowed_pages: [], is_active: true });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ email: p.email, display_name: p.display_name || '', username: p.username || '', app_password: p.app_password || '', app_role: p.app_role, allowed_pages: p.allowed_pages || [], is_active: p.is_active !== false, employee_id: p.employee_id || '' });
    setShowForm(true);
  };

  const togglePage = (key) => {
    setForm(f => ({
      ...f,
      allowed_pages: f.allowed_pages.includes(key)
        ? f.allowed_pages.filter(p => p !== key)
        : [...f.allowed_pages, key]
    }));
  };

  const filtered = profiles.filter(p =>
    !search || p.email?.toLowerCase().includes(search.toLowerCase()) || p.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-primary" />Módulo de Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gestión de accesos y perfiles de usuario</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nuevo Usuario</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {ROLES.map(role => {
          const count = profiles.filter(p => p.app_role === role).length;
          return (
            <Card key={role} className="border-0 shadow-sm p-4">
              <p className="text-xs text-muted-foreground">{role}</p>
              <p className="text-2xl font-bold mt-1">{count}</p>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar usuario..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Acceso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{(p.display_name || p.email || '?')[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium">{p.display_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{p.username || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS[p.app_role] || 'bg-muted'}`}>{p.app_role}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {!p.allowed_pages || p.allowed_pages.length === 0 ? 'Acceso total' : `${p.allowed_pages.length} módulo(s)`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {p.is_active !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Sin usuarios registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="usuario@empresa.com" />
              </div>
              <div className="col-span-2">
                <Label>Nombre para mostrar</Label>
                <Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Nombre completo" />
              </div>
              <div>
                <Label>Nombre de usuario *</Label>
                <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="ej: jperez" required />
              </div>
              <div>
                <Label>Contraseña *</Label>
                <Input type="password" value={form.app_password} onChange={e => setForm({ ...form, app_password: e.target.value })} placeholder="Contraseña de acceso" required={!editing} />
              </div>
              <div>
                <Label>Rol *</Label>
                <Select value={form.app_role} onValueChange={v => setForm({ ...form, app_role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.is_active ? 'active' : 'inactive'} onValueChange={v => setForm({ ...form, is_active: v === 'active' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Empleado vinculado (opcional)</Label>
                <Select value={form.employee_id || ''} onValueChange={v => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin vincular</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Módulos permitidos <span className="text-muted-foreground font-normal">(vacío = acceso total)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PAGES.map(pg => (
                  <label key={pg.key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${form.allowed_pages.includes(pg.key) ? 'bg-primary/10 border-primary/30 text-primary font-medium' : 'border-border hover:bg-muted/50'}`}>
                    <input type="checkbox" className="hidden" checked={form.allowed_pages.includes(pg.key)} onChange={() => togglePage(pg.key)} />
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${form.allowed_pages.includes(pg.key) ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                      {form.allowed_pages.includes(pg.key) && <div className="w-2 h-2 bg-white rounded-sm" />}
                    </div>
                    {pg.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}