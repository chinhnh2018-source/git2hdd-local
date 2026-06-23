/**
 * gui.js — Command handler cho `git2hdd gui`
 *
 * Khởi chạy Express server và tự động mở dashboard trên trình duyệt.
 */

import { exec } from 'child_process'
import chalk from 'chalk'
import { startServer } from '../core/ServerService.js'

/**
 * @param {Object} options
 * @param {string} options.port - Cổng kết nối
 */
export async function runGui(options) {
  const port = parseInt(options.port || '3000', 10)

  if (isNaN(port) || port <= 0 || port > 65535) {
    console.error(chalk.red(`Lỗi: Cổng kết nối không hợp lệ: ${options.port}`))
    process.exit(1)
  }

  try {
    // Khởi chạy server Express
    await startServer(port)

    const url = `http://localhost:${port}`
    console.log(chalk.green('✔') + ` Giao diện web được khởi chạy tại: ${chalk.cyan(url)}`)
    console.log(chalk.gray('  Chỉ lắng nghe trên localhost (127.0.0.1) để bảo mật.'))
    console.log(chalk.gray('  Nhấn Ctrl+C để dừng server.'))

    // Tự động mở trình duyệt trên Windows
    if (process.platform === 'win32') {
      exec(`cmd /c start ${url}`, (err) => {
        if (err) {
          console.error(chalk.yellow(`[Warning] Không thể tự động mở trình duyệt: ${err.message}`))
        }
      })
    } else {
      // Cho macOS / Linux (phòng hờ)
      const startCmd = process.platform === 'darwin' ? 'open' : 'xdg-open'
      exec(`${startCmd} ${url}`, () => {})
    }
  } catch (err) {
    console.error(chalk.red(`Lỗi khi khởi chạy GUI server: ${err.message}`))
    process.exit(1)
  }
}
