import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, CheckCircle2, AlertTriangle, Clock, User, Loader2, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const GRACE_MINUTES = 10;
const EARLY_EXIT_MINUTES = 15;
const SCAN_COOLDOWN_MS = 10000; // 10 segundos entre escaneos del mismo empleado

function parseTime(timeStr) {
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

// ──────────────────────────────────────────────────────────
// SONIDOS con Web Audio API (sin archivos externos)
// ──────────────────────────────────────────────────────────
function playBeep(type = 'checkin') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq, startAt, duration, vol = 0.3) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(vol, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
      osc.start(startAt);
      osc.stop(startAt + duration);
    };

    const t = ctx.currentTime;

    if (type === 'checkin') {
      // Dos pitidos cortos ascendentes — entrada ✅
      playTone(880, t, 0.12);
      playTone(1100, t + 0.14, 0.12);
    } else if (type === 'checkout') {
      // Dos pitidos descendentes — salida 🔵
      playTone(1100, t, 0.12);
      playTone(700, t + 0.14, 0.12);
    } else if (type === 'duplicate') {
      // Pitido largo de advertencia ⚠️
      playTone(440, t, 0.4, 0.2);
    } else if (type === 'error') {
      // Pitido bajo de error
      playTone(220, t, 0.35, 0.2);
    }
  } catch (e) {
    // Silently fail if audio not available
  }
}

const STATUS_CONFIG = {
  'Asistencia': { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  'Retardo':    { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  'Falta':      { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  'Justificada':{ dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
};

export default function QRAttendanceScanner() {
  const [now, setNow] = useState(new Date());
  const [scanning, setScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [showJustification, setShowJustification] = useState(false);
  const [justificationData, setJustificationData] = useState(null);
  const [justificationNote, setJustificationNote] = useState('');
  const [justificationStatus, setJustificationStatus] = useState('Justificada');
  // Track newly-registered employee id for highlight
  const [newlyRegistered, setNewlyRegistered] = useState(null);

  const qrCodeRef = useRef(null);
  const lastScansRef = useRef({});
  const handleScanRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => base44.entities.Shift.list(),
  });
  const { data: todayRecords = [], refetch: refetchToday } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => base44.entities.AttendanceRecord.filter({ date: format(new Date(), 'yyyy-MM-dd') }),
    refetchInterval: 8000,
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
      if (!cameras.length) {
        toast.error('No se encontró cámara');
        setScanning(false);
        return;
      }
      const cam = cameras.find(c =>
        c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('trasera')
      ) || cameras[cameras.length - 1];
      await html5QrCode.start(
        cam.id,
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => { if (handleScanRef.current) handleScanRef.current(decodedText); },
        () => {}
      );
      setScannerReady(true);
    } catch (err) {
      toast.error('Error al iniciar la cámara: ' + err.message);
      setScanning(false);
    }
  }, []);

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
    const nowTime = Date.now();

    const emp = employees.find(e => e.employee_id === text || e.id === text);
    if (!emp) {
      const lastUnknown = lastScansRef.current[`unknown_${text}`];
      if (lastUnknown && (nowTime - lastUnknown < 3000)) return;
      lastScansRef.current[`unknown_${text}`] = nowTime;
      playBeep('error');
      toast.error('QR no reconocido');
      return;
    }

    // Cooldown per employee
    const lastScan = lastScansRef.current[emp.id];
    if (lastScan && (nowTime - lastScan < SCAN_COOLDOWN_MS)) return;
    lastScansRef.current[emp.id] = nowTime;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowStr = format(new Date(), 'HH:mm');
    const curMin = currentMinutes();

    const existing = todayRecords.find(r => r.employee_id === emp.id);
    const shift = shifts.find(s => s.id === emp.shift_id);

    if (existing) {
      if (existing.check_out) {
        // Already fully registered
        playBeep('duplicate');
        setLastResult({ employee: emp, status: 'duplicate', existing });
        setNewlyRegistered(emp.id);
        setTimeout(() => setNewlyRegistered(null), 3000);
        return;
      }
      if (existing.check_in) {
        // Check-out
        if (shift?.end_time) {
          const end = parseTime(shift.end_time);
          const endMin = minutesFromMidnight(end.h, end.m);
          if (curMin < endMin - EARLY_EXIT_MINUTES) {
            setJustificationData({ emp, existing, type: 'early_exit', nowStr, todayStr });
            setJustificationNote('');
            setJustificationStatus('Justificada');
            setShowJustification(true);
            return;
          }
        }
        playBeep('checkout');
        updateRecord.mutate({ id: existing.id, data: { check_out: nowStr } });
        setLastResult({ employee: emp, status: 'checkout', time: nowStr });
        setNewlyRegistered(emp.id);
        setTimeout(() => setNewlyRegistered(null), 3000);
        return;
      }
    }

    // Check-in
    let status = 'Asistencia';
    if (shift?.start_time) {
      const start = parseTime(shift.start_time);
      const startMin = minutesFromMidnight(start.h, start.m);
      if (curMin > startMin + GRACE_MINUTES) status = 'Retardo';
    }

    playBeep('checkin');
    createRecord.mutate({ employee_id: emp.id, date: todayStr, check_in: nowStr, status });
    setLastResult({ employee: emp, status: 'checkin', attendanceStatus: status, time: nowStr });
    setNewlyRegistered(emp.id);
    setTimeout(() => setNewlyRegistered(null), 3000);
  }, [employees, shifts, todayRecords, createRecord, updateRecord]);

  // Keep ref updated so html5-qrcode always calls the latest closure
  useEffect(() => { handleScanRef.current = handleScan; }, [handleScan]);

  const confirmJustification = () => {
    const { emp, existing, nowStr } = justificationData;
    playBeep('checkout');
    updateRecord.mutate({
      id: existing.id,
      data: { check_out: nowStr, notes: justificationNote, status: justificationStatus },
    });
    setLastResult({ employee: emp, status: 'checkout', time: nowStr, note: justificationNote });
    setNewlyRegistered(emp.id);
    setTimeout(() => setNewlyRegistered(null), 3000);
    setShowJustification(false);
    setJustificationData(null);
  };

  // Sort today records: most recent check-in first, unlimited
  const sortedRecords = [...todayRecords].sort((a, b) =>
    (b.check_in || '').localeCompare(a.check_in || '')
  );

  return (
    <div className="space-y-4">
      {/* Header with clock */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-900 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Checador de Asistencia QR</h2>
            <p className="text-blue-200 text-xs mt-0.5">Escanea tu credencial para registrar entrada o salida</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-mono font-bold tracking-tight text-white tabular-nums">
              {format(now, 'HH:mm:ss')}
            </div>
            <div className="text-blue-200 text-xs mt-1">{format(now, "EEEE, d 'de' MMMM 'de' yyyy")}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ── LEFT: Scanner ── */}
        <div className="space-y-3">
          {/* Camera box */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Camera className="w-4 h-4" />Escáner QR
              </h3>
              <Button
                onClick={scanning ? stopScanner : startScanner}
                variant={scanning ? 'destructive' : 'default'}
                size="sm"
                className="gap-2 h-8 text-xs"
              >
                {scanning
                  ? <><CameraOff className="w-3.5 h-3.5" />Detener</>
                  : <><Camera className="w-3.5 h-3.5" />Iniciar Cámara</>}
              </Button>
            </div>
            <div className="relative bg-slate-900" style={{ minHeight: 260 }}>
              <div id="qr-reader" className="w-full" />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60">
                  <Camera className="w-14 h-14 opacity-20" />
                  <p className="text-sm">Presiona "Iniciar Cámara" para comenzar</p>
                  <p className="text-xs opacity-50">Compatible con PC y dispositivo móvil</p>
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
              lastResult.status === 'checkin'   ? 'border-emerald-400 bg-emerald-50' :
              lastResult.status === 'checkout'  ? 'border-blue-400 bg-blue-50' :
              'border-border bg-muted/30'
            }`}>
              <div className="flex items-center gap-3">
                {lastResult.status === 'duplicate'
                  ? <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0" />
                  : lastResult.status === 'checkin'
                  ? <CheckCircle2 className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                  : <Clock className="w-8 h-8 text-blue-500 flex-shrink-0" />}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {lastResult.employee.photo_url
                        ? <img src={lastResult.employee.photo_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>}
                    </div>
                    <div>
                      <p className="font-bold text-sm leading-tight">{lastResult.employee.full_name}</p>
                      <p className="text-xs text-muted-foreground">{lastResult.employee.position}</p>
                    </div>
                  </div>
                  {lastResult.status === 'duplicate' && (
                    <p className="text-amber-700 font-semibold text-sm">⚠️ Ya registrado hoy</p>
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
          )}
        </div>

        {/* ── RIGHT: Today's records ── */}
        <div className="bg-card border rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="font-semibold text-sm">Registros de Hoy — {format(now, 'd/MM/yyyy')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {todayRecords.length} {todayRecords.length === 1 ? 'registro' : 'registros'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><LogIn className="w-3 h-3 text-emerald-500" />Entrada</span>
              <span className="flex items-center gap-1"><LogOut className="w-3 h-3 text-blue-500" />Salida</span>
            </div>
          </div>

          <div className="divide-y overflow-y-auto flex-1" style={{ maxHeight: 420 }}>
            {sortedRecords.length === 0 && (
              <div className="text-center py-14 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-25" />
                <p className="text-sm">Sin registros hoy</p>
                <p className="text-xs opacity-60 mt-1">Escanea una credencial para comenzar</p>
              </div>
            )}
            {sortedRecords.map(rec => {
              const emp = employees.find(e => e.id === rec.employee_id);
              const cfg = STATUS_CONFIG[rec.status] || { dot: 'bg-gray-400', text: 'text-gray-600', bg: '' };
              const isNew = newlyRegistered === rec.employee_id;

              return (
                <div
                  key={rec.id}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-all duration-500 ${
                    isNew ? 'bg-emerald-50' : 'hover:bg-muted/20'
                  }`}
                >
                  {/* Photo */}
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
                    {emp?.photo_url
                      ? <img src={emp.photo_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>}
                  </div>

                  {/* Name + position */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate leading-tight">{emp?.full_name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp?.position || emp?.department || ''}</p>
                  </div>

                  {/* Status + times */}
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className={`text-xs font-medium ${cfg.text}`}>{rec.status}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                      {rec.check_in && (
                        <span className="flex items-center gap-0.5">
                          <LogIn className="w-2.5 h-2.5 text-emerald-500" />
                          {rec.check_in}
                        </span>
                      )}
                      {rec.check_out && (
                        <span className="flex items-center gap-0.5">
                          <LogOut className="w-2.5 h-2.5 text-blue-500" />
                          {rec.check_out}
                        </span>
                      )}
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
                <strong>{justificationData?.emp?.full_name}</strong> está saliendo antes del horario de su turno.
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
              <Input
                value={justificationNote}
                onChange={e => setJustificationNote(e.target.value)}
                placeholder="Ej: Cita médica, emergencia familiar..."
              />
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