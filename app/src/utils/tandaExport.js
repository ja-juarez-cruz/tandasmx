import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/* =====================================================
   🔧 Helper interno: generar imagen (canvas + blob)
===================================================== */
const generarImagenCalendario = async (elementRef) => {
  console.log('🎨 [1/6] Generando imagen del calendario...');
  
  if (!elementRef?.current) {
    console.error('❌ elementRef.current no está disponible');
    throw new Error('Elemento no disponible para exportar');
  }

  const contenedorScroll =
    elementRef.current.querySelector('.scroll-container');

  const estiloOriginal = {
    maxHeight: contenedorScroll?.style.maxHeight,
    overflowY: contenedorScroll?.style.overflowY
  };

  if (contenedorScroll) {
    contenedorScroll.style.maxHeight = 'none';
    contenedorScroll.style.overflowY = 'visible';
  }

  await new Promise(r => setTimeout(r, 100));

  const canvas = await html2canvas(elementRef.current, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    allowTaint: true,
    windowWidth: elementRef.current.scrollWidth,
    windowHeight: elementRef.current.scrollHeight
  });

  if (contenedorScroll) {
    contenedorScroll.style.maxHeight = estiloOriginal.maxHeight;
    contenedorScroll.style.overflowY = estiloOriginal.overflowY;
  }

  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, 'image/png', 1)
  );

  console.log('✅ [1/6] Imagen generada:', {
    tamaño: `${(blob.size / 1024).toFixed(2)} KB`,
    tipo: blob.type
  });

  return blob;
};

/* =====================================================
   📥 EXPORTAR / DESCARGAR IMAGEN (WEB + APP)
   ✨ Usa Storage Access Framework en Android (sin permisos)
===================================================== */
export const exportarCalendarioComoImagen = async ({
  elementRef,
  fileName
}) => {
  try {
    console.log('🚀 Iniciando exportación de calendario...');
    console.log('📱 Plataforma:', Capacitor.getPlatform());
    console.log('🔌 Es nativo?', Capacitor.isNativePlatform());
    
    const blob = await generarImagenCalendario(elementRef);

    /* ---------- APP ANDROID (Capacitor con SAF) ---------- */
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      console.log('🤖 [2/6] Detectado Android nativo');
      
      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () =>
          resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      console.log('📦 [3/6] Imagen convertida a base64:', {
        caracteres: base64.length,
        primeros50: base64.substring(0, 50) + '...'
      });

      // Intentar usar el plugin nativo de SAF
      const { CalendarExport } = Capacitor.Plugins;
      
      console.log('🧩 [4/6] Verificando plugin CalendarExport:', {
        existe: !!CalendarExport,
        tieneMetodo: !!(CalendarExport && CalendarExport.exportCalendar),
        metodos: CalendarExport ? Object.keys(CalendarExport) : []
      });
      
      if (CalendarExport && CalendarExport.exportCalendar) {
        console.log('✅ [5/6] Plugin disponible, llamando a exportCalendar()...');
        
        try {
          const result = await CalendarExport.exportCalendar({
            imageData: `data:image/png;base64,${base64}`,
            fileName: fileName
          });

          console.log('✅ [6/6] Resultado del plugin:', result);
          return { success: true, platform: 'android-saf', action: 'download', result };
        } catch (pluginError) {
          console.error('❌ Error al llamar al plugin:', pluginError);
          throw pluginError;
        }
      }
      
      // Fallback: guardar archivo temporal y usar Share API
      console.warn('⚠️ [5/6] Plugin no disponible, usando Share con archivo temporal');
      
      try {
        // Guardar el archivo temporalmente en Cache
        const tempFileName = `temp_${Date.now()}_${fileName}`;
        
        console.log('💾 Guardando archivo temporal:', tempFileName);
        
        const writeResult = await Filesystem.writeFile({
          path: tempFileName,
          data: base64,
          directory: Directory.Cache
        });

        console.log('✅ Archivo temporal guardado:', writeResult.uri);

        // Compartir usando la URI del archivo
        await Share.share({
          title: fileName,
          text: 'Calendario de Tanda',
          url: writeResult.uri,
          dialogTitle: 'Guardar calendario'
        });

        // Limpiar archivo temporal después de compartir
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });
          console.log('🗑️ Archivo temporal eliminado');
        } catch (deleteError) {
          console.warn('⚠️ No se pudo eliminar archivo temporal:', deleteError);
        }

        console.log('✅ [6/6] Compartido exitosamente con Share API');
        return { success: true, platform: 'android-share-fallback', action: 'download' };
        
      } catch (shareError) {
        console.error('❌ Error con Share API:', shareError);
        throw new Error('No se pudo exportar: ' + shareError.message);
      }
    }

    /* ---------- APP iOS ---------- */
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      console.log('🍎 [2/6] Detectado iOS nativo');
      
      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () =>
          resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      console.log('📦 [3/6] Guardando en Filesystem...');

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents
      });

      console.log('✅ [4/6] Archivo guardado en Documents');
      return { success: true, platform: 'ios', action: 'download' };
    }

    /* ---------- WEB / PWA ---------- */
    console.log('🌐 [2/6] Detectado navegador web');
    
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    await new Promise(r => setTimeout(r, 100));

    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('✅ [3/6] Descarga iniciada en navegador');
    return { success: true, platform: 'web', action: 'download' };
    
  } catch (error) {
    console.error('❌ Error completo en exportarCalendarioComoImagen:', {
      mensaje: error.message,
      stack: error.stack,
      error: error
    });
    throw error;
  }
};

/* =====================================================
   📤 ENVIAR / COMPARTIR IMAGEN (WEB + APP)
===================================================== */
export const enviarCalendarioComoImagen = async ({
  elementRef,
  fileName,
  mensaje
}) => {
  try {
    console.log('📤 Iniciando compartir calendario...');
    console.log('📱 Plataforma:', Capacitor.getPlatform());
    
    const blob = await generarImagenCalendario(elementRef);

    /* ---------- APP (Capacitor) ---------- */
    if (Capacitor.isNativePlatform()) {
      console.log('📱 [2/5] Detectado app nativa');
      
      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () =>
          resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      console.log('📦 [3/5] Convertido a base64');

      try {
        // Guardar temporalmente para compartir
        const tempFileName = `temp_${Date.now()}_${fileName}`;
        
        const writeResult = await Filesystem.writeFile({
          path: tempFileName,
          data: base64,
          directory: Directory.Cache
        });

        await Share.share({
          title: fileName,
          text: mensaje,
          url: writeResult.uri,
          dialogTitle: 'Compartir calendario'
        });

        // Limpiar
        try {
          await Filesystem.deleteFile({
            path: tempFileName,
            directory: Directory.Cache
          });
        } catch (e) {
          console.warn('No se pudo eliminar temporal');
        }

        console.log('✅ [4/5] Compartido exitosamente');
        return { success: true, platform: 'native', action: 'share' };
      } catch (shareError) {
        console.error('❌ Error al compartir:', shareError);
        throw shareError;
      }
    }

    /* ---------- WEB / PWA (Web Share API) ---------- */
    console.log('🌐 [2/5] Detectado navegador web');
    
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      console.log('✅ [3/5] Web Share API disponible');
      
      try {
        await navigator.share({
          title: fileName,
          text: mensaje,
          files: [file]
        });

        console.log('✅ [4/5] Compartido con Web Share API');
        return { success: true, platform: 'web', action: 'share' };
      } catch (shareError) {
        console.error('❌ Error con Web Share API:', shareError);
        throw shareError;
      }
    }

    /* ---------- Fallback WEB: descarga + WhatsApp ---------- */
    console.log('⚠️ [3/5] Web Share API no disponible, usando fallback');
    
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    await new Promise(r => setTimeout(r, 100));

    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
      mensaje + '\n\n📥 La imagen se descargó, adjúntala en el chat.'
    )}`;

    window.open(whatsappUrl, '_blank');

    console.log('✅ [5/5] Descarga + WhatsApp iniciados');
    return {
      success: true,
      platform: 'web',
      action: 'download+whatsapp'
    };
    
  } catch (error) {
    console.error('❌ Error completo en enviarCalendarioComoImagen:', {
      mensaje: error.message,
      stack: error.stack,
      error: error
    });
    throw error;
  }
};