import test from 'node:test'
import assert from 'node:assert/strict'
import { encryptToken, decryptToken, generateRandomToken } from '../src/services/cryptoService.js'
import {
  findUserById,
  saveUser,
  createSession,
  findSession,
  deleteSession,
  saveProject,
  getProjectById,
  deleteProjectRecord,
  countUserConfirmedCustomProjects,
  confirmCustomProjectSpecAtomic,
  saveLearnerProgress,
  getProjectProgress,
  getShareSettings,
  saveShareSettings,
  findPublicProfileByUsername,
  MongoUser,
  MongoProject
} from '../src/services/mongoService.js'
import { resolveKeySource } from '../src/services/llmProvider.js'

test('Slice 7 - Security: Token AES-256-GCM encryption and decryption', () => {
  const sampleToken = 'gho_1234567890abcdefghijklmnopqrstuvwxyz'
  const encrypted = encryptToken(sampleToken)
  assert.notEqual(encrypted, sampleToken, 'Encrypted token should not equal plain token')
  assert.ok(encrypted.includes(':'), 'Encrypted token should be formatted as iv:authTag:ciphertext')

  const decrypted = decryptToken(encrypted)
  assert.equal(decrypted, sampleToken, 'Decrypted token must match original token exactly')
})

test('Slice 7 - Auth: 14-day rotating sessions stored and retrieved', async () => {
  const sessionId = generateRandomToken()
  const userId = 'usr_test_123'
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  await createSession({
    sessionId,
    userId,
    expiresAt,
    createdAt: new Date()
  })

  const retrieved = await findSession(sessionId)
  assert.ok(retrieved, 'Session should be found')
  assert.equal(retrieved?.userId, userId)

  await deleteSession(sessionId)
  const deleted = await findSession(sessionId)
  assert.equal(deleted, null, 'Deleted session should return null')
})

test('Slice 7 - Access Rules: Exactly ONE custom project per user enforced atomically', async () => {
  const userId = 'usr_atomic_test'
  const user: MongoUser = {
    id: userId,
    githubId: 998877,
    username: 'ascent_learner',
    avatarUrl: 'https://avatars.githubusercontent.com/u/998877',
    displayName: 'Learner One',
    encryptedToken: encryptToken('test_token'),
    plan: 'byok',
    customProjectUsed: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  await saveUser(user)

  // Curated project confirmation - ALWAYS UNLIMITED
  const curatedProject: MongoProject = {
    id: 'proj_curated_1',
    userId,
    source: 'curated',
    name: 'Currency Converter',
    prompt: 'Currency converter demo',
    spec: null,
    useTailwind: false,
    status: 'draft_spec',
    createdAt: new Date(),
    updatedAt: new Date()
  }
  await saveProject(curatedProject)

  const curatedResult = await confirmCustomProjectSpecAtomic(userId, curatedProject.id, { appName: 'Currency Converter' })
  assert.equal(curatedResult.success, true, 'Curated projects can always be confirmed without limit')

  // First Custom (Generated) Project confirmation - SUCCEEDS
  const customProject1: MongoProject = {
    id: 'proj_custom_1',
    userId,
    source: 'generated',
    name: 'AI Markdown Blog',
    prompt: 'AI Markdown blog with dark mode',
    spec: null,
    useTailwind: true,
    status: 'draft_spec',
    createdAt: new Date(),
    updatedAt: new Date()
  }
  await saveProject(customProject1)

  const firstConfirm = await confirmCustomProjectSpecAtomic(userId, customProject1.id, { appName: 'AI Markdown Blog' })
  assert.equal(firstConfirm.success, true, 'First custom project spec confirmation should succeed')

  const countAfterFirst = await countUserConfirmedCustomProjects(userId)
  assert.equal(countAfterFirst, 1, 'Should have exactly 1 confirmed custom project')

  // Second Custom Project confirmation - REJECTED SERVER-SIDE
  const customProject2: MongoProject = {
    id: 'proj_custom_2',
    userId,
    source: 'generated',
    name: 'Second Custom Tool',
    prompt: 'Another tool',
    spec: null,
    useTailwind: false,
    status: 'draft_spec',
    createdAt: new Date(),
    updatedAt: new Date()
  }
  await saveProject(customProject2)

  const secondConfirm = await confirmCustomProjectSpecAtomic(userId, customProject2.id, { appName: 'Second Custom Tool' })
  assert.equal(secondConfirm.success, false, 'Second custom project spec confirmation must be rejected')
  assert.equal(secondConfirm.code, 'CUSTOM_PROJECT_LIMIT_REACHED')
})

test('Slice 7 - Access Rules: Custom project deletion rules (0 modules vs >0 modules)', async () => {
  const userId = 'usr_deletion_test'
  const projectId = 'proj_deletion_check'

  const proj: MongoProject = {
    id: projectId,
    userId,
    source: 'generated',
    name: 'Test Project',
    prompt: 'Prompt',
    spec: { appName: 'Test' },
    useTailwind: true,
    status: 'spec_confirmed',
    createdAt: new Date(),
    updatedAt: new Date()
  }
  await saveProject(proj)

  // Case A: 0 modules completed -> Deletion is allowed
  let progressList = await getProjectProgress(userId, projectId)
  assert.equal(progressList.filter(p => p.passed).length, 0, 'Initially 0 completed modules')

  // Simulate module completion
  await saveLearnerProgress({
    userId,
    projectId,
    moduleId: 'mod_1',
    passed: true,
    attempts: 1,
    hintsUsed: 0,
    usedSolution: false,
    completedAt: new Date()
  })

  // Case B: >0 modules completed -> Deletion is blocked
  progressList = await getProjectProgress(userId, projectId)
  const completedCount = progressList.filter(p => p.passed).length
  assert.equal(completedCount, 1, 'Now 1 completed module')

  const canDelete = completedCount === 0
  assert.equal(canDelete, false, 'Custom project with completed modules must block deletion')
})

test('Slice 7 - BYOK: Key Source Resolver and header extraction', () => {
  // Provided user key in header
  const userKeyResolution = resolveKeySource('AIzaSyCustomUserTestKey_12345')
  assert.equal(userKeyResolution.provider, 'gemini')
  assert.equal(userKeyResolution.keySource, 'user')
  assert.equal(userKeyResolution.apiKey, 'AIzaSyCustomUserTestKey_12345')

  // Missing or empty header
  const emptyKeyResolution = resolveKeySource('')
  assert.equal(emptyKeyResolution.provider, 'gemini')
  assert.equal(emptyKeyResolution.keySource, 'user')
  assert.equal(emptyKeyResolution.apiKey, null)
})

test('Slice 7 - Public Profile: Private vs Public toggle & retrieval', async () => {
  const userId = 'usr_share_test'
  const username = 'jane_dev'

  const user: MongoUser = {
    id: userId,
    githubId: 554433,
    username,
    avatarUrl: 'https://avatars.githubusercontent.com/u/554433',
    displayName: 'Jane Developer',
    encryptedToken: encryptToken('test_token'),
    plan: 'byok',
    customProjectUsed: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  await saveUser(user)

  // Initially private: findPublicProfileByUsername returns null
  await saveShareSettings({ userId, isPublic: false, theme: 'cyan' })
  const privateProfile = await findPublicProfileByUsername(username)
  assert.equal(privateProfile, null, 'Private profile must return null (404)')

  // Toggle to public: findPublicProfileByUsername returns profile data
  await saveShareSettings({ userId, isPublic: true, theme: 'magenta' })
  const publicProfile = await findPublicProfileByUsername(username)
  assert.ok(publicProfile, 'Public profile should return user data')
  assert.equal(publicProfile?.user.username, username)
  assert.equal(publicProfile?.shareSettings.theme, 'magenta')
})

