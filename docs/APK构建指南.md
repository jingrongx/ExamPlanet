# 考证星球 · Android APK 构建指南

本仓库已完成 Capacitor + Android 工程配置，可直接打包成 Android APK。沙箱环境网络受限无法在这里完成最终 APK 编译，请在本地按以下步骤操作（约 5-10 分钟）。

## 一、环境准备（一次性）

### 必装
- **Android Studio**（Ladybug 或更新版本）：https://developer.android.com/studio
  - 安装时勾选：Android SDK、Android SDK Platform、Android Virtual Device
- **JDK 17**（Android Gradle Plugin 8.x 要求）：`brew install openjdk@17` 或下载 Temurin 17

### 验证
```bash
java -version          # 应显示 17.x
echo $ANDROID_HOME     # 应指向 SDK 目录，如 ~/Library/Android/sdk
```

## 二、构建 APK（三选一）

### 方式 A：命令行一键构建（推荐）

```bash
# 在项目根目录
npm install
npm run apk:debug      # 构建 debug APK（可直接安装测试）
```

构建成功后，APK 位于：
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 方式 B：Android Studio 图形化构建

```bash
npx cap open android   # 用 Android Studio 打开 android 工程
```

在 Android Studio 中：
1. 等待 Gradle Sync 完成（首次会下载依赖，约 2-5 分钟）
2. 菜单 `Build → Build Bundle(s) / APK(s) → Build APK(s)`
3. 完成后点通知栏 `locate` 找到 APK

### 方式 C：发布 Release 版（上架前）

```bash
# 1. 生成签名 keystore（首次）
keytool -genkey -v -keystore cert-planet.keystore -alias certplanet -keyalg RSA -keysize 2048 -validity 10000

# 2. 配置签名（编辑 android/app/build.gradle 的 signingConfigs）

# 3. 构建 release APK
npm run apk:release
```

APK 位于：`android/app/build/outputs/apk/release/app-release.apk`

## 三、安装到手机

### 方式 A：ADB 安装
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 方式 B：直接传输
把 APK 文件传到手机（微信/QQ/USB），点击安装（需开启"允许未知来源应用"）。

## 四、日常开发流程

修改 Web 代码后，同步到 Android 工程：

```bash
npm run cap:sync       # 构建 Web + 同步到 android
npx cap run android    # 同步并直接安装到连接的设备/模拟器
```

## 五、应用信息

| 项 | 值 |
|---|---|
| 应用 ID | `com.certplanet.app` |
| 应用名 | 考证星球 |
| minSdk | 24 (Android 7.0) |
| targetSdk | 36 (Android 16) |
| 已集成插件 | StatusBar / SplashScreen / App / Haptics / Preferences |

## 六、上架应用商店

### 应用宝 / 华为 / 小米等国内商店
1. 注册开发者账号
2. 上传 release APK + 应用图标 + 截图
3. 等待审核（通常 1-3 天）

### Google Play（需海外账号）
1. 注册 Google Play Console（$25 一次性）
2. 上传 `.aab`（App Bundle，非 APK）：
   ```bash
   cd android && ./gradlew bundleRelease
   ```
3. 生成的 `.aab` 在 `android/app/build/outputs/bundle/release/app-release.aab`

## 七、常见问题

**Q: Gradle 构建报 `Unsupported class file major version`**
A: JDK 版本不对，确保用 JDK 17，不要用 JDK 21/25。

**Q: Gradle 下载慢**
A: 编辑 `android/build.gradle`，把仓库换成阿里云镜像（本仓库已配置）。

**Q: 3D 场景在旧手机上卡顿**
A: Three.js 需要硬件加速 WebGL，老旧设备可能降级到 2D 模式（已内置错误边界自动降级）。

**Q: 想要原生功能（推送、相机等）**
A: 安装对应 Capacitor 插件，如 `npm install @capacitor/push-notifications`，然后 `npx cap sync`。
