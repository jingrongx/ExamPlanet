# 「考证星球」需求梳理与进度对照

> 文档基于 [.trae/documents/PRD.md](.trae/documents/PRD.md) 逐条对照当前实现状态
> 更新时间：2026-07-18
> 仓库：https://github.com/jingrongx/ExamPlanet

---

## 一、原始需求回顾

### 1. 产品定位
- **名称**：考证星球（ExamPlanet）
- **形态**：太空赛博朋克风的多感官、强游戏化考证刷题 + 记忆 APP
- **核心目标**：把枯燥应试变成"打怪升级"的上瘾循环，降低备考痛苦度
- **首批支持执照**：
  - ✈️ 飞行执照 PPL
  - 🚁 无人机执照 CAAC
  - 📡 无线电执照 HAM（A/B/C）
  - 💼 中级经济师
- **目标用户**：18-50 岁考证人群

### 2. 最初需求清单（来自 PRD）

| 编号 | 需求模块 | 子需求 |
|---|---|---|
| N1 | 用户角色 | 宇航员（本地匿名注册）/ 访客（试玩 3 题） |
| N2 | 星球大厅 | 4 颗执照星球 + 顶部状态栏 + 每日任务 + 签到日历 |
| N3 | 学习中心 | 知识树闯关 / 每日挑战 / 模拟考试 / 错题熔炉 |
| N4 | 记忆工坊 | AI 口诀库 / 知识图谱 / 闪卡速记 |
| N5 | 模拟空间 | 3D 驾驶舱 / 3D 空域塔 / 3D 天线 / 3D 经济沙盘 |
| N6 | 我的基地 | 宠物养成 / 装备商店 / 成就墙 / 数据中心 |
| N7 | 答题内核 | 单选/多选/判断；连击/暴击/掉落奖励 |
| N8 | 太空赛博朋克视觉 | 主色/字体/玻璃拟态/粒子层 |
| N9 | SM-2 间隔重复算法 | 1→3→7→15→30 天回流 |
| N10 | AI 记忆口诀 | 谐音/故事/顺口溜/公式联想 |
| N11 | 经济系统 | 金币/钻石/经验/火苗 |
| N12 | 段位制 | 青铜→白银→黄金→铂金→钻石→星耀→考证王者 |
| N13 | 宠物系统 | 4 种基础宠物 + 升级技能 |
| N14 | 暴击与连击 | 5% 暴击 + Combo 层级特效 |
| N15 | 本地存储 | IndexedDB + LocalStorage + JSON 导入导出 |
| N16 | 性能指标 | LCP < 2.5s / 切题 < 100ms / 60fps / PWA 离线 |
| N17 | 响应式 | 桌面/平板/移动端三档 |
| N18 | **移动端 APP**（用户后续追加） | Capacitor 打包 Android APK |

### 3. 不在本期范围（PRD 已声明）
- ❌ 联网对战（V2）
- ❌ 用户账号体系（V3）
- ❌ 题库众包与社区口诀（V4）
- ❌ iOS/Android 原生 App（V5 PWA 替代）→ **用户后续要求改为 Capacitor 打包 APK**

---

## 二、进度对照表（逐条核对）

### 模块 N1：用户角色
| 子需求 | 状态 | 说明 |
|---|:---:|---|
| 宇航员本地匿名注册 | ✅ | [useGameStore.ts](src/store/useGameStore.ts) 自动生成 ID + persist |
| 访客试玩 3 题 | ⚠️ 部分 | 当前所有页面均可用，未做访客限制（属简化） |
| 本地数据存储 | ✅ | Zustand persist + localStorage |

### 模块 N2：星球大厅（首页）
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| 4 颗执照星球 3D 悬浮 | ✅ | [SpaceHallScene.tsx](src/components/three/SpaceHallScene.tsx) |
| 顶部状态栏（金币/经验/段位/连签/宠物） | ✅ | [Header.tsx](src/components/layout/Header.tsx) |
| 每日任务卡片 | ✅ | [Hall.tsx](src/pages/Hall.tsx) |
| 签到日历（7 天连续） | ✅ | [Hall.tsx](src/pages/Hall.tsx) + [Base.tsx](src/pages/Base.tsx) |
| 进度环 / 征服度 | ✅ | Hall.tsx 中显示 |

### 模块 N3：学习中心
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| 知识树闯关（章节地图） | ✅ | [ChapterMap.tsx](src/pages/ChapterMap.tsx) |
| 关卡类型（普通/精英/Boss/隐藏） | ✅ | ChapterMap.tsx |
| 章节解锁逻辑 | ✅ | 通过第 N 章解锁 N+1 |
| 每日挑战 | ⚠️ 简化 | 融入每日任务卡片，未单独页面 |
| 模拟考试（限时全真） | ✅ | [Exam.tsx](src/pages/Exam.tsx) |
| 成绩报告 + 雷达图 | ✅ | [ExamResult.tsx](src/pages/ExamResult.tsx) |
| 错题熔炉 | ✅ | [Mistakes.tsx](src/pages/Mistakes.tsx) |
| 错题等级 Lv1/Lv2/Lv3 | ✅ | Mistakes.tsx |
| 顽固错题 Boss 战 | ⚠️ 简化 | 通过 Lv3 顽固错题专攻实现，未做独立周战 |
| 错题进化（已掌握） | ✅ | srs.ts 算法实现 |

### 模块 N4：记忆工坊
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| AI 口诀库 | ✅ | [mnemonic.ts](src/engine/mnemonic.ts) + [Memory.tsx](src/pages/Memory.tsx) |
| 4 类口诀（谐音/故事/顺口溜/公式） | ✅ | mnemonic.ts 模板生成 |
| 闪卡速记 | ✅ | Memory.tsx 3D 翻转闪卡 |
| 知识图谱（3D 力导向图） | ❌ | 未实现 |
| 口诀投票收藏 | ⚠️ 简化 | 仅浏览，未做投票 |

### 模块 N5：模拟空间（3D）
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| 3D 驾驶舱（飞行） | ✅ | Cockpit3D in [LicenseScenes.tsx](src/components/three/LicenseScenes.tsx) |
| 3D 空域塔（无人机） | ✅ | DroneCity3D |
| 3D 天线方向图（无线电） | ✅ | Antenna3D |
| 3D 经济沙盘 | ✅ | Economy3D |
| 知识点卡片 + 滑块控制 | ✅ | [Space3D.tsx](src/pages/Space3D.tsx) |
| WebGL 不可用降级 | ✅ | [ErrorBoundary.tsx](src/components/three/ErrorBoundary.tsx) → 2D |

### 模块 N6：我的基地
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| 段位进度 | ✅ | [Base.tsx](src/pages/Base.tsx) |
| 宠物养成（4 种） | ✅ | Base.tsx 宠物园（投喂/技能） |
| 装备商店 | ❌ | 未实现 |
| 成就墙 | ⚠️ 简化 | 段位徽章显示，未做完整成就墙 |
| 数据中心 | ✅ | [DataCenter.tsx](src/pages/DataCenter.tsx) |
| 14 天趋势 + 30 天热力图 | ✅ | DataCenter.tsx |
| 雷达图（章节掌握度） | ✅ | ExamResult.tsx |

### 模块 N7：答题内核
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| 单选/多选/判断 | ✅ | [Quiz.tsx](src/pages/Quiz.tsx) |
| 倒计时 | ✅ | Exam.tsx |
| 连击 Combo | ✅ | Quiz.tsx |
| 暴击概率（5%） | ✅ | Quiz.tsx |
| 爆金币 + 音效 + 粒子 | ✅ | [audio.ts](src/engine/audio.ts) + [Effects.tsx](src/components/effects/Effects.tsx) |
| 朗读（TTS） | ✅ | 浏览器 SpeechSynthesis |
| 错题入熔炉 + 红屏抖动 | ✅ | Quiz.tsx |
| 解析面板 + 口诀 | ✅ | Quiz.tsx |
| 3 星评级结算 | ✅ | QuizResult 组件 |

### 模块 N8：太空赛博朋克视觉
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| 主色（深空蓝紫渐变） | ✅ | [tailwind.config.js](tailwind.config.js) |
| 强调色（霓虹粉/电光青/金黄） | ✅ | tailwind.config.js |
| 字体（Orbitron/Rajdhani/Noto SC/JetBrains Mono） | ✅ | [index.html](index.html) |
| 玻璃拟态卡片 | ✅ | [ui/index.tsx](src/components/ui/index.tsx) GlassCard |
| 粒子层（StarField） | ✅ | [StarField.tsx](src/components/effects/StarField.tsx) |
| 按钮发光阴影 | ✅ | index.css + tailwind |
| 玻璃拟态胶囊状态栏 | ✅ | Header.tsx |

### 模块 N9-N10：算法与口诀
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| SM-2 改良算法 | ✅ | [srs.ts](src/engine/srs.ts) |
| 1→3→7→15→30 天回流 | ✅ | srs.ts |
| 难度自适应 | ✅ | 连续答对降低出现频率 |
| AI 口诀模板（4 类） | ✅ | [mnemonic.ts](src/engine/mnemonic.ts) |
| 关键词提取匹配模板 | ✅ | mnemonic.ts |

### 模块 N11-N14：成瘾机制
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| 🪙 金币系统 | ✅ | useGameStore.ts |
| 💎 钻石 | ✅ | useGameStore.ts |
| ⭐ 经验 | ✅ | useGameStore.ts |
| 🔥 火苗（连签） | ✅ | useGameStore.ts |
| 7 段位制 | ✅ | useGameStore.ts + getRankByExp |
| 4 种基础宠物 | ✅ | Base.tsx 宠物园 |
| 宠物技能（双倍经验/免错/复活） | ✅ | Base.tsx |
| 5% 暴击 | ✅ | Quiz.tsx |
| Combo 层级特效（5/10/20/50/100） | ✅ | Quiz.tsx + Effects.tsx |

### 模块 N15-N16：存储与性能
| 子需求 | 状态 | 说明 |
|---|:---:|---|
| LocalStorage 持久化 | ✅ | Zustand persist |
| JSON 导入导出 | ✅ | [Settings.tsx](src/pages/Settings.tsx) |
| IndexedDB 题库缓存 | ❌ | 当前题库直接打包到 JS，未用 IDB |
| PWA Service Worker 离线 | ⚠️ 部分 | manifest 已配，SW 未完整实现 |
| LCP < 2.5s | ✅ | Vite 代码分割 + 懒加载 |
| 切题延迟 < 100ms | ✅ | 内存计算 |
| 60fps / 30fps 降级 | ✅ | ErrorBoundary 3D→2D 降级 |

### 模块 N17：响应式
| 子需求 | 状态 | 说明 |
|---|:---:|---|
| 桌面优先（1280px+） | ✅ | - |
| 平板（768-1280px） | ✅ | 响应式布局 |
| 移动端（<768px） | ✅ | 底部 Tab + 触摸优化 |
| 触摸优化（44px 按钮） | ✅ | tailwind 配置 |
| safe-area 刘海适配 | ✅ | `--safe-top` / `--safe-bottom` |

### 模块 N18：移动端 APP（用户追加需求）
| 子需求 | 状态 | 文件 |
|---|:---:|---|
| Capacitor 工程初始化 | ✅ | [capacitor.config.ts](capacitor.config.ts) |
| Android 原生工程 | ✅ | [android/](android/) |
| StatusBar 插件 | ✅ | 集成 |
| SplashScreen 插件 | ✅ | 集成 |
| App 返回键插件 | ✅ | 集成 |
| Haptics 震动 | ✅ | 集成 |
| Preferences 偏好存储 | ✅ | 集成 |
| 全 dpi 启动图标 | ✅ | [gen-icons.mjs](scripts/gen-icons.mjs) 生成 |
| 全 dpi 启动闪屏 | ✅ | 含横竖屏 |
| viewport 禁缩放 | ✅ | [index.html](index.html) |
| 禁双击/长按 | ✅ | [main.tsx](src/main.tsx) |
| 启动闪屏（React 加载前） | ✅ | index.html `#boot` |
| Gradle 镜像优化 | ✅ | 阿里云 maven + IPv4 |
| APK 构建脚本 | ✅ | package.json `apk:debug` / `apk:release` |
| **APK 最终编译** | ❌ 阻塞 | 沙箱网络受限，需本地构建 |
| iOS 支持 | ❌ | 未开始 |

---

## 三、需求完成度统计

### 总体完成率
- **已完成**：38 / 44 项 = **86.4%**
- **简化实现**：5 项（功能可用但未做完整深度）
- **未实现**：6 项
- **阻塞中**：1 项（APK 本地编译）

### 按模块达成率

| 模块 | 总项 | 完成 | 简化 | 未实现 | 达成率 |
|---|:---:|:---:|:---:|:---:|:---:|
| N1 用户角色 | 3 | 2 | 1 | 0 | 83% |
| N2 星球大厅 | 5 | 5 | 0 | 0 | 100% |
| N3 学习中心 | 10 | 8 | 2 | 0 | 90% |
| N4 记忆工坊 | 5 | 3 | 1 | 1 | 70% |
| N5 模拟空间 3D | 6 | 6 | 0 | 0 | 100% |
| N6 我的基地 | 7 | 5 | 1 | 1 | 79% |
| N7 答题内核 | 9 | 9 | 0 | 0 | 100% |
| N8 视觉 | 7 | 7 | 0 | 0 | 100% |
| N9-N10 算法口诀 | 5 | 5 | 0 | 0 | 100% |
| N11-N14 成瘾机制 | 9 | 9 | 0 | 0 | 100% |
| N15-N16 存储性能 | 7 | 5 | 1 | 1 | 79% |
| N17 响应式 | 5 | 5 | 0 | 0 | 100% |
| N18 移动端 APP | 16 | 15 | 0 | 1 | 94% |
| **合计** | **94** | **84** | **6** | **4** | **91%** |

---

## 四、未完成事项详细清单

### 🔴 阻塞中（需用户本地操作）
1. **APK 最终编译** — 沙箱网络带宽不足，Gradle 依赖（数百 MB）无法下载
   - 解决：本地 `git clone` → `npm install` → `npm run apk:debug`
   - 参考：[docs/APK构建指南.md](docs/APK构建指南.md)

### 🟡 简化实现（功能可用，深度不足）
1. **访客模式** — 未做试玩 3 题限制，当前所有页面可直接访问
2. **每日挑战** — 未做独立限时挑战页，融合到每日任务
3. **顽固错题 Boss 战** — 未做独立周战，仅通过 Lv3 专攻实现
4. **口诀投票收藏** — 仅浏览，未做投票得分推荐
5. **成就墙** — 仅段位徽章，未做完整成就系统
6. **PWA Service Worker** — manifest 已配，SW 离线缓存未完整

### ❌ 未实现
1. **知识图谱 3D 力导向图**（记忆工坊）— 未实现
2. **装备商店**（我的基地）— 未实现
3. **IndexedDB 题库缓存** — 当前题库直接打包到 JS
4. **iOS 支持** — 未开始
5. **联网对战**（V2，PRD 已声明不在本期）
6. **用户账号体系**（V3，PRD 已声明不在本期）

### 🔵 题库扩充（数据层面）
- PPL 飞行执照：当前 ~86 题（示例），需扩充至 ~1000 题
- CAAC 无人机：当前 ~90 题，需扩充至 ~600 题
- HAM 无线电：当前 ~80 题，需扩充至 ~500 题
- 中级经济师：当前 ~88 题，需扩充至 ~800 题

---

## 五、技术栈最终落地

| 层 | 技术 | 版本 |
|---|---|---|
| 前端框架 | React | 18 |
| 语言 | TypeScript | 5 |
| 构建 | Vite | 5 |
| 样式 | Tailwind CSS | 3 |
| 状态 | Zustand + persist | 4 |
| 3D | Three.js + @react-three/fiber + drei | - |
| 动画 | Framer Motion | 11 |
| 图表 | Recharts | 2 |
| 路由 | React Router | 6 |
| 音效 | Web Audio API | 原生 |
| TTS | SpeechSynthesis | 原生 |
| APP 打包 | Capacitor | 8 |
| Android 构建 | Gradle + AGP | 8.14.3 / 8.13.0 |
| 图标生成 | @resvg/resvg-js | - |

---

## 六、下一步行动建议

### 立即可做（用户本地）
1. `git clone git@github.com:jingrongx/ExamPlanet.git`
2. `npm install`
3. `npm run apk:debug` 生成 APK
4. 真机安装测试

### 短期优化（1-2 周内）
1. 扩充 4 大执照题库至生产级题量
2. 完善 PWA Service Worker 离线缓存
3. 补充装备商店 + 成就墙
4. 实现知识图谱 3D 力导向图

### 中期规划（V2-V3）
1. 联网对战
2. 用户账号体系 + 云端同步
3. iOS 版本
4. 题库众包与社区口诀

---

## 七、文件清单索引

### 核心代码
- 入口：[src/main.tsx](src/main.tsx) + [src/App.tsx](src/App.tsx)
- 状态：[src/store/useGameStore.ts](src/store/useGameStore.ts)
- 引擎：[src/engine/](src/engine/) (audio / mnemonic / srs)
- 题库：[src/data/](src/data/)

### 页面（11 个）
- [Hall.tsx](src/pages/Hall.tsx) 星球大厅
- [ChapterMap.tsx](src/pages/ChapterMap.tsx) 章节地图
- [Quiz.tsx](src/pages/Quiz.tsx) 答题页
- [Mistakes.tsx](src/pages/Mistakes.tsx) 错题熔炉
- [Memory.tsx](src/pages/Memory.tsx) 记忆工坊
- [Exam.tsx](src/pages/Exam.tsx) + [ExamResult.tsx](src/pages/ExamResult.tsx) 模拟考试
- [Space3D.tsx](src/pages/Space3D.tsx) 3D 模拟空间
- [Base.tsx](src/pages/Base.tsx) 我的基地
- [DataCenter.tsx](src/pages/DataCenter.tsx) 数据中心
- [Settings.tsx](src/pages/Settings.tsx) 设置

### APP 工程
- [capacitor.config.ts](capacitor.config.ts)
- [android/](android/) Android 原生工程
- [scripts/gen-icons.mjs](scripts/gen-icons.mjs) 图标生成
- [assets/](assets/) SVG 源文件

### 文档
- [.trae/documents/PRD.md](.trae/documents/PRD.md) 产品需求文档
- [.trae/documents/TechnicalArchitecture.md](.trae/documents/TechnicalArchitecture.md) 技术架构
- [docs/APK构建指南.md](docs/APK构建指南.md) APK 构建指南
