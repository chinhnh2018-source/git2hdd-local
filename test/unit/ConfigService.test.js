import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
import { ConfigNotFoundError, ConfigParseError } from '../../src/utils/errorHandler.js'

let tmpDir

beforeEach(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git2hdd-test-'))
})

afterEach(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true })
})

describe('createDefault', () => {
  it('should create config with correct defaults', () => {
    const config = createDefault('D:\\work\\project')
    expect(config.sourcePath).toBe('D:\\work\\project')
    expect(config.targets).toEqual([])
    expect(config.defaultBranch).toBe('main')
    expect(config.remotePrefix).toBe('hdd')
  })
})

describe('validate', () => {
  it('should return valid for correct config', () => {
    const config = createDefault('D:\\work\\project')
    const { valid, errors } = validate(config)
    expect(valid).toBe(true)
    expect(errors).toHaveLength(0)
  })

  it('should return invalid when sourcePath is missing', () => {
    const { valid, errors } = validate({ targets: [] })
    expect(valid).toBe(false)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('should return invalid when targets has more than 10 items', () => {
    const config = createDefault('D:\\work')
    config.targets = Array(11).fill('E:\\backup\\x.git')
    const { valid, errors } = validate(config)
    expect(valid).toBe(false)
    expect(errors.some((e) => e.includes('10'))).toBe(true)
  })

  it('should return invalid for non-object input', () => {
    const { valid } = validate('not an object')
    expect(valid).toBe(false)
  })

  it('should return invalid for invalid remotePrefix', () => {
    const config = createDefault('D:\\work')
    config.remotePrefix = 'hdd-backup!'
    const { valid } = validate(config)
    expect(valid).toBe(false)
  })
})

describe('loadConfig', () => {
  it('should throw ConfigNotFoundError when file does not exist', async () => {
    await expect(loadConfig(tmpDir)).rejects.toThrow(ConfigNotFoundError)
  })

  it('should throw ConfigParseError when JSON is invalid', async () => {
    await fs.promises.writeFile(
      path.join(tmpDir, 'git2hdd.config.json'),
      'not valid json',
      'utf8'
    )
    await expect(loadConfig(tmpDir)).rejects.toThrow(ConfigParseError)
  })

  it('should return parsed config when file is valid', async () => {
    const config = createDefault('D:\\work\\project')
    await saveConfig(tmpDir, config)
    const loaded = await loadConfig(tmpDir)
    expect(loaded.sourcePath).toBe('D:\\work\\project')
  })
})

describe('saveConfig + loadConfig round-trip', () => {
  it('should preserve all fields', async () => {
    const config = {
      sourcePath: 'D:\\work\\project',
      targets: ['E:\\backup\\project.git', 'F:\\backup\\project.git'],
      defaultBranch: 'main',
      remotePrefix: 'hdd',
    }
    await saveConfig(tmpDir, config)
    const loaded = await loadConfig(tmpDir)
    expect(loaded).toEqual(config)
  })
})

describe('setField', () => {
  it('should update a top-level field', async () => {
    const config = createDefault('D:\\work\\project')
    await saveConfig(tmpDir, config)
    await setField(tmpDir, 'defaultBranch', 'master')
    const loaded = await loadConfig(tmpDir)
    expect(loaded.defaultBranch).toBe('master')
  })

  it('should update targets array', async () => {
    const config = createDefault('D:\\work\\project')
    await saveConfig(tmpDir, config)
    await setField(tmpDir, 'targets', ['E:\\backup\\project.git'])
    const loaded = await loadConfig(tmpDir)
    expect(loaded.targets).toEqual(['E:\\backup\\project.git'])
  })
})
