import { describe, it, expect, vi } from 'vitest'
import {
  AppError,
  ConfigNotFoundError,
  ConfigParseError,
  DependencyError,
  PathNotFoundError,
  GitOperationError,
  NodeVersionError,
  handleError,
} from '../../src/utils/errorHandler.js'

describe('AppError', () => {
  it('should have default exitCode 1', () => {
    const err = new AppError('test')
    expect(err.exitCode).toBe(1)
    expect(err.message).toBe('test')
    expect(err.name).toBe('AppError')
  })

  it('should accept custom exitCode', () => {
    const err = new AppError('test', 5)
    expect(err.exitCode).toBe(5)
  })

  it('should be instanceof Error', () => {
    expect(new AppError('x')).toBeInstanceOf(Error)
  })
})

describe('Error subclasses exit codes', () => {
  const cases = [
    [ConfigNotFoundError, 2],
    [ConfigParseError,    2],
    [DependencyError,     3],
    [PathNotFoundError,   4],
    [GitOperationError,   5],
    [NodeVersionError,    7],
  ]

  for (const [Cls, code] of cases) {
    it(`${Cls.name} should have exitCode ${code}`, () => {
      const err = new Cls()
      expect(err.exitCode).toBe(code)
      expect(err).toBeInstanceOf(AppError)
      expect(err.name).toBe(Cls.name)
    })
  }
})

describe('handleError', () => {
  it('should call process.exit with AppError exitCode', () => {
    const exitSpy   = vi.spyOn(process, 'exit').mockImplementation(() => {})
    const writeSpy  = vi.spyOn(process.stderr, 'write').mockImplementation(() => {})

    handleError(new ConfigNotFoundError('not found'))

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('not found'))
    expect(exitSpy).toHaveBeenCalledWith(2)

    exitSpy.mockRestore()
    writeSpy.mockRestore()
  })

  it('should use exit code 1 for non-AppError', () => {
    const exitSpy  = vi.spyOn(process, 'exit').mockImplementation(() => {})
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {})

    handleError(new Error('generic'))

    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    writeSpy.mockRestore()
  })
})
