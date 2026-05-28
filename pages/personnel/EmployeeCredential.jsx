import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Printer, User, Loader2, CreditCard, Palette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

function CredentialCard({ emp, specialty, config, logoUrl }) {
  const bgColor = config.bgColor || '#1e3a5f';
  const bgColor2 = config.bgColor2 || '#2563eb';
  const textColor = config.textColor || '#ffffff';
  const labelColor = config.labelColor || '#93c5fd';
  const accentColor = config.accentColor || '#f59e0b';

  return (
    <div
      className="w-[340px] h-[210px] rounded-xl overflow-hidden shadow-xl relative flex-shrink-0"
      style={{ background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor2} 100%)` }}
    >
      {/* Decoración fondo */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full border-4 border-white" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full border-4 border-white" />
      </div>

      {/* Header strip */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(to right, ${accentColor}, #fde047)` }} />

      <div className="relative z-10 p-4 h-full flex gap-4">
        {/* Photo + QR */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="w-[68px] h-[68px] rounded-xl overflow-hidden border-2 bg-white/10" style={{ borderColor: 'rgba(255,255,255,0.4)' }}>
            {emp.photo_url ? (
              <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-8 h-8 text-white/60" />
              </div>
            )}
          </div>
          <div className="bg-white rounded-md p-1 flex items-center justify-center" style={{ width: 62, height: 62 }}>
            <QRCodeSVG value={emp.employee_id || emp.id} size={54} level="M" bgColor="#ffffff" fgColor="#111827" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
          <div>
            {/* Logo + etiqueta */}
            <div className="flex items-center gap-2 mb-1">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="h-5 object-contain max-w-[60px]" />
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: accentColor }}>Personal</p>
                </>
              )}
            </div>
            <h3 className="font-bold text-sm leading-tight truncate" style={{ color: textColor }}>{emp.full_name}</h3>
            <p className="text-xs mt-0.5 truncate" style={{ color: labelColor }}>{emp.position}</p>
            {specialty && <p className="text-[10px] mt-0.5 truncate" style={{ color: labelColor }}>{specialty}</p>}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] flex-shrink-0" style={{ color: labelColor }}>ID</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/15 truncate" style={{ color: textColor }}>{emp.employee_id}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] flex-shrink-0" style={{ color: labelColor }}>Área</span>
              <span className="text-[10px] truncate max-w-[140px]" style={{ color: textColor }}>{emp.department}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] flex-shrink-0" style={{ color: labelColor }}>Estatus</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${emp.status === 'Activo' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-red-500/30 text-red-300'}`}>
                {emp.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(to right, ${accentColor}, #fde047)` }} />
    </div>
  );
}

export default function EmployeeCredential() {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [showConfig, setShowConfig] = useState(false);
  const [cardConfig, setCardConfig] = useState({
    bgColor: '#1e3a5f',
    bgColor2: '#2563eb',
    textColor: '#ffffff',
    labelColor: '#93c5fd',
    accentColor: '#f59e0b',
  });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 200)
  });
  const { data: specialties = [] } = useQuery({
    queryKey: ['specialties'],
    queryFn: () => base44.entities.Specialty.list()
  });
  const { data: configList = [] } = useQuery({
    queryKey: ['appConfig'],
    queryFn: () => base44.entities.AppConfig.list(),
    staleTime: 30000,
  });

  const logoUrl = configList.find(c => c.key === 'company_logo_url')?.value || '';

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
  const getSpecialtyName = (id) => specialties.find(s => s.id === id)?.name || '';

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.employee_id?.toLowerCase().includes(search.toLowerCase());
    const matchDept = selectedDept === 'all' || e.department === selectedDept;
    return matchSearch && matchDept && e.status === 'Activo';
  });

  const printCredentials = () => {
    const { bgColor, bgColor2, textColor, labelColor, accentColor } = cardConfig;
    const cards = filtered.map(emp => {
      const specialty = getSpecialtyName(emp.specialty_id);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=54x54&data=${encodeURIComponent(emp.employee_id || emp.id)}`;
      const logoHtml = logoUrl
        ? `<img src="${logoUrl}" style="height:20px;object-fit:contain;max-width:60px;">`
        : `<span style="font-size:9px;color:${accentColor};text-transform:uppercase;letter-spacing:1px;font-weight:600;">Personal</span>`;

      return `
      <div style="width:340px;height:210px;border-radius:12px;overflow:hidden;position:relative;display:inline-flex;flex-shrink:0;background:linear-gradient(135deg,${bgColor} 0%,${bgColor2} 100%);page-break-inside:avoid;">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(to right,${accentColor},#fde047)"></div>
        <div style="position:absolute;inset:0;opacity:0.08;">
          <div style="position:absolute;top:-32px;right:-32px;width:128px;height:128px;border-radius:50%;border:4px solid white;"></div>
          <div style="position:absolute;bottom:-32px;left:-32px;width:96px;height:96px;border-radius:50%;border:4px solid white;"></div>
        </div>
        <div style="position:relative;z-index:10;padding:16px;height:100%;display:flex;gap:16px;box-sizing:border-box;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;">
            <div style="width:68px;height:68px;border-radius:12px;overflow:hidden;border:2px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.1);">
              ${emp.photo_url ? `<img src="${emp.photo_url}" style="width:100%;height:100%;object-fit:cover;">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;color:rgba(255,255,255,0.6)">👤</div>'}
            </div>
            <div style="background:white;border-radius:6px;padding:4px;width:62px;height:62px;display:flex;align-items:center;justify-content:center;">
              <img src="${qrUrl}" width="54" height="54" alt="QR">
            </div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:4px 0;min-width:0;">
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">${logoHtml}</div>
              <h3 style="font-size:13px;font-weight:bold;color:${textColor};margin:0;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${emp.full_name}</h3>
              <p style="font-size:10px;color:${labelColor};margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${emp.position}</p>
              ${specialty ? `<p style="font-size:9px;color:${labelColor};margin:1px 0;">${specialty}</p>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:3px;">
              <div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:9px;color:${labelColor}">ID</span><span style="font-size:9px;font-family:monospace;font-weight:bold;color:${textColor};background:rgba(255,255,255,0.15);padding:1px 6px;border-radius:4px;">${emp.employee_id}</span></div>
              <div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:9px;color:${labelColor}">Área</span><span style="font-size:9px;color:${textColor};max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${emp.department}</span></div>
              <div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:9px;color:${labelColor}">Estatus</span><span style="font-size:9px;font-weight:bold;padding:1px 6px;border-radius:20px;background:rgba(16,185,129,0.3);color:#6ee7b7;">${emp.status}</span></div>
            </div>
          </div>
        </div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(to right,${accentColor},#fde047)"></div>
      </div>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Credenciales de Personal</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        body { font-family: Arial, sans-serif; background: white; padding: 16px; }
        .grid { display: flex; flex-wrap: wrap; gap: 12px; }
        div, span, p, h3 { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @media print {
          body { padding: 8px; }
          @page { margin: 8mm; size: A4; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        }
      </style></head>
      <body>
        <p style="font-size:13px;color:#1e3a5f;margin-bottom:12px;font-weight:bold;">CREDENCIALES DE PERSONAL — ${filtered.length} empleados</p>
        <div class="grid">${cards}</div>
        <script>
          window.onload = function() {
            // Esperar a que las imágenes carguen
            var imgs = document.querySelectorAll('img');
            var loaded = 0;
            if(imgs.length === 0) { setTimeout(function(){ window.print(); }, 300); return; }
            imgs.forEach(function(img){
              if(img.complete){ loaded++; if(loaded===imgs.length){ setTimeout(function(){ window.print(); },300); } }
              else { img.onload = img.onerror = function(){ loaded++; if(loaded===imgs.length){ setTimeout(function(){ window.print(); },300); } }; }
            });
          };
        <\/script>
      </body></html>
    `);
    win.document.close();
    toast.success('Enviando a impresión...');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Credencial General</h2>
          <p className="text-sm text-muted-foreground">Credenciales con QR escaneable para checador de asistencia</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={() => setShowConfig(!showConfig)}>
            <Palette className="w-4 h-4" />Diseño
          </Button>
          <Button onClick={printCredentials} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" />Imprimir
          </Button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Palette className="w-4 h-4" />Configuración del vector (diseño de credencial)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { key: 'bgColor', label: 'Fondo 1' },
                { key: 'bgColor2', label: 'Fondo 2' },
                { key: 'textColor', label: 'Texto Principal' },
                { key: 'labelColor', label: 'Etiquetas' },
                { key: 'accentColor', label: 'Acento / Franja' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cardConfig[key]}
                      onChange={e => setCardConfig(c => ({ ...c, [key]: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border border-border"
                    />
                    <span className="text-xs font-mono text-muted-foreground">{cardConfig[key]}</span>
                  </div>
                </div>
              ))}
            </div>
            {logoUrl && (
              <div className="mt-3 p-2 bg-muted/30 rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
                <img src={logoUrl} alt="logo" className="h-6 object-contain" />
                Logo de empresa incluido en la credencial
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar empleado o ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={selectedDept} onValueChange={setSelectedDept}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los departamentos</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} credenciales · El QR contiene el ID del empleado para el checador</p>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin empleados activos</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-6">
          {filtered.map(emp => (
            <CredentialCard
              key={emp.id}
              emp={emp}
              specialty={getSpecialtyName(emp.specialty_id)}
              config={cardConfig}
              logoUrl={logoUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}