import type { PlayerProfile } from './types'

/** 档案不进快照，所以单独一个键，跟成员 D 的存档互不影响。
    D 若要收编进 src/storage，整文件搬走即可，导出的四个函数就是它的接缝。 */
export const PROFILE_KEY = 'campusmock:profile'

/** 专业是玩家手打、原样进提示词的自由文本，限长并压掉换行，免得一句话顶掉整段档案约束。 */
export const MAJOR_MAX = 20

/** 成员 C 的 PlayerProfile 两个字段都必填，所以缺任何一项都当成没填，让提示词走中性表述分支。 */
export function normalizeProfile(raw: Partial<PlayerProfile> | null): PlayerProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const major = typeof raw.major === 'string' ? raw.major.replace(/\s+/g, ' ').trim().slice(0, MAJOR_MAX) : ''
  const gender = raw.gender === '男' || raw.gender === '女' ? raw.gender : ''
  return major && gender ? { gender, major } : null
}

export function loadProfile(): PlayerProfile | null {
  try {
    const stored = localStorage.getItem(PROFILE_KEY)
    return stored ? normalizeProfile(JSON.parse(stored) as Partial<PlayerProfile>) : null
  } catch {
    return null
  }
}

/** 写不进去不拦玩家：档案只影响文案贴不贴身，缺了就是中性表述，不值得为它挡开局。 */
export function saveProfile(profile: PlayerProfile | null): void {
  try {
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    else localStorage.removeItem(PROFILE_KEY)
  } catch {
    // 隐私模式下写入会抛，这里刻意不提示
  }
}

export function clearProfile(): void {
  saveProfile(null)
}
