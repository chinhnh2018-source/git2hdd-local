// State của ứng dụng
let appState = {
  gitOk: false,
  config: null,
  logs: [],
  projects: [],
  currentProjectId: localStorage.getItem('git2hdd-current-project') || 'cwd'
}

// Helper: gắn project param hiện tại vào URL API
function withProject(url) {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}project=${encodeURIComponent(appState.currentProjectId || 'cwd')}`
}

// ─── INITIALIZATION & TABS ───
document.addEventListener('DOMContentLoaded', () => {
  initTabs()
  initSettingsForm()
  initExecution()
  initProjects()
  loadAllData()

  // Load logs limit change listener
  document.getElementById('log-limit').addEventListener('change', () => {
    loadLogs()
  })

  // Clear terminal listener
  document.getElementById('btn-clear-terminal').addEventListener('click', clearTerminal)

  // Initialize Theme Switcher
  initTheme()

  // Initialize Sidebar Position Switcher
  initSidebarPosition()

  // Initialize Scheduler & Drives
  initScheduler()
  initDrives()
})

function initTabs() {
  const navButtons = document.querySelectorAll('.nav-menu .nav-btn')
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab')
      switchTab(tabId)
    })
  })
}

function switchTab(tabId) {
  // Update nav menu active state
  document.querySelectorAll('.nav-menu .nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId)
  })

  // Show active tab pane
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.getAttribute('id') === `tab-${tabId}`)
  })

  // Update headers
  const pageTitle = document.getElementById('page-title')
  const pageSubtitle = document.getElementById('page-subtitle')

  switch (tabId) {
    case 'dashboard':
      pageTitle.textContent = 'Tổng quan hệ thống'
      pageSubtitle.textContent = 'Kiểm tra trạng thái và lịch sử hoạt động.'
      break
    case 'execute':
      pageTitle.textContent = 'Thực thi hành động'
      pageSubtitle.textContent = 'Khởi chạy Backup Git.'
      break
    case 'projects':
      pageTitle.textContent = 'Quản lý dự án'
      pageSubtitle.textContent = 'Thêm, chọn và quản lý nhiều dự án backup.'
      break
    case 'settings':
      pageTitle.textContent = 'Cấu hình dự án'
      pageSubtitle.textContent = 'Chỉnh sửa cấu trúc file git2hdd.config.json.'
      break
    case 'logs':
      pageTitle.textContent = 'Lịch sử hoạt động'
      pageSubtitle.textContent = 'Xem chi tiết nhật ký thực thi backup.'
      break
    case 'theme-settings':
      pageTitle.textContent = 'Cài đặt giao diện'
      pageSubtitle.textContent = 'Tùy chỉnh màu sắc và bố cục hiển thị.'
      break
  }
}

// ─── ALERTS ───
function showAlert(message, type = 'success') {
  const container = document.getElementById('alert-container')
  container.innerHTML = `
    <div class="alert alert-${type}">
      <span>${message}</span>
      <button class="alert-close" onclick="this.parentElement.remove()">×</button>
    </div>
  `
  // Tự động tắt sau 5 giây
  setTimeout(() => {
    const alert = container.querySelector('.alert')
    if (alert) alert.remove()
  }, 5000)
}

// ─── LOAD DATA ───
async function loadAllData() {
  await loadProjects()
  await loadStatus()
  await loadLogs()
  await loadScheduleStatus()
  await loadDrives()
}

async function loadStatus() {
  try {
    const res = await fetch(withProject('/api/status'))
    const data = await res.json()

    appState.gitOk = data.git
    appState.config = data.config

    updateStatusUI()
    updateDashboardUI()
    populateSettingsForm()
  } catch (err) {
    showAlert('Không thể kết nối đến server backend.', 'danger')
  }
}

function updateStatusUI() {
  const gitEl = document.getElementById('status-git')

  if (appState.gitOk) {
    gitEl.className = 'status-item ok'
    gitEl.querySelector('.status-label').textContent = 'Sẵn sàng'
  } else {
    gitEl.className = 'status-item error'
    gitEl.querySelector('.status-label').textContent = 'Chưa cài đặt'
  }
}

function updateDashboardUI() {
  const cfg = appState.config

  // Update Source path
  document.getElementById('dash-source-path').textContent = cfg ? cfg.sourcePath : 'Chưa khởi tạo'

  // Update Git targets list
  const gitList = document.getElementById('dash-git-targets')
  gitList.innerHTML = ''
  if (cfg && cfg.targets && cfg.targets.length > 0) {
    cfg.targets.forEach(t => {
      const li = document.createElement('li')
      li.textContent = t
      gitList.appendChild(li)
    })
  } else {
    gitList.innerHTML = '<li class="empty-placeholder">Chưa có HDD backup nào được cấu hình</li>'
  }

}

async function loadLogs() {
  const limit = document.getElementById('log-limit').value
  try {
    const res = await fetch(withProject(`/api/logs?lines=${limit}`))
    const data = await res.json()
    appState.logs = data.logs || []

    renderLogs()
  } catch (err) {
    console.error('Lỗi khi tải logs:', err)
  }
}

function renderLogs() {
  const recentBody = document.getElementById('dash-recent-logs')
  const logsBody = document.getElementById('logs-table-body')

  // Render recent 5 logs in dashboard
  recentBody.innerHTML = ''
  const recentLogs = appState.logs.slice(0, 5)
  if (recentLogs.length > 0) {
    recentLogs.forEach(entry => {
      const tr = document.createElement('tr')
      const timeStr = new Date(entry.timestamp).toLocaleString('vi-VN')

      const successCount = Object.values(entry.results).filter(r => r === 'success').length
      const totalCount = Object.keys(entry.results).length
      const isSuccess = successCount === totalCount

      tr.innerHTML = `
        <td><strong>${timeStr}</strong></td>
        <td><span class="badge badge-action-${entry.command}">${entry.command}</span></td>
        <td>${entry.message ? `"${entry.message}"` : `Đồng bộ ${totalCount} targets`}</td>
        <td>
          <span class="badge badge-status-${isSuccess ? 'success' : 'failed'}">
            ${isSuccess ? 'Thành công' : `${successCount}/${totalCount} OK`}
          </span>
        </td>
      `
      recentBody.appendChild(tr)
    })
  } else {
    recentBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Không có bản ghi log nào</td></tr>'
  }

  // Render full list in Logs tab
  logsBody.innerHTML = ''
  if (appState.logs.length > 0) {
    appState.logs.forEach(entry => {
      const tr = document.createElement('tr')
      const timeStr = new Date(entry.timestamp).toLocaleString('vi-VN')

      // Targets list
      const targetsList = entry.targets.join(', ')

      // Results display
      let resultsHtml = '<div class="log-results-grid">'
      for (const [t, status] of Object.entries(entry.results)) {
        resultsHtml += `
          <div class="result-badge ${status}">
            <span class="dot"></span>
            ${t}: ${status === 'success' ? 'OK' : 'Lỗi'}
          </div>
        `
      }
      resultsHtml += '</div>'

      tr.innerHTML = `
        <td>${timeStr}</td>
        <td>
          <span class="badge badge-action-${entry.command}">${entry.command}</span>
          ${entry.message ? `<div class="log-message">"${entry.message}"</div>` : ''}
        </td>
        <td class="text-small text-muted">${targetsList}</td>
        <td>${resultsHtml}</td>
      `
      logsBody.appendChild(tr)
    })
  } else {
    logsBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Không có bản ghi log nào</td></tr>'
  }
}

// ─── PROJECT MANAGEMENT ───
function initProjects() {
  const addBtn = document.getElementById('btn-add-project')
  if (addBtn) addBtn.addEventListener('click', addNewProject)

  const select = document.getElementById('project-select')
  if (select) {
    select.addEventListener('change', (e) => selectProject(e.target.value))
  }
}

async function loadProjects() {
  try {
    const res = await fetch('/api/projects')
    const data = await res.json()
    appState.projects = (data.success && data.projects) ? data.projects : []

    // Nếu project đang chọn không còn trong danh sách → fallback về phần tử đầu
    const ids = appState.projects.map(p => p.id)
    if (appState.projects.length > 0 && !ids.includes(appState.currentProjectId)) {
      appState.currentProjectId = appState.projects[0].id
      localStorage.setItem('git2hdd-current-project', appState.currentProjectId)
    }

    renderProjectSelector()
    renderProjectList()
  } catch (err) {
    console.error('Lỗi khi tải danh sách dự án:', err)
  }
}

function renderProjectSelector() {
  const select = document.getElementById('project-select')
  if (!select) return

  if (appState.projects.length === 0) {
    select.innerHTML = '<option value="cwd">Thư mục hiện tại</option>'
    select.value = 'cwd'
    return
  }

  select.innerHTML = ''
  appState.projects.forEach(p => {
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = p.name
    select.appendChild(opt)
  })
  select.value = appState.currentProjectId
}

function renderProjectList() {
  const list = document.getElementById('project-list')
  if (!list) return

  if (appState.projects.length === 0) {
    list.innerHTML = '<li class="empty-placeholder">Chưa có dự án nào. Hãy thêm dự án mới ở trên.</li>'
    return
  }

  list.innerHTML = ''
  appState.projects.forEach(p => {
    const li = document.createElement('li')
    li.className = 'project-item' + (p.id === appState.currentProjectId ? ' active' : '')

    const isCurrent = p.id === appState.currentProjectId
    const removeBtn = p.current
      ? ''
      : `<button type="button" class="btn btn-danger btn-small" data-remove="${p.id}">🗑️ Gỡ</button>`

    li.innerHTML = `
      <div class="project-item-info">
        <strong>${p.name}</strong>
        <div class="text-small text-muted">${p.path}</div>
      </div>
      <div class="project-item-actions">
        <button type="button" class="btn btn-secondary btn-small" data-select="${p.id}">${isCurrent ? '✔ Đang chọn' : 'Chọn'}</button>
        ${removeBtn}
      </div>
    `
    list.appendChild(li)
  })

  list.querySelectorAll('[data-select]').forEach(btn => {
    btn.addEventListener('click', () => selectProject(btn.getAttribute('data-select')))
  })
  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeProjectById(btn.getAttribute('data-remove')))
  })
}

function selectProject(id) {
  if (!id || id === appState.currentProjectId) {
    if (id) {
      const select = document.getElementById('project-select')
      if (select) select.value = id
    }
    return
  }
  appState.currentProjectId = id
  localStorage.setItem('git2hdd-current-project', id)

  const select = document.getElementById('project-select')
  if (select) select.value = id

  showAlert('Đã chuyển sang dự án đang chọn.')
  loadAllData()
}

async function addNewProject() {
  const input = document.getElementById('new-project-path')
  const projectPath = input.value.trim()
  if (!projectPath) {
    showAlert('Vui lòng nhập đường dẫn dự án.', 'danger')
    return
  }

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectPath })
    })
    const data = await res.json()
    if (data.success) {
      input.value = ''
      if (data.project && data.project.id) {
        appState.currentProjectId = data.project.id
        localStorage.setItem('git2hdd-current-project', data.project.id)
      }
      await loadAllData()
      // Tiếp tục luồng: đưa người dùng sang tab Cấu hình để thêm HDD backup rồi Lưu
      switchTab('settings')
      if (data.warning) {
        showAlert(data.warning, 'danger')
      } else {
        showAlert(`Đã thêm dự án "${data.project.name}". Hãy thêm các HDD backup bên dưới rồi bấm "Lưu cấu hình".`)
      }
    } else {
      showAlert(`Thêm dự án thất bại: ${(data.errors || []).join(', ')}`, 'danger')
    }
  } catch (err) {
    showAlert('Lỗi khi kết nối để thêm dự án.', 'danger')
  }
}

async function removeProjectById(id) {
  if (!confirm('Gỡ dự án này khỏi danh sách quản lý? (Không xóa dữ liệu thật trên đĩa)')) return

  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      if (appState.currentProjectId === id) {
        appState.currentProjectId = 'cwd'
        localStorage.setItem('git2hdd-current-project', 'cwd')
      }
      showAlert('Đã gỡ dự án khỏi danh sách quản lý.')
      await loadAllData()
    } else {
      showAlert(`Gỡ dự án thất bại: ${(data.errors || []).join(', ')}`, 'danger')
    }
  } catch (err) {
    showAlert('Lỗi khi kết nối để gỡ dự án.', 'danger')
  }
}

// ─── SETTINGS FORM ───
function initSettingsForm() {
  document.getElementById('btn-add-target').addEventListener('click', () => addTargetInput('', 'targets-input-list'))
  document.getElementById('btn-reset-settings').addEventListener('click', populateSettingsForm)

  document.getElementById('settings-form').addEventListener('submit', saveSettings)
}

function populateSettingsForm() {
  const cfg = appState.config
  if (!cfg) {
    // Dự án mới chưa có config — vẫn điền sẵn đường dẫn nguồn từ dự án đang chọn
    const proj = appState.projects.find(p => p.id === appState.currentProjectId)
    document.getElementById('setting-source-path').value = proj ? proj.path : ''
    document.getElementById('setting-default-branch').value = 'main'
    document.getElementById('setting-remote-prefix').value = 'hdd'
    const targetsContainer = document.getElementById('targets-input-list')
    targetsContainer.innerHTML = ''
    addTargetInput('', 'targets-input-list')
    return
  }

  document.getElementById('setting-source-path').value = cfg.sourcePath || ''
  document.getElementById('setting-default-branch').value = cfg.defaultBranch || 'main'
  document.getElementById('setting-remote-prefix').value = cfg.remotePrefix || 'hdd'

  // Clear and populate targets list
  const targetsContainer = document.getElementById('targets-input-list')
  targetsContainer.innerHTML = ''
  if (cfg.targets && cfg.targets.length > 0) {
    cfg.targets.forEach(t => addTargetInput(t, 'targets-input-list'))
  } else {
    addTargetInput('', 'targets-input-list')
  }

}

function addTargetInput(value = '', containerId) {
  const container = document.getElementById(containerId)

  if (container.children.length >= 10) {
    showAlert('Tối đa là 10 đường dẫn đích.', 'danger')
    return
  }

  const div = document.createElement('div')
  div.className = 'dynamic-item'
  div.innerHTML = `
    <input type="text" value="${value}" placeholder="Đường dẫn ổ HDD dự phòng..." required>
    <button type="button" class="btn btn-danger btn-small" onclick="this.parentElement.remove()">🗑️</button>
  `
  container.appendChild(div)
}

async function saveSettings(e) {
  e.preventDefault()

  const sourcePath = document.getElementById('setting-source-path').value.trim()
  const defaultBranch = document.getElementById('setting-default-branch').value.trim() || 'main'
  const remotePrefix = document.getElementById('setting-remote-prefix').value.trim() || 'hdd'

  // Gather targets
  const targetInputs = document.querySelectorAll('#targets-input-list input')
  const targets = Array.from(targetInputs).map(i => i.value.trim()).filter(val => val !== '')

  const payload = {
    sourcePath,
    targets,
    defaultBranch,
    remotePrefix
  }

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await res.json()
    if (data.success) {
      showAlert('Lưu cấu hình thành công!')
      // Dự án có thể vừa được tự động đăng ký → chuyển sang dự án đó
      if (data.project && data.project.id) {
        appState.currentProjectId = data.project.id
        localStorage.setItem('git2hdd-current-project', data.project.id)
      }
      loadAllData()
    } else {
      showAlert(`Lưu thất bại: ${data.errors.join(', ')}`, 'danger')
    }
  } catch (err) {
    showAlert('Lỗi khi kết nối gửi cấu hình.', 'danger')
  }
}


// ─── EXECUTION HANDLERS (SSE STREAM) ───
let sseConnection = null

function initExecution() {
  // Start backup listener
  document.getElementById('btn-run-backup').addEventListener('click', startBackup)
}

function startBackup() {
  const message = document.getElementById('backup-message').value.trim()
  const dryRun = document.getElementById('backup-dryrun').checked

  const queryParams = new URLSearchParams({
    action: 'backup',
    dryRun: dryRun.toString()
  })
  queryParams.set('project', appState.currentProjectId || 'cwd')
  if (message) queryParams.set('message', message)

  runSSEStream(queryParams)
}


function runSSEStream(queryParams) {
  // Đóng kết nối cũ nếu có
  if (sseConnection) {
    sseConnection.close()
  }

  clearTerminal()
  lockButtons()

  const terminal = document.getElementById('terminal-body')
  terminal.innerHTML = '' // Xóa placeholder

  appendTerminalLine('[Hệ thống] Đang kết nối luồng xử lý và khởi chạy lệnh...', 'system')

  const url = `/api/run?${queryParams.toString()}`
  sseConnection = new EventSource(url)

  sseConnection.onmessage = (event) => {
    const data = JSON.parse(event.data)

    if (data.type === 'stdout') {
      appendTerminalLine(data.text, 'stdout')
    } else if (data.type === 'stderr') {
      appendTerminalLine(data.text, 'stderr')
    } else if (data.type === 'close') {
      const code = data.code
      if (code === 0) {
        appendTerminalLine(`\n[Hệ thống] Thực thi thành công hoàn toàn (Exit code ${code}).`, 'system')
      } else if (code === 8) {
        appendTerminalLine(`\n[Hệ thống] Hoàn thành với lỗi cục bộ (Exit code ${code}). Vui lòng kiểm tra các ổ HDD bị ngắt kết nối.`, 'system')
      } else {
        appendTerminalLine(`\n[Hệ thống] Lỗi thực thi. CLI thoát với mã lỗi: ${code}`, 'stderr')
      }

      sseConnection.close()
      sseConnection = null
      unlockButtons()
      loadAllData() // Reload logs và dashboard
    }
  }

  sseConnection.onerror = (err) => {
    appendTerminalLine('\n[Hệ thống] Sự cố kết nối luồng EventStream. CLI có thể đã dừng đột ngột hoặc mất kết nối.', 'stderr')
    sseConnection.close()
    sseConnection = null
    unlockButtons()
    loadAllData()
  }
}

function appendTerminalLine(text, type = 'stdout') {
  const terminal = document.getElementById('terminal-body')

  const div = document.createElement('div')

  // Phân loại class màu sắc log
  let itemClass = `terminal-line ${type}`
  if (type === 'stdout') {
    const trimText = text.trim()
    if (trimText.startsWith('✔') || trimText.startsWith('✓') || trimText.includes('success') || trimText.includes('Thành công') || trimText.includes('succeeded') || trimText.includes('OK')) {
      itemClass += ' success'
    } else if (trimText.startsWith('×') || trimText.startsWith('✘') || trimText.includes('failed') || trimText.includes('thất bại') || trimText.includes('Lỗi') || trimText.includes('ERR')) {
      itemClass += ' error'
    } else if (trimText.startsWith('⏳') || trimText.startsWith('- ') || trimText.includes('Đang') || trimText.includes('Running') || trimText.includes('waiting')) {
      itemClass += ' pending'
    } else if (trimText.includes('[DRY RUN]')) {
      itemClass += ' dryrun'
    } else if (trimText.includes('git ')) {
      itemClass += ' command'
    }
  }

  div.className = itemClass
  div.textContent = text

  terminal.appendChild(div)
  terminal.scrollTop = terminal.scrollHeight
}

function clearTerminal() {
  const terminal = document.getElementById('terminal-body')
  terminal.innerHTML = '<div class="terminal-placeholder">Màn hình trống. Khởi chạy tác vụ để xem log...</div>'
}

function lockButtons() {
  document.getElementById('btn-run-backup').disabled = true
  document.getElementById('btn-run-backup').textContent = '⏳ Đang xử lý...'
}

function unlockButtons() {
  document.getElementById('btn-run-backup').disabled = false
  document.getElementById('btn-run-backup').textContent = '🚀 Bắt đầu Git Backup'
}

// ─── THEME MANAGEMENT ───
function initTheme() {
  const themeSelect = document.getElementById('theme-select')
  if (!themeSelect) return

  const savedTheme = localStorage.getItem('git2hdd-theme') || 'theme-default'
  applyTheme(savedTheme)
  themeSelect.value = savedTheme

  themeSelect.addEventListener('change', (e) => {
    const selected = e.target.value
    applyTheme(selected)
    localStorage.setItem('git2hdd-theme', selected)
  })
}

function applyTheme(themeName) {
  // Chỉ xóa các class bắt đầu bằng "theme-" để giữ lại các class bố cục khác (như sidebar-right)
  const classesToRemove = Array.from(document.body.classList).filter(c => c.startsWith('theme-'))
  classesToRemove.forEach(c => document.body.classList.remove(c))

  // Apply selected theme class
  if (themeName !== 'theme-default') {
    document.body.classList.add(themeName)
  }
}

// ─── DAILY SCHEDULER MANAGEMENT ───
function initScheduler() {
  document.getElementById('btn-save-schedule').addEventListener('click', saveSchedule)
  document.getElementById('btn-delete-schedule').addEventListener('click', deleteSchedule)
}

async function loadScheduleStatus() {
  const statusText = document.getElementById('schedule-status-text')
  const timeInput = document.getElementById('schedule-time')
  const btnSave = document.getElementById('btn-save-schedule')
  const btnDelete = document.getElementById('btn-delete-schedule')

  try {
    const res = await fetch(withProject('/api/schedule'))
    const data = await res.json()

    if (data.success && data.exists) {
      statusText.innerHTML = `Trạng thái: <span style="color:var(--success);font-weight:600;">Đang bật (${data.status})</span><br>Lần chạy kế tiếp: <strong>${data.nextRun}</strong>`
      btnDelete.style.display = 'block'
      btnSave.textContent = '🔄 Cập nhật lịch chạy'

      // Trích xuất giờ chạy từ thuộc tính nextRun (Ví dụ: "15-06-2026 10:00:00 PM")
      const match = data.nextRun.match(/(\d{1,2}):(\d{2}):\d{2}\s+(AM|PM)/i)
      if (match) {
        let hr = parseInt(match[1], 10)
        const min = match[2]
        const ampm = match[3].toUpperCase()
        if (ampm === 'PM' && hr < 12) hr += 12
        if (ampm === 'AM' && hr === 12) hr = 0
        const hrStr = hr.toString().padStart(2, '0')
        timeInput.value = `${hrStr}:${min}`
      }
    } else {
      statusText.textContent = 'Dự án này chưa được lên lịch chạy backup tự động.'
      btnDelete.style.display = 'none'
      btnSave.textContent = '⏰ Thiết lập lịch chạy'
    }
  } catch (err) {
    statusText.textContent = 'Lỗi kết nối kiểm tra lịch chạy.'
  }
}

async function saveSchedule() {
  const time = document.getElementById('schedule-time').value.trim()
  if (!/^\d{2}:\d{2}$/.test(time)) {
    showAlert('Định dạng giờ không hợp lệ. Phải là HH:mm (VD: 22:00).', 'danger')
    return
  }

  try {
    const res = await fetch(withProject('/api/schedule'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time })
    })
    const data = await res.json()
    if (data.success) {
      showAlert('Lên lịch backup tự động thành công!')
      await loadScheduleStatus()
    } else {
      showAlert(`Lỗi lên lịch: ${data.errors.join(', ')}`, 'danger')
    }
  } catch (err) {
    showAlert('Không thể kết nối tới máy chủ để lên lịch.', 'danger')
  }
}

async function deleteSchedule() {
  if (!confirm('Bạn có chắc chắn muốn hủy lịch backup tự động cho dự án này không?')) return

  try {
    const res = await fetch(withProject('/api/schedule'), { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      showAlert('Đã hủy lịch backup tự động.')
      document.getElementById('schedule-time').value = ''
      await loadScheduleStatus()
    } else {
      showAlert(`Lỗi hủy lịch: ${data.errors.join(', ')}`, 'danger')
    }
  } catch (err) {
    showAlert('Không thể kết nối tới máy chủ để hủy lịch.', 'danger')
  }
}

// ─── AUTOMATIC STORAGE DRIVES DETECTION ───
function initDrives() {
  document.getElementById('btn-refresh-drives').addEventListener('click', loadDrives)
}

async function loadDrives() {
  const drivesContainer = document.getElementById('drives-list')
  drivesContainer.innerHTML = '<div class="empty-placeholder">Đang quét ổ đĩa...</div>'

  try {
    const res = await fetch('/api/drives')
    const data = await res.json()

    if (data.success && data.drives && data.drives.length > 0) {
      drivesContainer.innerHTML = ''
      // Lọc các ổ đĩa có kích thước > 0
      const validDrives = data.drives.filter(d => d.Size > 0)

      validDrives.forEach(d => {
        const driveItem = document.createElement('div')
        driveItem.className = 'drive-item'

        const sizeGB = (d.Size / (1024 ** 3)).toFixed(1)
        const freeGB = (d.FreeSpace / (1024 ** 3)).toFixed(1)
        const usedGB = (sizeGB - freeGB).toFixed(1)
        const percentUsed = ((usedGB / sizeGB) * 100).toFixed(0)

        // Trích xuất tên dự án (lấy từ SSD nguồn hiện tại hoặc mặc định)
        const projectName = appState.config && appState.config.sourcePath
          ? appState.config.sourcePath.split(/[\\/]/).pop()
          : 'project'

        driveItem.innerHTML = `
          <div class="drive-info-row">
            <span class="drive-name">📁 ${d.VolumeName ? d.VolumeName : 'Local Disk'}</span>
            <span class="drive-letter">${d.DeviceID}</span>
          </div>
          <div class="drive-space">Trống ${freeGB} GB / ${sizeGB} GB (${percentUsed}% đã dùng)</div>
          <div class="drive-progress-bar">
            <div class="drive-progress-fill" style="width: ${percentUsed}%;"></div>
          </div>
          <div class="drive-actions">
            <button type="button" class="drive-btn" onclick="addDetectedDrivePath('${d.DeviceID}', 'backup', '${projectName}')">+ Backup</button>
          </div>
        `
        drivesContainer.appendChild(driveItem)
      })
    } else {
      drivesContainer.innerHTML = '<div class="empty-placeholder">Không phát hiện ổ đĩa nào khả dụng.</div>'
    }
  } catch (err) {
    drivesContainer.innerHTML = '<div class="empty-placeholder">Lỗi khi quét ổ đĩa.</div>'
  }
}

window.addDetectedDrivePath = function(letter, type, projectName) {
  const sanitizedName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')

  if (type === 'backup') {
    const path = `${letter}\\git2hdd-backups\\${sanitizedName}.git`
    addTargetInput(path, 'targets-input-list')
    showAlert(`Đã thêm backup target: ${path}`)
  }
}

// ─── SIDEBAR POSITIONING ───
function initSidebarPosition() {
  const sidebarSelect = document.getElementById('sidebar-select')
  if (!sidebarSelect) return

  const savedPosition = localStorage.getItem('git2hdd-sidebar-position') || 'left'
  applySidebarPosition(savedPosition)
  sidebarSelect.value = savedPosition

  sidebarSelect.addEventListener('change', (e) => {
    const selected = e.target.value
    applySidebarPosition(selected)
    localStorage.setItem('git2hdd-sidebar-position', selected)
  })
}

function applySidebarPosition(position) {
  if (position === 'right') {
    document.body.classList.add('sidebar-right')
  } else {
    document.body.classList.remove('sidebar-right')
  }
}
