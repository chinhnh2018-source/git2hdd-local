/**
 * log.js — Command handler cho `git2hdd log`
 *
 * Hiển thị lịch sử các lần backup/mirror gần nhất.
 */

import chalk from 'chalk'
import { loadConfig } from '../core/ConfigService.js'
import { readLog } from '../core/LogService.js'
import { formatLogEntries } from '../utils/formatter.js'
import path from 'path'

/**
 * @param {Object} options
 * @param {number} [options.lines] - Số bản ghi cần hiển thị (mặc định 20)
 */
export async function runLog(options) {
  const cwd   = process.cwd()
  const lines = parseInt(options.lines, 10) || 20

  let sourcePath = cwd
  try {
    const config = await loadConfig(cwd)
    sourcePath = config.sourcePath || cwd
  } catch {
    // Không có config — dùng cwd
  }

  const logPath = path.join(sourcePath, 'git2hdd.log')
  const entries = await readLog(logPath, lines)

  if (entries.length === 0) {
    console.log(chalk.yellow('Chưa có lịch sử backup. Hãy chạy `git2hdd backup` để bắt đầu.'))
    return
  }

  console.log(chalk.bold(`Lịch sử ${entries.length} thao tác gần nhất:`))
  console.log()
  console.log(formatLogEntries(entries))
}
