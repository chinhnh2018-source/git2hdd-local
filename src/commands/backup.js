/**
 * backup.js — Command handler cho `git2hdd backup`
 *
 * Thực thi: git add . → git commit → git push đến tất cả remotes.
 * Hỗ trợ --message, --dry-run. Báo cáo tổng kết sau khi hoàn thành.
 */

import ora from 'ora'
import chalk from 'chalk'
import { checkGit } from '../core/SystemChecker.js'
import {
  addAll,
  commit,
  push,
  getCurrentBranch,
  generateRemoteNames,
} from '../core/GitService.js'
import { loadConfig } from '../core/ConfigService.js'
import { appendLog } from '../core/LogService.js'
import { formatTimestamp, formatPushSummary } from '../utils/formatter.js'
import path from 'path'

/**
 * @param {Object}  options
 * @param {string}  [options.message] - Commit message
 * @param {boolean} [options.dryRun]  - Nếu true, chỉ preview
 */
export async function runBackup(options) {
  await checkGit()

  const cwd    = process.cwd()
  const config = await loadConfig(cwd)

  const sourcePath = config.sourcePath || cwd
  const targets    = config.targets || []
  const prefix     = config.remotePrefix || 'hdd'

  if (targets.length === 0) {
    console.error(chalk.red('Lỗi: Chưa có targets trong config.'))
    console.error(chalk.yellow('Hãy chạy `git2hdd setup-remotes` và `git2hdd add-remotes` trước.'))
    process.exit(2)
  }

  const message = options.message || formatTimestamp(new Date())
  const dryRun  = options.dryRun || false

  if (dryRun) {
    console.log(chalk.yellow('[DRY RUN] Các thao tác sẽ được thực hiện:'))
    console.log(`  git add .`)
    console.log(`  git commit -m "${message}"`)
    const remoteNames = generateRemoteNames(targets, prefix)
    const branch = await getCurrentBranch(sourcePath).catch(() => 'main')
    for (const name of remoteNames) {
      console.log(`  git push ${name} ${branch}`)
    }
    return
  }

  // git add .
  const addSpinner = ora('git add .').start()
  try {
    await addAll(sourcePath)
    addSpinner.succeed('git add .')
  } catch (err) {
    addSpinner.fail(chalk.red(`git add . thất bại: ${err.message}`))
    throw err
  }

  // git commit
  const commitSpinner = ora(`git commit -m "${message}"`).start()
  let committed = false
  try {
    const result = await commit(sourcePath, message)
    committed = result.committed
    if (committed) {
      commitSpinner.succeed(`git commit: ${chalk.green(result.hash || 'ok')}`)
    } else {
      commitSpinner.warn(chalk.yellow('Không có thay đổi để commit.'))
    }
  } catch (err) {
    commitSpinner.fail(chalk.red(`git commit thất bại: ${err.message}`))
    throw err
  }

  // Lấy branch hiện tại
  const branch = await getCurrentBranch(sourcePath).catch(() => config.defaultBranch || 'main')

  // git push đến tất cả remotes
  const remoteNames = generateRemoteNames(targets, prefix)
  const pushResults = []

  for (let i = 0; i < targets.length; i++) {
    const remoteName = remoteNames[i]
    const spinner    = ora(`git push ${remoteName} ${branch}...`).start()

    const result = await push(sourcePath, remoteName, branch)
    pushResults.push({ remote: remoteName, ...result })

    if (result.success) {
      spinner.succeed(`git push ${chalk.cyan(remoteName)} ${branch}`)
    } else {
      spinner.fail(chalk.red(`git push ${remoteName} thất bại: ${result.error}`))
    }
  }

  // Ghi log
  const logPath = path.join(sourcePath, 'git2hdd.log')
  const logResults = {}
  for (const r of pushResults) {
    logResults[r.remote] = r.success ? 'success' : 'failed'
  }
  await appendLog(logPath, {
    timestamp: new Date().toISOString(),
    command: 'backup',
    targets: remoteNames,
    results: logResults,
    message,
  })

  // Báo cáo tổng kết
  console.log()
  console.log(chalk.bold('Kết quả backup:'))
  console.log(formatPushSummary(pushResults))

  const hasFailure = pushResults.some((r) => !r.success)
  if (hasFailure) {
    process.exit(8)
  }
}
