# 🔧 Configuración de Nexus CMMS con Google Sheets

Esta guía explica cómo conectar **Nexus CMMS Pro** con **Google Sheets** como base de datos.

---

## Paso 1 — Crear el Google Spreadsheet

1. Ve a [sheets.google.com](https://sheets.google.com) e inicia sesión con tu cuenta de Google
2. Crea un nuevo Spreadsheet → **Hoja de cálculo en blanco**
3. Ponle un nombre descriptivo, por ejemplo: `Nexus CMMS Database`
4. Copia el **ID del Spreadsheet** de la URL:
   ```
   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
   ```

---

## Paso 2 — Crear el Google Apps Script

1. Ve a [script.google.com](https://script.google.com)
2. Clic en **+ Nuevo proyecto**
3. Borra todo el contenido del editor y pega el contenido del archivo `apps-script/Code.gs`
4. **Actualiza el ID del Spreadsheet** en la línea:
   ```javascript
   const SPREADSHEET_ID = 'TU_SPREADSHEET_ID_AQUI';
   ```
   Reemplaza `TU_SPREADSHEET_ID_AQUI` con el ID que copiaste en el Paso 1

---

## Paso 3 — Inicializar las hojas

1. En el editor de Apps Script, en el menú desplegable de funciones, selecciona **`initializeSpreadsheet`**
2. Haz clic en **▶ Ejecutar**
3. La primera vez te pedirá permisos — acéptalos todos
4. Verifica en tu Spreadsheet que se hayan creado todas las hojas (WorkOrders, Assets, etc.)
5. También se creará automáticamente un usuario administrador:
   - **Usuario:** `admin`
   - **Contraseña:** `admin123`

---

## Paso 4 — Desplegar como Web App

1. En Apps Script, ve a **Implementar → Nueva implementación**
2. Haz clic en ⚙️ junto a "Tipo" y selecciona **Aplicación web**
3. Configura:
   - **Descripción:** `Nexus CMMS API v1`
   - **Ejecutar como:** `Yo (tu cuenta de Google)`
   - **Quién puede acceder:** `Cualquier usuario`
4. Haz clic en **Implementar**
5. Autoriza los permisos solicitados
6. Copia la **URL de implementación** — se verá así:
   ```
   https://script.google.com/macros/s/AKfycbxXXXXXXXX.../exec
   ```

---

## Paso 5 — Configurar el proyecto React

1. En la carpeta raíz del proyecto, crea un archivo llamado **`.env.local`**
2. Agrega la siguiente línea con la URL copiada en el paso anterior:
   ```env
   VITE_SHEETS_API_URL=https://script.google.com/macros/s/AKfycbxXXXXXXXX.../exec
   ```

---

## Paso 6 — Iniciar el proyecto

```bash
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

Inicia sesión con:
- **Usuario:** `admin`
- **Contraseña:** `admin123`

---

## Estructura de la base de datos

El Spreadsheet tendrá las siguientes hojas:

| Hoja | Descripción |
|------|-------------|
| `WorkOrders` | Órdenes de trabajo |
| `Assets` | Activos/equipos |
| `Locations` | Ubicaciones |
| `Employees` | Empleados/técnicos |
| `PreventiveMaintenance` | Mantenimientos preventivos |
| `MaintenancePlans` | Planes de mantenimiento |
| `PlanActivities` | Actividades de planes |
| `SpareParts` | Refacciones/repuestos |
| `InventoryMovements` | Movimientos de inventario |
| `Companies` | Empresas |
| `Sites` | Sitios/plantas |
| `BusinessUnits` | Unidades de negocio |
| `Processes` | Procesos |
| `AssetSystems` | Sistemas de activos |
| `Components` | Componentes |
| `Services` | Servicios externos |
| `WorkOrderStatusHistory` | Historial de estados de OTs |
| `Users` | Usuarios del sistema |
| Y más... | |

---

## Gestión de usuarios

Para agregar nuevos usuarios, edita directamente la hoja **`Users`** en Google Sheets:

| Campo | Descripción |
|-------|-------------|
| `username` | Nombre de usuario para login |
| `password` | Contraseña en texto plano (se hashea automáticamente) |
| `full_name` | Nombre completo |
| `email` | Correo electrónico |
| `role` | `admin` o `user` |
| `status` | `Activo` o `Inactivo` |

---

## Actualizar el Apps Script

Si necesitas actualizar el código del Apps Script:
1. Ve al proyecto en [script.google.com](https://script.google.com)
2. Actualiza el código
3. Ve a **Implementar → Gestionar implementaciones**
4. Edita la implementación existente y selecciona **Nueva versión**
5. Guarda — la misma URL seguirá funcionando

---

## Solución de problemas

### "API URL no configurada"
- Verifica que el archivo `.env.local` existe en la raíz del proyecto
- Verifica que la variable se llama exactamente `VITE_SHEETS_API_URL`
- Reinicia el servidor dev (`npm run dev`)

### "Error al conectar con el servidor"
- Verifica que el Apps Script está desplegado correctamente
- Verifica que el acceso está configurado como "Cualquier usuario"
- Prueba la URL del Apps Script directamente en el navegador — debería devolver JSON

### "Usuario no encontrado"
- Verifica que la función `initializeSpreadsheet` se ejecutó correctamente
- Revisa la hoja `Users` en el Spreadsheet

---

## Notas importantes

> ⚠️ **Seguridad:** El Apps Script está configurado con acceso público para facilitar la configuración. Para producción, considera implementar autenticación adicional.

> 📊 **Límites:** Google Sheets soporta hasta ~5 millones de celdas por hoja. Para uso empresarial intensivo, considera migrar a una base de datos tradicional.

> 🔄 **Actualizaciones simultáneas:** Google Sheets no soporta transacciones atómicas. Si múltiples usuarios modifican el mismo registro simultáneamente, puede haber conflictos.
