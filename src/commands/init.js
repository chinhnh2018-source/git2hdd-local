/**
 * init.js — Command handler cho `git2hdd init`
 *
 * Khởi tạo Git repository tại đường dẫn nguồn và tạo git2hdd.config.json.
 */

import ora from 'ora'
import chalk from 'chalk'
import { checkGit } from '../core/SystemChecker.js'
import { init as gitInit } from '../core/GitService.js'
import { createDefault, saveConfig } from '../core/ConfigService.js'
import { normalizePath, pathExists } from '../utils/pathUtils.js'
import { PathNotFoundError } from '../utils/errorHandler.js'

/**
 * @param {Object} options
 * @param {string} options.source - Đường dẫn đến thư mục nguồn
 */
export async function runInit(options) {
  const source = normalizePath(options.source || process.cwd())

  // Kiểm tra git trong PATH
  await checkGit()

  // Kiểm tra đường dẫn tồn tại
  if (!(await pathExists(source))) {
    throw new PathNotFoundError(`Đường dẫn không tồn tại: "${source}"`)
  }

  const spinner = ora(`Khởi tạo Git repository tại ${chalk.cyan(source)}...`).start()

  try {
    const { alreadyExists } = await gitInit(source)

    if (alreadyExists) {
      spinner.warn(chalk.yellow(`Git repository đã tồn tại tại "${source}". Bỏ qua git init.`))
    } else {
      spinner.succeed(chalk.green(`Git repository đã được khởi tạo tại "${source}".`))
    }

    // Tạo/cập nhật config
    const config = createDefault(source)
    await saveConfig(source, config)
    console.log(chalk.green('✔') + ` Đã tạo file ${chalk.cyan('git2hdd.config.json')} tại "${source}".`)
    console.log()
    console.log(chalk.bold('Bước tiếp theo:'))
    console.log(`  ${chalk.cyan('git2hdd setup-remotes')} --targets <hdd1_path> <hdd2_path> ...`)
  } catch (err) {
    spinner.fail(chalk.red('Khởi tạo thất bại.'))
    throw err
  }
}
