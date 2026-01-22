# Genesis Prompt Generator (v0.1 Preview)

![Version](https://img.shields.io/badge/version-v0.1--preview-blue)
![Vue](https://img.shields.io/badge/Frontend-Vue3%20%2B%20Element%20Plus-42b883)
![Python](https://img.shields.io/badge/Backend-FastAPI-3776ab)
![Deploy](https://img.shields.io/badge/Deployment-Vercel-000000)

**Genesis Prompt Generator** 是一个模块化、配置驱动的 AI 指令构建与生图系统。

它不仅仅是一个简单的生图工具，更是一个**“风格架构师”**。通过 JSON 配置，你可以无需编写代码，即可无限扩展新的艺术风格、角色预设和场景组合，并利用 Google Gemini (或兼容 API) 进行高质量的图像生成。

> 🚀 **v0.1 预览版特性**：已支持文生图、图生图、多图融合，且完全适配移动端响应式布局。

---

## ✨ 核心特性

* **🧩 配置驱动架构 (Configuration Driven)**：
    * 前端界面由后端 JSON 数据动态渲染。
    * 添加新风格只需新建 JSON 文件，无需修改前端代码。
* **🤖 自然语言拼接引擎**：
    * 独创的 `Template` + `Slots` 机制，将离散的标签自动组装成通顺的自然语言 Prompt。
* **🖼️ 多模态生图支持**：
    * 集成 Google Gemini 视觉模型。
    * 支持 **垫图 (Image-to-Image)** 和 **多图融合 (Multi-Image Fusion)**。
* **📱 全响应式设计**：
    * PC 端：左右分栏，参数与预览实时对照，Sticky 吸顶设计。
    * 移动端：上下流式布局，完美适配手机操作。
* **☁️ Serverless 部署**：
    * 原生支持 Vercel 一键部署，前后端自动路由。

---

## 🛠️ 快速开始 (本地开发)

### 前置要求
* Node.js 16+
* Python 3.10+

### 1. 克隆项目
```bash
git clone [https://github.com/yourname/genesis-prompt-gen.git]
cd genesis-prompt-gen
2. 后端启动 (API)
Bash

# 建议先创建并激活虚拟环境 (可选)
# python -m venv venv
# .\venv\Scripts\activate

# 安装依赖
cd api
pip install -r requirements.txt

# 配置环境变量
# 复制 .env.example 为 .env 并填入你的 API Key
# GEMINI_API_KEY=sk-xxxx

# 启动后端服务 (默认端口 8000)
python index.py
3. 前端启动 (UI)
打开一个新的终端窗口：

Bash

cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
访问显示的本地地址 (通常为 http://localhost:5173) 即可开始使用。

📦 数据包扩充指南 (核心玩法)
Genesis 的核心优势在于低代码扩展。你不需要懂 Python 或 Vue，只需要编辑 JSON 文本，就可以创造全新的生图风格。

所有数据均存储在 api/data/ 目录下。

步骤一：定义风格控制器 (Style Manifest)
在 api/data/styles/ 目录下新建一个 JSON 文件，例如 cyberpunk.json。这是风格的“大脑”。

JSON

{
  "id": "cyberpunk_v1",               // 唯一ID (用于文件名生成前缀)
  "name": "赛博朋克 (Cyberpunk)",      // 显示在前端按钮上的名字
  "description": "高科技、低生活的霓虹夜景风格",

  // 1. 定义 Prompt 模板
  // {xxx} 是占位符，会对应下方的 slots 或 dictionaries
  "template": "A futuristic {shot_type} of a character with {body_type}. Wearing {clothing}. Standing in {scene} with {lighting}. {trigger_words}",

  // 2. 定义静态词典 (固定插入的词)
  "dictionaries": {
    "trigger_words": { "value": "cyberpunk style, neon lights, highly detailed, 8k resolution" }
  },

  // 3. 定义动态插槽 (前端下拉框)
  "slots": {
    // source: 指向具体的资产文件路径
    // label: 前端显示的下拉框标题
    "clothing": { "source": "cyberpunk/clothing.json", "label": "科技服装" },
    "scene":    { "source": "cyberpunk/scenes.json",   "label": "夜之城场景" },
    
    // 如果某个通用槽位不需要，可以设为 null 或不写 source
    "lighting": { "source": null, "label": "光影 (本风格禁用)" }
  }
}
步骤二：填充资产包 (Assets)
根据上一步 source 定义的路径，在 api/data/assets/ 下创建文件夹和文件。 例如新建 api/data/assets/cyberpunk/clothing.json：

JSON

[
  {
    "label": "轻型装备", // 分组标题
    "options": [
      { 
        "label": "黑客夹克", // 下拉框选项名
        "value": "black leather bomber jacket with glowing led strips on collar" // 实际生成的 Prompt
      },
      { 
        "label": "光学迷彩", 
        "value": "translucent holographic raincoat" 
      }
    ]
  },
  {
    "label": "重型义体",
    "options": [
      { "label": "机械外骨骼", "value": "heavy industrial mechanical exoskeleton suit" }
    ]
  }
]
完成！ 无需重启后端，刷新网页，新的“赛博朋克”风格就会立刻出现，并且拥有你定义的“科技服装”选项。

🚀 部署上线 (Vercel)
本项目专为 Vercel Serverless 环境优化。

将代码 Push 到 GitHub。

在 Vercel 导入项目。

关键配置：

Framework Preset: 选择 Vite。

Build Command: cd frontend && npm install && npm run build

Output Directory: public

在 Environment Variables 中填入 GEMINI_API_KEY 等环境变量。

点击 Deploy 即可上线。