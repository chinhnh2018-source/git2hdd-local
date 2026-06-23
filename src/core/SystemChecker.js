/**
 * SystemChecker.js — Kiểm tra phụ thuộc hệ thống trước khi thực thi
 *
 * Kiểm tra: git trong PATH, robocopy trong PATH, OS, Node.js version.
 */

import { spawnSync, exec } from 'child_process'
import { promisify } from 'util'
import { DependencyError, NodeVersionError } from '../utils/errorHandler.js'
import semver from 'semver'

const execAsync = promisify(exec)

/**
 * Kiểm tra `git` có trong PATH không.
 * Throw DependencyError nếu không tìm thấy.
 *
 * @returns {Promise<void>}
 * @throws {DependencyError}
 */
export async function checkGit() {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8', shell: false })
  if (result.error || result.status !== 0) {
    throw new DependencyError(
      'Không tìm thấy `git` trong PATH. Hãy cài đặt Git for Windows: https://git-scm.com/download/win'
    )
  }
}


/**
 * Kiểm tra hệ điều hành hiện tại.
 *
 * @returns {{ isWindows: boolean, version?: string }}
 */
export function checkOS() {
  const isWindows = process.platform === 'win32'
  const version   = process.platform === 'win32' ? process.version : undefined
  return { isWindows, version }
}

/**
 * Kiểm tra phiên bản Node.js hiện tại so với yêu cầu tối thiểu.
 *
 * @param {string} minVersion - Phiên bản tối thiểu (semver), ví dụ "16.0.0"
 * @returns {{ valid: boolean, current: string, required: string }}
 * @throws {NodeVersionError} Nếu phiên bản hiện tại thấp hơn yêu cầu
 */
export function checkNodeVersion(minVersion = '16.0.0') {
  const current = process.version.replace(/^v/, '')
  const valid    = semver.gte(current, minVersion)

  if (!valid) {
    throw new NodeVersionError(
      `Phiên bản Node.js hiện tại (${current}) thấp hơn yêu cầu tối thiểu (${minVersion}). Hãy nâng cấp Node.js.`
    )
  }

  return { valid: true, current, required: minVersion }
}

/**
 * Quét các ổ đĩa logic trên Windows
 * @returns {Promise<Array>} Danh sách ổ đĩa
 */
export async function detectDrives() {
  try {
    const { stdout } = await execAsync('powershell -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json"')
    if (!stdout.trim()) return []
    const parsed = JSON.parse(stdout)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    
    // Đảm bảo các thuộc tính được chuẩn hóa và loại bỏ các ký tự null
    return list.map(d => ({
      DeviceID: d.DeviceID || '',
      VolumeName: d.VolumeName || '',
      Size: d.Size || 0,
      FreeSpace: d.FreeSpace || 0
    }))
  } catch (err) {
    return []
  }
}
