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
  savedData: {},
  savedLayout: {},
  seatSlots: [],
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
      if (!toolkitState.savedData) toolkitState.savedData = {};
      if (!toolkitState.savedLayout) toolkitState.savedLayout = {};
      if (!Array.isArray(toolkitState.seatSlots)) toolkitState.seatSlots = [];
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
    savedData: {},
    savedLayout: {},
    seatSlots: [],
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

  // 현재 설정(글자 크기 배율·테마)과 저장된 슬롯/단일 위젯 데이터는 보존하고 창 배치만 초기화
  const curSettings = toolkitState.settings || { fontScale: 3, theme: 'indigo' };
  const curSavedData = toolkitState.savedData || {};
  const curSeatSlots = toolkitState.seatSlots || [];

  // 현재 열려 있던 단일 위젯 데이터도 보존
  toolkitState.widgets.forEach(w => {
    if (w.type !== 'memo' && w.type !== 'board') {
      curSavedData[w.type] = JSON.parse(JSON.stringify(w.data || {}));
    }
  });

  const scale = FONT_SCALE_MAP[curSettings.fontScale] || 1.25;
  const clkH = Math.round(170 * scale);

  toolkitState = {
    topZ: 12,
    settings: curSettings,
    savedData: curSavedData,
    savedLayout: {},
    seatSlots: curSeatSlots,
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
  const savedLayout = (toolkitState.savedLayout && toolkitState.savedLayout[type]) || null;
  const savedData = (toolkitState.savedData && toolkitState.savedData[type]) || null;

  toolkitState.topZ += 1;
  toolkitState.widgets.push({
    id: type,
    type: type,
    title: cfg.title,
    x: savedLayout ? savedLayout.x : (40 + offset),
    y: savedLayout ? savedLayout.y : (40 + offset),
    w: savedLayout ? savedLayout.w : Math.round(cfg.w * scale),
    h: savedLayout ? savedLayout.h : Math.round(cfg.h * scale),
    z: toolkitState.topZ,
    data: savedData ? JSON.parse(JSON.stringify(savedData)) : cfg.data
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
  const target = toolkitState.widgets.find(w => w.id === id);
  if (target && target.type !== 'memo' && target.type !== 'board') {
    if (!toolkitState.savedData) toolkitState.savedData = {};
    if (!toolkitState.savedLayout) toolkitState.savedLayout = {};
    toolkitState.savedData[target.type] = JSON.parse(JSON.stringify(target.data || {}));
    toolkitState.savedLayout[target.type] = { x: target.x, y: target.y, w: target.w, h: target.h };
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

// 기본 위젯 구현부는 js_toolkit_basic.js로 분리됨

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

// 명단 연동 및 학급 활동 위젯 구현부는 js_toolkit_class.js로 분리됨

function escapeTkHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}