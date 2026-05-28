import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Palette, LogIn, Shield, Save, CheckCircle2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TABS = [
  { id: 'company', label: 'Empresa', icon: Building2 },
  { id: 'branding', label: 'Marca / App', icon: Palette },
  { id: 'login', label: 'Inicio de Sesión', icon: LogIn },
  { id: 'roles', label: 'Roles y Perfiles', icon: Shield },
];

const ROLE_DESCRIPTIONS = {
  Admin: 'Acceso total a todos los módulos. Puede gestionar usuarios y configuración.',
  Supervisor: 'Acceso a OTs, preventivo, planes, inventario y reportes. No accede a configuración.',
  Técnico: 'Acceso a dashboard, órdenes de trabajo, preventivo e inventario.',
  Visualizador: 'Solo puede ver dashboard, reportes y analytics. Sin edición.',
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState('company');
  const [configs, setConfigs] = useState({});
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const queryClient = useQueryClient();

  const { data: configList = [] } = useQuery({
    queryKey: ['appConfig'],
    queryFn: () => base44.entities.AppConfig.list()
  });

  useEffect(() => {
    const map = {};
    configList.forEach(c => { map[c.key] = { id: c.id, value: c.value }; });
    setConfigs(map);
  }, [configList]);

  const saveConfig = async (key, value) => {
    const existing = configs[key];
    if (existing?.id) {
      await base44.entities.AppConfig.update(existing.id, { key, value });
    } else {
      await base44.entities.AppConfig.create({ key, value, category: activeTab });
    }
    queryClient.invalidateQueries({ queryKey: ['appConfig'] });
  };

  const handleSaveAll = async () => {
    const updates = Object.entries(configs).map(([key, obj]) =>
      obj.id
        ? base44.entities.AppConfig.update(obj.id, { key, value: obj.value })
        : base44.entities.AppConfig.create({ key, value: obj.value, category: activeTab })
    );
    await Promise.all(updates);
    queryClient.invalidateQueries({ queryKey: ['appConfig'] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    toast.success('Configuración guardada');
  };

  const setVal = (key, value) => {
    setConfigs(prev => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const get = (key) => configs[key]?.value || '';

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setVal('company_logo_url', file_url);
      // Save immediately
      const existing = configs['company_logo_url'];
      if (existing?.id) {
        await base44.entities.AppConfig.update(existing.id, { key: 'company_logo_url', value: file_url });
      } else {
        await base44.entities.AppConfig.create({ key: 'company_logo_url', value: file_url, category: 'company' });
      }
      queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      toast.success('Logo subido correctamente');
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Ajusta los parámetros generales del sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Company */}
      {activeTab === 'company' && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Datos de la Empresa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">Esta información aparece en los encabezados de los documentos e impresiones generados por el sistema.</p>
            <div><Label>Razón Social *</Label><Input value={get('company_name')} onChange={e => setVal('company_name', e.target.value)} placeholder="Empresa S.A. de C.V." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>RFC</Label><Input value={get('company_rfc')} onChange={e => setVal('company_rfc', e.target.value)} placeholder="RFC123456AB1" /></div>
              <div><Label>Teléfono</Label><Input value={get('company_phone')} onChange={e => setVal('company_phone', e.target.value)} placeholder="667-000-0000" /></div>
            </div>
            <div><Label>Email</Label><Input value={get('company_email')} onChange={e => setVal('company_email', e.target.value)} placeholder="contacto@empresa.com" /></div>
            <div><Label>Dirección</Label><Textarea value={get('company_address')} onChange={e => setVal('company_address', e.target.value)} rows={2} placeholder="Calle, Colonia, Ciudad, Estado" /></div>
            <div>
              <Label>Logo de la Empresa</Label>
              <div className="mt-1 space-y-3">
                <label className={`flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-xl p-4 hover:bg-muted/30 transition-colors ${uploadingLogo ? 'opacity-60 pointer-events-none' : ''}`}>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  {uploadingLogo ? (
                    <><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Subiendo logo...</span></>
                  ) : (
                    <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">Haz clic para subir imagen (PNG, JPG, SVG)</span></>
                  )}
                </label>
                {get('company_logo_url') && (
                  <div className="border rounded-xl p-4 flex items-center gap-4 bg-muted/20">
                    <img src={get('company_logo_url')} alt="Logo" className="h-14 object-contain" />
                    <div>
                      <p className="text-xs font-medium">Logo actual</p>
                      <p className="text-xs text-muted-foreground">Este logo aparecerá en las credenciales y documentos</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Branding */}
      {activeTab === 'branding' && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Marca de la Aplicación</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">El nombre de la aplicación aparece en el sidebar, la pantalla de inicio de sesión y los documentos impresos.</p>
            <div><Label>Nombre de la App</Label><Input value={get('app_name')} onChange={e => setVal('app_name', e.target.value)} placeholder="CMMS Pro" /></div>
            <div><Label>URL del Logo de la App</Label><Input value={get('app_logo_url')} onChange={e => setVal('app_logo_url', e.target.value)} placeholder="https://..." /></div>
            {get('app_logo_url') && (
              <div className="border rounded-xl p-4 flex items-center gap-4">
                <img src={get('app_logo_url')} alt="App Logo" className="h-12 object-contain" />
                <p className="text-xs text-muted-foreground">Vista previa</p>
              </div>
            )}
            <div>
              <Label>Color Primario</Label>
              <div className="flex items-center gap-3 mt-1">
                <input type="color" value={get('app_primary_color') || '#2563eb'} onChange={e => setVal('app_primary_color', e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <Input value={get('app_primary_color') || '#2563eb'} onChange={e => setVal('app_primary_color', e.target.value)} className="w-36" placeholder="#2563eb" />
                <div className="w-20 h-8 rounded-lg" style={{ backgroundColor: get('app_primary_color') || '#2563eb' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Login */}
      {activeTab === 'login' && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Pantalla de Inicio de Sesión</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Texto de Bienvenida</Label><Input value={get('login_welcome_text')} onChange={e => setVal('login_welcome_text', e.target.value)} placeholder="Bienvenido al sistema..." /></div>
            <div><Label>Imagen de fondo (URL)</Label><Input value={get('login_bg_image')} onChange={e => setVal('login_bg_image', e.target.value)} placeholder="https://..." /></div>
            {get('login_bg_image') && (
              <div className="border rounded-xl overflow-hidden" style={{ height: 160 }}>
                <img src={get('login_bg_image')} alt="bg" className="w-full h-full object-cover" />
              </div>
            )}
            {/* Preview */}
            <div className="border-2 border-dashed rounded-2xl p-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white text-center space-y-2">
              {get('app_logo_url') && <img src={get('app_logo_url')} alt="logo" className="h-12 mx-auto object-contain" />}
              <h2 className="text-xl font-bold">{get('app_name') || 'CMMS Pro'}</h2>
              <p className="text-sm text-white/70">{get('login_welcome_text') || 'Bienvenido al Sistema'}</p>
              <div className="mt-3 border border-white/20 rounded-xl p-3 text-left space-y-2 max-w-xs mx-auto">
                <div className="h-8 bg-white/10 rounded-lg" />
                <div className="h-8 bg-white/10 rounded-lg" />
                <div className="h-8 rounded-lg" style={{ backgroundColor: get('app_primary_color') || '#2563eb' }} />
              </div>
              <p className="text-xs text-white/40 mt-2">Vista previa de pantalla de login</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roles */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground bg-muted/40 rounded-xl p-3">
            Los roles definen qué módulos puede ver cada usuario. Asigna el rol al crear/editar usuarios en el Módulo de Usuarios.
          </p>
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
            <Card key={role} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  role === 'Admin' ? 'bg-red-100' : role === 'Supervisor' ? 'bg-indigo-100' : role === 'Técnico' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <Shield className={`w-5 h-5 ${role === 'Admin' ? 'text-red-600' : role === 'Supervisor' ? 'text-indigo-600' : role === 'Técnico' ? 'text-blue-600' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{role}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">Puedes personalizar los módulos permitidos por usuario desde el Módulo de Usuarios → Editar → Módulos permitidos.</p>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveAll} className="gap-2 min-w-[140px]">
          {saved ? <><CheckCircle2 className="w-4 h-4" />¡Guardado!</> : <><Save className="w-4 h-4" />Guardar Cambios</>}
        </Button>
      </div>
    </div>
  );
}