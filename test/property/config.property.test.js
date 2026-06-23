/**
 * Property-based tests cho ConfigService
 * Properties 15 & 16 từ design.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs'
import path from 'path'
import os from 'os'
import {
  createDefault,
  validate,
  loadConfig,
  saveConfig,
  setField,
} from '../../src/core/ConfigService.js'

let tmpDir

beforeEach(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git2hdd-prop-'))
})

afterEach(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true })
})

// Arbitrary cho Config hợp lệ
const arbitraryConfig = () =>
  fc.record({
    sourcePath:    fc.constantFrom('D:\\work\\project', 'C:\\Users\\dev\\app', 'E:\\code\\test'),
    targets:       fc.array(fc.constantFrom('E:\\backup\\x.git', 'F:\\backup\\x.git'), { maxLength: 5 }),
    defaultBranch: fc.constantFrom('main', 'master', 'develop'),
    remotePrefix:  fc.constantFrom('hdd', 'backup', 'drive'),
  })

describe('Property 15: Config Round-Trip', () => {
  it('saveConfig then loadConfig returns deep-equal object', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryConfig(), async (config) => {
        await saveConfig(tmpDir, config)
        const loaded = await loadConfig(tmpDir)
        expect(loaded).toEqual(config)
      }),
      { numRuns: 100 }
    )
  })

  it('setField then loadConfig returns updated value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('main', 'master', 'develop'),
        async (branch) => {
          const config = createDefault('D:\\work\\project')
          await saveConfig(tmpDir, config)
          await setField(tmpDir, 'defaultBranch', branch)
          const loaded = await loadConfig(tmpDir)
          expect(loaded.defaultBranch).toBe(branch)
        }
      ),
      { numRuns: 50 }
    )
  })
})

describe('Property 16: Config Validation', () => {
  it('valid configs should pass validation', async () => {
    await fc.assert(
      fc.property(arbitraryConfig(), (config) => {
        const { valid, errors } = validate(config)
        expect(valid).toBe(true)
        expect(errors).toHaveLength(0)
      }),
      { numRuns: 100 }
    )
  })

  it('configs missing sourcePath should fail validation', () => {
    fc.assert(
      fc.property(
        fc.record({
          targets:       fc.array(fc.string(), { maxLength: 3 }),
        }),
        (config) => {
          const { valid } = validate(config)
          expect(valid).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('configs with targets > 10 should fail validation', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 11, maxLength: 15 }),
        (targets) => {
          const config = { ...createDefault('D:\\work'), targets }
          const { valid } = validate(config)
          expect(valid).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })
})
