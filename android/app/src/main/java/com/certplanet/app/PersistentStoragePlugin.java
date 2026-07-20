package com.certplanet.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
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
 * 持久化存储插件：双层存储保证数据不丢
 *
 * 1. SharedPreferences（commit 同步写入）：app 被划掉/杀死时数据不丢
 * 2. Documents 文件（MediaStore/File API）：app 卸载重装数据不丢
 *
 * 读取顺序：Documents → SharedPreferences
 * 写入顺序：SharedPreferences(commit) → Documents
 *
 * 文件路径：/storage/emulated/0/Documents/cert-planet/cert-planet-save.json
 * SharedPreferences：cert-planet-backup.xml
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
    private static final String PREFS_NAME = "cert-planet-backup";
    private static final String PREFS_KEY = "value";

    /**
     * 检查存储权限状态（不请求权限，权限由 MainActivity 处理）
     */
    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ret.put("granted", true);
        } else {
            ret.put("granted", hasStoragePermission());
        }
        call.resolve(ret);
    }

    /**
     * 读取存档：
     * 1. 优先读 Documents（卸载重装后能恢复）
     * 2. Documents 读不到，读 SharedPreferences（app 被杀死后能恢复）
     */
    @PluginMethod
    public void read(PluginCall call) {
        try {
            String content = null;
            // 1. 优先读 Documents
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                content = readViaMediaStore();
            }
            if (content == null) {
                content = readViaFile();
            }
            // 2. Documents 读不到，读 SharedPreferences
            if (content == null) {
                content = readViaPrefs();
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
     * 写入存档：
     * 1. 先同步写入 SharedPreferences(commit)，保证 app 被划掉/杀死时数据不丢
     * 2. 再写入 Documents，保证 app 卸载重装数据不丢
     *
     * commit() 是同步的，会阻塞当前线程直到写入磁盘完成
     * 这确保了即使 app 在 write 返回前被杀死，SharedPreferences 也已经写入磁盘
     */
    @PluginMethod
    public void write(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("value is required");
            return;
        }
        try {
            // 1. 同步写入 SharedPreferences（commit，保证 app 被杀死时数据不丢）
            boolean prefsOk = writeViaPrefs(value);
            if (!prefsOk) {
                android.util.Log.w(TAG, "writeViaPrefs failed");
            }

            // 2. 写入 Documents（保证卸载重装数据不丢）
            boolean docsOk = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                docsOk = writeViaMediaStore(value);
            } else if (hasStoragePermission()) {
                docsOk = writeViaFile(value);
            }
            if (!docsOk) {
                android.util.Log.w(TAG, "writeViaDocuments failed, but SharedPreferences already saved");
            }

            // 只要 SharedPreferences 写入成功就认为成功（Documents 失败不影响 app 运行）
            if (prefsOk) {
                call.resolve();
            } else {
                call.reject("write failed: SharedPreferences commit failed");
            }
        } catch (Exception e) {
            android.util.Log.w(TAG, "write failed", e);
            call.reject("write failed: " + e.getMessage());
        }
    }

    /**
     * 强制同步存档：app 进入后台时调用，确保最新数据写入磁盘
     * 读取最新的存档值并重新写入 SharedPreferences 和 Documents
     */
    @PluginMethod
    public void flush(PluginCall call) {
        try {
            // 读取最新的存档值
            String content = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                content = readViaMediaStore();
            }
            if (content == null) {
                content = readViaFile();
            }
            if (content == null) {
                content = readViaPrefs();
            }
            if (content != null) {
                // 重新写入，确保磁盘数据是最新的
                writeViaPrefs(content);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    writeViaMediaStore(content);
                } else if (hasStoragePermission()) {
                    writeViaFile(content);
                }
            }
            call.resolve();
        } catch (Exception e) {
            android.util.Log.w(TAG, "flush failed", e);
            call.reject("flush failed: " + e.getMessage());
        }
    }

    private boolean hasStoragePermission() {
        return ContextCompat.checkSelfPermission(getContext(),
                Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    // ============ SharedPreferences 方案（同步 commit，app 被杀死时数据不丢） ============

    private String readViaPrefs() {
        try {
            SharedPreferences prefs = getContext()
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            return prefs.getString(PREFS_KEY, null);
        } catch (Exception e) {
            android.util.Log.w(TAG, "readViaPrefs failed", e);
            return null;
        }
    }

    private boolean writeViaPrefs(String value) {
        try {
            SharedPreferences prefs = getContext()
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            // commit() 同步写入磁盘，保证 app 被杀死时数据不丢
            return prefs.edit().putString(PREFS_KEY, value).commit();
        } catch (Exception e) {
            android.util.Log.w(TAG, "writeViaPrefs failed", e);
            return false;
        }
    }

    // ============ MediaStore 方案（Android 11+，卸载重装数据不丢） ============

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
