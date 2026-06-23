import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  serialize,
  deserialize,
  appendLog,
  readLog,
} from '../../src/core/LogService.js'

let tmpDir
let logPath

beforeEach(async () => {
  tmpDir  = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git2hdd-log-test-'))
  logPath = path.join(tmpDir, 'git2hdd.log')
})

afterEach(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true })
})

const sampleEntry = {
  timestamp: '2025-01-05T09:00:00.000Z',
  command: 'backup',
  targets: ['hdd1', 'hdd2'],
  results: { hdd1: 'success', hdd2: 'failed' },
  message: 'daily backup',
}

describe('serialize / deserialize', () => {
  it('should round-trip a LogEntry', () => {
    const line    = serialize(sampleEntry)
    const parsed  = deserialize(line)
    expect(parsed).toEqual(sampleEntry)
  })

  it('should return null for invalid JSON', () => {
    expect(deserialize('not json')).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(deserialize('')).toBeNull()
    expect(deserialize('   ')).toBeNull()
  })
})

describe('appendLog', () => {
  it('should create log file and append entry', async () => {
    await appendLog(logPath, sampleEntry)
    const content = await fs.promises.readFile(logPath, 'utf8')
    expect(content).toContain('backup')
    expect(content).toContain('hdd1')
  })

  it('should not throw when log path is unwritable', async () => {
    const badPath = path.join(tmpDir, 'nonexistent', 'subdir', 'git2hdd.log')
    // Should warn but not throw
    await expect(appendLog(badPath, sampleEntry)).resolves.toBeUndefined()
  })
})

describe('readLog', () => {
  it('should return empty array when log does not exist', async () => {
    const entries = await readLog(logPath, 20)
    expect(entries).toEqual([])
  })

  it('should return entries sorted by timestamp descending', async () => {
    const entry1 = { ...sampleEntry, timestamp: '2025-01-01T00:00:00.000Z' }
    const entry2 = { ...sampleEntry, timestamp: '2025-01-05T00:00:00.000Z' }
    const entry3 = { ...sampleEntry, timestamp: '2025-01-03T00:00:00.000Z' }

    await appendLog(logPath, entry1)
    await appendLog(logPath, entry2)
    await appendLog(logPath, entry3)

    const entries = await readLog(logPath, 10)
    expect(entries[0].timestamp).toBe('2025-01-05T00:00:00.000Z')
    expect(entries[1].timestamp).toBe('2025-01-03T00:00:00.000Z')
    expect(entries[2].timestamp).toBe('2025-01-01T00:00:00.000Z')
  })

  it('should return at most N entries', async () => {
    for (let i = 0; i < 5; i++) {
      await appendLog(logPath, { ...sampleEntry, timestamp: `2025-01-0${i + 1}T00:00:00.000Z` })
    }
    const entries = await readLog(logPath, 3)
    expect(entries.length).toBe(3)
  })
})
