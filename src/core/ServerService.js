/**
 * ServerService.js — Backend Express server cho giao diện GUI
 *
 * BẢO MẬT:
 *  - Mặc định chỉ bind 127.0.0.1 (loopback) → không lộ ra mạng LAN.
 *  - Endpoint /api/run spawn CLI với mảng tham số và shell: false → không
 *    còn nguy cơ command injection qua tham số `message`.
 *
 * ĐA DỰ ÁN:
 *  - Một registry tập trung (ProjectRegistry) cho phép thêm/quản lý nhiều dự án.
 *  - Mỗi request có thể kèm ?project=<id> (hoặc body.project) để thao tác trên
 *    đúng dự án đó; không có thì mặc định dùng thư mục hiện tại (process.cwd()).
 *  - project param chỉ được resolve qua registry → không cho phép truyền đường
 *    dẫn tùy ý vào server.
 */

import express from 'express'
import path from 'path'
import http from 'http'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { checkGit, detectDrives } from './SystemChecker.js'
import { loadConfig, saveConfig, validate } from './ConfigService.js'
import { readLog } from './LogService.js'
import { getProjectIdentifier, queryTask, createTask, deleteTask } from './ScheduleService.js'
import { listProjects, getProject, addProject, removeProject } from './ProjectRegistry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '../public')
const binPath = path.resolve(__dirname, '../../bin/git2hdd.js')

let serverInstance = null

/**
 * Resolve thư mục làm việc của dự án từ id trong registry.
 * - 'cwd' hoặc rỗng → process.cwd() (dự án hiện tại / tương thích ngược)
 * - id hợp lệ trong registry → path của dự án
 * - id không tồn tại → fallback về process.cwd()
 *
 * @param {string} [projectId]
 * @returns {Promise<string>}
 */
async function resolveProjectDir(projectId) {
  if (projectId && projectId !== 'cwd') {
    const p = await getProject(projectId)
    if (p) return p.path
  }
  return process.cwd()
}

/**
 * Lấy project id từ request (query trước, rồi tới body).
 *
 * @param {import('express').Request} req
 * @returns {string|undefined}
 */
function getProjectId(req) {
  return req.query.project || (req.body && req.body.project) || undefined
}

/**
 * Khởi chạy Express server
 *
 * @param {number} port            - Cổng kết nối
 * @param {string} [host]          - Địa chỉ bind (mặc định 127.0.0.1 — chỉ loopback)
 * @returns {Promise<http.Server>}
 */
export function startServer(port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const app = express()
    app.use(express.json())

    // Serve static files của frontend
    app.use(express.static(publicDir))

    // ───────────────────────────────────────────────────────────────
    // QUẢN LÝ DỰ ÁN
    // ───────────────────────────────────────────────────────────────

    // Endpoint: Danh sách dự án đã đăng ký (kèm dự án ở thư mục hiện tại nếu có config)
    app.get('/api/projects', async (req, res) => {
      try {
        const projects = await listProjects()
        const cwd = process.cwd()

        // Nếu cwd có config và chưa nằm trong registry → thêm như một dự án "hiện tại" ảo
        let current = null
        const alreadyListed = projects.some((p) => p.path.toLowerCase() === cwd.toLowerCase())
        if (!alreadyListed) {
          try {
            await loadConfig(cwd)
            current = {
              id: 'cwd',
              name: (cwd.split(/[\\/]+/).filter(Boolean).pop() || cwd) + ' (hiện tại)',
              path: cwd,
              current: true,
            }
          } catch {
            // cwd chưa có config — bỏ qua
          }
        }

        const all = current ? [current, ...projects] : projects
        res.json({ success: true, projects: all, cwd })
      } catch (err) {
        res.status(500).json({ success: false, errors: [err.message] })
      }
    })

    // Endpoint: Thêm dự án mới vào registry
    app.post('/api/projects', async (req, res) => {
      const projectPath = req.body && req.body.path
      if (!projectPath || typeof projectPath !== 'string' || projectPath.trim() === '') {
        return res.status(400).json({ success: false, errors: ['Thiếu đường dẫn dự án (path).'] })
      }

      try {
        const project = await addProject(projectPath)
        res.json({ success: true, project })
      } catch (err) {
        res.status(500).json({ success: false, errors: [err.message] })
      }
    })

    // Endpoint: Xóa dự án khỏi registry (không xóa file thật)
    app.delete('/api/projects/:id', async (req, res) => {
      try {
        const result = await removeProject(req.params.id)
        res.json({ success: true, ...result })
      } catch (err) {
        res.status(500).json({ success: false, errors: [err.message] })
      }
    })

    // ───────────────────────────────────────────────────────────────
    // TRẠNG THÁI & CẤU HÌNH
    // ───────────────────────────────────────────────────────────────

    // Endpoint: Lấy trạng thái hệ thống và cấu hình của dự án được chọn
    app.get('/api/status', async (req, res) => {
      let gitOk = false
      let config = null
      let errors = []

      try {
        await checkGit()
        gitOk = true
      } catch (err) {
        errors.push(err.message)
      }

      try {
        const dir = await resolveProjectDir(getProjectId(req))
        config = await loadConfig(dir)
      } catch (err) {
        // Có thể config chưa được khởi tạo
        errors.push(`Config: ${err.message}`)
      }

      res.json({
        git: gitOk,
        config,
        errors: errors.length > 0 ? errors : null,
      })
    })

    // Endpoint: Cập nhật cấu hình cho dự án được chọn
    app.post('/api/config', async (req, res) => {
      const newConfig = req.body

      const { valid, errors } = validate(newConfig)
      if (!valid) {
        return res.status(400).json({ success: false, errors })
      }

      try {
        const sourcePath = newConfig.sourcePath || process.cwd()
        const targets = newConfig.targets || []
        const prefix = newConfig.remotePrefix || 'hdd'

        // Thư mục lưu config = sourcePath (đồng nhất với CLI: config nằm trong source repo)
        const configDir = sourcePath

        // 1. Khởi tạo thư mục và bare git repo cho targets
        const { ensureDir } = await import('../utils/pathUtils.js')
        const { initBare, addOrUpdateRemote, generateRemoteNames } = await import('./GitService.js')

        for (const target of targets) {
          await ensureDir(target)
          await initBare(target)
        }

        // 2. Thêm hoặc cập nhật các git remote
        const remoteNames = generateRemoteNames(targets, prefix)
        for (let i = 0; i < targets.length; i++) {
          await addOrUpdateRemote(sourcePath, remoteNames[i], targets[i])
        }

        // 3. Lưu cấu hình
        await saveConfig(configDir, newConfig)

        // 4. Tự động đăng ký dự án vào registry (không chặn nếu registry lỗi)
        let project = null
        try {
          project = await addProject(sourcePath)
        } catch (regErr) {
          // bỏ qua lỗi registry — việc lưu config vẫn coi là thành công
        }

        res.json({ success: true, config: newConfig, project })
      } catch (err) {
        res.status(500).json({ success: false, errors: [err.message] })
      }
    })

    // Endpoint: Lấy danh sách ổ đĩa logic trên hệ thống
    app.get('/api/drives', async (req, res) => {
      try {
        const drives = await detectDrives()
        res.json({ success: true, drives })
      } catch (err) {
        res.status(500).json({ success: false, errors: [err.message] })
      }
    })

    // ───────────────────────────────────────────────────────────────
    // LỊCH CHẠY TỰ ĐỘNG (theo từng dự án)
    // ───────────────────────────────────────────────────────────────

    // Endpoint: Lấy trạng thái Task Scheduler của dự án được chọn
    app.get('/api/schedule', async (req, res) => {
      try {
        const dir = await resolveProjectDir(getProjectId(req))
        const projectName = await getProjectIdentifier(dir)
        const status = await queryTask(projectName)
        res.json({ success: true, ...status })
      } catch (err) {
        res.status(500).json({ success: false, errors: [err.message] })
      }
    })

    // Endpoint: Lên lịch daily backup bằng Task Scheduler
    app.post('/api/schedule', async (req, res) => {
      const { time } = req.body
      if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        return res.status(400).json({ success: false, errors: ['Định dạng thời gian không hợp lệ. Yêu cầu định dạng HH:mm (00:00 - 23:59).'] })
      }

      try {
        const dir = await resolveProjectDir(getProjectId(req))
        const projectName = await getProjectIdentifier(dir)
        const config = await loadConfig(dir)
        const sourcePath = config.sourcePath || dir

        await createTask(projectName, time, sourcePath)
        res.json({ success: true })
      } catch (err) {
        res.status(500).json({ success: false, errors: [err.message] })
      }
    })

    // Endpoint: Xóa lịch chạy tự động Task Scheduler
    app.delete('/api/schedule', async (req, res) => {
      try {
        const dir = await resolveProjectDir(getProjectId(req))
        const projectName = await getProjectIdentifier(dir)
        await deleteTask(projectName)
        res.json({ success: true })
      } catch (err) {
        res.status(500).json({ success: false, errors: [err.message] })
      }
    })

    // Endpoint: Xem lịch sử backup của dự án được chọn
    app.get('/api/logs', async (req, res) => {
      const lines = parseInt(req.query.lines || '50', 10)

      try {
        const dir = await resolveProjectDir(getProjectId(req))
        const logPath = path.join(dir, 'git2hdd.log')
        const entries = await readLog(logPath, lines)
        res.json({ success: true, logs: entries })
      } catch (err) {
        res.json({ success: true, logs: [] })
      }
    })

    // ───────────────────────────────────────────────────────────────
    // THỰC THI CLI (SSE stream)
    // ───────────────────────────────────────────────────────────────

    // Endpoint: SSE Stream để chạy lệnh và stream stdout/stderr trực tiếp
    app.get('/api/run', async (req, res) => {
      const { action, message, dryRun } = req.query

      if (action !== 'backup') {
        res.status(400).send('Action không hợp lệ. Phải là backup.')
        return
      }

      const projectDir = await resolveProjectDir(getProjectId(req))

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      // Xây dựng CLI arguments dưới dạng MẢNG (không qua shell → an toàn injection)
      const args = [binPath, 'backup']
      if (message) {
        args.push('--message', String(message))
      }
      if (dryRun === 'true') {
        args.push('--dry-run')
      }
      // Chạy backup trên đúng thư mục dự án được chọn
      args.push('--cwd', projectDir)

      // Khởi chạy CLI command — spawn với shell: false (mặc định)
      const proc = spawn(process.execPath, args, {
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: '0' }, // Tắt chalk colors
        shell: false,
      })

      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach((line) => {
          sendEvent({ type: 'stdout', text: line.replace(/\r/g, '') })
        })
      })

      proc.stderr.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach((line) => {
          sendEvent({ type: 'stderr', text: line.replace(/\r/g, '') })
        })
      })

      proc.on('error', (err) => {
        sendEvent({ type: 'stderr', text: `Không thể khởi chạy CLI: ${err.message}` })
        sendEvent({ type: 'close', code: 1 })
        res.end()
      })

      proc.on('close', (code) => {
        sendEvent({ type: 'close', code: code ?? 0 })
        res.end()
      })

      req.on('close', () => {
        if (!proc.killed) {
          proc.kill()
        }
      })
    })

    const server = app.listen(port, host, () => {
      serverInstance = server
      resolve(server)
    })

    server.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Dừng Express server (phục vụ viết tests)
 *
 * @returns {Promise<void>}
 */
export function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        serverInstance = null
        resolve()
      })
    } else {
      resolve()
    }
  })
}
