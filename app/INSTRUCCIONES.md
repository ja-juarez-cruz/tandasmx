# 📋 INSTRUCCIONES DE INSTALACIÓN - ADMINISTRADOR DE TANDAS

## 📁 PASO 1: Crear la Estructura de Carpetas

Crea una carpeta llamada `tanda-manager` y dentro de ella crea la siguiente estructura:

```
tanda-manager/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 📄 PASO 2: Copiar los Archivos

He generado 9 archivos numerados. Copia el contenido de cada uno a su ubicación correspondiente:

### Archivos en la raíz del proyecto:
1. **1-package.json** → Copiar a: `package.json`
2. **2-vite.config.js** → Copiar a: `vite.config.js`
3. **3-tailwind.config.js** → Copiar a: `tailwind.config.js`
4. **4-postcss.config.js** → Copiar a: `postcss.config.js`
5. **5-index.html** → Copiar a: `index.html`

### Archivos en la carpeta src/:
6. **6-src-main.jsx** → Copiar a: `src/main.jsx`
7. **7-src-index.css** → Copiar a: `src/index.css`
8. **8-src-App.jsx** → Copiar a: `src/App.jsx`

## 🚀 PASO 3: Instalar y Ejecutar

### Requisito previo:
- Debes tener **Node.js** instalado (versión 16 o superior)
- Descarga desde: https://nodejs.org/

### En Windows:
1. Abre el **Símbolo del sistema** o **PowerShell**
2. Navega a la carpeta del proyecto:
   ```cmd
   cd ruta\a\tanda-manager
   ```
3. Instala las dependencias (solo la primera vez):
   ```cmd
   npm install
   ```
4. Inicia la aplicación:
   ```cmd
   npm run dev
   ```

### En Mac/Linux:
1. Abre la **Terminal**
2. Navega a la carpeta del proyecto:
   ```bash
   cd ruta/a/tanda-manager
   ```
3. Instala las dependencias (solo la primera vez):
   ```bash
   npm install
   ```
4. Inicia la aplicación:
   ```bash
   npm run dev
   ```

## 🌐 PASO 4: Abrir en el Navegador

La aplicación se abrirá automáticamente en:
```
http://localhost:3000
```

Si no se abre, copia esta URL y pégala en tu navegador.

## 🔐 PASO 5: Iniciar Sesión

**Contraseña de administrador:** `admin123`

## 📱 CÓMO FUNCIONA LA APP

### Para el Administrador:

1. **Configuración**
   - Personaliza el nombre de tu tanda
   - Define el monto por ronda
   - Establece el número total de rondas

2. **Gestión de Participantes**
   - Agrega participantes con nombre, teléfono y número asignado
   - Edita o elimina participantes

3. **Control de Pagos**
   - Marca los pagos recibidos por cada ronda
   - Visualiza quién está al corriente y quién está atrasado

4. **Envío de Recordatorios**
   - Selecciona participantes
   - Envía recordatorios por WhatsApp
   - Personaliza el mensaje

5. **Compartir Tablero Público**
   - Haz clic en "Compartir Tablero" (botón verde)
   - Se copiará una URL única
   - Envía este link a todos los participantes

### Para los Participantes:

1. Abren el link compartido por el administrador
2. Ven el tablero público con:
   - Monto por ronda
   - Ronda actual
   - Próximo número
   - Estado de todos los participantes (sin poder modificar nada)

## 🔒 URLs del Sistema

- **Panel de Administración:** `http://localhost:3000`
- **Tablero Público:** `http://localhost:3000?tanda=abc123xyz`
  (El ID único se genera automáticamente)

## ⚙️ Personalización Rápida

### Cambiar la Contraseña:
Edita el archivo `src/App.jsx` y busca la línea:
```javascript
if (password === 'admin123') {
```
Cambia `'admin123'` por tu contraseña deseada.

### Cambiar Colores:
En `src/App.jsx`, busca y reemplaza:
- `from-orange-500 to-rose-500` → Por otros colores de Tailwind
- `bg-orange-50` → Fondos suaves
- `border-orange-200` → Bordes

Opciones de colores: blue, green, purple, pink, indigo, cyan, etc.

## 🛑 Detener el Servidor

Presiona `Ctrl + C` en la terminal donde está corriendo el servidor.

## 📦 Construir para Producción

Si quieres crear una versión optimizada:
```bash
npm run build
```

Los archivos se generarán en la carpeta `dist/`

## 🌍 Publicar en Internet

Servicios gratuitos recomendados:

### Vercel (Recomendado):
1. Sube tu proyecto a GitHub
2. Ve a https://vercel.com
3. Conecta tu repositorio
4. Vercel detectará que es un proyecto Vite
5. Haz clic en "Deploy"

### Netlify:
1. Arrastra la carpeta `dist/` a https://app.netlify.com/drop
2. Tu app estará online en segundos

## ⚠️ Solución de Problemas

### "npm no se reconoce como comando"
- Instala Node.js desde https://nodejs.org/
- Reinicia la terminal después de instalarlo

### "Error al instalar dependencias"
- Verifica tu conexión a internet
- Intenta: `npm cache clean --force`
- Luego: `npm install` nuevamente

### "El puerto 3000 está en uso"
- Cierra otras aplicaciones que usen ese puerto
- O edita `vite.config.js` y cambia el puerto a `3001`

### "La aplicación no carga"
- Abre la consola del navegador (F12)
- Revisa los errores
- Asegúrate de que todas las dependencias se instalaron

### "Los datos no se guardan"
- No uses modo incógnito/privado
- Verifica que localStorage esté habilitado en tu navegador

## 💡 Consejos de Uso

1. ✅ Actualiza los pagos semanalmente
2. ✅ Envía recordatorios 2-3 días antes del vencimiento
3. ✅ Comparte el tablero público para transparencia
4. ✅ Haz respaldos exportando los datos importantes
5. ✅ Usa nombres claros para identificar participantes fácilmente

## 🆘 Soporte

Para más información consulta:
- Documentación de React: https://react.dev
- Documentación de Vite: https://vitejs.dev
- Documentación de Tailwind: https://tailwindcss.com

---

## 📝 Resumen de Comandos

```bash
# Instalar dependencias (primera vez)
npm install

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build

# Vista previa de producción
npm run preview
```

---

¡Disfruta administrando tus tandas de forma profesional! 🎉
