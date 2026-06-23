/**
 * ProjectRegistry.js — Quản lý danh sách nhiều dự án cho Web GUI
 *
 * Registry được lưu tập trung tại ~/.git2hdd/projects.json để Web GUI có thể
 * thêm / quản lý / chuyển đổi giữa nhiều dự án mà không phụ thuộc vào thư mục
 * hiện tại (process.cwd()). Mỗi dự án trỏ tới sourcePath — nơi chứa file
 * git2hdd.config.json của riêng dự án đó.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

const REGISTRY_DIR = path.join(os.homedir(), '.git2hdd')
const REGISTRY_PATH = path.join(REGISTRY_DIR, 'projects.json')

/**
 * @typedef {Object} Project
 * @property {string} id      - Mã định danh ổn định (hash của path)
 * @property {string} name    - Tên hiển thị (folder name)
 * @property {string} path    - Đường dẫn tuyệt đối tới sourcePath của dự án
 * @property {string} addedAt - ISO timestamp khi thêm dự án
 */

export function getRegistryPath() {
  return REGISTRY_PATH
}

/**
 * Lấy basename của đường dẫn theo cả kiểu Windows (\) lẫn POSIX (/).
 * Dùng thay cho path.basename để hoạt động đúng bất kể OS đang chạy.
 *
 * @param {string} p
 * @returns {string}
 */
function basenameOf(p) {
  const parts = String(p).split(/[\\/]+/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : String(p)
}

/**
 * Sinh id ổn định từ đường dẫn (không phân biệt hoa/thường — phù hợp Windows).
 *
 * @param {string} p
 * @returns {string}
 */
function makeId(p) {
  return crypto.createHash('sha1').update(p.toLowerCase()).digest('hex').slice(0, 12)
}

/**
 * Đọc registry từ đĩa. Trả về { projects: [] } nếu chưa tồn tại hoặc lỗi parse
 * (không throw để Web GUI luôn khởi động được).
 *
 * @returns {Promise<{ projects: Project[] }>}
 */
async function readRegistry() {
  let raw
  try {
    raw = await fs.promises.readFile(REGISTRY_PATH, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return { projects: [] }
    throw err
  }

  try {
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.projects)) return parsed
    return { projects: [] }
  } catch {
    // File hỏng — coi như rỗng thay vì làm sập server
    return { projects: [] }
  }
}

/**
 * Ghi registry xuống đĩa (atomic write: ghi temp → rename).
 *
 * @param {{ projects: Project[] }} data
 * @returns {Promise<void>}
 */
async function writeRegistry(data) {
  await fs.promises.mkdir(REGISTRY_DIR, { recursive: true })
  const tempPath = REGISTRY_PATH + '.tmp'
  await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8')
  await fs.promises.rename(tempPath, REGISTRY_PATH)
}

/**
 * Lấy danh sách tất cả dự án đã đăng ký.
 *
 * @returns {Promise<Project[]>}
 */
export async function listProjects() {
  const { projects } = await readRegistry()
  return projects
}

/**
 * Lấy một dự án theo id.
 *
 * @param {string} id
 * @returns {Promise<Project|null>}
 */
export async function getProject(id) {
  if (!id) return null
  const { projects } = await readRegistry()
  return projects.find((p) => p.id === id) || null
}

/**
 * Thêm một dự án mới vào registry. Nếu đã tồn tại (cùng path) thì trả về bản ghi cũ.
 *
 * @param {string} projectPath - Đường dẫn tuyệt đối tới sourcePath của dự án
 * @returns {Promise<Project>}
 * @throws {Error} Nếu đường dẫn rỗng
 */
export async function addProject(projectPath) {
  const normalized = String(projectPath || '').trim().replace(/[\\/]+$/, '')
  if (!normalized) {
    throw new Error('Đường dẫn dự án không được để trống.')
  }

  const data = await readRegistry()
  const id = makeId(normalized)

  const existing = data.projects.find((p) => p.id === id)
  if (existing) {
    // Cập nhật lại tên (phòng khi folder được đổi tên) và trả về
    existing.name = basenameOf(normalized) || normalized
    await writeRegistry(data)
    return existing
  }

  const project = {
    id,
    name: basenameOf(normalized) || normalized,
    path: normalized,
    addedAt: new Date().toISOString(),
  }
  data.projects.push(project)
  await writeRegistry(data)
  return project
}

/**
 * Xóa một dự án khỏi registry. KHÔNG xóa file/thư mục thật trên đĩa.
 *
 * @param {string} id
 * @returns {Promise<{ removed: boolean }>}
 */
export async function removeProject(id) {
  const data = await readRegistry()
  const before = data.projects.length
  data.projects = data.projects.filter((p) => p.id !== id)
  await writeRegistry(data)
  return { removed: data.projects.length !== before }
}
