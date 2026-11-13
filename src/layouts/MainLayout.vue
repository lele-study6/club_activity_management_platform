<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <span class="logo-icon">🎓</span>
        <span>社团活动平台</span>
      </div>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item index="/activities">
          <el-icon><Grid /></el-icon><span>活动列表</span>
        </el-menu-item>
        <el-menu-item v-if="userStore.canPublish" index="/publish">
          <el-icon><Plus /></el-icon><span>发布活动</span>
        </el-menu-item>
        <el-menu-item index="/center">
          <el-icon><User /></el-icon><span>个人中心</span>
        </el-menu-item>
        <el-menu-item v-if="userStore.isAdmin" index="/admin/audit">
          <el-icon><CircleCheck /></el-icon><span>活动审核</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="page-title">{{ route.meta.title || '' }}</div>
        <el-dropdown @command="onCommand">
          <span class="user-chip">
            <el-avatar :size="28">{{ userStore.user?.name?.slice(0, 1) }}</el-avatar>
            <span class="name">{{ userStore.user?.name }}</span>
            <el-tag size="small" type="info" effect="plain">{{ userStore.roleText }}</el-tag>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="center">个人中心</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = computed(() => {
  const p = route.path
  if (p.startsWith('/activity/')) return '/activities'
  if (p.startsWith('/center')) return '/center'
  if (p.startsWith('/manage/')) return '/publish'
  return p
})

function onCommand(cmd) {
  if (cmd === 'center') return router.push('/center/enrolls')
  if (cmd === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
      .then(() => {
        userStore.logout()
        ElMessage.success('已退出登录')
        router.replace('/login')
      })
      .catch(() => {})
  }
}
</script>

<style scoped>
.layout { height: 100%; }
.aside {
  background: #fff;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  font-weight: 700;
  font-size: 16px;
  color: #409eff;
  border-bottom: 1px solid #f0f2f5;
}
.logo-icon { font-size: 20px; }
.menu { border-right: none; }
.header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-title { font-size: 17px; font-weight: 600; }
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
}
.user-chip .name { font-size: 14px; }
.main { padding: 18px; }
</style>