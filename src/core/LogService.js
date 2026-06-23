/**
 * LogService.js — Ghi và đọc lịch sử thao tác git2hdd
 *
 * Mỗi lần chạy lệnh backup/mirror được ghi vào git2hdd.log
 * dưới dạng JSON Lines (mỗi dòng là một JSON object).
 */

import fs from 'fs'
import path from 'path'

const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

/**
 * @typedef {Object} LogEntry
 * @property {string}                          timestamp - ISO 8601
 * @property {'backup'|'mirror'}               command   - Lệnh đã thực thi
 * @property {string[]}                        targets   - Danh sách remote hoặc mirrorTarget
 * @property {Record<string, 'success'|'failed'>} results - Kết quả từng target
 * @property {string}                          [message] - Commit message (backup only)
 */

/**
 * Serialize một LogEntry thành dòng JSON.
 *
 * @param {LogEntry} entry
 * @returns {string}
 */
export function serialize(entry) {
  return JSON.stringify(entry)
}

/**
 * Deserialize một dòng JSON thành LogEntry.
 * Trả về null nếu dòng không hợp lệ.
 *
 * @param {string} line
 * @returns {LogEntry|null}
 */
export function deserialize(line) {
  if (!line || !line.trim()) return null
  try {
    return JSON.parse(line.trim())
  } catch {
    return null
  }
}

/**
 * Ghi một LogEntry vào cuối file log.
 * Không throw nếu ghi thất bại — chỉ in cảnh báo ra stderr.
 *
 * @param {string}   logPath - Đường dẫn đến file log
 * @param {LogEntry} entry   - Entry cần ghi
 * @returns {Promise<void>}
 */
export async function appendLog(logPath, entry) {
  try {
    await rotateIfNeeded(logPath)
    const line = serialize(entry) + '\n'
    await fs.promises.appendFile(logPath, line, 'utf8')
  } catch (err) {
    process.stderr.write(`[git2hdd] Cảnh báo: Không thể ghi log: ${err.message}\n`)
  }
}

/**
 * Đọc N bản ghi log gần nhất, sắp xếp theo timestamp giảm dần.
 *
 * @param {string} logPath - Đường dẫn đến file log
 * @param {number} lines   - Số bản ghi tối đa cần đọc (mặc định 20)
 * @returns {Promise<LogEntry[]>}
 */
export async function readLog(logPath, lines = 20) {
  let content
  try {
    content = await fs.promises.readFile(logPath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }

  const entries = content
    .split('\n')
    .map(deserialize)
    .filter((e) => e !== null)

  // Sắp xếp theo timestamp giảm dần (mới nhất trước)
  entries.sort((a, b) => {
    const ta = a.timestamp || ''
    const tb = b.timestamp || ''
    return tb.localeCompare(ta)
  })

  return entries.slice(0, lines)
}

/**
 * Rotate log nếu kích thước vượt quá 10MB.
 * Xóa các entries cũ nhất cho đến khi file < 10MB.
 *
 * @param {string} logPath - Đường dẫn đến file log
 * @returns {Promise<void>}
 */
export async function rotateIfNeeded(logPath) {
  let stat
  try {
    stat = await fs.promises.stat(logPath)
  } catch {
    // File chưa tồn tại — không cần rotate
    return
  }

  if (stat.size < MAX_LOG_SIZE_BYTES) return

  // Đọc tất cả entries
  let content
  try {
    content = await fs.promises.readFile(logPath, 'utf8')
  } catch {
    return
  }

  const allEntries = content
    .split('\n')
    .map(deserialize)
    .filter((e) => e !== null)

  // Xóa dần từ đầu (cũ nhất) cho đến khi ước tính kích thước < 10MB
  let kept = allEntries
  while (kept.length > 1) {
    const estimated = kept.reduce((sum, e) => sum + serialize(e).length + 1, 0)
    if (estimated < MAX_LOG_SIZE_BYTES) break
    kept = kept.slice(Math.ceil(kept.length * 0.2)) // Xóa 20% cũ nhất mỗi lần
  }

  const newContent = kept.map(serialize).join('\n') + (kept.length > 0 ? '\n' : '')
  const tempPath = logPath + '.tmp'
  await fs.promises.writeFile(tempPath, newContent, 'utf8')
  await fs.promises.rename(tempPath, logPath)
}
