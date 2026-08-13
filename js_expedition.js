// ==========================================
// 2. 능력치 분배 로직
// ==========================================
// --- 능력치 분배 팝업 수정 ---
function openStatAllocation() {
    const s = currentStudent;

    // 💡 주간 최대치 필터링 적용
    const currentWeek = Number(sysConfig.current_week) || 1;
    const maxPerWeek = Number(sysConfig.max_weekly_books) || 3;
    const maxReadingLimit = currentWeek * maxPerWeek;
    const actualReading = Number(s.reading_count) || 0;
    const appliedReading = Math.min(actualReading, maxReadingLimit);

    const ppb = Number(sysConfig.point_per_book) || 4;
    const totalPoints = (appliedReading * ppb) + (Number(s.bonus_points) || 0) + (Number(s.level_points) || 0);
    tempStats.hp = Number(s.hp_points) || 5;
    tempStats.atk = Number(s.atk_points) || 5;
    tempStats.def = Number(s.def_points) || 5;
    tempStats.luk = Number(s.luk_points) || 5;

    // 현재 시트 기준의 순수 능력치 값을 차감 불가능한 원본 스탯 마지노선으로 고정
    originalStats.hp = Number(s.hp_points) || 5;
    originalStats.atk = Number(s.atk_points) || 5;
    originalStats.def = Number(s.def_points) || 5;
    originalStats.luk = Number(s.luk_points) || 5;

    // 💡 여기서도 5 초과분만 계산
    const used = Math.max(0, tempStats.hp - 5) + Math.max(0, tempStats.atk - 5) + Math.max(0, tempStats.def - 5) + Math.max(0, tempStats.luk - 5);
    tempStats.remain = totalPoints - used;
    drawStatUI();
}

function drawStatUI() {
    const body = document.getElementById('modalBody');
    const getStatRow = (label, key) => '<div class="stat-row" style="align-items:center; padding:10px 0;"><span style="font-size:1.1em;">' + label + '</span><div style="display:flex; align-items:center; gap:15px;"><button class="stat-adjust-btn" onclick="adjustStat(\'' + key + '\', -1)">-</button><b style="width:30px; text-align:center; font-size:1.3em;" id="val_' + key + '">' + tempStats[key] + '</b><button class="stat-adjust-btn" onclick="adjustStat(\'' + key + '\', 1)">+</button></div></div>';

    body.innerHTML =
        '<h2 style="color:var(--' + currentStudent.blessing + ');">📊 능력치 분배</h2>' +
        '<div style="background:#222; padding:20px; border-radius:15px; margin-bottom:20px; border:2px solid #ffd700; text-align:center;">' +
        '  <div style="font-size:1.1em; color:#aaa;">남은 포인트</div>' +
        '  <div id="displayRemain" style="font-size:2.5em; color:white; font-weight:bold; margin-top:5px;">' + tempStats.remain + '</div>' +
        '</div>' +
        '<div class="db-section">' +
        getStatRow('체력 (HP)', 'hp') + getStatRow('공격력 (ATK)', 'atk') + getStatRow('방어력 (DEF)', 'def') + getStatRow('행운 (LUK)', 'luk') +
        '</div>' +
        '<div style="display:flex; gap:10px; margin-top:20px;">' +
        '  <button style="flex:1; padding:15px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="renderDashboard()">취소</button>' +
        '  <button style="flex:1; padding:15px; border-radius:10px; border:none; background:var(--' + currentStudent.blessing + '); color:black; font-weight:bold; font-size:1.1em; cursor:pointer;" onclick="saveStats()">저장</button>' +
        '</div>';
}

function adjustStat(key, amount) {
    if (amount > 0 && tempStats.remain <= 0) {
        showUiAlert("⚠️ 포인트 부족", "더 이상 투자할 포인트가 없습니다.", "");
        return;
    }

    // 💡 1. 마이너스 버튼 방어: 이미 투자된 원본 스탯 밑으로 내릴 수 없음
    if (amount < 0 && tempStats[key] <= originalStats[key]) return;

    // 💡 2. 상한선 방어: 시스템에 설정된 최대치 초과 불가
    const maxStat = Number(sysConfig.max_stat_point) || 150;
    if (amount > 0 && tempStats[key] >= maxStat) {
        showUiAlert("⚠️ 상한선 도달", "해당 능력치는 최대치(" + maxStat + ")에 도달했습니다.", "");
        return;
    }

    tempStats[key] += amount;
    tempStats.remain -= amount;
    document.getElementById('val_' + key).innerText = tempStats[key];
    const rElem = document.getElementById('displayRemain');
    rElem.innerText = tempStats.remain;
    rElem.style.color = tempStats.remain === 0 ? '#ff4d4d' : 'white';
}

function saveStats() {
    currentStudent.hp_points = tempStats.hp; currentStudent.atk_points = tempStats.atk;
    currentStudent.def_points = tempStats.def; currentStudent.luk_points = tempStats.luk;
    renderDashboard();
    updateFastFirebaseStudent(currentStudent);
}

// ==========================================
// 3. 대장간(강화) 로직
// ==========================================
function openForge() { currentEquipType = 'weapon'; drawForgeUI(); }
function switchEquipTab(type) { currentEquipType = type; drawForgeUI(); }
function drawForgeUI() {
    const body = document.getElementById('modalBody');
    const s = currentStudent;

    // 💡 [신규] 장비별 상승 능력치 안내 문구 매핑
    const equipInfo = {
        'weapon': { name: '무기', stat: '⚔️ 공격력(ATK)' },
        'head': { name: '투구', stat: '❤️ 체력(HP)' },
        'body': { name: '갑옷', stat: '🛡️ 방어력(DEF)' },
        'accessory': { name: '장신구', stat: '🍀 행운(LUK)' }
    };

    const currentLv = Number(s[currentEquipType + '_lv']) || 0;
    const failCount = Number(s[currentEquipType + '_fail']) || 0;
    const maxLv = Number(sysConfig.max_level) || 9;
    const gameCurrency = sysConfig.game_money_currency || "골드"; // 💡 인게임 화폐 단위 로드
    const bonusPerFail = Number(sysConfig.fail_bonus_prob) || 5;

    let infoHtml = ""; let btnHtml = "";
    if (currentLv >= maxLv) {
        infoHtml = '<div style="font-size:1.2em; color:var(--TextPoint); margin: 15px 0;">[현재 +' + maxLv + ' (최대 강화 달성)]</div>';
        btnHtml = '<button class="btn-main" style="background:var(--TextLock);" disabled>강화 불가</button>';
    } else {
        const data = enhanceData[currentLv] || { prob: 0, cost: 0 };

        let forgeRelicBonus = 0;
        [s.relic_1, s.relic_2].forEach(rid => {
            if (rid && rid !== 'null' && rid !== 'false') {
                const r = relicsData.find(x => String(x.relic_id) === String(rid));
                if (r && r.effect_type === 'forge_up') forgeRelicBonus += (Number(r.value) || 0) * 100;
            }
        });

        const bonusProb = (failCount * bonusPerFail) + forgeRelicBonus;
        const finalProb = Math.min(100, data.prob + bonusProb);
        // 💡 [수정] 흰 배경에서 가독성을 확보하기 위해 어두운 초록(#059669) 사용
        let probDisplay = '<span style="color:' + (data.prob === 100 ? '#059669' : 'var(--TextPoint)') + ';">' + data.prob + '%</span>';
        if (bonusProb > 0) probDisplay = '<span style="text-decoration:line-through; opacity:0.6;">' + data.prob + '%</span> <span style="color:#059669; font-weight:bold;">' + finalProb + '% (+' + bonusProb + '%)</span>';

        infoHtml =
            '<div style="font-size:1.2em; margin: 10px 0; font-weight:bold; color:var(--TextMain);">[현재 +' + currentLv + ' <span style="color:var(--TextPoint);">>> 다음 +' + (currentLv + 1) + '</span>]</div>' +
            '<div style="font-size:1.0em; color:#059669; margin-bottom:10px; font-weight:bold;">(상승 스탯: ' + equipInfo[currentEquipType].stat + ' 보너스)</div>' +
            '<div style="font-size:0.9em; color:var(--TextSub); margin-bottom:5px;">누적 실패: ' + failCount + '회</div>' +
            '<div style="font-size:1.1em; color:var(--TextMain);">성공 확률: ' + probDisplay + '</div>';

        btnHtml = '<div style="display:flex; gap:10px;"><button style="flex:1; padding:15px; border-radius:10px; border:none; background:var(--TextSub); color:white; font-size:1.1em; cursor:pointer;" onclick="renderDashboard()">돌아가기</button><button id="btnEnhance" style="flex:2; padding:15px; border-radius:10px; border:none; background:var(--Red); color:white; font-weight:bold; font-size:1.2em; cursor:pointer;" onclick="attemptEnhance(' + currentLv + ', ' + finalProb + ', ' + data.cost + ', ' + failCount + ', \'' + gameCurrency + '\')">강화 시도 (' + data.cost + gameCurrency + ')</button></div>';
    }

    body.innerHTML =
        '<h2 style="color:var(--TextGold);">🔨 대장간</h2>' +
        '<div style="display:flex; margin-bottom:15px;">' +
        '  <div class="equip-tab ' + (currentEquipType === 'weapon' ? 'active' : '') + '" onclick="switchEquipTab(\'weapon\')">무기</div>' +
        '  <div class="equip-tab ' + (currentEquipType === 'head' ? 'active' : '') + '" onclick="switchEquipTab(\'head\')">투구</div>' +
        '  <div class="equip-tab ' + (currentEquipType === 'body' ? 'active' : '') + '" onclick="switchEquipTab(\'body\')">갑옷</div>' +
        '  <div class="equip-tab ' + (currentEquipType === 'accessory' ? 'active' : '') + '" onclick="switchEquipTab(\'accessory\')">장신구</div>' +
        '</div>' +
        // 💡 [수정] 플래시 효과와 파티클을 담기 위해 컨테이너 설정 고도화
        '<div id="forgeContainer" style="position:relative; overflow:hidden; background:#FFFFFF; padding:20px; border-radius:15px; margin-bottom:15px; border:1px solid var(--BorderColor); box-shadow:0 4px 6px rgba(0,0,0,0.05);">' +
        '  <h3 style="margin:0 0 10px 0; color:var(--TextMain); position:relative; z-index:10;">선택된 장비: ' + equipInfo[currentEquipType].name + '</h3>' +
        '  <div style="position:relative; z-index:10;">' + infoHtml + '</div>' +
        '  <div class="forge-area" style="position:relative; z-index:10;"><div id="forgeHammer" class="hammer-icon">🔨</div><div id="forgeAnvil" class="anvil-icon">🪨</div></div>' +
        '  <div id="forgeResult" style="height:30px; font-size:1.2em; font-weight:bold; position:relative; z-index:10;"></div>' +
        '</div>' +
        (currentLv >= maxLv ? '<button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">돌아가기</button>' : btnHtml);
}

// [수정] 대장간 강화 시도 (자동 차감으로 변경)
function attemptEnhance(currentLv, finalProb, cost, currentFailCount, currency) {
    // 💡 [연타 방어] 버튼을 누른 즉시 비활성화시켜 다중 클릭을 물리적으로 차단!
    const btn = document.getElementById('btnEnhance');
    if (btn) {
        if (btn.disabled) return; // 이미 처리 중이면 강제 종료
        btn.disabled = true;
        btn.innerText = "검증 중...";
    }

    const currentMoney = Number(currentStudent.game_money) || 0;
    const gameCurrency = sysConfig.game_money_currency || '골드';

    if (currentMoney < cost) {
        if (btn) { btn.disabled = false; btn.innerText = "강화 시도 (" + cost + gameCurrency + ")"; }
        showUiAlert("⚠️ 자금 부족", "소지한 재화가 부족합니다.<br><span style='font-size:0.9em; color:#aaa;'>(필요: " + cost + gameCurrency + " / 보유: " + currentMoney + gameCurrency + ")</span>", "");
        return;
    }

    // 로컬 데이터 즉시 차감
    currentStudent.game_money = currentMoney - cost;

    // 서버에 재화 차감 요청
    google.script.run.updateGameMoney(currentStudent.name, -cost);

    // 강화 로직 실행 (교사 승인 없이 바로 실행)
    processEnhance(currentLv, finalProb, currentFailCount);
}

// 💡 신규: 파티클 흩뿌리기 연출 헬퍼 함수
function createForgeParticles(isSuccess) {
    const container = document.getElementById('forgeContainer');
    if (!container) return;

    const color = isSuccess ? '#F59E0B' : '#EF4444'; // 성공: 황금색, 실패: 붉은색
    const particleCount = 25; // 뿜어져 나오는 입자 개수

    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'forge-particle';
        const size = Math.random() * 12 + 6; // 6px ~ 18px 크기
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.background = color;
        p.style.boxShadow = '0 0 10px ' + color;

        // 컨테이너 중앙 하단(모루 위치 부근)에서 시작
        p.style.left = '50%';
        p.style.top = '70%';

        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * 150 + 50; // 50px ~ 200px 밖으로 퍼짐
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        // Web Animations API를 사용해 사방으로 터지는 효과
        p.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: 'translate(calc(-50% + ' + tx + 'px), calc(-50% + ' + ty + 'px)) scale(0)', opacity: 0 }
        ], {
            duration: 600 + Math.random() * 400, // 0.6초 ~ 1.0초 사이 랜덤
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)' // 처음엔 빠르고 끝에선 느려짐
        });

        container.appendChild(p);
        setTimeout(() => p.remove(), 1000); // 메모리 확보를 위해 삭제
    }
}

// [신규] 팝업에서 '확인'을 누르면 실행되는 실제 강화 로직
function processEnhance(currentLv, finalProb, currentFailCount) {
    const btn = document.getElementById('btnEnhance');
    const hammer = document.getElementById('forgeHammer');
    const anvil = document.getElementById('forgeAnvil');
    const resultText = document.getElementById('forgeResult');
    const forgeContainer = document.getElementById('forgeContainer');

    btn.disabled = true;
    btn.innerText = "진행 중...";
    resultText.innerText = "";
    hammer.classList.add('anim-hit');

    setTimeout(() => {
        hammer.classList.remove('anim-hit');
        if ((Math.random() * 100) < finalProb) {
            anvil.classList.add('anim-success');
            if (forgeContainer) forgeContainer.classList.add('forge-flash-success');
            createForgeParticles(true); // 💡 황금빛 파티클 폭발!

            resultText.style.color = "#D97706";
            resultText.innerText = "✨ 강화 성공! ✨";
            google.script.run.updateEnhanceResult(currentStudent.name, currentEquipType, currentLv + 1, 0);

            setTimeout(() => {
                anvil.classList.remove('anim-success');
                if (forgeContainer) forgeContainer.classList.remove('forge-flash-success');
                currentStudent[currentEquipType + '_lv'] = currentLv + 1;
                currentStudent[currentEquipType + '_fail'] = 0;
                drawForgeUI();
            }, 1000); // 파티클 이펙트를 충분히 감상하도록 1초 대기
        } else {
            anvil.classList.add('anim-fail');
            if (forgeContainer) forgeContainer.classList.add('forge-flash-fail');
            createForgeParticles(false); // 💡 핏빛 파티클 폭발!

            // 💡 실패 시 돌이 부서지는 시각적 연출 추가
            anvil.innerText = "💥";

            resultText.style.color = "#ff4d4d";
            resultText.innerText = "💥 실패...";

            // 💡 [추가] 영구 실패 카운터 누적 (로컬 반영)
            currentStudent.total_forge_fail = (Number(currentStudent.total_forge_fail) || 0) + 1;

            google.script.run.updateEnhanceResult(currentStudent.name, currentEquipType, currentLv, currentFailCount + 1);

            // 💡 영구 카운터를 서버에 따로 저장
            if (google.script.run.updateTotalForgeFail) {
                google.script.run.updateTotalForgeFail(currentStudent.name, currentStudent.total_forge_fail);
            }

            setTimeout(() => {
                anvil.classList.remove('anim-fail');
                anvil.innerText = "🪨"; // 이모지 복구
                if (forgeContainer) forgeContainer.classList.remove('forge-flash-fail');
                currentStudent[currentEquipType + '_fail'] = currentFailCount + 1;
                drawForgeUI();
            }, 1000); // 1초 대기
        }
    }, 750);
}

// [수정 3] 대표 스킬 장착 UI 표시 (태그형 카드 그리드 적용)
function openEquipUI(slotNum) {
    currentTargetSlot = slotNum;

    const rawSkills = String(currentStudent.unlocked_skills || "").replace(/!/g, '');
    const myUnlocked = rawSkills ? rawSkills.split(',').map(x => x.trim()).filter(Boolean) : [];
    const body = document.getElementById('modalBody');

    if (myUnlocked.length === 0) {
        body.innerHTML =
            '<h2 style="color:var(--Highlight);">⚔️ 대표 스킬 슬롯 ' + slotNum + '</h2><p style="color:var(--TextSub);">보유한 스킬이 없습니다.</p>' +
            '<button class="btn-main" style="background:var(--Red);" onclick="equipSkill(\'\')">이 슬롯 비우기 (해제)</button>' +
            '<button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">돌아가기</button>';
        return;
    }

    let cardsHtml = myUnlocked.map(id => {
        const sk = skillsData.find(x => String(x.skill_id) === id);
        if (!sk) return '';

        const skBlessing = sk.blessing && String(sk.blessing).trim() !== '' && String(sk.blessing).trim() !== 'None' ? String(sk.blessing).trim() : 'Highlight';
        const bColor = 'var(--' + skBlessing + ')';

        const isCurrentAssigned = (String(currentStudent.equipped_1) === String(sk.skill_id));

        let cardBorder = isCurrentAssigned
            ? 'border:2px solid ' + bColor + '; box-shadow: 0 0 10px ' + bColor + ';'
            : 'border:2px solid var(--BorderColor);';

        let iconDisplay = sk.icon_url
            ? '<img src="' + sk.icon_url + '" style="width:48px; height:48px; object-fit:contain; image-rendering:pixelated; border-radius:8px; background:#111; border:2px solid ' + bColor + '; padding:2px;">'
            : '<div style="font-size:32px;">🔮</div>';

        let btnText = '상세/장착';
        let btnBg = 'var(--Highlight)';
        if (isCurrentAssigned) { btnText = '장착중'; btnBg = bColor; }

        return '<div style="background:#FFFFFF; ' + cardBorder + ' border-radius:12px; padding:10px 6px; text-align:center; display:flex; flex-direction:column; justify-content:space-between; align-items:center; transition:0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.05); cursor:pointer;" onclick="showSkillDetail(\'' + sk.skill_id + '\')">' +
            '  ' + iconDisplay +
            '  <div style="font-weight:bold; font-size:0.85em; color:var(--TextMain); margin:6px 0 2px 0; word-break:keep-all; line-height:1.2;">' + sk.name + '</div>' +
            '  <div style="font-size:0.7em; color:var(--Red); font-weight:bold; margin-bottom:8px;">⏳ 쿨타임 ' + (sk.cooldown || 0) + '턴</div>' +
            '  <button class="small-btn" style="width:100%; background:' + btnBg + '; padding:6px 0; border:none;">' + btnText + '</button>' +
            '</div>';
    }).join('');

    body.innerHTML =
        '<h2 style="color:var(--Highlight); text-align:center; margin-top:0;">⚔️ 대표 스킬 선택</h2>' +
        '<p style="text-align:center; color:var(--TextSub); font-size:0.85rem; margin-bottom:15px;">스킬 카드를 누르면 상세 설명 확인 및 장착이 가능합니다.</p>' +
        '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(115px, 1fr)); gap:10px; max-height:350px; overflow-y:auto; padding:5px; margin-bottom:15px;">' +
        cardsHtml +
        '</div>' +
        '<button class="btn-main" style="background:var(--Red); margin-bottom:8px;" onclick="equipSkill(\'\')">이 슬롯 비우기 (장착 해제)</button>' +
        '<button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">취소</button>';
}

// [수정할 부분] showSkillDetail 함수 전체 덮어쓰기
function showSkillDetail(skillId) {
    const sk = skillsData.find(x => String(x.skill_id) === skillId);
    const body = document.getElementById('modalBody');

    const skBlessing = sk.blessing && String(sk.blessing).trim() !== '' && String(sk.blessing).trim() !== 'None' ? String(sk.blessing).trim() : 'Highlight';
    const bColor = 'var(--' + skBlessing + ')';
    let iconDisplay = sk.icon_url
        ? '<img src="' + sk.icon_url + '" style="width:40px; height:40px; object-fit:contain; vertical-align:middle; margin-right:10px; border: 2px solid ' + bColor + '; border-radius: 6px; background: #111; padding: 2px; image-rendering: pixelated; box-shadow: 0 0 5px ' + bColor + ';">'
        : '';

    body.innerHTML =
        '<h2 style="color:var(--Highlight); display:flex; align-items:center; justify-content:center;">' +
        iconDisplay + sk.name +
        '</h2>' +
        '<div style="background:#222; padding:20px; border-radius:10px; margin-bottom:20px; border:1px solid #444; text-align:left;">' +
        '<p><b>설명:</b> ' + sk.description + '</p>' +
        '<p><b>대상:</b> ' + sk.target_type + ' | <b>타입:</b> ' + sk.effect_type + '</p>' +
        '<p><b>기본위력:</b> ' + sk.base_value + ' | <b>계수:</b> ' + sk.scaling_stat + ' x' + sk.muliplier + '</p>' +
        '<p><b>특수효과:</b> ' + sk.special_effect + ' (' + sk.duration + '턴)</p>' +
        '<p style="color:#ff4d4d;"><b>쿨타임:</b> ' + sk.cooldown + '턴</p>' +
        '</div>' +
        '<button class="btn-main" onclick="equipSkill(\'' + sk.skill_id + '\')">이 스킬 장착하기</button>' +
        '<button class="btn-main" style="background:#444;" onclick="openEquipUI(' + currentTargetSlot + ')">목록으로</button>';
}

function equipSkill(skillId) {
    // 아이템을 장착하려는 경우(비우는 게 아닌 경우) 중복 검사
    if (skillId !== '') {
        if (currentTargetSlot === 1 && String(currentStudent.equipped_2) === String(skillId)) {
            showUiAlert("⚠️ 장착 실패", "이미 두 번째 슬롯에 장착 중인 스킬입니다.", "");
            return; // 진행 중단
        }
        if (currentTargetSlot === 2 && String(currentStudent.equipped_1) === String(skillId)) {
            showUiAlert("⚠️ 장착 실패", "이미 첫 번째 슬롯에 장착 중인 스킬입니다.", "");
            return; // 진행 중단
        }
    }

    if (currentTargetSlot === 1) currentStudent.equipped_1 = skillId;
    else currentStudent.equipped_2 = skillId;

    renderDashboard();
    updateFastFirebaseStudent(currentStudent);
}

// 4. 실제 유물 장착 처리
// 💡 데이터 이름도 원래 시트에 맞춰 relic_1, relic_2로 바꿨습니다.
function equipRelic(relicId) {
    // 아이템을 장착하려는 경우 중복 검사
    if (relicId !== '') {
        if (currentTargetSlot === 1 && String(currentStudent.relic_2) === String(relicId)) {
            showUiAlert("⚠️ 장착 실패", "이미 두 번째 슬롯에 장착 중인 유물입니다.", "");
            return; // 진행 중단
        }
        if (currentTargetSlot === 2 && String(currentStudent.relic_1) === String(relicId)) {
            showUiAlert("⚠️ 장착 실패", "이미 첫 번째 슬롯에 장착 중인 유물입니다.", "");
            return; // 진행 중단
        }
    }

    if (currentTargetSlot === 1) currentStudent.relic_1 = relicId;
    else currentStudent.relic_2 = relicId;

    renderDashboard();
    updateFastFirebaseStudent(currentStudent);
}

// --- [복구] 유물 장착 UI (카드 그리드 구조 적용) ---
function openRelicEquipUI(slotNum) {
    currentTargetSlot = slotNum;

    const rawRelics = String(currentStudent.unlocked_relics || "").replace(/!/g, '');
    const myRelics = rawRelics ? rawRelics.split(',').map(x => x.trim()).filter(Boolean) : [];
    const body = document.getElementById('modalBody');

    if (myRelics.length === 0) {
        body.innerHTML = '<h2 style="color:var(--Highlight);">🏺 유물 슬롯 ' + slotNum + '</h2><p style="color:var(--TextSub);">보유한 유물이 없습니다.</p>' +
            '<button class="btn-main" style="background:var(--Red);" onclick="equipRelic(\'\')">이 슬롯 비우기 (장착 해제)</button>' +
            '<button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">돌아가기</button>';
        return;
    }

    const translator = (typeof relicEffectTranslator !== 'undefined') ? relicEffectTranslator : {};

    let cardsHtml = myRelics.map(id => {
        const r = relicsData.find(x => String(x.relic_id) === id);
        if (!r) return '';

        const isCurrentAssigned = (slotNum === 1 && String(currentStudent.relic_1) === String(r.relic_id)) || (slotNum === 2 && String(currentStudent.relic_2) === String(r.relic_id));
        const isOtherAssigned = (slotNum === 1 && String(currentStudent.relic_2) === String(r.relic_id)) || (slotNum === 2 && String(currentStudent.relic_1) === String(r.relic_id));

        let cardBorder = isCurrentAssigned
            ? 'border:2px solid var(--TextGold); box-shadow: 0 0 10px rgba(217, 119, 6, 0.4);'
            : (isOtherAssigned ? 'border:2px solid var(--BorderColor); opacity:0.6;' : 'border:2px solid var(--BorderColor);');

        let iconDisplay = r.icon_url
            ? '<img src="' + r.icon_url + '" style="width:48px; height:48px; object-fit:contain; image-rendering:pixelated; border-radius:8px; background:#FEF3C7; border:1px solid var(--TextGold); padding:2px;">'
            : '<div style="font-size:32px;">🏺</div>';

        const effName = translator[r.effect_type] || r.effect_type;
        let valStr = (r.effect_type.includes('mult') || (r.effect_type.includes('up') && !r.effect_type.match(/^(hp|atk|def|luk|gold)_up$/))) ? (Number(r.value) * 100) + '%' : r.value;

        let btnText = '장착';
        let btnBg = 'var(--Highlight)';
        if (isCurrentAssigned) { btnText = '장착중'; btnBg = 'var(--TextGold)'; }
        else if (isOtherAssigned) { btnText = '슬롯2장착'; btnBg = 'var(--TextSub)'; }

        return '<div style="background:#FFFFFF; ' + cardBorder + ' border-radius:12px; padding:10px 6px; text-align:center; display:flex; flex-direction:column; justify-content:space-between; align-items:center; transition:0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.05);">' +
            '  ' + iconDisplay +
            '  <div style="font-weight:bold; font-size:0.85em; color:var(--TextMain); margin:6px 0 2px 0; word-break:keep-all; line-height:1.2;">' + r.name + '</div>' +
            '  <div style="font-size:0.7em; color:var(--TextGold); font-weight:bold; margin-bottom:8px; white-space:nowrap;">✨ ' + effName + ' +' + valStr + '</div>' +
            '  <button class="small-btn" style="width:100%; background:' + btnBg + '; padding:6px 0; border:none;" onclick="equipRelic(\'' + r.relic_id + '\')">' + btnText + '</button>' +
            '</div>';
    }).join('');

    body.innerHTML =
        '<h2 style="color:var(--Highlight); text-align:center; margin-top:0;">🏺 유물 슬롯 ' + slotNum + '</h2>' +
        '<p style="text-align:center; color:var(--TextSub); font-size:0.85rem; margin-bottom:15px;">장착할 유물을 선택하세요.</p>' +
        '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(115px, 1fr)); gap:10px; max-height:350px; overflow-y:auto; padding:5px; margin-bottom:15px;">' +
        cardsHtml +
        '</div>' +
        '<button class="btn-main" style="background:var(--Red); margin-bottom:8px;" onclick="equipRelic(\'\')">이 슬롯 비우기 (장착 해제)</button>' +
        '<button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">취소</button>';
}

// --- 슬롯 확장 안내 (시즌 2 개편 개별 안내) ---
function promptUnlockSlot(type, slotNum) {
    if (type === 'skill') {
        showUiAlert("⚔️ 원정대 시스템", "스킬 확장은 <b>[⚔️ 원정대]</b> 메뉴에서 동료를 추가 배치하여 사용하세요!", "");
    } else {
        showUiAlert("🛒 상점 이용 안내", "유물 슬롯 2는 <b>[🛒 상점]</b> 탭에서 <b>[유물 슬롯 해금권]</b>을 구매하여 해금할 수 있습니다!", "");
    }
}

// ==========================================
// 🧑‍🎤 스킨(옷장) 시스템 추가 (상세 팝업 기능 적용)
// ==========================================
function openWardrobe() {
    const body = document.getElementById('modalBody');
    const s = currentStudent;

    // 1. 보유 스킨 목록 파싱
    const rawSkins = String(s.unlocked_skins || "").replace(/!/g, '');
    let mySkins = rawSkins ? rawSkins.split(',').map(x => x.trim()).filter(Boolean) : [];

    // 💡 [수정] 8개의 기본 스킨(HD001~HD008)은 무조건 보유한 것으로 취급
    const defaultSkins = ['HD001', 'HD002', 'HD003', 'HD004', 'HD005', 'HD006', 'HD007', 'HD008'];
    defaultSkins.forEach(ds => {
        if (!mySkins.includes(ds)) mySkins.push(ds);
    });

    // 💡 [수정] 장착 중인 스킨이 없을 때는 HD001을 기본 장착으로 간주
    const currentEquipped = s.equipped_skin || 'HD001';

    let html = '<h2 style="color:var(--Yellow);">🧑‍🎤 옷장</h2>' +
        '<p style="color:var(--TextSub); margin-bottom:20px;">획득한 외형을 선택하여 자세히 살펴보세요!</p>' +
        '<div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap; margin-bottom:20px;">';

    // 2. skins 탭에 등록된 전체 스킨을 순회하며 카드 생성
    skinsData.forEach(skin => {
        if (!skin.skin_id) return; // 빈 줄 방지

        const isOwned = mySkins.includes(String(skin.skin_id));
        const isEquipped = String(skin.skin_id) === String(currentEquipped);

        let borderStyle = 'border: 2px solid var(--BorderColor);';
        let textStyle = 'color: var(--TextSub);';
        let overlay = '';

        // 💡 [수정] 모든 카드를 누르면 구매/장착 대신 무조건 '상세 정보 창'을 띄웁니다.
        let clickAction = 'onclick="showSkinDetail(\'' + skin.skin_id + '\')"';

        // 장착 중인 상태
        if (isEquipped) {
            borderStyle = 'border: 3px solid var(--Green); box-shadow: 0 0 10px rgba(5, 150, 105, 0.2); cursor: pointer;';
            textStyle = 'color: var(--Green); font-weight: bold;';
            overlay = '<div style="font-size:0.75em; color:var(--Green); margin-top:5px;">[장착 중]</div>';
        }
        // 보유했지만 미장착 상태
        else if (isOwned) {
            borderStyle = 'border: 2px solid var(--Highlight); cursor: pointer;';
            textStyle = 'color: var(--Highlight);';
            overlay = '<div style="font-size:0.75em; color:var(--TextSub); margin-top:5px;">클릭하여 상세 보기</div>';
        }
        // 아직 미획득(자물쇠) 상태
        else {
            borderStyle = 'border: 2px solid var(--BorderColor); opacity: 0.6; cursor: pointer;';
            overlay = '<div style="font-size:1.5em; margin-top:5px;">🔒</div><div style="font-size:0.75em; color:var(--TextSub); margin-top:5px;">클릭하여 상세 보기</div>';
        }

        html +=
            '<div style="background:#FFFFFF; ' + borderStyle + ' border-radius:15px; padding:15px; width:130px; transition:0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.05);" ' +
            'onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'" ' +
            clickAction + '>' +
            '  <img src="' + skin.skin_url + '" style="width:90px; height:90px; object-fit:contain; margin-bottom:10px; transform: scaleX(-1);">' +
            '  <div style="font-size:0.95em; ' + textStyle + '">' + skin.name + '</div>' +
            '  ' + overlay +
            '</div>';
    });

    html += '</div><button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">메인으로 돌아가기</button>';
    body.innerHTML = html;
}

// 💡 [신규 추가] 스킨 확대샷 및 상세 설명 팝업 함수
function showSkinDetail(skinId) {
    const skin = skinsData.find(x => String(x.skin_id) === String(skinId));
    const body = document.getElementById('modalBody');

    // 소유 여부 및 장착 여부 확인
    const rawSkins = String(currentStudent.unlocked_skins || "").replace(/!/g, '');
    let mySkins = rawSkins ? rawSkins.split(',').map(x => x.trim()).filter(Boolean) : [];

    // 💡 [수정] 8개의 기본 스킨 무조건 보유 처리
    const defaultSkins = ['HD001', 'HD002', 'HD003', 'HD004', 'HD005', 'HD006', 'HD007', 'HD008'];
    defaultSkins.forEach(ds => {
        if (!mySkins.includes(ds)) mySkins.push(ds);
    });

    const isOwned = mySkins.includes(String(skin.skin_id));
    // 💡 [수정] 미장착 시 비교 대상을 HD001로 변경
    const isEquipped = String(currentStudent.equipped_skin || 'HD001') === String(skin.skin_id);

    // 조건에 따른 하단 액션 버튼 생성
    let btnHtml = '';
    if (isEquipped) {
        btnHtml = '<button class="btn-main" style="background:#F1F5F9; color:var(--Green); border: 2px solid var(--Green);" disabled>✅ 현재 장착 중인 외형입니다</button>';
    } else if (isOwned) {
        btnHtml = '<button class="btn-main" style="background:var(--Highlight);" onclick="equipSkin(\'' + skin.skin_id + '\')">이 외형 장착하기</button>';
    } else {
        const cost = sysConfig.skin_price || 500;
        const currency = sysConfig.currency_name || '골드';
        btnHtml = '<button class="btn-main" style="background:var(--Yellow);" onclick="promptBuySkin(\'' + skin.skin_id + '\', \'' + skin.name + '\')">구매 및 해금 (' + cost + currency + ')</button>';
    }

    // 시트에 description 열이 없을 경우를 대비한 기본 텍스트
    const rawDesc = skin.description || "이 멋진 외형을 장착하고 새로운 모험을 떠나보세요!";
    // 💡 [핵심] 구글 시트의 줄바꿈(엔터) 기호를 HTML 줄바꿈 태그(<br>)로 변환!
    const desc = String(rawDesc).replace(/[\n\r]/g, '<br>');

    body.innerHTML =
        '<h2 style="color:var(--Highlight);">✨ 외형 상세 정보</h2>' +
        '<div style="background:#F8FAFC; padding:40px 20px; border-radius:15px; margin-bottom:20px; border:1px solid var(--BorderColor); display:flex; flex-direction:column; align-items:center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">' +
        // 💡 아바타 이미지 2배 확대 (150px) 및 후광 이펙트 추가
        '  <img src="' + skin.skin_url + '" style="width:150px; height:150px; object-fit:contain; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.15)); transform: scaleX(-1); margin-bottom: 25px;">' +
        '  <h3 style="color:var(--Yellow); margin:0 0 10px 0; font-size: 1.6em;">' + skin.name + '</h3>' +
        '  <p style="color:var(--TextMain); font-size:1.1em; line-height:1.6; word-break:keep-all; max-width:80%;">' + desc + '</p>' +
        '</div>' +
        btnHtml +
        '<button class="btn-main" style="background:var(--TextSub);" onclick="openWardrobe()">옷장으로 돌아가기</button>';
}

function equipSkin(skinId) {
    currentStudent.equipped_skin = skinId;
    renderDashboard();
    showUiAlert("✨ 외형 변경 완료!", "캐릭터의 스킨이 성공적으로 변경되었습니다!", "");
    updateFastFirebaseStudent(currentStudent);
}

// --- 💡 신규: 스킨 구매(해금) 시스템 ---
function promptBuySkin(skinId, skinName) {
    if (!checkTeacherAuth()) return; // 🔒 교사 모드 잠금! (교사만 구매 가능)

    const cost = sysConfig.skin_price || 500;
    // 현실 화폐(티)를 사용하므로 currency_name 유지
    const currency = sysConfig.currency_name || '티';

    showUiConfirm(
        "👗 외형(스킨) 구매",
        "학생에게 <b>(" + cost + currency + ")</b>를 받았습니까?<br><br>[<b style=\"color:var(--Highlight);\">" + skinName + "</b>] 스킨을 해금합니다.",
        "processBuySkin('" + skinId + "', '" + skinName + "')"
    );
}

function processBuySkin(skinId, skinName) {
    // 1. 획득한 스킨 목록 파싱
    const rawSkins = String(currentStudent.unlocked_skins || "").replace(/!/g, '');
    let mySkins = rawSkins ? rawSkins.split(',').map(x => x.trim()).filter(Boolean) : [];

    // 2. 중복이 아니면 목록에 새로 추가
    if (!mySkins.includes(String(skinId))) {
        mySkins.push(skinId);
    }
    currentStudent.unlocked_skins = "!" + mySkins.join(',');

    // 3. 옷장 새로고침 (방금 산 스킨의 자물쇠가 즉시 풀림!)
    openWardrobe();

    // 4. 구매 성공 알림
    showUiAlert("🎉 해금 완료!", "[<b style=\"color:var(--Highlight);\">" + skinName + "</b>] 스킨을 획득했습니다!<br>이제 클릭하여 장착할 수 있습니다.", "");
    updateFastFirebaseStudent(currentStudent);
}

// ==========================================
// ⚔️ 원정대 (파티 및 스킬 관리) 시스템
// ==========================================
if (typeof tempExpedition === 'undefined') {
    var tempExpedition = {
        m1: '',
        m2: '',
        hero_skill: '',
        m1_skill: '',
        m2_skill: ''
    };
}

// 1. 원정대 메인 모달 열기
function openExpeditionModal() {
    const s = currentStudent;
    if (!s) return;

    tempExpedition.m1 = s.party_m1 || '';
    tempExpedition.m2 = s.party_m2 || '';
    tempExpedition.m1_skill = s.party_s1 || '';
    tempExpedition.m2_skill = s.party_s2 || '';

    renderExpeditionUI();
}

// 2. 원정대 화면 렌더링
function renderExpeditionUI() {
    const s = currentStudent;
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;

    modal.style.display = 'flex';

    const m1Obj = (mercenariesData || []).find(m => String(m.merc_id) === String(tempExpedition.m1));
    const m1Name = m1Obj ? m1Obj.name : '미배치';
    const m1IconHtml = m1Obj ? (m1Obj.icon_url ? '<img src="' + m1Obj.icon_url + '" style="width:36px; height:36px; border-radius:50%; vertical-align:middle;">' : '🛡️') : '👤';
    const m1SkillObj = (skillsData || []).find(sk => String(sk.skill_id) === String(tempExpedition.m1_skill));
    const m1SkillName = m1SkillObj ? '📜 ' + m1SkillObj.name : '➕ 스킬 선택';

    const isM2Unlocked = (s.merc_slot2_unlocked === true || String(s.merc_slot2_unlocked).toUpperCase() === 'TRUE');
    const m2Obj = (mercenariesData || []).find(m => String(m.merc_id) === String(tempExpedition.m2));
    const m2Name = m2Obj ? m2Obj.name : '미배치';
    const m2IconHtml = m2Obj ? (m2Obj.icon_url ? '<img src="' + m2Obj.icon_url + '" style="width:36px; height:36px; border-radius:50%; vertical-align:middle;">' : '🛡️') : '👤';
    const m2SkillObj = (skillsData || []).find(sk => String(sk.skill_id) === String(tempExpedition.m2_skill));
    const m2SkillName = m2SkillObj ? '📜 ' + m2SkillObj.name : '➕ 스킬 선택';

    let html = '<h2 style="color:var(--Highlight); text-align:center; margin-top:0;">⚔️ 원정대 관리</h2>';
    html += '<p style="text-align:center; color:var(--TextSub); font-size:0.85rem; margin-bottom:15px;">원정대에 동료를 배치하고 스킬을 지정하세요!<br><span style="color:var(--Yellow);">(대표 스킬 및 동일 스킬 중복 장착 불가)</span></p>';

    // 대표 캐릭터 슬롯이 빠졌으므로 그리드 분할을 2분할(repeat(2, 1fr))로 조정합니다.
    html += '<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:20px;">';

    // [슬롯 1: 동료 1]
    html += '<div style="border:2px solid var(--BorderColor); background:var(--BgDashboard); border-radius:10px; padding:10px; text-align:center;">';
    html += '<div style="font-size:0.75rem; font-weight:bold; color:var(--Blue); margin-bottom:4px;">[동료 1]</div>';
    html += '<div style="font-size:1.5rem; margin:2px 0;">' + m1IconHtml + '</div>';
    html += '<div style="font-weight:bold; font-size:0.8rem; margin-bottom:4px;">' + m1Name + '</div>';
    html += '<button class="btn-main" style="padding:3px 6px; font-size:0.78rem; background:var(--BgCard); color:var(--TextMain); margin-bottom:4px;" onclick="openMercSelectModal(1)">동료 교체</button>';
    html += '<button class="btn-main" style="padding:5px; font-size:0.75rem; width:100%;"' + (!m1Obj ? ' disabled style="opacity:0.5;"' : '') + ' onclick="openExpSkillSelectModal(\'m1\')">' + m1SkillName + '</button>';
    html += '</div>';

    // [슬롯 2: 동료 2]
    html += '<div style="border:2px solid var(--BorderColor); background:var(--BgDashboard); border-radius:10px; padding:10px; text-align:center;">';
    html += '<div style="font-size:0.75rem; font-weight:bold; color:var(--Purple); margin-bottom:4px;">[동료 2]</div>';
    if (!isM2Unlocked) {
        html += '<div style="font-size:1.3rem; margin:4px 0;">🔒</div>';
        html += '<div style="font-size:0.7rem; color:var(--TextSub); margin-bottom:6px;">슬롯 잠김</div>';
        html += '<button class="btn-main" style="padding:4px 6px; font-size:0.7rem; background:var(--Yellow);" onclick="openShopModal()">🛒 상점 해금</button>';
    } else {
        html += '<div style="font-size:1.5rem; margin:2px 0;">' + m2IconHtml + '</div>';
        html += '<div style="font-weight:bold; font-size:0.8rem; margin-bottom:4px;">' + m2Name + '</div>';
        html += '<button class="btn-main" style="padding:3px 6px; font-size:0.78rem; background:var(--BgCard); color:var(--TextMain); margin-bottom:4px;" onclick="openMercSelectModal(2)">동료 교체</button>';
        html += '<button class="btn-main" style="padding:5px; font-size:0.75rem; width:100%;"' + (!m2Obj ? ' disabled style="opacity:0.5;"' : '') + ' onclick="openExpSkillSelectModal(\'m2\')">' + m2SkillName + '</button>';
    }
    html += '</div>';

    html += '</div>';

    html += '<div style="display:flex; gap:10px; justify-content:center;">';
    html += '<button class="btn-main" style="background:var(--Blue);" onclick="openMercenaryShop()">🛒 동료 뽑기</button>';
    html += '<button class="btn-main" style="background:var(--Green);" onclick="saveExpeditionSetup()">💾 저장</button>';
    html += '<button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">닫기</button>';
    html += '</div>';

    body.innerHTML = html;
}

// 3. 동료 선택 모달 (도감 형태 카드 그리드 적용)
function openMercSelectModal(slotNum) {
    const s = currentStudent;
    const unlockedMercIds = (s.unlocked_mercenaries || '').replace(/!/g, '').split(',').map(m => m.trim()).filter(Boolean);
    const userMercs = (mercenariesData || []).filter(m => unlockedMercIds.includes(String(m.merc_id)));

    const body = document.getElementById('modalBody');
    let html = '<h2 style="color:var(--Highlight); text-align:center; margin-top:0;">🛡️ 동료 ' + slotNum + ' 선택</h2>';
    html += '<p style="text-align:center; color:var(--TextSub); font-size:0.85rem; margin-bottom:15px;">배치할 동료를 선택하세요. (가호 옵션 자동 적용)</p>';

    // 💡 도감 형태의 카드 그리드 컨테이너
    html += '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(115px, 1fr)); gap:10px; max-height:380px; overflow-y:auto; padding:5px; margin-bottom:15px;">';

    // 1. 미배치 (해제) 카드
    html += '<div style="background:var(--BgDashboard); border:2px dashed var(--BorderColor); border-radius:12px; padding:10px 6px; text-align:center; display:flex; flex-direction:column; justify-content:space-between; align-items:center;">';
    html += '  <div style="font-size:30px; margin:5px 0;">👤</div>';
    html += '  <div style="font-weight:bold; font-size:0.8em; color:var(--TextSub); margin-bottom:8px; line-height:1.2;">미배치<br>(동료 해제)</div>';
    html += '  <button class="small-btn" style="width:100%; background:var(--TextSub); padding:6px 0; border:none;" onclick="selectMercForSlot(' + slotNum + ', \'\')">해제</button>';
    html += '</div>';

    // 2. 가호 옵션 명칭 매핑 사전
    const optTypeMap = {
        'HP_UP': '체력', 'DEF_UP': '방어력', 'ATK_UP': '공격력',
        'LUK_UP': '행운', 'CRIT_UP': '치명타율', 'CRIT_DMG_UP': '치명피해',
        'DAMAGE_REDUCE': '피해감소', 'DEF_PEN': '방어관통', 'DMG_UP': '피해증가',
        'SKILL_DMG': '스킬피해', 'HEAL_UP': '회복량', 'EVD_UP': '회피율'
    };

    // 3. 보유 용병 카드 목록 생성
    userMercs.forEach(m => {
        let isOtherSlot = false;
        if (slotNum === 1 && String(tempExpedition.m2) === String(m.merc_id)) isOtherSlot = true;
        if (slotNum === 2 && String(tempExpedition.m1) === String(m.merc_id)) isOtherSlot = true;

        const tier = String(m.tier || 'C').toUpperCase();
        let tierColor = 'var(--Green)';
        if (tier === 'B') tierColor = 'var(--Blue)';
        if (tier === 'A') tierColor = 'var(--Purple)';
        if (tier === 'S') tierColor = 'var(--Yellow)';

        const isCurrentAssigned = (slotNum === 1 && String(tempExpedition.m1) === String(m.merc_id)) || (slotNum === 2 && String(tempExpedition.m2) === String(m.merc_id));

        let cardBorder = isCurrentAssigned
            ? 'border:2px solid ' + tierColor + '; box-shadow: 0 0 10px ' + tierColor + ';'
            : (isOtherSlot ? 'border:2px solid var(--BorderColor); opacity:0.6;' : 'border:2px solid var(--BorderColor);');

        const optName = optTypeMap[String(m.option_type).toUpperCase()] || m.option_type;
        const isPct = String(m.option_calc_type).toUpperCase() === 'PERCENT';
        const optValStr = isPct ? (Number(m.option_value) * 100) + '%' : m.option_value;

        const iconSrc = m.icon_url || '';
        const iconHtml = iconSrc
            ? '<img src="' + iconSrc + '" style="width:48px; height:48px; object-fit:contain; border-radius:50%; background:#111; border:2px solid ' + tierColor + '; padding:2px;">'
            : '<div style="font-size:32px;">🛡️</div>';

        let btnText = '선택';
        let btnBg = 'var(--Highlight)';
        if (isCurrentAssigned) { btnText = '배치중'; btnBg = tierColor; }
        else if (isOtherSlot) { btnText = '다른슬롯'; btnBg = 'var(--TextSub)'; }

        html += '<div style="background:#FFFFFF; ' + cardBorder + ' border-radius:12px; padding:10px 6px; text-align:center; display:flex; flex-direction:column; justify-content:space-between; align-items:center; transition:0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.05);">';
        html += '  <div style="font-size:0.7em; font-weight:bold; color:' + tierColor + '; margin-bottom:2px;">[' + tier + '급]</div>';
        html += '  ' + iconHtml;
        html += '  <div style="font-weight:bold; font-size:0.85em; color:var(--TextMain); margin:4px 0 2px 0; word-break:keep-all; line-height:1.2;">' + m.name + '</div>';
        html += '  <div style="font-size:0.7em; color:var(--TextSub); font-weight:bold; margin-bottom:8px; white-space:nowrap;">✨ ' + optName + ' +' + optValStr + '</div>';
        html += '  <button class="small-btn" style="width:100%; background:' + btnBg + '; padding:6px 0; border:none;" onclick="selectMercForSlot(' + slotNum + ', \'' + m.merc_id + '\')">' + btnText + '</button>';
        html += '</div>';
    });

    html += '</div>';
    html += '<button class="btn-main" style="background:var(--TextSub);" onclick="renderExpeditionUI()">취소</button>';
    body.innerHTML = html;
}

// 동료 선택/해제 처리
function selectMercForSlot(slotNum, mercId) {
    if (slotNum === 1) {
        if (tempExpedition.m2 === mercId && mercId !== '') {
            tempExpedition.m2 = '';
            tempExpedition.m2_skill = '';
        }
        tempExpedition.m1 = mercId;
        if (!mercId) tempExpedition.m1_skill = '';
    } else if (slotNum === 2) {
        if (tempExpedition.m1 === mercId && mercId !== '') {
            tempExpedition.m1 = '';
            tempExpedition.m1_skill = '';
        }
        tempExpedition.m2 = mercId;
        if (!mercId) tempExpedition.m2_skill = '';
    }
    renderExpeditionUI();
}

// 4. 스킬 선택 모달 (카드 그리드 디자인 적용)
function openExpSkillSelectModal(targetSlot) {
    const s = currentStudent;
    const unlockedSkillIds = (s.unlocked_skills || '').replace(/!/g, '').split(',').map(sk => sk.trim()).filter(Boolean);
    const userSkills = (skillsData || []).filter(sk => unlockedSkillIds.includes(String(sk.skill_id)));

    if (userSkills.length === 0) {
        showUiAlert('⚠️ 스킬 없음', '보유한 스킬이 없습니다.<br>스킬 상점에서 스킬을 먼저 뽑아주세요!', '');
        return;
    }

    const body = document.getElementById('modalBody');
    let html = '<h2 style="color:var(--Highlight); text-align:center; margin-top:0;">📜 원정대 스킬 선택</h2>';
    html += '<p style="text-align:center; color:var(--TextSub); font-size:0.85rem; margin-bottom:15px;">동료에게 부여할 스킬을 선택하세요.</p>';

    // 💡 카드 그리드 컨테이너
    html += '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(115px, 1fr)); gap:10px; max-height:350px; overflow-y:auto; padding:5px; margin-bottom:15px;">';

    userSkills.forEach(sk => {
        let occupiedPos = '';
        if (String(currentStudent.equipped_1) === String(sk.skill_id)) occupiedPos = '대표 캐릭터';
        else if (String(tempExpedition.m1_skill) === String(sk.skill_id)) occupiedPos = '동료 1';
        else if (String(tempExpedition.m2_skill) === String(sk.skill_id)) occupiedPos = '동료 2';

        const skBlessing = sk.blessing && String(sk.blessing).trim() !== '' && String(sk.blessing).trim() !== 'None' ? String(sk.blessing).trim() : 'Highlight';
        const bColor = 'var(--' + skBlessing + ')';

        const isCurrentTargetSlot = (targetSlot === 'm1' && String(tempExpedition.m1_skill) === String(sk.skill_id)) || (targetSlot === 'm2' && String(tempExpedition.m2_skill) === String(sk.skill_id));

        let cardBorder = isCurrentTargetSlot
            ? 'border:2px solid ' + bColor + '; box-shadow: 0 0 10px ' + bColor + ';'
            : (occupiedPos ? 'border:2px solid var(--BorderColor); opacity:0.75;' : 'border:2px solid var(--BorderColor);');

        let iconDisplay = sk.icon_url
            ? '<img src="' + sk.icon_url + '" style="width:48px; height:48px; object-fit:contain; image-rendering:pixelated; border-radius:8px; background:#111; border:2px solid ' + bColor + '; padding:2px;">'
            : '<div style="font-size:32px;">📜</div>';

        let badgeText = occupiedPos ? '장착중: ' + occupiedPos : '⏳ 쿨타임 ' + (sk.cooldown || 0) + '턴';
        let badgeColor = occupiedPos ? 'var(--TextGold)' : 'var(--Red)';

        let btnText = '선택';
        let btnBg = 'var(--Highlight)';
        if (isCurrentTargetSlot) { btnText = '배치중'; btnBg = bColor; }
        else if (occupiedPos) { btnText = '교체'; btnBg = 'var(--Yellow)'; }

        html += '<div style="background:#FFFFFF; ' + cardBorder + ' border-radius:12px; padding:10px 6px; text-align:center; display:flex; flex-direction:column; justify-content:space-between; align-items:center; transition:0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.05);">';
        html += '  ' + iconDisplay;
        html += '  <div style="font-weight:bold; font-size:0.85em; color:var(--TextMain); margin:6px 0 2px 0; word-break:keep-all; line-height:1.2;">' + sk.name + '</div>';
        html += '  <div style="font-size:0.68em; color:' + badgeColor + '; font-weight:bold; margin-bottom:8px; white-space:nowrap;">' + badgeText + '</div>';
        html += '  <button class="small-btn" style="width:100%; background:' + btnBg + '; padding:6px 0; border:none;" onclick="applySkillToSlot(\'' + targetSlot + '\', \'' + sk.skill_id + '\', \'' + occupiedPos + '\')">' + btnText + '</button>';
        html += '</div>';
    });

    html += '</div>';
    html += '<button class="btn-main" style="background:var(--TextSub);" onclick="renderExpeditionUI()">취소</button>';
    body.innerHTML = html;
}

// 스킬 장착 & 기존 중복 장착 슬롯 자동 해제(Swap) - 커스텀 UI 적용
function applySkillToSlot(targetSlot, skillId, occupiedPos, force = false) {
    if (occupiedPos && !force) {
        if (occupiedPos === '대표 캐릭터') {
            showUiAlert('⚠️ 장착 불가', '대표 캐릭터가 사용 중인 메인 대표 스킬입니다.<br><span style="font-size:0.85em; color:var(--TextSub);">(해당 스킬을 동료에게 지정하려면 장비 탭에서 먼저 해제해 주세요.)</span>', '');
            return;
        }

        showUiConfirm(
            '🔄 스킬 교체',
            '이미 <b>[' + occupiedPos + ']</b>이(가) 장착 중인 스킬입니다.<br>기존 슬롯에서 해제하고 이 슬롯으로 옮기시겠습니까?',
            "applySkillToSlot('" + targetSlot + "', '" + skillId + "', '" + occupiedPos + "', true)"
        );
        return;
    }

    if (occupiedPos === '동료 1') tempExpedition.m1_skill = '';
    if (occupiedPos === '동료 2') tempExpedition.m2_skill = '';

    if (targetSlot === 'm1') tempExpedition.m1_skill = skillId;
    if (targetSlot === 'm2') tempExpedition.m2_skill = skillId;

    renderExpeditionUI();
}

// 5. 원정대 최종 저장
function saveExpeditionSetup() {
    currentStudent.party_m1 = tempExpedition.m1;
    currentStudent.party_m2 = tempExpedition.m2;
    currentStudent.party_s1 = tempExpedition.m1_skill;
    currentStudent.party_s2 = tempExpedition.m2_skill;

    updateFastFirebaseStudent(currentStudent);
    showUiAlert('⚔️ 저장 완료', '원정대 배치가 성공적으로 저장되었습니다!', '');
    renderDashboard();
}

// ==========================================
// 🏷️ 칭호 장착 시스템
// ==========================================
function openTitleUI() {
    const body = document.getElementById('modalBody');
    const s = currentStudent;
    let titles = ['칭호 없음'];

    // 1. 전투/토벌 칭호
    let rawMonsters = String(s.monster_data || "").replace(/!/g, '');
    let monsterKills = rawMonsters ? rawMonsters.split(',').map(x => x.trim()).filter(Boolean) : [];

    if (monsterKills.length >= 5) titles.push('[초보 사냥꾼]');

    let killCounts = {};
    monsterKills.forEach(id => { killCounts[id] = (killCounts[id] || 0) + 1; });

    monsterList.forEach(m => {
        if (killCounts[m.monster_id] >= 10) titles.push('[' + m.name + ' 학살자]');
    });
    bossList.forEach(b => {
        if (killCounts[b.boss_id] >= 1) {
            if (b.name.includes("오우거") || b.name.includes("와이번") || b.name.includes("드래곤")) {
                titles.push('[' + b.name.replace('[보스] ', '') + ' 슬레이어]');
            }
            if (b.name.includes("마왕")) titles.push('[마왕 토벌자]');
        }
    });

    // 2. 한계 돌파 칭호
    let maxFloor = Number(s.max_tower_floor) || 0;
    if (maxFloor >= 10) titles.push('[탑의 도전자]');
    if (maxFloor >= 20) titles.push('[한계를 넘은 자]');
    if (maxFloor >= 23) titles.push('[하늘에 닿은 자]');

    // 3. 학업/성실성 칭호
    let reading = Number(s.reading_count) || 0;
    if (reading >= 10) titles.push('[지식의 탐구자]');
    if (reading >= 30) titles.push('[진리의 수호자]');
    if ((Number(s.quest_count) || 0) >= 50) titles.push('[길드의 모범생]');

    // 4. 히든/예능 칭호
    if ((Number(s.total_forge_fail) || 0) >= 10) {
        titles.push('[파괴의 손]');
    }
    if ((Number(s.flee_count) || 0) >= 5) titles.push('[겁쟁이]');
    if (Number(s.weapon_lv) === 9 || Number(s.head_lv) === 9 || Number(s.body_lv) === 9 || Number(s.accessory_lv) === 9) {
        titles.push('[대장장이의 절친]');
    }
    if ((Number(s.relic_pull_count) || 0) >= 10) titles.push('[항아리 브레이커]');

    // 5. 선생님 수동 부여 (커스텀) 칭호
    let rawCustom = String(s.custom_titles || "").replace(/!/g, '');
    let customTitles = rawCustom ? rawCustom.split(',').map(x => x.trim()).filter(Boolean) : [];
    titles = titles.concat(customTitles);

    // 중복 제거
    titles = [...new Set(titles)];

    let html = '<h2 style="color:var(--Yellow);">🏷️ 칭호 장착</h2><p style="color:var(--TextSub);">획득한 칭호를 선택하여 이름 위에 장식하세요!</p><div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-bottom:20px;">';

    const currentTitle = s.equipped_title || '칭호 없음';

    titles.forEach(t => {
        let isEq = (t === currentTitle);
        let bg = isEq ? 'var(--Highlight)' : 'var(--BgDashboard)';
        let color = isEq ? '#fff' : 'var(--TextMain)';
        let border = isEq ? 'var(--Highlight)' : 'var(--BorderColor)';
        // 💡 바로 이 부분의 따옴표 충돌이 해결되었습니다.
        html += '<button style="padding:10px 15px; border-radius:20px; border:2px solid ' + border + '; background:' + bg + '; color:' + color + '; font-weight:bold; cursor:pointer;" onclick="equipTitle(\'' + t + '\')">' + t + '</button>';
    });

    html += '</div><button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">돌아가기</button>';
    body.innerHTML = html;
}

function equipTitle(title) {
    const actualTitle = title === '칭호 없음' ? '' : title;
    currentStudent.equipped_title = actualTitle;
    renderDashboard();
    updateFastFirebaseStudent(currentStudent);
    showUiAlert("🏷️ 칭호 변경", "칭호가 [" + title + "](으)로 변경되었습니다!", "");
}