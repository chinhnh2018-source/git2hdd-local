/**
 * formatter.js — Output formatting utilities for git2hdd CLI
 *
 * Provides human-readable formatting for terminal output:
 * timestamps, push summaries, remote lists, and log entries.
 */

import Table from 'cli-table3'
import chalk from 'chalk'

/**
 * Format a Date object as a local-time string: YYYY-MM-DD HH:mm:ss
 * All components are zero-padded to fixed width.
 *
 * @param {Date} date
 * @returns {string}  e.g. "2025-07-14 09:05:03"
 */
export function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0')

  const year   = date.getFullYear()
  const month  = pad(date.getMonth() + 1)
  const day    = pad(date.getDate())
  const hour   = pad(date.getHours())
  const minute = pad(date.getMinutes())
  const second = pad(date.getSeconds())

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * Format push results as an ASCII table.
 * Columns: Remote | Status | Error
 *
 * @param {Array<{ remote: string, success: boolean, error?: string }>} results
 * @returns {string}
 */
export function formatPushSummary(results) {
  const table = new Table({
    head: [
      chalk.bold('Remote'),
      chalk.bold('Status'),
      chalk.bold('Error'),
    ],
    style: { head: [], border: [] },
  })

  for (const r of results) {
    const status = r.success
      ? chalk.green('✔ success')
      : chalk.red('✘ failed')
    const error = r.error ? chalk.red(r.error) : ''
    table.push([r.remote, status, error])
  }

  const successCount = results.filter((r) => r.success).length
  const failCount    = results.length - successCount

  const summary =
    chalk.green(`${successCount} succeeded`) +
    '  ' +
    (failCount > 0 ? chalk.red(`${failCount} failed`) : chalk.gray('0 failed'))

  return table.toString() + '\n' + summary
}


/**
 * Format a list of Git remotes for terminal display.
 * Each line: "  <name>  →  <url>"
 *
 * @param {Array<{ name: string, url: string }>} remotes
 * @returns {string}
 */
export function formatRemoteList(remotes) {
  if (remotes.length === 0) {
    return chalk.yellow('(no remotes configured)')
  }

  const lines = remotes.map(
    (r) => `  ${chalk.cyan(r.name)}  →  ${chalk.white(r.url)}`
  )

  return lines.join('\n')
}

/**
 * Format an array of LogEntry objects for terminal display.
 * Each entry shows: timestamp  command  [target: result, ...]
 *
 * @param {Array<import('../core/LogService.js').LogEntry>} entries
 * @returns {string}
 */
export function formatLogEntries(entries) {
  if (entries.length === 0) {
    return chalk.yellow('(no log entries)')
  }

  const lines = entries.map((entry) => {
    const ts      = chalk.gray(entry.timestamp)
    const cmd     = chalk.bold.blue(entry.command)
    const results = Object.entries(entry.results || {})
      .map(([target, status]) => {
        const colored =
          status === 'success'
            ? chalk.green(status)
            : chalk.red(status)
        return `${target}: ${colored}`
      })
      .join(', ')

    const msg = entry.message ? chalk.italic(` "${entry.message}"`) : ''

    return `${ts}  ${cmd}${msg}  ${results}`
  })

  return lines.join('\n')
}
