<template>
  <div class="app-wrapper">
    <header class="navbar">
      <div class="nav-content">
        <div class="brand">
          <h1>AIGC-M<span class="highlight">Studio</span></h1>
          <span class="tag">v0.1.1</span>
        </div>
      </div>
    </header>

    <div class="main-container">
      <el-row :gutter="24">
        <el-col :xs="24" :sm="24" :md="13" :lg="14" class="left-panel">

          <section class="config-section">
            <div class="section-title">
              <span class="step-num">01</span> 选择风格 / Style
            </div>

            <div v-if="loadingStyles" class="loading-state">
              <el-skeleton :rows="2" animated />
            </div>

            <div v-else class="style-grid">
              <div v-for="style in styleList" :key="style.id" class="style-card"
                :class="{ active: currentStyleId === style.id }"
                @click="currentStyleId = style.id; handleStyleChange(style.id)">
                <div class="style-icon">{{ getStyleIcon(style.id) }}</div>
                <div class="style-name">{{ style.name }}</div>
              </div>
            </div>

            <transition name="fade">
              <div v-if="currentManifest" class="style-desc-box">
                <el-icon>
                  <InfoFilled />
                </el-icon>
                <p>{{ currentManifest.description }}</p>
              </div>
            </transition>
          </section>

          <transition name="slide-fade">
            <section class="config-section" v-if="currentStyleId">
              <div class="section-title">
                <span class="step-num">02</span> 构图与主体 / Composition
              </div>

              <el-form label-position="top" class="compact-form">
                <el-row :gutter="16">
                  <el-col :span="6" :xs="12">
                    <el-form-item label="画幅 (Ratio)">
                      <el-select v-model="form.aspect_ratio" placeholder="默认">
                        <el-option v-for="o in globalConfig.aspect_ratios" :key="o.value" :label="o.label"
                          :value="o.value">
                          <span style="float: left">{{ o.label }}</span>
                          <span style="float: right; color: #8492a6; font-size: 12px">{{ o.value }}</span>
                        </el-option>
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="6" :xs="12">
                    <el-form-item label="景别 (Shot)">
                      <el-select v-model="form.shot_type" clearable placeholder="自动">
                        <el-option v-for="o in globalConfig.shot_types" :key="o.value" :label="o.label"
                          :value="o.value" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="6" :xs="12">
                    <el-form-item label="体型 (Body)">
                      <el-select v-model="form.body_type" clearable placeholder="默认">
                        <el-option v-for="o in globalConfig.body_types" :key="o.value" :label="o.label"
                          :value="o.value" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="6" :xs="12">
                    <el-form-item label="罩杯 (Cup/Feature)">
                      <el-select v-model="form.cup_size" clearable placeholder="默认">
                        <el-option v-for="o in globalConfig.cup_sizes" :key="o.value" :label="o.label"
                          :value="o.value" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                </el-row>
              </el-form>
            </section>
          </transition>

          <transition name="slide-fade">
            <section class="config-section" v-if="currentManifest">
              <div class="section-title">
                <span class="step-num">03</span> 细节定制 / Details
              </div>

              <div class="dynamic-slots-container">
                <el-form label-position="top">
                  <el-row :gutter="16">
                    <el-col :span="12" :xs="24" v-for="(slotData, key) in currentSlotsData" :key="key">
                      <el-form-item :label="slotData.label">
                        <el-select v-model="form[key]" :disabled="slotData.disabled" filterable allow-create clearable
                          :placeholder="slotData.disabled ? '该风格不支持此选项' : '点击选择...'" class="full-width">
                          <el-option-group v-for="group in slotData.options" :key="group.label" :label="group.label">
                            <template #label>
                              <span class="group-label">
                                {{ getGroupIcon(group.label) }} {{ group.label }}
                              </span>
                            </template>
                            <el-option v-for="item in group.options" :key="item.value" :label="item.label"
                              :value="item.value" />
                          </el-option-group>
                        </el-select>
                      </el-form-item>
                    </el-col>
                  </el-row>
                </el-form>
              </div>
            </section>
          </transition>

          <transition name="slide-fade">
            <section class="config-section" v-if="currentManifest">
              <div class="section-title">
                <span class="step-num">04</span> 垫图 / Reference
              </div>
              <el-upload v-model:file-list="fileList" action="#" list-type="picture-card" :auto-upload="false"
                :on-change="handleFileChange" :limit="1" class="compact-upload">
                <el-icon>
                  <Plus />
                </el-icon>
              </el-upload>
            </section>
          </transition>
        </el-col>

        <el-col :xs="24" :sm="24" :md="11" :lg="10" class="right-panel">
          <div class="sticky-wrapper">

            <div class="prompt-workspace card-shadow" v-if="currentManifest">
              <div class="workspace-header">
                <span class="label">指令蓝图 (Blueprint)</span>
                <div class="actions">
                  <el-button link type="primary" @click="copyPrompt">复制</el-button>
                  <el-button type="warning" plain size="small" round @click="handleCompile" :loading="compiling">
                    ⚡ 优化指令
                  </el-button>
                </div>
              </div>

              <div class="prompt-editor" :class="{ 'is-outdated': isBlueprintOutdated }">
                <div v-if="isBlueprintOutdated" class="outdated-tip" @click="handleCompile">
                  <el-icon>
                    <Warning />
                  </el-icon> 配置已变更，点击此处刷新蓝图
                </div>
                <el-input :model-value="compiledPrompt || computedDraftPrompt" type="textarea" :rows="12" readonly
                  resize="none" placeholder="等待配置..." class="code-font" />
              </div>

              <div class="desktop-action">
                <el-button type="primary" size="large" class="gen-btn-primary" :loading="generating"
                  @click="handleGenerate">
                  <span v-if="!generating">立即生成 (Generate)</span>
                  <span v-else>正在连接神经元网络...</span>
                </el-button>
              </div>
            </div>

            <transition name="fade">
              <div class="result-display card-shadow" v-if="generatedImage || generating">
                <div v-if="generating && !generatedImage" class="loading-state-box">
                  <div class="loader"></div>
                  <p>AI 正在绘图中...</p>
                </div>
                <div v-if="generatedImage" class="image-wrapper">
                  <el-image :src="generatedImage" :preview-src-list="[generatedImage]" fit="contain"
                    class="final-image" />
                  <div class="image-actions">
                    <el-button type="success" plain icon="Download"
                      @click="downloadImage(generatedImage, currentStyleId || currentManifest?.id)" round>
                      保存图片
                    </el-button>
                  </div>
                </div>
              </div>
            </transition>

          </div>
        </el-col>
      </el-row>
    </div>

    <transition name="fade">
      <div class="mobile-fab" v-if="currentManifest && !generating" @click="handleGenerate">
        <el-icon>
          <VideoPlay />
        </el-icon>
        <span>生成</span>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Plus, Download, Loading, VideoPlay, InfoFilled, Warning } from '@element-plus/icons-vue'
import { getBuilder } from './prompt/builders/registry'

const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '/api'

// 状态变量
const loadingStyles = ref(true)
const styleList = ref([])
const globalConfig = ref({ shot_types: [], body_types: [], cup_sizes: [] })
const currentStyleId = ref('')
const currentManifest = ref(null)
const currentSlotsData = ref({})
const form = reactive({ aspect_ratio: '3:4', shot_type: '', body_type: '', cup_size: '' })
const fileList = ref([])
const base64Images = ref([])

// 生成状态
const compiling = ref(false)
const generating = ref(false)
const generatedImage = ref('')
const compiledPrompt = ref('')
const isBlueprintOutdated = ref(false)

// 初始化
onMounted(async () => {
  try {
    const [g, s] = await Promise.all([axios.get(`${API_BASE}/init`), axios.get(`${API_BASE}/styles`)])
    globalConfig.value = g.data
    styleList.value = s.data
    // 默认选中第一个风格（可选）
    // if (s.data.length > 0) handleStyleChange(s.data[0].id)
  } catch (e) { ElMessage.error('后端连接失败') }
  finally { loadingStyles.value = false }
})

// 监听变化：标记蓝图过期
watch(form, () => {
  if (compiledPrompt.value) {
    isBlueprintOutdated.value = true
  }
})

// === 智能风格切换 (Smart Keep) ===
const handleStyleChange = async (id) => {
  const oldFormData = { ...form }
  // 核心：保留构图参数
  const { aspect_ratio, shot_type, body_type, cup_size } = form

  // 清空 form 但保留响应式引用
  for (const k in form) delete form[k]
  Object.assign(form, { aspect_ratio, shot_type, body_type, cup_size })

  const res = await axios.get(`${API_BASE}/styles/${id}`)
  currentManifest.value = res.data.manifest
  currentSlotsData.value = res.data.slots_data

  // 智能合并插槽值
  Object.keys(res.data.slots_data).forEach(key => {
    const newSlotConfig = res.data.slots_data[key]
    const oldValue = oldFormData[key]

    // 如果新风格禁用了该槽，置空
    if (newSlotConfig.disabled) {
      form[key] = ''
    }
    // 如果有旧值，尝试保留（不做严格校验，提升体验）
    else if (oldValue) {
      form[key] = oldValue
    } else {
      form[key] = ''
    }
  })

  // 切换风格必定导致旧蓝图失效
  compiledPrompt.value = ''
  isBlueprintOutdated.value = false
}

const fileToBase64 = (file) => new Promise((resolve) => {
  const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result)
})
const handleFileChange = async (uploadFile, uploadFiles) => {
  base64Images.value = (await Promise.all(uploadFiles.map(f => fileToBase64(f.raw)))).map(res => res.split(',')[1])
  compiledPrompt.value = ''
}

// === 草稿计算 ===
const computedDraftPrompt = computed(() => {
  if (!currentManifest.value) return ''
  const styleId = getActiveStyleId()
  const builder = getBuilder(styleId)

  // 简单的容错
  if (!builder) return "Builder not found for style: " + styleId

  return builder.build({
    styleId,
    form,
    manifest: currentManifest.value,
    assets: currentSlotsData.value,
    hasImages: (base64Images.value?.length || 0) > 0
  }).prompt
})

const getActiveStyleId = () => {
  return currentStyleId.value || currentManifest.value?.id || 'anime_v1'
}

const isPhotographyStyle = () => String(getActiveStyleId()).startsWith('photography')

const copyPrompt = () => {
  navigator.clipboard.writeText(compiledPrompt.value || computedDraftPrompt.value)
  ElMessage.success('已复制')
}

// === 后端编译 ===
const handleCompile = async () => {
  compiling.value = true
  try {
    const payload = {
      prompt: computedDraftPrompt.value,
      style_config: currentManifest.value ? currentManifest.value.controller : null,
      images: base64Images.value,
      aspect_ratio: form.aspect_ratio || '3:4',
      disable_backend_physics: isPhotographyStyle()
    }
    const res = await axios.post(`${API_BASE}/compile`, payload)
    if (res.data.status === 'success') {
      compiledPrompt.value = res.data.blueprint
      isBlueprintOutdated.value = false
      ElMessage.success('蓝图已更新')
    } else {
      ElMessage.error(res.data.message || '编译失败')
    }
  } catch (e) { ElMessage.error('编译服务不可用') }
  finally { compiling.value = false }
}

const handleGenerate = async () => {
  generating.value = true
  generatedImage.value = ''
  try {
    // 自动重编译
    if (!compiledPrompt.value || isBlueprintOutdated.value) {
      await handleCompile()
    }

    // 如果编译依然失败，用草稿兜底（或报错阻止，看策略）
    const finalPrompt = compiledPrompt.value || computedDraftPrompt.value

    const payload = {
      prompt: finalPrompt,
      model: 'gemini-3-pro-image-preview',
      images: base64Images.value,
      aspect_ratio: form.aspect_ratio || '3:4',
      style_config: currentManifest.value ? currentManifest.value.controller : null,
      disable_backend_physics: isPhotographyStyle()
    }
    const res = await axios.post(`${API_BASE}/generate`, payload)
    if (res.data.status === 'success') {
      generatedImage.value = res.data.url
      ElMessage.success('生成成功')
      // 滚动到图片区
      setTimeout(() => {
        document.querySelector('.result-display')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } else { ElMessage.error(res.data.message || '生成失败') }
  } catch (e) { ElMessage.error('请求出错') }
  finally { generating.value = false }
}

const shortStyle = (style) => {
  const s = String(style || 'image').toLowerCase().trim()
  const map = {
    photography: 'photo',
    photo: 'photo',
    anime: 'anime',
    anime_v1: 'anime',
    illustration: 'illu',
    cinematic: 'cine',
    portrait: 'prt',
  }
  return (map[s] || s.replace(/[^a-z0-9]+/g, '').slice(0, 8) || 'image')
}

const yymmdd = () => {
  const d = new Date()
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

const rand4 = () => Math.random().toString(36).slice(2, 6)

const downloadImage = (url, styleName) => {
  if (!url) return

  const style = shortStyle(styleName)
  const filename = `${style}-${yymmdd()}-${rand4()}.png`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// === UI 辅助函数 ===
const getStyleIcon = (id) => {
  if (id.includes('photo')) return '📸'
  if (id.includes('anime')) return '🎨'
  if (id.includes('fantasy')) return '🐉'
  return '✨'
}

const getGroupIcon = (label) => {
  const l = label || ''
  if (l.includes('休闲')) return '☕'
  if (l.includes('纯欲')) return '🌸'
  if (l.includes('显身材')) return '🔥'
  if (l.includes('职场') || l.includes('正式')) return '💼'
  if (l.includes('运动')) return '🏃‍♀️'
  if (l.includes('传统')) return '🏮'
  if (l.includes('室内')) return '🏠'
  if (l.includes('户外') || l.includes('外景')) return '🌳'
  if (l.includes('旅拍')) return '✈️'
  return '📂'
}
</script>

<style>
/* 全局重置与变量 */
:root {
  --primary-color: #409EFF;
  --bg-color: #f5f7fa;
  --card-bg: #ffffff;
  --text-main: #303133;
  --text-secondary: #909399;
  --border-radius: 12px;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);
  --shadow-hover: 0 8px 16px rgba(0, 0, 0, 0.08);
}

body {
  margin: 0;
  background-color: var(--bg-color);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--text-main);
}

.app-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 导航栏 */
.navbar {
  background: var(--card-bg);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  padding: 12px 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
}

.brand h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
}

.highlight {
  color: var(--primary-color);
}

.tag {
  font-size: 10px;
  background: #ecf5ff;
  color: var(--primary-color);
  padding: 2px 6px;
  border-radius: 4px;
  vertical-align: middle;
}

/* 主容器 */
.main-container {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px;
  box-sizing: border-box;
}

/* 模块通用样式 */
.config-section {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
}

.config-section:hover {
  box-shadow: var(--shadow-hover);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  color: var(--text-main);
}

.step-num {
  background: var(--primary-color);
  color: white;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-right: 10px;
}

/* 1. 风格选择 Grid */
.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.style-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.style-card:hover {
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

.style-card.active {
  background: #ecf5ff;
  border-color: var(--primary-color);
  color: var(--primary-color);
  font-weight: 600;
}

.style-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.style-name {
  font-size: 13px;
}

.style-desc-box {
  margin-top: 16px;
  background: #f4f4f5;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #606266;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.style-desc-box p {
  margin: 0;
  line-height: 1.5;
}

/* 2 & 3. 表单优化 */
.compact-form .el-form-item {
  margin-bottom: 0;
}

.full-width {
  width: 100%;
}

.group-label {
  font-weight: bold;
  color: var(--text-main);
}

/* 右侧工作区 */
.sticky-wrapper {
  position: sticky;
  top: 80px;
  /* 避开 Navbar */
}

.prompt-workspace {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 20px;
  margin-bottom: 20px;
}

.card-shadow {
  box-shadow: var(--shadow-sm);
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.workspace-header .label {
  font-weight: 600;
  font-size: 14px;
}

.prompt-editor {
  position: relative;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.prompt-editor.is-outdated {
  border-color: #e6a23c;
}

.prompt-editor.is-outdated .el-textarea__inner {
  opacity: 0.6;
}

.outdated-tip {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  background: rgba(253, 246, 236, 0.95);
  color: #e6a23c;
  font-size: 12px;
  padding: 6px;
  text-align: center;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.code-font .el-textarea__inner {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  border: none;
  background: #fafafa;
  padding: 12px;
}

.desktop-action {
  margin-top: 16px;
}

.gen-btn-primary {
  width: 100%;
  height: 48px;
  font-size: 16px;
  letter-spacing: 1px;
  border-radius: 8px;
}

/* 结果展示 */
.result-display {
  background: var(--card-bg);
  border-radius: var(--border-radius);
  padding: 16px;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-wrapper {
  width: 100%;
}

.final-image {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.image-actions {
  margin-top: 16px;
  text-align: center;
}

/* 加载动画 */
.loader {
  border: 3px solid #f3f3f3;
  border-radius: 50%;
  border-top: 3px solid var(--primary-color);
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* 移动端 FAB */
.mobile-fab {
  display: none;
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--primary-color);
  color: white;
  padding: 12px 24px;
  border-radius: 30px;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
  z-index: 1000;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  cursor: pointer;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(10px);
  opacity: 0;
}

/* 响应式 */
@media (max-width: 768px) {

  .left-panel,
  .right-panel {
    width: 100% !important;
  }

  .mobile-fab {
    display: flex;
  }

  .desktop-action {
    display: none;
  }

  .sticky-wrapper {
    position: static;
  }
}
</style>