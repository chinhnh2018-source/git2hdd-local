/**
 * errorHandler.js
 * Hệ thống phân loại lỗi và xử lý exit code cho git2hdd.
 *
 * Phân cấp lỗi:
 *   AppError (base)
 *   ├── ConfigNotFoundError    (exit 2)
 *   ├── ConfigParseError       (exit 2)
 *   ├── DependencyError        (exit 3)
 *   ├── PathNotFoundError      (exit 4)
 *   ├── GitOperationError      (exit 5)
 *   └── NodeVersionError       (exit 7)
 */

/**
 * Base class cho tất cả lỗi có thể xử lý của git2hdd.
 * Mang exit code tương ứng để CLI trả về đúng mã thoát.
 */
export class AppError extends Error {
  /**
   * @param {string} message  - Thông báo lỗi hiển thị ra stderr.
   * @param {number} exitCode - Mã thoát của tiến trình (khác 0).
   */
  constructor(message, exitCode = 1) {
    super(message);
    this.name = this.constructor.name;
    this.exitCode = exitCode;
    // Giữ stack trace đúng trong V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * File git2hdd.config.json không tồn tại.
 * Exit code: 2
 */
export class ConfigNotFoundError extends AppError {
  constructor(message = 'File git2hdd.config.json không tồn tại. Hãy chạy `git2hdd init` để tạo mới.') {
    super(message, 2);
  }
}

/**
 * File git2hdd.config.json tồn tại nhưng JSON không hợp lệ.
 * Exit code: 2
 */
export class ConfigParseError extends AppError {
  constructor(message = 'File git2hdd.config.json không đúng định dạng JSON. Hãy chạy `git2hdd config --reset` để khởi tạo lại.') {
    super(message, 2);
  }
}

/**
 * Phụ thuộc hệ thống (git, robocopy) không tìm thấy trong PATH.
 * Exit code: 3
 */
export class DependencyError extends AppError {
  constructor(message = 'Phụ thuộc hệ thống không tìm thấy trong PATH.') {
    super(message, 3);
  }
}

/**
 * Đường dẫn nguồn hoặc đích không tồn tại trên hệ thống file.
 * Exit code: 4
 */
export class PathNotFoundError extends AppError {
  constructor(message = 'Đường dẫn không tồn tại trên hệ thống file.') {
    super(message, 4);
  }
}

/**
 * Lỗi khi thực thi git command.
 * Exit code: 5
 */
export class GitOperationError extends AppError {
  constructor(message = 'Lỗi khi thực thi lệnh git.') {
    super(message, 5);
  }
}

/**
 * Phiên bản Node.js thấp hơn yêu cầu tối thiểu (16.0.0).
 * Exit code: 7
 */
export class NodeVersionError extends AppError {
  constructor(message = 'Phiên bản Node.js không đủ yêu cầu tối thiểu (>= 16.0.0).') {
    super(message, 7);
  }
}

/**
 * Xử lý lỗi tại entry point của CLI.
 *
 * - Nếu `err` là `AppError`, dùng `err.exitCode`.
 * - Ngược lại, dùng exit code 1 (lỗi chung / không xác định).
 * - Luôn ghi thông báo lỗi ra `stderr` trước khi thoát.
 *
 * @param {Error} err - Đối tượng lỗi cần xử lý.
 */
export function handleError(err) {
  const code = err instanceof AppError ? err.exitCode : 1;
  process.stderr.write((err.message || String(err)) + '\n');
  process.exit(code);
}
