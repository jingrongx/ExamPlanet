package com.certplanet.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;

/**
 * 持久化存储插件：把存档 JSON 写到公共 Documents 目录，卸载重装不丢数据。
 *
 * 实现方案：
 * - Android 11 (API 30) 及以上：用 MediaStore API 写公共 Documents 目录
 *   无需任何权限，app 卸载后文件保留，重装后通过 MediaStore 查询自动恢复
 * - Android 10 (API 29) 及以下：用 File API 直接写 Environment.DIRECTORY_DOCUMENTS
 *   需 WRITE_EXTERNAL_STORAGE 运行时权限
 *   权限请求由 MainActivity.onCreate 主动触发（ActivityCompat.requestPermissions）
 *   本插件只负责读写，不负责请求权限
 *
 * 文件路径：/storage/emulated/0/Documents/cert-planet/cert-planet-save.json
 */
@CapacitorPlugin(
    name = "PersistentStorage",
    permissions = {
        @Permission(
            alias = "storage",
            strings = {
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
        )
    }
)
public class PersistentStoragePlugin extends Plugin {

    private static final String DIR_NAME = "cert-planet";
    private static final String FILE_NAME = "cert-planet-save.json";
    private static final String TAG = "PersistentStorage";

    /**
     * 检查存储权限状态（不请求权限）
     * 权限请求由 MainActivity.onCreate 处理
     * JS 端通过循环调用此方法等待用户授权
     */
    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        JSObject ret = new JSObject();
        // Android 11+ 不需要权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ret.put("granted", true);
        } else {
            // Android 10- 检查权限是否已授权
            ret.put("granted", hasStoragePermission());
        }
        call.resolve(ret);
    }

    /**
     * 读取存档：
     * - Android 10+：优先用 MediaStore（无需权限，重装后也能读）
     * - 降级用 File API（需要权限，Android 10 重装后可能读不到）
     */
    @PluginMethod
    public void read(PluginCall call) {
        try {
            String content = null;
            // Android 10+ 用 MediaStore 读取（无需权限）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                content = readViaMediaStore();
            }
            // MediaStore 读不到或老版本，降级用 File API
            if (content == null) {
                content = readViaFile();
            }
            if (content != null) {
                JSObject ret = new JSObject();
                ret.put("value", content);
                call.resolve(ret);
            } else {
                call.resolve(new JSObject());
            }
        } catch (Exception e) {
            android.util.Log.w(TAG, "read failed", e);
            call.reject("read failed: " + e.getMessage());
        }
    }

    /**
     * 写入存档：Android 11+ 用 MediaStore，Android 10- 用 File API
     * Android 10- 需要 WRITE_EXTERNAL_STORAGE 权限
     * 如果没权限会 reject，JS 端降级到 Preferences 备份
     */
    @PluginMethod
    public void write(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("value is required");
            return;
        }
        try {
            // Android 11+ 直接用 MediaStore（无需权限）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                boolean ok = writeViaMediaStore(value);
                if (ok) {
                    call.resolve();
                } else {
                    call.reject("write failed");
                }
                return;
            }
            // Android 10- 检查 WRITE_EXTERNAL_STORAGE 权限
            if (!hasStoragePermission()) {
                android.util.Log.w(TAG, "write rejected: no storage permission");
                call.reject("permission denied");
                return;
            }
            boolean ok = writeViaFile(value);
            if (ok) {
                call.resolve();
            } else {
                call.reject("write failed");
            }
        } catch (Exception e) {
            android.util.Log.w(TAG, "write failed", e);
            call.reject("write failed: " + e.getMessage());
        }
    }

    /**
     * 检查是否有外部存储写入权限
     */
    private boolean hasStoragePermission() {
        return ContextCompat.checkSelfPermission(getContext(),
                Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    // ============ MediaStore 方案（Android 11+） ============

    private String readViaMediaStore() {
        try {
            Context c = getContext();
            ContentResolver resolver = c.getContentResolver();
            Uri collection = MediaStore.Files.getContentUri("external");
            String selection = MediaStore.Files.FileColumns.RELATIVE_PATH + " LIKE ? AND "
                    + MediaStore.Files.FileColumns.DISPLAY_NAME + " = ?";
            String[] selectionArgs = new String[]{
                    Environment.DIRECTORY_DOCUMENTS + "/" + DIR_NAME + "/",
                    FILE_NAME,
            };
            try (android.database.Cursor cursor = resolver.query(
                    collection, null, selection, selectionArgs, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int idCol = cursor.getColumnIndex(MediaStore.Files.FileColumns._ID);
                    if (idCol >= 0) {
                        long id = cursor.getLong(idCol);
                        Uri uri = android.content.ContentUris.withAppendedId(collection, id);
                        StringBuilder sb = new StringBuilder();
                        try (InputStream is = resolver.openInputStream(uri)) {
                            if (is == null) return null;
                            BufferedReader reader = new BufferedReader(new InputStreamReader(is, "UTF-8"));
                            String line;
                            while ((line = reader.readLine()) != null) {
                                if (sb.length() > 0) sb.append('\n');
                                sb.append(line);
                            }
                        }
                        return sb.toString();
                    }
                }
            }
            return null;
        } catch (Exception e) {
            android.util.Log.w(TAG, "readViaMediaStore failed", e);
            return null;
        }
    }

    private boolean writeViaMediaStore(String value) {
        try {
            Context c = getContext();
            ContentResolver resolver = c.getContentResolver();
            Uri collection = MediaStore.Files.getContentUri("external");

            // 先查询是否已有该文件，有则删除（MediaStore 不支持直接覆盖）
            String selection = MediaStore.Files.FileColumns.RELATIVE_PATH + " LIKE ? AND "
                    + MediaStore.Files.FileColumns.DISPLAY_NAME + " = ?";
            String[] selectionArgs = new String[]{
                    Environment.DIRECTORY_DOCUMENTS + "/" + DIR_NAME + "/",
                    FILE_NAME,
            };
            try (android.database.Cursor cursor = resolver.query(
                    collection, null, selection, selectionArgs, null)) {
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        int idCol = cursor.getColumnIndex(MediaStore.Files.FileColumns._ID);
                        if (idCol >= 0) {
                            long id = cursor.getLong(idCol);
                            Uri uri = android.content.ContentUris.withAppendedId(collection, id);
                            try {
                                resolver.delete(uri, null, null);
                            } catch (Exception e) {
                                android.util.Log.w(TAG, "delete old failed", e);
                            }
                        }
                    }
                }
            }

            // 插入新文件
            ContentValues values = new ContentValues();
            values.put(MediaStore.Files.FileColumns.DISPLAY_NAME, FILE_NAME);
            values.put(MediaStore.Files.FileColumns.MIME_TYPE, "application/json");
            values.put(MediaStore.Files.FileColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOCUMENTS + "/" + DIR_NAME);

            Uri uri = resolver.insert(collection, values);
            if (uri == null) return false;

            try (OutputStream os = resolver.openOutputStream(uri, "w")) {
                if (os == null) return false;
                os.write(value.getBytes("UTF-8"));
                os.flush();
            }
            return true;
        } catch (Exception e) {
            android.util.Log.w(TAG, "writeViaMediaStore failed", e);
            return false;
        }
    }

    // ============ File API 方案（Android 10 及以下） ============

    private String readViaFile() {
        try {
            File dir = new File(Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOCUMENTS), DIR_NAME);
            File file = new File(dir, FILE_NAME);
            if (!file.exists()) return null;
            StringBuilder sb = new StringBuilder();
            try (FileInputStream fis = new FileInputStream(file);
                 BufferedReader reader = new BufferedReader(
                         new InputStreamReader(fis, "UTF-8"))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (sb.length() > 0) sb.append('\n');
                    sb.append(line);
                }
            }
            return sb.toString();
        } catch (Exception e) {
            android.util.Log.w(TAG, "readViaFile failed", e);
            return null;
        }
    }

    private boolean writeViaFile(String value) {
        try {
            File dir = new File(Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOCUMENTS), DIR_NAME);
            if (!dir.exists() && !dir.mkdirs()) {
                android.util.Log.w(TAG, "mkdirs failed: " + dir.getAbsolutePath());
                return false;
            }
            File file = new File(dir, FILE_NAME);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(value.getBytes("UTF-8"));
                fos.flush();
            }
            android.util.Log.i(TAG, "writeViaFile ok: " + file.getAbsolutePath());
            return true;
        } catch (Exception e) {
            android.util.Log.w(TAG, "writeViaFile failed", e);
            return false;
        }
    }
}
