<template>
  <el-card
    class="activity-card"
    shadow="hover"
    :body-style="{ padding: '0' }"
    role="button"
    tabindex="0"
    :aria-label="`查看活动：${title}`"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <!-- 活动海报占位图 -->
    <div class="cover" :style="{ background: gradient }">
      <span class="cover-emoji" aria-hidden="true">{{ emoji }}</span>
      <el-tag class="status-tag" :type="meta.type" effect="dark" size="small">
        {{ meta.text }}
      </el-tag>
      <el-tag
        v-if="joined"
        class="joined-tag"
        type="success"
        effect="dark"
        size="small"
      >
        已报名
      </el-tag>
    </div>

    <div class="body">
      <h3 class="title" :title="title">{{ title }}</h3>

      <p class="meta">
        <el-icon><Calendar /></el-icon>
        <span>{{ timeText }}</span>
      </p>
      <p class="meta">
        <el-icon><Location /></el-icon>
        <span class="ellipsis" :title="place">{{ place }}</span>
      </p>

      <div class="footer">
        <el-tag size="small" type="info" effect="plain">{{ clubName }}</el-tag>
        <span class="count">
          <el-icon><User /></el-icon>
          {{ enrolledCount }}/{{ capacity || '不限' }}
        </span>
      </div>

      <!-- 无容量（不限）时不渲染进度条，避免误导性的 0% -->
      <el-progress
        v-if="capacity"
        :percentage="percent"
        :show-text="false"
        :stroke-width="5"
        :status="isFull ? 'exception' : ''"
      />
    </div>
  </el-card>
</template>

<script>
/**
 * 模块级常量：只在模块加载时创建一次，
 * 避免列表渲染时每张卡片实例重复创建数组。
 */
const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
]
const EMOJIS = ['🎯', '🚀', '🏀', '🎨', '💻', '🤝', '🎤', '📚']
</script>

<script setup>
import { computed } from 'vue'
import { Calendar, Location, User } from '@element-plus/icons-vue'
import { statusMeta } from '@/utils/constants'

const DEFAULT_TITLE = '未命名活动'

const props = defineProps({
  activity: { type: Object, required: true },
})
const emit = defineEmits(['click'])

/** 统一转为非负整数：数字 id 直接取模；非数字 id（如 UUID）用稳定字符串哈希，避免全部退化为同一配色 */
const toIndex = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.abs(Math.trunc(v))
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Math.abs(Number(v.trim()) % Number.MAX_SAFE_INTEGER)
  const s = String(v ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
/** 统一转为非负数字，用于人数、容量等展示字段 */
const toPositive = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

const text = (v, fallback) => String(v ?? '').trim() || fallback

const meta = computed(() => statusMeta(props.activity?.status))
const title = computed(() => text(props.activity?.title, DEFAULT_TITLE))
const clubName = computed(() => text(props.activity?.clubName, '未知社团'))
const place = computed(() => text(props.activity?.place, '地点待定'))
const timeText = computed(() => {
  const d = text(props.activity?.date, '')
  const s = text(props.activity?.startTime, '')
  const t = [d, s].filter(Boolean).join(' ')
  return t || '时间待定'
})
const joined = computed(() => Boolean(props.activity?.joined))

const enrolledCount = computed(() => toPositive(props.activity?.enrolledCount))
const capacity = computed(() => toPositive(props.activity?.capacity))

/** 容量非法或缺失时按 0% 处理，避免 NaN 传给 el-progress */
const percent = computed(() => {
  if (!capacity.value) return 0
  const raw = (enrolledCount.value / capacity.value) * 100
  return Math.min(100, Math.round(raw))
})
/** 用原始比例判断满员，避免四舍五入导致的“提前满员” */
const isFull = computed(
  () => capacity.value > 0 && enrolledCount.value >= capacity.value
)

/** 同一 id 只计算一次索引，gradient 与 emoji 共用 */
const themeIndex = computed(() => toIndex(props.activity?.id))
const gradient = computed(() => GRADIENTS[themeIndex.value % GRADIENTS.length])
const emoji = computed(() => EMOJIS[themeIndex.value % EMOJIS.length])

/** 把活动对象一并抛出，父组件无需再按 id 回查 */
function handleClick() {
  emit('click', props.activity)
}
</script>

<style scoped>
.activity-card {
  cursor: pointer;
  border-radius: 10px;
  overflow: hidden;
  transition: transform .18s ease, box-shadow .18s ease;
}
.activity-card:hover { transform: translateY(-3px); }
/* 键盘聚焦提示，配合 role="button" 保证可访问性 */
.activity-card:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 2px;
}
.cover {
  position: relative;
  height: 108px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-emoji { font-size: 40px; opacity: .85; }
.status-tag { position: absolute; top: 10px; right: 10px; }
.joined-tag { position: absolute; top: 10px; left: 10px; }
.body { padding: 12px 14px 16px; }
.title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  height: 42px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  font-size: 12px;
  color: #909399;
}
/* min-width: 0 让 flex 子项可收缩，否则长地名会撑开并挤出图标 */
.ellipsis { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0 8px;
}
.count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #606266;
}
</style>