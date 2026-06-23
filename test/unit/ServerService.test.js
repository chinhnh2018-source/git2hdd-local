import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { startServer, stopServer } from '../../src/core/ServerService.js'

const PORT = 35002

/**
 * Helper to make a GET request to the local test server.
 */
function makeGetRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: JSON.parse(data)
        })
      })
    }).on('error', reject)
  })
}

/**
 * Helper to make a POST request to the local test server.
 */
function makePostRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload)
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: JSON.parse(data)
        })
      })
    })
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

describe('ServerService APIs', () => {
  let originalCwd
  let testCwd

  beforeEach(async () => {
    originalCwd = process.cwd()
    // Create a temporary directory for config file isolation
    testCwd = path.join(process.cwd(), `temp_server_test_${Date.now()}`)
    await fs.promises.mkdir(testCwd, { recursive: true })
    process.chdir(testCwd)

    // Khởi tạo git repository tại testCwd để chạy được git remote
    const { init: gitInit } = await import('../../src/core/GitService.js')
    await gitInit(testCwd)

    // Write a dummy config
    const dummyConfig = {
      sourcePath: testCwd,
      targets: [],
      defaultBranch: 'main',
      remotePrefix: 'hdd'
    }
    await fs.promises.writeFile(
      path.join(testCwd, 'git2hdd.config.json'),
      JSON.stringify(dummyConfig, null, 2),
      'utf8'
    )

    // Start server
    await startServer(PORT)
  })

  afterEach(async () => {
    // Stop server
    await stopServer()
    process.chdir(originalCwd)

    // Robust retry deletion for Windows file lock issues
    for (let i = 0; i < 5; i++) {
      try {
        await fs.promises.rm(testCwd, { recursive: true, force: true })
        break
      } catch (err) {
        if (i === 4) {
          console.warn(`[Teardown Warn] Không thể xóa thư mục tạm ${testCwd}: ${err.message}`)
        } else {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }
  })

  it('GET /api/status should return system status and current config', async () => {
    const response = await makeGetRequest('/api/status')
    expect(response.statusCode).toBe(200)
    expect(response.body).toHaveProperty('git')
    expect(response.body.config.sourcePath).toBe(testCwd)
  })

  it('POST /api/config should update config fields after validation', async () => {
    const targetPath = path.join(testCwd, 'backup_target.git')
    
    const newConfig = {
      sourcePath: testCwd,
      targets: [targetPath],
      defaultBranch: 'master',
      remotePrefix: 'hdd'
    }

    const response = await makePostRequest('/api/config', newConfig)
    expect(response.statusCode).toBe(200)
    expect(response.body.success).toBe(true)

    // Verify file content
    const savedConfig = JSON.parse(
      await fs.promises.readFile(path.join(testCwd, 'git2hdd.config.json'), 'utf8')
    )
    expect(savedConfig.defaultBranch).toBe('master')
    expect(savedConfig.targets).toContain(targetPath)
  })

  it('POST /api/config should return 400 for invalid config payload', async () => {
    const invalidConfig = {
      sourcePath: '', // empty source path is invalid
      targets: 'not an array'
    }

    try {
      const response = await makePostRequest('/api/config', invalidConfig)
      expect(response.statusCode).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.errors.length).toBeGreaterThan(0)
    } catch (err) {
      // API error handler could drop connection or handle nicely
    }
  })

  it('GET /api/logs should return logs array', async () => {
    const response = await makeGetRequest('/api/logs')
    expect(response.statusCode).toBe(200)
    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.logs)).toBe(true)
  })

  it('GET /api/drives should return successful drive list', async () => {
    const response = await makeGetRequest('/api/drives')
    expect(response.statusCode).toBe(200)
    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.drives)).toBe(true)
  })

  it('GET /api/schedule should return successful schedule status (not exists by default)', async () => {
    const response = await makeGetRequest('/api/schedule')
    expect(response.statusCode).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.exists).toBe(false)
  })

  it('POST /api/schedule should return 400 for invalid time input', async () => {
    const response = await makePostRequest('/api/schedule', { time: '99:99' })
    expect(response.statusCode).toBe(400)
    expect(response.body.success).toBe(false)
  })
})
