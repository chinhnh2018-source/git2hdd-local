/**
 * setup-remotes.js — Command handler cho `git2hdd setup-remotes`
 *
 * Tạo bare Git repositories trên các HDD đích và cập nhật config.
 */

import ora from 'ora'
import chalk from 'chalk'
import { checkGit } from '../core/SystemChecker.js'
import { initBare } from '../core/GitService.js'
import { loadConfig, setField } from '../core/ConfigService.js'
import { normalizePath, ensureDir } from '../utils/pathUtils.js'

/**
 * @param {Object}   options
 * @param {string[]} options.targets - Danh sách đường dẫn HDD đích
 */
export async function runSetupRemotes(options) {
  await checkGit()

  const targets = (options.targets || []).map(normalizePath)

  if (targets.length === 0) {
    console.error(chalk.red('Lỗi: Cần ít nhất một đường dẫn --targets.'))
    process.exit(1)
  }

  if (targets.length > 10) {
    console.error(chalk.red('Lỗi: Tối đa 10 đường dẫn HDD đích.'))
    process.exit(1)
  }

  const results = []

  for (const target of targets) {
    const spinner = ora(`Tạo bare repo tại ${chalk.cyan(target)}...`).start()
    try {
      await ensureDir(target)
      const { alreadyExists } = await initBare(target)

      if (alreadyExists) {
        spinner.warn(chalk.yellow(`Bare repo đã tồn tại tại "${target}". Bỏ qua.`))
      } else {
        spinner.succeed(chalk.green(`Bare repo đã tạo tại "${target}".`))
      }
      results.push({ target, success: true, alreadyExists })
    } catch (err) {
      spinner.fail(chalk.red(`Thất bại tại "${target}": ${err.message}`))
      results.push({ target, success: false, error: err.message })
    }
  }

  // Cập nhật config với danh sách targets thành công
  const successfulTargets = results.filter((r) => r.success).map((r) => r.target)
  if (successfulTargets.length > 0) {
    try {
      const cwd = process.cwd()
      await setField(cwd, 'targets', successfulTargets)
      console.log()
      console.log(chalk.green('✔') + ` Đã cập nhật config với ${successfulTargets.length} backup repo.`)
    } catch {
      // Config chưa tồn tại — bỏ qua
    }
  }

  // Tổng kết
  const failed = results.filter((r) => !r.success)
  console.log()
  console.log(chalk.bold('Kết quả:'))
  console.log(`  Thành công: ${chalk.green(successfulTargets.length)}`)
  console.log(`  Thất bại:   ${failed.length > 0 ? chalk.red(failed.length) : chalk.gray(0)}`)

  if (successfulTargets.length > 0) {
    console.log()
    console.log(chalk.bold('Bước tiếp theo:'))
    console.log(`  ${chalk.cyan('git2hdd add-remotes')}`)
  }

  if (failed.length > 0) {
    process.exit(8)
  }
}
