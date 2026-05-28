import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SignatureCanvas from '@/components/shared/SignatureCanvas';
import {
  ArrowLeft, Play, Square, Clock, Camera, Plus, Trash2, FileText,
  CheckCircle2, User, ChevronRight, AlertCircle, History, Loader2, Wrench, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInMinutes } from 'date-fns';

const WO_STATUSES = ['Generada', 'Planificada', 'Aprobada', 'Programada', 'En proceso', 'Completa', 'Revisión', 'Cerrada'];

const STATUS_STYLES = {
  'Generada': 'bg-slate-100 text-slate-700 border-slate-200',
  'Planificada': 'bg-blue-100 text-blue-700 border-blue-200',
  'Aprobada': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Programada': 'bg-purple-100 text-purple-700 border-purple-200',
  'En proceso': 'bg-amber-100 text-amber-700 border-amber-200',
  'Completa': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Revisión': 'bg-orange-100 text-orange-700 border-orange-200',
  'Cerrada': 'bg-gray-100 text-gray-600 border-gray-200',
};

const PRIORITY_STYLES = {
  'Crítica': 'bg-red-100 text-red-700',
  'Alta': 'bg-orange-100 text-orange-700',
  'Media': 'bg-amber-100 text-amber-700',
  'Baja': 'bg-green-100 text-green-700',
};

function WOStatusBadge({ status }) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
}

export default function WorkOrderDetail() {
  const woId = window.location.pathname.split('/work-orders/')[1];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: wo } = useQuery({ queryKey: ['wo', woId], queryFn: () => base44.entities.WorkOrder.list().then(list => list.find(w => w.id === woId)) });
  const { data: activities = [] } = useQuery({ queryKey: ['woActivities', woId], queryFn: () => base44.entities.WOActivity.list().then(list => list.filter(a => a.wo_id === woId)) });
  const { data: resources = [] } = useQuery({ queryKey: ['woResources', woId], queryFn: () => base44.entities.WOResource.list().then(list => list.filter(r => r.wo_id === woId)) });
  const { data: statusHistory = [] } = useQuery({ queryKey: ['woHistory', woId], queryFn: () => base44.entities.WorkOrderStatusHistory.list().then(list => list.filter(h => h.wo_id === woId)) });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });
  const { user: currentUser } = useAuth();

  const [elapsed, setElapsed] = useState(0);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [showSignatures, setShowSignatures] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [newActivityDesc, setNewActivityDesc] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [signatures, setSignatures] = useState({});
  const [resourceForm, setResourceForm] = useState({ resource_type: 'Mano de Obra', description: '', actual_quantity: 1, actual_cost: 0 });
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [observations, setObservations] = useState('');
  const obsTimer = useRef(null);

  useEffect(() => {
    if (wo) setObservations(wo.observations || '');
  }, [wo?.id]);

  useEffect(() => {
    if (!wo?.timer_start || wo.status !== 'En proceso') return;
    const interval = setInterval(() => setElapsed(differenceInMinutes(new Date(), parseISO(wo.timer_start))), 1000);
    return () => clearInterval(interval);
  }, [wo?.timer_start, wo?.status]);

  const updateWO = useMutation({
    mutationFn: (data) => base44.entities.WorkOrder.update(woId, data),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const isCompleted = wo?.status === 'Completa' || wo?.status === 'Revisión' || wo?.status === 'Cerrada';
  const canEdit = !isCompleted || currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

  const handleObservationsChange = (val) => {
    setObservations(val);
    clearTimeout(obsTimer.current);
    obsTimer.current = setTimeout(() => {
      updateWO.mutate({ observations: val });
    }, 800);
  };

  const addStatusHistory = async (fromStatus, toStatus, notes = '') => {
    const changedBy = currentUser?.full_name || currentUser?.username || 'Usuario';
    await base44.entities.WorkOrderStatusHistory.create({
      wo_id: woId, from_status: fromStatus, to_status: toStatus,
      changed_by: changedBy,
      changed_at: new Date().toISOString(), notes
    });
    queryClient.invalidateQueries({ queryKey: ['woHistory', woId] });
  };

  const getCurrentStatusIndex = () => WO_STATUSES.indexOf(wo?.status);
  const getNextStatus = () => WO_STATUSES[getCurrentStatusIndex() + 1] || null;

  const advanceStatus = async () => {
    const next = getNextStatus();
    if (!next) return;
    if (next === 'Programada' && (!wo.scheduled_start_date || !wo.scheduled_end_date)) {
      toast.error('Se requieren Fecha Inicio y Fecha Fin programadas para pasar a "Programada"');
      setShowStatusModal(false);
      return;
    }
    if (next === 'Completa' && !wo.technician_signature) {
      toast.error('Se requiere firma del técnico para completar la orden');
      setShowSignatures(true);
      setShowStatusModal(false);
      return;
    }
    const from = wo.status;
    let extraData = {};
    if (next === 'En proceso') extraData = { timer_start: new Date().toISOString(), actual_start_date: new Date().toISOString() };
    if (next === 'Completa') {
      const durationHrs = wo.timer_start ? differenceInMinutes(new Date(), parseISO(wo.timer_start)) / 60 : 0;
      extraData = { actual_end_date: new Date().toISOString(), actual_duration_hours: parseFloat(durationHrs.toFixed(2)) };
    }
    updateWO.mutate({ status: next, ...extraData });
    await addStatusHistory(from, next, statusNote);
    setShowStatusModal(false);
    setStatusNote('');
    toast.success(`Estado actualizado: ${next}`);
  };

  const toggleActivity = useMutation({
    mutationFn: (act) => base44.entities.WOActivity.update(act.id, { completed: !act.completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['woActivities', woId] })
  });

  const addActivity = useMutation({
    mutationFn: (desc) => base44.entities.WOActivity.create({ wo_id: woId, description: desc, completed: false, sequence: activities.length + 1 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['woActivities', woId] }); setShowAddActivity(false); setNewActivityDesc(''); toast.success('Actividad agregada'); }
  });

  const addResource = useMutation({
    mutationFn: (data) => base44.entities.WOResource.create({ ...data, wo_id: woId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['woResources', woId] }); setShowResourceForm(false); toast.success('Recurso agregado'); }
  });

  const deleteResource = useMutation({
    mutationFn: (id) => base44.entities.WOResource.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['woResources', woId] })
  });

  const saveSignatures = () => {
    updateWO.mutate(signatures);
    setShowSignatures(false);
    toast.success('Firmas guardadas');
  };

  const uploadEvidence = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const toastId = toast.loading('Subiendo imagen de evidencia...');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Guardar la URL (Google Drive o local) que es súper corta, evitando superar el límite de caracteres de celdas de Sheets
      updateWO.mutate({ evidence_urls: [...(wo.evidence_urls || []), file_url] });
      toast.success('Evidencia guardada', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Error al subir evidencia', { id: toastId });
    }
  };

  const assignedEmployee = employees.find(e => e.id === wo?.assigned_employee_id);
  const asset = assets.find(a => a.id === wo?.asset_id);
  const location = locations.find(l => l.id === wo?.location_id);
  const next = getNextStatus();
  const formatTime = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

  const generatePDF = async () => {
    setGeneratingPDF(true);
    try {
      // Generar HTML básico para imprimir
      const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>OT ${wo.wo_number}</title>
          <style>
            @page { size: letter; margin: 10mm; }
            body { font-family: Arial, sans-serif; font-size: 9px; line-height: 1.4; }
            .header { background: #1e3a5f; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; margin-bottom: 12px; }
            .header h1 { margin: 0; font-size: 14px; }
            .section { margin-bottom: 10px; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; }
            .section-title { background: #f3f4f6; padding: 4px 8px; font-weight: bold; font-size: 9px; color: #374151; border-bottom: 1px solid #e5e7eb; }
            .section-body { padding: 8px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
            .field { }
            .label { color: #6b7280; font-size: 8px; }
            .value { font-weight: 600; font-size: 9px; }
            .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 8px; font-weight: bold; background: #dbeafe; color: #1d4ed8; }
            .signature-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 4px; text-align: center; min-height: 60px; }
            .activity { padding: 3px 6px; margin: 2px 0; background: #f9fafb; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ORDEN DE TRABAJO — ${wo.wo_number}</h1>
            <span>${new Date().toLocaleDateString('es-MX')}</span>
          </div>
          <div class="section">
            <div class="section-title">INFORMACIÓN GENERAL</div>
            <div class="section-body grid">
              <div class="field"><div class="label">Tipo</div><div class="value">${wo.wo_type}</div></div>
              <div class="field"><div class="label">Estado</div><div class="value badge">${wo.status}</div></div>
              <div class="field"><div class="label">Prioridad</div><div class="value">${wo.priority}</div></div>
              <div class="field"><div class="label">Duración Real</div><div class="value">${wo.actual_duration_hours || 0}h</div></div>
              <div class="field"><div class="label">Activo</div><div class="value">${asset?.name || '—'}</div></div>
              <div class="field"><div class="label">Ubicación</div><div class="value">${location?.name || '—'}</div></div>
              <div class="field"><div class="label">Técnico</div><div class="value">${assignedEmployee?.full_name || wo.responsible_technician || '—'}</div></div>
              <div class="field"><div class="label">Costo Total</div><div class="value">$${wo.total_cost || 0}</div></div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">DESCRIPCIÓN</div>
            <div class="section-body">${wo.description}</div>
          </div>
          ${activities.length > 0 ? `
          <div class="section">
            <div class="section-title">ACTIVIDADES</div>
            <div class="section-body">
              ${activities.sort((a,b)=>(a.sequence||0)-(b.sequence||0)).map(a => `<div class="activity">[${a.completed ? 'X' : ' '}] ${a.description}</div>`).join('')}
            </div>
          </div>` : ''}
          ${resources.length > 0 ? `
          <div class="section">
            <div class="section-title">RECURSOS</div>
            <div class="section-body">
              ${resources.map(r => `<div class="activity">${r.resource_type}: ${r.description} | Cant: ${r.actual_quantity} | $${r.actual_cost}</div>`).join('')}
              <div style="text-align:right; font-weight:bold; margin-top:4px;">Total: $${resources.reduce((s,r)=>s+(parseFloat(r.actual_cost)||0),0).toFixed(2)}</div>
            </div>
          </div>` : ''}
          <div class="section">
            <div class="section-title">OBSERVACIONES</div>
            <div class="section-body">${wo.observations || 'Ninguna'}</div>
          </div>
          <div class="section">
            <div class="section-title">FIRMAS</div>
            <div class="section-body" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
              <div class="signature-box">
                ${wo.technician_signature?.startsWith('data:') ? `<img src="${wo.technician_signature}" style="max-height:50px;"/>` : `<div style="min-height:40px;"></div>`}
                <div style="border-top:1px solid #d1d5db; margin-top:4px; padding-top:2px;">Técnico</div>
              </div>
              <div class="signature-box">
                ${wo.supervisor_signature?.startsWith('data:') ? `<img src="${wo.supervisor_signature}" style="max-height:50px;"/>` : `<div style="min-height:40px;"></div>`}
                <div style="border-top:1px solid #d1d5db; margin-top:4px; padding-top:2px;">Supervisor</div>
              </div>
              <div class="signature-box">
                ${wo.client_signature?.startsWith('data:') ? `<img src="${wo.client_signature}" style="max-height:50px;"/>` : `<div style="min-height:40px;"></div>`}
                <div style="border-top:1px solid #d1d5db; margin-top:4px; padding-top:2px;">Cliente</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      const printWindow = window.open('', '_blank');
      if (!printWindow) { toast.error('Permite ventanas emergentes para imprimir'); return; }
      printWindow.document.write(printHTML);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (!wo) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const currentStatusIdx = getCurrentStatusIndex();
  const canAddActivities = wo.status === 'En proceso' && activities.length === 0;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/work-orders')} className="flex-shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{wo.wo_number}</h1>
            <WOStatusBadge status={wo.status} />
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_STYLES[wo.priority] || 'bg-muted'}`}>{wo.priority}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{wo.description}</p>
        </div>
        <div className="flex gap-2 flex-wrap flex-shrink-0">
          {next && canEdit && (
            <Button onClick={() => { setNextStatus(next); setShowStatusModal(true); }} className="gap-2 bg-primary">
              {next === 'En proceso' ? <Play className="w-4 h-4" /> : next === 'Cerrada' ? <Square className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              → {next}
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={generatePDF} disabled={generatingPDF}>
            {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generatingPDF ? 'Generando...' : 'Imprimir PDF'}
          </Button>
        </div>
      </div>

      {isCompleted && !canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">Orden completada — Solo supervisores y administradores pueden realizar cambios.</p>
        </div>
      )}

      {/* Status Pipeline */}
      <div className="bg-card rounded-xl border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Flujo de Estado</p>
        <div className="flex items-center gap-1 flex-wrap">
          {WO_STATUSES.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                i === currentStatusIdx ? 'bg-primary text-primary-foreground shadow-md scale-105' :
                i < currentStatusIdx ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                {i < currentStatusIdx && <span className="mr-1">✓</span>}{s}
              </div>
              {i < WO_STATUSES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Timer */}
      {wo.status === 'En proceso' && wo.timer_start && (
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-500 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Tiempo en Ejecución</p>
              <p className="text-3xl font-bold text-amber-900 font-mono">{formatTime(elapsed)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm p-4"><p className="text-xs text-muted-foreground">Tipo</p><p className="font-semibold mt-0.5">{wo.wo_type}</p></Card>
        <Card className="border-0 shadow-sm p-4"><p className="text-xs text-muted-foreground">Activo</p><p className="font-semibold mt-0.5">{asset?.name || '—'}</p></Card>
        <Card className="border-0 shadow-sm p-4"><p className="text-xs text-muted-foreground">Ubicación</p><p className="font-semibold mt-0.5">{location?.name || '—'}</p></Card>
        <Card className="border-0 shadow-sm p-4"><p className="text-xs text-muted-foreground">Duración Real</p><p className="font-semibold mt-0.5">{wo.actual_duration_hours ? `${wo.actual_duration_hours}h` : '—'}</p></Card>
      </div>

      {/* Scheduled dates + shutdown hours */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Programación de Fechas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Fecha Inicio Programada *</Label>
              <Input type="date" className="mt-1" value={wo.scheduled_start_date || ''} disabled={!canEdit}
                onChange={e => updateWO.mutate({ scheduled_start_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Fecha Fin Programada *</Label>
              <Input type="date" className="mt-1" value={wo.scheduled_end_date || ''} disabled={!canEdit}
                onChange={e => updateWO.mutate({ scheduled_end_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Horas de Paro del Equipo
                <span className="text-[10px] text-amber-600 font-normal">(para disponibilidad)</span>
              </Label>
              <Input type="number" min="0" step="0.5" className="mt-1" value={wo.equipment_shutdown_hours ?? ''} disabled={!canEdit}
                placeholder="0" onChange={e => updateWO.mutate({ equipment_shutdown_hours: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          {(!wo.scheduled_start_date || !wo.scheduled_end_date) && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Se requieren ambas fechas para avanzar a estado "Programada"
            </p>
          )}
        </CardContent>
      </Card>

      {/* Assigned Technician */}
      {assignedEmployee && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" />Técnico Asignado</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border">
                {assignedEmployee.photo_url ? <img src={assignedEmployee.photo_url} alt={assignedEmployee.full_name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="w-6 h-6 text-muted-foreground" /></div>}
              </div>
              <div>
                <p className="font-bold text-base">{assignedEmployee.full_name}</p>
                <p className="text-sm text-muted-foreground">{assignedEmployee.position} · {assignedEmployee.department}</p>
                <p className="text-xs text-primary font-mono mt-0.5">{assignedEmployee.employee_id}</p>
              </div>
              <div className="ml-auto">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  assignedEmployee.availability === 'Disponible' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  assignedEmployee.availability === 'Ocupado' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-muted text-muted-foreground border-border'
                }`}>{assignedEmployee.availability}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activities */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Actividades ({activities.filter(a => a.completed).length}/{activities.length})
              </CardTitle>
              {canAddActivities && (
                <Button size="sm" variant="outline" onClick={() => setShowAddActivity(true)} className="gap-1">
                  <Plus className="w-3 h-3" />Agregar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {activities.sort((a,b) => (a.sequence || 0) - (b.sequence || 0)).map(act => (
              <div key={act.id} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${act.completed ? 'bg-emerald-50 border border-emerald-100' : 'bg-muted/30'}`}>
                <Checkbox checked={act.completed} onCheckedChange={() => canEdit && toggleActivity.mutate(act)} disabled={!canEdit} />
                <span className={`text-sm flex-1 ${act.completed ? 'line-through text-muted-foreground' : 'font-medium'}`}>{act.description}</span>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Sin actividades</p>
                {canAddActivities && <p className="text-xs text-primary mt-1 cursor-pointer hover:underline" onClick={() => setShowAddActivity(true)}>+ Agregar actividad</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resources */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recursos Consumidos</CardTitle>
            {canEdit && <Button size="sm" variant="outline" onClick={() => setShowResourceForm(true)}><Plus className="w-3 h-3 mr-1" />Agregar</Button>}
          </CardHeader>
          <CardContent className="space-y-2">
            {resources.map(r => {
              const emp = r.resource_type === 'Mano de Obra' ? employees.find(e => e.full_name === r.description) : null;
              const icon = r.resource_type === 'Mano de Obra' ? <User className="w-3.5 h-3.5" /> : r.resource_type === 'Servicio' ? <Settings className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    {emp?.photo_url
                      ? <img src={emp.photo_url} alt={emp.full_name} className="w-7 h-7 rounded-md object-cover flex-shrink-0" />
                      : <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">{icon}</div>}
                    <div>
                      <p className="text-sm font-medium">{r.description}</p>
                      <p className="text-xs text-muted-foreground">{r.resource_type} · Cant: {r.actual_quantity} · ${r.actual_cost}</p>
                    </div>
                  </div>
                  {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteResource.mutate(r.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
                </div>
              );
            })}
            {resources.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin recursos</p>}
            {resources.length > 0 && (
              <div className="pt-2 border-t text-right">
                <span className="text-sm font-bold">Total: ${resources.reduce((s, r) => s + (r.actual_cost || 0), 0).toFixed(2)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Observations & Evidence */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Observaciones</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={observations} onChange={e => handleObservationsChange(e.target.value)} placeholder="Agregar observaciones..." className="min-h-[100px]" disabled={!canEdit} />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Evidencias</CardTitle>
            {canEdit && (
              <Label htmlFor="evidence-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted transition-colors">
                  <Camera className="w-3 h-3" />Subir Foto
                </div>
                <input id="evidence-upload" type="file" accept="image/*" className="hidden" onChange={uploadEvidence} />
              </Label>
            )}
          </CardHeader>
          <CardContent>
            {(wo.evidence_urls || []).length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {wo.evidence_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Evidencia ${i + 1}`} className="rounded-lg w-full h-24 object-cover border hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Sin evidencias</p>}
          </CardContent>
        </Card>
      </div>

      {/* Signatures */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Firmas</CardTitle>
          <div className="flex items-center gap-2">
            {!wo.technician_signature && (
              <div className="flex items-center gap-1.5 text-amber-600">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Firma técnico requerida para completar</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => { setSignatures({ technician_signature: wo.technician_signature || '', supervisor_signature: wo.supervisor_signature || '', client_signature: wo.client_signature || '' }); setShowSignatures(true); }}>
              {wo.technician_signature ? 'Ver Firmas' : 'Firmar Ahora'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Técnico *', key: 'technician_signature', required: true },
              { label: 'Supervisor', key: 'supervisor_signature' },
              { label: 'Cliente', key: 'client_signature' },
            ].map(sig => {
              const val = wo[sig.key];
              return (
                <div key={sig.label} className={`text-center p-3 border rounded-xl ${sig.required && !val ? 'border-amber-300 bg-amber-50' : 'border-border'}`}>
                  <p className="text-xs text-muted-foreground mb-2">{sig.label}</p>
                  {val && val.startsWith('data:') ? (
                    <img src={val} alt="Firma" className="w-full h-16 object-contain" />
                  ) : val ? (
                    <p className="text-sm font-semibold">{val}</p>
                  ) : (
                    <div className="border-b border-dashed border-muted-foreground/40 h-12 mt-2 flex items-end justify-center">
                      <span className="text-[10px] text-muted-foreground mb-1">Sin firma</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Status History */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" />Historial de Estados</CardTitle>
        </CardHeader>
        <CardContent>
          {statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin historial</p>
          ) : (
            <div className="space-y-2">
              {[...statusHistory].sort((a,b) => new Date(b.changed_at) - new Date(a.changed_at)).map(h => (
                <div key={h.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-muted-foreground">{h.from_status || '—'}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-semibold">{h.to_status}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{h.changed_by}</span>
                  <span className="text-xs text-muted-foreground font-mono">{h.changed_at ? format(parseISO(h.changed_at), 'dd/MM HH:mm') : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Advance Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Avanzar Estado</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-3">
              <WOStatusBadge status={wo.status} />
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[nextStatus] || 'bg-muted'}`}>{nextStatus}</span>
            </div>
            {nextStatus === 'Completa' && !wo.technician_signature && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>Debes registrar la firma del técnico antes de completar la orden.</p>
              </div>
            )}
            <div>
              <Label>Notas del cambio (opcional)</Label>
              <Textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="Notas..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowStatusModal(false)}>Cancelar</Button>
              <Button onClick={advanceStatus} disabled={nextStatus === 'Completa' && !wo.technician_signature}>Confirmar → {nextStatus}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Activity Dialog */}
      <Dialog open={showAddActivity} onOpenChange={setShowAddActivity}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agregar Actividad</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descripción *</Label>
              <Textarea value={newActivityDesc} onChange={e => setNewActivityDesc(e.target.value)} placeholder="Descripción de la actividad..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddActivity(false)}>Cancelar</Button>
              <Button onClick={() => newActivityDesc.trim() && addActivity.mutate(newActivityDesc.trim())} disabled={!newActivityDesc.trim() || addActivity.isPending}>Agregar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resource Form */}
      <Dialog open={showResourceForm} onOpenChange={setShowResourceForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agregar Recurso</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); addResource.mutate(resourceForm); }} className="space-y-4">
            <div>
              <Label>Tipo de Recurso</Label>
              <Select value={resourceForm.resource_type} onValueChange={v => setResourceForm({...resourceForm, resource_type: v, description: ''})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mano de Obra">👷 Mano de Obra</SelectItem>
                  <SelectItem value="Servicio">🔧 Servicio</SelectItem>
                  <SelectItem value="Refacción">📦 Refacción</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {resourceForm.resource_type === 'Mano de Obra' ? (
              <div>
                <Label>Técnico</Label>
                <Select value={resourceForm.description} onValueChange={v => setResourceForm({...resourceForm, description: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar técnico" /></SelectTrigger>
                  <SelectContent>{employees.filter(e => e.status === 'Activo').map(e => <SelectItem key={e.id} value={e.full_name}>{e.full_name} — {e.position}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : resourceForm.resource_type === 'Servicio' ? (
              <div><Label>Servicio / Proveedor *</Label><Input value={resourceForm.description} onChange={e => setResourceForm({...resourceForm, description: e.target.value})} placeholder="Ej: Empresa XYZ — Servicio de grúa" required /></div>
            ) : (
              <div><Label>Refacción / Material *</Label><Input value={resourceForm.description} onChange={e => setResourceForm({...resourceForm, description: e.target.value})} placeholder="Ej: Rodamiento 6205, Filtro de aceite..." required /></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad</Label><Input type="number" min="0" step="0.01" value={resourceForm.actual_quantity} onChange={e => setResourceForm({...resourceForm, actual_quantity: parseFloat(e.target.value)})} /></div>
              <div><Label>Costo ($)</Label><Input type="number" min="0" step="0.01" value={resourceForm.actual_cost} onChange={e => setResourceForm({...resourceForm, actual_cost: parseFloat(e.target.value)})} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowResourceForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={addResource.isPending}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Signatures Dialog */}
      <Dialog open={showSignatures} onOpenChange={setShowSignatures}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Firmas de la Orden de Trabajo</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-semibold mb-2 block text-amber-700">✍️ Firma Técnico * (requerida para completar)</Label>
              <SignatureCanvas value={signatures.technician_signature || ''} onChange={val => setSignatures(s => ({...s, technician_signature: val}))} placeholder="Técnico — Firme aquí" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Firma Supervisor</Label>
              <SignatureCanvas value={signatures.supervisor_signature || ''} onChange={val => setSignatures(s => ({...s, supervisor_signature: val}))} placeholder="Supervisor — Firme aquí (opcional)" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Firma Cliente</Label>
              <SignatureCanvas value={signatures.client_signature || ''} onChange={val => setSignatures(s => ({...s, client_signature: val}))} placeholder="Cliente — Firme aquí (opcional)" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowSignatures(false)}>Cancelar</Button>
              <Button onClick={saveSignatures} disabled={!signatures.technician_signature}>Guardar Firmas</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}