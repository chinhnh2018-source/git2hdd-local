/**
 * Property-based tests cho pathUtils
 * Property 20 từ design.md
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { normalizePath } from '../../src/utils/pathUtils.js'

// Arbitrary cho đường dẫn Windows hợp lệ (không có ký tự đặc biệt)
const arbitraryWindowsPath = () =>
  fc.array(
    fc.stringMatching(/^[a-zA-Z0-9 _-]+$/),
    { minLength: 1, maxLength: 4 }
  ).map((parts) => parts.join('\\'))
    .map((p) => 'D:\\' + p)

describe('Property 20: Path Normalization Consistency', () => {
  it('path with / and \\ should normalize to same result', () => {
    fc.assert(
      fc.property(arbitraryWindowsPath(), (winPath) => {
        // Tạo phiên bản với forward slashes
        const withForward  = winPath.replace(/\\/g, '/')
        const withBackward = winPath

        const normalizedForward  = normalizePath(withForward)
        const normalizedBackward = normalizePath(withBackward)

        expect(normalizedForward).toBe(normalizedBackward)
      }),
      { numRuns: 100 }
    )
  })

  it('normalizePath should be idempotent', () => {
    fc.assert(
      fc.property(arbitraryWindowsPath(), (winPath) => {
        const once  = normalizePath(winPath)
        const twice = normalizePath(once)
        expect(once).toBe(twice)
      }),
      { numRuns: 100 }
    )
  })
})
