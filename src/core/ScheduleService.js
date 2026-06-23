/**
 * ScheduleService.js — Quản lý lịch chạy tự động bằng Windows Task Scheduler
 *
 * BẢO MẬT: Mọi lệnh schtasks đều được gọi qua execFile với mảng tham số
 * (shell: false ngầm định). Không bao giờ nối chuỗi giá trị do người dùng/cấu
 * hình cung cấp vào một command string → loại bỏ nguy cơ command injection.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadConfig } from './ConfigService.js'

const execFileAsync = promisify(execFile)

/**
 * Lấy basename theo cả kiểu Windows (\) lẫn POSIX (/).
 *
 * @param {string} p
 * @returns {string}
 */
function basenameOf(p) {
  const parts = String(p).split(/[\\/]+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : String(p)
}

/**
 * Lấy mã định danh dự án từ folder name của sourcePath.
 *
 * @param {string} [dir] - Thư mục chứa config của dự án (mặc định: cwd)
 * @returns {Promise<string>}
 */
export async function getProjectIdentifier(dir = process.cwd()) {
  try {
    const config = await loadConfig(dir)
    if (config && config.sourcePath) {
      return basenameOf(config.sourcePath).replace(/[^a-zA-Z0-9_-]/g, '_')
    }
  } catch (err) {
    // Không có config hoặc lỗi — fallback về thư mục hiện tại
  }
  return basenameOf(dir).replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Kiểm tra trạng thái tác vụ trong Windows Task Scheduler.
 *
 * @param {string} projectName - Tên dự án để tìm task
 * @returns {Promise<Object>} Trạng thái của task
 */
export async function queryTask(projectName) {
  const taskName = `Git2HDD_Backup_${projectName}`
  try {
    const { stdout } = await execFileAsync('schtasks', [
      '/query', '/tn', taskName, '/fo', 'csv', '/nh',
    ])
    // Định dạng CSV: "\Git2HDD_Backup_mu149","15-06-2026 10:00:00 PM","Ready"
    const parts = stdout.trim().split(',').map((p) => p.replace(/^"|"$/g, '').trim())
    if (parts.length >= 3) {
      return {
        exists: true,
        taskName: parts[0],
        nextRun: parts[1],
        status: parts[2],
      }
    }
    return { exists: false }
  } catch (err) {
    return { exists: false }
  }
}

/**
 * Tạo mới/cập nhật tác vụ daily backup trong Windows Task Scheduler.
 *
 * @param {string} projectName - Tên dự án (đã được làm sạch)
 * @param {string} time        - Thời gian chạy (HH:mm) — PHẢI được validate trước
 * @param {string} sourcePath  - Thư mục nguồn SSD của dự án
 */
export async function createTask(projectName, time, sourcePath) {
  const taskName = `Git2HDD_Backup_${projectName}`
  const nodePath = process.execPath

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const binPath = path.resolve(__dirname, '../../bin/git2hdd.js')

  // Giá trị /tr là MỘT tham số duy nhất (một command line mà schtasks tự parse).
  // Vì gọi qua execFile (không shell), sourcePath không thể "thoát" ra ngoài để
  // chèn lệnh tùy ý vào shell của tiến trình Node.
  const trValue = `"${nodePath}" "${binPath}" backup --cwd "${sourcePath}"`

  // schtasks /create /f sẽ ghi đè nếu task đã tồn tại
  await execFileAsync('schtasks', [
    '/create', '/f',
    '/tn', taskName,
    '/tr', trValue,
    '/sc', 'daily',
    '/st', time,
  ])
}

/**
 * Xóa tác vụ trong Windows Task Scheduler.
 *
 * @param {string} projectName - Tên dự án
 */
export async function deleteTask(projectName) {
  const taskName = `Git2HDD_Backup_${projectName}`
  await execFileAsync('schtasks', ['/delete', '/f', '/tn', taskName])
}
