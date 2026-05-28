import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from 'date-fns';
import { Printer, ChevronLeft, ChevronRight, Users, TrendingUp, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_LABELS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function AttendanceProjection() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [deptFilter, setDeptFilter] = useState('all');

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });
  const { data: shifts = [] } = useQuery({ queryKey: ['shifts'], queryFn: () => base44.entities.Shift.list() });

  const baseDate = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
  const activeEmployees = employees.filter(e => e.status === 'Activo' && (deptFilter === 'all' || e.department === deptFilter));

  const getShift = (id) => shifts.find(s => s.id === id);

  // For each day, calculate how many employees are projected to work
  const projectionByDay = weekDays.map(day => {
    const dayNum = day.getDay();
    const working = activeEmployees.filter(emp => {
      const shift = getShift(emp.shift_id);
      if (!shift) return false;
      return (shift.work_days || []).includes(dayNum);
    });
    const resting = activeEmployees.filter(emp => {
      const shift = getShift(emp.shift_id);
      if (!shift) return false;
      return (shift.rest_days || []).includes(dayNum);
    });
    const noShift = activeEmployees.filter(emp => !emp.shift_id);
    return {
      day: DAY_NAMES[dayNum],
      date: format(day, 'd/MM'),
      working: working.length,
      resting: resting.length,
      noShift: noShift.length,
      total: activeEmployees.length,
      workingList: working,
    };
  });

  const totalWorking = Math.max(...projectionByDay.map(d => d.working), 0);

  const printProjection = () => {
    const rows = projectionByDay.map(d => `
      <tr>
        <td>${d.day} ${d.date}</td>
        <td style="text-align:center;color:#10b981;font-weight:bold">${d.working}</td>
        <td style="text-align:center;color:#ef4444">${d.resting}</td>
        <td style="text-align:center;color:#9ca3af">${d.noShift}</td>
        <td style="text-align:center">${d.total}</td>
        <td style="text-align:center">${d.total > 0 ? Math.round(d.working / d.total * 100) : 0}%</td>
      </tr>`).join('');

    const empRows = activeEmployees.map(emp => {
      const shift = getShift(emp.shift_id);
      const dayCells = projectionByDay.map(d => {
        const dayNum = weekDays.find(wd => format(wd, 'd/MM') === d.date)?.getDay();
        const works = shift && dayNum !== undefined && (shift.work_days || []).includes(dayNum);
        return `<td style="text-align:center;font-size:9px;padding:3px;background:${works ? '#dcfce7' : '#fee2e2'}">${works ? '✓' : '✗'}</td>`;
      }).join('');
      return `<tr>
        <td style="padding:4px 8px;font-size:9px">${emp.full_name}</td>
        <td style="padding:4px 8px;font-size:9px">${emp.department}</td>
        <td style="padding:4px 8px;font-size:9px">${shift?.name || 'Sin turno'}</td>
        ${dayCells}
      </tr>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Proyección de Asistencia</title>
    <style>body{font-family:Arial,sans-serif;font-size:10px;margin:10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px}@media print{body{margin:0}}</style></head><body>
    <h2 style="font-size:14px">PROYECCIÓN DE ASISTENCIA — ${format(weekStart,'dd/MM/yyyy')} al ${format(weekEnd,'dd/MM/yyyy')}</h2>
    <h3 style="font-size:12px;margin-top:12px">Resumen por día</h3>
    <table><thead><tr style="background:#1e3a5f;color:white"><th>Día</th><th>Laborando</th><th>Descanso</th><th>Sin Turno</th><th>Total</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>
    <h3 style="font-size:12px;margin-top:16px">Detalle por empleado</h3>
    <table><thead><tr style="background:#1e3a5f;color:white">
      <th>Empleado</th><th>Área</th><th>Turno</th>
      ${projectionByDay.map(d => `<th style="text-align:center;min-width:40px">${d.day}<br/>${d.date}</th>`).join('')}
    </tr></thead><tbody>${empRows}</tbody></table>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Proyección de Asistencia</h2>
          <p className="text-sm text-muted-foreground">Basada en turnos asignados — {activeEmployees.length} empleados activos</p>
        </div>
        <Button onClick={printProjection} variant="outline" className="gap-2 self-start">
          <Printer className="w-4 h-4" />Imprimir Proyección
        </Button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap bg-card border rounded-xl p-4">
        <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="text-sm font-semibold min-w-[180px] text-center">{format(weekStart, 'd MMM')} — {format(weekEnd, 'd MMM yyyy')}</span>
        <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">Hoy</Button>
        <div className="ml-auto">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los departamentos</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {shifts.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
          ⚠️ No hay turnos configurados. Ve a <strong>Personal → Configuración de Turnos</strong> para crear turnos y asignarlos a los empleados en Mano de Obra.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {projectionByDay.filter(d => [1,2,3,4,5].includes(weekDays.find(wd => format(wd, 'd/MM') === d.date)?.getDay())).slice(0,4).map(d => (
          <div key={d.day} className="bg-card border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{d.day} {d.date}</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{d.working}</p>
            <p className="text-xs text-muted-foreground mt-1">de {d.total} empleados</p>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: d.total > 0 ? `${d.working / d.total * 100}%` : '0%' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">Proyección Semanal</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={projectionByDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value, name) => [value, name === 'working' ? 'Laborando' : name === 'resting' ? 'Descanso' : 'Sin Turno']} />
            <Legend formatter={v => v === 'working' ? 'Laborando' : v === 'resting' ? 'Descanso' : 'Sin Turno'} />
            <Bar dataKey="working" fill="#10b981" radius={[4,4,0,0]} name="working" />
            <Bar dataKey="resting" fill="#f87171" radius={[4,4,0,0]} name="resting" />
            <Bar dataKey="noShift" fill="#d1d5db" radius={[4,4,0,0]} name="noShift" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Detalle por Empleado</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="text-left px-4 py-3 min-w-[160px]">Empleado</th>
                <th className="text-left px-3 py-3 whitespace-nowrap hidden sm:table-cell">Área</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Turno</th>
                {weekDays.map(day => (
                  <th key={day.toISOString()} className="text-center px-1 py-3 min-w-[52px]">
                    <div>{DAY_NAMES[day.getDay()]}</div>
                    <div className="text-slate-300 font-normal">{format(day, 'd/MM')}</div>
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-emerald-300 whitespace-nowrap">Días Lab.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeEmployees.map(emp => {
                const shift = getShift(emp.shift_id);
                const workingDaysCount = weekDays.filter(d => shift && (shift.work_days || []).includes(d.getDay())).length;
                return (
                  <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{emp.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{emp.position}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{emp.department}</td>
                    <td className="px-3 py-2.5">
                      {shift ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: shift.color || '#3b82f6' }} />
                          <span className="font-medium">{shift.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Sin turno</span>
                      )}
                    </td>
                    {weekDays.map(day => {
                      const dayNum = day.getDay();
                      const works = shift && (shift.work_days || []).includes(dayNum);
                      const rests = shift && (shift.rest_days || []).includes(dayNum);
                      return (
                        <td key={day.toISOString()} className="px-1 py-2.5 text-center">
                          <span className={`w-7 h-6 rounded text-[10px] font-bold flex items-center justify-center mx-auto ${
                            works ? 'bg-emerald-100 text-emerald-700' : rests ? 'bg-red-100 text-red-600' : 'bg-muted text-muted-foreground'
                          }`}>
                            {works ? '✓' : rests ? 'D' : '—'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-600">{workingDaysCount}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Summary row */}
            <tfoot>
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={3} className="px-4 py-2.5 text-xs">Total proyectado</td>
                {projectionByDay.map(d => (
                  <td key={d.day} className="px-1 py-2.5 text-center text-xs text-emerald-300">{d.working}</td>
                ))}
                <td className="px-3 py-2.5 text-center text-xs text-emerald-300">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}