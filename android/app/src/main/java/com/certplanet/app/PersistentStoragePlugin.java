package com.certplanet.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

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
 * - Android 10 (API 29) 及以下：用 File API 直接写 Environment.DIRECTORY_DOCUMENTS
 *   （需 WRITE_EXTERNAL_STORAGE 权限，已在 AndroidManifest 声明 maxSdkVersion=29）
 * - Android 11 (API 30) 及以上：用 MediaStore API 写公共 Documents 目录
 *   （无需权限，app 卸载后文件保留，重装后通过 MediaStore 查询读取）
 *
 * 文件路径：/storage/emulated/0/Documents/cert-planet/cert-planet-save.json
 */
@CapacitorPlugin(name = "PersistentStorage")
public class PersistentStoragePlugin extends Plugin {

    private static final String DIR_NAME = "cert-planet";
    private static final String FILE_NAME = "cert-planet-save.json";

    /**
     * 读取存档：优先用 MediaStore（Android 11+），降级用 File API（Android 10-）
     */
    @PluginMethod
    public void read(PluginCall call) {
        try {
            String content = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                content = readViaMediaStore();
            }
            // MediaStore 读不到或 Android 10-，降级用 File API
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
            call.reject("read failed: " + e.getMessage());
        }
    }

    /**
     * 写入存档：Android 11+ 用 MediaStore，Android 10- 用 File API
     */
    @PluginMethod
    public void write(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("value is required");
            return;
        }
        try {
            boolean ok;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                ok = writeViaMediaStore(value);
            } else {
                ok = writeViaFile(value);
            }
            if (ok) {
                call.resolve();
            } else {
                call.reject("write failed");
            }
        } catch (Exception e) {
            call.reject("write failed: " + e.getMessage());
        }
    }

    // ============ MediaStore 方案（Android 11+） ============

    private String readViaMediaStore() {
        try {
            Context c = getContext();
            ContentResolver resolver = c.getContentResolver();
            Uri collection = MediaStore.Files.getContentUri("external");
            // 查询 app 自己创建的 cert-planet-save.json
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
            android.util.Log.w("PersistentStorage", "readViaMediaStore failed", e);
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
                            // 先尝试删除旧文件
                            try {
                                resolver.delete(uri, null, null);
                            } catch (Exception e) {
                                android.util.Log.w("PersistentStorage", "delete old failed", e);
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
            android.util.Log.w("PersistentStorage", "writeViaMediaStore failed", e);
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
            android.util.Log.w("PersistentStorage", "readViaFile failed", e);
            return null;
        }
    }

    private boolean writeViaFile(String value) {
        try {
            File dir = new File(Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOCUMENTS), DIR_NAME);
            if (!dir.exists() && !dir.mkdirs()) {
                return false;
            }
            File file = new File(dir, FILE_NAME);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(value.getBytes("UTF-8"));
                fos.flush();
            }
            return true;
        } catch (Exception e) {
            android.util.Log.w("PersistentStorage", "writeViaFile failed", e);
            return false;
        }
    }
}
