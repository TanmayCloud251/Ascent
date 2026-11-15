import { ENV, redactSecrets } from '../config/env.js'
import { decryptToken } from './cryptoService.js'
import { getProjectById, saveProject, findUserById } from './mongoService.js'

export interface GitHubUserResponse {
  id: number
  login: string
  name: string
  avatar_url: string
  email: string
  noreply_email: string
}

export function getGitHubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: ENV.GITHUB_CLIENT_ID,
    redirect_uri: `${ENV.APP_URL}/api/auth/github/callback`,
    scope: 'repo read:user user:email',
    state
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

export async function exchangeCodeForGitHubToken(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      client_id: ENV.GITHUB_CLIENT_ID,
      client_secret: ENV.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${ENV.APP_URL}/api/auth/github/callback`
    })
  })

  if (!response.ok) {
    throw new Error(`GitHub token exchange HTTP error: ${response.status}`)
  }

  const data = await response.json()
  if (data.error || !data.access_token) {
    throw new Error(`GitHub token exchange failed: ${data.error_description || data.error}`)
  }

  return data.access_token
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
  const userResp = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Ascent-Coding-Academy'
    }
  })

  if (!userResp.ok) {
    throw new Error(`Failed to fetch GitHub user profile: HTTP ${userResp.status}`)
  }

  const userData = await userResp.json()

  // Fetch emails to find primary and noreply email
  let primaryEmail = userData.email || ''
  let noreplyEmail = `${userData.id}+${userData.login}@users.noreply.github.com`

  try {
    const emailsResp = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Ascent-Coding-Academy'
      }
    })
    if (emailsResp.ok) {
      const emails: Array<{ email: string; primary: boolean; verified: boolean }> = await emailsResp.json()
      const primary = emails.find(e => e.primary && e.verified)
      if (primary) {
        primaryEmail = primary.email
      }
    }
  } catch {
    // Non-fatal, fallback to default noreply
  }

  return {
    id: userData.id,
    login: userData.login,
    name: userData.name || userData.login,
    avatar_url: userData.avatar_url,
    email: primaryEmail || noreplyEmail,
    noreply_email: noreplyEmail
  }
}

export async function revokeGitHubToken(accessToken: string): Promise<void> {
  if (!ENV.GITHUB_CLIENT_ID || !ENV.GITHUB_CLIENT_SECRET) return
  try {
    const basicAuth = Buffer.from(`${ENV.GITHUB_CLIENT_ID}:${ENV.GITHUB_CLIENT_SECRET}`).toString('base64')
    await fetch(`https://api.github.com/applications/${ENV.GITHUB_CLIENT_ID}/grant`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Ascent-Coding-Academy',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ access_token: accessToken })
    })
  } catch (e) {
    console.warn('[GitHub] Grant revocation warning:', e)
  }
}

// ---------------------------------------------------------------------------
// GITHUB REPO CREATION & GIT DATA API COMMITS
// ---------------------------------------------------------------------------

function sanitizeRepoSlug(rawName: string): string {
  const clean = rawName
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `ASCENT-${clean || 'project'}`
}

export function generateProjectReadme(options: {
  appName: string
  summary: string
  techStack: string
  modules: Array<{ id: string; title: string; learningObjective?: string }>
  completedModuleIds: Set<string>
  completedPages?: string[]
}): string {
  const { appName, summary, techStack, modules, completedModuleIds, completedPages } = options

  const moduleItems = modules
    .map((m, idx) => {
      const done = completedModuleIds.has(m.id)
      return `- [${done ? 'x' : ' '}] **Module ${idx + 1}: ${m.title}**${m.learningObjective ? ` — *${m.learningObjective}*` : ''}`
    })
    .join('\n')

  const pagesSection = completedPages && completedPages.length > 0
    ? `\n### Completed Application Pages\n${completedPages.map(p => `- ${p}`).join('\n')}\n`
    : ''

  return `# ${appName}

> Built & verified with [Ascent AI Coding Academy](https://ascent.dev).

## Project Overview
${summary}

**Tech Stack:** ${techStack}

${pagesSection}
## Curriculum Checklist
${moduleItems}

---
*Created automatically with private repo sync by Ascent.*
`
}

/**
 * Creates a private repository named ASCENT-<project-name> on the user's personal GitHub account.
 * Appends -2, -3 on name collisions.
 */
export async function createPrivateRepoForProject(
  accessToken: string,
  userLogin: string,
  projectName: string,
  summary: string,
  initialFiles: Record<string, string>,
  allModules: Array<{ id: string; title: string; learningObjective?: string }>,
  techStack: string
): Promise<{ repoName: string; repoUrl: string; defaultBranch: string; initialCommitSha: string }> {
  let baseSlug = sanitizeRepoSlug(projectName)
  let repoName = baseSlug
  let attempt = 1

  while (attempt <= 10) {
    const createResp = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Ascent-Coding-Academy'
      },
      body: JSON.stringify({
        name: repoName,
        description: `${projectName} — Built with Ascent AI Coding Academy`,
        private: true,
        auto_init: true // Generates default branch with initial commit
      })
    })

    if (createResp.status === 201) {
      const repoData = await createResp.json()
      const defaultBranch = repoData.default_branch || 'main'

      // Commit initial files and README onto the default branch
      const readmeContent = generateProjectReadme({
        appName: projectName,
        summary,
        techStack,
        modules: allModules,
        completedModuleIds: new Set()
      })

      const filesToCommit: Record<string, string> = {
        'README.md': readmeContent,
        ...initialFiles
      }

      const initialCommitSha = await pushCommitViaGitDataApi({
        accessToken,
        owner: userLogin,
        repo: repoName,
        branch: defaultBranch,
        commitMessage: `Initialize ${projectName} curriculum with Ascent`,
        files: filesToCommit
      })

      return {
        repoName,
        repoUrl: repoData.html_url,
        defaultBranch,
        initialCommitSha
      }
    }

    if (createResp.status === 422) {
      // Collision -> Try next number
      attempt++
      repoName = `${baseSlug}-${attempt}`
      continue
    }

    const errBody = await createResp.text()
    throw new Error(`GitHub create repo error (HTTP ${createResp.status}): ${redactSecrets(errBody)}`)
  }

  throw new Error(`Failed to create repository after ${attempt} collision resolution attempts.`)
}

/**
 * Pushes learner code files as ONE commit using the GitHub Git Data API:
 * 1. POST /repos/{owner}/{repo}/git/blobs
 * 2. POST /repos/{owner}/{repo}/git/trees
 * 3. POST /repos/{owner}/{repo}/git/commits
 * 4. PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}
 */
export async function pushCommitViaGitDataApi(options: {
  accessToken: string
  owner: string
  repo: string
  branch?: string
  commitMessage: string
  files: Record<string, string> // path -> content
  binaryFiles?: Array<{ path: string; base64Content: string }>
  author?: { name: string; email: string }
}): Promise<string> {
  const { accessToken, owner, repo, branch = 'main', commitMessage, files, binaryFiles = [], author } = options
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Ascent-Coding-Academy'
  }

  // 1. Get branch reference
  const refResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers })
  if (!refResp.ok) {
    throw new Error(`Failed to get git reference for branch ${branch}: HTTP ${refResp.status}`)
  }
  const refData = await refResp.json()
  const latestCommitSha = refData.object.sha

  // 2. Create Blobs for all modified files
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = []

  // Text files
  for (const [path, content] of Object.entries(files)) {
    const blobResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        encoding: 'utf-8'
      })
    })
    if (!blobResp.ok) {
      throw new Error(`Failed to create blob for ${path}: HTTP ${blobResp.status}`)
    }
    const blobData = await blobResp.json()
    treeItems.push({
      path,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha
    })
  }

  // Binary files
  for (const bin of binaryFiles) {
    const blobResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: bin.base64Content,
        encoding: 'base64'
      })
    })
    if (blobResp.ok) {
      const blobData = await blobResp.json()
      treeItems.push({
        path: bin.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      })
    }
  }

  // 3. Create Tree
  const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: latestCommitSha,
      tree: treeItems
    })
  })
  if (!treeResp.ok) {
    throw new Error(`Failed to create git tree: HTTP ${treeResp.status}`)
  }
  const treeData = await treeResp.json()
  const newTreeSha = treeData.sha

  // 4. Create Commit
  const commitPayload: any = {
    message: commitMessage,
    tree: newTreeSha,
    parents: [latestCommitSha]
  }
  if (author?.name && author?.email) {
    const nowIso = new Date().toISOString()
    commitPayload.author = { name: author.name, email: author.email, date: nowIso }
    commitPayload.committer = { name: author.name, email: author.email, date: nowIso }
  }

  const commitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify(commitPayload)
  })
  if (!commitResp.ok) {
    throw new Error(`Failed to create git commit: HTTP ${commitResp.status}`)
  }
  const commitData = await commitResp.json()
  const newCommitSha = commitData.sha

  // 5. Update branch reference
  const updateRefResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      sha: newCommitSha,
      force: false
    })
  })
  if (!updateRefResp.ok) {
    throw new Error(`Failed to update git reference: HTTP ${updateRefResp.status}`)
  }

  return newCommitSha
}

// ---------------------------------------------------------------------------
// RESILIENT BACKGROUND QUEUE (Serialized per project, Non-blocking)
// ---------------------------------------------------------------------------
interface SyncJob {
  projectId: string
  userId: string
  moduleIndex: number
  moduleTitle: string
  userFiles: Record<string, string>
  allModules: Array<{ id: string; title: string; learningObjective?: string }>
  completedModuleIds: string[]
  completedPages?: string[]
}

const syncQueues = new Map<string, Promise<void>>()

export function triggerBackgroundModuleSync(job: SyncJob): void {
  // Chain behind the existing project queue to ensure strictly serialized order
  const existingQueue = syncQueues.get(job.projectId) || Promise.resolve()

  const nextQueue = existingQueue.then(async () => {
    let retries = 0
    const maxRetries = 3

    while (retries <= maxRetries) {
      try {
        const project = await getProjectById(job.projectId)
        const user = await findUserById(job.userId)
        if (!project || !user || !user.encryptedToken) return

        const token = decryptToken(user.encryptedToken)
        if (!token) return

        // Update status to syncing
        project.repo = {
          ...project.repo!,
          syncStatus: 'syncing',
          error: undefined
        }
        await saveProject(project)

        const defaultBranch = project.repo?.defaultBranch || 'main'
        const repoName = project.repo?.name || sanitizeRepoSlug(project.name)

        const readme = generateProjectReadme({
          appName: project.name,
          summary: project.prompt || project.spec?.summary || 'Web Application',
          techStack: project.useTailwind ? 'HTML + Tailwind CSS + JavaScript' : 'HTML + Plain CSS + JavaScript',
          modules: job.allModules,
          completedModuleIds: new Set(job.completedModuleIds),
          completedPages: job.completedPages
        })

        const filesToCommit = {
          'README.md': readme,
          ...job.userFiles
        }

        const commitSha = await pushCommitViaGitDataApi({
          accessToken: token,
          owner: user.username,
          repo: repoName,
          branch: defaultBranch,
          commitMessage: `Module ${job.moduleIndex + 1}: ${job.moduleTitle}`,
          files: filesToCommit,
          author: {
            name: user.displayName || user.username,
            email: user.noreplyEmail || user.email || `${user.username}@users.noreply.github.com`
          }
        })

        project.repo = {
          ...project.repo!,
          lastCommitSha: commitSha,
          syncStatus: 'synced',
          lastPushedAt: new Date(),
          error: undefined
        }
        await saveProject(project)
        console.log(`[GitHub Sync] Synced module "${job.moduleTitle}" for project ${project.name} (${commitSha.slice(0, 7)})`)
        return
      } catch (err: any) {
        retries++
        const msg = String(err?.message || err || '')
        console.warn(`[GitHub Sync] Attempt ${retries} failed for project ${job.projectId}: ${redactSecrets(msg)}`)

        if (msg.includes('401') || msg.includes('Bad credentials')) {
          // Token revoked by user
          const project = await getProjectById(job.projectId)
          if (project && project.repo) {
            project.repo.syncStatus = 'failed'
            project.repo.error = 'token_revoked'
            await saveProject(project)
          }
          return
        }

        if (msg.includes('404') || msg.includes('Not Found')) {
          // Repo missing or deleted by user
          const project = await getProjectById(job.projectId)
          if (project && project.repo) {
            project.repo.syncStatus = 'failed'
            project.repo.error = 'repo_missing'
            await saveProject(project)
          }
          return
        }

        if (retries > maxRetries) {
          const project = await getProjectById(job.projectId)
          if (project && project.repo) {
            project.repo.syncStatus = 'failed'
            project.repo.error = msg
            await saveProject(project)
          }
          return
        }

        // Exponential backoff: 2s, 4s, 8s
        const backoffMs = 2000 * Math.pow(2, retries - 1)
        await new Promise(r => setTimeout(r, backoffMs))
      }
    }
  }).catch(err => {
    console.error('[GitHub Sync Queue] Fatal queue task error:', redactSecrets(String(err)))
  })

  syncQueues.set(job.projectId, nextQueue)
}
