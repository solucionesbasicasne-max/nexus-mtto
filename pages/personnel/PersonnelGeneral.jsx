import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Plus, Search, Edit2, User, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const DEPARTMENTS = ['Mantenimiento', 'Producción', 'Administración', 'Logística', 'Calidad', 'Seguridad', 'TI', 'Recursos Humanos'];

export default function PersonnelGeneral() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 200)
  });
  const { data: specialties = [] } = useQuery({
    queryKey: ['specialties'],
    queryFn: () => base44.entities.Specialty.list()
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) return base44.entities.Employee.update(editing.id, data);
      const count = employees.length + 1;
      const employee_id = `EMP-${String(count).padStart(4, '0')}`;
      return base44.entities.Employee.create({ ...data, employee_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? 'Empleado actualizado' : 'Empleado registrado');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Error al guardar empleado: ' + (err.message || 'Error desconocido'));
    }
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, photo_url: file_url }));
      toast.success('Fotografía cargada');
    } finally {
      setUploading(false);
    }
  };

  const openNew = () => {
    setForm({ status: 'Activo', worker_type: 'Interno', availability: 'Disponible', hire_date: format(new Date(), 'yyyy-MM-dd') });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (emp) => {
    setForm({ ...emp });
    setEditing(emp);
    setShowForm(true);
  };

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.employee_id?.toLowerCase().includes(search.toLowerCase()) || e.position?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getSpecialtyName = (id) => specialties.find(s => s.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Personal General</h2>
          <p className="text-sm text-muted-foreground">{employees.filter(e => e.status === 'Activo').length} empleados activos</p>
        </div>
        <Button onClick={openNew} className="gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" />Nuevo Empleado
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre, ID o puesto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Activo">Activo</SelectItem>
            <SelectItem value="Inactivo">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin empleados registrados</p>
          <p className="text-sm mt-1">Agrega el primer empleado</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <div key={emp.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all group cursor-pointer" onClick={() => openEdit(emp)}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border">
                  {emp.photo_url ? (
                    <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{emp.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.position}</p>
                  <p className="text-[11px] font-mono text-primary mt-0.5">{emp.employee_id}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 flex-shrink-0" onClick={e => { e.stopPropagation(); openEdit(emp); }}>
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="space-y-1.5 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Área:</span> {emp.department || '—'}</p>
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Especialidad:</span> {getSpecialtyName(emp.specialty_id)}</p>
                <div className="flex items-center justify-between pt-1">
                  <Badge variant={emp.status === 'Activo' ? 'default' : 'secondary'} className={`text-[10px] px-2 ${emp.status === 'Activo' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200' : 'bg-muted'}`}>
                    {emp.status}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-2 ${emp.availability === 'Disponible' ? 'border-emerald-300 text-emerald-700' : emp.availability === 'Ocupado' ? 'border-amber-300 text-amber-700' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                    {emp.availability || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-5">
            {/* Photo */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted border-2 border-dashed border-border flex items-center justify-center">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <Label htmlFor="photo-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border bg-muted hover:bg-muted/70 transition-colors">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? 'Subiendo...' : 'Cargar Fotografía'}
                </div>
                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </Label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Nombre Completo *</Label>
                <Input value={form.full_name || ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div>
                <Label>Puesto *</Label>
                <Input value={form.position || ''} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} required />
              </div>
              <div>
                <Label>Área / Departamento *</Label>
                <Select value={form.department || ''} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Correo Electrónico</Label>
                <Input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Fecha de Ingreso *</Label>
                <Input type="date" value={form.hire_date || ''} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} required />
              </div>
              <div>
                <Label>Especialidad</Label>
                <Select value={form.specialty_id || ''} onValueChange={v => setForm(f => ({ ...f, specialty_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{specialties.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Trabajador</Label>
                <Select value={form.worker_type || 'Interno'} onValueChange={v => setForm(f => ({ ...f, worker_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interno">Interno</SelectItem>
                    <SelectItem value="Externo">Externo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Costo por Hora ($)</Label>
                <Input type="number" step="0.01" value={form.hourly_rate || ''} onChange={e => setForm(f => ({ ...f, hourly_rate: parseFloat(e.target.value) }))} />
              </div>
              <div>
                <Label>Disponibilidad</Label>
                <Select value={form.availability || 'Disponible'} onValueChange={v => setForm(f => ({ ...f, availability: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Disponible', 'Ocupado', 'Vacaciones', 'Baja'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estatus</Label>
                <Select value={form.status || 'Activo'} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editing ? 'Actualizar' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}