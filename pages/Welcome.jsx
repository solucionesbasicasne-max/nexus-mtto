import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Wrench, Shield, ChevronRight, Loader2, AlertCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isApiConfigured } from '@/lib/app-config';

export default function Welcome() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoadingAuth) {
      if (isAuthenticated) {
        navigate('/', { replace: true });
      } else {
        setChecking(false);
      }
    }
  }, [isAuthenticated, isLoadingAuth]);

  if (checking || isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Verificar configuración
  if (!isApiConfigured()) {
    return <SetupRequired />;
  }

  return <LoginScreen />;
}

/**
 * Pantalla de configuración requerida
 */
function SetupRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-6">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración requerida</h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            El proyecto necesita conectarse a tu Google Sheets. Sigue estos pasos para configurarlo.
          </p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 text-left space-y-4">
          <h2 className="text-white font-semibold text-sm">Pasos de configuración:</h2>
          <ol className="space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">1</span>
              <span>Despliega el Apps Script en <strong className="text-white">script.google.com</strong> usando el archivo <code className="bg-slate-700 px-1 rounded text-blue-300">apps-script/Code.gs</code></span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">2</span>
              <span>Copia la URL de implementación del Apps Script</span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">3</span>
              <span>Crea un archivo <code className="bg-slate-700 px-1 rounded text-blue-300">.env.local</code> en la raíz del proyecto con:</span>
            </li>
          </ol>
          <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-green-400">
            VITE_SHEETS_API_URL=https://script.google.com/macros/s/TU_ID/exec
          </div>
          <li className="flex gap-3 list-none">
            <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">4</span>
            <span className="text-slate-300">Reinicia el servidor con <code className="bg-slate-700 px-1 rounded text-blue-300">npm run dev</code></span>
          </li>
        </div>
        <p className="text-slate-500 text-xs">
          Consulta el archivo <code className="text-blue-400">SETUP_GOOGLE_SHEETS.md</code> para instrucciones detalladas.
        </p>
      </div>
    </div>
  );
}

/**
 * Pantalla de login
 */
function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(username, password);
      
      if (result.success) {
        navigate('/', { replace: true });
      } else {
        setError(result.error || 'Usuario o contraseña incorrectos.');
      }
    } catch (err) {
      setError('Error al conectar con el servidor. Verifica tu configuración.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0f172a]">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-[#1e3a5f] via-[#1e40af] to-[#0f172a] p-12 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-blue-500/10 border border-blue-400/10" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-600/10 border border-blue-400/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-blue-800/10" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Nexus CMMS Pro</span>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Gestión de<br />
              <span className="text-blue-300">Mantenimiento</span><br />
              Inteligente
            </h1>
            <p className="mt-4 text-blue-200/80 text-base leading-relaxed max-w-sm">
              Controla activos, órdenes de trabajo, personal y reportes desde una sola plataforma profesional.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Órdenes de Trabajo', 'Activos', 'Inventario', 'Reportes', 'Gantt'].map(f => (
              <span key={f} className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/20 text-blue-200 text-xs font-medium">{f}</span>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-base">📊</span>
            </div>
            <div>
              <p className="text-white text-xs font-medium">Powered by Google Sheets</p>
              <p className="text-blue-300/60 text-xs">Base de datos en la nube, sin servidores</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-blue-300/50 text-xs">
          <Shield className="w-3.5 h-3.5" />
          <span>Plataforma segura · Versión 2026</span>
        </div>
      </div>

      {/* Panel derecho — formulario de login */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-2">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Nexus CMMS Pro</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Bienvenido</h2>
            <p className="text-slate-400 text-sm mt-1">Inicia sesión para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Nombre de usuario</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">👤</span>
                <Input
                  id="username"
                  type="text"
                  placeholder="tu_usuario"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 h-11"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Contraseña</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔒</span>
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-9 pr-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 h-11"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              id="login-submit"
              disabled={loading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Verificando...</>
              ) : (
                <>Iniciar sesión <ChevronRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>

          <p className="text-center text-slate-500 text-xs">
            Acceso restringido · Solo personal autorizado<br />
            <span className="text-blue-500/70">Nexus CMMS Pro © 2026</span>
          </p>
        </div>
      </div>
    </div>
  );
}