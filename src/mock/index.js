import { db } from './db'

/* ---------------- 工具 ---------------- */
const ok = (data) => ({ code: 0, data, message: 'ok' })

const pad = (n) => String(n).padStart(2, '0')
const fmtDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const nowStr = () => {
  const d = new Date()
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const safeUser = (u) => {
  if (!u) return null
  const { password, ...rest } = u
  return rest
}

function parseBody(data) {
  if (!data) return {}
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return {}
    }
  }
  return data
}

/** 从 Authorization 头解析出当前用户 */
function currentUser(config) {
  const headers = config.headers || {}
  let auth = headers.Authorization || headers.authorization
  if (!auth && typeof headers.get === 'function') auth = headers.get('Authorization')
  if (!auth) return null
  const token = String(auth).replace(/^Bearer\s+/i, '')
  const id = Number(token.replace('token-', ''))
  return db.data.users.find((u) => u.id === id) || null
}

/** 日期已过 → 自动结束 */
function syncStatus() {
  const today = fmtDate(new Date())
  let changed = false
  db.data.activities.forEach((a) => {
    if (['signup', 'ongoing'].includes(a.status) && a.date < today) {
      a.status = 'ended'
      changed = true
    }
  })
  if (changed) db.save()
}

/** 活动实体补全（社团名 / 已报人数 / 是否已报名） */
function enrichActivity(a, user) {
  const club = db.data.clubs.find((c) => c.id === a.clubId)
  const enrolledCount = db.data.enrolls.filter((e) => e.activityId === a.id).length
  const joined = !!(user &&
    db.data.enrolls.some((e) => e.activityId === a.id && e.userId === user.id))
  return {
    ...a,
    clubName: club ? club.name : '未知社团',
    enrolledCount,
    remain: Math.max(0, a.capacity - enrolledCount),
    joined,
  }
}

/* ---------------- 业务处理器 ---------------- */

function handleLogin(body) {
  const u = db.data.users.find((x) => x.username === body.username)
  if (!u || u.password !== body.password) throw new Error('用户名或密码错误')
  return ok({ token: `token-${u.id}`, user: safeUser(u) })
}

function listActivities(query, user) {
  syncStatus()
  let list = db.data.activities.map((a) => enrichActivity(a, user))

  // 学生只看已通过审核的活动
  if (user.role === 'student') {
    list = list.filter((a) => ['signup', 'ongoing', 'ended'].includes(a.status))
  }

  if (query.status && query.status !== 'all') {
    list = list.filter((a) => a.status === query.status)
  }
  if (query.clubId) {
    list = list.filter((a) => a.clubId === Number(query.clubId))
  }
  if (query.keyword) {
    const k = String(query.keyword).toLowerCase().trim()
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(k) ||
        a.place.toLowerCase().includes(k) ||
        a.clubName.toLowerCase().includes(k)
    )
  }
  if (query.mine === 'true' && user.role === 'club') {
    list = list.filter((a) => a.clubId === user.clubId)
  }

  list.sort((a, b) => (a.date === b.date ? b.id - a.id : a.date > b.date ? -1 : 1))
  return ok(list)
}

function getOneActivity(id, user) {
  syncStatus()
  const a = db.data.activities.find((x) => x.id === id)
  if (!a) throw new Error('活动不存在或已被删除')
  if (user.role === 'student' && ['pending', 'rejected'].includes(a.status)) {
    throw new Error('该活动尚未发布')
  }
  return ok(enrichActivity(a, user))
}

function createActivity(body, user) {
  if (!['club', 'admin'].includes(user.role)) throw new Error('只有社团管理员可以发布活动')

  if (!body.title || !body.title.trim()) throw new Error('请填写活动标题')
  if (!body.date) throw new Error('请选择活动日期')
  if (!body.place || !body.place.trim()) throw new Error('请填写活动地点')
  if (!body.capacity || Number(body.capacity) <= 0) throw new Error('请填写有效的人数上限')

  const act = {
    id: db.data.seq.activity++,
    clubId: user.role === 'club' ? user.clubId : Number(body.clubId) || 1,
    title: body.title.trim(),
    date: body.date,
    startTime: body.startTime || '',
    endTime: body.endTime || '',
    place: body.place.trim(),
    capacity: Number(body.capacity),
    status: 'pending', // 统一进入待审核
    description: body.description || '',
    createTime: nowStr(),
  }
  db.data.activities.unshift(act)
  db.save()
  return ok(enrichActivity(act, user))
}

function updateActivity(id, body, user) {
  const act = db.data.activities.find((a) => a.id === id)
  if (!act) throw new Error('活动不存在')

  if (user.role === 'admin') {
    if (body.status) {
      const allow = ['pending', 'signup', 'rejected', 'ongoing', 'ended']
      if (!allow.includes(body.status)) throw new Error('非法的活动状态')
      act.status = body.status
    }
  } else if (user.role === 'club') {
    if (act.clubId !== user.clubId) throw new Error('无权操作其他社团的活动')
    if (body.status) {
      if (!['ongoing', 'ended'].includes(body.status)) throw new Error('社团只能将活动置为进行中/已结束')
      act.status = body.status
    }
    ;['title', 'date', 'place', 'capacity', 'description', 'startTime', 'endTime'].forEach((k) => {
      if (body[k] !== undefined) act[k] = k === 'capacity' ? Number(body[k]) : body[k]
    })
  } else {
    throw new Error('无权操作')
  }

  db.save()
  return ok(enrichActivity(act, user))
}

function removeActivity(id, user) {
  const act = db.data.activities.find((a) => a.id === id)
  if (!act) throw new Error('活动不存在')
  if (user.role === 'club' && act.clubId !== user.clubId) throw new Error('无权删除其他社团的活动')
  if (user.role === 'student') throw new Error('无权删除活动')

  db.data.activities = db.data.activities.filter((a) => a.id !== id)
  db.data.enrolls = db.data.enrolls.filter((e) => e.activityId !== id)
  db.save()
  return ok(true)
}

/** 报名：重复拦截 + 容量判断 */
function createEnroll(body, user) {
  const activityId = Number(body.activityId)
  const act = db.data.activities.find((a) => a.id === activityId)
  if (!act) throw new Error('活动不存在')

  if (act.status !== 'signup') throw new Error('该活动当前不在报名中')

  const exists = db.data.enrolls.some(
    (e) => e.activityId === activityId && e.userId === user.id
  )
  if (exists) throw new Error('您已报名该活动，请勿重复报名')

  const count = db.data.enrolls.filter((e) => e.activityId === activityId).length
  if (count >= act.capacity) throw new Error('报名人数已满，下次早点来哦')

  const record = {
    id: db.data.seq.enroll++,
    activityId,
    userId: user.id,
    time: nowStr(),
  }
  db.data.enrolls.push(record)
  db.save()
  return ok(record)
}

function listMyEnrolls(user) {
  const list = db.data.enrolls
    .filter((e) => e.userId === user.id)
    .map((e) => {
      const act = db.data.activities.find((a) => a.id === e.activityId)
      return { ...e, activity: act ? enrichActivity(act, user) : null }
    })
    .filter((e) => e.activity)
    .sort((a, b) => (a.time < b.time ? 1 : -1))
  return ok(list)
}

function listActivityEnrolls(query, user) {
  const activityId = Number(query.activityId)
  const act = db.data.activities.find((a) => a.id === activityId)
  if (!act) throw new Error('活动不存在')

  if (user.role === 'student') throw new Error('无权查看报名名单')
  if (user.role === 'club' && act.clubId !== user.clubId) {
    throw new Error('无权查看其他社团的报名名单')
  }

  const list = db.data.enrolls
    .filter((e) => e.activityId === activityId)
    .map((e, i) => {
      const u = db.data.users.find((x) => x.id === e.userId)
      return {
        id: e.id,
        index: i + 1,
        userId: e.userId,
        userName: u ? u.name : '未知用户',
        studentNo: u?.studentNo || '-',
        time: e.time,
      }
    })

  return ok({ activity: enrichActivity(act, user), list })
}

function removeEnroll(id, user) {
  const idx = db.data.enrolls.findIndex((e) => e.id === id)
  if (idx === -1) throw new Error('报名记录不存在')
  if (db.data.enrolls[idx].userId !== user.id) throw new Error('只能取消自己的报名')
  db.data.enrolls.splice(idx, 1)
  db.save()
  return ok(true)
}

function listMyClubs(user) {
  if (user.role === 'club') {
    const club = db.data.clubs.find((c) => c.id === user.clubId)
    if (!club) return ok([])
    return ok([
      {
        ...club,
        relation: '我管理的社团',
        activityCount: db.data.activities.filter((a) => a.clubId === club.id).length,
      },
    ])
  }
  if (user.role === 'admin') {
    return ok(
      db.data.clubs.map((c) => ({
        ...c,
        relation: '平台全部社团',
        activityCount: db.data.activities.filter((a) => a.clubId === c.id).length,
      }))
    )
  }
  const ids = user.clubIds || []
  return ok(
    db.data.clubs
      .filter((c) => ids.includes(c.id))
      .map((c) => ({
        ...c,
        relation: '已加入',
        activityCount: db.data.activities.filter((a) => a.clubId === c.id).length,
      }))
  )
}

/** 解析 URL + 合并 axios 的 config.params（自定义 adapter 必须手动合并） */
function resolveQuery(config) {
  const [rawPath, rawQuery] = String(config.url || '').split('?')
  const query = Object.fromEntries(new URLSearchParams(rawQuery || ''))

  const params = config.params
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query[k] = String(v)
    })
  }
  return { path: rawPath, query }
}

/* ---------------- 路由分发 ---------------- */
function handle(config) {
  const method = (config.method || 'get').toLowerCase()
  const { path: rawPath, query } = resolveQuery(config)
  const path = rawPath.replace(/^\/api/, '')
  const body = parseBody(config.data)
  const seg = path.split('/').filter(Boolean)

  /* ---------- 无需登录 ---------- */
  if (path === '/login' && method === 'post') return handleLogin(body)

  /* ---------- 需要登录 ---------- */
  const user = currentUser(config)
  if (!user) throw new Error('登录已失效，请重新登录')

  if (path === '/me' && method === 'get') return ok(safeUser(user))

  if (seg[0] === 'clubs') {
    if (seg[1] === 'my' && method === 'get') return listMyClubs(user)
    if (seg.length === 1 && method === 'get') return ok(db.data.clubs)
  }

  if (seg[0] === 'activities') {
    if (seg.length === 1 && method === 'get') return listActivities(query, user)
    if (seg.length === 1 && method === 'post') return createActivity(body, user)
    if (seg.length === 2) {
      const id = Number(seg[1])
      if (method === 'get') return getOneActivity(id, user)
      if (method === 'put') return updateActivity(id, body, user)
      if (method === 'delete') return removeActivity(id, user)
    }
  }

  if (seg[0] === 'enrolls') {
    if (seg[1] === 'my' && method === 'get') return listMyEnrolls(user)
    if (seg.length === 1 && method === 'get') return listActivityEnrolls(query, user)
    if (seg.length === 1 && method === 'post') return createEnroll(body, user)
    if (seg.length === 2 && method === 'delete') return removeEnroll(Number(seg[1]), user)
  }

  throw new Error(`接口不存在：${method.toUpperCase()} ${path}`)
}

/* ---------------- axios 适配器 ---------------- */
export function mockAdapter(config) {
  return new Promise((resolve) => {
    setTimeout(() => {
      let result
      try {
        result = handle(config)
      } catch (e) {
        result = { code: 1, data: null, message: e.message || '服务器开小差了' }
      }
      resolve({
        data: result,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      })
    }, 260)
  })
}