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
// [10] 지그재그 핀볼 레이스 (Matter.js 2D 물리 엔진 + 구슬 + 이름표)
// ==========================================
const pinballRuntime = {};
const PINBALL_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#EC4899', '#F43F5E', '#84CC16', '#14B8A6', '#0EA5E9', '#A855F7', '#D946EF', '#FB7185'
];
const PINBALL_W = 720;
const PINBALL_H = 2600;
const PINBALL_FINISH_Y = 2470;

function stopPinballRace(id) {
  const rt = pinballRuntime[id];
  if (!rt) return;
  if (rt.rafId) cancelAnimationFrame(rt.rafId);
  if (rt.engine && typeof Matter !== 'undefined') {
    Matter.World.clear(rt.engine.world, false);
    Matter.Engine.clear(rt.engine);
  }
  delete pinballRuntime[id];
}

function getPinballParticipants(w) {
  const excluded = w.data.excluded || [];
  const weights = w.data.weights || {};
  const list = [];
  let colorIdx = 0;

  tkStudents.forEach(s => {
    if (excluded.includes(s.name)) return;
    const count = Math.min(5, Math.max(1, Number(weights[s.name]) || 1));
    const color = PINBALL_COLORS[colorIdx % PINBALL_COLORS.length];
    colorIdx++;
    for (let k = 0; k < count; k++) {
      list.push({ name: s.name, color: color });
    }
  });
  return list;
}

function cycleStudentWeight(id, name, e) {
  if (e) e.stopPropagation();
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || (pinballRuntime[id] && pinballRuntime[id].running)) return;
  if (!w.data.weights) w.data.weights = {};
  const cur = Number(w.data.weights[name]) || 1;
  w.data.weights[name] = cur >= 5 ? 1 : cur + 1;
  saveToolkitState();
  renderWidgetBody(w);
}

function setPinballTargetRank(id, rank) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.targetRank = rank;
  saveToolkitState();
}

function renderRaceBody(w, body) {
  const rt = pinballRuntime[w.id];
  const isRunning = Boolean(rt && rt.running);
  const excluded = w.data.excluded || [];
  const weights = w.data.weights || {};
  const participants = getPinballParticipants(w);
  const targetRank = w.data.targetRank || '1';

  const chipsHtml = tkStudents.map(s => {
    const isEx = excluded.includes(s.name);
    const wt = Number(weights[s.name]) || 1;
    return `<span class="tk-chip ${isEx ? 'excluded' : ''}" onclick="toggleExcludedStudent('${w.id}', '${escapeTkHtml(s.name)}')">
      ${escapeTkHtml(s.name)}${!isEx ? `<span class="tk-weight-badge" onclick="cycleStudentWeight('${w.id}', '${escapeTkHtml(s.name)}', event)" title="클릭 시 구슬 개수 변경 (1~5개)">x${wt}</span>` : ''}
    </span>`;
  }).join('');

  const results = Array.isArray(w.data.results) ? w.data.results : [];
  const winRankIdx = targetRank === 'last'
    ? results.length - 1
    : Math.min(results.length - 1, Math.max(0, (Number(targetRank) || 1) - 1));

  const resultItemsHtml = results.map((name, idx) => {
    const isTarget = idx === winRankIdx;
    return `<div class="tk-pinball-result-item ${isTarget ? 'target' : ''}">
      <span style="font-size:0.82em; color:${isTarget ? '#FBBF24' : '#94A3B8'}; font-weight:bold;">${idx + 1}위</span>
      <b>${escapeTkHtml(name)}</b>
    </div>`;
  }).join('');

  body.innerHTML = `
    <div style="width:100%; height:100%; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid #E2E8F0; gap:6px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:5px;">
          <select class="tk-board-select" onchange="setPinballTargetRank('${w.id}', this.value)" ${isRunning ? 'disabled' : ''}>
            <option value="1" ${targetRank === '1' ? 'selected' : ''}>1등 당첨</option>
            <option value="2" ${targetRank === '2' ? 'selected' : ''}>2등 당첨</option>
            <option value="3" ${targetRank === '3' ? 'selected' : ''}>3등 당첨</option>
            <option value="last" ${targetRank === 'last' ? 'selected' : ''}>꼴찌 당첨</option>
          </select>
          <span style="font-size:0.78em; font-weight:bold; color:#334155;">구슬 ${participants.length}개</span>
        </div>
        <div style="display:flex; gap:4px; align-items:center;">
          <button class="tk-mini-btn" onclick="toggleWidgetFilter('${w.id}')" ${isRunning ? 'disabled' : ''}>참여/가중치</button>
          <button id="pb_spd_${w.id}" class="tk-mini-btn ${w._fast ? 'primary' : ''}" onclick="togglePinballSpeed('${w.id}')">2배속</button>
          <button class="tk-mini-btn" onclick="shakePinballMarbles('${w.id}')" ${!isRunning ? 'disabled' : ''}>흔들기</button>
          <button class="tk-mini-btn warn" onclick="startPinballRace('${w.id}')">${isRunning ? '진행중...' : '출발!'}</button>
          ${isRunning ? `<button class="tk-mini-btn danger" onclick="resetPinballView('${w.id}')">중단</button>` : ''}
        </div>
      </div>
      ${w.data.showFilter ? `<div class="tk-sub-panel"><b>이름 클릭: 결석 제외 / 파란 숫자 클릭: 구슬 개수(x1~x5)</b><div class="tk-chip-grid">${chipsHtml}</div></div>` : ''}
      <div class="tk-pinball-stage" id="pb_stage_${w.id}">
        <canvas id="pb_cv_${w.id}" class="tk-pinball-canvas"></canvas>
        <div id="pb_hud_${w.id}" class="tk-pinball-hud">대기 중 (${participants.length}개)</div>
        ${results.length > 0 && !isRunning ? `
          <div class="tk-pinball-winner">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.9em; color:#FBBF24; font-weight:bold;">최종 순위 (${targetRank === 'last' ? '꼴찌' : `${targetRank}등`} 당첨: ${escapeTkHtml(w.data.winner)})</span>
              <button class="tk-win-close" style="color:#CBD5E1;" onclick="closePinballResult('${w.id}')">&times;</button>
            </div>
            <div class="tk-pinball-result-grid">${resultItemsHtml}</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  if (typeof Matter === 'undefined') {
    const hud = document.getElementById('pb_hud_' + w.id);
    if (hud) hud.innerText = '물리 엔진(Matter.js) 로드 실패';
    return;
  }

  initPinballPreviewOrSync(w);
}

function createZigzagPinballWorld(engine, participants) {
  const { Bodies, Body, Composite } = Matter;
  const world = engine.world;
  engine.gravity.y = 1.05;

  const staticBodies = [];
  const wallOpt = { isStatic: true, restitution: 0.4, friction: 0.05, renderColor: '#475569' };

  // 외벽 및 바닥
  staticBodies.push(Bodies.rectangle(6, PINBALL_H / 2, 12, PINBALL_H, wallOpt));
  staticBodies.push(Bodies.rectangle(PINBALL_W - 6, PINBALL_H / 2, 12, PINBALL_H, wallOpt));
  staticBodies.push(Bodies.rectangle(PINBALL_W / 2, 6, PINBALL_W, 12, wallOpt));
  staticBodies.push(Bodies.rectangle(PINBALL_W / 2, PINBALL_H - 12, PINBALL_W, 24, wallOpt));

  // 상단 대기 호퍼 깔때기 & 개폐 게이트
  staticBodies.push(Bodies.rectangle(165, 195, 290, 16, { ...wallOpt, angle: 0.42, renderColor: '#64748B' }));
  staticBodies.push(Bodies.rectangle(PINBALL_W - 165, 195, 290, 16, { ...wallOpt, angle: -0.42, renderColor: '#64748B' }));
  const gate = Bodies.rectangle(PINBALL_W / 2, 265, 160, 16, { isStatic: true, restitution: 0.2, renderColor: '#F59E0B', isGate: true });
  staticBodies.push(gate);

  // 지그재그 1단 (좌 -> 우 경사로 + 핀)
  staticBodies.push(Bodies.rectangle(260, 440, 460, 16, { ...wallOpt, angle: 0.22, renderColor: '#38BDF8' }));
  staticBodies.push(Bodies.rectangle(600, 560, 190, 16, { ...wallOpt, angle: -0.35, renderColor: '#38BDF8' }));

  // 지그재그 2단 (우 -> 좌 경사로)
  staticBodies.push(Bodies.rectangle(460, 740, 460, 16, { ...wallOpt, angle: -0.22, renderColor: '#38BDF8' }));
  staticBodies.push(Bodies.rectangle(120, 860, 190, 16, { ...wallOpt, angle: 0.35, renderColor: '#38BDF8' }));

  // 3단: Plinko 핀 격자 + 바운스 범퍼
  for (let row = 0; row < 5; row++) {
    const py = 1010 + row * 72;
    const cols = row % 2 === 0 ? 7 : 6;
    const startX = row % 2 === 0 ? 110 : 155;
    for (let c = 0; c < cols; c++) {
      staticBodies.push(Bodies.circle(startX + c * 82, py, 10, { isStatic: true, restitution: 0.85, friction: 0.01, renderColor: '#94A3B8' }));
    }
  }
  staticBodies.push(Bodies.circle(210, 1190, 24, { isStatic: true, restitution: 1.35, renderColor: '#F43F5E', isBumper: true }));
  staticBodies.push(Bodies.circle(510, 1190, 24, { isStatic: true, restitution: 1.35, renderColor: '#F43F5E', isBumper: true }));

  // 4단: 지그재그 교차 경사로 (좌 -> 우, 우 -> 좌)
  staticBodies.push(Bodies.rectangle(230, 1480, 400, 16, { ...wallOpt, angle: 0.24, renderColor: '#34D399' }));
  staticBodies.push(Bodies.rectangle(490, 1700, 400, 16, { ...wallOpt, angle: -0.24, renderColor: '#34D399' }));
  staticBodies.push(Bodies.rectangle(230, 1920, 380, 16, { ...wallOpt, angle: 0.24, renderColor: '#34D399' }));

  // 5단: 최후의 깔때기 + 중앙 갈림길 핀
  staticBodies.push(Bodies.rectangle(150, 2220, 320, 16, { ...wallOpt, angle: 0.38, renderColor: '#A78BFA' }));
  staticBodies.push(Bodies.rectangle(PINBALL_W - 150, 2220, 320, 16, { ...wallOpt, angle: -0.38, renderColor: '#A78BFA' }));
  staticBodies.push(Bodies.circle(360, 2140, 16, { isStatic: true, restitution: 1.25, renderColor: '#F59E0B', isBumper: true }));
  staticBodies.push(Bodies.circle(265, 2320, 12, { isStatic: true, restitution: 0.9, renderColor: '#94A3B8' }));
  staticBodies.push(Bodies.circle(455, 2320, 12, { isStatic: true, restitution: 0.9, renderColor: '#94A3B8' }));

  // 회전 풍차 3개 (매 프레임 Body.rotate 적용)
  const windmills = [];
  const makeWindmill = (x, y, len, speed) => {
    const bar1 = Bodies.rectangle(x, y, len, 14, { isStatic: true, restitution: 0.85, renderColor: '#FBBF24' });
    const bar2 = Bodies.rectangle(x, y, 14, len, { isStatic: true, restitution: 0.85, renderColor: '#FBBF24' });
    const cross = Body.create({ parts: [bar1, bar2], isStatic: true, restitution: 0.85 });
    cross.spinSpeed = speed;
    cross.renderColor = '#FBBF24';
    windmills.push(cross);
    staticBodies.push(cross);
  };
  makeWindmill(360, 600, 130, 0.045);
  makeWindmill(360, 1590, 140, -0.052);
  makeWindmill(360, 2030, 120, 0.06);

  Composite.add(world, staticBodies);

  // 구슬 생성 (호퍼 내 무작위 정렬)
  const shuffled = participants.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const marbles = shuffled.map((p, i) => {
    const col = i % 9;
    const row = Math.floor(i / 9);
    const mx = 185 + col * 42 + (Math.random() * 14 - 7);
    const my = 55 + row * 34 + (Math.random() * 8 - 4);
    const m = Bodies.circle(mx, my, 15, {
      restitution: 0.58,
      friction: 0.008,
      frictionAir: 0.003,
      density: 0.002
    });
    m.studentName = p.name;
    m.marbleColor = p.color;
    m.finished = false;
    return m;
  });

  Composite.add(world, marbles);
  return { gate, windmills, staticBodies, marbles };
}

function drawPinballFrame(cv, rt, w) {
  const stage = document.getElementById('pb_stage_' + w.id);
  if (!cv || !stage) return;

  const rect = stage.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0 && (cv.width !== Math.floor(rect.width) || cv.height !== Math.floor(rect.height))) {
    cv.width = Math.floor(rect.width);
    cv.height = Math.floor(rect.height);
  }

  const ctx = cv.getContext('2d');
  const scale = cv.width / PINBALL_W;
  const viewWorldH = cv.height / scale;

  // 카메라 목표 계산
  let targetCamY = 0;
  if (rt.running) {
    const activeMarbles = rt.marbles.filter(m => !m.finished);
    if (activeMarbles.length > 0) {
      const targetRank = w.data.targetRank || '1';
      activeMarbles.sort((a, b) => b.position.y - a.position.y);
      const focusMarble = targetRank === 'last'
        ? activeMarbles[activeMarbles.length - 1]
        : activeMarbles[0];
      targetCamY = focusMarble.position.y - (viewWorldH * 0.45);
    } else {
      targetCamY = PINBALL_H - viewWorldH;
    }
  }
  const maxCamY = Math.max(0, PINBALL_H - viewWorldH);
  targetCamY = Math.max(0, Math.min(maxCamY, targetCamY));
  rt.camY += (targetCamY - rt.camY) * 0.12;

  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, cv.width, cv.height);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, -rt.camY);

  // 결승선 그리기
  const tileW = 24;
  for (let x = 12; x < PINBALL_W - 12; x += tileW) {
    ctx.fillStyle = (Math.floor((x - 12) / tileW) % 2 === 0) ? '#FFFFFF' : '#1E293B';
    ctx.fillRect(x, PINBALL_FINISH_Y, Math.min(tileW, PINBALL_W - 12 - x), 14);
    ctx.fillStyle = (Math.floor((x - 12) / tileW) % 2 === 0) ? '#1E293B' : '#FFFFFF';
    ctx.fillRect(x, PINBALL_FINISH_Y + 14, Math.min(tileW, PINBALL_W - 12 - x), 14);
  }

  // 정적 장애물(경사로·핀·풍차·게이트) 그리기
  rt.staticBodies.forEach(b => {
    if (b.isRemoved) return;
    const parts = b.parts.length > 1 ? b.parts.slice(1) : [b];
    ctx.fillStyle = b.renderColor || '#64748B';
    parts.forEach(part => {
      ctx.beginPath();
      part.vertices.forEach((v, idx) => {
        if (idx === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      });
      ctx.closePath();
      ctx.fill();
      if (b.isBumper) {
        ctx.strokeStyle = '#FECDD3';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  });

  // 구슬 + 수평 이름표 그리기
  rt.marbles.forEach(m => {
    const { x, y } = m.position;
    const r = 15;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = m.marbleColor;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 구슬 광택
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fill();

    // 수평 이름표 배지
    ctx.font = 'bold 13px NanumSquareNeo, sans-serif';
    const textW = ctx.measureText(m.studentName).width;
    const pad = 6;
    const boxW = textW + pad * 2;
    const boxH = 18;
    const bx = x - boxW / 2;
    const by = y - r - boxH - 3;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = m.marbleColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.studentName, x, by + boxH / 2 + 1);
  });

  ctx.restore();
}

function initPinballPreviewOrSync(w) {
  if (pinballRuntime[w.id] && pinballRuntime[w.id].running) {
    // 창 크기 변경 시 기존 엔진 그대로 이어서 그리기
    return;
  }
  stopPinballRace(w.id);

  const participants = getPinballParticipants(w);
  const engine = Matter.Engine.create();
  const built = createZigzagPinballWorld(engine, participants);

  const rt = {
    engine: engine,
    gate: built.gate,
    windmills: built.windmills,
    staticBodies: built.staticBodies,
    marbles: built.marbles,
    finished: [],
    running: false,
    camY: 0,
    lastProgressTime: Date.now(),
    rafId: null
  };
  pinballRuntime[w.id] = rt;

  // 대기 상태에서 몇 틱 시뮬레이션해 깔때기 위에 자연스럽게 안착시키기
  for (let i = 0; i < 45; i++) Matter.Engine.update(engine, 16);
  const cv = document.getElementById('pb_cv_' + w.id);
  drawPinballFrame(cv, rt, w);
}

function startPinballRace(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w || typeof Matter === 'undefined') return;
  if (pinballRuntime[id] && pinballRuntime[id].running) return;

  const participants = getPinballParticipants(w);
  if (participants.length === 0) return;

  w.data.winner = '';
  w.data.results = [];
  stopPinballRace(id);

  const engine = Matter.Engine.create();
  const built = createZigzagPinballWorld(engine, participants);
  Matter.World.remove(engine.world, built.gate);
  built.gate.isRemoved = true;

  const rt = {
    engine: engine,
    gate: built.gate,
    windmills: built.windmills,
    staticBodies: built.staticBodies,
    marbles: built.marbles,
    finished: [],
    running: true,
    camY: 0,
    lastProgressTime: Date.now(),
    rafId: null
  };
  pinballRuntime[id] = rt;
  renderWidgetBody(w);

  const targetRank = w.data.targetRank || '1';
  const totalCount = rt.marbles.length;

  const loop = () => {
    const curRt = pinballRuntime[id];
    const curW = toolkitState.widgets.find(x => x.id === id);
    if (!curRt || !curRt.running || !curW) return;

    const steps = curW._fast ? 2 : 1;
    for (let s = 0; s < steps; s++) {
      curRt.windmills.forEach(wm => Matter.Body.rotate(wm, wm.spinSpeed));
      Matter.Engine.update(curRt.engine, 1000 / 60);

      curRt.marbles.forEach(m => {
        if (!m.finished && m.position.y >= PINBALL_FINISH_Y) {
          m.finished = true;
          curRt.finished.push(m.studentName);
          curRt.lastProgressTime = Date.now();
        }
      });
    }

    // 끼임 방지 안전장치 (미완주 구슬들이 2.5초간 거의 안 움직이면 자동 살짝 튕기기)
    const activeMarbles = curRt.marbles.filter(m => !m.finished);
    const anyMoving = activeMarbles.some(m => (Math.abs(m.velocity.x) + Math.abs(m.velocity.y)) > 0.45);
    if (anyMoving) {
      curRt.lastProgressTime = Date.now();
    } else if (activeMarbles.length > 0 && Date.now() - curRt.lastProgressTime > 2500) {
      shakePinballMarbles(id);
      curRt.lastProgressTime = Date.now();
    }

    // 실시간 전체 순위 HUD (15명마다 세로줄 추가)
    const hud = document.getElementById('pb_hud_' + id);
    if (hud) {
      const activeSorted = activeMarbles.slice().sort((a, b) => b.position.y - a.position.y);
      const allRankItems = [
        ...curRt.finished.map(n => ({ name: n, done: true })),
        ...activeSorted.map(m => ({ name: m.studentName, done: false }))
      ];
      const rowsHtml = allRankItems.map((item, idx) =>
        `<div class="tk-pinball-hud-item ${item.done ? 'done' : ''}">${idx + 1}. <b>${escapeTkHtml(item.name)}</b></div>`
      ).join('');
      hud.innerHTML =
        `<div><b>완주: ${curRt.finished.length} / ${totalCount}</b></div>` +
        `<div class="tk-pinball-hud-grid">${rowsHtml}</div>`;
    }

    const cv = document.getElementById('pb_cv_' + id);
    drawPinballFrame(cv, curRt, curW);

    // 처음부터 끝까지 모든 구슬이 통과할 때까지 대기
    if (curRt.finished.length >= totalCount) {
      const pickIdx = targetRank === 'last'
        ? totalCount - 1
        : Math.min(totalCount - 1, Math.max(0, (Number(targetRank) || 1) - 1));
      curRt.running = false;
      curW.data.results = curRt.finished.slice();
      curW.data.winner = curRt.finished[pickIdx] || '';
      saveToolkitState();
      renderWidgetBody(curW);
      return;
    }

    curRt.rafId = requestAnimationFrame(loop);
  };

  rt.rafId = requestAnimationFrame(loop);
}

function closePinballResult(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w.data.results = [];
  w.data.winner = '';
  saveToolkitState();
  renderWidgetBody(w);
}

function togglePinballSpeed(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w._fast = !w._fast;
  const btn = document.getElementById('pb_spd_' + id);
  if (btn) btn.classList.toggle('primary', w._fast);
}

function shakePinballMarbles(id) {
  const rt = pinballRuntime[id];
  if (!rt || !rt.running || typeof Matter === 'undefined') return;
  rt.marbles.forEach(m => {
    if (!m.finished) {
      Matter.Body.applyForce(m, m.position, {
        x: (Math.random() - 0.5) * 0.028,
        y: -0.024 - Math.random() * 0.015
      });
    }
  });
}

function resetPinballView(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  stopPinballRace(id);
  if (w) renderWidgetBody(w);
}

// ==========================================
// [11] 돌림판 (커스텀 + 학생 명단 + 실시간 가리킴 표시)
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
// [12] 자리 바꾸기 (분단/일자 · 8줄 · 고정원 · 클릭/드래그 스왑 · 순차공개 · PNG · 슬롯)
// ==========================================
const seatRevealRuntime = {};
const seatUndoStacks = {};

function pushSeatHistory(w) {
  if (!w || !w.data) return;
  if (!seatUndoStacks[w.id]) seatUndoStacks[w.id] = [];
  const snap = JSON.parse(JSON.stringify({
    layoutMode: w.data.layoutMode,
    groupCount: w.data.groupCount,
    lineCount: w.data.lineCount,
    rowCount: w.data.rowCount,
    revealMode: w.data.revealMode,
    seats: w.data.seats || [],
    activeSeats: w.data.activeSeats || [],
    lockedIdx: w.data.lockedIdx || []
  }));
  seatUndoStacks[w.id].push(snap);
  if (seatUndoStacks[w.id].length > 15) {
    seatUndoStacks[w.id].shift();
  }
}

function undoSeatChange(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  const stack = seatUndoStacks[id];
  if (!w || !stack || stack.length === 0) return;
  clearSeatRevealTimer(id);
  const prev = stack.pop();
  w.data = Object.assign({}, w.data, prev);
  w._selectedSeatIdx = null;
  saveToolkitState();
  renderWidgetBody(w);
}

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

  if (d.seats.length !== dim.total || d.activeSeats.length !== dim.total) {
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

      if (dim.mode === 'group') {
        if (c % 2 === 1 && c < dim.cols - 1) gridHtml += '<div class="tk-seat-aisle"></div>';
      } else {
        if (c < dim.cols - 1) gridHtml += '<div class="tk-seat-aisle"></div>';
      }
    }
  }

  const undoStack = seatUndoStacks[w.id] || [];
  const slots = Array.isArray(toolkitState.seatSlots) ? toolkitState.seatSlots : [];
  const selectedSlot = w._selectedSlotName || (slots[0] ? slots[0].name : '');
  const slotOpts = slots.length > 0
    ? slots.map(sl => `<option value="${escapeTkHtml(sl.name)}" ${selectedSlot === sl.name ? 'selected' : ''}>${escapeTkHtml(sl.name)}</option>`).join('')
    : '<option value="">저장된 슬롯 없음</option>';

  body.innerHTML = `
    <div class="tk-seat-wrap">
      <div class="tk-seat-toolbar">
        <div class="tk-seat-toolbar-row">
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
            <button class="tk-mini-btn" onclick="undoSeatChange('${w.id}')" ${undoStack.length === 0 || isRevealing ? 'disabled' : ''}>되돌리기(${undoStack.length})</button>
            <button class="tk-mini-btn primary" onclick="shuffleSeats('${w.id}')">${isRevealing ? '공개 중...' : '자리 섞기'}</button>
            <button class="tk-mini-btn" onclick="exportSeatsToPng('${w.id}')">PNG</button>
          </div>
        </div>
        <div class="tk-seat-toolbar-row sub">
          <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
            <select id="seat_slot_sel_${w.id}" class="tk-board-select" onchange="selectSeatSlotName('${w.id}', this.value)" style="max-width:140px;">${slotOpts}</select>
            <button class="tk-mini-btn" onclick="loadSelectedSeatSlot('${w.id}')" ${slots.length === 0 || isRevealing ? 'disabled' : ''}>불러오기</button>
            <button class="tk-mini-btn primary" onclick="openSeatSaveOverlay('${w.id}')" ${isRevealing ? 'disabled' : ''}>저장</button>
            <button class="tk-mini-btn danger" onclick="deleteSelectedSeatSlot('${w.id}')" ${slots.length === 0 || isRevealing ? 'disabled' : ''}>삭제</button>
          </div>
          <div style="display:flex; align-items:center; gap:5px;">
            <span id="seat_sync_msg_${w.id}" style="font-size:0.74em; color:#475569; font-weight:bold;">${escapeTkHtml(w._syncMsg || '')}</span>
            <button class="tk-mini-btn warn" onclick="uploadSeatSlotsToFirebase('${w.id}')" ${isRevealing ? 'disabled' : ''}>업로드</button>
            <button class="tk-mini-btn" style="background:#DBEAFE; color:#1D4ED8; border-color:#93C5FD;" onclick="downloadSeatSlotsFromFirebase('${w.id}')" ${isRevealing ? 'disabled' : ''}>다운로드</button>
          </div>
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
      ${w._showSaveOverlay ? `
        <div class="tk-seat-overlay">
          <div class="tk-seat-overlay-box">
            <div style="font-weight:bold; color:#0F172A; font-size:1em;">자리 배치 슬롯 저장</div>
            <div style="font-size:0.8em; color:#64748B;">저장할 슬롯 이름을 입력하세요. (같은 이름 입력 시 덮어쓰기)</div>
            <input id="seat_save_name_${w.id}" type="text" value="${escapeTkHtml(w._selectedSlotName || '')}" placeholder="예: 11월 기본자리"
              style="width:100%; padding:8px 10px; border:1.5px solid #CBD5E1; border-radius:8px; font-weight:bold;">
            <div style="display:flex; gap:6px; justify-content:flex-end;">
              <button class="tk-mini-btn" onclick="closeSeatSaveOverlay('${w.id}')">취소</button>
              <button class="tk-mini-btn primary" onclick="confirmSaveSeatSlot('${w.id}')">확인</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  if (w._showSaveOverlay) {
    const inp = document.getElementById('seat_save_name_' + w.id);
    if (inp) {
      inp.focus();
      inp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') confirmSaveSeatSlot(w.id);
      });
    }
  }
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
  pushSeatHistory(w);
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
  pushSeatHistory(w);
  const d = w.data;
  const lockedSet = new Set(d.lockedIdx || []);

  const fixedNames = new Set();
  lockedSet.forEach(idx => {
    if (d.seats[idx]) fixedNames.add(d.seats[idx]);
  });
  const freeStudents = tkStudents.map(s => s.name).filter(n => !fixedNames.has(n));

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

function selectSeatSlotName(id, name) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w._selectedSlotName = name;
}

function openSeatSaveOverlay(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w._showSaveOverlay = true;
  renderWidgetBody(w);
}

function closeSeatSaveOverlay(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w._showSaveOverlay = false;
  renderWidgetBody(w);
}

function confirmSaveSeatSlot(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  const inp = document.getElementById('seat_save_name_' + id);
  if (!w || !inp) return;
  const name = inp.value.trim();
  if (!name) return;

  syncSeatData(w);
  if (!Array.isArray(toolkitState.seatSlots)) toolkitState.seatSlots = [];
  const snapshot = JSON.parse(JSON.stringify({
    layoutMode: w.data.layoutMode,
    groupCount: w.data.groupCount,
    lineCount: w.data.lineCount,
    rowCount: w.data.rowCount,
    revealMode: w.data.revealMode,
    seats: w.data.seats,
    activeSeats: w.data.activeSeats,
    lockedIdx: w.data.lockedIdx
  }));

  const existingIdx = toolkitState.seatSlots.findIndex(sl => sl && sl.name === name);
  const slotObj = { name: name, savedAt: new Date().toISOString(), data: snapshot };
  if (existingIdx > -1) {
    toolkitState.seatSlots[existingIdx] = slotObj;
  } else {
    toolkitState.seatSlots.push(slotObj);
  }

  w._selectedSlotName = name;
  w._showSaveOverlay = false;
  w._syncMsg = `[${name}] 저장됨`;
  saveToolkitState();
  renderWidgetBody(w);
}

function loadSelectedSeatSlot(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  const sel = document.getElementById('seat_slot_sel_' + id);
  if (!w || !sel || !sel.value) return;
  const target = (toolkitState.seatSlots || []).find(sl => sl && sl.name === sel.value);
  if (!target || !target.data) return;

  pushSeatHistory(w);
  w.data = Object.assign({}, w.data, JSON.parse(JSON.stringify(target.data)));
  syncSeatData(w);
  w._selectedSlotName = target.name;
  w._selectedSeatIdx = null;
  w._syncMsg = `[${target.name}] 불러옴`;
  saveToolkitState();
  renderWidgetBody(w);
}

function deleteSelectedSeatSlot(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  const sel = document.getElementById('seat_slot_sel_' + id);
  if (!w || !sel || !sel.value) return;
  toolkitState.seatSlots = (toolkitState.seatSlots || []).filter(sl => sl && sl.name !== sel.value);
  w._selectedSlotName = toolkitState.seatSlots[0] ? toolkitState.seatSlots[0].name : '';
  w._syncMsg = '슬롯 삭제됨';
  saveToolkitState();
  renderWidgetBody(w);
}

async function uploadSeatSlotsToFirebase(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  syncSeatData(w);
  w._syncMsg = '업로드 중...';
  renderWidgetBody(w);

  const payload = {
    updatedAt: new Date().toISOString(),
    currentData: JSON.parse(JSON.stringify(w.data)),
    slots: JSON.parse(JSON.stringify(toolkitState.seatSlots || []))
  };

  try {
    const res = await fetch(FIREBASE_BASE_URL + '/toolkit/seatBackup.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    w._syncMsg = `업로드 완료 (${payload.slots.length}개)`;
  } catch (e) {
    w._syncMsg = '업로드 실패';
    console.error('자리 슬롯 업로드 실패:', e);
  }
  renderWidgetBody(w);
}

async function downloadSeatSlotsFromFirebase(id) {
  const w = toolkitState.widgets.find(x => x.id === id);
  if (!w) return;
  w._syncMsg = '다운로드 중...';
  renderWidgetBody(w);

  try {
    const res = await fetch(FIREBASE_BASE_URL + '/toolkit/seatBackup.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const remote = await res.json();
    if (!remote) {
      w._syncMsg = '서버 데이터 없음';
      renderWidgetBody(w);
      return;
    }

    pushSeatHistory(w);
    const localSlots = Array.isArray(toolkitState.seatSlots) ? toolkitState.seatSlots : [];
    const remoteSlots = Array.isArray(remote.slots) ? remote.slots : [];

    const mergedMap = {};
    localSlots.forEach(sl => { if (sl && sl.name) mergedMap[sl.name] = sl; });
    remoteSlots.forEach(sl => { if (sl && sl.name) mergedMap[sl.name] = sl; });
    toolkitState.seatSlots = Object.values(mergedMap);

    if (remote.currentData) {
      w.data = Object.assign({}, w.data, remote.currentData);
      syncSeatData(w);
    }
    if (!w._selectedSlotName && toolkitState.seatSlots[0]) {
      w._selectedSlotName = toolkitState.seatSlots[0].name;
    }
    w._syncMsg = `다운로드 완료 (${toolkitState.seatSlots.length}개)`;
    saveToolkitState();
  } catch (e) {
    w._syncMsg = '다운로드 실패';
    console.error('자리 슬롯 다운로드 실패:', e);
  }
  renderWidgetBody(w);
}