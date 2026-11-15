import { MongoClient, Db, GridFSBucket, ObjectId } from 'mongodb'
import { ENV } from '../config/env.js'

export interface MongoUser {
  _id?: ObjectId
  id: string // String UUID/id
  githubId: number
  username: string
  avatarUrl: string
  displayName: string
  email?: string
  noreplyEmail?: string
  encryptedToken: string
  plan: 'byok' | 'subscription'
  customProjectUsed: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MongoProject {
  _id?: ObjectId
  id: string
  userId: string
  source: 'curated' | 'generated'
  curatedSlug?: string
  name: string
  prompt: string
  spec: any
  useTailwind: boolean
  status: 'draft_spec' | 'spec_confirmed' | 'in_progress' | 'completed'
  repo?: {
    name: string
    url: string
    defaultBranch: string
    lastCommitSha?: string
    syncStatus: 'idle' | 'syncing' | 'synced' | 'failed'
    lastPushedAt?: Date
    error?: string
  }
  currentPageIndex?: number
  createdAt: Date
  updatedAt: Date
}

export interface MongoProgress {
  _id?: ObjectId
  userId: string
  projectId: string
  moduleId: string
  passed: boolean
  attempts: number
  hintsUsed: number
  usedSolution: boolean
  completedWithSolution?: boolean
  startedAt?: Date
  completedAt?: Date
}

export interface MongoSession {
  _id?: ObjectId
  sessionId: string
  userId: string
  expiresAt: Date
  createdAt: Date
  userAgent?: string
  ip?: string
}

export interface MongoShareSettings {
  _id?: ObjectId
  userId: string
  isPublic: boolean
  theme: 'cyan' | 'green' | 'magenta'
}

let client: MongoClient | null = null
let db: Db | null = null
let gridFSBucket: GridFSBucket | null = null
let isConnectedState = false

// In-memory fallback stores when MongoDB daemon is not running (e.g. lightweight CI or offline test)
const memoryStore = {
  users: new Map<string, MongoUser>(),
  projects: new Map<string, MongoProject>(),
  pages: new Map<string, any[]>(),
  modules: new Map<string, any>(),
  progress: new Map<string, MongoProgress>(),
  projectMemory: new Map<string, any>(),
  sessions: new Map<string, MongoSession>(),
  shareSettings: new Map<string, MongoShareSettings>(),
  assets: new Map<string, { buffer: Buffer; mimeType: string; projectId: string; path: string }>()
}

export async function connectToMongo(): Promise<Db> {
  if (db && isConnectedState) return db

  try {
    const uri = ENV.MONGODB_URI
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
    })

    await client.connect()
    db = client.db()
    gridFSBucket = new GridFSBucket(db, { bucketName: 'project_assets' })
    isConnectedState = true
    console.log(`[MongoDB] Connected successfully to database: ${db.databaseName}`)

    // Create required indexes
    await initMongoIndexes(db)
    return db
  } catch (err: any) {
    console.warn(`[MongoDB] Real cluster connection failed (${err?.message || err}). Initializing resilient in-memory storage fallback.`)
    isConnectedState = false
    return null as any
  }
}

async function initMongoIndexes(database: Db): Promise<void> {
  try {
    await database.collection('users').createIndex({ githubId: 1 }, { unique: true })
    await database.collection('progress').createIndex({ userId: 1, completedAt: 1 })
    await database.collection('projects').createIndex({ userId: 1, source: 1 })
    await database.collection('sessions').createIndex({ sessionId: 1 }, { unique: true })
    await database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    await database.collection('shareSettings').createIndex({ userId: 1 }, { unique: true })
  } catch (e) {
    console.warn('[MongoDB] Index creation warning:', e)
  }
}

export function isMongoConnected(): boolean {
  return isConnectedState
}

// ---------------------------------------------------------------------------
// USER OPERATIONS
// ---------------------------------------------------------------------------
export async function findUserByGithubId(githubId: number): Promise<MongoUser | null> {
  if (isConnectedState && db) {
    const doc = await db.collection<MongoUser>('users').findOne({ githubId })
    return doc || null
  }
  for (const user of memoryStore.users.values()) {
    if (user.githubId === githubId) return user
  }
  return null
}

export async function findUserById(userId: string): Promise<MongoUser | null> {
  if (isConnectedState && db) {
    const doc = await db.collection<MongoUser>('users').findOne({ id: userId })
    return doc || null
  }
  return memoryStore.users.get(userId) || null
}

export async function saveUser(user: MongoUser): Promise<void> {
  if (isConnectedState && db) {
    await db.collection('users').updateOne(
      { githubId: user.githubId },
      { $set: { ...user, updatedAt: new Date() } },
      { upsert: true }
    )
    return
  }
  memoryStore.users.set(user.id, { ...user, updatedAt: new Date() })
}

export async function deleteUserAndAllData(userId: string): Promise<void> {
  if (isConnectedState && db) {
    await Promise.all([
      db.collection('users').deleteOne({ id: userId }),
      db.collection('projects').deleteMany({ userId }),
      db.collection('progress').deleteMany({ userId }),
      db.collection('sessions').deleteMany({ userId }),
      db.collection('shareSettings').deleteOne({ userId })
    ])
    return
  }

  memoryStore.users.delete(userId)
  for (const [id, proj] of memoryStore.projects.entries()) {
    if (proj.userId === userId) memoryStore.projects.delete(id)
  }
  for (const [key, prog] of memoryStore.progress.entries()) {
    if (prog.userId === userId) memoryStore.progress.delete(key)
  }
  for (const [key, sess] of memoryStore.sessions.entries()) {
    if (sess.userId === userId) memoryStore.sessions.delete(key)
  }
  memoryStore.shareSettings.delete(userId)
}

// ---------------------------------------------------------------------------
// SESSION OPERATIONS
// ---------------------------------------------------------------------------
export async function createSession(session: MongoSession): Promise<void> {
  if (isConnectedState && db) {
    await db.collection('sessions').insertOne(session)
    return
  }
  memoryStore.sessions.set(session.sessionId, session)
}

export async function findSession(sessionId: string): Promise<MongoSession | null> {
  if (!sessionId) return null
  if (isConnectedState && db) {
    const doc = await db.collection<MongoSession>('sessions').findOne({ sessionId })
    if (!doc) return null
    if (new Date(doc.expiresAt) <= new Date()) {
      await db.collection('sessions').deleteOne({ sessionId })
      return null
    }
    return doc
  }

  const s = memoryStore.sessions.get(sessionId)
  if (!s) return null
  if (new Date(s.expiresAt) <= new Date()) {
    memoryStore.sessions.delete(sessionId)
    return null
  }
  return s
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (isConnectedState && db) {
    await db.collection('sessions').deleteOne({ sessionId })
    return
  }
  memoryStore.sessions.delete(sessionId)
}

// ---------------------------------------------------------------------------
// PROJECT OPERATIONS & ACCESS RULES
// ---------------------------------------------------------------------------
export async function getProjectsByUserId(userId: string): Promise<MongoProject[]> {
  if (isConnectedState && db) {
    return await db.collection<MongoProject>('projects').find({ userId }).sort({ createdAt: -1 }).toArray()
  }
  return Array.from(memoryStore.projects.values())
    .filter(p => p.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function getProjectById(projectId: string): Promise<MongoProject | null> {
  if (isConnectedState && db) {
    return await db.collection<MongoProject>('projects').findOne({ id: projectId })
  }
  return memoryStore.projects.get(projectId) || null
}

export async function saveProject(project: MongoProject): Promise<void> {
  if (isConnectedState && db) {
    await db.collection('projects').updateOne(
      { id: project.id },
      { $set: { ...project, updatedAt: new Date() } },
      { upsert: true }
    )
    return
  }
  memoryStore.projects.set(project.id, { ...project, updatedAt: new Date() })
}

export async function deleteProjectRecord(projectId: string): Promise<void> {
  if (isConnectedState && db) {
    await Promise.all([
      db.collection('projects').deleteOne({ id: projectId }),
      db.collection('progress').deleteMany({ projectId })
    ])
    return
  }
  memoryStore.projects.delete(projectId)
  for (const [key, p] of memoryStore.progress.entries()) {
    if (p.projectId === projectId) memoryStore.progress.delete(key)
  }
}

/**
 * Server-Side Atomic Rule: Count confirmed custom projects for this user.
 * Exactly ONE custom (source === 'generated' and status !== 'draft_spec') allowed.
 */
export async function countUserConfirmedCustomProjects(userId: string): Promise<number> {
  if (isConnectedState && db) {
    return await db.collection('projects').countDocuments({
      userId,
      source: 'generated',
      status: { $in: ['spec_confirmed', 'in_progress', 'completed'] }
    })
  }

  return Array.from(memoryStore.projects.values()).filter(
    p => p.userId === userId && p.source === 'generated' && p.status !== 'draft_spec'
  ).length
}

/**
 * Atomic Custom Project Spec Confirmation:
 * Enforces the 1 custom project limit server-side atomically.
 */
export async function confirmCustomProjectSpecAtomic(
  userId: string,
  projectId: string,
  spec: any
): Promise<{ success: boolean; error?: string; code?: string }> {
  // Check if project exists
  const proj = await getProjectById(projectId)
  if (!proj) {
    return { success: false, code: 'PROJECT_NOT_FOUND', error: 'Project not found' }
  }

  if (proj.source === 'curated') {
    // Curated projects have UNLIMITED access - immediately confirm
    proj.status = 'spec_confirmed'
    proj.spec = spec
    await saveProject(proj)
    return { success: true }
  }

  // Generated (Custom) Project: Atomic limit check
  const activeCount = await countUserConfirmedCustomProjects(userId)
  // If user already has a confirmed custom project that isn't THIS project, block!
  if (activeCount > 0 && proj.status === 'draft_spec') {
    return {
      success: false,
      code: 'CUSTOM_PROJECT_LIMIT_REACHED',
      error: 'You have already created your 1 allowed custom project. Complete it or delete it to start another.'
    }
  }

  proj.status = 'spec_confirmed'
  proj.spec = spec
  await saveProject(proj)

  // Mark customProjectUsed on user record
  const user = await findUserById(userId)
  if (user) {
    user.customProjectUsed = true
    await saveUser(user)
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// PROGRESS & STATS
// ---------------------------------------------------------------------------
export async function saveLearnerProgress(progress: MongoProgress): Promise<void> {
  const key = `${progress.userId}:${progress.moduleId}`
  if (isConnectedState && db) {
    await db.collection('progress').updateOne(
      { userId: progress.userId, moduleId: progress.moduleId },
      { $set: progress },
      { upsert: true }
    )
    return
  }
  memoryStore.progress.set(key, progress)
}

export async function getUserProgress(userId: string): Promise<MongoProgress[]> {
  if (isConnectedState && db) {
    return await db.collection<MongoProgress>('progress').find({ userId }).toArray()
  }
  return Array.from(memoryStore.progress.values()).filter(p => p.userId === userId)
}

export async function getProjectProgress(userId: string, projectId: string): Promise<MongoProgress[]> {
  if (isConnectedState && db) {
    return await db.collection<MongoProgress>('progress').find({ userId, projectId }).toArray()
  }
  return Array.from(memoryStore.progress.values()).filter(p => p.userId === userId && p.projectId === projectId)
}

// ---------------------------------------------------------------------------
// PROJECT MEMORY & PAGES
// ---------------------------------------------------------------------------
export async function saveProjectMemory(projectId: string, memory: any): Promise<void> {
  if (isConnectedState && db) {
    await db.collection('projectMemory').updateOne(
      { projectId },
      { $set: { projectId, memory, updatedAt: new Date() } },
      { upsert: true }
    )
    return
  }
  memoryStore.projectMemory.set(projectId, memory)
}

export async function getProjectMemory(projectId: string): Promise<any | null> {
  if (isConnectedState && db) {
    const doc = await db.collection('projectMemory').findOne({ projectId })
    return doc ? (doc as any).memory : null
  }
  return memoryStore.projectMemory.get(projectId) || null
}

// ---------------------------------------------------------------------------
// SHARE SETTINGS & PUBLIC PROFILE
// ---------------------------------------------------------------------------
export async function getShareSettings(userId: string): Promise<MongoShareSettings> {
  if (isConnectedState && db) {
    const doc = await db.collection<MongoShareSettings>('shareSettings').findOne({ userId })
    if (doc) return doc
  } else {
    const s = memoryStore.shareSettings.get(userId)
    if (s) return s
  }
  return { userId, isPublic: false, theme: 'cyan' }
}

export async function saveShareSettings(settings: MongoShareSettings): Promise<void> {
  if (isConnectedState && db) {
    await db.collection('shareSettings').updateOne(
      { userId: settings.userId },
      { $set: settings },
      { upsert: true }
    )
    return
  }
  memoryStore.shareSettings.set(settings.userId, settings)
}

export async function findPublicProfileByUsername(username: string): Promise<{
  user: MongoUser
  shareSettings: MongoShareSettings
  projects: MongoProject[]
  progress: MongoProgress[]
} | null> {
  let user: MongoUser | null = null
  if (isConnectedState && db) {
    user = await db.collection<MongoUser>('users').findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    })
  } else {
    for (const u of memoryStore.users.values()) {
      if (u.username.toLowerCase() === username.toLowerCase()) {
        user = u
        break
      }
    }
  }

  if (!user) return null

  const settings = await getShareSettings(user.id)
  if (!settings.isPublic) return null // Private profiles return null (for 404 response)

  const projects = await getProjectsByUserId(user.id)
  const progress = await getUserProgress(user.id)

  return { user, shareSettings: settings, projects, progress }
}

// ---------------------------------------------------------------------------
// GRIDFS BINARY ASSETS (5MB per file, 10MB per project caps)
// ---------------------------------------------------------------------------
export const MAX_ASSET_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
export const MAX_ASSET_PROJECT_BYTES = 10 * 1024 * 1024 // 10 MB

export async function saveProjectAsset(options: {
  projectId: string
  path: string
  mimeType: string
  buffer: Buffer
}): Promise<{ success: boolean; error?: string }> {
  if (options.buffer.length > MAX_ASSET_FILE_BYTES) {
    return { success: false, error: 'Asset exceeds 5 MB single-file limit.' }
  }

  // Calculate current project total assets size
  let currentTotal = 0
  if (isConnectedState && db) {
    const files = await db.collection('project_assets.files').find({ 'metadata.projectId': options.projectId }).toArray()
    currentTotal = files.reduce((sum, f) => sum + (f.length || 0), 0)
  } else {
    for (const a of memoryStore.assets.values()) {
      if (a.projectId === options.projectId) currentTotal += a.buffer.length
    }
  }

  if (currentTotal + options.buffer.length > MAX_ASSET_PROJECT_BYTES) {
    return { success: false, error: 'Project exceeds 10 MB total binary assets quota.' }
  }

  if (isConnectedState && gridFSBucket) {
    // Delete existing asset with same path in this project
    const existing = await db!.collection('project_assets.files').findOne({
      filename: options.path,
      'metadata.projectId': options.projectId
    })
    if (existing) {
      await gridFSBucket.delete(existing._id)
    }

    const uploadStream = gridFSBucket.openUploadStream(options.path, {
      metadata: {
        projectId: options.projectId,
        mimeType: options.mimeType,
        uploadedAt: new Date()
      }
    })

    await new Promise<void>((resolve, reject) => {
      uploadStream.end(options.buffer, (err?: any) => {
        if (err) reject(err)
        else resolve()
      })
    })

    return { success: true }
  }

  // In-memory fallback
  const assetKey = `${options.projectId}:${options.path}`
  memoryStore.assets.set(assetKey, {
    buffer: options.buffer,
    mimeType: options.mimeType,
    projectId: options.projectId,
    path: options.path
  })
  return { success: true }
}

export async function getProjectAsset(projectId: string, path: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (isConnectedState && gridFSBucket && db) {
    const file = await db.collection('project_assets.files').findOne({
      filename: path,
      'metadata.projectId': projectId
    })
    if (!file) return null

    const downloadStream = gridFSBucket.openDownloadStream(file._id)
    const chunks: Buffer[] = []
    return await new Promise((resolve, reject) => {
      downloadStream.on('data', chunk => chunks.push(Buffer.from(chunk)))
      downloadStream.on('error', reject)
      downloadStream.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          mimeType: (file.metadata as any)?.mimeType || 'application/octet-stream'
        })
      })
    })
  }

  const assetKey = `${projectId}:${path}`
  const asset = memoryStore.assets.get(assetKey)
  if (asset) {
    return { buffer: asset.buffer, mimeType: asset.mimeType }
  }
  return null
}

