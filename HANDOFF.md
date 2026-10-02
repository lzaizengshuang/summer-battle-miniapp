# 交接文档（Kimi Work → Kimi Code）

> 最后更新：2026-10-02。接手前请先读本文件，再 `git log --oneline -25` 看修复链，上下文即可恢复九成。

## 项目概况

- 名称：寒暑假打卡小程序（summer-battle-miniapp），孩子端游戏化打卡 + 家长后台
- 技术栈：Taro 4 + React 18 + TypeScript + weapp-tailwindcss（Tailwind v4 CSS-first 写法）+ 微信云开发（20 个云函数）
- 仓库：https://github.com/lzaizengshuang/summer-battle-miniapp （main 分支）
- 项目根：`D:\BaiduSyncdisk\kimi可操作文件夹\微信小程序\01寒暑假打卡器\summer-battle-miniapp-main`
- 源码在 `src/`，构建产物在 `dist/`（微信开发者工具加载 dist，`dist/project.config.json` 是工具入口配置）
- 云函数源码在 `cloudfunctions/`（共 20 个 + `utils/` 共享模块）

## 常用命令

```bash
npx eslint src            # 代码规范检查（提交前必跑）
npx taro build --type weapp   # 构建小程序产物（改完代码必须重跑，工具才会加载新 dist）
```

ESLint 红线（违反会报错，都是真机血泪换来的）：
- 禁止小数 Tailwind 类（p-0.5 之类），小程序换算会出问题
- 禁止直接 import @tarojs/components 的 Input/Textarea，必须走 `@/components/ui/input` 封装；原生输入框背景必须内联 style 设置（iOS 会无视 className 把白底浮到最上层）

## 已踩平的坑（改布局前必读）

1. **scroll-view 必须显式加 `box-border`**：微信内置组件样式优先级压过 Tailwind 通配 preflight，`w-full + px-4` 会按 content-box 算成 472pt 撑破 440pt 屏幕，表现为"内容偏右、右缘被裁、iOS 左右橡皮筋横滑"。六个页面的 ScrollView 都已加，新增滚动容器必须照做。
2. **背景图必须显式宽高**：`<Image>` 用 `fixed + left/right` 定位不会拉伸（替换元素行为），必须 `style={{position:'fixed', top:0, left:0, width:'100%', height:'100%'}}`。图片固有宽度会撑大页面可滚宽度（iOS 下拉刷新页面尤其明显）。
3. **全页面根容器 `overflow-hidden`**：iOS 页面级橡皮筋横滑只能靠根节点裁剪掐死，page 上的 overflow-x:hidden 不够。
4. **tabBar 页面不卸载**：切走再切回不会重新执行 useEffect，需要刷新的页面必须用 `useDidShow`（记录页已用）。给 tabBar 页加数据刷新逻辑时先想这一点。
5. **iOS 不渲染 webp**：全部图片已转 png/jpg，新增图片别用 webp。
6. **页面配置背景色统一 #0A0A0A**（六个 index.config.ts），露底时是深色不突兀。
7. `page { width: 100vw }`（app.css）：锚定视口宽，防文档宽度被带偏。

## 架构速览

- `src/app.config.ts`：4 个 tabBar 页（作战/等级/勋章/记录）+ 向导页 onboarding + 家长页 parent
- 入口逻辑：`src/app.tsx` Bootstrap 冷启动调 `getOrCreateDefaultChildProfile` → `getCurrentPlan`，数据进 zustand（`src/stores/global`）
- 主题：王子/公主双主题，`src/config/theme.ts` 定义色板，档案创建时选定后锁定，家长后台无切换入口
- 军衔徽章图：`rankEmblems[theme][等级]`；勋章墙：`src/components/MedalGrid`
- 真机入口：家长页 = 首页长按军衔徽章；杀掉小程序重进 = 向导页

## 云函数

- 前端改动**不需要**重新部署；改了 `cloudfunctions/` 里的代码才需要，在微信开发者工具里逐个右键「上传并部署：云端安装依赖」
- 数据库集合：records / plans / progress / children，查询全部带 `_openid + childId + planId`

## 测试流程（与真机配合）

真机预览每次必须：彻底退出微信开发者工具重开 → 编译 → **重新生成预览二维码**（旧二维码会扫到旧包，这个坑反复出现过）。真机是 iPhone 17 Pro Max（440pt 视口，iOS 26）。安卓端尚未验证（待办）。

## 待办（接手时从这里开始）

1. 等振哥真机复测确认：横滑消失、内容居中、汇报后记录页即时同步、等级页三态视觉（✓已完成/▶当前/未解锁灰化）
2. **发布配置**（mp 后台）：服务类目（教育或工具类）、用户隐私保护指引（必填，漏了必拒审）、提审材料
3. 可选优化：主包 1.9M 压线 2M，主题图片可分包瘦身；代码质量面板"主包大小/图片资源"两项未通过属建议非门槛
4. 安卓真机借一部验证：图片渲染、输入框、滚动行为
5. `src/components/ui/` 里一批 shadcn 移植组件（dialog/dropdown 等）页面未用，如主包吃紧可删

## 沟通偏好（对振哥）

- 称呼「振哥」
- 避免 AI 腔；禁止「不是…而是」对比句式；禁止排比三段式
- 有问题要直接说，他欣赏直来直去
- 批量问题等他全部发完再统一改
