import { describe, it, expect } from 'vitest'
import {
  formatTimestamp,
  formatPushSummary,
  formatRemoteList,
  formatLogEntries,
} from '../../src/utils/formatter.js'

describe('formatTimestamp', () => {
  it('should return YYYY-MM-DD HH:mm:ss format', () => {
    const date = new Date(2025, 0, 5, 9, 3, 7) // 2025-01-05 09:03:07
    const result = formatTimestamp(date)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(result).toBe('2025-01-05 09:03:07')
  })

  it('should zero-pad single digit values', () => {
    const date = new Date(2025, 5, 3, 8, 4, 2) // 2025-06-03 08:04:02
    expect(formatTimestamp(date)).toBe('2025-06-03 08:04:02')
  })
})

describe('formatPushSummary', () => {
  it('should include remote names and statuses', () => {
    const results = [
      { remote: 'hdd1', success: true },
      { remote: 'hdd2', success: false, error: 'connection refused' },
    ]
    const output = formatPushSummary(results)
    expect(output).toContain('hdd1')
    expect(output).toContain('hdd2')
    expect(output).toContain('1 succeeded')
    expect(output).toContain('1 failed')
  })

  it('should show 0 failed when all succeed', () => {
    const results = [
      { remote: 'hdd1', success: true },
      { remote: 'hdd2', success: true },
    ]
    const output = formatPushSummary(results)
    expect(output).toContain('2 succeeded')
    expect(output).toContain('0 failed')
  })
})

describe('formatRemoteList', () => {
  it('should include name and url', () => {
    const remotes = [
      { name: 'hdd1', url: 'E:\\backup\\project.git' },
      { name: 'hdd2', url: 'F:\\backup\\project.git' },
    ]
    const output = formatRemoteList(remotes)
    expect(output).toContain('hdd1')
    expect(output).toContain('E:\\backup\\project.git')
    expect(output).toContain('hdd2')
  })

  it('should show message for empty list', () => {
    expect(formatRemoteList([])).toContain('no remotes')
  })
})

describe('formatLogEntries', () => {
  it('should include timestamp and command', () => {
    const entries = [
      {
        timestamp: '2025-01-05T09:00:00.000Z',
        command: 'backup',
        targets: ['hdd1'],
        results: { hdd1: 'success' },
        message: 'daily backup',
      },
    ]
    const output = formatLogEntries(entries)
    expect(output).toContain('backup')
    expect(output).toContain('hdd1')
  })

  it('should show message for empty entries', () => {
    expect(formatLogEntries([])).toContain('no log entries')
  })
})
