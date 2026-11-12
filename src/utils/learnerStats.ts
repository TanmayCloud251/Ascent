import type { LearnerProgress } from '../schemas/course'
import type { PageItem, PageModuleItem, Project } from '../types/ascent'

export interface ProjectCompletionSummary {
  projectId: string
  totalModules: number
  completedModules: number
  percentComplete: number
  isCompleted: boolean
}

export interface StreakMetrics {
  currentStreak: number
  longestStreak: number
  lastActiveDateKey: string | null
  isAliveToday: boolean
  hasCompletedToday: boolean
  daysUntilLost: number
  statusLabel: string
  activeDaysCount: number
  dailyCounts: Record<string, number>
}

export interface HeatmapDayCell {
  dateKey: string
  dateLabel: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  dayOfWeek: number // 0 (Sun) - 6 (Sat)
  monthIndex: number // 0 - 11
  isFuture: boolean
  isToday: boolean
}

export interface HeatmapWeekColumn {
  weekIndex: number
  startDateKey: string
  days: HeatmapDayCell[]
}

export interface HeatmapMonthLabel {
  weekIndex: number
  label: string
}

export interface ActivityHeatmapData {
  weeks: HeatmapWeekColumn[]
  monthLabels: HeatmapMonthLabel[]
  maxCount: number
  totalCompletionsInWindow: number
}

export interface ProfileStats {
  totalModulesCompleted: number
  projectsStarted: number
  projectsCompleted: number
  totalHintsUsed: number
  solutionsViewed: number
  totalAttempts: number
  attemptedModulesCount: number
  averageAttemptsPerModule: number
  totalActiveDays: number
  streak: StreakMetrics
}

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Converts a Date or ISO timestamp string into a local-calendar YYYY-MM-DD key
 * (or uses an explicit IANA timeZone if supplied, useful for timezone boundary tests).
 */
export function toLocalDateKey(input: Date | string | undefined | null, timeZone?: string): string | null {
  if (!input) return null
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return null

  if (timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      const parts = formatter.formatToParts(d)
      const year = parts.find(p => p.type === 'year')?.value
      const month = parts.find(p => p.type === 'month')?.value
      const day = parts.find(p => p.type === 'day')?.value
      if (year && month && day) {
        return `${year}-${month}-${day}`
      }
    } catch {
      // Fall back to system local getters if Intl fails
    }
  }

  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * Adds or subtracts calendar days to a YYYY-MM-DD key using UTC date arithmetic
 * so DST transitions never skip or duplicate a calendar day.
 */
export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const utc = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + deltaDays))
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`
}

/**
 * Returns day of week (0 = Sun .. 6 = Sat) for a YYYY-MM-DD calendar key.
 */
export function getDayOfWeekFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay()
}

export function formatDateKeyLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const monthName = MONTH_SHORT_NAMES[(m || 1) - 1] || 'Jan'
  return `${monthName} ${d}, ${y}`
}

/**
 * Computes user avatar initials from explicit avatarInitials or fallback display name.
 */
export function getUserInitials(user: { name?: string | null; avatarInitials?: string | null }): string {
  const custom = (user.avatarInitials || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (custom.length > 0) {
    return custom.slice(0, 3)
  }
  const cleanName = (user.name || '').trim()
  if (!cleanName) return 'AS'
  const words = cleanName.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }
  return cleanName.slice(0, 2).toUpperCase()
}

/**
 * Looks up a module's LearnerProgress record across scoped ("projectId__modId", "projectId::modId")
 * and unscoped ("modId") storage keys.
 */
export function findModuleProgressRecord(
  projectId: string,
  moduleId: string,
  progressByKey: Record<string, LearnerProgress>
): LearnerProgress | null {
  return (
    progressByKey[`${projectId}__${moduleId}`] ||
    progressByKey[`${projectId}::${moduleId}`] ||
    progressByKey[moduleId] ||
    null
  )
}

export function isModuleDoneInProgress(
  mod: PageModuleItem,
  progress: LearnerProgress | null
): boolean {
  return mod.status === 'done' || Boolean(progress?.passed) || Boolean(progress?.completedWithSolution)
}

/**
 * Computes effective per-module statuses (done / active / locked) for a single page.
 */
export function computePageModuleStatuses(
  projectId: string,
  page: PageItem,
  progressByKey: Record<string, LearnerProgress>
): Array<{
  module: PageModuleItem
  status: 'done' | 'active' | 'locked'
  progress: LearnerProgress | null
}> {
  const modules = page.modules || []
  const doneFlags = modules.map(mod => {
    const prog = findModuleProgressRecord(projectId, mod.id, progressByKey)
    return {
      module: mod,
      progress: prog,
      done: isModuleDoneInProgress(mod, prog)
    }
  })

  const firstIncompleteIndex = doneFlags.findIndex(item => !item.done)

  return doneFlags.map((item, idx) => ({
    module: item.module,
    progress: item.progress,
    status: item.done ? 'done' : idx === firstIncompleteIndex ? 'active' : 'locked'
  }))
}

/**
 * Computes real completion counts and percentage for a single project directly from
 * its pages/modules and LearnerProgress records.
 */
export function computeProjectCompletionSummary(
  project: Project,
  progressByKey: Record<string, LearnerProgress>
): ProjectCompletionSummary {
  const pages = project.pages || []
  let totalModules = 0
  let completedModules = 0

  for (const pg of pages) {
    const mods = pg.modules || []
    totalModules += mods.length
    for (const mod of mods) {
      const prog = findModuleProgressRecord(project.id, mod.id, progressByKey)
      if (isModuleDoneInProgress(mod, prog)) {
        completedModules++
      }
    }
  }

  const isCompleted =
    project.status === 'completed' ||
    (totalModules > 0 && completedModules === totalModules)

  const percentComplete =
    totalModules > 0
      ? Math.round((completedModules / totalModules) * 100)
      : isCompleted
      ? 100
      : 0

  return {
    projectId: project.id,
    totalModules,
    completedModules,
    percentComplete,
    isCompleted
  }
}

/**
 * Computes consecutive local-calendar day streaks strictly from Progress.completedAt timestamps.
 * A streak stays alive if the most recent module completion was today or yesterday.
 */
export function computeStreakMetrics(
  progressRecords: LearnerProgress[],
  now: Date = new Date(),
  timeZone?: string
): StreakMetrics {
  const dailyCounts: Record<string, number> = {}

  for (const record of progressRecords) {
    if (!record || (!record.passed && !record.completedWithSolution) || !record.completedAt) {
      continue
    }
    const dayKey = toLocalDateKey(record.completedAt, timeZone)
    if (!dayKey) continue
    dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1
  }

  const todayKey = toLocalDateKey(now, timeZone)!
  const yesterdayKey = addDaysToDateKey(todayKey, -1)

  // Ignore timestamps artificially dated after todayKey when counting streaks
  const validSortedDays = Object.keys(dailyCounts)
    .filter(dayKey => dayKey <= todayKey)
    .sort()

  if (validSortedDays.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDateKey: null,
      isAliveToday: false,
      hasCompletedToday: false,
      daysUntilLost: 0,
      statusLabel: 'No activity yet',
      activeDaysCount: 0,
      dailyCounts
    }
  }

  let longestStreak = 0
  let running = 0
  let prevDay: string | null = null

  for (const dayKey of validSortedDays) {
    if (prevDay && addDaysToDateKey(prevDay, 1) === dayKey) {
      running += 1
    } else {
      running = 1
    }
    if (running > longestStreak) {
      longestStreak = running
    }
    prevDay = dayKey
  }

  const hasCompletedToday = Boolean(dailyCounts[todayKey] && dailyCounts[todayKey] > 0)
  const hasCompletedYesterday = Boolean(dailyCounts[yesterdayKey] && dailyCounts[yesterdayKey] > 0)
  const lastActiveDateKey = validSortedDays[validSortedDays.length - 1]

  let currentStreak = 0
  if (hasCompletedToday || hasCompletedYesterday) {
    let cursor = hasCompletedToday ? todayKey : yesterdayKey
    while (dailyCounts[cursor] && dailyCounts[cursor] > 0) {
      currentStreak += 1
      cursor = addDaysToDateKey(cursor, -1)
    }
  }

  const isAliveToday = currentStreak > 0
  const daysUntilLost = !isAliveToday ? 0 : hasCompletedToday ? 2 : 1
  const statusLabel = !isAliveToday
    ? '0 days — complete a module today to start a new streak'
    : hasCompletedToday
    ? '2 days until lost — active today, safe through tomorrow'
    : '1 day until lost — complete a module today to keep your streak alive'

  return {
    currentStreak,
    longestStreak,
    lastActiveDateKey,
    isAliveToday,
    hasCompletedToday,
    daysUntilLost,
    statusLabel,
    activeDaysCount: validSortedDays.length,
    dailyCounts
  }
}

function getHeatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

/**
 * Builds a GitHub-style activity heatmap covering the last `weeks` weeks (default 26),
 * grouped into 7-day Sunday->Saturday columns in the learner's local calendar.
 */
export function computeActivityHeatmap(
  progressRecords: LearnerProgress[],
  now: Date = new Date(),
  weeks: number = 26,
  timeZone?: string
): ActivityHeatmapData {
  const streak = computeStreakMetrics(progressRecords, now, timeZone)
  const todayKey = toLocalDateKey(now, timeZone)!
  const todayDow = getDayOfWeekFromDateKey(todayKey)
  const currentWeekSunday = addDaysToDateKey(todayKey, -todayDow)
  const startSunday = addDaysToDateKey(currentWeekSunday, -((weeks - 1) * 7))

  const weekColumns: HeatmapWeekColumn[] = []
  const monthLabels: HeatmapMonthLabel[] = []
  let maxCount = 0
  let totalCompletionsInWindow = 0
  let lastLabeledMonth = -1
  let lastLabelWeek = -99

  for (let w = 0; w < weeks; w++) {
    const weekStartKey = addDaysToDateKey(startSunday, w * 7)
    const days: HeatmapDayCell[] = []

    for (let d = 0; d < 7; d++) {
      const dateKey = addDaysToDateKey(weekStartKey, d)
      const isFuture = dateKey > todayKey
      const count = isFuture ? 0 : streak.dailyCounts[dateKey] || 0
      if (count > maxCount) maxCount = count
      if (!isFuture) totalCompletionsInWindow += count

      const monthIdx = Number(dateKey.slice(5, 7)) - 1
      days.push({
        dateKey,
        dateLabel: formatDateKeyLabel(dateKey),
        count,
        level: getHeatmapLevel(count),
        dayOfWeek: d,
        monthIndex: monthIdx,
        isFuture,
        isToday: dateKey === todayKey
      })
    }

    // Label month header using the first non-future day in the week (or Sunday if all visible)
    const anchorDay = days.find(day => !day.isFuture) || days[0]
    if (anchorDay && anchorDay.monthIndex !== lastLabeledMonth) {
      if (w - lastLabelWeek >= 2) {
        monthLabels.push({
          weekIndex: w,
          label: MONTH_SHORT_NAMES[anchorDay.monthIndex]
        })
        lastLabelWeek = w
      }
      lastLabeledMonth = anchorDay.monthIndex
    }

    weekColumns.push({
      weekIndex: w,
      startDateKey: weekStartKey,
      days
    })
  }

  return {
    weeks: weekColumns,
    monthLabels,
    maxCount,
    totalCompletionsInWindow
  }
}

/**
 * Computes all profile & learning statistics strictly from real Project[] and LearnerProgress[] records.
 * Never relies on stored drift-prone counters.
 */
export function computeProfileStats(
  projects: Project[],
  progressRecords: LearnerProgress[],
  now: Date = new Date(),
  timeZone?: string
): ProfileStats {
  const progressByKey: Record<string, LearnerProgress> = {}
  for (const record of progressRecords) {
    if (record?.moduleId) {
      progressByKey[record.moduleId] = record
    }
  }

  const streak = computeStreakMetrics(progressRecords, now, timeZone)

  const totalModulesCompleted = progressRecords.filter(
    p => Boolean(p && (p.passed || p.completedWithSolution))
  ).length

  const projectsStarted = projects.length
  const projectsCompleted = projects.filter(
    proj => computeProjectCompletionSummary(proj, progressByKey).isCompleted
  ).length

  const totalHintsUsed = progressRecords.reduce((sum, p) => sum + (p?.hintsUsed || 0), 0)
  const solutionsViewed = progressRecords.filter(
    p => Boolean(p && (p.usedSolution || p.completedWithSolution))
  ).length

  const attemptedRecords = progressRecords.filter(
    p => Boolean(p && ((p.attempts || 0) > 0 || p.passed || p.completedWithSolution))
  )
  const totalAttempts = progressRecords.reduce((sum, p) => sum + (p?.attempts || 0), 0)
  const attemptedModulesCount = attemptedRecords.length
  const averageAttemptsPerModule =
    attemptedModulesCount > 0
      ? Math.round((totalAttempts / attemptedModulesCount) * 10) / 10
      : 0

  return {
    totalModulesCompleted,
    projectsStarted,
    projectsCompleted,
    totalHintsUsed,
    solutionsViewed,
    totalAttempts,
    attemptedModulesCount,
    averageAttemptsPerModule,
    totalActiveDays: streak.activeDaysCount,
    streak
  }
}
