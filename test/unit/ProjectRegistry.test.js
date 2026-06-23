import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Cô lập registry vào một HOME tạm — phải set env TRƯỚC khi import module
// (os.homedir() được đọc ở thời điểm import), nên dùng dynamic import.
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'g2h-reg-home-'))
process.env.HOME = tmpHome
process.env.USERPROFILE = tmpHome

let reg

beforeAll(async () => {
  reg = await import('../../src/core/ProjectRegistry.js')
})

beforeEach(async () => {
  // Reset registry file trước mỗi test
  try {
    await fs.promises.rm(reg.getRegistryPath(), { force: true })
  } catch {}
})

describe('ProjectRegistry', () => {
  it('listProjects trả về mảng rỗng khi chưa có registry', async () => {
    const list = await reg.listProjects()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBe(0)
  })

  it('addProject thêm dự án và sinh id ổn định', async () => {
    const p = await reg.addProject('/tmp/my-project')
    expect(p.id).toBeTruthy()
    expect(p.name).toBe('my-project')
    expect(p.path).toBe('/tmp/my-project')

    const list = await reg.listProjects()
    expect(list.length).toBe(1)
  })

  it('addProject là idempotent (cùng path → cùng id, không nhân đôi)', async () => {
    const a = await reg.addProject('/tmp/dup-project')
    const b = await reg.addProject('/tmp/dup-project')
    expect(a.id).toBe(b.id)
    expect((await reg.listProjects()).length).toBe(1)
  })

  it('chuẩn hóa dấu phân cách cuối khi sinh tên/id', async () => {
    const a = await reg.addProject('/tmp/trail/')
    const b = await reg.addProject('/tmp/trail')
    expect(a.id).toBe(b.id)
    expect(a.name).toBe('trail')
  })

  it('getProject trả về đúng dự án theo id, null nếu không có', async () => {
    const p = await reg.addProject('/tmp/find-me')
    expect((await reg.getProject(p.id)).path).toBe('/tmp/find-me')
    expect(await reg.getProject('khong-ton-tai')).toBe(null)
  })

  it('removeProject gỡ dự án khỏi registry', async () => {
    const p = await reg.addProject('/tmp/remove-me')
    expect((await reg.listProjects()).length).toBe(1)

    const res = await reg.removeProject(p.id)
    expect(res.removed).toBe(true)
    expect((await reg.listProjects()).length).toBe(0)
  })

  it('addProject báo lỗi khi path rỗng', async () => {
    await expect(reg.addProject('   ')).rejects.toThrow()
  })

  it('hỗ trợ đường dẫn kiểu Windows khi lấy tên folder', async () => {
    const p = await reg.addProject('D:\\work\\win-project')
    expect(p.name).toBe('win-project')
  })
})
