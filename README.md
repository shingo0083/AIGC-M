# Genesis Prompt Generator

![Version](https://img.shields.io/badge/version-v0.1.1--stable-brightgreen)
![Frontend](https://img.shields.io/badge/Frontend-Vue3%20%2B%20Element%20Plus-42b883)
![Backend](https://img.shields.io/badge/Backend-FastAPI-3776ab)
![Deploy](https://img.shields.io/badge/Deployment-Vercel-000000)

**Genesis Prompt Generator** 是一个高度模块化、配置驱动的 **AIGC Prompt 构建与图像生成系统**。

它并非简单的“提示词拼接器”，而是一个具备**结构约束、物理一致性、摄影语义校正与自动 lint 能力**的 PromptBuilder 引擎，面向 **真实摄影 / 高保真视觉生成** 场景进行系统级设计。

当前版本 **v0.1.1** 标志着：
> 📌 **Photography PromptBuilder 已进入稳定阶段**（Framing Lock + Diegetic Lighting + Physics Engine + Lint Rules）

---

## ✨ 核心能力概览

### 🧠 PromptBuilder（系统核心）
- **结构化 Prompt 模板**：Role / Task / Framing / Equipment / Subject / Styling / Environment / Physics / Constraints
- **层级优先级控制**：身份与构图优先，其次光照真实感，最后才是物理与材质细节
- **全自动自然语言拼接**：避免标签堆叠，输出可直接用于高质量生图

### 📸 真实摄影专用能力（v0.1.1 稳定）
- **Frame Integrity Lock**：
  - 全身构图强约束（Head-to-Toe，不裁切，不丢脚）
  - Establishing Shot 环境优先逻辑
- **Diegetic Lighting 校验**：
  - 自动检测并修正“假光源 / 影棚光 / 非物理背光”
  - 夜景场景下自动约束月光、城市灯光的物理合理性
- **物理与材质引擎（PHYSICS_ENGINE）**：
  - 胸型 / 重力 / 承托 / 接触阴影
  - 针织 / 丝绸 / 紧身 / 透明材质的受力与反射语义
- **Prompt Lint 规则系统**：
  - 自动消除语义冲突（如：夜景 + 强太阳光）
  - 自动清理残留标点、断裂短语

### 🧩 完全配置驱动（低代码）
- 新风格 = 新 JSON（无需改前端）
- 新材质 / 新服装 / 新镜头语义 = 扩展 assets 即可
- PromptBuilder 是**唯一真相源**，避免前后端逻辑分裂

---

## 🏗️ 技术架构

```text
Frontend (Vue3 + Vite)
 └─ PromptBuilder (TypeScript)
     ├─ engine.ts        # 语义规则 / 物理引擎 / lint
     ├─ index.ts         # Prompt 结构拼装

Backend (FastAPI)
 └─ Smart Blueprint Builder
     ├─ Prompt 再组装
     ├─ Diegetic 光照兜底
     ├─ 上游错误人话化
```

---

## 🚀 快速开始（本地开发）

### 环境要求
- Node.js 16+
- Python 3.10+

### 1️⃣ 克隆仓库
```bash
git clone https://github.com/shingo0083/AIGC-M.git
cd AIGC-M
```

### 2️⃣ 启动后端（FastAPI）
```bash
cd api
pip install -r requirements.txt

# 配置环境变量（.env）
# GEMINI_API_KEY=your_key_here

python index.py
```
默认端口：`http://127.0.0.1:8000`

### 3️⃣ 启动前端（Vue）
```bash
cd frontend
npm install
npm run dev
```
浏览器访问：`http://localhost:5173`

---

## 📦 数据与风格扩展（核心玩法）

所有可扩展数据均位于：
```text
api/data/
 ├─ styles/        # 风格 Manifest（Prompt 结构）
 ├─ assets/        # 服装 / 场景 / 材质 / 妆容等
 └─ global.json    # 物理与通用规则真相源
```

### 新增一个摄影风格（示意）
1. 在 `api/data/styles/` 新建 `photography.json`
2. 定义 Prompt 模板与 slots
3. 在 `assets/` 中补充对应选项

无需重启前端，刷新即生效。

---

## 🌐 部署（Vercel 推荐）

- Framework Preset：Vite
- Build Command：
```bash
cd frontend && npm install && npm run build
```
- Output Directory：`frontend/dist`
- 环境变量：
  - `GEMINI_API_KEY`

---

## 🏷️ 版本策略

- `v0.1`：Initial Preview（历史锚点）
- `v0.1.1`：Photography PromptBuilder 稳定版（当前）

后续将采用：
- `v0.1.x`：稳定修复
- `v0.2.x`：结构升级

---

## 📜 License

MIT License

---

> Genesis Prompt Generator
> 从“拼 Prompt”进化为“**设计 Prompt 系统**”。

