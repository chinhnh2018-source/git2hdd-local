import fs from 'fs'
import path from 'path'

/**
 * Chuẩn hóa đường dẫn Windows: chuyển `/` thành `\`, xử lý dấu cách.
 * Dùng `path.win32` để đảm bảo chuẩn Win32 bất kể OS hiện tại.
 *
 * @param {string} inputPath - Đường dẫn cần chuẩn hóa
 * @returns {string} Đường dẫn đã chuẩn hóa theo chuẩn Win32
 */
export function normalizePath(inputPath) {
  if (typeof inputPath !== 'string') return inputPath

  // Chuyển tất cả `/` thành `\` rồi normalize theo path.win32
  const withBackslashes = inputPath.replace(/\//g, '\\')
  return path.win32.normalize(withBackslashes)
}

/**
 * Kiểm tra đường dẫn có tồn tại trên hệ thống file không.
 *
 * @param {string} p - Đường dẫn cần kiểm tra
 * @returns {Promise<boolean>} `true` nếu tồn tại, `false` nếu không
 */
export async function pathExists(p) {
  try {
    await fs.promises.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Tạo thư mục đệ quy nếu chưa tồn tại.
 * Không throw nếu thư mục đã tồn tại.
 *
 * @param {string} p - Đường dẫn thư mục cần tạo
 * @returns {Promise<void>}
 */
export async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true })
}

/**
 * Kiểm tra đường dẫn có phải là bare Git repository không.
 * Bare repo có file `HEAD` nhưng không có subfolder `.git`.
 *
 * @param {string} p - Đường dẫn thư mục cần kiểm tra
 * @returns {Promise<boolean>} `true` nếu là bare repo, `false` nếu không
 */
export async function isBareRepo(p) {
  try {
    // Bare repo phải có file HEAD
    const headPath = path.join(p, 'HEAD')
    const hasHead = await pathExists(headPath)
    if (!hasHead) return false

    // Bare repo không có subfolder .git
    const gitDirPath = path.join(p, '.git')
    const hasGitDir = await pathExists(gitDirPath)
    if (hasGitDir) return false

    return true
  } catch {
    return false
  }
}
