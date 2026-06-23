/**
 * Property-based tests cho LogService
 * Properties 21, 22, 23 từ design.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
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
  tmpDir  = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git2hdd-log-prop-'))
  logPath = path.join(tmpDir, 'git2hdd.log')
})

afterEach(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true })
})

// Arbitrary cho LogEntry hợp lệ
const arbitraryLogEntry = () =>
  fc.record({
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map((d) => d.toISOString()),
    command:   fc.constantFrom('backup', 'mirror'),
    targets:   fc.array(fc.constantFrom('hdd1', 'hdd2', 'hdd3'), { maxLength: 3 }),
    results:   fc.record({
      hdd1: fc.constantFrom('success', 'failed'),
    }),
    message:   fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
  })

describe('Property 21: Log Serialize/Deserialize Round-Trip', () => {
  it('serialize then deserialize returns deep-equal entry', () => {
    fc.assert(
      fc.property(arbitraryLogEntry(), (entry) => {
        const line   = serialize(entry)
        const parsed = deserialize(line)
        expect(parsed).toEqual(entry)
      }),
      { numRuns: 100 }
    )
  })
})

describe('Property 22: Log Ordering', () => {
  it('readLog returns entries sorted by timestamp descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryLogEntry(), { minLength: 2, maxLength: 10 }),
        async (entries) => {
          // Reset log file
          try { await fs.promises.unlink(logPath) } catch {}

          for (const entry of entries) {
            await appendLog(logPath, entry)
          }

          const read = await readLog(logPath, 100)

          // Kiểm tra thứ tự giảm dần
          for (let i = 0; i < read.length - 1; i++) {
            expect(read[i].timestamp >= read[i + 1].timestamp).toBe(true)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Property 23: Log Count Limit', () => {
  it('readLog returns at most N entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 30 }),
        async (n, total) => {
          // Reset log file
          try { await fs.promises.unlink(logPath) } catch {}

          for (let i = 0; i < total; i++) {
            await appendLog(logPath, {
              timestamp: new Date(2025, 0, i + 1).toISOString(),
              command: 'backup',
              targets: ['hdd1'],
              results: { hdd1: 'success' },
            })
          }

          const entries = await readLog(logPath, n)
          expect(entries.length).toBeLessThanOrEqual(n)
        }
      ),
      { numRuns: 50 }
    )
  })
})
