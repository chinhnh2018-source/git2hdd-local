Ví dụ setup thực tế cho Windows:

SSD làm việc:
D:\work\project

HDD backup:
E:\backup\project
F:\backup\project
G:\backup\project

Mục tiêu:

code ở SSD
commit Git
tự backup sang 3 HDD
chỉ cần chạy .bat

Giai đoạn 1 — Setup lần đầu
1. Tạo project Git

Tạo file:

setup_git.bat

Nội dung:

@echo off

cd /d D:\work\project

git init

echo.
echo Git initialized
pause

Chạy:

click đúp setup_git.bat
Giai đoạn 2 — Tạo backup repo trên HDD

Tạo:

setup_backup_repo.bat

Nội dung:

@echo off

mkdir E:\gitbackup\project.git
mkdir F:\gitbackup\project.git
mkdir G:\gitbackup\project.git

cd /d E:\gitbackup\project.git
git init --bare

cd /d F:\gitbackup\project.git
git init --bare

cd /d G:\gitbackup\project.git
git init --bare

echo.
echo Backup repos created
pause

Chạy 1 lần duy nhất.

Giai đoạn 3 — Add remote

Tạo:

add_remote.bat

Nội dung:

@echo off

cd /d D:\work\project

git remote add hdd1 E:/gitbackup/project.git
git remote add hdd2 F:/gitbackup/project.git
git remote add hdd3 G:/gitbackup/project.git

echo.
echo Remotes added
pause

Chạy 1 lần.

Giai đoạn 4 — Commit + push tự động

Đây là file chính bạn dùng hàng ngày.

Tạo:

backup_commit.bat

Nội dung:

@echo off

cd /d D:\work\project

echo.
set /p msg=Commit message:

git add .

git commit -m "%msg%"

git push hdd1 master
git push hdd2 master
git push hdd3 master

echo.
echo DONE BACKUP TO 3 HDD
pause
Cách dùng mỗi ngày

Chỉ cần:

double click:
backup_commit.bat

Nó sẽ:

git add .
git commit
push sang 3 HDD
Nếu branch là main thay vì master

Đổi:

master

thành:

main

ở tất cả dòng push.

Giai đoạn 5 — Backup luôn cả file project (khuyên dùng)

Git chỉ backup source/version.

Nếu muốn mirror full project:

Tạo:

mirror_project.bat

Nội dung:

@echo off

robocopy D:\work\project E:\mirror\project /MIR
robocopy D:\work\project F:\mirror\project /MIR
robocopy D:\work\project G:\mirror\project /MIR

echo.
echo MIRROR COMPLETE
pause