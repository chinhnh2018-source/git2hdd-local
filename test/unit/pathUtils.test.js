import { describe, it, expect } from 'vitest'
import { normalizePath } from '../../src/utils/pathUtils.js'

describe('normalizePath', () => {
  it('should convert forward slashes to backslashes', () => {
    expect(normalizePath('D:/work/project')).toBe('D:\\work\\project')
  })

  it('should handle mixed slashes', () => {
    expect(normalizePath('D:/work\\project/src')).toBe('D:\\work\\project\\src')
  })

  it('should handle paths with spaces', () => {
    expect(normalizePath('D:/my projects/my app')).toBe('D:\\my projects\\my app')
  })

  it('should normalize double backslashes', () => {
    expect(normalizePath('D:\\\\work\\\\project')).toBe('D:\\work\\project')
  })

  it('should return non-string input as-is', () => {
    expect(normalizePath(null)).toBe(null)
    expect(normalizePath(undefined)).toBe(undefined)
  })
})
