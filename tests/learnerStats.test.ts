import test from 'node:test'
import assert from 'node:assert/strict'
import type { LearnerProgress } from '../src/schemas/course.ts'
import type { Project } from '../src/types/ascent.ts'
import {
  addDaysToDateKey,
  computeActivityHeatmap,
  computePageModuleStatuses,
  computeProfileStats,
  computeProjectCompletionSummary,
  computeStreakMetrics,
  getUserInitials,
  toLocalDateKey
} from '../src/utils/learnerStats.ts'

function makeProgress(
  overrides: Partial<LearnerProgress> & { moduleId: string }
): LearnerProgress {
  return {
    userId: 'usr_test',
    passed: true,
    attempts: 1,
    hintsUsed: 0,
    usedSolution: false,
    completedWithSolution: false,
    ...overrides
  }
}

function makeProject(
  id: string,
  appName: string,
  pages: Array<{
    id: string
    name: string
    fileName: string
    status?: 'active' | 'done'
    modules: Array<{ id: string; title: string; status?: 'locked' | 'active' | 'done' }>
  }>,
  status: Project['status'] = 'in_progress'
): Project {
  return {
    id,
    userId: 'usr_test',
    userPrompt: `Build ${appName}`,
    useTailwind: false,
    currentPageIndex: 0,
    status,
    source: 'generated',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
    spec: {
      appName,
      tagline: `${appName} tagline`,
      summary: `${appName} summary text for testing`,
      targetAudience: 'Developers',
      primaryFeatures: [
        { name: 'Feature A', description: 'Feature A details' },
        { name: 'Feature B', description: 'Feature B details' }
      ],
      userFlows: [
        { flowName: 'Flow 1', steps: ['Step 1', 'Step 2'] },
        { flowName: 'Flow 2', steps: ['Step 1', 'Step 2'] }
      ],
      dataEntities: [
        { name: 'Item', storageKey: 'items', fields: [{ name: 'id', type: 'string' }] }
      ],
      techStack: {
        runtime: 'HTML + CSS + JavaScript',
        styling: 'Plain CSS',
        stateManagement: 'Browser In-Memory State / DOM',
        backendSim: 'In-Browser LocalStorage / IndexedDB',
        useTailwind: false
      },
      useTailwind: false,
      architectureHighlights: ['Vanilla DOM', 'LocalStorage'],
      assumptions: ['Modern browser'],
      outOfScope: ['Server DB'],
      estimatedScreenCount: 2,
      difficulty: 'beginner',
      estimatedHours: 2
    },
    pages: pages.map((pg, pIdx) => ({
      id: pg.id,
      projectId: id,
      order: pIdx + 1,
      name: pg.name,
      description: `${pg.name} description`,
      fileName: pg.fileName,
      purpose: `${pg.name} purpose`,
      status: pg.status || 'active',
      modules: pg.modules.map((m, mIdx) => ({
        id: m.id,
        pageId: pg.id,
        order: mIdx + 1,
        title: m.title,
        learningObjective: `Learn ${m.title}`,
        componentType: 'main-section',
        status: m.status || 'locked'
      }))
    }))
  }
}

test('empty data returns zeroed streaks, stats, and blank 26-week heatmap', () => {
  const now = new Date('2026-11-12T10:00:00.000Z')
  const stats = computeProfileStats([], [], now, 'UTC')
  assert.equal(stats.totalModulesCompleted, 0)
  assert.equal(stats.projectsStarted, 0)
  assert.equal(stats.projectsCompleted, 0)
  assert.equal(stats.totalHintsUsed, 0)
  assert.equal(stats.solutionsViewed, 0)
  assert.equal(stats.averageAttemptsPerModule, 0)
  assert.equal(stats.totalActiveDays, 0)
  assert.equal(stats.streak.currentStreak, 0)
  assert.equal(stats.streak.longestStreak, 0)
  assert.equal(stats.streak.daysUntilLost, 0)
  assert.equal(stats.streak.isAliveToday, false)
  assert.equal(stats.streak.statusLabel, 'No activity yet')

  // Unpassed records without completedAt do NOT count toward completions or streak
  const incompleteOnly = [
    makeProgress({ moduleId: 'p1__m1', passed: false, completedWithSolution: false, attempts: 2, hintsUsed: 1 })
  ]
  const incompleteStats = computeProfileStats([], incompleteOnly, now, 'UTC')
  assert.equal(incompleteStats.totalModulesCompleted, 0)
  assert.equal(incompleteStats.totalHintsUsed, 1)
  assert.equal(incompleteStats.averageAttemptsPerModule, 2)
  assert.equal(incompleteStats.streak.currentStreak, 0)

  const heatmap = computeActivityHeatmap([], now, 26, 'UTC')
  assert.equal(heatmap.weeks.length, 26)
  assert.equal(heatmap.maxCount, 0)
  assert.equal(heatmap.totalCompletionsInWindow, 0)
  for (const w of heatmap.weeks) {
    assert.equal(w.days.length, 7)
    for (const d of w.days) {
      assert.equal(d.count, 0)
      assert.equal(d.level, 0)
    }
  }
})

test('same-day completions accumulate count/intensity without inflating streak', () => {
  const now = new Date('2026-11-12T15:00:00.000Z')
  const progress = [
    makeProgress({ moduleId: 'p1__m1', completedAt: '2026-11-12T08:00:00.000Z' }),
    makeProgress({ moduleId: 'p1__m2', completedAt: '2026-11-12T09:30:00.000Z' }),
    makeProgress({ moduleId: 'p1__m3', completedAt: '2026-11-12T11:45:00.000Z' }),
    makeProgress({ moduleId: 'p1__m4', completedAt: '2026-11-12T13:10:00.000Z' }),
    makeProgress({ moduleId: 'p1__m5', completedAt: '2026-11-12T14:20:00.000Z' })
  ]

  const streak = computeStreakMetrics(progress, now, 'UTC')
  assert.equal(streak.currentStreak, 1)
  assert.equal(streak.longestStreak, 1)
  assert.equal(streak.activeDaysCount, 1)
  assert.equal(streak.hasCompletedToday, true)
  assert.equal(streak.daysUntilLost, 2)
  assert.equal(streak.dailyCounts['2026-11-12'], 5)

  const heatmap = computeActivityHeatmap(progress, now, 26, 'UTC')
  const todayCell = heatmap.weeks.flatMap(w => w.days).find(d => d.dateKey === '2026-11-12')
  assert.ok(todayCell)
  assert.equal(todayCell.count, 5)
  assert.equal(todayCell.level, 4)
  assert.equal(heatmap.totalCompletionsInWindow, 5)
})

test('gaps reset currentStreak while preserving longestStreak, and yesterday keeps streak alive with 1 day left', () => {
  const now = new Date('2026-11-12T12:00:00.000Z')

  // Longest run = 4 days (Nov 1..4), gap Nov 5..9, current run = 2 days (Nov 10..11, active yesterday)
  const aliveYesterdayProgress = [
    makeProgress({ moduleId: 'm1', completedAt: '2026-11-01T10:00:00.000Z' }),
    makeProgress({ moduleId: 'm2', completedAt: '2026-11-02T10:00:00.000Z' }),
    makeProgress({ moduleId: 'm3', completedAt: '2026-11-03T10:00:00.000Z' }),
    makeProgress({ moduleId: 'm4', completedAt: '2026-11-04T10:00:00.000Z' }),
    // gap Nov 5..9
    makeProgress({ moduleId: 'm5', completedAt: '2026-11-10T10:00:00.000Z' }),
    makeProgress({ moduleId: 'm6', completedAt: '2026-11-11T10:00:00.000Z' })
  ]

  const aliveYesterday = computeStreakMetrics(aliveYesterdayProgress, now, 'UTC')
  assert.equal(aliveYesterday.longestStreak, 4)
  assert.equal(aliveYesterday.currentStreak, 2)
  assert.equal(aliveYesterday.isAliveToday, true)
  assert.equal(aliveYesterday.hasCompletedToday, false)
  assert.equal(aliveYesterday.daysUntilLost, 1)
  assert.equal(aliveYesterday.activeDaysCount, 6)

  // Missing yesterday as well -> currentStreak drops to 0, daysUntilLost = 0
  const expiredProgress = aliveYesterdayProgress.filter(p => p.moduleId !== 'm6')
  const expired = computeStreakMetrics(expiredProgress, now, 'UTC')
  assert.equal(expired.longestStreak, 4)
  assert.equal(expired.currentStreak, 0)
  assert.equal(expired.isAliveToday, false)
  assert.equal(expired.daysUntilLost, 0)
})

test('timezone midnight boundaries compute calendar days in local timezone, not UTC', () => {
  // Two completions only 30 minutes apart in UTC on Nov 11:
  // 18:15Z = 23:45 IST (Nov 11) in Asia/Kolkata (+05:30)
  // 18:45Z = 00:15 IST (Nov 12) in Asia/Kolkata (+05:30)
  const istNow = new Date('2026-11-12T10:00:00.000Z') // Nov 12 15:30 IST
  const istProgress = [
    makeProgress({ moduleId: 'a', completedAt: '2026-11-11T18:15:00.000Z' }),
    makeProgress({ moduleId: 'b', completedAt: '2026-11-11T18:45:00.000Z' })
  ]

  assert.equal(toLocalDateKey('2026-11-11T18:15:00.000Z', 'Asia/Kolkata'), '2026-11-11')
  assert.equal(toLocalDateKey('2026-11-11T18:45:00.000Z', 'Asia/Kolkata'), '2026-11-12')

  const istStreak = computeStreakMetrics(istProgress, istNow, 'Asia/Kolkata')
  assert.equal(istStreak.currentStreak, 2)
  assert.equal(istStreak.longestStreak, 2)
  assert.equal(istStreak.hasCompletedToday, true)
  assert.equal(istStreak.daysUntilLost, 2)

  // In America/New_York (-05:00), BOTH 18:15Z (13:15 EST) and 18:45Z (13:45 EST) are on 2026-11-11!
  const nyStreak = computeStreakMetrics(istProgress, istNow, 'America/New_York')
  assert.equal(nyStreak.activeDaysCount, 1)
  assert.equal(nyStreak.dailyCounts['2026-11-11'], 2)

  // Across US Eastern midnight: 04:59Z = Nov 11 23:59 EST, 05:01Z = Nov 12 00:01 EST
  const nyNow = new Date('2026-11-12T15:00:00.000Z') // Nov 12 10:00 EST
  const nyBoundary = [
    makeProgress({ moduleId: 'ny1', completedAt: '2026-11-12T04:59:00.000Z' }),
    makeProgress({ moduleId: 'ny2', completedAt: '2026-11-12T05:01:00.000Z' })
  ]
  const nyBoundaryStreak = computeStreakMetrics(nyBoundary, nyNow, 'America/New_York')
  assert.equal(nyBoundaryStreak.currentStreak, 2)
  assert.equal(nyBoundaryStreak.activeDaysCount, 2)
  // Yet in UTC those same timestamps are the same calendar day (Nov 12)!
  const utcSameDay = computeStreakMetrics(nyBoundary, nyNow, 'UTC')
  assert.equal(utcSameDay.currentStreak, 1)
  assert.equal(utcSameDay.activeDaysCount, 1)

  // Month boundary arithmetic works cleanly
  assert.equal(addDaysToDateKey('2026-03-01', -1), '2026-02-28')
  assert.equal(addDaysToDateKey('2026-12-31', 1), '2027-01-01')
})

test('profile stats and project completion compute strictly from real Project & Progress records', () => {
  const proj1 = makeProject('p1', 'Portfolio', [
    {
      id: 'pg1',
      name: 'Home',
      fileName: 'index.html',
      status: 'done',
      modules: [
        { id: 'm1', title: 'Head', status: 'done' },
        { id: 'm2', title: 'Hero', status: 'done' }
      ]
    },
    {
      id: 'pg2',
      name: 'Contact',
      fileName: 'contact.html',
      status: 'active',
      modules: [
        { id: 'm3', title: 'Form', status: 'active' },
        { id: 'm4', title: 'Validation', status: 'locked' }
      ]
    }
  ])

  const proj2 = makeProject(
    'p2',
    'Greeting',
    [
      {
        id: 'pg_only',
        name: 'Home',
        fileName: 'index.html',
        status: 'done',
        modules: [
          { id: 'm1', title: 'Form', status: 'done' },
          { id: 'm2', title: 'Script', status: 'done' }
        ]
      }
    ],
    'completed'
  )

  const progressRecords: LearnerProgress[] = [
    makeProgress({
      moduleId: 'p1__m1',
      attempts: 2,
      hintsUsed: 1,
      completedAt: '2026-11-11T10:00:00.000Z'
    }),
    makeProgress({
      moduleId: 'p1__m2',
      passed: false,
      usedSolution: true,
      completedWithSolution: true,
      attempts: 3,
      hintsUsed: 2,
      completedAt: '2026-11-12T09:00:00.000Z'
    }),
    makeProgress({
      moduleId: 'p2__m1',
      attempts: 1,
      hintsUsed: 0,
      completedAt: '2026-11-12T10:00:00.000Z'
    }),
    makeProgress({
      moduleId: 'p2__m2',
      attempts: 2,
      hintsUsed: 1,
      usedSolution: true,
      completedAt: '2026-11-12T11:00:00.000Z'
    })
  ]

  const progressByKey = Object.fromEntries(progressRecords.map(p => [p.moduleId, p]))
  const p1Summary = computeProjectCompletionSummary(proj1, progressByKey)
  assert.equal(p1Summary.completedModules, 2)
  assert.equal(p1Summary.totalModules, 4)
  assert.equal(p1Summary.percentComplete, 50)
  assert.equal(p1Summary.isCompleted, false)

  const p2Summary = computeProjectCompletionSummary(proj2, progressByKey)
  assert.equal(p2Summary.percentComplete, 100)
  assert.equal(p2Summary.isCompleted, true)

  const pg2Statuses = computePageModuleStatuses('p1', proj1.pages[1], progressByKey)
  assert.deepEqual(
    pg2Statuses.map(s => s.status),
    ['active', 'locked']
  )

  const stats = computeProfileStats([proj1, proj2], progressRecords, new Date('2026-11-12T12:00:00.000Z'), 'UTC')
  assert.equal(stats.totalModulesCompleted, 4)
  assert.equal(stats.projectsStarted, 2)
  assert.equal(stats.projectsCompleted, 1)
  assert.equal(stats.totalHintsUsed, 4)
  assert.equal(stats.solutionsViewed, 2)
  assert.equal(stats.totalAttempts, 8)
  assert.equal(stats.averageAttemptsPerModule, 2)
  assert.equal(stats.totalActiveDays, 2)
  assert.equal(stats.streak.currentStreak, 2)

  // Initials derivation & override
  assert.equal(getUserInitials({ name: 'Ada Lovelace' }), 'AL')
  assert.equal(getUserInitials({ name: 'Ada Lovelace', avatarInitials: 'adl' }), 'ADL')
  assert.equal(getUserInitials({ name: 'Cher' }), 'CH')
})

