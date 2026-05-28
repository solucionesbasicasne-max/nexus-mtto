import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { Printer, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const STATUS_COLORS = {
  'Asistencia': 'bg-emerald-500 text-white',
  'Retardo': 'bg-amber-500 text-white',
  'Falta': 'bg-red-500 text-white',
  'Justificada': 'bg-blue-500 text-white',
};

const STATUS_SHORT = {
  'Asistencia': 'A',
  'Retardo': 'R',
  'Falta': 'F',
  'Justificada': 'J',
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function AttendanceReport() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  const [deptFilter, setDeptFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });
  const { data: records = [] } = useQuery({ queryKey: ['attendance'], queryFn: () => base44.entities.AttendanceRecord.list('-date', 1000) });

  const baseDate = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const allWeekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekDays = allWeekDays.filter(d => selectedDays.includes(d.getDay()));

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
  const filteredEmployees = employees.filter(e => e.status === 'Activo' && (deptFilter === 'all' || e.department === deptFilter));

  const getRecord = (empId, dayKey) => records.find(r => r.employee_id === empId && r.date === dayKey);

  const empStats = (emp) => {
    const empRecords = records.filter(r => r.employee_id === emp.id && weekDays.some(d => format(d, 'yyyy-MM-dd') === r.date));
    return {
      asistencia: empRecords.filter(r => r.status === 'Asistencia').length,
      retardos: empRecords.filter(r => r.status === 'Retardo').length,
      faltas: empRecords.filter(r => r.status === 'Falta').length,
      total: weekDays.length,
    };
  };

  const toggleDay = (dayNum) => setSelectedDays(prev => prev.includes(dayNum) ? prev.filter(d => d !== dayNum) : [...prev, dayNum].sort());

  const printReport = () => {
    const dayHeaders = weekDays.map(d => `<th style="min-width:50px;text-align:center;padding:4px;border:1px solid #ddd;font-size:9px">${DAY_NAMES[d.getDay()]}<br/>${format(d,'d/MM')}</th>`).join('');
    const rows = filteredEmployees.map(emp => {
      const s = empStats(emp);
      const dayCells = weekDays.map(day => {
        const rec = getRecord(emp.id, format(day, 'yyyy-MM-dd'));
        const colors = { 'Asistencia': '#10b981', 'Retardo': '#f59e0b', 'Falta': '#ef4444', 'Justificada': '#3b82f6' };
        return `<td style="text-align:center;padding:4px;border:1px solid #ddd;background:${rec ? colors[rec.status] : '#f9fafb'};color:${rec ? 'white' : '#ddd'};font-size:9px;font-weight:bold">${rec ? STATUS_SHORT[rec.status] : '—'}</td>`;
      }).join('');
      return `<tr>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:9px">${emp.full_name}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:9px">${emp.department}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:9px">${emp.position}</td>
        ${dayCells}
        <td style="text-align:center;padding:4px;border:1px solid #ddd;color:#10b981;font-weight:bold;font-size:9px">${s.asistencia}</td>
        <td style="text-align:center;padding:4px;border:1px solid #ddd;color:#f59e0b;font-weight:bold;font-size:9px">${s.retardos}</td>
        <td style="text-align:center;padding:4px;border:1px solid #ddd;color:#ef4444;font-weight:bold;font-size:9px">${s.faltas}</td>
      </tr>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Reporte de Asistencia</title>
    <style>body{font-family:Arial,sans-serif;font-size:10px;margin:10px}table{width:100%;border-collapse:collapse}@media print{body{margin:0}}</style>
    </head><body>
    <h2 style="font-size:14px">REPORTE DE ASISTENCIA — ${format(weekStart,'dd/MM/yyyy')} al ${format(weekEnd,'dd/MM/yyyy')}</h2>
    <p style="font-size:10px;color:#666">Generado: ${format(new Date(),'dd/MM/yyyy HH:mm')} | Empleados: ${filteredEmployees.length}</p>
    <table>
      <thead><tr style="background:#1e3a5f;color:white">
        <th style="text-align:left;padding:6px 8px;font-size:9px;border:1px solid #ddd">Empleado</th>
        <th style="text-align:left;padding:6px 8px;font-size:9px;border:1px solid #ddd">Área</th>
        <th style="text-align:left;padding:6px 8px;font-size:9px;border:1px solid #ddd">Puesto</th>
        ${dayHeaders}
        <th style="text-align:center;padding:4px;font-size:9px;border:1px solid #ddd">Asist.</th>
        <th style="text-align:center;padding:4px;font-size:9px;border:1px solid #ddd">Ret.</th>
        <th style="text-align:center;padding:4px;font-size:9px;border:1px solid #ddd">Faltas</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:10px;display:flex;gap:20px;font-size:9px">
      <span>● Verde = Asistencia</span><span>● Amarillo = Retardo</span><span>● Rojo = Falta</span><span>● Azul = Justificada</span>
    </div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Reporte de Asistencia</h2>
          <p className="text-sm text-muted-foreground">{filteredEmployees.length} empleados activos</p>
        </div>
        <Button onClick={printReport} variant="outline" className="gap-2 self-start">
          <Printer className="w-4 h-4" />Imprimir Reporte
        </Button>
      </div>

      <div className="bg-card border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-semibold min-w-[180px] text-center">{format(weekStart, 'd MMM')} — {format(weekEnd, 'd MMM yyyy')}</span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">Hoy</Button>
          <div className="ml-auto">
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Días a mostrar</Label>
          <div className="flex gap-2 flex-wrap">
            {allWeekDays.map(day => {
              const dayNum = day.getDay();
              const active = selectedDays.includes(dayNum);
              return (
                <button key={dayNum} onClick={() => toggleDay(dayNum)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${active ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-transparent text-muted-foreground hover:border-primary/40'}`}>
                  {DAY_NAMES[dayNum]} {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="text-left px-4 py-3 min-w-[160px]">Empleado</th>
                <th className="text-left px-3 py-3 whitespace-nowrap hidden sm:table-cell">Área</th>
                <th className="text-left px-3 py-3 whitespace-nowrap hidden md:table-cell">Puesto</th>
                {weekDays.map(day => (
                  <th key={day.toISOString()} className="text-center px-1 py-3 min-w-[52px]">
                    <div>{DAY_NAMES[day.getDay()]}</div>
                    <div className="text-slate-300 font-normal">{format(day, 'd/MM')}</div>
                  </th>
                ))}
                <th className="text-center px-2 py-3 text-emerald-300">A</th>
                <th className="text-center px-2 py-3 text-amber-300">R</th>
                <th className="text-center px-2 py-3 text-red-300">F</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEmployees.map(emp => {
                const s = empStats(emp);
                return (
                  <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md overflow-hidden bg-muted flex-shrink-0">
                          {emp.photo_url ? <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="w-3 h-3 text-muted-foreground" /></div>}
                        </div>
                        <span className="font-medium">{emp.full_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{emp.department}</td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{emp.position}</td>
                    {weekDays.map(day => {
                      const rec = getRecord(emp.id, format(day, 'yyyy-MM-dd'));
                      return (
                        <td key={day.toISOString()} className="px-1 py-2.5 text-center">
                          {rec ? (
                            <span className={`w-7 h-6 rounded text-[10px] font-bold flex items-center justify-center mx-auto ${STATUS_COLORS[rec.status] || 'bg-muted'}`}>
                              {STATUS_SHORT[rec.status]}
                            </span>
                          ) : (
                            <span className="w-7 h-6 rounded bg-muted/30 flex items-center justify-center mx-auto text-muted-foreground/30">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5 text-center font-bold text-emerald-600">{s.asistencia}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-amber-600">{s.retardos}</td>
                    <td className="px-2 py-2.5 text-center font-bold text-red-600">{s.faltas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredEmployees.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Sin empleados activos</p>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t bg-muted/20 flex flex-wrap gap-4">
          {[['A', 'Asistencia', 'bg-emerald-500'], ['R', 'Retardo', 'bg-amber-500'], ['F', 'Falta', 'bg-red-500'], ['J', 'Justificada', 'bg-blue-500']].map(([code, label, color]) => (
            <div key={code} className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center text-white ${color}`}>{code}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}