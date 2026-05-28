import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, CheckCircle2, AlertTriangle, Clock, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const GRACE_MINUTES = 10; // minutes after shift start before marking tardy
const EARLY_EXIT_MINUTES = 15; // minutes before shift end

function parseTime(timeStr) {
  // "HH:mm" => { h, m }
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return { h, m };
}

function minutesFromMidnight(h, m) {
  return h * 60 + m;
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export default function QRAttendanceScanner() {
  const [now, setNow] = useState(new Date());
  const [scanning, setScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [lastResult, setLastResult] = useState(null); // { employee, status, type, time }
  const [showJustification, setShowJustification] = useState(false);
  const [justificationData, setJustificationData] = useState(null);
  const [justificationNote, setJustificationNote] = useState('');
  const [justificationStatus, setJustificationStatus] = useState('Justificada');
  const scannerRef = useRef(null);
  const qrCodeRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list() });
  const { data: shifts = [] } = useQuery({ queryKey: ['shifts'], queryFn: () => base44.entities.Shift.list() });
  const { data: todayRecords = [] } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => base44.entities.AttendanceRecord.filter({ date: format(new Date(), 'yyyy-MM-dd') }),
    refetchInterval: 5000,
  });

  // Clock ticker
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const createRecord = useMutation({
    mutationFn: (data) => base44.entities.AttendanceRecord.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const updateRecord = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AttendanceRecord.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const startScanner = useCallback(async () => {
    setScanning(true);
    setScannerReady(false);
    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      qrCodeRef.current = html5QrCode;
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) { toast.error('No se encontró cámara'); setScanning(false); return; }
      // prefer back camera
      const cam = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('trasera')) || cameras[cameras.length - 1];
      await html5QrCode.start(
        cam.id,
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => handleScan(decodedText),
        () => {}
      );
      setScannerReady(true);
    } catch (err) {
      toast.error('Error al iniciar la cámara: ' + err.message);
      setScanning(false);
    }
  }, [employees, shifts, todayRecords]);

  const stopScanner = useCallback(async () => {
    if (qrCodeRef.current) {
      try { await qrCodeRef.current.stop(); } catch {}
      qrCodeRef.current = null;
    }
    setScanning(false);
    setScannerReady(false);
  }, []);

  useEffect(() => {
    return () => { if (qrCodeRef.current) { try { qrCodeRef.current.stop(); } catch {} } };
  }, []);

  const handleScan = useCallback((text) => {
    // QR contains employee_id
    const emp = employees.find(e => e.employee_id === text || e.id === text);
    if (!emp) {
      toast.error('QR no reconocido: ' + text);
      return;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowStr = format(new Date(), 'HH:mm');
    const curMin = currentMinutes();

    const existing = todayRecords.find(r => r.employee_id === emp.id);
    const shift = shifts.find(s => s.id === emp.shift_id);

    if (existing) {
      if (existing.check_out) {
        // already fully checked out
        setLastResult({ employee: emp, status: 'duplicate', existing });
        return;
      }
      if (existing.check_in) {
        // This is a check-out
        let exitNote = '';
        let needsJustification = false;

        if (shift?.end_time) {
          const end = parseTime(shift.end_time);
          const endMin = minutesFromMidnight(end.h, end.m);
          if (curMin < endMin - EARLY_EXIT_MINUTES) {
            // leaving early
            needsJustification = true;
            setJustificationData({ emp, existing, type: 'early_exit', nowStr, todayStr });
            setJustificationNote('');
            setJustificationStatus('Justificada');
            setShowJustification(true);
            return;
          }
        }

        updateRecord.mutate({ id: existing.id, data: { check_out: nowStr } });
        setLastResult({ employee: emp, status: 'checkout', time: nowStr });
        return;
      }
    }

    // Check-in logic
    let status = 'Asistencia';
    if (shift?.start_time) {
      const start = parseTime(shift.start_time);
      const startMin = minutesFromMidnight(start.h, start.m);
      if (curMin > startMin + GRACE_MINUTES) status = 'Retardo';
    }

    createRecord.mutate({
      employee_id: emp.id,
      date: todayStr,
      check_in: nowStr,
      status,
    });
    setLastResult({ employee: emp, status: 'checkin', attendanceStatus: status, time: nowStr });
  }, [employees, shifts, todayRecords, createRecord, updateRecord]);

  // Reload employees/shifts/records into handler when they change
  useEffect(() => {
    // The handleScan closure uses latest values via the deps above
  }, [handleScan]);

  const confirmJustification = () => {
    const { emp, existing, type, nowStr, todayStr } = justificationData;
    if (type === 'early_exit') {
      updateRecord.mutate({ id: existing.id, data: { check_out: nowStr, notes: justificationNote, status: justificationStatus } });
      setLastResult({ employee: emp, status: 'checkout', time: nowStr, note: justificationNote });
    }
    setShowJustification(false);
    setJustificationData(null);
  };

  const recentRecords = [...todayRecords].sort((a, b) => (b.check_in || '').localeCompare(a.check_in || '')).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header with clock */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-900 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Checador de Asistencia QR</h2>
            <p className="text-blue-200 text-sm mt-0.5">Escanea tu credencial para registrar entrada o salida</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-mono font-bold tracking-tight text-white tabular-nums">
              {format(now, 'HH:mm:ss')}
            </div>
            <div className="text-blue-200 text-sm mt-1">{format(now, "EEEE, d 'de' MMMM 'de' yyyy")}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Scanner area */}
        <div className="space-y-4">
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Camera className="w-4 h-4" />Escáner QR
              </h3>
              <Button
                onClick={scanning ? stopScanner : startScanner}
                variant={scanning ? 'destructive' : 'default'}
                size="sm"
                className="gap-2"
              >
                {scanning ? <><CameraOff className="w-4 h-4" />Detener</> : <><Camera className="w-4 h-4" />Iniciar Cámara</>}
              </Button>
            </div>

            <div className="relative bg-slate-900" style={{ minHeight: 300 }}>
              <div id="qr-reader" className="w-full" />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/60">
                  <Camera className="w-16 h-16 opacity-30" />
                  <p className="text-sm">Presiona "Iniciar Cámara" para comenzar</p>
                  <p className="text-xs opacity-60">Compatible con PC y dispositivo móvil</p>
                </div>
              )}
              {scanning && !scannerReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Last scan result */}
          {lastResult && (
            <div className={`rounded-xl p-4 border-2 transition-all ${
              lastResult.status === 'duplicate' ? 'border-amber-400 bg-amber-50' :
              lastResult.status === 'checkin' ? 'border-emerald-400 bg-emerald-50' :
              lastResult.status === 'checkout' ? 'border-blue-400 bg-blue-50' :
              'border-border bg-muted/30'
            }`}>
              <div className="flex items-center gap-3">
                {lastResult.status === 'duplicate' ? <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0" /> :
                 lastResult.status === 'checkin' ? <CheckCircle2 className="w-8 h-8 text-emerald-500 flex-shrink-0" /> :
                 <Clock className="w-8 h-8 text-blue-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {lastResult.employee.photo_url
                        ? <img src={lastResult.employee.photo_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground" /></div>}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{lastResult.employee.full_name}</p>
                      <p className="text-xs text-muted-foreground">{lastResult.employee.position}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    {lastResult.status === 'duplicate' && (
                      <p className="text-amber-700 font-semibold text-sm">⚠️ {lastResult.employee.full_name} ya registró su asistencia hoy</p>
                    )}
                    {lastResult.status === 'checkin' && (
                      <div>
                        <p className="text-emerald-700 font-semibold text-sm">✅ Entrada registrada — {lastResult.time}</p>
                        {lastResult.attendanceStatus === 'Retardo' && (
                          <p className="text-amber-600 text-xs mt-0.5">⚠️ Marcado como Retardo</p>
                        )}
                      </div>
                    )}
                    {lastResult.status === 'checkout' && (
                      <p className="text-blue-700 font-semibold text-sm">🔵 Salida registrada — {lastResult.time}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Today's records */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Registros de Hoy — {format(now, 'd/MM/yyyy')}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{todayRecords.length} registros</p>
          </div>
          <div className="divide-y max-h-[480px] overflow-y-auto">
            {recentRecords.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin registros hoy</p>
              </div>
            )}
            {recentRecords.map(rec => {
              const emp = employees.find(e => e.id === rec.employee_id);
              const statusColor = {
                'Asistencia': 'bg-emerald-500',
                'Retardo': 'bg-amber-500',
                'Falta': 'bg-red-500',
                'Justificada': 'bg-blue-500',
              }[rec.status] || 'bg-gray-400';
              return (
                <div key={rec.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {emp?.photo_url
                      ? <img src={emp.photo_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{emp?.full_name || rec.employee_id}</p>
                    <p className="text-xs text-muted-foreground">{emp?.department}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1.5 justify-end mb-1">
                      <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                      <span className="text-xs font-medium">{rec.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {rec.check_in && <span>↓{rec.check_in}</span>}
                      {rec.check_out && <span className="ml-1">↑{rec.check_out}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Justification dialog */}
      <Dialog open={showJustification} onOpenChange={setShowJustification}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Salida Anticipada — Justificación Requerida</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm text-amber-700">
                <strong>{justificationData?.emp?.full_name}</strong> está saliendo antes del horario de su turno. Se requiere una justificación.
              </p>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={justificationStatus} onValueChange={setJustificationStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Justificada">Justificada</SelectItem>
                  <SelectItem value="Retardo">Retardo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo *</Label>
              <Input value={justificationNote} onChange={e => setJustificationNote(e.target.value)} placeholder="Ej: Cita médica, emergencia familiar..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowJustification(false)}>Cancelar</Button>
              <Button onClick={confirmJustification} disabled={!justificationNote.trim()}>Confirmar Salida</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}