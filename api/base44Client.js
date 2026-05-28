/**
 * base44Client.js
 * ===============
 * Re-export del Google Sheets Client para mantener compatibilidad
 * con todos los imports existentes en las páginas del proyecto.
 *
 * Antes: import { base44 } from '@/api/base44Client'
 *        → usaba Base44 SDK
 *
 * Ahora: el mismo import funciona sin cambios en ninguna página,
 *        pero internamente usa Google Sheets como base de datos.
 */

import { googleSheets } from './googleSheetsClient';

// Re-exportamos googleSheets como "base44" para compatibilidad total
export const base44 = googleSheets;

export default base44;
