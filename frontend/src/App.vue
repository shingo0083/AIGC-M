<template>
  <div class="app-container">
    <el-container>
      <el-header class="main-header">
        <h1>Genesis Prompt Generator</h1>
        <p class="subtitle">AI创作v0.1</p>
      </el-header>

      <el-main>
        <el-row :gutter="20">

          <el-col :xs="24" :sm="24" :md="13" :lg="14" class="left-panel">

            <el-card class="box-card">
              <template #header>
                <div class="card-header"><span>第一步：选择风格 (Style)</span></div>
              </template>
              <div v-if="loadingStyles">加载中...</div>
              <el-radio-group v-else v-model="currentStyleId" @change="handleStyleChange" size="large"
                class="style-group">
                <el-radio-button v-for="style in styleList" :key="style.id" :value="style.id">
                  {{ style.name }}
                </el-radio-button>
              </el-radio-group>
              <div v-if="currentManifest" class="style-desc">
                {{ currentManifest.description }}
              </div>
            </el-card>

            <el-card class="box-card" v-if="currentStyleId">
              <template #header>
                <div class="card-header"><span>第二步：基础构图 (Composition)</span></div>
              </template>
              <el-row :gutter="10">
                <el-col :span="6" :xs="12">
                  <el-form-item label="画幅 (Ratio)">
                    <el-select v-model="form.aspect_ratio" placeholder="3:4" style="width:100%">
                      <el-option v-for="o in globalConfig.aspect_ratios" :key="o.value" :label="o.label"
                        :value="o.value" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="6" :xs="12"><el-form-item label="景别"><el-select v-model="form.shot_type" clearable
                      style="width:100%"><el-option v-for="o in globalConfig.shot_types" :key="o.value" :label="o.label"
                        :value="o.value" /></el-select></el-form-item></el-col>
                <el-col :span="6" :xs="12"><el-form-item label="体型"><el-select v-model="form.body_type" clearable
                      style="width:100%"><el-option v-for="o in globalConfig.body_types" :key="o.value" :label="o.label"
                        :value="o.value" /></el-select></el-form-item></el-col>
                <el-col :span="6" :xs="12"><el-form-item label="罩杯"><el-select v-model="form.cup_size" clearable
                      style="width:100%"><el-option v-for="o in globalConfig.cup_sizes" :key="o.value" :label="o.label"
                        :value="o.value" /></el-select></el-form-item></el-col>
              </el-row>
            </el-card>

            <el-card class="box-card" v-if="currentManifest">
              <template #header>
                <div class="card-header"><span>第三步：细节配置 (Details)</span></div>
              </template>
              <el-row :gutter="15">
                <el-col :span="12" :xs="24" :sm="12" v-for="(slotData, key) in currentSlotsData" :key="key"
                  class="slot-col">
                  <el-form-item :label="slotData.label">
                    <el-select v-model="form[key]" :disabled="slotData.disabled" filterable allow-create
                      default-first-option clearable :placeholder="slotData.disabled ? '不可用' : '选择...'"
                      style="width: 100%">
                      <el-option-group v-for="group in slotData.options" :key="group.label" :label="group.label">
                        <el-option v-for="item in group.options" :key="item.value" :label="item.label"
                          :value="item.value" />
                      </el-option-group>
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
            </el-card>

            <el-card class="box-card" v-if="currentManifest">
              <template #header>
                <div class="card-header">
                  <span>第四步：参考图/垫图 (Ref Images)</span>
                </div>
              </template>

              <el-upload v-model:file-list="fileList" action="#" list-type="picture-card" :auto-upload="false"
                :on-change="handleFileChange" :limit="3" accept="image/png, image/jpeg">
                <el-icon>
                  <Plus />
                </el-icon>
                <template #tip>
                  <div class="el-upload__tip">
                    支持 JPG/PNG，最多 3 张 (图生图/多图融合)
                  </div>
                </template>
              </el-upload>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="24" :md="11" :lg="10" class="right-panel">
            <div class="sticky-wrapper">

              <el-card class="box-card result-card" shadow="hover" v-if="currentManifest">
                <template #header>
                  <div class="card-header">
                    <span>生成指令 (Prompt)</span>
                    <el-button link type="primary" @click="copyPrompt">复制</el-button>
                  </div>
                </template>

                <el-input v-model="finalPrompt" type="textarea" :rows="6" readonly resize="none" placeholder="等待配置..."
                  class="prompt-input" />

                <div class="generate-action">
                  <el-button type="success" size="large" class="gen-btn" :loading="generating" @click="handleGenerate">
                    {{ generating ? 'AI 正在绘图...' : '立即生成图片' }}
                  </el-button>
                </div>
              </el-card>

              <div class="image-display-area" v-if="generatedImage || generating">
                <div v-if="generating && !generatedImage" class="loading-placeholder">
                  <el-icon class="is-loading">
                    <Loading />
                  </el-icon>
                  <p>正在连接神经元网络...</p>
                </div>

                <div v-if="generatedImage" class="image-wrapper">
                  <el-image :src="generatedImage" :preview-src-list="[generatedImage]" fit="contain"
                    class="result-image">
                    <template #error>
                      <div class="image-slot">加载失败</div>
                    </template>
                  </el-image>
                  <div class="image-tools">
                    <el-button type="primary" :icon="Download" size="large" @click="downloadImage(generatedImage)"
                      style="width: 80%; max-width: 300px;">
                      下载保存图片
                    </el-button>
                  </div>
                </div>
              </div>
              <div v-else class="empty-placeholder">
                <el-empty description="暂无生成结果" :image-size="100"></el-empty>
              </div>

            </div>
          </el-col>

        </el-row>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Plus, Download, Loading } from '@element-plus/icons-vue'

// 如果是本地开发环境(DEV)，用本地地址；如果是生产环境(PROD)，用相对路径 '/api'
const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '/api'

// State
const loadingStyles = ref(true)
const styleList = ref([])
const globalConfig = ref({ shot_types: [], body_types: [], cup_sizes: [] })
const currentStyleId = ref('')
const currentManifest = ref(null)
const currentSlotsData = ref({})
const form = reactive({
  aspect_ratio: '3:4', // 这里设置默认值为 3:4
  shot_type: '',
  body_type: '',
  cup_size: ''
})

// Upload State
const fileList = ref([])
const base64Images = ref([])

// Generation State
const generating = ref(false)
const generatedImage = ref('')

// Init
onMounted(async () => {
  try {
    const [g, s] = await Promise.all([axios.get(`${API_BASE}/init`), axios.get(`${API_BASE}/styles`)])
    globalConfig.value = g.data
    styleList.value = s.data
  } catch (e) { ElMessage.error('后端连接失败'); console.error(e) }
  finally { loadingStyles.value = false }
})

// Handlers
const handleStyleChange = async (id) => {
  const { aspect_ratio, shot_type, body_type, cup_size } = form
  for (const k in form) delete form[k]
  Object.assign(form, { aspect_ratio, shot_type, body_type, cup_size })

  const res = await axios.get(`${API_BASE}/styles/${id}`)
  currentManifest.value = res.data.manifest
  currentSlotsData.value = res.data.slots_data
  Object.keys(res.data.slots_data).forEach(k => form[k] = '')
}

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
  })
}

const handleFileChange = async (uploadFile, uploadFiles) => {
  const promises = uploadFiles.map(f => fileToBase64(f.raw))
  try {
    const results = await Promise.all(promises)
    base64Images.value = results.map(res => res.split(',')[1])
  } catch (err) { ElMessage.error("图片转换失败") }
}

const finalPrompt = computed(() => {
  // 1. 如果没有加载风格，返回空
  if (!currentManifest.value) return ''

  // 2. 获取当前风格的模板
  let t = currentManifest.value.template

  // 3. 合并上下文
  const ctx = { ...form, ...currentManifest.value.dictionaries }
  Object.keys(currentManifest.value.dictionaries || {}).forEach(k => ctx[k] = ctx[k].value)

  // 4. 替换变量
  let prompt = t.replace(/\{(\w+)\}/g, (_, k) => ctx[k] || '')

  // 5. 【增强版】清洗文本逻辑
  prompt = prompt
    // (a) 将多个空格合并为一个
    .replace(/\s+/g, ' ')
    
    // (b) 核心修复：将 ", ." 替换为 "." (解决你遇到的 lens, . 问题)
    .replace(/,\s*\./g, '.')
    
    // (c) 修复符号前的空格： " ," -> ","  和 " ." -> "."
    .replace(/\s([,.])/g, '$1')
    
    // (d) 去除重复符号： ",," -> "," 和 ".." -> "."
    .replace(/,+/g, ',')
    .replace(/\.+/g, '.')
    
    // (e) 确保逗号后有空格 (美观)
    .replace(/,([^\s])/g, ', $1')

    // (f) 去除首尾的标点和空格
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim()

  // 6. 追加画幅比例
  if (form.aspect_ratio && form.aspect_ratio !== '1:1') {
    prompt += `, aspect ratio ${form.aspect_ratio}`
  }

  return prompt
})

const copyPrompt = () => { navigator.clipboard.writeText(finalPrompt.value); ElMessage.success('已复制') }

const handleGenerate = async () => {
  generating.value = true
  generatedImage.value = ''
  
  try {
    // 1. 获取当前风格的控制器配置 (如果有)
    // 注意：这里需要从 currentManifest 中获取 controller，因为 styleList 可能只包含摘要
    const controllerConfig = currentManifest.value ? currentManifest.value.controller : null

    // 2. 组装 Payload
    const payload = {
      prompt: finalPrompt.value,
      model: 'gemini-3-pro-image-preview',
      images: base64Images.value,
      aspect_ratio: form.aspect_ratio || '3:4',
      style_config: controllerConfig
    }

    // 3. 发送请求
    const res = await axios.post(`${API_BASE}/generate`, payload)
    
    if (res.data.status === 'success') {
      generatedImage.value = res.data.url
      ElMessage.success('生成成功')
    } else {
      ElMessage.error(res.data.message || '生成失败')
    }
  } catch (e) {
    ElMessage.error('请求出错')
    console.error(e)
  } finally {
    generating.value = false
  }
}

// 修改后的下载函数 (只保留英文前缀)
const downloadImage = async (url) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)

    // --- 核心修改：英文文件名逻辑 ---

    // 1. 获取风格对象
    const styleObj = styleList.value.find(s => s.id === currentStyleId.value)
    let prefix = 'Genesis'

    if (styleObj) {
      // 策略 A: 尝试提取括号里的内容 (针对 "二次元 (Anime)" 这种格式)
      const englishMatch = styleObj.name.match(/\(([^)]+)\)/)

      if (englishMatch) {
        prefix = englishMatch[1] // 提取出 Anime
      } else {
        // 策略 B: 如果名字里没括号，直接用 ID (如 "anime_v1")，保证肯定是英文
        prefix = styleObj.id
      }
    }

    // 2. 清洗字符：只保留 字母、数字、下划线 (去掉空格等特殊符号)
    // 结果示例: "Anime" 或 "Epic_Fantasy"
    prefix = prefix.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_')

    // 3. 获取日期 (YYYYMMDD)
    const now = new Date()
    const dateStr = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0')

    // 4. 生成 4 位随机数
    const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0')

    // 最终组合: Anime_20260122_8842.png
    link.download = `${prefix}_${dateStr}_${randomStr}.png`

    // ----------------------------------

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (e) {
    ElMessage.error('下载失败，尝试新窗口打开')
    window.open(url, '_blank')
  }
}
</script>

<style>
/* Reset & Base */
body {
  margin: 0;
  background-color: #f5f7fa;
}

.app-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 10px;
  font-family: 'Helvetica Neue', sans-serif;
}

.main-header {
  text-align: center;
  margin-bottom: 20px;
  padding-top: 20px;
}

.main-header h1 {
  margin: 0;
  color: #409EFF;
  font-size: 24px;
}

.subtitle {
  color: #909399;
  font-size: 14px;
  margin-top: 5px;
}

/* 响应式调整 Element UI 组件 */
.el-card {
  margin-bottom: 20px;
  border-radius: 8px;
}

.el-form-item {
  margin-bottom: 18px;
}

.style-group {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
}

.style-group .el-radio-button__inner {
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  margin: 0 10px 10px 0;
  border-left: 1px solid #dcdfe6;
}

.style-desc {
  margin-top: 10px;
  color: #666;
  font-size: 13px;
  background: #f4f4f5;
  padding: 10px;
  border-radius: 4px;
}

/* Sticky Right Panel (PC端吸顶效果) */
@media (min-width: 992px) {
  .sticky-wrapper {
    position: sticky;
    top: 20px;
    /* 距离顶部 20px 吸附 */
  }
}

/* Prompt Card */
.prompt-input .el-textarea__inner {
  background-color: #fafafa;
  color: #333;
  font-family: monospace;
  font-size: 14px;
}

.generate-action {
  margin-top: 15px;
}

.gen-btn {
  width: 100%;
  font-weight: bold;
  letter-spacing: 1px;
}

/* Image Display Area (自适应) */
.image-display-area {
  margin-top: 20px;
  background: white;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  text-align: center;
  /* 确保最小高度，避免生成瞬间高度跳变 */
  min-height: 200px;
}

.image-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.result-image {
  width: 100%;
  height: auto;
  border-radius: 4px;
  /* 限制最大高度，防止长图占满整个屏幕无法滚动 */
  max-height: 80vh;
  background-color: #eee;
}

.image-tools {
  margin-top: 15px;
}

/* Placeholders */
.loading-placeholder {
  padding: 40px;
  color: #409EFF;
}

.empty-placeholder {
  margin-top: 20px;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
}

/* 移动端特定优化 */
@media (max-width: 768px) {
  .main-header h1 {
    font-size: 20px;
  }

  .el-form-item__label {
    float: none;
    display: block;
    text-align: left;
    padding: 0 0 5px;
  }
}
</style>