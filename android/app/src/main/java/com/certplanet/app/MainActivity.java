package com.certplanet.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;

import androidx.appcompat.app.AlertDialog;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQ_STORAGE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PersistentStoragePlugin.class);
        super.onCreate(savedInstanceState);
        // 强制要求存储权限：没权限不允许使用 app
        // Android 11+ 用 Scoped Storage 不需要权限
        ensureStoragePermission();
    }

    private void ensureStoragePermission() {
        // Android 11+ 不需要权限
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.Q) {
            return;
        }
        if (hasStoragePermission()) {
            return;
        }
        // 没权限，请求
        ActivityCompat.requestPermissions(this,
                new String[]{
                        Manifest.permission.WRITE_EXTERNAL_STORAGE,
                        Manifest.permission.READ_EXTERNAL_STORAGE
                }, REQ_STORAGE);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_STORAGE) return;
        boolean granted = grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) return;

        // 用户拒绝授权
        boolean canRetry = ActivityCompat.shouldShowRequestPermissionRationale(
                this, Manifest.permission.WRITE_EXTERNAL_STORAGE);
        if (canRetry) {
            // 没选"不再询问"，可以再次请求
            new AlertDialog.Builder(this)
                    .setTitle("必须授权存储权限")
                    .setMessage("存储权限用于保存您的学习进度，卸载重装也不丢失数据。\n\n必须授权才能使用本软件。")
                    .setPositiveButton("重新授权", (d, w) -> ensureStoragePermission())
                    .setNegativeButton("退出", (d, w) -> finish())
                    .setCancelable(false)
                    .show();
        } else {
            // 用户选了"不再询问"，跳转到应用设置页让用户手动开启
            new AlertDialog.Builder(this)
                    .setTitle("必须授权存储权限")
                    .setMessage("存储权限用于保存您的学习进度，卸载重装也不丢失数据。\n\n您之前选择了不再询问，请到设置中手动开启存储权限。")
                    .setPositiveButton("去设置", (d, w) -> {
                        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        intent.setData(Uri.parse("package:" + getPackageName()));
                        startActivity(intent);
                        finish();
                    })
                    .setNegativeButton("退出", (d, w) -> finish())
                    .setCancelable(false)
                    .show();
        }
    }

    private boolean hasStoragePermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED;
    }
}
