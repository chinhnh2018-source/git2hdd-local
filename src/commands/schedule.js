/**
 * schedule.js — Command handler cho `git2hdd schedule`
 *
 * Cho phép thiết lập, truy vấn, và xóa lịch chạy tự động daily backup.
 */

import chalk from 'chalk'
import { getProjectIdentifier, queryTask, createTask, deleteTask } from '../core/ScheduleService.js'
import { loadConfig } from '../core/ConfigService.js'

/**
 * @param {Object}  options
 * @param {string}  [options.daily]  - Thời gian chạy daily (HH:mm)
 * @param {boolean} [options.delete] - Xóa lịch chạy tự động
 * @param {boolean} [options.status] - Kiểm tra trạng thái lịch chạy
 */
export async function runSchedule(options) {
  const projectName = await getProjectIdentifier()

  if (options.delete) {
    try {
      await deleteTask(projectName)
      console.log(chalk.green(`✔ Đã xóa thành công lịch chạy tự động cho dự án "${projectName}".`))
    } catch (err) {
      console.error(chalk.red(`× Lỗi khi xóa lịch chạy tự động: ${err.message}`))
      process.exit(1)
    }
    return
  }

  if (options.daily) {
    const time = options.daily.trim()
    // Kiểm tra định dạng thời gian HH:mm (00:00 - 23:59)
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      console.error(chalk.red('× Định dạng thời gian không hợp lệ. Vui lòng nhập định dạng HH:mm trong khoảng từ 00:00 đến 23:59 (ví dụ: 22:00 hoặc 08:30).'))
      process.exit(1)
    }

    try {
      const config = await loadConfig(process.cwd())
      const sourcePath = config.sourcePath || process.cwd()

      await createTask(projectName, time, sourcePath)
      console.log(chalk.green(`✔ Đã thiết lập lịch Daily Backup thành công lúc ${time} hàng ngày.`))
      console.log(`  - Tên Task: Git2HDD_Backup_${projectName}`)
      console.log(`  - Thư mục làm việc: ${sourcePath}`)
    } catch (err) {
      console.error(chalk.red(`× Lỗi khi tạo lịch chạy tự động: ${err.message}`))
      process.exit(1)
    }
    return
  }

  // Mặc định hoặc khi dùng --status
  try {
    const status = await queryTask(projectName)
    if (status.exists) {
      console.log(chalk.bold(`Trạng thái lịch chạy tự động dự án "${projectName}":`))
      console.log(`  - Trạng thái: ${chalk.green(status.status)}`)
      console.log(`  - Lần chạy kế tiếp: ${status.nextRun}`)
      console.log(`  - Tên Task: ${status.taskName}`)
    } else {
      console.log(chalk.yellow(`Dự án "${projectName}" hiện chưa được lên lịch chạy tự động.`))
      console.log(`Chạy lệnh sau để lên lịch daily backup lúc 22:00:`)
      console.log(chalk.cyan(`  git2hdd schedule --daily 22:00`))
    }
  } catch (err) {
    console.error(chalk.red(`× Lỗi khi truy vấn lịch chạy tự động: ${err.message}`))
    process.exit(1)
  }
}
