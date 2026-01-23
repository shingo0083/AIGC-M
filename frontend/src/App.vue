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
                <el-radio-button v-for="style in styleList" :key="style.id" :value="style.id">{{ style.name
                  }}</el-radio-button>
              </el-radio-group>
              <div v-if="currentManifest" class="style-desc">{{ currentManifest.description }}</div>
            </el-card>

            <el-card class="box-card" v-if="currentStyleId">
              <template #header>
                <div class="card-header"><span>第二步：基础构图 (Composition)</span></div>
              </template>
              <el-row :gutter="10">
                <el-col :span="6" :xs="12"><el-form-item label="画幅"><el-select v-model="form.aspect_ratio"><el-option
                        v-for="o in globalConfig.aspect_ratios" :key="o.value" :label="o.label"
                        :value="o.value" /></el-select></el-form-item></el-col>
                <el-col :span="6" :xs="12"><el-form-item label="景别"><el-select v-model="form.shot_type"
                      clearable><el-option v-for="o in globalConfig.shot_types" :key="o.value" :label="o.label"
                        :value="o.value" /></el-select></el-form-item></el-col>
                <el-col :span="6" :xs="12"><el-form-item label="体型"><el-select v-model="form.body_type"
                      clearable><el-option v-for="o in globalConfig.body_types" :key="o.value" :label="o.label"
                        :value="o.value" /></el-select></el-form-item></el-col>
                <el-col :span="6" :xs="12"><el-form-item label="罩杯"><el-select v-model="form.cup_size"
                      clearable><el-option v-for="o in globalConfig.cup_sizes" :key="o.value" :label="o.label"
                        :value="o.value" /></el-select></el-form-item></el-col>
              </el-row>
            </el-card>

            <el-card class="box-card" v-if="currentManifest">
              <template #header>
                <div class="card-header"><span>第三步：细节配置 (Details)</span></div>
              </template>
              <el-row :gutter="15">
                <el-col :span="12" :xs="24" :sm="12" v-for="(slotData, key) in currentSlotsData" :key="key">
                  <el-form-item :label="slotData.label">
                    <el-select v-model="form[key]" :disabled="slotData.disabled" filterable allow-create clearable
                      :placeholder="slotData.disabled ? '不可用' : '选择...'">
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
                <div class="card-header"><span>第四步：参考图/垫图</span></div>
              </template>
              <el-upload v-model:file-list="fileList" action="#" list-type="picture-card" :auto-upload="false"
                :on-change="handleFileChange" :limit="3">
                <el-icon>
                  <Plus />
                </el-icon>
              </el-upload>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="24" :md="11" :lg="10" class="right-panel">
            <div class="sticky-wrapper">
              <el-card class="box-card result-card" shadow="hover" v-if="currentManifest">
                <template #header>
                  <div class="card-header">
                    <span>生成指令 (Prompt)</span>
                    <div>
                      <el-button type="warning" plain size="small" @click="handleCompile" :loading="compiling">
                        ⚡ 优化并预览指令
                      </el-button>
                      <el-button link type="primary" @click="copyPrompt">复制</el-button>
                    </div>
                  </div>
                </template>

                <el-input :model-value="compiledPrompt || computedDraftPrompt" type="textarea" :rows="10" readonly
                  resize="none" placeholder="等待配置..." class="prompt-input" />

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
                    class="result-image" />
                  <div class="image-tools">
                    <el-button type="primary" :icon="Download" size="large" @click="downloadImage(generatedImage)"
                      style="width: 80%">下载保存</el-button>
                  </div>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Plus, Download, Loading } from '@element-plus/icons-vue'
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
const compiledPrompt = ref('') // 存储后端返回的“真·蓝图”

// 初始化
onMounted(async () => {
  try {
    const [g, s] = await Promise.all([axios.get(`${API_BASE}/init`), axios.get(`${API_BASE}/styles`)])
    globalConfig.value = g.data
    styleList.value = s.data
  } catch (e) { ElMessage.error('后端连接失败') }
  finally { loadingStyles.value = false }
})

// 监听选项变化，一旦变化，清空之前的编译结果，退回草稿预览状态
// 这样用户就知道现在的选项还没“生效”到蓝图中
watch(form, () => {
  compiledPrompt.value = ''
})

// 处理逻辑
const handleStyleChange = async (id) => {
  const { aspect_ratio, shot_type, body_type, cup_size } = form
  for (const k in form) delete form[k]
  Object.assign(form, { aspect_ratio, shot_type, body_type, cup_size })
  const res = await axios.get(`${API_BASE}/styles/${id}`)
  currentManifest.value = res.data.manifest
  currentSlotsData.value = res.data.slots_data
  Object.keys(res.data.slots_data).forEach(k => form[k] = '')
  compiledPrompt.value = '' // 切换风格也重置
}

const fileToBase64 = (file) => new Promise((resolve) => {
  const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result)
})
const handleFileChange = async (uploadFile, uploadFiles) => {
  base64Images.value = (await Promise.all(uploadFiles.map(f => fileToBase64(f.raw)))).map(res => res.split(',')[1])
  compiledPrompt.value = '' // 上传图片也重置
}

// === 纯前端拼接的“草稿” ===
const computedDraftPrompt = computed(() => {
  if (!currentManifest.value) return ''

  const styleId =
    currentStyleId.value ||
    currentManifest.value.id ||
    currentManifest.value.style_id ||
    'anime_v1'

  const builder = getBuilder(styleId)

  const result = builder.build({
    styleId,
    form,
    manifest: currentManifest.value,
    assets: currentSlotsData.value,
    hasImages: (base64Images.value?.length || 0) > 0
  })

  return result.prompt
})

const copyPrompt = () => {
  navigator.clipboard.writeText(compiledPrompt.value || computedDraftPrompt.value)
  ElMessage.success('已复制')
}

const getActiveStyleId = () => {
  return (
    currentStyleId.value ||
    currentManifest.value?.id ||
    currentManifest.value?.style_id ||
    'anime_v1'
  )
}

const isPhotographyStyle = () => String(getActiveStyleId()).startsWith('photography')

// 🔥🔥🔥 新增：调用后端编译 Prompt 🔥🔥🔥
const handleCompile = async () => {
  compiling.value = true
  try {
    const payload = {
      prompt: computedDraftPrompt.value, // 把草稿发给后端
      style_config: currentManifest.value ? currentManifest.value.controller : null,
      images: base64Images.value, // 告诉后端有没有图片(影响锁脸指令)
      aspect_ratio: form.aspect_ratio || '3:4',
      disable_backend_physics: isPhotographyStyle()
    }
    const res = await axios.post(`${API_BASE}/compile`, payload)
    if (res.data.status === 'success') {
      compiledPrompt.value = res.data.blueprint // 更新为“真·蓝图”
      ElMessage.success('指令已优化')
    } else {
      compiledPrompt.value = ''
      ElMessage.error(res.data.message || '编译失败')
    }
  } catch (e) { ElMessage.error('编译失败') }
  finally { compiling.value = false }
}

// 生成图片
const handleGenerate = async () => {
  generating.value = true
  generatedImage.value = ''
  try {
    // 自动触发一次编译（确保 Prompt 是最新的）
    if (!compiledPrompt.value) await handleCompile()
    if (!compiledPrompt.value) {
      ElMessage.error('指令编译失败，已中止生成')
      return
    }
    const payload = {
      prompt: computedDraftPrompt.value, // 后端会再次由 draft -> blueprint，保证一致性
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
    } else { ElMessage.error(res.data.message || '生成失败') }
  } catch (e) { ElMessage.error('请求出错') }
  finally { generating.value = false }
}

const downloadImage = (url) => {
  const pad2 = (n) => String(n).padStart(2, "0")
  const d = new Date()
  const ymd = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
  const rand = Math.floor(100000 + Math.random() * 900000) // 6位随机数

  const sid = String(currentStyleId?.value ?? currentStyleId ?? "")
  const prefix =
    sid.startsWith("photography") ? "Photo" :
      sid.startsWith("anime_v1") ? "Anime" :
        sid.startsWith("fantasy_v1") ? "Fanta" :
          "Genesis"

  const link = document.createElement("a")
  link.href = url
  link.download = `${prefix}_${ymd}_${rand}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

</script>

<style>
/* 保持原有样式，新增部分样式 */
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

.el-card {
  margin-bottom: 20px;
  border-radius: 8px;
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

@media (min-width: 992px) {
  .sticky-wrapper {
    position: sticky;
    top: 20px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

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

.image-display-area {
  margin-top: 20px;
  background: white;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  text-align: center;
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
  max-height: 80vh;
  background-color: #eee;
}

.image-tools {
  margin-top: 15px;
}

.loading-placeholder {
  padding: 40px;
  color: #409EFF;
}
</style>