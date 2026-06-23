/**
 * Property-based tests cho formatter
 * Properties 9, 10, 12, 13 từ design.md
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  formatTimestamp,
  formatPushSummary,
  formatRemoteList,
} from '../../src/utils/formatter.js'

describe('Property 10: Timestamp Format', () => {
  it('formatTimestamp should always match YYYY-MM-DD HH:mm:ss', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') }),
        (date) => {
          const result = formatTimestamp(date)
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 12: Push Summary Count', () => {
  it('success/failure counts in output match input', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ remote: fc.constantFrom('hdd1', 'hdd2', 'hdd3'), success: fc.boolean() }),
          { minLength: 1, maxLength: 5 }
        ),
        (results) => {
          const output       = formatPushSummary(results)
          const successCount = results.filter((r) => r.success).length
          const failCount    = results.length - successCount

          expect(output).toContain(`${successCount} succeeded`)
          expect(output).toContain(`${failCount} failed`)
        }
      ),
      { numRuns: 100 }
    )
  })
})


describe('Property 9: Remote List Completeness', () => {
  it('output contains all remote names and URLs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.constantFrom('hdd1', 'hdd2', 'hdd3'),
            url:  fc.constantFrom('E:\\backup\\x.git', 'F:\\backup\\x.git'),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (remotes) => {
          const output = formatRemoteList(remotes)
          for (const r of remotes) {
            expect(output).toContain(r.name)
            expect(output).toContain(r.url)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
