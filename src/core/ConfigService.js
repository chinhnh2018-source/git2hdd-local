/**
 * ConfigService.js — Quản lý file cấu hình git2hdd.config.json
 *
 * Cung cấp các thao tác đọc, ghi, cập nhật và validate cấu hình dự án.
 * Config file được lưu tại thư mục gốc của Source_Repo.
 */

import fs from 'fs'
import path from 'path'
import { ConfigNotFoundError, ConfigParseError } from '../utils/errorHandler.js'

const CONFIG_FILENAME = 'git2hdd.config.json'

/**
 * @typedef {Object} Config
 * @property {string}   sourcePath    - Đường dẫn tuyệt đối đến Source_Repo (bắt buộc)
 * @property {string[]} targets       - Mảng đường dẫn đến Backup_Repo bare (0-10 phần tử)
 * @property {string}   defaultBranch - Tên branch mặc định, default: "main"
 * @property {string}   remotePrefix  - Tiền tố tên remote, default: "hdd"
 */

/**
 * Tạo config mặc định với sourcePath được chỉ định.
 *
 * @param {string} sourcePath - Đường dẫn tuyệt đối đến Source_Repo
 * @returns {Config}
 */
export function createDefault(sourcePath) {
  return {
    sourcePath,
    targets: [],
    defaultBranch: 'main',
    remotePrefix: 'hdd',
  }
}

/**
 * Validate schema của config object.
 * Trả về { valid: true, errors: [] } nếu hợp lệ,
 * hoặc { valid: false, errors: [...] } nếu có lỗi.
 *
 * @param {unknown} raw - Object cần validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(raw) {
  const errors = []

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Config phải là một object JSON hợp lệ.'] }
  }

  // sourcePath: bắt buộc, string, không rỗng
  if (typeof raw.sourcePath !== 'string' || raw.sourcePath.trim() === '') {
    errors.push('sourcePath là bắt buộc và phải là chuỗi không rỗng.')
  }

  // targets: tùy chọn, phải là array 0-10 phần tử string
  if (raw.targets !== undefined) {
    if (!Array.isArray(raw.targets)) {
      errors.push('targets phải là một mảng.')
    } else if (raw.targets.length > 10) {
      errors.push('targets không được vượt quá 10 phần tử.')
    } else if (raw.targets.some((t) => typeof t !== 'string')) {
      errors.push('Tất cả phần tử trong targets phải là chuỗi.')
    }
  }

  // defaultBranch: tùy chọn, phải là string nếu có
  if (raw.defaultBranch !== undefined && typeof raw.defaultBranch !== 'string') {
    errors.push('defaultBranch phải là chuỗi.')
  }

  // remotePrefix: tùy chọn, phải là string alphanumeric nếu có
  if (raw.remotePrefix !== undefined) {
    if (typeof raw.remotePrefix !== 'string') {
      errors.push('remotePrefix phải là chuỗi.')
    } else if (!/^[a-zA-Z0-9]+$/.test(raw.remotePrefix)) {
      errors.push('remotePrefix chỉ được chứa ký tự alphanumeric.')
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Tải config từ thư mục chứa config file.
 *
 * @param {string} dir - Thư mục chứa git2hdd.config.json
 * @returns {Promise<Config>}
 * @throws {ConfigNotFoundError} Nếu file không tồn tại
 * @throws {ConfigParseError}    Nếu JSON không hợp lệ
 */
export async function loadConfig(dir) {
  const configPath = path.join(dir, CONFIG_FILENAME)

  let raw
  try {
    raw = await fs.promises.readFile(configPath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new ConfigNotFoundError(
        `File ${CONFIG_FILENAME} không tồn tại tại "${dir}". Hãy chạy \`git2hdd init\` để tạo mới.`
      )
    }
    throw err
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ConfigParseError(
      `File ${CONFIG_FILENAME} tại "${dir}" không đúng định dạng JSON. Hãy chạy \`git2hdd config --reset\` để khởi tạo lại.`
    )
  }

  return parsed
}

/**
 * Ghi config xuống đĩa (atomic write: ghi temp → rename).
 * Đảm bảo không corrupt file nếu quá trình ghi bị gián đoạn.
 *
 * @param {string} dir    - Thư mục đích
 * @param {Config} config - Config object cần ghi
 * @returns {Promise<void>}
 */
export async function saveConfig(dir, config) {
  const configPath = path.join(dir, CONFIG_FILENAME)
  const tempPath   = configPath + '.tmp'

  const content = JSON.stringify(config, null, 2)

  await fs.promises.writeFile(tempPath, content, 'utf8')
  await fs.promises.rename(tempPath, configPath)
}

/**
 * Cập nhật một trường trong config (hỗ trợ dot-notation cho nested keys).
 * Ví dụ: setField(dir, 'defaultBranch', 'main')
 *         setField(dir, 'targets', ['E:\\backup\\project.git'])
 *
 * @param {string} dir   - Thư mục chứa config
 * @param {string} key   - Tên trường (dot-notation)
 * @param {*}      value - Giá trị mới
 * @returns {Promise<void>}
 */
export async function setField(dir, key, value) {
  const config = await loadConfig(dir)

  // Hỗ trợ dot-notation: 'a.b.c' → config.a.b.c = value
  const keys = key.split('.')
  let obj = config
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj[keys[i]] === undefined || typeof obj[keys[i]] !== 'object') {
      obj[keys[i]] = {}
    }
    obj = obj[keys[i]]
  }
  obj[keys[keys.length - 1]] = value

  await saveConfig(dir, config)
}
