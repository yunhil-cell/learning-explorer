const TOOLKIT_STORAGE_KEY = 'learning_explorer_toolkit_v1';
const FIREBASE_BASE_URL = 'https://learning-explorer-default-rtdb.firebaseio.com/gameData';
const FIREBASE_CONFIG_URL = FIREBASE_BASE_URL + '/system/config.json';

let tkStudents = [];
let tkSkins = [];

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

async function startToolkit() {
  loadToolkitState();
  applyToolkitSettings();
  renderAllWidgets();
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(updateClockWidgets, 1000);

  await loadToolkitStudents();
  // 학생 데이터를 받아온 뒤 명단 기반 위젯 다시 그리기
  toolkitState.widgets.forEach(w => {
    if (['pick', 'race', 'wheel', 'seat'].includes(w.type)) {
      renderWidgetBody(w);
    }
  });
}

async function loadToolkitStudents() {
  try {
    const [stRes, skRes] = await Promise.all([
      fetch(FIREBASE_BASE_URL + '/students.json', { cache: 'no-store' }),
      fetch(FIREBASE_BASE_URL + '/skins.json', { cache: 'no-store' })
    ]);
    const stData = await stRes.json();
    const skData = await skRes.json();

    tkSkins = skData ? (Array.isArray(skData) ? skData : Object.values(skData)).filter(Boolean) : [];

    const uniqueMap = {};
    if (stData) {
      if (Array.isArray(stData)) {
        stData.forEach(s => { if (s && s.name) uniqueMap[String(s.name).trim()] = s; });
      } else {
        Object.entries(stData).forEach(([key, s]) => {
          if (!s || !s.name) return;
          const sName = String(s.name).trim();
          if (String(key).trim() === sName || !uniqueMap[sName]) {
            uniqueMap[sName] = s;
          }
        });
      }
    }
    tkStudents = Object.values(uniqueMap).sort((a, b) => (Number(a.sheet_order) || 999) - (Number(b.sheet_order) || 999));
  } catch (e) {
    console.error('툴킷 학생/스킨 데이터 로드 실패:', e);
  }
}

function getStudentAvatarUrl(student) {
  const skinId = (student && student.equipped_skin) || 'HD001';
  const skinObj = tkSkins.find(x => x && String(x.skin_id) === String(skinId));
  return (skinObj && skinObj.skin_url) ? skinObj.skin_url : 'https://drive.google.com/thumbnail?id=1uoFPxFfpUaxE3eZCbrVU8oEvQLyQTg9b&sz=w200';
}

function applyToolkitSettings() {
  const settings = toolkitState.settings || { fontScale: 3, theme: 'indigo' };
  const scale = FONT_SCALE_MAP[settings.fontScale] || 1.25;
  document.documentElement.style.setProperty('--tk-font-scale', scale);

  const theme = TOOLKIT_THEMES[settings.theme] || TOOLKIT_THEMES.indigo;
  document.body.style.background = theme.bg;

  const dockWrap = document.getElementById('tkDockWrap');
  const dockToggle = document.getElementById('tkDockToggle');
  const hidden = Boolean(toolkitState.dockHidden);
  if (dockWrap) dockWrap.classList.toggle('collapsed', hidden);
  if (dockToggle) dockToggle.innerText = hidden ? '메뉴바 보이기' : '메뉴바 숨기기';
}

function toggleToolkitDock() {
  toolkitState.dockHidden = !toolkitState.dockHidden;
  applyToolkitSettings();
  saveToolkitState();
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

  const defaultScale = FONT_SCALE_MAP[3] || 1.25;
  // 최초 실행 시 기본 위젯 2개 배치
  toolkitState = {
    topZ: 12,
    settings: { fontScale: 3, theme: 'indigo' },
    widgets: [
      { id: 'clock', type: 'clock', title: '디지털 시계', x: 24, y: 24, w: Math.round(340 * defaultScale), h: Math.round(170 * defaultScale), z: 10, data: {} },
      { id: 'memo_1', type: 'memo', title: '메모', x: 24, y: Math.round(24 + 170 * defaultScale + 16), w: Math.round(340 * defaultScale), h: Math.round(240 * defaultScale), z: 11, data: { text: '', color: '#FEF3C7', fontSize: 22 } }
    ]
  };
  saveToolkitState();
}

function saveToolkitState() {
  localStorage.setItem(TOOLKIT_STORAGE_KEY, JSON.stringify(toolkitState));
}

function resetToolkitLayout() {
  Object.keys(timerRuntime).forEach(id => {
    clearInterval(timerRuntime[id].interval);
    delete timerRuntime[id];
  });

  // 현재 설정(글자 크기 배율·테마)은 유지한 채 창 배치만 초기화
  const curSettings = toolkitState.settings || { fontScale: 3, theme: 'indigo' };
  const scale = FONT_SCALE_MAP[curSettings.fontScale] || 1.25;
  const clkH = Math.round(170 * scale);

  toolkitState = {
    topZ: 12,
    settings: curSettings,
    widgets: [
      { id: 'clock', type: 'clock', title: '디지털 시계', x: 24, y: 24, w: Math.round(340 * scale), h: clkH, z: 10, data: {} },
      { id: 'memo_1', type: 'memo', title: '메모', x: 24, y: 24 + clkH + 16, w: Math.round(340 * scale), h: Math.round(240 * scale), z: 11, data: { text: '', color: '#FEF3C7', fontSize: 22 } }
    ]
  };
  saveToolkitState();
  applyToolkitSettings();
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
    clock:     { title: '디지털 시계', w: 340, h: 170, data: {} },
    timer:     { title: '타이머 / 스톱워치', w: 340, h: 260, data: { mode: 'timer', totalSec: 300 } },
    dday:      { title: '디데이', w: 260, h: 190, data: { label: '종업식', targetDate: new Date().toISOString().slice(0, 10) } },
    checklist: { title: '체크리스트', w: 300, h: 320, data: { items: [] } },
    dice:      { title: '주사위', w: 240, h: 260, data: { count: 1, values: [1] } },
    qr:        { title: 'QR 코드', w: 270, h: 320, data: { url: getDefaultGameUrl() } },
    pick:      { title: '랜덤 뽑기', w: 340, h: 360, data: { noDup: true, excluded: [], picked: [], lastWinner: '', showFilter: false } },
    race:      { title: '뽑기 레이스', w: 500, h: 400, data: { excluded: [], winner: '', showFilter: false } },
    wheel:     { title: '돌림판', w: 380, h: 430, data: { itemsText: '발표 1\n발표 2\n보너스!\n한 번 더!', angle: 0, winner: '', showEdit: false } },
    seat:      { title: '자리 바꾸기', w: 660, h: 480, data: { layoutMode: 'group', groupCount: 3, lineCount: 5, rowCount: 6, revealMode: 'instant', seats: [], activeSeats: [], lockedIdx: [] } }
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
    title: '메모',
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
    title: '칠판 판서',
    x: 80 + offset,
    y: 40 + offset,
    w: Math.round(540 * scale),
    h: Math.round(380 * scale),
    z: toolkitState.topZ,
    data: { html: '', fontSize: 60 }
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

function getEffectiveZ(w) {
  if (w.maximized) {
    return 9500;
  }
  if (w.pinned) {
    return 8500 + (Number(w.z) % 400);
  }
  return Math.min(8400, Number(w.z) || 10);
}

function bringToFront(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  toolkitState.topZ += 1;
  if (toolkitState.topZ > 8400) toolkitState.topZ = 100;
  w.z = toolkitState.topZ;
  const el = document.getElementById('win_' + id);
  if (el) el.style.zIndex = getEffectiveZ(w);
  saveToolkitState();
}

function togglePinWidget(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.pinned = !w.pinned;
  saveToolkitState();
  renderAllWidgets();
}

function toggleMaximizeWidget(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.maximized = !w.maximized;
  saveToolkitState();
  renderAllWidgets();
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
    win.className = 'tk-window' + (w.maximized ? ' maximized' : '');
    win.id = 'win_' + w.id;

    if (w.maximized) {
      win.style.left = '0px';
      win.style.top = '0px';
      win.style.width = '100%';
      win.style.height = '100%';
    } else {
      win.style.left = w.x + 'px';
      win.style.top = w.y + 'px';
      win.style.width = w.w + 'px';
      win.style.height = w.h + 'px';
    }
    win.style.zIndex = getEffectiveZ(w);

    win.innerHTML = `
      <div class="tk-win-header">
        <span>${w.title}</span>
        <div class="tk-win-actions">
          <button class="tk-win-btn ${w.pinned ? 'active' : ''}" onclick="togglePinWidget('${w.id}')" title="항상 위">고정</button>
          <button class="tk-win-btn ${w.maximized ? 'active' : ''}" onclick="toggleMaximizeWidget('${w.id}')" title="${w.maximized ? '원래 크기' : '최대화'}">${w.maximized ? '복원' : '□'}</button>
          <button class="tk-win-close" onclick="closeWidget('${w.id}')">&times;</button>
        </div>
      </div>
      <div class="tk-win-body" id="body_${w.id}"></div>
      ${w.maximized ? '' : '<div class="tk-resize-handle"></div>'}
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
    if (w.maximized) return;
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

  if (resizeHandle) resizeHandle.addEventListener('pointerdown', (e) => {
    if (w.maximized) return;
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
      if (w.type === 'qr' || w.type === 'wheel') renderWidgetBody(w);
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
  else if (w.type === 'pick') renderPickBody(w, body);
  else if (w.type === 'race') renderRaceBody(w, body);
  else if (w.type === 'wheel') renderWheelBody(w, body);
  else if (w.type === 'seat') renderSeatBody(w, body);
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

// [3] 포스트잇 메모 (다중 생성 + 글자 크기 드롭다운)
function renderMemoBody(w, body) {
  const colors = ['#FEF3C7', '#DCFCE7', '#DBEAFE', '#FCE7F3', '#FFFFFF'];
  const bg = w.data.color || '#FEF3C7';
  const fontSize = Number(w.data.fontSize) || 22;
  body.style.background = bg;

  const dots = colors.map(c =>
    `<span class="tk-color-dot" style="background:${c};" onclick="changeMemoColor('${w.id}', '${c}')"></span>`
  ).join('');

  const sizeList = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48];
  const sizeOpts = sizeList.map(sz =>
    `<option value="${sz}" ${fontSize === sz ? 'selected' : ''}>${sz}px</option>`
  ).join('');

  body.innerHTML = `
    <div class="tk-memo-toolbar">
      <div style="display:flex; gap:5px;">${dots}</div>
      <select class="tk-board-select" onchange="setMemoFontSize('${w.id}', Number(this.value))">
        ${sizeOpts}
      </select>
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

function setMemoFontSize(id, sizePx) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.fontSize = sizePx;
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

// [6] 3D 정육면체 주사위 (최대 10개 + 3축 구르기)
const CUBE_FACE_ROT = {
  1: { x: 0,   y: 0 },
  2: { x: 0,   y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90,  y: 0 },
  5: { x: 0,   y: 90 },
  6: { x: 0,   y: 180 }
};

function buildCubeHtml(val, sizePx, spinOffset, idx) {
  const half = sizePx / 2;
  const fontPx = Math.round(sizePx * 0.48);
  const rot = CUBE_FACE_ROT[val] || { x: 0, y: 0 };
  const rx = rot.x + (spinOffset * 360);
  const ry = rot.y + (spinOffset * 360);

  return `
    <div class="tk-dice-scene" id="dscene_${idx}" style="width:${sizePx}px; height:${sizePx}px; margin:6px;">
      <div class="tk-cube" style="transform: rotateX(${rx}deg) rotateY(${ry}deg); font-size:${fontPx}px;">
        <div class="tk-cube-face" style="transform: translateZ(${half}px);">1</div>
        <div class="tk-cube-face" style="transform: rotateY(90deg) translateZ(${half}px);">2</div>
        <div class="tk-cube-face" style="transform: rotateX(90deg) translateZ(${half}px);">3</div>
        <div class="tk-cube-face" style="transform: rotateX(-90deg) translateZ(${half}px);">4</div>
        <div class="tk-cube-face" style="transform: rotateY(-90deg) translateZ(${half}px);">5</div>
        <div class="tk-cube-face" style="transform: rotateY(180deg) translateZ(${half}px);">6</div>
      </div>
    </div>
  `;
}

function renderDiceBody(w, body) {
  const count = Math.min(10, Math.max(1, Number(w.data.count) || 1));
  const values = Array.isArray(w.data.values) ? w.data.values.slice(0, count) : Array(count).fill(1);
  while (values.length < count) values.push(1);
  const spins = Number(w._spins) || 0;

  const sizePx = count <= 2 ? 70 : (count <= 4 ? 56 : 44);
  const diceHtml = values.map((v, idx) => buildCubeHtml(v, sizePx, spins, `${w.id}_${idx}`)).join('');
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
        <span style="font-size:0.85em; font-weight:bold; color:#334155;">합계: <b id="dsum_${w.id}" style="color:#EF4444;">${totalSum}</b></span>
      </div>
      <div class="tk-dice-grid">${diceHtml}</div>
      <button class="tk-mini-btn warn" style="width:100%; padding:8px; font-size:0.92em;" onclick="rollDice('${w.id}')">던지기</button>
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
  w._rolling = true;
  const count = Math.min(10, Math.max(1, Number(w.data.count) || 1));
  w._spins = (Number(w._spins) || 0) + 2;
  w.data.values = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);

  const cubes = document.querySelectorAll(`#body_${id} .tk-cube`);
  const scenes = document.querySelectorAll(`#body_${id} .tk-dice-scene`);
  cubes.forEach((cube, idx) => {
    const val = w.data.values[idx];
    const rot = CUBE_FACE_ROT[val] || { x: 0, y: 0 };
    const rx = rot.x + (w._spins * 360) + (idx % 2 === 0 ? 0 : 360);
    const ry = rot.y + (w._spins * 360) + (idx % 2 === 1 ? 0 : 360);
    cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  });
  scenes.forEach(sc => {
    sc.classList.remove('bouncing');
    void sc.offsetWidth;
    sc.classList.add('bouncing');
  });

  setTimeout(() => {
    w._rolling = false;
    const sumEl = document.getElementById('dsum_' + id);
    if (sumEl) {
      sumEl.innerText = w.data.values.reduce((a, b) => a + Number(b || 0), 0);
    }
    saveToolkitState();
  }, 740);
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
  const curW = w.maximized ? window.innerWidth : w.w;
  const curH = w.maximized ? window.innerHeight : w.h;
  const size = Math.max(90, Math.min(curW - 40, curH - 120));

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

// [8] 판서/문서 에디터 (글자크기·글자색·형광펜 드롭다운 + 고정폭 공백 2칸=한글 1칸)
function renderBoardBody(w, body) {
  const fontSize = Number(w.data.fontSize) || 60;
  const isChalk = w.data.bgMode === 'chalk';

  const sizeList = [20, 24, 28, 32, 36, 42, 48, 60, 72, 84, 96];
  const sizeOpts = sizeList.map(sz =>
    `<option value="${sz}" ${fontSize === sz ? 'selected' : ''}>${sz}px</option>`
  ).join('');

  body.innerHTML = `
    <div class="tk-board-wrap ${isChalk ? 'chalk-mode' : ''}">
      <div class="tk-board-toolbar">
        <select class="tk-board-select" title="글자 크기" onchange="applyBoardFontSize('${w.id}', Number(this.value))">
          ${sizeOpts}
        </select>
        <select class="tk-board-select" title="글자 색상" onchange="if(this.value){ execBoardCmd('${w.id}', 'foreColor', this.value); this.value=''; }">
          <option value="">글자색</option>
          <option value="#1E293B">검정</option>
          <option value="#FFFFFF">흰색</option>
          <option value="#DC2626">빨강</option>
          <option value="#EA580C">주황</option>
          <option value="#CA8A04">노랑</option>
          <option value="#16A34A">초록</option>
          <option value="#2563EB">파랑</option>
          <option value="#7C3AED">보라</option>
        </select>
        <select class="tk-board-select" title="형광펜" onchange="if(this.value){ execBoardCmd('${w.id}', 'hiliteColor', this.value); this.value=''; }">
          <option value="">형광펜</option>
          <option value="#FEF08A">노랑 형광</option>
          <option value="#BBF7D0">연두 형광</option>
          <option value="#BAE6FD">하늘 형광</option>
          <option value="#FBCFE8">분홍 형광</option>
          <option value="transparent">형광펜 없음</option>
        </select>
        <button class="tk-board-btn" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'bold')"><b>굵게</b></button>
        <button class="tk-board-btn" onmousedown="event.preventDefault(); execBoardCmd('${w.id}', 'underline')"><u>밑줄</u></button>
        <button class="tk-board-btn" onclick="toggleBoardBg('${w.id}')">${isChalk ? '화이트' : '칠판'}</button>
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

function applyBoardFontSize(id, sizePx) {
  const ed = document.getElementById('board_ed_' + id);
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!ed || !w) return;

  const sel = window.getSelection();
  // 드래그 선택된 텍스트가 있으면 해당 영역만 px 적용, 없으면 에디터 기본 크기 변경
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed && ed.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = sizePx + 'px';
    try {
      range.surroundContents(span);
    } catch (e) {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    w.data.html = ed.innerHTML;
    saveToolkitState();
  } else {
    w.data.fontSize = sizePx;
    saveToolkitState();
    renderWidgetBody(w);
  }
}

function toggleBoardBg(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.bgMode = w.data.bgMode === 'chalk' ? 'white' : 'chalk';
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

// ==========================================
// [9] 랜덤 뽑기 (결석생·중복 제외)
// ==========================================
function renderPickBody(w, body) {
  const excluded = w.data.excluded || [];
  const picked = w.data.picked || [];
  const noDup = w.data.noDup !== false;

  const activeList = tkStudents.filter(s => !excluded.includes(s.name));
  const pool = noDup ? activeList.filter(s => !picked.includes(s.name)) : activeList;

  const winnerObj = tkStudents.find(s => s.name === w.data.lastWinner);
  const avatarUrl = winnerObj ? getStudentAvatarUrl(winnerObj) : '';
  const titleText = (winnerObj && winnerObj.equipped_title) ? winnerObj.equipped_title : '';

  const chipsHtml = tkStudents.map(s => {
    const isEx = excluded.includes(s.name);
    return `<span class="tk-chip ${isEx ? 'excluded' : ''}" onclick="toggleExcludedStudent('${w.id}', '${escapeTkHtml(s.name)}')">${escapeTkHtml(s.name)}</span>`;
  }).join('');

  body.innerHTML = `
    <div style="width:100%; height:100%; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid #E2E8F0; gap:6px; flex-wrap:wrap;">
        <label style="font-size:0.78em; font-weight:bold; display:flex; align-items:center; gap:4px; cursor:pointer;">
          <input type="checkbox" ${noDup ? 'checked' : ''} onchange="togglePickNoDup('${w.id}', this.checked)"> 중복 제외
        </label>
        <div style="display:flex; gap:4px; align-items:center;">
          <span style="font-size:0.75em; color:#64748B;">남은 인원: <b>${pool.length}/${activeList.length}</b></span>
          <button class="tk-mini-btn" onclick="toggleWidgetFilter('${w.id}')">결석제외</button>
          <button class="tk-mini-btn" onclick="resetPickHistory('${w.id}')">초기화</button>
        </div>
      </div>
      ${w.data.showFilter ? `<div class="tk-sub-panel"><b>클릭하여 결석생 제외/복귀:</b><div class="tk-chip-grid">${chipsHtml}</div></div>` : ''}
      <div class="tk-pick-stage">
        ${winnerObj
          ? `<img id="pick_img_${w.id}" class="tk-pick-avatar" src="${escapeTkHtml(avatarUrl)}">
             ${titleText ? `<div style="font-size:0.8em; color:#D97706; font-weight:bold;">${escapeTkHtml(titleText)}</div>` : ''}
             <div id="pick_name_${w.id}" class="tk-pick-name">${escapeTkHtml(winnerObj.name)}</div>`
          : `<div id="pick_name_${w.id}" class="tk-pick-name" style="color:#94A3B8; font-size:1.1em;">${tkStudents.length ? '뽑기 버튼을 눌러주세요' : '학생 데이터 불러오는 중...'}</div>`
        }
      </div>
      <div style="padding:8px 10px; border-top:1px solid #E2E8F0;">
        <button class="tk-mini-btn primary" style="width:100%; padding:9px; font-size:0.95em;" onclick="runRandomPick('${w.id}')">뽑기!</button>
      </div>
    </div>
  `;
}

function toggleExcludedStudent(id, name) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.excluded = w.data.excluded || [];
  const idx = w.data.excluded.indexOf(name);
  if (idx > -1) w.data.excluded.splice(idx, 1);
  else w.data.excluded.push(name);
  saveToolkitState();
  renderWidgetBody(w);
}

function toggleWidgetFilter(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.showFilter = !w.data.showFilter;
  saveToolkitState();
  renderWidgetBody(w);
}

function togglePickNoDup(id, checked) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.noDup = checked;
  saveToolkitState();
  renderWidgetBody(w);
}

function resetPickHistory(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.picked = [];
  w.data.lastWinner = '';
  saveToolkitState();
  renderWidgetBody(w);
}

function runRandomPick(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || w._picking || tkStudents.length === 0) return;

  const excluded = w.data.excluded || [];
  const noDup = w.data.noDup !== false;
  let picked = w.data.picked || [];
  const activeList = tkStudents.filter(s => !excluded.includes(s.name));
  if (activeList.length === 0) return;

  let pool = noDup ? activeList.filter(s => !picked.includes(s.name)) : activeList;
  if (pool.length === 0) {
    picked = [];
    w.data.picked = [];
    pool = activeList;
  }

  w._picking = true;
  let ticks = 0;
  const spin = setInterval(() => {
    const temp = pool[Math.floor(Math.random() * pool.length)];
    w.data.lastWinner = temp.name;
    renderWidgetBody(w);
    ticks++;
    if (ticks >= 10) {
      clearInterval(spin);
      const finalWinner = pool[Math.floor(Math.random() * pool.length)];
      w.data.lastWinner = finalWinner.name;
      if (noDup && !w.data.picked.includes(finalWinner.name)) {
        w.data.picked.push(finalWinner.name);
      }
      w._picking = false;
      saveToolkitState();
      renderWidgetBody(w);
    }
  }, 60);
}

// ==========================================
// [10] 뽑기 레이스 (아바타 달리기 경주)
// ==========================================
function renderRaceBody(w, body) {
  const excluded = w.data.excluded || [];
  const runners = tkStudents.filter(s => !excluded.includes(s.name));

  const chipsHtml = tkStudents.map(s => {
    const isEx = excluded.includes(s.name);
    return `<span class="tk-chip ${isEx ? 'excluded' : ''}" onclick="toggleExcludedStudent('${w.id}', '${escapeTkHtml(s.name)}')">${escapeTkHtml(s.name)}</span>`;
  }).join('');

  const lanesHtml = runners.map((s, idx) => `
    <div class="tk-race-lane">
      <div class="tk-race-name">${escapeTkHtml(s.name)}</div>
      <div class="tk-race-road">
        <div class="tk-race-finish"></div>
        <div class="tk-race-runner" id="runner_${w.id}_${idx}" style="left:1%;">
          <img src="${escapeTkHtml(getStudentAvatarUrl(s))}">
        </div>
      </div>
    </div>
  `).join('');

  body.innerHTML = `
    <div style="width:100%; height:100%; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid #E2E8F0; gap:6px;">
        <span style="font-size:0.8em; font-weight:bold; color:#334155;">참가: ${runners.length}명 ${w.data.winner ? `| 1등: <b style="color:#EF4444;">${escapeTkHtml(w.data.winner)}</b>` : ''}</span>
        <div style="display:flex; gap:4px;">
          <button class="tk-mini-btn" onclick="toggleWidgetFilter('${w.id}')">결석제외</button>
          <button class="tk-mini-btn warn" onclick="startRace('${w.id}')">출발!</button>
        </div>
      </div>
      ${w.data.showFilter ? `<div class="tk-sub-panel"><b>클릭하여 결석생 제외/복귀:</b><div class="tk-chip-grid">${chipsHtml}</div></div>` : ''}
      <div class="tk-race-track">${lanesHtml || '<div style="text-align:center; color:#94A3B8; padding-top:30px;">참가자가 없습니다.</div>'}</div>
    </div>
  `;
}

function startRace(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || w._racing) return;
  const excluded = w.data.excluded || [];
  const runners = tkStudents.filter(s => !excluded.includes(s.name));
  if (runners.length === 0) return;

  w._racing = true;
  w.data.winner = '';
  const pos = Array(runners.length).fill(1);

  const raceInterval = setInterval(() => {
    let winnerName = '';
    for (let i = 0; i < runners.length; i++) {
      // 랜덤 가속 + 가끔 부스터
      const boost = Math.random() < 0.12 ? 2.4 : 0;
      pos[i] += (Math.random() * 2.2) + 0.4 + boost;
      const el = document.getElementById(`runner_${id}_${i}`);
      if (el) {
        el.style.left = Math.min(92, pos[i]) + '%';
      }
      if (pos[i] >= 92 && !winnerName) {
        winnerName = runners[i].name;
      }
    }
    if (winnerName) {
      clearInterval(raceInterval);
      w._racing = false;
      w.data.winner = winnerName;
      saveToolkitState();
      // 순위 보존을 위해 상단 텍스트만 갱신 (레인 위치 유지)
      const headerSpan = document.querySelector(`#body_${id} span`);
      if (headerSpan) {
        headerSpan.innerHTML = `참가: ${runners.length}명 | 1등: <b style="color:#EF4444;">${escapeTkHtml(winnerName)}</b>`;
      }
    }
  }, 55);
}

// ==========================================
// [11] 돌림판 (커스텀 + 학생 명단)
// ==========================================
const WHEEL_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function getWheelPointerIndex(angleDeg, itemCount) {
  if (!itemCount) return -1;
  const sliceDeg = 360 / itemCount;
  const pointerAngle = (270 - (angleDeg % 360) + 360) % 360;
  return Math.floor(pointerAngle / sliceDeg) % itemCount;
}

function renderWheelBody(w, body) {
  const items = String(w.data.itemsText || '').split('\n').map(x => x.trim()).filter(Boolean);
  const curW = w.maximized ? window.innerWidth : w.w;
  const curH = w.maximized ? window.innerHeight : w.h;
  const size = Math.max(140, Math.min(curW - 40, curH - (w.data.showEdit ? 320 : 215)));
  const angle = Number(w.data.angle) || 0;
  const curIdx = getWheelPointerIndex(angle, items.length);
  const curLabel = curIdx >= 0 ? items[curIdx] : '-';
  const curColor = curIdx >= 0 ? WHEEL_COLORS[curIdx % WHEEL_COLORS.length] : '#334155';

  body.innerHTML = `
    <div style="width:100%; height:100%; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid #E2E8F0; gap:6px;">
        <span style="font-size:0.8em; font-weight:bold; color:#334155;">${w.data.winner ? `결과: <b style="color:#EF4444;">${escapeTkHtml(w.data.winner)}</b>` : `항목 ${items.length}개`}</span>
        <div style="display:flex; gap:4px;">
          <button class="tk-mini-btn" onclick="loadStudentsToWheel('${w.id}')">명단불러오기</button>
          <button class="tk-mini-btn" onclick="toggleWheelEdit('${w.id}')">항목편집</button>
        </div>
      </div>
      ${w.data.showEdit ? `
        <div class="tk-sub-panel">
          <textarea id="whl_txt_${w.id}" rows="4" placeholder="줄바꿈으로 항목 구분"
            style="width:100%; padding:6px; border:1px solid #CBD5E1; border-radius:6px; font-size:0.95em; resize:vertical;">${escapeTkHtml(w.data.itemsText || '')}</textarea>
          <button class="tk-mini-btn primary" style="margin-top:4px; width:100%;" onclick="saveWheelItems('${w.id}')">적용</button>
        </div>
      ` : ''}
      <div class="tk-wheel-stage">
        <div id="whl_live_${w.id}" class="tk-wheel-live" style="background:${curColor};">${escapeTkHtml(curLabel)}</div>
        <div class="tk-wheel-pointer">▼</div>
        <canvas id="whl_cv_${w.id}" class="tk-wheel-canvas" width="${size}" height="${size}" style="transform:rotate(${angle}deg);"></canvas>
      </div>
      <div style="padding:8px 10px; border-top:1px solid #E2E8F0;">
        <button class="tk-mini-btn warn" style="width:100%; padding:8px; font-size:0.95em;" onclick="spinWheel('${w.id}')">돌리기!</button>
      </div>
    </div>
  `;

  drawWheelCanvas(w.id, items, size);
}

function drawWheelCanvas(id, items, size) {
  const cv = document.getElementById('whl_cv_' + id);
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const r = cx - 4;
  ctx.clearRect(0, 0, size, size);

  if (!items || items.length === 0) return;
  const slice = (Math.PI * 2) / items.length;

  items.forEach((label, i) => {
    const start = i * slice;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(10, Math.min(16, Math.floor(r / (items.length > 14 ? 9 : 6))))}px NanumSquareNeo, sans-serif`;
    ctx.fillText(label.slice(0, 10), r - 10, 5);
    ctx.restore();
  });
}

function toggleWheelEdit(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.showEdit = !w.data.showEdit;
  saveToolkitState();
  renderWidgetBody(w);
}

function saveWheelItems(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  const ta = document.getElementById('whl_txt_' + id);
  if (!w || !ta) return;
  w.data.itemsText = ta.value;
  w.data.winner = '';
  saveToolkitState();
  renderWidgetBody(w);
}

function loadStudentsToWheel(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || tkStudents.length === 0) return;
  w.data.itemsText = tkStudents.map(s => s.name).join('\n');
  w.data.winner = '';
  saveToolkitState();
  renderWidgetBody(w);
}

function spinWheel(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || w._spinning) return;
  const items = String(w.data.itemsText || '').split('\n').map(x => x.trim()).filter(Boolean);
  if (items.length === 0) return;

  w._spinning = true;
  const extraDeg = 1440 + Math.floor(Math.random() * 1440);
  w.data.angle = (Number(w.data.angle) || 0) + extraDeg;

  const cv = document.getElementById('whl_cv_' + id);
  if (cv) cv.style.transform = `rotate(${w.data.angle}deg)`;

  // 회전 중 매 프레임 12시 방향 화살표가 가리키는 항목을 실시간 표시
  let rafId = null;
  const trackPointer = () => {
    if (!w._spinning) return;
    const liveEl = document.getElementById('whl_live_' + id);
    const canvasEl = document.getElementById('whl_cv_' + id);
    if (liveEl && canvasEl) {
      const tr = getComputedStyle(canvasEl).transform;
      if (tr && tr !== 'none') {
        const vals = tr.split('(')[1].split(')')[0].split(',');
        const a = parseFloat(vals[0]);
        const b = parseFloat(vals[1]);
        const curDeg = (Math.atan2(b, a) * (180 / Math.PI) + 360) % 360;
        const idx = getWheelPointerIndex(curDeg, items.length);
        if (idx >= 0) {
          liveEl.innerText = items[idx];
          liveEl.style.background = WHEEL_COLORS[idx % WHEEL_COLORS.length];
        }
      }
    }
    rafId = requestAnimationFrame(trackPointer);
  };
  rafId = requestAnimationFrame(trackPointer);

  setTimeout(() => {
    cancelAnimationFrame(rafId);
    const winIdx = getWheelPointerIndex(w.data.angle, items.length);
    w.data.winner = items[winIdx];
    w._spinning = false;
    saveToolkitState();
    renderWidgetBody(w);
  }, 4050);
}

// ==========================================
// [12] 자리 바꾸기 (분단/일자 · 8줄 · 고정원 · 클릭/드래그 스왑 · 순차공개 · PNG)
// ==========================================
const seatRevealRuntime = {};

function getSeatDimensions(data) {
  const mode = data.layoutMode === 'line' ? 'line' : 'group';
  const groups = Math.min(4, Math.max(1, Number(data.groupCount) || 3));
  const lines = Math.min(8, Math.max(1, Number(data.lineCount) || 5));
  const rows = Math.min(8, Math.max(1, Number(data.rowCount) || 6));
  const cols = mode === 'group' ? groups * 2 : lines;
  return { mode, groups, lines, rows, cols, total: cols * rows };
}

function syncSeatData(w) {
  const d = w.data;
  if (!d.layoutMode) d.layoutMode = 'group';
  if (!d.groupCount) d.groupCount = 3;
  if (!d.lineCount) d.lineCount = 5;
  if (!d.rowCount) d.rowCount = Math.min(8, Math.max(4, Math.ceil((tkStudents.length || 24) / (d.layoutMode === 'group' ? d.groupCount * 2 : d.lineCount))));
  if (!d.revealMode) d.revealMode = 'instant';

  const dim = getSeatDimensions(d);
  const allNames = tkStudents.map(s => s.name);

  if (!Array.isArray(d.seats) || !Array.isArray(d.activeSeats)) {
    d.seats = Array(dim.total).fill('');
    d.activeSeats = Array(dim.total).fill(false);
    d.lockedIdx = [];
  }

  // 격자 크기 변경 시 기존 자리 정보 길이에 맞게 재정렬
  if (d.seats.length !== dim.total || d.activeSeats.length !== dim.total) {
    const prevNames = d.seats.filter(Boolean);
    const nextSeats = Array(dim.total).fill('');
    const nextActive = Array(dim.total).fill(false);
    const nextLocked = [];

    for (let i = 0; i < dim.total; i++) {
      if (i < d.activeSeats.length) nextActive[i] = Boolean(d.activeSeats[i]);
      if (i < d.seats.length && d.seats[i] && allNames.includes(d.seats[i])) {
        nextSeats[i] = d.seats[i];
        nextActive[i] = true;
        if ((d.lockedIdx || []).includes(i)) nextLocked.push(i);
      }
    }

    // 축소로 빠졌거나 새로 추가된 학생을 빈 활성 칸/점선 칸에 배치
    const placedSet = new Set(nextSeats.filter(Boolean));
    const missing = allNames.filter(n => !placedSet.has(n));
    for (const mName of missing) {
      let target = nextActive.findIndex((act, idx) => act && !nextSeats[idx]);
      if (target === -1) target = nextSeats.findIndex(v => !v);
      if (target > -1) {
        nextSeats[target] = mName;
        nextActive[target] = true;
      }
    }

    d.seats = nextSeats;
    d.activeSeats = nextActive;
    d.lockedIdx = nextLocked;
  } else if (allNames.length > 0 && d.seats.filter(Boolean).length === 0) {
    for (let i = 0; i < Math.min(dim.total, allNames.length); i++) {
      d.seats[i] = allNames[i];
      d.activeSeats[i] = true;
    }
  } else {
    // 명단 동기화 (제거된 학생 비우고 새 학생 추가)
    const validSet = new Set(allNames);
    for (let i = 0; i < d.seats.length; i++) {
      if (d.seats[i] && !validSet.has(d.seats[i])) {
        d.seats[i] = '';
      }
    }
    const placed = new Set(d.seats.filter(Boolean));
    allNames.filter(n => !placed.has(n)).forEach(n => {
      let target = d.activeSeats.findIndex((act, idx) => act && !d.seats[idx]);
      if (target === -1) target = d.seats.findIndex(v => !v);
      if (target > -1) {
        d.seats[target] = n;
        d.activeSeats[target] = true;
      }
    });
  }
}

function getSeatGridTemplate(dim) {
  const parts = [];
  if (dim.mode === 'group') {
    for (let g = 0; g < dim.groups; g++) {
      parts.push('1fr', '1fr');
      if (g < dim.groups - 1) parts.push('18px');
    }
  } else {
    for (let l = 0; l < dim.lines; l++) {
      parts.push('1fr');
      if (l < dim.lines - 1) parts.push('16px');
    }
  }
  return parts.join(' ');
}

function renderSeatBody(w, body) {
  syncSeatData(w);
  const d = w.data;
  const dim = getSeatDimensions(d);
  const locked = d.lockedIdx || [];
  const rt = seatRevealRuntime[w.id];
  const isRevealing = Boolean(rt && rt.active);

  const countOpts = d.layoutMode === 'group'
    ? [1, 2, 3, 4].map(n => `<option value="${n}" ${dim.groups === n ? 'selected' : ''}>${n}분단</option>`).join('')
    : [1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}" ${dim.lines === n ? 'selected' : ''}>${n}줄</option>`).join('');

  const rowOpts = [1, 2, 3, 4, 5, 6, 7, 8].map(n =>
    `<option value="${n}" ${dim.rows === n ? 'selected' : ''}>앞뒤 ${n}줄</option>`
  ).join('');

  const unplacedCount = Math.max(0, tkStudents.length - d.seats.filter(Boolean).length);
  const templateCols = getSeatGridTemplate(dim);

  let gridHtml = '';
  for (let r = 0; r < dim.rows; r++) {
    for (let c = 0; c < dim.cols; c++) {
      const idx = r * dim.cols + c;
      const isActive = Boolean(d.activeSeats[idx]);
      const name = d.seats[idx] || '';
      const isLocked = locked.includes(idx);
      const isSelected = w._selectedSeatIdx === idx;
      const isHidden = isRevealing && name && !isLocked && !rt.revealed.has(idx);

      if (!isActive) {
        gridHtml += `
          <div class="tk-seat-card inactive"
               onclick="activateSeatSlot('${w.id}', ${idx})"
               ondragover="handleSeatDragOver(event, this)"
               ondragleave="handleSeatDragLeave(this)"
               ondrop="handleSeatDrop(event, '${w.id}', ${idx})"
               title="클릭하거나 학생을 끌어와 책상 활성화">
            + 빈 자리
          </div>
        `;
      } else {
        gridHtml += `
          <div class="tk-seat-card ${isSelected ? 'selected' : ''} ${isHidden ? 'concealed' : ''}"
               draggable="${name && !isRevealing ? 'true' : 'false'}"
               ondragstart="handleSeatDragStart(event, '${w.id}', ${idx})"
               ondragover="handleSeatDragOver(event, this)"
               ondragleave="handleSeatDragLeave(this)"
               ondrop="handleSeatDrop(event, '${w.id}', ${idx})"
               onclick="handleSeatClick('${w.id}', ${idx})">
            ${!name && !isRevealing ? `<button class="tk-seat-deact-btn" onclick="event.stopPropagation(); deactivateSeatSlot('${w.id}', ${idx})" title="점선 빈 자리로 변경">&times;</button>` : ''}
            <button class="tk-seat-pin-dot ${isLocked ? 'locked' : ''}" onclick="event.stopPropagation(); toggleSeatLock('${w.id}', ${idx})" title="고정석 설정/해제"></button>
            <b>${isHidden ? '?' : (name ? escapeTkHtml(name) : '<span style="color:#94A3B8; font-weight:normal; font-size:0.85em;">빈 책상</span>')}</b>
          </div>
        `;
      }

      // 복도 스페이서 삽입
      if (dim.mode === 'group') {
        if (c % 2 === 1 && c < dim.cols - 1) gridHtml += '<div class="tk-seat-aisle"></div>';
      } else {
        if (c < dim.cols - 1) gridHtml += '<div class="tk-seat-aisle"></div>';
      }
    }
  }

  body.innerHTML = `
    <div class="tk-seat-wrap">
      <div class="tk-seat-toolbar">
        <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
          <select class="tk-board-select" onchange="setSeatLayoutMode('${w.id}', this.value)">
            <option value="group" ${dim.mode === 'group' ? 'selected' : ''}>분단형</option>
            <option value="line" ${dim.mode === 'line' ? 'selected' : ''}>일자형</option>
          </select>
          <select class="tk-board-select" onchange="setSeatLayoutCount('${w.id}', Number(this.value))">${countOpts}</select>
          <select class="tk-board-select" onchange="setSeatRowCount('${w.id}', Number(this.value))">${rowOpts}</select>
          <select class="tk-board-select" onchange="setSeatRevealMode('${w.id}', this.value)">
            <option value="instant" ${d.revealMode === 'instant' ? 'selected' : ''}>즉시 공개</option>
            <option value="all" ${d.revealMode === 'all' ? 'selected' : ''}>한 번에(3·2·1)</option>
            <option value="seq" ${d.revealMode === 'seq' ? 'selected' : ''}>순차 공개(3·2·1)</option>
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:5px;">
          <button class="tk-mini-btn primary" onclick="shuffleSeats('${w.id}')">${isRevealing ? '공개 중...' : '자리 섞기'}</button>
          <button class="tk-mini-btn" onclick="exportSeatsToPng('${w.id}')">PNG 저장</button>
        </div>
      </div>
      ${unplacedCount > 0 ? `<div style="background:#FEE2E2; color:#B91C1C; font-size:0.78em; font-weight:bold; padding:4px 10px; text-align:center;">좌석 수가 부족해 ${unplacedCount}명이 배치되지 않았습니다. 분단/줄 수를 늘려주세요.</div>` : ''}
      <div class="tk-seat-board">
        <div class="tk-seat-front">칠판 / 교탁 (앞)</div>
        <div class="tk-seat-grid" style="grid-template-columns:${templateCols};">
          ${tkStudents.length ? gridHtml : '<div style="grid-column:1/-1; text-align:center; color:#64748B; padding:24px;">학생 데이터 불러오는 중...</div>'}
        </div>
      </div>
      ${(rt && rt.countdown) ? `<div class="tk-seat-countdown">${rt.countdown}</div>` : ''}
    </div>
  `;
}

function clearSeatRevealTimer(id) {
  const rt = seatRevealRuntime[id];
  if (rt) {
    (rt.timers || []).forEach(t => clearTimeout(t));
    delete seatRevealRuntime[id];
  }
}

function setSeatLayoutMode(id, mode) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  clearSeatRevealTimer(id);
  w._selectedSeatIdx = null;
  w.data.layoutMode = mode;
  saveToolkitState();
  renderWidgetBody(w);
}

function setSeatLayoutCount(id, val) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  clearSeatRevealTimer(id);
  w._selectedSeatIdx = null;
  if (w.data.layoutMode === 'line') w.data.lineCount = val;
  else w.data.groupCount = val;
  saveToolkitState();
  renderWidgetBody(w);
}

function setSeatRowCount(id, rows) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  clearSeatRevealTimer(id);
  w._selectedSeatIdx = null;
  w.data.rowCount = rows;
  saveToolkitState();
  renderWidgetBody(w);
}

function setSeatRevealMode(id, mode) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.revealMode = mode;
  saveToolkitState();
}

function activateSeatSlot(id, idx) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.activeSeats[idx] = true;
  saveToolkitState();
  renderWidgetBody(w);
}

function deactivateSeatSlot(id, idx) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || w.data.seats[idx]) return;
  w.data.activeSeats[idx] = false;
  w.data.lockedIdx = (w.data.lockedIdx || []).filter(i => i !== idx);
  if (w._selectedSeatIdx === idx) w._selectedSeatIdx = null;
  saveToolkitState();
  renderWidgetBody(w);
}

function toggleSeatLock(id, idx) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.lockedIdx = w.data.lockedIdx || [];
  const pos = w.data.lockedIdx.indexOf(idx);
  if (pos > -1) w.data.lockedIdx.splice(pos, 1);
  else w.data.lockedIdx.push(idx);
  saveToolkitState();
  renderWidgetBody(w);
}

function swapTwoSeats(w, idxA, idxB) {
  if (idxA === idxB) return;
  w.data.activeSeats[idxA] = true;
  w.data.activeSeats[idxB] = true;
  const tmp = w.data.seats[idxA];
  w.data.seats[idxA] = w.data.seats[idxB];
  w.data.seats[idxB] = tmp;
  saveToolkitState();
}

function handleSeatClick(id, idx) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || (seatRevealRuntime[id] && seatRevealRuntime[id].active)) return;

  if (w._selectedSeatIdx === undefined || w._selectedSeatIdx === null) {
    if (!w.data.seats[idx]) return;
    w._selectedSeatIdx = idx;
    renderWidgetBody(w);
    return;
  }

  if (w._selectedSeatIdx === idx) {
    w._selectedSeatIdx = null;
    renderWidgetBody(w);
    return;
  }

  swapTwoSeats(w, w._selectedSeatIdx, idx);
  w._selectedSeatIdx = null;
  renderWidgetBody(w);
}

function handleSeatDragStart(e, id, idx) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ id, idx }));
}

function handleSeatDragOver(e, el) {
  e.preventDefault();
  el.classList.add('drag-over');
}

function handleSeatDragLeave(el) {
  el.classList.remove('drag-over');
}

function handleSeatDrop(e, targetWidgetId, targetIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  try {
    const payload = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
    if (payload.id !== targetWidgetId) return;
    const w = toolkitState.widgets.find(x => x.id === targetWidgetId);
    if (!w || payload.idx === undefined) return;
    swapTwoSeats(w, payload.idx, targetIdx);
    w._selectedSeatIdx = null;
    renderWidgetBody(w);
  } catch (err) {
    console.error('드래그 자리 이동 오류:', err);
  }
}

function shuffleSeats(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || tkStudents.length === 0) return;
  if (seatRevealRuntime[id] && seatRevealRuntime[id].active) return;

  syncSeatData(w);
  const d = w.data;
  const lockedSet = new Set(d.lockedIdx || []);

  // 고정되지 않은 학생 명단 수집
  const fixedNames = new Set();
  lockedSet.forEach(idx => {
    if (d.seats[idx]) fixedNames.add(d.seats[idx]);
  });
  const freeStudents = tkStudents.map(s => s.name).filter(n => !fixedNames.has(n));

  // 고정되지 않은 활성 책상 수집 (부족하면 점선 빈 자리를 앞에서부터 활성화)
  let freeSlots = [];
  d.activeSeats.forEach((act, idx) => {
    if (act && !lockedSet.has(idx)) freeSlots.push(idx);
  });
  if (freeSlots.length < freeStudents.length) {
    for (let i = 0; i < d.activeSeats.length && freeSlots.length < freeStudents.length; i++) {
      if (!d.activeSeats[i] && !lockedSet.has(i)) {
        d.activeSeats[i] = true;
        freeSlots.push(i);
      }
    }
  }

  // Fisher-Yates 셔플
  for (let i = freeStudents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [freeStudents[i], freeStudents[j]] = [freeStudents[j], freeStudents[i]];
  }

  freeSlots.forEach((slotIdx, i) => {
    d.seats[slotIdx] = freeStudents[i] || '';
  });

  w._selectedSeatIdx = null;
  saveToolkitState();

  const revealMode = d.revealMode || 'instant';
  if (revealMode === 'instant') {
    renderWidgetBody(w);
    return;
  }

  // 3, 2, 1 카운트다운 후 한 번에 또는 순차 공개
  const revealTargets = freeSlots.filter(idx => Boolean(d.seats[idx]));
  if (revealTargets.length === 0) {
    renderWidgetBody(w);
    return;
  }

  const rt = { active: true, countdown: 3, revealed: new Set(), timers: [] };
  seatRevealRuntime[id] = rt;
  renderWidgetBody(w);

  rt.timers.push(setTimeout(() => { rt.countdown = 2; renderWidgetBody(w); }, 750));
  rt.timers.push(setTimeout(() => { rt.countdown = 1; renderWidgetBody(w); }, 1500));
  rt.timers.push(setTimeout(() => {
    rt.countdown = 0;
    if (revealMode === 'all') {
      rt.active = false;
      delete seatRevealRuntime[id];
      renderWidgetBody(w);
    } else {
      renderWidgetBody(w);
      revealTargets.forEach((slotIdx, step) => {
        rt.timers.push(setTimeout(() => {
          rt.revealed.add(slotIdx);
          if (step === revealTargets.length - 1) {
            rt.active = false;
            delete seatRevealRuntime[id];
          }
          renderWidgetBody(w);
        }, (step + 1) * 320));
      });
    }
  }, 2250));
}

function exportSeatsToPng(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  syncSeatData(w);
  const d = w.data;
  const dim = getSeatDimensions(d);

  const canvas = document.createElement('canvas');
  const padX = 50;
  const padTop = 120;
  const cardW = 140;
  const cardH = 68;
  const gapY = 14;
  const gapPair = 10;
  const gapAisle = 34;

  // 열별 X좌표 계산
  const colXs = [];
  let curX = padX;
  for (let c = 0; c < dim.cols; c++) {
    colXs.push(curX);
    curX += cardW;
    if (c < dim.cols - 1) {
      if (dim.mode === 'group') curX += (c % 2 === 1 ? gapAisle : gapPair);
      else curX += gapAisle;
    }
  }

  canvas.width = curX + padX;
  canvas.height = padTop + dim.rows * cardH + (dim.rows - 1) * gapY + 50;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 상단 제목 및 교탁
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px NanumSquareNeo, sans-serif';
  ctx.textAlign = 'center';
  const today = new Date().toISOString().slice(0, 10);
  ctx.fillText(`학급 자리 배치표 (${today})`, canvas.width / 2, 42);

  const deskW = Math.min(460, canvas.width * 0.45);
  ctx.fillStyle = '#143D2B';
  ctx.fillRect((canvas.width - deskW) / 2, 60, deskW, 38);
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 3;
  ctx.strokeRect((canvas.width - deskW) / 2, 60, deskW, 38);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px NanumSquareNeo, sans-serif';
  ctx.fillText('칠판 / 교탁 (앞)', canvas.width / 2, 85);

  // 책상 그리기
  for (let r = 0; r < dim.rows; r++) {
    const y = padTop + r * (cardH + gapY);
    for (let c = 0; c < dim.cols; c++) {
      const idx = r * dim.cols + c;
      const x = colXs[c];
      const isActive = Boolean(d.activeSeats[idx]);
      const name = d.seats[idx] || '';

      ctx.save();
      if (isActive) {
        ctx.setLineDash([]);
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeRect(x, y, cardW, cardH);

        if (name) {
          ctx.fillStyle = '#0F172A';
          ctx.font = 'bold 22px NanumSquareNeo, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, x + cardW / 2, y + cardH / 2);
        }
      } else {
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cardW, cardH);
      }
      ctx.restore();
    }
  }

  const link = document.createElement('a');
  link.download = `학급_자리배치표_${today}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function escapeTkHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}