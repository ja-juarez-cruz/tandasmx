package tanda.app.mx;

import android.net.Uri;
import android.util.Base64;
import android.util.Log;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "CalendarExport")
public class CalendarExportPlugin extends Plugin {
    
    private static final String TAG = "CalendarExport";  // 👈 Tag para logs
    
    private ActivityResultLauncher<String> createDocument;
    private String pendingBase64Image;
    private PluginCall pendingCall;
    
    @Override
    public void load() {
        Log.d(TAG, "🔌 Plugin CalendarExport cargado");  // 👈 Log
        
        createDocument = getActivity().registerForActivityResult(
            new ActivityResultContracts.CreateDocument("image/png"),
            uri -> {
                Log.d(TAG, "📂 Resultado del selector: " + uri);  // 👈 Log
                
                if (uri != null && pendingBase64Image != null && pendingCall != null) {
                    saveImageToUri(uri, pendingBase64Image, pendingCall);
                } else if (pendingCall != null) {
                    Log.w(TAG, "⚠️ Usuario canceló la selección");  // 👈 Log
                    pendingCall.reject("Usuario canceló la selección");
                    pendingCall = null;
                }
            }
        );
    }
    
    @PluginMethod
    public void exportCalendar(PluginCall call) {
        Log.d(TAG, "📸 exportCalendar() llamado");  // 👈 Log
        
        String imageData = call.getString("imageData");
        String fileName = call.getString("fileName", "calendario.png");
        
        Log.d(TAG, "📄 Nombre de archivo: " + fileName);  // 👈 Log
        
        if (imageData == null || imageData.isEmpty()) {
            Log.e(TAG, "❌ imageData está vacío");  // 👈 Log
            call.reject("imageData es requerido");
            return;
        }
        
        if (imageData.contains(",")) {
            imageData = imageData.split(",")[1];
        }
        
        Log.d(TAG, "📊 Tamaño de base64: " + imageData.length() + " caracteres");  // 👈 Log
        
        pendingBase64Image = imageData;
        pendingCall = call;
        
        getActivity().runOnUiThread(() -> {
            Log.d(TAG, "🚀 Abriendo selector de archivos...");  // 👈 Log
            createDocument.launch(fileName);
        });
    }
    
    private void saveImageToUri(Uri uri, String base64Data, PluginCall call) {
        Log.d(TAG, "💾 Guardando imagen en: " + uri);  // 👈 Log
        
        try {
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
            
            Log.d(TAG, "📦 Tamaño de imagen: " + imageBytes.length + " bytes");  // 👈 Log
            
            OutputStream outputStream = getActivity()
                .getContentResolver()
                .openOutputStream(uri);
            
            if (outputStream != null) {
                outputStream.write(imageBytes);
                outputStream.flush();
                outputStream.close();
                
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("uri", uri.toString());
                call.resolve(result);
                
                Log.i(TAG, "✅ Imagen guardada exitosamente");  // 👈 Log
            } else {
                Log.e(TAG, "❌ No se pudo abrir el stream de salida");  // 👈 Log
                call.reject("No se pudo abrir el stream de salida");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error guardando imagen: " + e.getMessage(), e);  // 👈 Log
            call.reject("Error: " + e.getMessage());
        } finally {
            pendingBase64Image = null;
            pendingCall = null;
        }
    }
}