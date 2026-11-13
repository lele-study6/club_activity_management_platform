export const STATUS_MAP = {
  pending:  { text: '待审核', type: 'warning' },
  rejected: { text: '已驳回', type: 'danger' },
  signup:   { text: '报名中', type: 'success' },
  ongoing:  { text: '进行中', type: 'primary' },
  ended:    { text: '已结束', type: 'info' },
}

export const statusMeta = (s) => STATUS_MAP[s] || { text: '未知', type: 'info' }

export const ROLE_HOME = {
  student: '/activities',
  club: '/publish',
  admin: '/admin/audit',
}