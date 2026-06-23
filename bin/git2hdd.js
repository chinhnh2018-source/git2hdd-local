#!/usr/bin/env node
/**
 * git2hdd — CLI entry point
 *
 * npm install -g git2hdd
 * git2hdd <command> [options]
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import { Command } from 'commander'
import chalk from 'chalk'

import { checkNodeVersion, checkOS } from '../src/core/SystemChecker.js'
import { handleError } from '../src/utils/errorHandler.js'

import { runInit }         from '../src/commands/init.js'
import { runSetupRemotes } from '../src/commands/setup-remotes.js'
import { runAddRemotes }   from '../src/commands/add-remotes.js'
import { runBackup }       from '../src/commands/backup.js'
import { runConfig }       from '../src/commands/config.js'
import { runLog }          from '../src/commands/log.js'
import { runGui }          from '../src/commands/gui.js'
import { runSchedule }     from '../src/commands/schedule.js'

// Đọc version từ package.json
const require = createRequire(import.meta.url)
const pkg     = require('../package.json')

// Kiểm tra Node.js version trước khi làm bất cứ điều gì
try {
  checkNodeVersion('16.0.0')
} catch (err) {
  handleError(err)
}

// Cảnh báo nếu không phải Windows
const { isWindows } = checkOS()
if (!isWindows) {
  process.stderr.write(
    chalk.yellow('[git2hdd] Cảnh báo: Công cụ này được thiết kế cho Windows 10+. Một số tính năng có thể không hoạt động trên OS hiện tại.\n')
  )
}

// Khởi tạo program
const program = new Command()

program
  .name('git2hdd')
  .description('Tự động hóa Git backup từ SSD sang nhiều HDD trên Windows')
  .version(pkg.version, '-v, --version', 'Hiển thị phiên bản hiện tại')

// ─── git2hdd init ────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Khởi tạo Git repository và tạo file git2hdd.config.json')
  .option('-s, --source <path>', 'Đường dẫn đến thư mục nguồn (mặc định: thư mục hiện tại)')
  .addHelpText('after', `
Ví dụ:
  $ git2hdd init --source D:\\work\\my-project
  $ git2hdd init                          # dùng thư mục hiện tại
`)
  .action(async (options) => {
    try {
      await runInit(options)
    } catch (err) {
      handleError(err)
    }
  })

// ─── git2hdd setup-remotes ───────────────────────────────────────────────────
program
  .command('setup-remotes')
  .description('Tạo bare Git repositories trên các HDD đích')
  .requiredOption('-t, --targets <paths...>', 'Danh sách đường dẫn HDD đích (1-10 đường dẫn)')
  .addHelpText('after', `
Ví dụ:
  $ git2hdd setup-remotes --targets E:\\backup\\project.git F:\\backup\\project.git
`)
  .action(async (options) => {
    try {
      await runSetupRemotes(options)
    } catch (err) {
      handleError(err)
    }
  })

// ─── git2hdd add-remotes ─────────────────────────────────────────────────────
program
  .command('add-remotes')
  .description('Thêm các HDD làm Git remote vào Source_Repo')
  .addHelpText('after', `
Ví dụ:
  $ git2hdd add-remotes
`)
  .action(async () => {
    try {
      await runAddRemotes()
    } catch (err) {
      handleError(err)
    }
  })

// ─── git2hdd backup ──────────────────────────────────────────────────────────
program
  .command('backup')
  .description('git add . → git commit → git push đến tất cả HDD (dùng hàng ngày)')
  .option('-m, --message <msg>', 'Commit message (mặc định: timestamp hiện tại)')
  .option('--dry-run', 'Xem trước các thao tác mà không thực thi')
  .option('--cwd <path>', 'Chạy lệnh tại thư mục được chỉ định')
  .addHelpText('after', `
Ví dụ:
  $ git2hdd backup --message "hoàn thành tính năng login"
  $ git2hdd backup                        # dùng timestamp làm commit message
  $ git2hdd backup --dry-run              # xem trước
  $ git2hdd backup --cwd D:\\work\\my-project
`)
  .action(async (options) => {
    try {
      if (options.cwd) {
        process.chdir(options.cwd)
      }
      await runBackup(options)
    } catch (err) {
      handleError(err)
    }
  })

// ─── git2hdd config ──────────────────────────────────────────────────────────
program
  .command('config')
  .description('Xem và chỉnh sửa cấu hình git2hdd.config.json')
  .option('--show', 'Hiển thị cấu hình hiện tại (mặc định)')
  .option('--set <key>', 'Tên trường cần cập nhật')
  .option('--value <value>', 'Giá trị mới')
  .option('--reset', 'Reset cấu hình về mặc định')
  .addHelpText('after', `
Ví dụ:
  $ git2hdd config --show
  $ git2hdd config --set defaultBranch --value main
  $ git2hdd config --reset
`)
  .action(async (options) => {
    try {
      await runConfig(options)
    } catch (err) {
      handleError(err)
    }
  })

// ─── git2hdd log ─────────────────────────────────────────────────────────────
program
  .command('log')
  .description('Xem lịch sử các lần backup/mirror')
  .option('-n, --lines <number>', 'Số bản ghi cần hiển thị (mặc định: 20)', '20')
  .addHelpText('after', `
Ví dụ:
  $ git2hdd log
  $ git2hdd log --lines 50
`)
  .action(async (options) => {
    try {
      await runLog(options)
    } catch (err) {
      handleError(err)
    }
  })

// ─── git2hdd gui ─────────────────────────────────────────────────────────────
program
  .command('gui')
  .description('Khởi chạy giao diện web trực quan')
  .option('-p, --port <number>', 'Cổng kết nối (mặc định: 3000)', '3000')
  .addHelpText('after', `
Ví dụ:
  $ git2hdd gui
  $ git2hdd gui --port 3500
`)
  .action(async (options) => {
    try {
      await runGui(options)
    } catch (err) {
      handleError(err)
    }
  })

// ─── git2hdd schedule ────────────────────────────────────────────────────────
program
  .command('schedule')
  .description('Thiết lập và quản lý lịch chạy tự động backup hàng ngày')
  .option('-d, --daily <time>', 'Lên lịch daily backup vào thời gian chỉ định (định dạng HH:mm, ví dụ: 22:00)')
  .option('--delete', 'Hủy lịch chạy tự động')
  .option('--status', 'Hiển thị trạng thái lịch chạy hiện tại (mặc định)')
  .addHelpText('after', `
Ví dụ:
  $ git2hdd schedule --daily 22:00
  $ git2hdd schedule --status
  $ git2hdd schedule --delete
`)
  .action(async (options) => {
    try {
      await runSchedule(options)
    } catch (err) {
      handleError(err)
    }
  })

// Parse arguments
program.parse(process.argv)
