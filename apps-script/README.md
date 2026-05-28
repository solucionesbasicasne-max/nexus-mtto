# 📁 Google Apps Script Backend para Nexus CMMS

Este directorio contiene el backend de Google Apps Script para el CMMS Nexus.

## 📄 Archivos
* `Code.gs`: El código fuente principal que actúa como API REST completa para Google Sheets.

## 🔧 Instrucciones de Configuración y Despliegue
Para ver el manual detallado paso a paso sobre cómo desplegar este script e integrarlo con tu proyecto React, por favor consulta la guía en la raíz del proyecto:

👉 **[SETUP_GOOGLE_SHEETS.md](../../SETUP_GOOGLE_SHEETS.md)**

## 🚀 Nuevas Funcionalidades Agregadas (Compatibilidad Base44)
Este script ha sido extendido con funcionalidades premium compatibles con la app de Nexus CMMS original:
1. **Subida de Archivos Integrada con Google Drive (`file/upload`)**: Convierte archivos e imágenes cargados por el usuario a base64, los sube de manera segura a Google Drive usando las credenciales del propietario y genera enlaces de descarga y visualización instantáneos.
2. **Generador de Planes de Mantenimiento Inteligente con IA / Gemini (`ai/invoke`)**: Si configuras una clave de API de Gemini (`gemini_api_key`) en tu hoja `AppConfig`, el sistema usará IA real para generar actividades de mantenimiento. Si no está configurada, utiliza un motor heurístico alternativo súper inteligente que autogenera planes profesionales e impecables para HVAC, compresores, bombas y equipos en general.
