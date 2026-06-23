/**
 * config.js — Command handler cho `git2hdd config`
 *
 * Hỗ trợ: --show, --set <key> <value>, --reset
 */

import chalk from 'chalk'
import {
  loadConfig,
  saveConfig,
  setField,
  createDefault,
  validate,
} from '../core/ConfigService.js'
import { ConfigNotFoundError, ConfigParseError } from '../utils/errorHandler.js'

/**
 * @param {Object}  options
 * @param {boolean} [options.show]  - Hiển thị config hiện tại
 * @param {string}  [options.set]   - Key cần cập nhật (dùng với value)
 * @param {string}  [options.value] - Giá trị mới
 * @param {boolean} [options.reset] - Reset về mặc định
 */
export async function runConfig(options) {
  const cwd = process.cwd()

  if (options.reset) {
    // Reset về mặc định
    let sourcePath = cwd
    try {
      const existing = await loadConfig(cwd)
      sourcePath = existing.sourcePath || cwd
    } catch {
      // Không có config cũ — dùng cwd
    }
    const defaultConfig = createDefault(sourcePath)
    await saveConfig(cwd, defaultConfig)
    console.log(chalk.green('✔ Config đã được reset về mặc định.'))
    console.log(JSON.stringify(defaultConfig, null, 2))
    return
  }

  if (options.set) {
    // Cập nhật một trường
    const key   = options.set
    let   value = options.value

    // Cố gắng parse JSON nếu có thể (để hỗ trợ array/number)
    try {
      value = JSON.parse(value)
    } catch {
      // Giữ nguyên string
    }

    try {
      await setField(cwd, key, value)
      console.log(chalk.green(`✔ Đã cập nhật ${chalk.cyan(key)} = ${JSON.stringify(value)}`))
    } catch (err) {
      if (err instanceof ConfigNotFoundError) {
        console.error(chalk.red('Lỗi: Chưa tìm thấy git2hdd.config.json.'))
        console.error(chalk.yellow('Hãy chạy `git2hdd init` trước.'))
        process.exit(2)
      }
      throw err
    }
    return
  }

  // Mặc định: --show
  try {
    const config = await loadConfig(cwd)
    const { valid, errors } = validate(config)

    console.log(chalk.bold('git2hdd.config.json:'))
    console.log(JSON.stringify(config, null, 2))

    if (!valid) {
      console.log()
      console.log(chalk.yellow('⚠ Cảnh báo: Config có vấn đề:'))
      for (const e of errors) {
        console.log(`  - ${e}`)
      }
    }
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      console.error(chalk.red('Lỗi: Chưa tìm thấy git2hdd.config.json.'))
      console.error(chalk.yellow('Hãy chạy `git2hdd init` để tạo mới.'))
      process.exit(2)
    }
    if (err instanceof ConfigParseError) {
      console.error(chalk.red('Lỗi: File config không đúng định dạng JSON.'))
      console.error(chalk.yellow('Hãy chạy `git2hdd config --reset` để khởi tạo lại.'))
      process.exit(2)
    }
    throw err
  }
}
