# git2hdd

Tự động hóa Git backup từ SSD sang nhiều HDD trên Windows — thay thế hoàn toàn các file `.bat` rời rạc bằng một CLI tool thống nhất.

## Yêu cầu hệ thống

- **Windows 10+**
- **Node.js >= 16.0.0**
- **Git for Windows** — [tải tại đây](https://git-scm.com/download/win)

## Cài đặt

```bash
npm install -g git2hdd
```

## Hướng dẫn sử dụng

### Setup lần đầu (chạy một lần)

**Bước 1 — Khởi tạo Git repository:**

```bash
git2hdd init --source D:\work\my-project
```

**Bước 2 — Tạo bare repos trên HDD:**

```bash
git2hdd setup-remotes --targets E:\backup\my-project.git F:\backup\my-project.git G:\backup\my-project.git
```

**Bước 3 — Thêm HDD làm Git remote:**

```bash
git2hdd add-remotes
```

### Sử dụng hàng ngày

**Backup (commit + push sang tất cả HDD):**

```bash
git2hdd backup --message "hoàn thành tính năng login"

# Dùng timestamp làm commit message tự động:
git2hdd backup

# Xem trước các thao tác (dry-run):
git2hdd backup --dry-run
```


### Quản lý

**Xem cấu hình:**

```bash
git2hdd config --show
```

**Cập nhật cấu hình:**

```bash
git2hdd config --set defaultBranch --value main
```

**Xem lịch sử backup:**

```bash
git2hdd log
git2hdd log --lines 50
```


## Cấu trúc config (`git2hdd.config.json`)

```json
{
  "sourcePath": "D:\\work\\my-project",
  "targets": [
    "E:\\backup\\my-project.git",
    "F:\\backup\\my-project.git",
    "G:\\backup\\my-project.git"
  ],
  "defaultBranch": "main",
  "remotePrefix": "hdd"
}
```

## Giao diện Web (GUI) & quản lý nhiều dự án

Khởi chạy dashboard web:

```bash
git2hdd gui            # mặc định cổng 3000
git2hdd gui --port 8080
```

**Bảo mật:** server chỉ lắng nghe trên `127.0.0.1` (loopback) — không truy cập được từ máy khác trong mạng LAN.

**Quản lý nhiều dự án:** mở tab **Dự án** để thêm/đăng ký nhiều thư mục dự án và chuyển đổi nhanh giữa chúng bằng bộ chọn ở góc trên bên phải. Mỗi dự án có cấu hình, lịch sử backup và lịch chạy tự động (Task Scheduler) riêng. Danh sách dự án được lưu tập trung tại:

```
%USERPROFILE%\.git2hdd\projects.json   (Windows)
~/.git2hdd/projects.json               (macOS/Linux)
```

Gỡ một dự án khỏi danh sách quản lý **không** xóa dữ liệu thật trên đĩa.

## Exit codes

| Code | Ý nghĩa |
|------|---------|
| 0    | Thành công hoàn toàn |
| 1    | Lỗi chung |
| 2    | Lỗi cấu hình |
| 3    | Phụ thuộc hệ thống không tìm thấy |
| 4    | Đường dẫn không tồn tại |
| 5    | Lỗi git operation |
| 7    | Node.js version không đủ |
| 8    | Partial failure (ít nhất một HDD thất bại) |

## License

MIT
