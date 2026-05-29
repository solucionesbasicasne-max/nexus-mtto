/**
 * Google Sheets Client — Nexus CMMS
 * =====================================
 * Reemplaza el cliente Base44 con una implementación que usa
 * Google Apps Script como proxy REST hacia Google Sheets.
 *
 * Expone exactamente la misma interfaz que base44.entities.*
 * para que todas las páginas existentes funcionen sin cambios.
 */

const SHEETS_API_URL = import.meta.env.VITE_SHEETS_API_URL || '';

/**
 * Normaliza las URLs de Google Drive para que puedan renderizarse directamente en etiquetas <img>
 * (Evita bloqueos de cookies de terceros y CORS usando el endpoint lh3.googleusercontent.com)
 */
function normalizeGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  if (url.includes('drive.google.com')) {
    let fileId = '';
    
    // Formato 1: drive.google.com/file/d/FILE_ID/view...
    const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileDMatch) {
      fileId = fileDMatch[1];
    } else {
      // Formato 2: drive.google.com/uc?id=FILE_ID... o export=view&id=FILE_ID
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        fileId = idMatch[1];
      }
    }
    
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  return url;
}

/**
 * Normaliza un valor individual (URLs de Drive, fechas y horas de Google Sheets)
 */
function normalizeValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    // 1. Normalizar URLs de Google Drive
    let normalized = normalizeGoogleDriveUrl(val);
    
    // 2. Normalizar fechas (2026-05-28T00:00:00 -> 2026-05-28)
    if (normalized.match(/^\d{4}-\d{2}-\d{2}T00:00:00$/) || normalized.match(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/)) {
      return normalized.substring(0, 10);
    }
    
    // 3. Normalizar horas (1899-12-30T14:40:00 -> 14:40)
    if (normalized.startsWith('1899-12-30T') || normalized.startsWith('1900-01-01T')) {
      const timeMatch = normalized.match(/T(\d{2}:\d{2})/);
      if (timeMatch) return timeMatch[1];
    }
    
    return normalized;
  }
  return val;
}

/**
 * Normaliza recursivamente todos los valores dentro de un objeto/arreglo (URLs, fechas, horas)
 */
function deepNormalizeUrls(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return normalizeValue(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(deepNormalizeUrls);
  }
  if (typeof obj === 'object') {
    const newObj = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'evidence_urls' && typeof v === 'string' && v.startsWith('[')) {
        try {
          const parsed = JSON.parse(v);
          newObj[k] = deepNormalizeUrls(parsed);
          continue;
        } catch {}
      }
      newObj[k] = deepNormalizeUrls(v);
    }
    return newObj;
  }
  return obj;
}

/**
 * Helper: hace fetch al Apps Script Web App
 */
async function apiFetch(path, action, params = {}, body = null) {
  if (!SHEETS_API_URL) {
    console.error('VITE_SHEETS_API_URL no configurado. Crea un archivo .env.local con esta variable.');
    throw new Error('API URL no configurada. Consulta SETUP_GOOGLE_SHEETS.md');
  }

  const url = new URL(SHEETS_API_URL);
  url.searchParams.set('path', path);
  url.searchParams.set('action', action);
  
  // Agregar params adicionales a la URL (para GET)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  });

  const isWrite = body !== null;
  const token = localStorage.getItem('nexus_token');

  const options = {
    method: isWrite ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'text/plain', // Cambiado a text/plain para evitar la solicitud preflight OPTIONS de CORS en Google Apps Script
    },
  };

  if (isWrite) {
    options.body = JSON.stringify({ ...body, _token: token });
  }

  const response = await fetch(url.toString(), options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (data && data.error) {
    throw new Error(data.error);
  }
  
  return deepNormalizeUrls(data);
}

/**
 * Crea un objeto de entidad con métodos CRUD
 * Compatible con la interfaz de base44.entities.X
 */
function createEntityClient(entityName) {
  return {
    /**
     * Lista registros
     * @param {string} sortBy - Campo de ordenamiento (prefijo '-' para desc)
     * @param {number} limit - Máximo de registros
     * @param {object} filter - Filtros { campo: valor }
     */
    list: async (sortBy = '', limit = 1000, filter = null) => {
      const params = { sortBy, limit };
      if (filter) params.filter = filter;
      return apiFetch(`entities/${entityName}`, 'list', params);
    },

    /**
     * Obtiene un registro por ID
     */
    get: async (id) => {
      return apiFetch(`entities/${entityName}`, 'get', { id });
    },

    /**
     * Crea un nuevo registro
     */
    create: async (data) => {
      return apiFetch(`entities/${entityName}`, 'create', {}, data);
    },

    /**
     * Actualiza un registro existente
     */
    update: async (id, data) => {
      return apiFetch(`entities/${entityName}`, 'update', { id }, { ...data, id });
    },

    /**
     * Elimina un registro
     */
    delete: async (id) => {
      return apiFetch(`entities/${entityName}`, 'delete', { id }, { id });
    },

    /**
     * Filtra registros (alias de list con filter)
     */
    filter: async (filterObj, sortBy = '', limit = 1000) => {
      return apiFetch(`entities/${entityName}`, 'list', { sortBy, limit, filter: filterObj });
    },
  };
}

/**
 * Auth client — maneja login/logout con Google Sheets Users
 */
const authClient = {
  login: async (username, password) => {
    return apiFetch('auth/login', 'login', {}, { username, password });
  },

  logout: (redirectUrl = null) => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      window.location.href = '/welcome';
    }
  },

  me: async () => {
    const token = localStorage.getItem('nexus_token');
    if (!token) throw new Error('No token');
    return apiFetch('auth/me', 'me', { token });
  },

  isAuthenticated: async () => {
    const token = localStorage.getItem('nexus_token');
    if (!token) return false;
    try {
      const result = await apiFetch('auth/me', 'me', { token });
      return result.success && result.user;
    } catch {
      return false;
    }
  },

  redirectToLogin: (returnUrl) => {
    window.location.href = '/welcome';
  },

  getUser: () => {
    const userStr = localStorage.getItem('nexus_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },
};

/**
 * Functions client — compatible con base44.functions.invoke
 */
const functionsClient = {
  invoke: async (functionName, params = {}) => {
    // Para funciones personalizadas como validateAppUser
    if (functionName === 'validateAppUser') {
      return apiFetch('auth/validate', 'validate', {}, params);
    }
    return apiFetch(`functions/${functionName}`, 'invoke', {}, params);
  },
};

/**
 * Comprime una imagen a un tamaño máximo de 200x200px y la devuelve como base64 comprimida.
 * Esto genera un archivo muy ligero (aprox 6-10 KB) que se guarda directamente en la celda
 * de Google Sheets, garantizando que funcione offline, en redes corporativas con restricciones
 * de Google Drive, y sin superar el límite de tamaño de celdas.
 */
function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 200;
          const MAX_HEIGHT = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Comprimimos a JPEG con calidad 0.7
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        } catch (e) {
          resolve(event.target.result); // Fallback al original si falla el canvas
        }
      };
      img.onerror = () => {
        resolve(event.target.result);
      };
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Integrations client — compatible con base44.integrations
 */
const integrationsClient = {
  Core: {
    UploadFile: async ({ file }) => {
      // Si es una imagen (avatar de personal, evidencia, etc.), la comprimimos a un base64 ultra ligero
      // y la guardamos directamente para evitar problemas de permisos de Google Drive corporativos
      if (file.type && file.type.startsWith('image/')) {
        try {
          const compressedDataUrl = await compressImageToBase64(file);
          return { file_url: compressedDataUrl };
        } catch (err) {
          console.warn('Error al comprimir imagen, usando flujo por defecto de Drive', err);
        }
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          try {
            const base64String = reader.result.split(',')[1];
            const mimeType = file.type;
            const fileName = file.name;
            
            if (!SHEETS_API_URL) {
              console.warn('VITE_SHEETS_API_URL no configurado. Usando fallback local para archivo.');
              const localUrl = URL.createObjectURL(file);
              resolve({ file_url: localUrl });
              return;
            }

            try {
              const result = await apiFetch('file/upload', 'upload', {}, {
                base64Data: base64String,
                fileName,
                mimeType
              });
              
              if (result.success && result.file_url) {
                resolve({ file_url: result.file_url });
              } else {
                throw new Error(result.error || 'Failed to upload file');
              }
            } catch (apiErr) {
              console.warn('Error al subir archivo al servidor, usando fallback local:', apiErr);
              const localUrl = URL.createObjectURL(file);
              resolve({ file_url: localUrl });
            }
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = (err) => reject(err);
      });
    },
    
    InvokeLLM: async ({ prompt, response_json_schema }) => {
      const result = await apiFetch('ai/invoke', 'invoke', {}, { prompt, response_json_schema });
      if (result.success && result.output) {
        if (typeof result.output === 'object') {
          return result.output;
        }
        try {
          return JSON.parse(result.output);
        } catch {
          return result.output;
        }
      } else {
        throw new Error(result.error || 'Failed to invoke LLM');
      }
    }
  }
};

/**
 * Cliente principal — expone la misma interfaz que base44
 */
export const googleSheets = {
  entities: {
    // Mantenimiento
    WorkOrder: createEntityClient('WorkOrders'),
    PreventiveMaintenance: createEntityClient('PreventiveMaintenance'),
    MaintenancePlan: createEntityClient('MaintenancePlans'),
    PlanActivity: createEntityClient('PlanActivities'),
    WorkOrderStatusHistory: createEntityClient('WorkOrderStatusHistory'),
    WOActivity: createEntityClient('WOActivities'),
    WOResource: createEntityClient('WOResources'),
    
    // Jerarquía
    Company: createEntityClient('Companies'),
    Site: createEntityClient('Sites'),
    BusinessUnit: createEntityClient('BusinessUnits'),
    Location: createEntityClient('Locations'),
    Process: createEntityClient('Processes'),
    Asset: createEntityClient('Assets'),
    AssetSystem: createEntityClient('AssetSystems'),
    Component: createEntityClient('Components'),
    
    // Inventario
    SparePart: createEntityClient('SpareParts'),
    InventoryMovement: createEntityClient('InventoryMovements'),
    Service: createEntityClient('Services'),
    
    // Personal
    Employee: createEntityClient('Employees'),
    Shift: createEntityClient('Shifts'),
    Specialty: createEntityClient('Specialties'),
    UserProfile: createEntityClient('UserProfiles'),
    AttendanceRecord: createEntityClient('AttendanceRecords'),
    
    // Planes de recursos
    PlanResourceLabor: createEntityClient('PlanResourceLabor'),
    PlanResourcePart: createEntityClient('PlanResourceParts'),
    PlanResourceService: createEntityClient('PlanResourceServices'),
    
    // Sistema
    Notification: createEntityClient('Notifications'),
    AuditLog: createEntityClient('AuditLogs'),
    AppConfig: createEntityClient('AppConfig'),
  },
  
  auth: authClient,
  functions: functionsClient,
  integrations: integrationsClient,
};

export default googleSheets;
