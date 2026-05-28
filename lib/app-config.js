/**
 * app-config.js
 * =============
 * Configuración de la aplicación para Google Sheets.
 * Reemplaza app-params.js de Base44.
 */

export const appConfig = {
  sheetsApiUrl: import.meta.env.VITE_SHEETS_API_URL || '',
  appName: 'Nexus CMMS Pro',
  version: '2026',
};

/**
 * Verifica si la API URL está configurada
 */
export function isApiConfigured() {
  return Boolean(import.meta.env.VITE_SHEETS_API_URL);
}
