// ==========================================
// [1] 시계
// ==========================================
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

// ==========================================
// [2] 타이머 & 스톱워치 (밀리세컨드 단위 지원)
// ==========================================
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

// ==========================================
// [3] 포스트잇 메모 (다중 생성 + 글자 크기 드롭다운)
// ==========================================
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

// ==========================================
// [4] 디데이
// ==========================================
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

// ==========================================
// [5] 체크리스트
// ==========================================
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

// ==========================================
// [6] 3D 정육면체 주사위 (최대 10개 + 3축 구르기)
// ==========================================
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

// ==========================================
// [7] QR 코드
// ==========================================
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

// ==========================================
// [8] 판서/문서 에디터 (글자크기·글자색·형광펜 드롭다운 + 고정폭 공백 2칸=한글 1칸)
// ==========================================
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