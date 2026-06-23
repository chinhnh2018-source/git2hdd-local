/**
 * GitService.js — Wrapper cho các lệnh Git
 *
 * Tất cả git operations đều thông qua child_process.spawn để kiểm soát
 * stdout/stderr và exit code một cách chính xác.
 */

import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { GitOperationError } from '../utils/errorHandler.js'

/**
 * Helper nội bộ: spawn một lệnh git và trả về kết quả.
 *
 * @param {string[]} args - Arguments cho git
 * @param {string}   cwd  - Working directory
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
function spawnGit(args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd,
      shell: false,
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })

    proc.on('close', (code) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 1 })
    })

    proc.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, code: 1 })
    })
  })
}

/**
 * git init tại dir.
 *
 * @param {string} dir
 * @returns {Promise<{ alreadyExists: boolean }>}
 * @throws {GitOperationError}
 */
export async function init(dir) {
  // Kiểm tra .git đã tồn tại chưa
  const gitDir = path.join(dir, '.git')
  try {
    await fs.promises.access(gitDir)
    return { alreadyExists: true }
  } catch {
    // Chưa tồn tại — tiến hành init
  }

  const { code, stderr } = await spawnGit(['init'], dir)
  if (code !== 0) {
    throw new GitOperationError(`git init thất bại: ${stderr}`)
  }
  return { alreadyExists: false }
}

/**
 * git init --bare tại dir.
 *
 * @param {string} dir
 * @returns {Promise<{ alreadyExists: boolean }>}
 * @throws {GitOperationError}
 */
export async function initBare(dir) {
  // Kiểm tra HEAD đã tồn tại (dấu hiệu bare repo)
  const headFile = path.join(dir, 'HEAD')
  try {
    await fs.promises.access(headFile)
    return { alreadyExists: true }
  } catch {
    // Chưa tồn tại — tiến hành init --bare
  }

  const { code, stderr } = await spawnGit(['init', '--bare', dir], process.cwd())
  if (code !== 0) {
    throw new GitOperationError(`git init --bare thất bại: ${stderr}`)
  }
  return { alreadyExists: false }
}

/**
 * Thêm hoặc cập nhật một git remote.
 *
 * @param {string} repoDir    - Thư mục Source_Repo
 * @param {string} remoteName - Tên remote (ví dụ: "hdd1")
 * @param {string} remoteUrl  - URL của remote
 * @returns {Promise<{ action: 'added'|'updated' }>}
 * @throws {GitOperationError}
 */
export async function addOrUpdateRemote(repoDir, remoteName, remoteUrl) {
  // Kiểm tra remote đã tồn tại chưa
  const { stdout: existing } = await spawnGit(['remote'], repoDir)
  const remoteList = existing.split('\n').map((s) => s.trim()).filter(Boolean)

  if (remoteList.includes(remoteName)) {
    // Cập nhật URL
    const { code, stderr } = await spawnGit(
      ['remote', 'set-url', remoteName, remoteUrl],
      repoDir
    )
    if (code !== 0) {
      throw new GitOperationError(`git remote set-url thất bại: ${stderr}`)
    }
    return { action: 'updated' }
  } else {
    // Thêm mới
    const { code, stderr } = await spawnGit(
      ['remote', 'add', remoteName, remoteUrl],
      repoDir
    )
    if (code !== 0) {
      throw new GitOperationError(`git remote add thất bại: ${stderr}`)
    }
    return { action: 'added' }
  }
}

/**
 * Lấy danh sách remote hiện tại.
 *
 * @param {string} repoDir
 * @returns {Promise<Array<{ name: string, url: string }>>}
 */
export async function listRemotes(repoDir) {
  const { stdout } = await spawnGit(['remote', '-v'], repoDir)
  if (!stdout) return []

  const seen = new Set()
  const remotes = []

  for (const line of stdout.split('\n')) {
    // Format: "hdd1\tE:\backup\project.git (fetch)"
    const match = line.match(/^(\S+)\s+(.+?)\s+\(fetch\)$/)
    if (match) {
      const name = match[1]
      const url  = match[2]
      if (!seen.has(name)) {
        seen.add(name)
        remotes.push({ name, url })
      }
    }
  }

  return remotes
}

/**
 * git add .
 *
 * @param {string} repoDir
 * @returns {Promise<void>}
 * @throws {GitOperationError}
 */
export async function addAll(repoDir) {
  const { code, stderr } = await spawnGit(['add', '.'], repoDir)
  if (code !== 0) {
    throw new GitOperationError(`git add . thất bại: ${stderr}`)
  }
}

/**
 * git commit -m <message>.
 * Trả về { committed: false } nếu không có thay đổi.
 *
 * @param {string} repoDir
 * @param {string} message
 * @returns {Promise<{ committed: boolean, hash?: string }>}
 * @throws {GitOperationError}
 */
export async function commit(repoDir, message) {
  const { code, stdout, stderr } = await spawnGit(
    ['commit', '-m', message],
    repoDir
  )

  // Exit code 1 với "nothing to commit" — không phải lỗi
  if (code !== 0) {
    const combined = (stdout + stderr).toLowerCase()
    if (
      combined.includes('nothing to commit') ||
      combined.includes('nothing added to commit')
    ) {
      return { committed: false }
    }
    throw new GitOperationError(`git commit thất bại: ${stderr || stdout}`)
  }

  // Lấy commit hash từ output
  const hashMatch = stdout.match(/\[[\w/]+ ([a-f0-9]+)\]/)
  const hash = hashMatch ? hashMatch[1] : undefined

  return { committed: true, hash }
}

/**
 * git push <remote> <branch>.
 *
 * @param {string} repoDir
 * @param {string} remote
 * @param {string} branch
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function push(repoDir, remote, branch) {
  const { code, stderr, stdout } = await spawnGit(
    ['push', remote, branch],
    repoDir
  )

  if (code !== 0) {
    return { success: false, error: stderr || stdout || `exit code ${code}` }
  }
  return { success: true }
}

/**
 * Lấy tên branch hiện tại.
 *
 * @param {string} repoDir
 * @returns {Promise<string>}
 * @throws {GitOperationError}
 */
export async function getCurrentBranch(repoDir) {
  const { code, stdout, stderr } = await spawnGit(
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    repoDir
  )

  if (code !== 0) {
    throw new GitOperationError(`Không thể lấy tên branch hiện tại: ${stderr}`)
  }

  return stdout.trim()
}

/**
 * Tạo tên remote theo quy tắc hddN từ danh sách targets.
 * Ví dụ: 3 targets → ["hdd1", "hdd2", "hdd3"]
 *
 * @param {string[]} targets    - Danh sách đường dẫn targets
 * @param {string}   prefix     - Tiền tố (mặc định "hdd")
 * @returns {string[]}
 */
export function generateRemoteNames(targets, prefix = 'hdd') {
  return targets.map((_, i) => `${prefix}${i + 1}`)
}
