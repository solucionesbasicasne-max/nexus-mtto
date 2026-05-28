import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, User, Loader2, DollarSign, Clock, QrCode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

const availabilityColor = {
  'Disponible': 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  'Ocupado': 'bg-amber-500/15 text-amber-700 border-amber-200',
  'Vacaciones': 'bg-blue-500/15 text-blue-700 border-blue-200',
  'Baja': 'bg-red-500/15 text-red-700 border-red-200',
};

export default function LaborForce() {
  const [search, setSearch] = useState('');
  const [availFilter, setAvailFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [qrEmployee, setQrEmployee] = useState(null);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 200)
  });
  const { data: specialties = [] } = useQuery({
    queryKey: ['specialties'],
    queryFn: () => base44.entities.Specialty.list()
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => base44.entities.Shift.list()
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); toast.success('Actualizado'); }
  });

  const getSpecialtyName = (id) => specialties.find(s => s.id === id)?.name || '—';
  const getShiftName = (id) => shifts.find(s => s.id === id)?.name || '—';
  const getShift = (id) => shifts.find(s => s.id === id);

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.position?.toLowerCase().includes(search.toLowerCase());
    const matchAvail = availFilter === 'all' || e.availability === availFilter;
    const matchType = typeFilter === 'all' || e.worker_type === typeFilter;
    return matchSearch && matchAvail && matchType && e.status === 'Activo';
  });

  const stats = {
    disponible: employees.filter(e => e.status === 'Activo' && e.availability === 'Disponible').length,
    ocupado: employees.filter(e => e.status === 'Activo' && e.availability === 'Ocupado').length,
    internos: employees.filter(e => e.status === 'Activo' && e.worker_type === 'Interno').length,
    externos: employees.filter(e => e.status === 'Activo' && e.worker_type === 'Externo').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mano de Obra</h2>
        <p className="text-sm text-muted-foreground">Control de recursos humanos para asignación a órdenes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Disponibles', value: stats.disponible, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Ocupados', value: stats.ocupado, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Internos', value: stats.internos, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Externos', value: stats.externos, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.bg}`}>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar empleado..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={availFilter} onValueChange={setAvailFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Disponibilidad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Disponible">Disponible</SelectItem>
            <SelectItem value="Ocupado">Ocupado</SelectItem>
            <SelectItem value="Vacaciones">Vacaciones</SelectItem>
            <SelectItem value="Baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Interno">Interno</SelectItem>
            <SelectItem value="Externo">Externo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider">Empleado</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider">Especialidad</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider hidden md:table-cell">Costo/Hr</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider hidden lg:table-cell">Turno</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider hidden lg:table-cell">Hrs/Día</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider">Disponibilidad</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wider">QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {emp.photo_url ? (
                            <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground" /></div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{getSpecialtyName(emp.specialty_id)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">{emp.worker_type || 'Interno'}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                     <div className="flex items-center gap-1 text-sm">
                       <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                       <span>{emp.hourly_rate ? `${emp.hourly_rate}/hr` : '—'}</span>
                     </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                     <Select value={emp.shift_id || ''} onValueChange={v => updateMutation.mutate({ id: emp.id, data: { shift_id: v } })}>
                       <SelectTrigger className="h-7 text-xs w-36 border-dashed">
                         <SelectValue placeholder="Asignar turno" />
                       </SelectTrigger>
                       <SelectContent>
                         {shifts.map(s => (
                           <SelectItem key={s.id} value={s.id}>
                             <div className="flex items-center gap-1.5">
                               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || '#3b82f6' }} />
                               {s.name}
                             </div>
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                     {emp.shift_id ? (
                       <div className="flex items-center gap-1 text-sm">
                         <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                         <span className="font-semibold">{getShift(emp.shift_id)?.daily_hours || '—'}h</span>
                       </div>
                     ) : <span className="text-muted-foreground text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3">
                     <Badge className={`text-[11px] px-2 border ${availabilityColor[emp.availability] || 'bg-muted text-muted-foreground'}`}>
                       {emp.availability || 'N/A'}
                     </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQrEmployee(emp)} title="Ver QR">
                        <QrCode className="w-4 h-4 text-primary" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin resultados</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Dialog */}
      <Dialog open={!!qrEmployee} onOpenChange={() => setQrEmployee(null)}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader><DialogTitle>Código QR — Checador de Asistencia</DialogTitle></DialogHeader>
          {qrEmployee && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted border">
                {qrEmployee.photo_url
                  ? <img src={qrEmployee.photo_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><User className="w-6 h-6 text-muted-foreground" /></div>}
              </div>
              <div>
                <p className="font-bold">{qrEmployee.full_name}</p>
                <p className="text-xs text-muted-foreground">{qrEmployee.employee_id} · {qrEmployee.position}</p>
              </div>
              <div className="p-3 bg-white rounded-xl border shadow-sm">
                <QRCodeSVG
                  value={qrEmployee.employee_id || qrEmployee.id}
                  size={180}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#111827"
                />
              </div>
              <p className="text-xs text-muted-foreground">Escanea este QR en el Checador de Asistencia</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}