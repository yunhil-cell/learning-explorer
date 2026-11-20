const TOOLKIT_STORAGE_KEY = 'learning_explorer_toolkit_v1';
const FIREBASE_CONFIG_URL = 'https://learning-explorer-default-rtdb.firebaseio.com/gameData/system/config.json';

const TOOLKIT_THEMES = {
  indigo:   { name: '인디고 밤하늘', bg: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 45%, #0F172A 100%)', text: '#F8FAFC' },
  slate:    { name: '모던 슬레이트', bg: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', text: '#F8FAFC' },
  chalk:    { name: '칠판 그린', bg: 'linear-gradient(135deg, #14532D 0%, #064E3B 100%)', text: '#F8FAFC' },
  lavender: { name: '소프트 라벤더', bg: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)', text: '#1E293B' },
  cream:    { name: '빈티지 크림', bg: 'linear-gradient(135deg, #FDFBF7 0%, #E2E8F0 100%)', text: '#1E293B' },
  sky:      { name: '스카이 블루', bg: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)', text: '#1E293B' }
};

const FONT_SCALE_MAP = { 1: 0.95, 2: 1.1, 3: 1.25, 4: 1.45, 5: 1.65 };

let toolkitState = {
  topZ: 10,
  settings: { fontScale: 3, theme: 'indigo' },
  widgets: []
};

const timerRuntime = {};
let clockInterval = null;

// ==========================================
// 1. 인증 및 초기화
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  initToolkitAuth();
});

async function initToolkitAuth() {
  const openedByTeacher = Boolean(window.opener && window.opener.isTeacherMode === true);
  if (openedByTeacher) {
    sessionStorage.setItem('toolkit_authed', 'true');
  }

  if (sessionStorage.getItem('toolkit_authed') === 'true') {
    startToolkit();
    return;
  }

  // URL 직접 접속 시 교사 PIN 입력 요구
  document.getElementById('tkPinGate').style.display = 'flex';
  const input = document.getElementById('tkPinInput');
  input.focus();
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyToolkitPin();
  });
}

async function verifyToolkitPin() {
  const input = document.getElementById('tkPinInput').value.trim();
  const errEl = document.getElementById('tkPinErr');
  errEl.innerText = '';

  try {
    const res = await fetch(FIREBASE_CONFIG_URL, { cache: 'no-store' });
    const cfg = await res.json();
    const correctPin = String((cfg && cfg.teacher_PIN) || '').trim().replace(/^!/, '');
    if (!/^\d{6}$/.test(correctPin)) {
      errEl.innerText = '시스템에 교사 PIN이 설정되지 않았습니다.';
      return;
    }
    if (input === correctPin) {
      sessionStorage.setItem('toolkit_authed', 'true');
      document.getElementById('tkPinGate').style.display = 'none';
      startToolkit();
    } else {
      errEl.innerText = 'PIN 번호가 일치하지 않습니다.';
    }
  } catch (e) {
    errEl.innerText = '인증 확인 중 통신 오류가 발생했습니다.';
  }
}

function startToolkit() {
  loadToolkitState();
  applyToolkitSettings();
  renderAllWidgets();
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(updateClockWidgets, 1000);
}

function applyToolkitSettings() {
  const settings = toolkitState.settings || { fontScale: 3, theme: 'indigo' };
  const scale = FONT_SCALE_MAP[settings.fontScale] || 1.0;
  document.documentElement.style.setProperty('--tk-font-scale', scale);

  const theme = TOOLKIT_THEMES[settings.theme] || TOOLKIT_THEMES.indigo;
  document.body.style.background = theme.bg;
}

// ==========================================
// 2. 상태 저장 / 불러오기 / 초기화
// ==========================================
function loadToolkitState() {
  try {
    const saved = JSON.parse(localStorage.getItem(TOOLKIT_STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.widgets)) {
      toolkitState = saved;
      if (!toolkitState.settings) toolkitState.settings = { fontScale: 3, theme: 'indigo' };
      return;
    }
  } catch (e) {
    console.error('툴킷 상태 로드 실패:', e);
  }

  // 최초 실행 시 기본 위젯 2개 배치
  toolkitState = {
    topZ: 12,
    settings: { fontScale: 3, theme: 'indigo' },
    widgets: [
      { id: 'clock', type: 'clock', title: '⏰ 디지털 시계', x: 24, y: 24, w: 340, h: 170, z: 10, data: {} },
      { id: 'memo_1', type: 'memo', title: '📝 메모', x: 24, y: 210, w: 340, h: 240, z: 11, data: { text: '', color: '#FEF3C7', fontSize: 18 } }
    ]
  };
  saveToolkitState();
}

function saveToolkitState() {
  localStorage.setItem(TOOLKIT_STORAGE_KEY, JSON.stringify(toolkitState));
}

function resetToolkitLayout() {
  localStorage.removeItem(TOOLKIT_STORAGE_KEY);
  Object.keys(timerRuntime).forEach(id => {
    clearInterval(timerRuntime[id].interval);
    delete timerRuntime[id];
  });
  loadToolkitState();
  renderAllWidgets();
}

// ==========================================
// 3. 위젯 생성 / 닫기 / 포커스 / 도크 동기화
// ==========================================
function toggleWidget(type) {
  const existing = toolkitState.widgets.find(w => w.type === type);
  if (existing) {
    bringToFront(existing.id);
    return;
  }

  const defaults = {
    clock:     { title: '⏰ 디지털 시계', w: 340, h: 170, data: {} },
    timer:     { title: '⏱️ 타이머 / 스톱워치', w: 340, h: 260, data: { mode: 'timer', totalSec: 300 } },
    dday:      { title: '📅 디데이', w: 260, h: 190, data: { label: '종업식', targetDate: new Date().toISOString().slice(0, 10) } },
    checklist: { title: '✅ 체크리스트', w: 300, h: 320, data: { items: [] } },
    dice:      { title: '🎲 주사위', w: 240, h: 260, data: { count: 1, values: [1] } },
    qr:        { title: '📱 QR 코드', w: 270, h: 320, data: { url: getDefaultGameUrl() } }
  };

  const cfg = defaults[type];
  if (!cfg) return;

  const scale = FONT_SCALE_MAP[(toolkitState.settings && toolkitState.settings.fontScale) || 3] || 1.25;
  const offset = (toolkitState.widgets.length % 6) * 28;
  toolkitState.topZ += 1;
  toolkitState.widgets.push({
    id: type,
    type: type,
    title: cfg.title,
    x: 40 + offset,
    y: 40 + offset,
    w: Math.round(cfg.w * scale),
    h: Math.round(cfg.h * scale),
    z: toolkitState.topZ,
    data: cfg.data
  });

  saveToolkitState();
  renderAllWidgets();
}

function createMemoWidget() {
  const scale = FONT_SCALE_MAP[(toolkitState.settings && toolkitState.settings.fontScale) || 3] || 1.25;
  const offset = (toolkitState.widgets.length % 6) * 26;
  const memoId = 'memo_' + Date.now();
  toolkitState.topZ += 1;
  toolkitState.widgets.push({
    id: memoId,
    type: 'memo',
    title: '📝 메모',
    x: 60 + offset,
    y: 60 + offset,
    w: Math.round(320 * scale),
    h: Math.round(240 * scale),
    z: toolkitState.topZ,
    data: { text: '', color: '#FEF3C7', fontSize: 22 }
  });
  saveToolkitState();
  renderAllWidgets();
}

function createBoardWidget() {
  const scale = FONT_SCALE_MAP[(toolkitState.settings && toolkitState.settings.fontScale) || 3] || 1.25;
  const offset = (toolkitState.widgets.length % 6) * 26;
  const boardId = 'board_' + Date.now();
  toolkitState.topZ += 1;
  toolkitState.widgets.push({
    id: boardId,
    type: 'board',
    title: '✏️ 칠판 판서',
    x: 80 + offset,
    y: 40 + offset,
    w: Math.round(480 * scale),
    h: Math.round(360 * scale),
    z: toolkitState.topZ,
    data: { html: '', fontSize: 24 }
  });
  saveToolkitState();
  renderAllWidgets();
}

function closeWidget(id) {
  if (timerRuntime[id]) {
    clearInterval(timerRuntime[id].interval);
    delete timerRuntime[id];
  }
  toolkitState.widgets = toolkitState.widgets.filter(w => w.id !== id);
  saveToolkitState();
  renderAllWidgets();
}

function bringToFront(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  toolkitState.topZ += 1;
  w.z = toolkitState.topZ;
  const el = document.getElementById('win_' + id);
  if (el) el.style.zIndex = w.z;
  saveToolkitState();
}

function syncDockActiveState() {
  const openTypes = new Set(toolkitState.widgets.map(w => w.type));
  document.querySelectorAll('.tk-tool-btn').forEach(btn => {
    const t = btn.getAttribute('data-type');
    btn.classList.toggle('active', openTypes.has(t));
  });
}

// ==========================================
// 4. 위젯 렌더링 및 드래그·리사이즈
// ==========================================
function renderAllWidgets() {
  const desktop = document.getElementById('tkDesktop');
  desktop.innerHTML = '';

  toolkitState.widgets.forEach(w => {
    const win = document.createElement('div');
    win.className = 'tk-window';
    win.id = 'win_' + w.id;
    win.style.left = w.x + 'px';
    win.style.top = w.y + 'px';
    win.style.width = w.w + 'px';
    win.style.height = w.h + 'px';
    win.style.zIndex = w.z;

    win.innerHTML = `
      <div class="tk-win-header">
        <span>${w.title}</span>
        <button class="tk-win-close" onclick="closeWidget('${w.id}')">&times;</button>
      </div>
      <div class="tk-win-body" id="body_${w.id}"></div>
      <div class="tk-resize-handle"></div>
    `;

    win.addEventListener('pointerdown', () => bringToFront(w.id));
    attachDragAndResize(win, w);
    desktop.appendChild(win);
    renderWidgetBody(w);
  });

  syncDockActiveState();
}

function attachDragAndResize(win, w) {
  const header = win.querySelector('.tk-win-header');
  const resizeHandle = win.querySelector('.tk-resize-handle');

  header.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, select, textarea')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = w.x;
    const origY = w.y;

    const onMove = (ev) => {
      const maxX = Math.max(0, window.innerWidth - 100);
      const maxY = Math.max(0, window.innerHeight - 60);
      w.x = Math.min(maxX, Math.max(0, origX + (ev.clientX - startX)));
      w.y = Math.min(maxY, Math.max(0, origY + (ev.clientY - startY)));
      win.style.left = w.x + 'px';
      win.style.top = w.y + 'px';
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      saveToolkitState();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  resizeHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = w.w;
    const origH = w.h;

    const onMove = (ev) => {
      w.w = Math.max(190, origW + (ev.clientX - startX));
      w.h = Math.max(140, origH + (ev.clientY - startY));
      win.style.width = w.w + 'px';
      win.style.height = w.h + 'px';
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (w.type === 'qr') renderWidgetBody(w);
      saveToolkitState();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

function renderWidgetBody(w) {
  const body = document.getElementById('body_' + w.id);
  if (!body) return;

  if (w.type === 'clock') renderClockBody(w, body);
  else if (w.type === 'timer') renderTimerBody(w, body);
  else if (w.type === 'memo') renderMemoBody(w, body);
  else if (w.type === 'dday') renderDdayBody(w, body);
  else if (w.type === 'checklist') renderChecklistBody(w, body);
  else if (w.type === 'dice') renderDiceBody(w, body);
  else if (w.type === 'qr') renderQrBody(w, body);
  else if (w.type === 'board') renderBoardBody(w, body);
}

// ==========================================
// 5. 개별 위젯 구현부
// ==========================================

// [1] 시계
function renderClockBody(w, body) {
  body.innerHTML = `
    <div class="tk-clock-wrap">
      <div class="tk-clock-time" id="clk_time_${w.id}">00:00:00</div>
      <div class="tk-clock-date" id="clk_date_${w.id}"></div>
    </div>
  `;
  updateClockWidgets();
}

function updateClockWidgets() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;

  toolkitState.widgets.filter(w => w.type === 'clock').forEach(w => {
    const tEl = document.getElementById('clk_time_' + w.id);
    const dEl = document.getElementById('clk_date_' + w.id);
    if (tEl) tEl.innerText = `${h}:${m}:${s}`;
    if (dEl) dEl.innerText = dateStr;
  });
}

// [2] 타이머 & 스톱워치 (밀리세컨드 단위 지원)
function formatMsDisplay(ms) {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(safeMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const cs = String(Math.floor((safeMs % 1000) / 10)).padStart(2, '0');
  return `${mm}:${ss}<span class="tk-timer-ms">.${cs}</span>`;
}

function renderTimerBody(w, body) {
  if (!timerRuntime[w.id]) {
    timerRuntime[w.id] = {
      running: false,
      ended: false,
      remainMs: (Number(w.data.totalSec) || 300) * 1000,
      elapsedMs: 0,
      lastTick: 0,
      interval: null
    };
  }
  const rt = timerRuntime[w.id];
  const isTimer = w.data.mode !== 'stopwatch';
  const displayMs = isTimer ? rt.remainMs : rt.elapsedMs;
  const curTotal = Number(w.data.totalSec) || 300;
  const curMin = Math.floor(curTotal / 60);
  const curSec = curTotal % 60;

  body.innerHTML = `
    <div class="tk-timer-wrap">
      <div class="tk-btn-row" style="margin-bottom:6px;">
        <button class="tk-mini-btn ${isTimer ? 'primary' : ''}" onclick="switchTimerMode('${w.id}', 'timer')">타이머</button>
        <button class="tk-mini-btn ${!isTimer ? 'primary' : ''}" onclick="switchTimerMode('${w.id}', 'stopwatch')">스톱워치</button>
      </div>
      <div id="tm_disp_${w.id}" class="tk-timer-display ${rt.ended ? 'ended' : ''}"><span>${formatMsDisplay(displayMs)}</span></div>
      ${isTimer ? `
        <div class="tk-btn-row" style="margin-bottom:5px; align-items:center;">
          <input id="tm_min_${w.id}" type="number" min="0" max="99" value="${curMin}"
            style="width:48px; padding:3px 4px; border:1px solid #CBD5E1; border-radius:5px; text-align:center; font-weight:bold; font-size:0.8em;">
          <span style="font-size:0.78em; font-weight:bold;">분</span>
          <input id="tm_sec_${w.id}" type="number" min="0" max="59" value="${curSec}"
            style="width:48px; padding:3px 4px; border:1px solid #CBD5E1; border-radius:5px; text-align:center; font-weight:bold; font-size:0.8em;">
          <span style="font-size:0.78em; font-weight:bold;">초</span>
          <button class="tk-mini-btn primary" onclick="applyCustomTimer('${w.id}')">설정</button>
        </div>
        <div class="tk-btn-row" style="margin-bottom:6px;">
          <button class="tk-mini-btn" onclick="setTimerPreset('${w.id}', 60)">1분</button>
          <button class="tk-mini-btn" onclick="setTimerPreset('${w.id}', 180)">3분</button>
          <button class="tk-mini-btn" onclick="setTimerPreset('${w.id}', 300)">5분</button>
          <button class="tk-mini-btn" onclick="setTimerPreset('${w.id}', 600)">10분</button>
        </div>
      ` : ''}
      <div class="tk-btn-row">
        <button class="tk-mini-btn ${rt.running ? 'warn' : 'primary'}" onclick="toggleTimerRun('${w.id}')">${rt.running ? '일시정지' : '시작'}</button>
        <button class="tk-mini-btn" onclick="resetTimer('${w.id}')">초기화</button>
      </div>
    </div>
  `;
}

function applyCustomTimer(id) {
  const m = Math.max(0, Number(document.getElementById('tm_min_' + id)?.value) || 0);
  const s = Math.max(0, Math.min(59, Number(document.getElementById('tm_sec_' + id)?.value) || 0));
  const total = Math.max(1, m * 60 + s);
  setTimerPreset(id, total);
}

function switchTimerMode(id, mode) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  clearInterval(timerRuntime[id].interval);
  timerRuntime[id].running = false;
  timerRuntime[id].ended = false;
  w.data.mode = mode;
  saveToolkitState();
  renderWidgetBody(w);
}

function setTimerPreset(id, sec) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  clearInterval(timerRuntime[id].interval);
  timerRuntime[id].running = false;
  timerRuntime[id].ended = false;
  timerRuntime[id].remainMs = sec * 1000;
  w.data.totalSec = sec;
  saveToolkitState();
  renderWidgetBody(w);
}

function toggleTimerRun(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  const rt = timerRuntime[id];
  if (!w || !rt) return;

  if (rt.running) {
    clearInterval(rt.interval);
    rt.running = false;
    renderWidgetBody(w);
    return;
  }

  rt.ended = false;
  rt.running = true;
  rt.lastTick = Date.now();

  rt.interval = setInterval(() => {
    const now = Date.now();
    const delta = now - rt.lastTick;
    rt.lastTick = now;

    if (w.data.mode !== 'stopwatch') {
      rt.remainMs = Math.max(0, rt.remainMs - delta);
      if (rt.remainMs <= 0) {
        clearInterval(rt.interval);
        rt.running = false;
        rt.ended = true;
        playTimerBeep();
      }
    } else {
      rt.elapsedMs += delta;
    }

    const disp = document.getElementById('tm_disp_' + id);
    if (disp) {
      const ms = w.data.mode !== 'stopwatch' ? rt.remainMs : rt.elapsedMs;
      disp.innerHTML = `<span>${formatMsDisplay(ms)}</span>`;
      disp.classList.toggle('ended', rt.ended);
    }
    if (rt.ended) renderWidgetBody(w);
  }, 33);

  renderWidgetBody(w);
}

function resetTimer(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  const rt = timerRuntime[id];
  if (!w || !rt) return;
  clearInterval(rt.interval);
  rt.running = false;
  rt.ended = false;
  rt.remainMs = (Number(w.data.totalSec) || 300) * 1000;
  rt.elapsedMs = 0;
  renderWidgetBody(w);
}

function playTimerBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.16);
    });
  } catch (e) {
    console.warn('알림음 재생 불가:', e);
  }
}

// [3] 포스트잇 메모 (다중 생성)
function renderMemoBody(w, body) {
  const colors = ['#FEF3C7', '#DCFCE7', '#DBEAFE', '#FCE7F3', '#FFFFFF'];
  const bg = w.data.color || '#FEF3C7';
  const fontSize = Number(w.data.fontSize) || 18;
  body.style.background = bg;

  const dots = colors.map(c =>
    `<span class="tk-color-dot" style="background:${c};" onclick="changeMemoColor('${w.id}', '${c}')"></span>`
  ).join('');

  body.innerHTML = `
    <div class="tk-memo-toolbar">
      <div style="display:flex; gap:5px;">${dots}</div>
      <div style="display:flex; gap:4px;">
        <button class="tk-mini-btn" onclick="changeMemoFont('${w.id}', -2)">A-</button>
        <button class="tk-mini-btn" onclick="changeMemoFont('${w.id}', 2)">A+</button>
      </div>
    </div>
    <textarea id="memo_txt_${w.id}" class="tk-memo-area" style="font-size:${fontSize}px;" placeholder="여기에 메모를 입력하세요..."></textarea>
  `;

  const ta = document.getElementById('memo_txt_' + w.id);
  ta.value = w.data.text || '';
  ta.addEventListener('input', () => {
    w.data.text = ta.value;
    saveToolkitState();
  });
}

function changeMemoColor(id, color) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.color = color;
  saveToolkitState();
  renderWidgetBody(w);
}

function changeMemoFont(id, delta) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.fontSize = Math.min(48, Math.max(12, (Number(w.data.fontSize) || 18) + delta));
  saveToolkitState();
  renderWidgetBody(w);
}

// [4] 디데이
function renderDdayBody(w, body) {
  const dText = calcDdayText(w.data.targetDate);
  body.innerHTML = `
    <div class="tk-dday-wrap">
      <div class="tk-dday-num">${dText}</div>
      <div style="display:flex; flex-direction:column; gap:5px;">
        <input type="text" value="${escapeTkHtml(w.data.label || '')}" placeholder="일정 제목"
          onchange="updateDday('${w.id}', 'label', this.value)"
          style="width:100%; padding:5px 8px; border:1px solid #CBD5E1; border-radius:6px; font-weight:bold; text-align:center;">
        <input type="date" value="${escapeTkHtml(w.data.targetDate || '')}"
          onchange="updateDday('${w.id}', 'targetDate', this.value)"
          style="width:100%; padding:4px 8px; border:1px solid #CBD5E1; border-radius:6px; font-size:0.85em; text-align:center;">
      </div>
    </div>
  `;
}

function updateDday(id, key, val) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data[key] = val;
  saveToolkitState();
  renderWidgetBody(w);
}

function calcDdayText(dateStr) {
  if (!dateStr) return 'D-?';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parts = dateStr.split('-').map(Number);
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'D-DAY';
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

// [5] 체크리스트
function renderChecklistBody(w, body) {
  const items = w.data.items || [];
  const rows = items.map((item, idx) => `
    <div class="tk-check-item ${item.done ? 'done' : ''}">
      <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleCheckItem('${w.id}', ${idx})">
      <span style="flex:1; word-break:keep-all;">${escapeTkHtml(item.text)}</span>
      <button class="tk-mini-btn" style="padding:2px 6px;" onclick="removeCheckItem('${w.id}', ${idx})">&times;</button>
    </div>
  `).join('');

  body.innerHTML = `
    <div style="display:flex; gap:5px; padding:8px 10px; border-bottom:1px solid #E2E8F0;">
      <input id="chk_in_${w.id}" type="text" placeholder="할 일 입력 후 엔터"
        style="flex:1; padding:6px 8px; border:1px solid #CBD5E1; border-radius:6px; font-size:0.88em;">
      <button class="tk-mini-btn primary" onclick="addCheckItem('${w.id}')">추가</button>
    </div>
    <div class="tk-check-list">${rows || '<div style="color:#94A3B8; text-align:center; padding-top:20px; font-size:0.85em;">항목을 추가하세요.</div>'}</div>
  `;

  const input = document.getElementById('chk_in_' + w.id);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addCheckItem(w.id);
  });
}

function addCheckItem(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  const input = document.getElementById('chk_in_' + id);
  if (!w || !input) return;
  const text = input.value.trim();
  if (!text) return;
  w.data.items = w.data.items || [];
  w.data.items.push({ text, done: false });
  saveToolkitState();
  renderWidgetBody(w);
}

function toggleCheckItem(id, idx) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || !w.data.items || !w.data.items[idx]) return;
  w.data.items[idx].done = !w.data.items[idx].done;
  saveToolkitState();
  renderWidgetBody(w);
}

function removeCheckItem(id, idx) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || !w.data.items) return;
  w.data.items.splice(idx, 1);
  saveToolkitState();
  renderWidgetBody(w);
}

// [6] 주사위 (흰색 바탕 숫자 + 360도 구르는 애니메이션 + 최대 10개)
function renderDiceBody(w, body) {
  const count = Math.min(10, Math.max(1, Number(w.data.count) || 1));
  const values = Array.isArray(w.data.values) ? w.data.values.slice(0, count) : Array(count).fill(1);
  while (values.length < count) values.push(1);

  const sizePx = count <= 2 ? 78 : (count <= 4 ? 62 : 50);
  const fontPx = Math.round(sizePx * 0.5);
  const rollingClass = w._rolling ? 'rolling' : '';
  const diceHtml = values.map((v, idx) =>
    `<div class="tk-die ${rollingClass}" style="width:${sizePx}px; height:${sizePx}px; font-size:${fontPx}px; animation-delay:${(idx % 3) * 0.06}s;">${v}</div>`
  ).join('');
  const totalSum = values.reduce((a, b) => a + Number(b || 0), 0);

  let opts = '';
  for (let n = 1; n <= 10; n++) {
    opts += `<option value="${n}" ${count === n ? 'selected' : ''}>${n}개</option>`;
  }

  body.innerHTML = `
    <div class="tk-dice-wrap">
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:6px;">
        <select onchange="setDiceCount('${w.id}', Number(this.value))"
          style="padding:4px 8px; border:1px solid #CBD5E1; border-radius:6px; font-weight:bold; font-size:0.85em;">
          ${opts}
        </select>
        <span style="font-size:0.85em; font-weight:bold; color:#334155;">합계: <b style="color:#EF4444;">${totalSum}</b></span>
      </div>
      <div class="tk-dice-grid">${diceHtml}</div>
      <button class="tk-mini-btn warn" style="width:100%; padding:8px; font-size:0.92em;" onclick="rollDice('${w.id}')">🎲 던지기</button>
    </div>
  `;
}

function setDiceCount(id, count) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  const safeCount = Math.min(10, Math.max(1, Number(count) || 1));
  w.data.count = safeCount;
  w.data.values = Array(safeCount).fill(1);
  saveToolkitState();
  renderWidgetBody(w);
}

function rollDice(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || w._rolling) return;
  const count = Math.min(10, Math.max(1, Number(w.data.count) || 1));
  w._rolling = true;
  renderWidgetBody(w);

  let ticks = 0;
  const anim = setInterval(() => {
    w.data.values = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
    const boxes = document.querySelectorAll(`#body_${id} .tk-die`);
    boxes.forEach((box, i) => { box.innerText = w.data.values[i]; });
    ticks++;
    if (ticks >= 10) {
      clearInterval(anim);
      w._rolling = false;
      saveToolkitState();
      renderWidgetBody(w);
    }
  }, 65);
}

// [7] QR 코드
function getDefaultGameUrl() {
  if (window.opener && window.opener.location) {
    return window.opener.location.href.split('?')[0];
  }
  return window.location.href.replace(/toolkit\.html.*$/, 'index.html');
}

function renderQrBody(w, body) {
  const url = w.data.url || getDefaultGameUrl();
  const size = Math.max(90, Math.min(w.w - 40, w.h - 110));

  body.innerHTML = `
    <div style="width:100%; height:100%; padding:10px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:8px;">
      <div id="qr_box_${w.id}" style="flex:1; display:flex; align-items:center; justify-content:center;"></div>
      <div style="display:flex; gap:4px; width:100%;">
        <input id="qr_in_${w.id}" type="text" value="${escapeTkHtml(url)}" placeholder="공유할 URL 입력"
          style="flex:1; min-width:0; padding:5px 8px; border:1px solid #CBD5E1; border-radius:6px; font-size:0.8em;">
        <button class="tk-mini-btn primary" onclick="updateQrUrl('${w.id}')">생성</button>
      </div>
    </div>
  `;

  const box = document.getElementById('qr_box_' + w.id);
  if (box && typeof QRCode !== 'undefined') {
    new QRCode(box, { text: url, width: size, height: size });
  } else if (box) {
    box.innerHTML = '<div style="font-size:0.8em; color:#EF4444;">QR 라이브러리를 불러오지 못했습니다.</div>';
  }
}

function updateQrUrl(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  const input = document.getElementById('qr_in_' + id);
  if (!w || !input) return;
  w.data.url = input.value.trim() || getDefaultGameUrl();
  saveToolkitState();
  renderWidgetBody(w);
}

// [8] 칠판 판서 (서식 강조 + 고정폭 공백 2칸=한글 1칸)
function renderBoardBody(w, body) {
  const fontSize = Number(w.data.fontSize) || 20;

  body.innerHTML = `
    <div class="tk-board-wrap">
      <div class="tk-board-toolbar">
        <button class="tk-board-btn" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'foreColor', '#FFFFFF')">흰색</button>
        <button class="tk-board-btn" style="color:#FDE047;" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'foreColor', '#FDE047')">노랑</button>
        <button class="tk-board-btn" style="color:#F9A8D4;" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'foreColor', '#F9A8D4')">분홍</button>
        <button class="tk-board-btn" style="color:#7DD3FC;" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'foreColor', '#7DD3FC')">하늘</button>
        <button class="tk-board-btn" style="background:#FACC15; color:#000;" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'hiliteColor', '#FACC15')">형광</button>
        <button class="tk-board-btn" style="background:#F472B6; color:#000;" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'hiliteColor', '#F472B6')">분홍강조</button>
        <button class="tk-board-btn" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'hiliteColor', 'transparent')">형광해제</button>
        <button class="tk-board-btn" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'underline')"><u>밑줄</u></button>
        <button class="tk-board-btn" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'bold')"><b>굵게</b></button>
        <button class="tk-board-btn" onclick="changeBoardFont('${w.id}', -2)">A-</button>
        <button class="tk-board-btn" onclick="changeBoardFont('${w.id}', 2)">A+</button>
        <button class="tk-board-btn" onclick="clearBoardContent('${w.id}')">지우기</button>
      </div>
      <div id="board_ed_${w.id}" class="tk-board-editor" contenteditable="true" style="font-size:${fontSize}px;"></div>
    </div>
  `;

  const ed = document.getElementById('board_ed_' + w.id);
  ed.innerHTML = w.data.html || '';

  ed.addEventListener('input', () => {
    w.data.html = ed.innerHTML;
    saveToolkitState();
  });

  // Tab 키 입력 시 공백 2칸 삽입 (고정폭 줄맞춤 지원)
  ed.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  });
}

function execBoardCmd(id, cmd, val = null) {
  const ed = document.getElementById('board_ed_' + id);
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!ed || !w) return;
  ed.focus();
  document.execCommand(cmd, false, val);
  w.data.html = ed.innerHTML;
  saveToolkitState();
}

function changeBoardFont(id, delta) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.fontSize = Math.min(48, Math.max(12, (Number(w.data.fontSize) || 20) + delta));
  saveToolkitState();
  renderWidgetBody(w);
}

function clearBoardContent(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.html = '';
  saveToolkitState();
  renderWidgetBody(w);
}

// ==========================================
// 6. 기본 설정 모달 (글자 크기 5단계 · 배경 테마)
// ==========================================
function openSettingsModal() {
  renderSettingsModal();
  document.getElementById('tkSettingsModal').style.display = 'flex';
}

function closeSettingsModal() {
  document.getElementById('tkSettingsModal').style.display = 'none';
}

function renderSettingsModal() {
  const settings = toolkitState.settings || { fontScale: 3, theme: 'indigo' };
  const fontContainer = document.getElementById('tkFontScaleBtns');
  const themeContainer = document.getElementById('tkThemeBtns');

  let fHtml = '';
  for (let lv = 1; lv <= 5; lv++) {
    const active = Number(settings.fontScale) === lv;
    fHtml += `<button class="tk-mini-btn ${active ? 'primary' : ''}" style="flex:1; padding:8px 0;" onclick="setFontScale(${lv})">${lv}단계</button>`;
  }
  fontContainer.innerHTML = fHtml;

  themeContainer.innerHTML = Object.entries(TOOLKIT_THEMES).map(([key, t]) => {
    const active = settings.theme === key ? 'active' : '';
    return `<button class="tk-theme-btn ${active}" style="background:${t.bg}; color:${t.text};" onclick="setToolkitTheme('${key}')">${t.name}</button>`;
  }).join('');
}

function setFontScale(level) {
  if (!toolkitState.settings) toolkitState.settings = {};
  const prevLevel = Number(toolkitState.settings.fontScale) || 3;
  const prevScale = FONT_SCALE_MAP[prevLevel] || 1.25;
  const nextScale = FONT_SCALE_MAP[level] || 1.25;
  const ratio = nextScale / prevScale;

  // 열려 있는 위젯 창 크기도 글자 크기 비율에 맞춰 함께 조절
  toolkitState.widgets.forEach(w => {
    w.w = Math.max(190, Math.round(w.w * ratio));
    w.h = Math.max(140, Math.round(w.h * ratio));
  });

  toolkitState.settings.fontScale = level;
  applyToolkitSettings();
  saveToolkitState();
  renderAllWidgets();
  renderSettingsModal();
}

function setToolkitTheme(themeKey) {
  if (!toolkitState.settings) toolkitState.settings = {};
  toolkitState.settings.theme = themeKey;
  applyToolkitSettings();
  saveToolkitState();
  renderSettingsModal();
}

function escapeTkHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}