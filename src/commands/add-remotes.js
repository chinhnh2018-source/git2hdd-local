/**
 * add-remotes.js — Command handler cho `git2hdd add-remotes`
 *
 * Đọc targets từ config và thêm/cập nhật git remotes trong Source_Repo.
 */

import chalk from 'chalk'
import { checkGit } from '../core/SystemChecker.js'
import { addOrUpdateRemote, listRemotes, generateRemoteNames } from '../core/GitService.js'
import { loadConfig } from '../core/ConfigService.js'
import { formatRemoteList } from '../utils/formatter.js'
import { ConfigNotFoundError } from '../utils/errorHandler.js'

export async function runAddRemotes() {
  await checkGit()

  const cwd = process.cwd()
  let config

  try {
    config = await loadConfig(cwd)
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      console.error(chalk.red('Lỗi: Chưa tìm thấy git2hdd.config.json.'))
      console.error(chalk.yellow('Hãy chạy `git2hdd init` trước.'))
      process.exit(2)
    }
    throw err
  }

  if (!config.targets || config.targets.length === 0) {
    console.error(chalk.red('Lỗi: Chưa có targets trong config.'))
    console.error(chalk.yellow('Hãy chạy `git2hdd setup-remotes --targets <path>...` trước.'))
    process.exit(2)
  }

  const prefix = config.remotePrefix || 'hdd'
  const remoteNames = generateRemoteNames(config.targets, prefix)

  for (let i = 0; i < config.targets.length; i++) {
    const remoteName = remoteNames[i]
    const remoteUrl  = config.targets[i]

    const { action } = await addOrUpdateRemote(cwd, remoteName, remoteUrl)
    const actionLabel = action === 'added'
      ? chalk.green('thêm mới')
      : chalk.yellow('cập nhật')
    console.log(`  ${chalk.cyan(remoteName)}  ${actionLabel}  →  ${remoteUrl}`)
  }

  // Hiển thị danh sách remote sau khi hoàn thành
  const remotes = await listRemotes(cwd)
  console.log()
  console.log(chalk.bold('Danh sách remote hiện tại:'))
  console.log(formatRemoteList(remotes))
  console.log()
  console.log(chalk.bold('Bước tiếp theo:'))
  console.log(`  ${chalk.cyan('git2hdd backup')} --message "first commit"`)
}
