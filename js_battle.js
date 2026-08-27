// 대시보드 위로 사냥터 선택 창을 띄웁니다.
function openStageSelection() {
    // 💡 1. 주간 횟수 소진 여부 체크
    const maxWeekly = Number(sysConfig.max_weekly_battles) || 2;
    const currentWeekly = currentStudent.weekly_battles !== undefined ? Number(currentStudent.weekly_battles) : maxWeekly;

    if (currentWeekly <= 0) {
        showUiAlert('🚫 입장 불가', '이번 주 모험 횟수를 모두 소진했습니다.<br><span style="font-size:0.8em; color:#aaa;">(매주 월요일 자정 초기화)</span>', '');
        return;
    }

    // 💡 2. penalty_end_time 직관적 비교 기반 패널티 시간 정밀 점검
    if (currentStudent.penalty_end_time) {
        const penaltyEndTime = Number(currentStudent.penalty_end_time);
        const now = new Date().getTime();
        if (now < penaltyEndTime) {
            const remainMs = penaltyEndTime - now;
            const remainH = Math.floor(remainMs / (1000 * 60 * 60));
            const remainM = Math.floor((remainMs % (1000 * 60 * 60)) / (1000 * 60));

            const isFleePenalty = remainMs <= (2 * 60 * 60 * 1000);
            const penaltyTitle = isFleePenalty ? '🏃 후퇴 후 재정비 중' : '🩹 중상 (회복 중)';
            showUiAlert(penaltyTitle, '부상 또는 패널티로 인해 회복 중입니다.<br><br><span style="color:#ff4d4d; font-weight:bold; font-size:1.2em;">남은 시간: ' + remainH + '시간 ' + remainM + '분</span>', '');
            return;
        }
    }

    // 💡 3. 이상 없으면 사냥터 출력
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = '#0F172A';
    subModal.querySelector('.modal-content').style.borderColor = '#1E293B';

    // 💡 사냥터 모달 창 자체를 다크 테마로 강제 변환
    subModal.querySelector('.modal-content').style.background = '#0F172A';
    subModal.querySelector('.modal-content').style.borderColor = '#1E293B';

    let html =
        '<h2 style="color:var(--Red); margin-bottom: 5px;">⚔️ 사냥터 선택</h2>' +
        '<p style="color:#CBD5E1; font-size:0.9em;">자신의 능력치에 맞는 몬스터를 선택해 도전하세요!</p>' +
        '<div class="stage-container">';

    monsterList.forEach(m => {
        const starString = '★'.repeat(Number(m.difficulty) || 1);
        const imgSrc = m.icon_url ? m.icon_url : 'https://via.placeholder.com/80/444444/FFFFFF?text=No+Img';

        html +=
            '<div class="monster-card">' +
            '  <div class="stars" style="color:var(--Yellow);">' + starString + '</div>' +
            '  <img src="' + imgSrc + '" alt="' + m.name + '" style="width:80px; height:80px; object-fit:contain; margin-bottom:10px;">' +
            '  <h4 style="margin: 5px 0; color: white;">' + m.name + '</h4>' +
            '  <div style="font-size: 0.85em; color: #ccc; margin-bottom: 10px;">' +
            '    ❤️ ' + m.hp + ' | ⚔️ ' + m.atk +
            '  </div>' +
            '  <button class="small-btn" style="width: 100%; background: var(--BtnBattle); color: white; border: none; padding: 8px; border-radius: 5px; cursor: pointer;" onclick="enterBattle(\'' + m.monster_id + '\')">도전하기</button>' +
            '</div>';
    });

    html +=
        '</div>' +
        '<button style="margin-top:20px; width:100%; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeSubModal()">닫기</button>';

    subBody.innerHTML = html;
    subModal.style.display = 'flex';
}

// --- 전투 화면으로 진입 ---
function enterBattle(monsterId, isBoss = false) {
    // 💡 일반 몬스터인지 보스인지에 따라 데이터를 가져옵니다.
    const targetMonster = isBoss ? bossList.find(b => String(b.boss_id).trim() === String(monsterId).trim()) : monsterList.find(m => String(m.monster_id).trim() === String(monsterId).trim());
    if (!targetMonster) return alert("대상의 정보를 찾을 수 없습니다.");

    battleState.isTower = false;
    closeSubModal();
    document.getElementById('singlePlayerContainer').style.display = 'block';
    document.getElementById('partyPlayerContainer').style.display = 'none';
    document.getElementById('raidStageInfo').style.display = 'none';

    const pStats = getPlayerTotalStats();

    // 💡 [신규] 보스전 기믹 설정 추가
    battleState.isBoss = isBoss;
    battleState.gimmick_type = isBoss ? String(targetMonster.gimmick_type || '없음').trim().toLowerCase() : '없음';
    battleState.gimmick_value = isBoss ? Number(targetMonster.gimmick_value) || 0 : 0;
    battleState.turnCount = 1;

    battleState.isFleeing = false;
    battleState.monster = targetMonster;
    battleState.monsterMaxHp = Number(targetMonster.hp);
    battleState.monsterCurrentHp = battleState.monsterMaxHp;

    // 💡 1. 가호 보너스가 계산되기 전 스탯 임시 변수 할당
    let baseHp = pStats.hp;
    let baseAtk = pStats.atk;
    let baseDef = pStats.def;
    let baseLuk = pStats.luk;

    const bColor = String(currentStudent.blessing).trim();
    if (bColor === 'Red' || bColor === '빨간색') {
        baseAtk = Math.floor(baseAtk * 1.1);
    } else if (bColor === 'Blue' || bColor === '파란색') {
        baseDef = Math.floor(baseDef * 1.1);
    } else if (bColor === 'Green' || bColor === '초록색') {
        baseHp = Math.floor(baseHp * 1.1);
    } else if (bColor === 'Yellow' || bColor === '노란색') {
        baseLuk = Math.floor(baseLuk * 1.1);
    }

    // 💡 2. 최종 체력 계산 및 세션 데이터 주입 (중복 대입 없이 한 번만 처리됩니다)
    const hpPerPoint = Number(sysConfig.hp_per_point) || 10;
    battleState.playerMaxHp = baseHp * hpPerPoint;
    battleState.playerCurrentHp = battleState.playerMaxHp;

    battleState.playerAtk = baseAtk;
    battleState.playerDef = baseDef;
    battleState.playerLuk = baseLuk;

    // 보라색(그림자): 첫 타격 1회 무효화 장막 활성화 플래그 (true로 켜둠)
    battleState.purpleDodgeActive = (bColor === 'Purple' || bColor === '보라색');

    // 💡 3. 유물 특수 효과를 추출하여 전투 상태에 미리 저장해둡니다.
    battleState.relicEffects = { dodge: 0, critRate: 0, critDmg: 0, regen: 0, skillProb: 0, goldMult: 0 };
    [currentStudent.relic_1, currentStudent.relic_2].forEach(rid => {
        if (rid && rid !== 'null' && rid !== 'false') {
            const r = relicsData.find(x => String(x.relic_id) === String(rid));
            if (r) {
                const t = String(r.effect_type).toLowerCase();
                const v = Number(r.value) || 0;
                if (t === 'dodge_up') battleState.relicEffects.dodge += v * 100;
                if (t === 'crit_up') battleState.relicEffects.critRate += v * 100;
                if (t === 'crit_dmg') battleState.relicEffects.critDmg += v;
                if (t === 'hp_regen') battleState.relicEffects.regen += v;
                if (t === 'skill_prob') battleState.relicEffects.skillProb += v * 100;
                if (t === 'gold_up') battleState.relicEffects.goldMult += v;
            }
        }
    });

    // 💡 [수정] 동료(용병) 특수 옵션 추출 추가
    [currentStudent.party_m1, currentStudent.party_m2].forEach(mId => {
        if (mId && mId !== 'null' && mId !== 'false' && String(mId).trim() !== '') {
            const merc = mercenariesData.find(x => String(x.merc_id) === String(mId));
            if (merc) {
                const t = String(merc.option_type).toUpperCase();
                const v = Number(merc.option_value) || 0;
                if (t === 'EVD_UP') battleState.relicEffects.dodge += v * 100;
                if (t === 'CRIT_UP') battleState.relicEffects.critRate += v * 100;
                if (t === 'CRIT_DMG_UP') battleState.relicEffects.critDmg += v;
            }
        }
    });
    // --------------------------------------------------------

    battleState.playerEffects = [];
    battleState.monsterEffects = [];

    // 💡 몬스터 스킬 로드 (다양한 열 이름 예외 처리 및 디버그 로그)
    battleState.monsterSkill = null;
    battleState.monsterCd = 1;
    // 시트의 열 이름이 skill_list, skill_id, skill 중 하나일 경우 대응
    const mSkillId = targetMonster.skill_list || targetMonster.skill_id || targetMonster.skill;

    console.log("불러온 몬스터 스킬 ID:", mSkillId);

    if (mSkillId) {
        const msData = monsterSkillsData.find(x => String(x.skill_id) === String(mSkillId).trim());
        if (msData) {
            battleState.monsterSkill = msData;
        } else {
            console.log("❌ monsterSkillsData에서 ID가 '" + mSkillId + "'인 스킬을 찾지 못했습니다.");
        }
    }
    document.getElementById('battleTitle').innerText = '⚠️ 야생의 [' + targetMonster.name + '] 등장!';

    const pNameEl = document.getElementById('battlePlayerName');
    pNameEl.innerHTML = getTitleHtml(currentStudent);
    pNameEl.style.color = `var(--${currentStudent.blessing || 'Highlight'})`;
    pNameEl.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';

    document.getElementById('battleMonsterName').innerText = targetMonster.name;

    // 💡 1. 플레이어 스킨 동적 적용 (현재 장착 중인 스킨 불러오기)
    const currentSkinId = currentStudent.equipped_skin || 'HD001';
    const skinObj = skinsData.find(x => String(x.skin_id) === String(currentSkinId));
    const pImgSrc = (skinObj && skinObj.skin_url) ? skinObj.skin_url : 'https://drive.google.com/thumbnail?id=1uoFPxFfpUaxE3eZCbrVU8oEvQLyQTg9b&sz=w200';
    document.getElementById('battlePlayerImg').src = pImgSrc;

    // 💡 동료 1, 2 미니 아바타 렌더링
    const m1Box = document.getElementById('merc1BattleBox');
    const m1Img = document.getElementById('merc1BattleImg');
    if (m1Box && m1Img) {
        const m1Obj = mercenariesData.find(m => String(m.merc_id) === String(currentStudent.party_m1));
        if (m1Obj && m1Obj.icon_url) {
            m1Img.src = m1Obj.icon_url;
            m1Box.style.display = 'flex';
        } else {
            m1Box.style.display = 'none';
        }
    }

    const m2Box = document.getElementById('merc2BattleBox');
    const m2Img = document.getElementById('merc2BattleImg');
    if (m2Box && m2Img) {
        const m2Obj = mercenariesData.find(m => String(m.merc_id) === String(currentStudent.party_m2));
        if (m2Obj && m2Obj.icon_url) {
            m2Img.src = m2Obj.icon_url;
            m2Box.style.display = 'flex';
        } else {
            m2Box.style.display = 'none';
        }
    }

    // 💡 2. 몬스터 이미지 렌더링 및 사이즈 지정 (공중부양 해결)
    const imgSrc = targetMonster.icon_url ? targetMonster.icon_url : 'https://via.placeholder.com/120/444444/FFFFFF?text=Monster';
    const mImg = document.getElementById('battleMonsterImg');
    mImg.src = imgSrc;

    const sizeMap = { 1: 120, 2: 180, 3: 240, 4: 300 };
    const mSize = Number(targetMonster.size) || 2;
    const finalSize = sizeMap[mSize] || 120;

    // 부모 div를 억지로 건드리지 않고, 화면에 보이는 최종 크기만 CSS로 지정합니다.
    mImg.style.width = finalSize + 'px';
    mImg.style.height = finalSize + 'px';

    // 몬스터 픽셀화 (수치를 64, 128, 192 등으로 조절하여 도트 블록의 크기를 결정합니다)
    mImg.width = 64;
    mImg.height = 64;
    mImg.classList.add('pixelated-monster');

    document.getElementById('battleLog').innerHTML = '';

    setupPlayerSkills();
    renderMonsterSkillsUI(); // 💡 이 줄을 새로 추가합니다! (몬스터 스킬 아이콘 렌더링)
    updateHpBars();

    logBattle('[' + targetMonster.name + ']과(와) 마주쳤습니다!');
    logBattle('(내 스펙 - 최대 체력: ' + battleState.playerMaxHp + ', 공격력: ' + battleState.playerAtk + ', 방어력: ' + battleState.playerDef + ', 행운: ' + battleState.playerLuk + ')');

    document.getElementById('battleModal').style.display = 'flex';

    battleState.isAutoRunning = true;
    battleState.turnTimer = setTimeout(playerTurnAuto, 1000);
}

// --- 2. 체력바 UI 갱신 (에러 원인 복구) ---
function updateHpBars() {
    const pPercent = Math.max(0, (battleState.playerCurrentHp / battleState.playerMaxHp) * 100);
    const mPercent = Math.max(0, (battleState.monsterCurrentHp / battleState.monsterMaxHp) * 100);

    document.getElementById('playerHpBar').style.width = pPercent + '%';
    document.getElementById('playerHpText').innerText = 'HP: ' + battleState.playerCurrentHp + ' / ' + battleState.playerMaxHp;

    document.getElementById('monsterHpBar').style.width = mPercent + '%';
    document.getElementById('monsterHpText').innerText = 'HP: ' + battleState.monsterCurrentHp + ' / ' + battleState.monsterMaxHp;

    // 💡 체력이 바뀔 때마다 상태이상 뱃지도 같이 다시 그려줍니다!
    renderStatusEffectsUI();
}

// --- 3. 전투 로그 출력 ---
function logBattle(message) {
    const logBox = document.getElementById('battleLog');
    logBox.innerHTML += '<div style="margin-bottom: 5px;">> ' + message + '</div>';
    logBox.scrollTop = logBox.scrollHeight;
}

// --- 4. 도망치기 ---
function fleeBattle() {
    battleState.isAutoRunning = false;
    battleState.isFleeing = true;
    clearTimeout(battleState.turnTimer);

    if (battleState.isTower) {
        document.getElementById('battleModal').style.display = 'none';
        endTowerAndReward(false);
        return;
    }

    // 💡 [신규] 월드 보스전 도망 시 일반 사냥 패널티 없이 안전하게 월드보스 결과 정산으로 연결
    if (battleState.isWorldBoss) {
        finishWorldBossSession(false);
        return;
    }

    document.getElementById('battleModal').style.display = 'none';

    if (battleState.isRaid) {
        const maxRaid = Number(sysConfig.max_weekly_raid) || 1;
        let curRaid = (currentStudent.weekly_raid !== undefined && currentStudent.weekly_raid !== "") ? Number(currentStudent.weekly_raid) : maxRaid;
        currentStudent.weekly_raid = Math.max(0, curRaid - 1);
        updateFastFirebaseStudent(currentStudent);

        showUiAlert("🏃 레이드 포기", "파티 레이드에서 후퇴했습니다.<br><span style='color:#ff4d4d; font-size:0.9em;'>(파티원 전원의 탐험 기회가 1 차감됩니다.)</span>", "renderDashboard()");
        return;
    }

    let pTime = new Date().getTime();
    currentStudent.last_defeat = pTime;

    currentStudent.penalty_end_time = pTime + (2 * 60 * 60 * 1000);
    currentStudent.flee_count = (Number(currentStudent.flee_count) || 0) + 1;
    updateFastFirebaseStudent(currentStudent);

    if (battleState.isBoss) {
        showUiAlert("🏃 보스전 이탈", "보스의 무시무시한 힘에 압도당해 도망쳤습니다!<br><br><span style='font-size:0.95em; color:#ff4d4d;'>(재정비를 위해 <b style='color:white;'>2시간 동안</b> 모든 사냥 및 보스전 진입이 금지됩니다.)</span>", "renderDashboard()");
    } else {
        showUiAlert("🏃 전략적 후퇴", "전투에서 안전하게 도망쳤습니다.<br><br><span style='font-size:0.95em; color:#ff4d4d;'>(재정비를 위해 <b style='color:white;'>2시간 동안</b> 모험을 떠날 수 없습니다.)</span>", "renderDashboard()");
    }
}

// --- 버튼 잠금 컨트롤 (턴 꼬임 방지) ---
function toggleBattleButtons(isDisabled) {
    const actionDiv = document.getElementById('battleActionButtons');
    const buttons = actionDiv.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = isDisabled);
}

// --- 플레이어 최종 스탯 (시트 데이터 그대로 사용) ---
function getPlayerTotalStats() {
    const s = currentStudent;

    // 시트에 입력된 포인트(기본 5 등)를 그대로 가져옵니다.
    const baseHp = Number(s.hp_points) || 0;
    const baseAtk = Number(s.atk_points) || 0;
    const baseDef = Number(s.def_points) || 0;
    const baseLuk = Number(s.luk_points) || 0;

    const rW = (Number(sysConfig.rate_weapon) || 7) / 100;
    const rH = (Number(sysConfig.rate_head) || 5) / 100;
    const rB = (Number(sysConfig.rate_body) || 5) / 100;
    const rA = (Number(sysConfig.rate_acc) || 5) / 100;

    let equipBonus = {
        hp: baseHp * rH * (Number(s.head_lv) || 0),
        atk: baseAtk * rW * (Number(s.weapon_lv) || 0),
        def: baseDef * rB * (Number(s.body_lv) || 0),
        luk: baseLuk * rA * (Number(s.accessory_lv) || 0)
    };

    let relicBonus = { hp: 0, atk: 0, def: 0, luk: 0 };
    const applyRelic = (relicId) => {
        if (relicId && String(relicId).trim() !== '' && relicId !== 'null' && relicId !== 'false') {
            const r = relicsData.find(x => String(x.relic_id) === String(relicId));
            if (r) {
                const val = Number(r.value) || 0;
                // 💡 유물 스탯 계산 개편 (고정 증가만 여기서 처리)
                const t = String(r.effect_type).toLowerCase();
                if (t === 'hp_up') relicBonus.hp += val;
                if (t === 'atk_up') relicBonus.atk += val;
                if (t === 'def_up') relicBonus.def += val;
                if (t === 'luk_up') relicBonus.luk += val;
            }
        }
    };
    applyRelic(s.relic_1);
    applyRelic(s.relic_2);

    // 💡 동료(용병) 스탯 보너스 합산 (DEF_PEN 등 유사 키워드 충돌 방지)
    let mercBonus = { hp: 0, atk: 0, def: 0, luk: 0 };
    [s.party_m1, s.party_m2].forEach(mId => {
        if (mId && mId !== 'null' && mId !== 'false' && String(mId).trim() !== '') {
            const merc = mercenariesData.find(x => String(x.merc_id) === String(mId));
            if (merc) {
                const val = Number(merc.option_value) || 0;
                const isPct = String(merc.option_calc_type).toUpperCase() === 'PERCENT';
                const type = String(merc.option_type).toUpperCase();

                if (type === 'HP_UP' || type === 'HP') mercBonus.hp += isPct ? Math.floor((baseHp + equipBonus.hp) * val) : val;
                if (type === 'ATK_UP' || type === 'ATK') mercBonus.atk += isPct ? Math.floor((baseAtk + equipBonus.atk) * val) : val;
                if (type === 'DEF_UP' || type === 'DEF') mercBonus.def += isPct ? Math.floor((baseDef + equipBonus.def) * val) : val;
                if (type === 'LUK_UP' || type === 'LUK') mercBonus.luk += isPct ? Math.floor((baseLuk + equipBonus.luk) * val) : val;
            }
        }
    });

    // 💡 곱연산(mult) 유물 효과를 최종 스탯에 적용 (동료 보너스도 함께 합산)
    let totalHp = baseHp + equipBonus.hp + relicBonus.hp + mercBonus.hp;
    let totalAtk = baseAtk + equipBonus.atk + relicBonus.atk + mercBonus.atk;
    let totalDef = baseDef + equipBonus.def + relicBonus.def + mercBonus.def;

    const applyMult = (relicId) => {
        if (relicId && String(relicId).trim() !== '' && relicId !== 'null' && relicId !== 'false') {
            const r = relicsData.find(x => String(x.relic_id) === String(relicId));
            if (r) {
                const t = String(r.effect_type).toLowerCase();
                const val = Number(r.value) || 0;
                if (t === 'hp_mult') totalHp *= (1 + val);
                if (t === 'atk_mult') totalAtk *= (1 + val);
                if (t === 'def_mult') totalDef *= (1 + val);
            }
        }
    };
    applyMult(s.relic_1);
    applyMult(s.relic_2);

    return {
        hp: Math.floor(totalHp),
        atk: Math.floor(totalAtk),
        def: Math.floor(totalDef),
        luk: Math.floor(baseLuk + equipBonus.luk + relicBonus.luk + mercBonus.luk)
    };
}

// --- 전투 시스템 전역 변수 (몬스터 스킬 상태 추가) ---
if (typeof battleState === 'undefined') {
    var battleState = {
        isTower: false,
        towerFloor: 0,
        towerBossCount: 0,
        towerMonsterIds: [],
        monster: null,
        playerMaxHp: 0,
        playerCurrentHp: 0,
        playerAtk: 0,
        playerDef: 0,
        playerLuk: 0,
        monsterMaxHp: 0,
        monsterCurrentHp: 0,
        skills: [],
        isAutoRunning: false,
        turnTimer: null,
        playerEffects: [],
        monsterEffects: [],
        monsterSkill: null,
        monsterCd: 1
    };
}

// --- 플레이어 및 원정대 동료 스킬 초기화 및 렌더링 ---
function setupPlayerSkills() {
    battleState.skills = [];

    // 대표 스킬 + 동료 1 스킬 + 동료 2 스킬 목록 조합
    const skillSources = [
        { skillId: currentStudent.equipped_1, ownerType: 'hero', mercId: null },
        { skillId: currentStudent.party_s1, ownerType: 'm1', mercId: currentStudent.party_m1 },
        { skillId: currentStudent.party_s2, ownerType: 'm2', mercId: currentStudent.party_m2 }
    ];

    skillSources.forEach(src => {
        if (src.skillId && src.skillId !== 'null' && src.skillId !== 'false' && String(src.skillId).trim() !== '') {
            const skData = skillsData.find(x => String(x.skill_id) === String(src.skillId).trim());
            if (skData) {
                battleState.skills.push({
                    ...skData,
                    currentCd: 0,
                    ownerType: src.ownerType,
                    mercId: src.mercId
                });
            }
        }
    });
    renderBattleSkillsUI();
}

function renderBattleSkillsUI() {
    const container = document.getElementById('playerBattleSkills');
    let html = '';

    battleState.skills.forEach(sk => {
        const isReady = sk.currentCd === 0;
        const iconSrc = sk.icon_url || 'https://via.placeholder.com/50/222222/FFFFFF?text=SK';
        const filterStyle = isReady ? '' : 'filter: grayscale(100%) opacity(0.6);';
        const skBlessing = sk.blessing && String(sk.blessing).trim() !== '' && String(sk.blessing).trim() !== 'None' ? String(sk.blessing).trim() : 'Highlight';
        const bColor = 'var(--' + skBlessing + ')';
        const borderStyle = isReady ? 'border: 2px solid ' + bColor + '; box-shadow: 0 0 10px ' + bColor + ';' : 'border: 2px solid #555;';
        const overlay = isReady ? '' : '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:1.8em; font-weight:bold; color:white; text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;">' + sk.currentCd + '</div>';

        html +=
            '<div style="position:relative; width:50px; height:50px; border-radius:8px; background:#111; ' + borderStyle + ' ' + filterStyle + ' transition: 0.3s;">' +
            '  <img src="' + iconSrc + '" style="width:100%; height:100%; object-fit:contain; border-radius:6px; padding:2px;">' +
            '  ' + overlay +
            '</div>';
    });
    container.innerHTML = html;
}

// 💡 [신규] 서든데스 배율 계산 헬퍼 함수
function getSuddenDeathMults() {
    let sdDmg = 1.0;
    let sdHeal = 1.0;
    if (battleState.isRaid) {
        if (battleState.raidRound >= 10) { sdDmg = 1.5; sdHeal = 0.5; }
        else if (battleState.raidRound >= 5) { sdDmg = 1.2; sdHeal = 0.5; }
    } else {
        if (battleState.turnCount >= 20) { sdDmg = 1.5; sdHeal = 0.5; }
        else if (battleState.turnCount >= 10) { sdDmg = 1.2; sdHeal = 0.5; }
    }
    return { dmg: sdDmg, heal: sdHeal };
}

// 💡 1. 상태이상 영문-한글 번역 사전
const effectTranslator = {
    'poison': '중독', 'bleed': '출혈', 'burn': '화상',
    'stun': '기절', 'freeze': '빙결', 'bind': '구속', 'paralyze': '마비',
    'silence': '침묵', 'stealth': '은신', 'shield': '보호막', 'mana_charge': '마력집중',
    'execution': '처형', 'pierce': '방어관통',
    'atk_down': '공격감소', 'def_down': '방어감소', 'luck_down': '행운감소', 'spd_down': '속도감소',
    'heal': '회복', 'regen': '재생', 'all_stat_down': '저주',
    'super_stun': '강력한기절', 'double_hit': '더블히트', 'triple_hit': '3연격',
    'berserk': '광폭화', 'curse': '저주', 'regen_all': '재생', 'dodge': '회피증가',
    // 👇 몬스터 전용 특수 스킬 번역 (이게 있어야 보스 스킬이 작동함!)
    'ignore_def': '방어관통',
    'hp_rate_damage': '체력비례피해',
    'lifesteal': '흡혈',
    'poison_heal': '맹독흡혈',
    'def_down_bleed': '방깎출혈'
};

// 💡 2. 턴 시작 시 상태이상을 처리하는 중앙 통제 함수 (재생 효과 추가)
function processStatusEffects(isPlayer) {
    let effects = isPlayer ? battleState.playerEffects : battleState.monsterEffects;
    let targetName = isPlayer ? currentStudent.name : battleState.monster.name;
    let canAct = true;

    // 시스템 설정값 (시트의 %값 로드)
    let pRate = (Number(sysConfig.poison_dmg) || 5) / 100;
    let bRate = (Number(sysConfig.bleed_dmg) || 10) / 100;
    let fRate = (Number(sysConfig.burn_dmg) || 3) / 100;

    const sdMults = getSuddenDeathMults();

    for (let i = effects.length - 1; i >= 0; i--) {
        let type = String(effects[i].type);
        let tMax = isPlayer ? battleState.playerMaxHp : battleState.monsterMaxHp;
        let tCur = isPlayer ? battleState.playerCurrentHp : battleState.monsterCurrentHp;

        if (['중독', '출혈', '화상', '저주'].includes(type)) {
            let dmg = 1;
            if (type === '중독') dmg = Math.floor(tMax * pRate);
            if (type === '출혈') dmg = Math.floor(tCur * bRate);
            if (type === '화상') dmg = Math.floor(tMax * fRate);
            if (type === '저주') dmg = Math.floor(tMax * 0.05);

            if (dmg < 1) dmg = 1;
            if (isPlayer) battleState.playerCurrentHp = Math.max(0, battleState.playerCurrentHp - dmg);
            else battleState.monsterCurrentHp = Math.max(0, battleState.monsterCurrentHp - dmg);

            logBattle('<span style="color:#b366ff;">[' + type + ']</span> ' + targetName + '이(가) ' + dmg + '의 지속 피해를 입었습니다!');
            updateHpBars();
        }
        else if (['기절', '빙결', '구속', '마비'].includes(type)) {
            logBattle('💫 <span style="color:#aaa;">' + targetName + '은(는) [' + type + '] 상태라 행동할 수 없습니다!</span>');
            canAct = false;
        }
        else if (type === '재생') {
            let heal = Math.floor(tMax * 0.05 * sdMults.heal);
            if (isPlayer) battleState.playerCurrentHp = Math.min(battleState.playerMaxHp, battleState.playerCurrentHp + heal);
            else battleState.monsterCurrentHp = Math.min(battleState.monsterMaxHp, battleState.monsterCurrentHp + heal);
            logBattle('✨ <span style="color:#4dff88;">[재생]</span> ' + targetName + '이(가) 체력을 ' + heal + ' 회복했습니다!');
            updateHpBars();
        }
    }
    return canAct;
}

// 💡 신규 추가: 스킬 이펙트(GIF) 무한 반복/재생 헬퍼 함수
function playSkillEffect(targetId, gifUrl, duration) {
    if (!gifUrl || String(gifUrl).trim() === '' || String(gifUrl) === 'undefined' || String(gifUrl) === 'null' || String(gifUrl) === 'false') return;

    let effImg = document.getElementById(targetId);
    // 하위 호환성 (일반 전투용)
    if (targetId === 'monster') effImg = document.getElementById('monsterEffectImg');
    if (targetId === 'player') effImg = document.getElementById('playerEffectImg');

    if (!effImg) return;

    // 이중 방어: 로딩 실패 시 즉시 투명화
    effImg.onerror = function () { this.style.display = 'none'; };
    effImg.style.display = 'none';
    effImg.src = '';

    // 구글 드라이브 링크 차단을 막기 위해 순수 주소만 꽂고 0.05초 뒤 출력하여 강제 재생
    setTimeout(() => {
        effImg.src = gifUrl;
        effImg.style.display = 'block';
    }, 50);

    setTimeout(() => {
        effImg.style.display = 'none';
        effImg.src = '';
    }, duration + 50);
}

// --- 자동 전투 로직 (플레이어 턴: 돌진 애니메이션 추가) ---
function playerTurnAuto() {
    if (!battleState.isAutoRunning) return;

    if (!battleState.isRaid) {
        if (battleState.turnCount === 10 && !battleState.sd1Logged) {
            logBattle('⚠️ <b style="color:var(--Red);">[서든데스] 피로 누적! (회복량 50% 감소 / 모든 피해량 20% 증가)</b>');
            battleState.sd1Logged = true;
        } else if (battleState.turnCount === 20 && !battleState.sd2Logged) {
            logBattle('💀 <b style="color:var(--Red);">[죽음의 문턱] 한계 도달! (모든 피해량 50% 증가)</b>');
            battleState.sd2Logged = true;
        }
    }
    const sdMults = getSuddenDeathMults();

    // 💡 [기믹] 타임어택 확인
    if (battleState.isBoss && (battleState.gimmick_type === 'time_attack' || battleState.gimmick_type === '타임어택')) {
        if (battleState.turnCount >= battleState.gimmick_value) {
            logBattle('⏱️ <b style="color:var(--Red);">[타임 오버] 보스가 폭주하여 전멸기를 사용합니다!</b>');
            battleState.playerCurrentHp = 0;
            updateHpBars();
            playAnim('battlePlayerImg', 'anim-damage-p', 400);
        }
    }

    const canAct = processStatusEffects(true);

    if (battleState.playerCurrentHp <= 0) {
        logBattle('☠️ <b style="color:#ff4d4d;">치명적인 상태이상으로 쓰러졌습니다...</b>');
        battleState.isAutoRunning = false;
        setTimeout(function () {
            if (battleState.isTower) handleTowerPlayerDefeat();
            else showBattleResult(false);
        }, 1500);
        return;
    }

    if (!canAct) {
        battleState.skills.forEach(sk => { if (sk.currentCd > 0) sk.currentCd--; });
        renderBattleSkillsUI();
        decrementStatusEffects(true);
        battleState.turnTimer = setTimeout(monsterTurnAuto, 1000);
        return;
    }

    // 💡 실시간 스탯 연산 (행운 감소 및 디버프 적용)
    let pAtk = battleState.playerAtk;
    let pDef = battleState.playerDef;
    let pLuk = battleState.playerLuk;
    let mDef = Number(battleState.monster.def) || 0;

    battleState.playerEffects.forEach(eff => {
        if (eff.type === '광폭화') { pAtk *= 1.2; pDef *= 0.8; }
        if (eff.type === '마력집중') pAtk *= 2.0;
        if (eff.type === '보호막') pDef = Math.floor(pDef * 1.5); // 💡 [수정] 보호막 방어력 증가 추가
        if (['공격감소', '화상', '저주'].includes(eff.type)) pAtk *= 0.8;
        if (['방어감소', '방깎출혈', '저주'].includes(eff.type)) pDef *= 0.8;
        if (['행운감소', '저주'].includes(eff.type)) pLuk *= 0.8;
    });

    battleState.monsterEffects.forEach(eff => {
        if (['방어감소', '방깎출혈', '저주'].includes(eff.type)) mDef *= 0.8;
    });

    let usedSkill = null;
    let isSilenced = battleState.playerEffects.some(e => e.type === '침묵');

    if (!isSilenced) {
        for (let i = 0; i < battleState.skills.length; i++) {
            let sk = battleState.skills[i];
            if (sk.currentCd === 0) {
                let baseProb = Number(sk.base_prob) || 50;
                const skillPerLuk = Number(sysConfig.skill_per_luk) || 0.5;
                let finalProb = baseProb + (pLuk * skillPerLuk) + battleState.relicEffects.skillProb;

                if (String(sk.blessing).trim() === String(currentStudent.blessing).trim()) {
                    finalProb += 20;
                }

                if ((Math.random() * 100) < finalProb) {
                    usedSkill = sk;
                    usedSkill.currentCd = Number(usedSkill.cooldown) || 3;
                    break;
                } else {
                    logBattle('<span style="color:#888; font-size:0.8em;">(기회 포착 중... [' + sk.name + '] 발동 대기)</span>');
                }
            }
        }
    } else {
        logBattle('💬 <span style="color:#aaa;">침묵 상태라 스킬을 발동할 수 없습니다!</span>');
    }

    // 스킬 주체(대표 캐릭터 vs 동료 1 vs 동료 2)에 따른 돌진 애니메이션 타깃 지정
    let attackAnimTarget = 'battlePlayerImg';
    if (usedSkill) {
        if (usedSkill.ownerType === 'm1') attackAnimTarget = 'merc1BattleImg';
        else if (usedSkill.ownerType === 'm2') attackAnimTarget = 'merc2BattleImg';
    }
    playAnim(attackAnimTarget, 'anim-attack-p', 300);

    let hitCount = 1;
    let hasDoubleHit = battleState.playerEffects.some(function (e) { return e.type === '더블히트'; });
    if (hasDoubleHit) hitCount = 2;

    let effectType = '없음'; // 특수효과 (special_effect)
    let mainSkillType = 'damage'; // 💡 신규: 스킬 본연의 타입 (effect_type)
    let multiplier = 1.0;
    let effectDelay = 0;

    if (usedSkill) {
        // 스킬 주체에 따른 전투 로그 뱃지 구성
        let ownerLabel = '';
        if (usedSkill.ownerType === 'm1' || usedSkill.ownerType === 'm2') {
            const mercObj = mercenariesData.find(m => String(m.merc_id) === String(usedSkill.mercId));
            const mercName = mercObj ? mercObj.name : (usedSkill.ownerType === 'm1' ? '동료 1' : '동료 2');
            ownerLabel = '<span style="color:var(--Blue); font-weight:bold;">[동료 지원 - ' + mercName + ']</span> ';
        } else {
            ownerLabel = '<span style="color:var(--' + (currentStudent.blessing || 'Highlight') + ');">[대표 스킬 발동]</span> ';
        }

        logBattle(ownerLabel + usedSkill.name + '!');
        effectType = effectTranslator[String(usedSkill.special_effect).toLowerCase().trim()] || usedSkill.special_effect;
        mainSkillType = String(usedSkill.effect_type).toLowerCase().trim(); // 'heal', 'damage', 'buff' 등
        const effectDuration = Number(usedSkill.duration) || 0;
        multiplier = Number(usedSkill.multiplier ?? usedSkill.muliplier ?? 1.0);

        // 🚨 스킬 이펙트 재생 및 딜레이 설정
        if (usedSkill.effect_url && String(usedSkill.effect_url).trim() !== '') {
            let eTime = Number(usedSkill.effect_time) || 1000;
            effectDelay = eTime;
            // mainSkillType이 'heal'이거나 'buff'면 스킬을 사용한 대상 위치에 이펙트 표시
            let isBuff = ['나', '자신', 'self', '본인', 'ally_single', 'ally_all'].includes(String(usedSkill.target_type).trim().toLowerCase()) || ['회복', '은신', '보호막', '광폭화', '마력집중', '회피증가', '재생', '더블히트'].includes(effectType) || mainSkillType === 'heal' || mainSkillType === 'buff';

            let effectTargetId = 'monster';
            if (isBuff) {
                if (usedSkill.ownerType === 'm1') effectTargetId = 'merc1EffectImg';
                else if (usedSkill.ownerType === 'm2') effectTargetId = 'merc2EffectImg';
                else effectTargetId = 'player';
            }
            playSkillEffect(effectTargetId, usedSkill.effect_url, eTime);
        }

        if (effectType === '2연격') hitCount = 2;
        if (effectType === '3연격') hitCount = 3;

        // 🚨 회복, 버프, 디버프 연산도 이펙트가 터진 후(effectDelay) 적용
        setTimeout(() => {
            // 💡 [핵심 수정] 1. 즉시 체력 회복 연산 (스킬 타입이 heal일 때 정확한 계수 적용)
            if (mainSkillType === 'heal' || effectType === '회복') {
                let healAmount = 0;
                if (mainSkillType === 'heal') {
                    // 시트의 계수(hp 등)를 바탕으로 정확한 치유량 계산
                    let baseVal = Number(usedSkill.base_value) || 0;
                    let sc = String(usedSkill.scaling_stat).toLowerCase().trim();
                    let sVal = pAtk;
                    if (sc === 'hp') sVal = battleState.playerMaxHp;
                    if (sc === 'def') sVal = pDef;
                    if (sc === 'luk') sVal = pLuk;
                    healAmount = Math.floor((baseVal + (sVal * multiplier)) * sdMults.heal);
                } else {
                    // 특수효과가 '회복'인 경우 고정 25% 회복
                    healAmount = Math.floor(battleState.playerMaxHp * 0.25 * sdMults.heal);
                }

                battleState.playerCurrentHp = Math.min(battleState.playerMaxHp, battleState.playerCurrentHp + healAmount);
                logBattle('✨ <span style="color:#4dff88;">[회복]</span> 체력을 ' + healAmount + '만큼 회복했습니다!');
                updateHpBars();
            }

            // 2. 상태이상 (버프/디버프) 적용 (none, null, 없음 완벽 필터링)
            const isNoSpecial = ['없음', 'none', 'null', 'undefined', '', 'false'].includes(String(effectType).toLowerCase());
            if (!isNoSpecial && !['3연격', '처형', '방어관통', '회복'].includes(effectType) && effectDuration > 0) {
                let tType = String(usedSkill.target_type).trim().toLowerCase();
                let isBuffEffect = ['은신', '보호막', '광폭화', '마력집중', '회피증가', '재생', '더블히트'].includes(effectType);

                if (isBuffEffect || ['나', '자신', 'self', '본인', 'ally_single', 'ally_all'].includes(tType)) {
                    battleState.playerEffects.push({ type: effectType, duration: effectDuration });
                    logBattle('✨ 나에게 [' + effectType + '] 효과가 부여되었습니다! (' + effectDuration + '턴)');
                } else {
                    // 💡 [기믹] 상태이상 면역
                    if (battleState.isBoss && (battleState.gimmick_type === 'immune' || battleState.gimmick_type === '면역')) {
                        logBattle('🛡️ <b style="color:#A78BFA;">[면역] 보스가 모든 상태이상을 무효화했습니다!</b>');
                    } else {
                        const resistRate = (Number(battleState.monster.luk) || 0) * 0.2;
                        if ((Math.random() * 100) < resistRate && effectType !== '강력한기절') {
                            logBattle('🛡️ 적이 [' + effectType + '] 부여를 저항했습니다!');
                        } else {
                            let actualType = (effectType === '방깎출혈') ? '출혈' : effectType;
                            battleState.monsterEffects.push({ type: actualType, duration: effectDuration });
                            if (effectType === '방깎출혈') battleState.monsterEffects.push({ type: '방어감소', duration: effectDuration });
                            if (effectType === '저주') battleState.monsterEffects.push({ type: '저주', duration: effectDuration });
                            if (effectType === '행운감소') battleState.monsterEffects.push({ type: '행운감소', duration: effectDuration });
                            logBattle('💥 적에게 [' + effectType + '] 효과를 부여했습니다! (' + effectDuration + '턴)');
                        }
                    }
                }
            }
        }, effectDelay);
    } else {
        logBattle('<span style="color:#4d94ff;">[기본 공격]</span>');
    }

    // 🚨 타격 및 데미지 연산 (이펙트 종료 후 타격 시작)
    // 💡 [핵심 수정] 스킬 타입이 'heal'이나 'buff'면 적을 절대로 때리지 않고 턴을 넘김!
    if (!usedSkill || (mainSkillType !== 'heal' && mainSkillType !== 'buff' && effectType !== '회복')) {
        for (let h = 1; h <= hitCount; h++) {
            setTimeout(function () {
                const critPerLuk = Number(sysConfig.crit_per_luk) || 0.5;
                let isCritHit = (Math.random() * 100) < ((pLuk * critPerLuk) + battleState.relicEffects.critRate);

                if (battleState.playerEffects.some(e => e.type === '은신')) {
                    isCritHit = true;
                    if (h === hitCount) battleState.playerEffects = battleState.playerEffects.filter(e => e.type !== '은신');
                }

                let hitCritMult = isCritHit ? (1.5 + battleState.relicEffects.critDmg) : 1.0;
                let hitCritText = isCritHit ? "💥치명타! " : "";
                let execMult = (effectType === '처형') ? 1.0 + (1 - (battleState.monsterCurrentHp / battleState.monsterMaxHp)) * 1.5 : 1.0;

                let baseDmg = 0;
                if (usedSkill) {
                    let baseVal = Number(usedSkill.base_value) || 0;
                    let sc = String(usedSkill.scaling_stat).toLowerCase().trim();
                    let sVal = pAtk;
                    if (sc === 'hp') sVal = battleState.playerMaxHp;
                    if (sc === 'def') sVal = pDef;
                    if (sc === 'luk') sVal = pLuk;
                    baseDmg = Math.floor((baseVal + (sVal * multiplier)) * hitCritMult * execMult * sdMults.dmg);
                } else {
                    baseDmg = Math.floor(pAtk * hitCritMult * sdMults.dmg);
                }

                let finalDef = (effectType === '방어관통' || effectType === 'pierce') ? 0 : mDef;
                applyDamageToMonster(baseDmg, finalDef, (hitCount > 1 ? "&lt;" + h + "타&gt; " : "") + hitCritText);
            }, effectDelay + (250 * h)); // 이펙트 딜레이만큼 타격 미루기
        }
    }

    // 🚨 턴 종료 및 다음 턴 대기열 (이펙트 + 타격이 모두 끝난 뒤에 실행)
    setTimeout(() => {
        if (usedSkill) battleState.playerEffects = battleState.playerEffects.filter(e => e.type !== '마력집중');
        battleState.skills.forEach(sk => { if (sk !== usedSkill && sk.currentCd > 0) sk.currentCd--; });
        renderBattleSkillsUI();

        if (battleState.monsterCurrentHp > 0 && battleState.isAutoRunning) {
            if (battleState.relicEffects.regen > 0 && battleState.playerCurrentHp < battleState.playerMaxHp) {
                const rHeal = Math.floor((battleState.playerMaxHp - battleState.playerCurrentHp) * battleState.relicEffects.regen * sdMults.heal);
                if (rHeal > 0) {
                    battleState.playerCurrentHp += rHeal;
                    logBattle('✨ <span style="color:#4dff88;">[유물: 생명의 정수]</span> 체력을 ' + rHeal + '만큼 회복했습니다!');
                    updateHpBars();
                }
            }
            decrementStatusEffects(true);
            battleState.turnTimer = setTimeout(monsterTurnAuto, Math.max(1000, (250 * hitCount) + 500));
        }
    }, effectDelay + (250 * hitCount) + 100);
}

// 💡 신규: 애니메이션을 강제로 재생하는 헬퍼 함수
function playAnim(elementId, animClass, duration) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.remove(animClass);
    void el.offsetWidth; // DOM 리플로우 강제 발생 (애니메이션을 즉시 처음부터 다시 재생하게 만드는 테크닉)
    el.classList.add(animClass);
    setTimeout(() => {
        el.classList.remove(animClass);
    }, duration);
}

// --- 플레이어 데미지 몬스터에게 적용 (피격 애니메이션 및 반사 방패 기믹 연동) ---
function applyDamageToMonster(baseDmg, finalDef, prefixText) {
    // 다단히트 중 이미 몬스터가 죽었다면 추가 타격 생략
    if (battleState.monsterCurrentHp <= 0) return;

    let finalDmg = Math.floor(baseDmg * (100 / (100 + finalDef)));
    if (finalDmg < 1) finalDmg = 1;

    // 💡 [신규 기믹] reflect (반사 방패): 지정 턴 주기마다 피해의 30%를 플레이어에게 반사
    let isReflectTurn = false;
    let reflectDmg = 0;
    if (battleState.isBoss && (battleState.gimmick_type === 'reflect' || battleState.gimmick_type === '반사')) {
        const interval = Math.max(1, battleState.gimmick_value || 3);
        if (battleState.turnCount % interval === 0) {
            isReflectTurn = true;
            reflectDmg = Math.max(1, Math.floor(finalDmg * 0.3));
        }
    }

    battleState.monsterCurrentHp -= finalDmg;
    if (battleState.monsterCurrentHp < 0) battleState.monsterCurrentHp = 0;

    let hitMsg = prefixText ? prefixText : "";
    logBattle(hitMsg + '적에게 ' + finalDmg + '의 피해!');

    // 💡 반사 데미지 적용 및 로그
    if (isReflectTurn && reflectDmg > 0) {
        battleState.playerCurrentHp = Math.max(0, battleState.playerCurrentHp - reflectDmg);
        logBattle('⚡ <b style="color:#F59E0B;">[반사 방패] 보스의 가시 방패가 피해의 30%(' + reflectDmg + ')를 플레이어에게 반사했습니다!</b>');
        playAnim('battlePlayerImg', 'anim-damage-p', 250);
    }

    updateHpBars();
    playAnim('battleMonsterImg', 'anim-damage', 250);

    // 반사 피해로 플레이어가 먼저 쓰러졌는지 체크
    if (battleState.playerCurrentHp <= 0) {
        logBattle('☠️ <b style="color:#ff4d4d;">보스의 반사 피해를 버티지 못하고 쓰러졌습니다...</b>');
        battleState.isAutoRunning = false;
        setTimeout(function () {
            if (battleState.isTower) handleTowerPlayerDefeat();
            else showBattleResult(false);
        }, 1500);
        return;
    }

    if (battleState.monsterCurrentHp === 0) {
        logBattle('🏆 <b style="color:#ffd700;">' + battleState.monster.name + ' 처치 성공!</b>');
        battleState.isAutoRunning = false;
        setTimeout(function () {
            if (battleState.isTower) handleTowerMonsterDefeat();
            else showBattleResult(true);
        }, 1500);
    }
}

// 💡 3. 자동 전투 로직 (몬스터 턴: 복합 특수 스킬 적용)
function monsterTurnAuto() {
    if (!battleState.isAutoRunning) return;

    const sdMults = getSuddenDeathMults();

    const canAct = processStatusEffects(false);

    if (battleState.monsterCurrentHp <= 0) {
        logBattle('🏆 <b style="color:#ffd700;">적은 상태이상의 고통을 견디지 못하고 쓰러졌습니다!</b>');
        battleState.isAutoRunning = false;
        setTimeout(() => {
            if (battleState.isTower) handleTowerMonsterDefeat();
            else showBattleResult(true);
        }, 1500);
        return;
    }

    if (!canAct) {
        if (battleState.monsterSkill && battleState.monsterCd > 0) {
            battleState.monsterCd--;
            renderMonsterSkillsUI(); // 💡 추가: 기절 중에도 스킬 쿨타임 감소 반영
        }
        decrementStatusEffects(false); // 💡 여기에 추가! (몬스터 턴 끝날 때 감소)
        battleState.turnTimer = setTimeout(playerTurnAuto, 1000);
        return;
    }

    playAnim('battleMonsterImg', 'anim-attack-m', 300);

    let usedSkill = null;
    let mIsSilenced = battleState.monsterEffects.some(e => e.type === '침묵'); // 💡 [수정] 몬스터 침묵 체크

    if (battleState.monsterSkill && !mIsSilenced) {
        if (battleState.monsterCd <= 0) {
            let mSk = battleState.monsterSkill;
            let baseProb = Number(mSk.base_prob) || 50;
            const skillPerLuk = Number(sysConfig.skill_per_luk) || 0.5;
            let finalProb = baseProb + ((Number(battleState.monster.luk) || 0) * skillPerLuk);

            if ((Math.random() * 100) < finalProb) {
                usedSkill = mSk;
                battleState.monsterCd = Number(usedSkill.cooldown) || 3;
            } else {
                logBattle('<span style="color:#888; font-size:0.8em;">(적이 [' + mSk.name + '] 발동 기회를 엿보고 있습니다...)</span>');
            }
        } else {
            battleState.monsterCd--;
        }
        renderMonsterSkillsUI();
    } else if (mIsSilenced) {
        logBattle('💬 <span style="color:#aaa;">적이 침묵 상태라 스킬을 사용할 수 없습니다!</span>'); // 💡 [수정] 침묵 시 스킬 발동 불가
    }

    // --- 실시간 버프/디버프 스탯 연산 ---
    let mAtk = Number(battleState.monster.atk) || 0;
    let mDef = Number(battleState.monster.def) || 0;
    let mLuk = Number(battleState.monster.luk) || 0;
    let pDef = battleState.playerDef;
    let pLuk = battleState.playerLuk;

    // 💡 [기믹] 광폭화 (체력 비율 이하 시 공격력 1.5배)
    if (battleState.isBoss && (battleState.gimmick_type === 'berserk' || battleState.gimmick_type === '광폭화')) {
        const hpPercent = (battleState.monsterCurrentHp / battleState.monsterMaxHp) * 100;
        if (hpPercent <= battleState.gimmick_value) {
            mAtk = Math.floor(mAtk * 1.5);
            logBattle('💢 <b style="color:var(--Red);">[광폭화] 보스가 분노하여 공격력이 대폭 상승했습니다!</b>');
        }
    }

    battleState.monsterEffects.forEach(eff => {
        if (eff.type === '광폭화') { mAtk *= 1.2; mDef *= 0.9; }
        if (['공격감소', '저주'].includes(eff.type)) mAtk *= 0.8;
        if (['행운감소', '저주'].includes(eff.type)) mLuk *= 0.8;
        if (eff.type === '저주') mDef *= 0.8;
    });

    battleState.playerEffects.forEach(eff => {
        if (eff.type === '보호막') pDef = Math.floor(pDef * 1.5); // 💡 [수정] 몬스터 턴에서도 보호막 방어력 적용!
        if (eff.type === '행운감소') pLuk *= 0.8;
        if (eff.type === '방깎출혈' || eff.type === '방어감소') pDef *= 0.8;
        if (eff.type === '저주') { pDef *= 0.8; pLuk *= 0.8; }
    });
    // -----------------------------------

    const dodgePerLuk = Number(sysConfig.dodge_per_luk) || 0.2;
    let dodgeRate = (pLuk * dodgePerLuk) + battleState.relicEffects.dodge;
    if (battleState.playerEffects.some(e => e.type === '회피증가')) dodgeRate += 40; // 💡 [수정] 행운의 약탈(회피율 +40%) 폭증 적용

    let isStealth = battleState.playerEffects.some(e => e.type === '은신'); // 💡 [수정] 은신 상태 체크

    let effectDelay = 0;
    let baseDmg = 0;
    let effectType = '없음';
    let critText = "";
    const critPerLuk = Number(sysConfig.crit_per_luk) || 0.5;
    const isCrit = (Math.random() * 100) < (mLuk * critPerLuk);
    const critMult = isCrit ? 1.5 : 1.0;
    if (isCrit) critText = "💥크리티컬! ";

    if (usedSkill) {
        logBattle('<span style="color:#ffdb4d;">[적 스킬 발동]</span> ' + usedSkill.name + '! ' + critText);

        const rawEffect = String(usedSkill.special_effect || '없음').toLowerCase().trim();
        effectType = effectTranslator[rawEffect] || usedSkill.special_effect;
        if (['none', 'null', 'undefined', '없음', '', 'false'].includes(String(effectType).toLowerCase())) {
            effectType = '없음';
        }
        const effectDuration = Number(usedSkill.duration) || 0;

        // 🚨 몬스터 스킬 이펙트 재생 (재생 시간 변수 저장)
        if (usedSkill.effect_url && String(usedSkill.effect_url).trim() !== '') {
            let eTime = Number(usedSkill.effect_time) || 1000;
            effectDelay = eTime;
            let isBuff = ['광폭화', '재생', '보호막'].includes(effectType);
            playSkillEffect(isBuff ? 'monster' : 'player', usedSkill.effect_url, eTime);
        }

        // 버프/디버프 연산도 이펙트 종료 후 발동되도록 지연
        setTimeout(() => {
            if (effectType === '광폭화' || effectType === '재생') {
                battleState.monsterEffects.push({ type: effectType, duration: effectDuration });
                logBattle('🔥 적이 [' + effectType + '] 상태가 되었습니다! (' + effectDuration + '턴)');
            }
            else if (effectType !== '없음' && effectType !== '방어관통' && effectType !== '흡혈' && effectType !== '체력비례피해' && effectDuration > 0) {
                let actualType = effectType;
                if (effectType === '맹독흡혈') actualType = '중독';
                if (effectType === '방깎출혈') actualType = '출혈';
                if (effectType === '강력한기절') actualType = '기절';

                const playerResist = (effectType === '강력한기절') ? pLuk * 0.05 : pLuk * 0.2;

                if ((Math.random() * 100) < playerResist) {
                    logBattle('🛡️ 플레이어가 [' + actualType + '] 부여를 저항했습니다!');
                } else {
                    battleState.playerEffects.push({ type: actualType, duration: effectDuration });
                    if (effectType === '방깎출혈') battleState.playerEffects.push({ type: '방어감소', duration: effectDuration });
                    if (effectType === '저주') battleState.playerEffects.push({ type: '저주', duration: effectDuration });
                    if (effectType === '행운감소') battleState.playerEffects.push({ type: '행운감소', duration: effectDuration });
                    logBattle('⚠️ 플레이어가 [' + actualType + '] 상태가 되었습니다! (' + effectDuration + '턴)');
                }
            }
        }, effectDelay);

        const multiplier = Number(usedSkill.multiplier) || Number(usedSkill.muliplier) || 1.5;
        if (effectType === '체력비례피해') {
            baseDmg = Math.floor(battleState.playerMaxHp * 0.2 * sdMults.dmg);
            pDef = 0;
        } else {
            baseDmg = Math.floor(mAtk * multiplier * critMult * sdMults.dmg);
        }
        if (effectType === '방어관통') pDef = 0;
    } else {
        logBattle('<span style="color:#ff4d4d;">[적의 공격]</span> ' + critText);
        baseDmg = Math.floor(mAtk * critMult * sdMults.dmg);
    }

    // 🚨 타격 및 결과 적용 (이펙트 대기 시간 + 150ms 기본 딜레이 후 실행)
    setTimeout(() => {
        if (battleState.purpleDodgeActive) {
            logBattle('🟣 <b style="color:#d966ff;">[보라색 가호] 어둠의 장막으로 적의 첫 공격을 무효화했습니다!</b>');
            battleState.purpleDodgeActive = false;
        }
        else if (isStealth) {
            logBattle('🌫️ <span style="color:#aaa;">[은신] 적이 연막 속의 나를 찾지 못해 공격이 빗나갔습니다!</span>');
        }
        else if ((Math.random() * 100) < dodgeRate) {
            logBattle('<span style="color:#4dff88;">[회피]</span> 💨 가볍게 적의 공격을 피했다!');
        } else {
            // 💡 [수정] 몬스터 일반 사냥에 '방어관통'과 '처형', '체력비례피해' 완벽 적용!
            let fDef = (effectType === '방어관통' || effectType === 'pierce') ? 0 : pDef;
            let execMult = (effectType === '처형' || effectType === 'execution') ? 1.0 + (1 - (battleState.playerCurrentHp / battleState.playerMaxHp)) * 1.5 : 1.0;
            let currentBaseDmg = Math.floor(baseDmg * execMult);
            const defC = Number(sysConfig.def_constant) || 50;

            let finalDmg = effectType === '체력비례피해' ? Math.floor(battleState.playerMaxHp * 0.2 * sdMults.dmg) : Math.max(1, Math.floor(currentBaseDmg * (defC / (defC + fDef))));

            battleState.playerCurrentHp -= finalDmg;
            if (battleState.playerCurrentHp < 0) battleState.playerCurrentHp = 0;

            logBattle('나에게 ' + finalDmg + '의 피해!');
            updateHpBars();
            playAnim('battlePlayerImg', 'anim-damage-p', 400);

            // 일반 스킬 흡혈
            if (effectType === '흡혈' || effectType === '맹독흡혈') {
                let heal = Math.floor(finalDmg * 0.5 * sdMults.heal);
                battleState.monsterCurrentHp = Math.min(battleState.monsterMaxHp, battleState.monsterCurrentHp + heal);
                logBattle('🩸 적이 체력을 ' + heal + ' 흡수했습니다!');
                updateHpBars();
            }

            // 💡 [기믹] 상시 흡혈 패시브
            if (battleState.isBoss && (battleState.gimmick_type === 'lifesteal' || battleState.gimmick_type === '흡혈')) {
                let heal = Math.floor(finalDmg * (battleState.gimmick_value / 100) * sdMults.heal);
                if (heal > 0) {
                    battleState.monsterCurrentHp = Math.min(battleState.monsterMaxHp, battleState.monsterCurrentHp + heal);
                    logBattle('🩸 <b style="color:var(--Red);">[흡혈] 보스가 내 체력을 ' + heal + '만큼 빼앗았습니다!</b>');
                    updateHpBars();
                }
            }
        }

        if (battleState.playerCurrentHp === 0) {
            logBattle('☠️ <b style="color:#ff4d4d;">패배했습니다...</b>');
            battleState.isAutoRunning = false;
            setTimeout(() => {
                if (battleState.isTower) handleTowerPlayerDefeat();
                else showBattleResult(false);
            }, 1500);
        } else {
            decrementStatusEffects(false);
            battleState.turnCount++; // 💡 라운드 종료 시 턴 카운트 증가
            battleState.turnTimer = setTimeout(playerTurnAuto, 1000);
        }
    }, effectDelay + 150);
}

// 💡 신규: 몬스터 스킬 아이콘 렌더링 함수
function renderMonsterSkillsUI() {
    const container = document.getElementById('monsterBattleSkills');
    container.style.opacity = '1'; // 기본 반투명 처리 해제

    if (!battleState.monsterSkill) {
        container.innerHTML = '<div style="width:50px; height:50px; border-radius:8px; border:2px dashed #555; display:flex; align-items:center; justify-content:center; font-size:0.8em; color:#555;">스킬 없음</div>';
        return;
    }

    const sk = battleState.monsterSkill;

    // 서버(Code.gs)에서 변환해서 넘겨준 URL을 그대로 사용합니다.
    const iconSrc = sk.icon_url || 'https://via.placeholder.com/50/222222/FFFFFF?text=MSK';
    const isReady = battleState.monsterCd <= 0;

    // 쿨타임 오버레이 (대기 중일 때만 숫자 표시)
    const overlay = isReady ? '' : '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:1.8em; font-weight:bold; color:white; text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000; z-index: 2;">' + battleState.monsterCd + '</div>';

    container.innerHTML =
        '<div style="position:relative; width:50px; height:50px; transition: 0.3s; opacity: ' + (isReady ? '1' : '0.5') + ';">' +
        '  <img src="' + iconSrc + '" class="monster-skill-icon">' +
        '  ' + overlay +
        '</div>';
}

// --- 💡 전투 결과 및 보스전 다중 줄(Row) 루팅 시스템 ---
function showBattleResult(isWin) {
    if (battleState.isFleeing) return;

    if (!isWin) {
        const nowTime = new Date().getTime();
        currentStudent.last_defeat = nowTime;
        currentStudent.penalty_end_time = nowTime + (8 * 60 * 60 * 1000);
        updateFastFirebaseStudent(currentStudent);
        showUiAlert("☠️ 전투 패배", "아쉽게도 쓰러지고 말았습니다...<br><br><span style='font-size:0.9em; color:#ff4d4d;'>(8시간 동안 전투에 진입할 수 없습니다)</span>", "document.getElementById('battleModal').style.display = 'none'; renderDashboard();");
        return;
    }

    if (!battleState.isBoss) {
        let maxW = Number(sysConfig.max_weekly_battles) || 2;
        let currentW = (currentStudent.weekly_battles !== undefined && currentStudent.weekly_battles !== "") ? Number(currentStudent.weekly_battles) : maxW;
        currentStudent.weekly_battles = Math.max(0, currentW - 1);
    }

    if (battleState.monster) {
        const mId = battleState.monster.monster_id || battleState.monster.boss_id;
        if (mId) {
            const rawMonsters = String(currentStudent.monster_data || "").replace(/!/g, '');
            let myMonsters = rawMonsters ? rawMonsters.split(',').map(x => x.trim()).filter(Boolean) : [];
            myMonsters.push(mId);
            currentStudent.monster_data = "!" + myMonsters.join(',');
        }
    }

    let bonusGold = 0;
    if (battleState.relicEffects && battleState.relicEffects.goldMult) {
        bonusGold = Math.floor(battleState.relicEffects.goldMult);
    }

    const gameCurrency = sysConfig.game_money_currency || '골드';
    const m = battleState.monster;

    // 💡 보스일 때만 loot_count 적용, 일반 몹은 무조건 1줄(1번)
    let rows = battleState.isBoss ? (Number(m.loot_count) || 1) : 1;
    if (rows > 3) rows = 3; // 최대 3줄 방어

    battleState.maxLootRows = rows;
    battleState.currentLootRow = 0; // 현재 고를 차례 (0부터 시작)
    battleState.pickedRewards = [];
    battleState.allRowRewards = [];

    // 각 줄마다 독립적으로 카드를 미리 뽑아둠
    let cardHtml = '';
    for (let r = 0; r < rows; r++) {
        let rowRewards = [];
        for (let c = 0; c < 3; c++) {
            let rText = String(rollReward(m)).trim();
            if (/^\d+$/.test(rText)) rText += gameCurrency;

            let match = rText.match(/^(\d+)\s*(.*)$/);
            let isBonusApplied = false;

            if (match) {
                let baseValue = Number(match[1]);
                let textPart = match[2].trim();
                if (textPart === gameCurrency || textPart === '골드' || textPart === '') {
                    let finalValue = baseValue + bonusGold;
                    rText = finalValue + textPart;
                    if (bonusGold > 0) isBonusApplied = true;
                } else if (textPart.toUpperCase() === 'RM') {
                    let realCurrency = sysConfig.currency_name || '티';
                    rText = '[현실 재화] ' + baseValue + realCurrency + ' 교환권';
                }
            }
            rowRewards.push({ text: rText, bonus: isBonusApplied });
        }
        battleState.allRowRewards.push(rowRewards);

        // 첫 번째 줄만 클릭 가능하게 열어두고 나머지는 반투명 잠금
        cardHtml += '<div id="lootRow_' + r + '" style="display:flex; gap:15px; justify-content:center; margin-top:15px; opacity:' + (r === 0 ? '1' : '0.4') + '; pointer-events:' + (r === 0 ? 'auto' : 'none') + ';">';
        rowRewards.forEach((rew, cIdx) => {
            let fontColor = rew.bonus ? '#ffd700' : '#4dff88';
            let textShadow = rew.bonus ? 'text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);' : '';
            let rTextClean = rew.text.replace(/'/g, "\\'"); // 따옴표 이스케이프

            cardHtml +=
                '<div id="rewardCard_' + r + '_' + cIdx + '" ' +
                'style="width:90px; height:130px; background:#333; border:2px solid #ffd700; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:3em; transition:0.3s; box-shadow:0 4px 10px rgba(255,215,0,0.2);" ' +
                'onmouseover="this.style.transform=\'scale(1.05)\'" ' +
                'onmouseout="this.style.transform=\'scale(1)\'" ' +
                'onclick="claimReward(' + r + ', ' + cIdx + ')">' +
                '🎁' +
                '</div>';
        });
        cardHtml += '</div>';
    }

    document.getElementById('uiPopupTitle').innerHTML = battleState.isBoss ? "👹 보스 토벌 성공!" : "🏆 승리!";
    document.getElementById('uiPopupMessage').innerHTML = '<p id="lootStatus" style="color:var(--TextSub); font-size:1.1em; font-weight:bold;">전리품을 선택하세요. (남은 기회: <b style="color:var(--TextPoint);">' + rows + '번</b>)</p>' + cardHtml;
    document.getElementById('uiPopupButtons').innerHTML = '';
    document.getElementById('uiPopup').style.display = 'flex';
}

// 개별 카드 보상 추첨 함수 (독립 시행)
function rollReward(monster) {
    var rand = Math.random() * 100;
    var p1 = Number(monster.r1_prob) || 0;
    var p2 = Number(monster.r2_prob) || 0;
    var p3 = Number(monster.r3_prob) || 0;

    if (rand <= p1) return monster.reward_1;
    else if (rand <= p1 + p2) return monster.reward_2;
    else if (rand <= p1 + p2 + p3) return monster.reward_3;
    return "꽝";
}

// 💡 [수정] 여러 줄 순차 선택 및 *N 아이템 파싱 처리
function claimReward(rowIdx, colIdx) {
    let card = document.getElementById('rewardCard_' + rowIdx + '_' + colIdx);
    if (!card.onclick) return; // 중복 클릭 방지

    let data = battleState.allRowRewards[rowIdx][colIdx];

    // 1. 해당 줄(Row)의 카드 3장을 처리 (선택한 건 내용 보이고, 나머지는 비활성화)
    for (let i = 0; i < 3; i++) {
        let c = document.getElementById('rewardCard_' + rowIdx + '_' + i);
        c.onclick = null;
        c.style.cursor = 'default';

        if (i === colIdx) {
            c.style.background = '#222';
            c.style.fontSize = '1.2em';
            c.style.color = data.bonus ? '#ffd700' : '#4dff88';
            c.style.fontWeight = 'bold';
            c.style.cssText += data.bonus ? 'text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);' : '';
            c.innerHTML = data.text;
        } else {
            c.style.opacity = '0.4';
        }
    }

    battleState.pickedRewards.push(data.text);
    battleState.currentLootRow++;

    let remain = battleState.maxLootRows - battleState.currentLootRow;
    let statusText = document.getElementById('lootStatus');

    if (remain > 0) {
        // 다음 줄(Row) 선택 권한 활성화
        statusText.innerHTML = '전리품을 선택하세요. (남은 기회: <b style="color:var(--TextPoint);">' + remain + '번</b>)';
        let nextRow = document.getElementById('lootRow_' + battleState.currentLootRow);
        nextRow.style.opacity = '1';
        nextRow.style.pointerEvents = 'auto';
    } else {
        // 루팅 종료 시 서버로 일괄 전송
        statusText.innerHTML = '<b style="color:var(--Green);">모든 전리품 획득 완료!</b>';
        document.getElementById('uiPopupButtons').innerHTML =
            '<button class="btn-main" style="margin-top:20px; background:#555;" disabled>보상 기록 중... ⏳</button>';

        let combinedRewardStr = battleState.pickedRewards.join(',');

        // 💡 [핵심] *N을 해석하여 로컬 인벤토리/골드에 낱개로 꽂아 넣습니다.
        battleState.pickedRewards.forEach(r => {
            let itemName = r;
            let count = 1;
            if (r.includes('*')) {
                let parts = r.split('*');
                itemName = parts[0].trim(); // 간식추첨권
                count = parseInt(parts[1]) || 1; // 2
            }

            for (let i = 0; i < count; i++) {
                let match = String(itemName).match(/^(\d+)(.*)$/);
                if (match) {
                    let amount = Number(match[1]);
                    let textPart = match[2].trim();
                    if (!textPart.includes('권') && !textPart.includes('도전') && !textPart.includes('티켓') && !textPart.includes('단장')) {
                        currentStudent.game_money = (Number(currentStudent.game_money) || 0) + amount;
                    } else {
                        let items = currentStudent.inventory ? String(currentStudent.inventory).split(',') : [];
                        items.push(itemName);
                        currentStudent.inventory = items.join(',');
                    }
                } else {
                    let items = currentStudent.inventory ? String(currentStudent.inventory).split(',') : [];
                    items.push(itemName);
                    currentStudent.inventory = items.join(',');
                }
            }
        });

        // 💡 [화면 차단] 전투 보상 시트 기록 중 클릭 차단
        showGlobalLoading("🏆 전투 보상 기록 중...");

        const mName = battleState.monster.name;
        const star = Number(battleState.monster.difficulty) || 1;
        const expGain = mName.includes('[보스]') ? (star * 30) : (star * 10);

        currentStudent.exp = (Number(currentStudent.exp) || 0) + expGain;

        const expMax = Number(sysConfig.exp_max) || 200;
        const pointsPerLevel = Number(sysConfig.points_per_level) || 3;
        let leveledUp = false;
        while (currentStudent.exp >= expMax) {
            currentStudent.exp -= expMax;
            currentStudent.level = (Number(currentStudent.level) || 1) + 1;
            currentStudent.level_points = (Number(currentStudent.level_points) || 0) + pointsPerLevel;
            leveledUp = true;
        }

        // 📝 [Firebase 일반 사냥 / 보스 도전 로그 분기 전송]
        pushFirebaseLog('common', {
            time: new Date().toISOString(),
            name: currentStudent.name,
            category: battleState.isBoss ? "보스 도전" : "일반 사냥",
            content: mName + " 처치 -> " + combinedRewardStr + (leveledUp ? " (Lv." + currentStudent.level + " 레벨업)" : "")
        });

        updateFastFirebaseStudent(currentStudent).then(() => {
            hideGlobalLoading();
            if (leveledUp) {
                showUiAlert("🎊 레벨 업!!", "축하합니다! <b>Lv." + currentStudent.level + "</b>(이)가 되었습니다.<br>추가 스탯 포인트 <b>" + pointsPerLevel + "pt</b>를 획득했습니다!", "closeUiPopup(); document.getElementById('battleModal').style.display='none'; renderDashboard();");
            } else {
                document.getElementById('uiPopupButtons').innerHTML =
                    '<button class="btn-main" style="margin-top:20px;" onclick="closeUiPopup(); document.getElementById(\'battleModal\').style.display = \'none\'; renderDashboard();">확인 (전투 종료)</button>';
                renderDashboard();
            }
        }).catch(err => {
            hideGlobalLoading();
            showUiAlert("❌ 저장 오류", err);
        });
    }
}

// 💡 턴이 완전히 종료될 때 상태이상 지속시간을 깎는 함수
function decrementStatusEffects(isPlayer) {
    var effects = isPlayer ? battleState.playerEffects : battleState.monsterEffects;
    var targetName = isPlayer ? currentStudent.name : battleState.monster.name;

    for (var i = effects.length - 1; i >= 0; i--) {
        effects[i].duration--;
        if (effects[i].duration <= 0) {
            logBattle('✧ <span style="color:#aaa;">' + targetName + '의 [' + effects[i].type + '] 상태가 해제되었습니다.</span>');
            effects.splice(i, 1);
        }
    }
}

// 💡 상태이상 이름표와 이모지 맵핑 사전
const effectIconMap = {
    '중독': '🧪', '출혈': '🩸', '화상': '🔥',
    '기절': '💫', '빙결': '❄️', '구속': '⛓️', '마비': '⚡', '침묵': '💬',
    '은신': '🌫️', '보호막': '🔰', '마력집중': '✨',
    '공격감소': '⚔️⬇', '방어감소': '🛡️⬇', '행운감소': '🍀⬇', '속도감소': '💨⬇',
    '광폭화': '💢', '저주': '💀', '재생': '❤️‍🩹', '더블히트': '⚔️', '3연격': '🔱'
};

// 💡 상태이상 뱃지를 화면에 그려주는 함수
function renderStatusEffectsUI() {
    const pContainer = document.getElementById('playerStatusIcons');
    const mContainer = document.getElementById('monsterStatusIcons');

    const makeHtml = (effects) => {
        // 데이터가 비어있을 경우 빈 배열로 처리하여 map 에러 방지
        return (effects || []).map(eff => {
            const icon = effectIconMap[eff.type] || '✨';
            // 버프는 파란색 계열, 디버프는 빨간색 계열 테두리
            const isBuff = ['재생', '광폭화', '더블히트'].includes(eff.type);
            const borderColor = isBuff ? 'var(--Highlight)' : '#ff4d4d';

            return '<div style="background:rgba(0,0,0,0.6); border:1px solid ' + borderColor + '; border-radius:6px; padding:2px 6px; font-size:0.8em; display:flex; align-items:center; gap:4px; animation: cardPop 0.2s ease-out;">' +
                '  <span>' + icon + '</span>' +
                '  <span style="color:#fff; font-weight:bold;">' + eff.duration + '</span>' +
                '</div>';
        }).join('');
    };

    pContainer.innerHTML = makeHtml(battleState.playerEffects);
    mContainer.innerHTML = makeHtml(battleState.monsterEffects);
}

// ==========================================
// 🏰 파티 레이드(던전) 전용 시스템
// ==========================================

// 💡 [신규] 학생 자율 파티 레이드 결성 UI (진입 시 실시간 데이터 백엔드 동기화 패치)
function openStudentRaidSetup() {
    if (!checkFeatureLock('raid', '3인 파티 던전', 2)) return;
    const maxRaid = Number(sysConfig.max_weekly_raid) || 1;
    const weeklyRaid = (currentStudent.weekly_raid !== undefined && currentStudent.weekly_raid !== "") ? Number(currentStudent.weekly_raid) : maxRaid;
    if (weeklyRaid <= 0) {
        showUiAlert('🚫 입장 불가', '이번 주 파티 던전 탐험 기회를 모두 소진했습니다.<br><span style="font-size:0.8em; color:#aaa;">(매주 월요일 자정 초기화)</span>', '');
        return;
    }

    raidParty = [currentStudent.name];
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = '#0F172A';
    subModal.querySelector('.modal-content').style.borderColor = '#F59E0B';

    let html = '<h2 style="color:#F59E0B; margin-bottom: 5px;">🏰 파티원 모집</h2>' +
        '<p style="color:#CBD5E1; font-size:0.9em; margin-bottom:15px;">함께 던전에 도전할 동료를 2명 더 선택하세요. (현재: <span id="partyCountText">1/3</span>명)</p>' +
        '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:10px; max-height:40vh; overflow-y:auto; padding-right:5px; margin-bottom:20px;">';

    window.allStudentsData.forEach(s => {
        if (!s.name || s.name === currentStudent.name) return; // 자신 제외하고 렌더링

        const maxWeeklyRaid = Number(sysConfig.max_weekly_raid) || 1;
        // 💡 시트 셀이 비어있는 경우("") 기본값(maxWeeklyRaid)을 적용하도록 보완
        const targetRaidCount = (s.weekly_raid !== undefined && s.weekly_raid !== "") ? Number(s.weekly_raid) : maxWeeklyRaid;

        if (targetRaidCount <= 0) {
            html += '<button id="raidSelectBtn_' + s.name + '" style="padding:12px 8px; background:#0F172A; border:2px solid #334155; border-radius:10px; color:#64748B; font-weight:bold; cursor:not-allowed; opacity:0.5; font-size:1.05em;" disabled title="이번 주 던전 탐험 횟수를 모두 소진했습니다.">🚫 ' + s.name + '<br><span style="font-size:0.88em; color:#94A3B8; font-weight:normal;">(0/' + maxWeeklyRaid + '회)</span></button>';
        } else {
            html += '<button id="raidSelectBtn_' + s.name + '" style="padding:12px 8px; background:#1E293B; border:2px solid #334155; border-radius:10px; color:white; font-weight:bold; cursor:pointer; transition:0.2s; font-size:1.05em;" onclick="toggleStudentRaidMember(\'' + s.name + '\')">' + s.name + '<br><span style="font-size:0.88em; color:#34D399; font-weight:bold;">(' + targetRaidCount + '/' + maxWeeklyRaid + '회)</span></button>';
        }
    });

    html += '</div>' +
        '<div style="display:flex; gap:10px;">' +
        '  <button style="flex:1; padding:15px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeSubModal()">취소</button>' +
        '  <button id="btnGoDungeon" style="flex:2; padding:15px; border-radius:10px; border:none; background:#555; color:white; font-size:1.1em; cursor:pointer; font-weight:bold;" onclick="checkAndOpenDungeon()" disabled>던전 선택으로 (인원 부족)</button>' +
        '</div>';

    subBody.innerHTML = html;
    subModal.style.display = 'flex';
}

function toggleStudentRaidMember(name) {
    const idx = raidParty.indexOf(name);
    const btn = document.getElementById('raidSelectBtn_' + name);
    if (idx > -1) {
        raidParty.splice(idx, 1);
        btn.style.borderColor = '#334155';
        btn.style.background = '#1E293B';
        btn.style.color = 'white';
    } else {
        if (raidParty.length >= 3) {
            return showUiAlert('⚠️ 인원 초과', '파티원은 방장을 포함하여 3명까지만 선택할 수 있습니다.', '');
        }

        // 💡 [신규] 초대받는 파티원의 남은 횟수 체크 로직 추가 (빈 셀 방어 적용)
        const targetStudent = window.allStudentsData.find(s => s.name === name);
        const maxWeeklyRaid = Number(sysConfig.max_weekly_raid) || 1;
        const targetRaidCount = (targetStudent.weekly_raid !== undefined && targetStudent.weekly_raid !== "") ? Number(targetStudent.weekly_raid) : maxWeeklyRaid;

        if (targetRaidCount <= 0) {
            return showUiAlert('🚫 초대 불가', name + ' 모험가는 이번 주 파티 던전 탐험 기회를 모두 소진했습니다.', '');
        }

        raidParty.push(name);
        btn.style.borderColor = '#F59E0B';
        btn.style.background = '#FEF3C7';
        btn.style.color = '#B45309';
    }

    document.getElementById('partyCountText').innerText = raidParty.length + '/3';
    const goBtn = document.getElementById('btnGoDungeon');
    if (raidParty.length === 3) {
        goBtn.style.background = '#F59E0B';
        goBtn.disabled = false;
        goBtn.innerText = "🚀 던전 선택으로 이동";
    } else {
        goBtn.style.background = '#555';
        goBtn.disabled = true;
        goBtn.innerText = "던전 선택으로 (인원 부족)";
    }
}

function checkAndOpenDungeon() {
    if (raidParty.length !== 3) return;

    // 💡 최종 출발 전 파티원 전원의 자격(횟수)을 다시 한 번 완벽히 검증 (이중 방어)
    const maxWeeklyRaid = Number(sysConfig.max_weekly_raid) || 1;
    for (let i = 0; i < raidParty.length; i++) {
        const memberName = raidParty[i];
        const targetStudent = window.allStudentsData.find(s => s.name === memberName);
        if (targetStudent) {
            const targetRaidCount = targetStudent.weekly_raid !== undefined ? Number(targetStudent.weekly_raid) : maxWeeklyRaid;
            if (targetRaidCount <= 0) {
                showUiAlert('🚫 출발 불가', memberName + ' 모험가의 파티 던전 탐험 기회가 부족합니다.<br>파티를 다시 구성해주세요.', '');
                return;
            }
        }
    }

    openDungeonSelection();
}

function openDungeonSelection() {
    if (raidParty.length === 0) return showUiAlert("⚠️ 경고", "파티원이 선택되지 않았습니다.", "");
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = '#0F172A';
    subModal.querySelector('.modal-content').style.borderColor = '#1E293B';

    let html = '<h2 style="color:var(--Yellow); margin-bottom: 5px;">🏰 파티 던전 탐험</h2><p style="color:#CBD5E1; font-size:0.9em;">파티원: <span style="color:white; font-weight:bold;">' + raidParty.join(', ') + '</span></p><div class="stage-container">';

    dungeonsData.forEach(d => {
        if (!d.dungeon_id) return;
        const starString = '★'.repeat(Number(d.difficulty) || 1);

        // 💡 보상 박스 이름 매핑
        let boxName = "전리품 상자";
        const boxData = lootBoxesData.find(b => b.box_id === d.reward_box);
        if (boxData) boxName = boxData.box_name;

        html +=
            '<div class="monster-card">' +
            '  <div class="stars" style="color:var(--Yellow);">' + starString + '</div>' +
            '  <div style="font-size:40px; margin-bottom:10px;">🏰</div>' +
            '  <h4 style="margin: 5px 0; color: white;">' + d.dungeon_name + '</h4>' +
            '  <div style="font-size: 0.85em; color: #ccc; margin-bottom: 10px;">보상: <span style="color:#ffd700;">' + boxName + '</span></div>' +
            '  <button class="small-btn" style="width: 100%; background: var(--BtnBattle); color: white; border: none; padding: 8px; border-radius: 5px; cursor: pointer;" onclick="enterRaid(\'' + d.dungeon_id + '\')">입장하기</button>' +
            '</div>';
    });
    html += '</div><button style="margin-top:20px; width:100%; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeSubModal()">닫기</button>';
    subBody.innerHTML = html;
    subModal.style.display = 'flex';
}

// 레이드 전투 진입 및 초기화
function enterRaid(dungeonId) {
    const d = dungeonsData.find(x => x.dungeon_id === dungeonId);
    if (!d) return alert("던전 정보를 찾을 수 없습니다.");

    closeSubModal();
    currentRaidDungeon = d;
    currentRaidStage = 1;
    totalRaidReward = 0;

    document.getElementById('singlePlayerContainer').style.display = 'none';
    document.getElementById('partyPlayerContainer').style.display = 'flex';
    document.getElementById('battlePlayerName').innerText = "모험가 파티";

    battleState = {
        isRaid: true,
        isFleeing: false,
        party: [],
        currentTurnIdx: 0,
        raidRound: 1, // 💡 서든데스 연산을 위해 반드시 초기화 선언 필요! (누락 시 NaN 버그 발생)
        monster: null,
        monsterMaxHp: 0,
        monsterCurrentHp: 0,
        monsterCd: 1,
        monsterEffects: [],
        monsterSkill: null,
        isAutoRunning: false,
        turnTimer: null
    };

    // 파티원 데이터 스냅샷 생성
    raidParty.forEach((sName, index) => {
        const sData = window.allStudentsData.find(s => s.name === sName);
        if (!sData) return;

        // 기존 getPlayerTotalStats를 사용하기 위해 임시로 currentStudent를 치환하여 연산
        const tempS = currentStudent;
        currentStudent = sData;
        const pStats = getPlayerTotalStats();
        currentStudent = tempS;

        const hpPerPoint = Number(sysConfig.hp_per_point) || 10;

        let pObj = {
            name: sData.name,
            studentData: sData,
            maxHp: pStats.hp * hpPerPoint,
            currentHp: pStats.hp * hpPerPoint,
            atk: pStats.atk,
            def: pStats.def,
            luk: pStats.luk,
            skills: [],
            relicEffects: { dodge: 0, critRate: 0, critDmg: 0, regen: 0, skillProb: 0, goldMult: 0 },
            effects: [],
            isDead: false,
            uiIndex: index
        };

        // 유물 특수 효과 추출
        [sData.relic_1, sData.relic_2].forEach(rid => {
            if (rid && rid !== 'null' && rid !== 'false') {
                const r = relicsData.find(x => String(x.relic_id) === String(rid));
                if (r) {
                    const t = String(r.effect_type).toLowerCase();
                    const v = Number(r.value) || 0;
                    if (t === 'dodge_up') pObj.relicEffects.dodge += v * 100;
                    if (t === 'crit_up') pObj.relicEffects.critRate += v * 100;
                    if (t === 'crit_dmg') pObj.relicEffects.critDmg += v;
                    if (t === 'hp_regen') pObj.relicEffects.regen += v;
                    if (t === 'skill_prob') pObj.relicEffects.skillProb += v * 100;
                    if (t === 'gold_up') pObj.relicEffects.goldMult += v;
                }
            }
        });

        // 💡 [수정] 동료(용병) 특수 옵션 추출 추가
        [sData.party_m1, sData.party_m2].forEach(mId => {
            if (mId && mId !== 'null' && mId !== 'false' && String(mId).trim() !== '') {
                const merc = mercenariesData.find(x => String(x.merc_id) === String(mId));
                if (merc) {
                    const t = String(merc.option_type).toUpperCase();
                    const v = Number(merc.option_value) || 0;
                    if (t === 'EVD_UP') pObj.relicEffects.dodge += v * 100;
                    if (t === 'CRIT_UP') pObj.relicEffects.critRate += v * 100;
                    if (t === 'CRIT_DMG_UP') pObj.relicEffects.critDmg += v;
                }
            }
        });

        // 가호 적용
        let bColor = String(sData.blessing).trim();
        if (bColor === 'Red' || bColor === '빨간색') pObj.atk = Math.floor(pObj.atk * 1.1);
        else if (bColor === 'Blue' || bColor === '파란색') pObj.def = Math.floor(pObj.def * 1.1);
        else if (bColor === 'Green' || bColor === '초록색') { pObj.maxHp = Math.floor(pObj.maxHp * 1.1); pObj.currentHp = pObj.maxHp; }
        else if (bColor === 'Yellow' || bColor === '노란색') pObj.luk = Math.floor(pObj.luk * 1.1);
        pObj.purpleDodgeActive = (bColor === 'Purple' || bColor === '보라색');

        // 스킬 추출 (대표 캐릭터 스킬)
        if (sData.equipped_1 && sData.equipped_1 !== 'null' && sData.equipped_1 !== 'false') {
            const skData = skillsData.find(x => String(x.skill_id) === String(sData.equipped_1));
            if (skData) pObj.skills.push({ ...skData, currentCd: 0 });
        }

        battleState.party.push(pObj);
    });

    renderPartyUI();
    startRaidStage();
}

function renderPartyUI() {
    const container = document.getElementById('partyPlayerContainer');
    let html = '';

    battleState.party.forEach((p, index) => {
        const sData = p.studentData;
        const currentSkinId = sData.equipped_skin || 'HD001';
        const skinObj = skinsData.find(x => String(x.skin_id) === String(currentSkinId));
        const skinImgUrl = (skinObj && skinObj.skin_url) ? skinObj.skin_url : 'https://via.placeholder.com/150/444444/FFFFFF?text=NoSkin';

        let skillsHtml = p.skills.map(sk => {
            const isReady = sk.currentCd === 0;
            const filterStyle = isReady ? '' : 'filter: grayscale(100%) opacity(0.6);';
            const iconSrc = sk.icon_url || 'https://via.placeholder.com/50/222222/FFFFFF?text=SK';
            const skBlessing = sk.blessing && String(sk.blessing).trim() !== '' && String(sk.blessing).trim() !== 'None' ? String(sk.blessing).trim() : 'Highlight';
            const bColor = 'var(--' + skBlessing + ')';
            const borderStyle = isReady ? 'border: 2px solid ' + bColor + '; box-shadow: 0 0 5px ' + bColor + ';' : 'border: 2px solid #555;';
            const overlay = isReady ? '' : '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:1.2em; font-weight:bold; color:white; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">' + sk.currentCd + '</div>';
            return '<div style="position:relative; width:35px; height:35px; border-radius:6px; background:#111; ' + borderStyle + ' ' + filterStyle + ' transition: 0.3s; margin: 0 2px;"><img src="' + iconSrc + '" style="width:100%; height:100%; object-fit:contain; border-radius:4px; padding:1px;">' + overlay + '</div>';
        }).join('');

        const hpPercent = Math.max(0, (p.currentHp / p.maxHp) * 100);
        const opacity = p.isDead ? '0.3' : '1';

        html += `
                    <div id="partyMember_${p.uiIndex}" class="party-member-card" style="opacity: ${opacity};">
                        <div style="position: relative; display: inline-block; margin-bottom: 5px;">
                            <img src="${skinImgUrl}" style="width: 80px; height: 80px; object-fit: contain; transform: scaleX(-1); filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">
                            <img id="partyEffect_${p.uiIndex}" src="" onerror="this.style.display='none'" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 120px; height: 120px; object-fit: contain; pointer-events: none; display: none; z-index: 20;">
                        </div>
                        <div style="width: 100%; text-align: center;">
                            <div style="font-weight:bold; color:var(--${sData.blessing || 'Highlight'}); text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; font-size: 1.1em; margin-bottom: 5px; line-height:1.2;">${getTitleHtml(sData)}</div>
                            <div class="raid-hp-bar-bg" style="height: 12px; border-radius: 6px; width: 100%; margin: 0 auto;"><div id="partyHpBar_${p.uiIndex}" class="raid-hp-bar-fill" style="width: ${hpPercent}%;"></div></div>
                            <div style="margin-top:5px; font-size:0.8em; color:#ccc; margin-bottom: 8px;"><span id="partyHpText_${p.uiIndex}">HP: ${p.currentHp} / ${p.maxHp}</span></div>
                            <div style="display:flex; justify-content:center; align-items:center; min-height:35px; gap:5px; margin-bottom: 5px;">${skillsHtml}</div>
                            <div id="partyStatus_${p.uiIndex}" style="display:flex; justify-content:center; flex-wrap:wrap; gap:2px; min-height:18px;"></div>
                        </div>
                    </div>`;

        // 💡 [핵심] 1번 카드 렌더링 후 강제로 줄바꿈을 일으켜 피라미드 형태 유지!
        if (index === 0) html += '<div style="flex-basis: 100%; height: 0;"></div>';
    });
    container.innerHTML = html;
    container.style.display = 'flex';
}

function updatePartyHpBars() {
    battleState.party.forEach(p => {
        if (p.isDead) return;
        const hpPercent = Math.max(0, (p.currentHp / p.maxHp) * 100);
        document.getElementById(`partyHpBar_${p.uiIndex}`).style.width = hpPercent + '%';
        document.getElementById(`partyHpText_${p.uiIndex}`).innerText = `HP: ${p.currentHp} / ${p.maxHp}`;

        let sHtml = p.effects.map(eff => `<span>${effectIconMap[eff.type] || '✨'}</span>`).join('');
        document.getElementById(`partyStatus_${p.uiIndex}`).innerHTML = sHtml;
    });
}

function startRaidStage() {
    const d = currentRaidDungeon;

    let mId = '';
    if (currentRaidStage === 1) mId = d.mob1_id;
    else if (currentRaidStage === 2) mId = d.mob2_id;
    else if (currentRaidStage === 3) mId = d.mob3_id; // 💡 3번몹 참조 이름 주의!

    // 빈칸이거나 3계층을 넘었으면 풀클리어!
    if (!mId || String(mId).trim() === '' || currentRaidStage > 3) {
        logBattle(`🎉 <b style="color:#ffd700;">모든 계층을 정복했습니다!</b>`);
        setTimeout(() => finishRaid(true), 1500);
        return;
    }

    const targetMonster = monsterList.find(m => String(m.monster_id).trim() === String(mId).trim());
    if (!targetMonster) {
        alert(`몬스터 정보(${mId})를 찾을 수 없습니다.`); fleeBattle(); return;
    }

    battleState.monster = targetMonster;
    battleState.monsterMaxHp = Number(targetMonster.hp);
    battleState.monsterCurrentHp = battleState.monsterMaxHp;
    battleState.monsterEffects = [];
    battleState.monsterCd = 1;

    const mSkillId = targetMonster.skill_list || targetMonster.skill_id || targetMonster.skill;
    battleState.monsterSkill = mSkillId ? monsterSkillsData.find(x => String(x.skill_id) === String(mSkillId).trim()) : null;

    document.getElementById('battleTitle').innerText = `🏰 ${d.dungeon_name}`;
    const stInfo = document.getElementById('raidStageInfo');
    stInfo.style.display = 'block';
    stInfo.innerText = `[ ${currentRaidStage} 계층 ] 누적 획득 예정: ${totalRaidReward} EXP`;

    document.getElementById('battleMonsterName').innerText = targetMonster.name;
    const mImg = document.getElementById('battleMonsterImg');
    mImg.src = targetMonster.icon_url ? targetMonster.icon_url : 'https://via.placeholder.com/120/444444/FFFFFF?text=Monster';

    const sizeMap = { 1: 120, 2: 180, 3: 240, 4: 300 };
    const finalSize = sizeMap[Number(targetMonster.size) || 2] || 120;
    mImg.style.width = finalSize + 'px'; mImg.style.height = finalSize + 'px';
    mImg.classList.add('pixelated-monster');

    renderMonsterSkillsUI();
    document.getElementById('monsterHpBar').style.width = '100%';
    document.getElementById('monsterHpText').innerText = `HP: ${battleState.monsterMaxHp} / ${battleState.monsterMaxHp}`;

    logBattle(`[${currentRaidStage}계층] <b>${targetMonster.name}</b> 등장!`);

    if (battleState.party.every(p => p.isDead)) {
        logBattle('☠️ <b style="color:#ff4d4d;">파티 전멸...</b>');
        setTimeout(() => finishRaid(false), 2000);
        return;
    }

    document.getElementById('battleModal').style.display = 'flex';
    battleState.isAutoRunning = true;
    battleState.currentTurnIdx = 0;
    battleState.turnTimer = setTimeout(raidPlayerTurnAuto, 1500);
}

function raidPlayerTurnAuto() {
    if (!battleState.isAutoRunning) return;

    if (battleState.currentTurnIdx === 0) {
        if (battleState.raidRound === 5 && !battleState.sd1Logged) {
            logBattle('⚠️ <b style="color:var(--Red);">[5라운드 돌입] 광폭화 시작! (회복량 50% 감소 / 피해량 20% 증가)</b>');
            battleState.sd1Logged = true;
        } else if (battleState.raidRound === 10 && !battleState.sd2Logged) {
            logBattle('💀 <b style="color:var(--Red);">[10라운드 돌입] 한계 도달! (모든 피해량 50% 증가)</b>');
            battleState.sd2Logged = true;
        }
    }

    const sdMults = getSuddenDeathMults();
    let p = battleState.party[battleState.currentTurnIdx];

    // 💡 죽은 파티원일 경우, 턴을 스킵하되 마지막 순서라면 보스의 상태이상/쿨타임 연산은 챙겨줌!
    if (p.isDead) {
        let isRoundEnd = (battleState.currentTurnIdx >= battleState.party.length - 1);
        if (isRoundEnd) {
            processStatusEffects(false); // 보스 도트 데미지 적용
            if (battleState.monsterCurrentHp <= 0) {
                logBattle(`🎉 <b style="color:#ffd700;">상태이상으로 보스가 쓰러졌습니다!</b>`);
                battleState.isAutoRunning = false;
                setTimeout(() => handleRaidMonsterDefeat(), 1500);
                return;
            }
            // 보스 쿨타임 및 버프/디버프 턴수 깎기
            if (battleState.monsterSkill && battleState.monsterCd > 0) battleState.monsterCd--;
            battleState.monsterEffects.forEach(e => e.duration--);
            battleState.monsterEffects = battleState.monsterEffects.filter(e => e.duration > 0);
            renderMonsterSkillsUI();
        }
        nextRaidTurn(0);
        return;
    }

    battleState.party.forEach(memb => document.getElementById(`partyMember_${memb.uiIndex}`).style.borderColor = '#333');
    document.getElementById(`partyMember_${p.uiIndex}`).style.borderColor = 'var(--Highlight)';

    let canAct = true;
    let pRate = (Number(sysConfig.poison_dmg) || 5) / 100;
    let bRate = (Number(sysConfig.bleed_dmg) || 10) / 100;
    let fRate = (Number(sysConfig.burn_dmg) || 3) / 100;

    for (let i = p.effects.length - 1; i >= 0; i--) {
        let type = String(p.effects[i].type);
        if (['중독', '출혈', '화상', '저주'].includes(type)) {
            let dmg = 1;
            if (type === '중독') dmg = Math.floor(p.maxHp * pRate);
            if (type === '출혈') dmg = Math.floor(p.currentHp * bRate);
            if (type === '화상') dmg = Math.floor(p.maxHp * fRate);
            if (type === '저주') dmg = Math.floor(p.maxHp * 0.05);

            if (dmg < 1) dmg = 1;
            p.currentHp = Math.max(0, p.currentHp - dmg);
            logBattle(`<span style="color:#b366ff;">[${type}]</span> ${p.name} ${dmg}피해!`);
        }
        else if (['기절', '빙결', '구속', '마비'].includes(type)) {
            logBattle(`💫 <span style="color:#aaa;">${p.name} [${type}] 행동불가!</span>`);
            canAct = false;
        }
        else if (type === '재생') {
            let heal = Math.floor(p.maxHp * 0.05 * sdMults.heal);
            p.currentHp = Math.min(p.maxHp, p.currentHp + heal);
            logBattle(`✨ <span style="color:#4dff88;">[재생]</span> ${p.name} +${heal}!`);
        }
    }
    updatePartyHpBars();

    if (p.currentHp <= 0) {
        p.isDead = true;
        document.getElementById(`partyMember_${p.uiIndex}`).style.opacity = '0.3';
        logBattle(`☠️ <b style="color:#ff4d4d;">${p.name} 쓰러짐!</b>`);
        if (battleState.party.every(memb => memb.isDead)) {
            battleState.isAutoRunning = false;
            setTimeout(() => finishRaid(false), 1500); return;
        }
        setTimeout(nextRaidTurn, 1000); return;
    }

    if (!canAct) {
        p.skills.forEach(sk => { if (sk.currentCd > 0) sk.currentCd--; });
        p.effects.forEach(e => e.duration--);
        p.effects = p.effects.filter(e => e.duration > 0);
        renderPartyUI();
        setTimeout(nextRaidTurn, 1000); return;
    }

    let pAtk = p.atk; let pDef = p.def; let pLuk = p.luk;
    let mDef = Number(battleState.monster.def) || 0;

    p.effects.forEach(eff => {
        if (eff.type === '광폭화') { pAtk *= 1.2; pDef *= 0.8; }
        if (eff.type === '마력집중') pAtk *= 2.0;
        if (eff.type === '보호막') pDef = Math.floor(pDef * 1.5);
        if (['공격감소', '화상', '저주'].includes(eff.type)) pAtk *= 0.8;
        if (['방어감소', '방깎출혈', '저주'].includes(eff.type)) pDef *= 0.8;
        if (['행운감소', '저주'].includes(eff.type)) pLuk *= 0.8;
    });
    battleState.monsterEffects.forEach(eff => {
        if (['방어감소', '방깎출혈', '저주'].includes(eff.type)) mDef *= 0.8;
    });

    let usedSkill = null;
    if (!p.effects.some(e => e.type === '침묵')) {
        for (let i = 0; i < p.skills.length; i++) {
            let sk = p.skills[i];
            if (sk.currentCd === 0) {
                let finalProb = (Number(sk.base_prob) || 50) + (pLuk * (Number(sysConfig.skill_per_luk) || 0.5)) + p.relicEffects.skillProb;
                if (String(sk.blessing).trim() === String(p.studentData.blessing).trim()) finalProb += 20;
                if ((Math.random() * 100) < finalProb) {
                    usedSkill = sk; usedSkill.currentCd = Number(usedSkill.cooldown) || 3; break;
                }
            }
        }
    } else { logBattle('💬 침묵 상태!'); }

    // 💡 컨테이너가 뒤집히지 않고 앞으로 돌진하는 전용 애니메이션 적용
    playAnim(`partyMember_${p.uiIndex}`, 'anim-raid-attack', 300);

    let hitCount = p.effects.some(e => e.type === '더블히트') ? 2 : 1;
    let effectType = '없음'; let mainSkillType = 'damage'; let multiplier = 1.0; let effectDelay = 0;

    if (usedSkill) {
        logBattle(`<span style="color:var(--${p.studentData.blessing || 'Highlight'});">[스킬 발동]</span> ${p.name}: ${usedSkill.name}!`);
        effectType = effectTranslator[String(usedSkill.special_effect).toLowerCase().trim()] || usedSkill.special_effect;
        mainSkillType = String(usedSkill.effect_type).toLowerCase().trim();
        multiplier = Number(usedSkill.multiplier) || Number(usedSkill.muliplier) || 1.0;
        const effectDuration = Number(usedSkill.duration) || 0;

        if (usedSkill.effect_url && String(usedSkill.effect_url).trim() !== '') {
            let eTime = Number(usedSkill.effect_time) || 1000;
            effectDelay = eTime;
            let isBuff = ['나', '자신', 'self', '본인', 'ally_single', 'ally_all'].includes(String(usedSkill.target_type).trim().toLowerCase()) || ['회복', '은신', '보호막', '광폭화', '마력집중', '회피증가', '재생', '더블히트'].includes(effectType) || mainSkillType === 'heal' || mainSkillType === 'buff';
            playSkillEffect(isBuff ? 'partyEffect_' + p.uiIndex : 'monster', usedSkill.effect_url, effectDelay);
        }
        if (effectType === '2연격') hitCount = 2;
        if (effectType === '3연격') hitCount = 3;

        setTimeout(() => {
            if (mainSkillType === 'heal' || effectType === '회복') {
                let healAmount = 0;
                if (mainSkillType === 'heal') {
                    let baseVal = Number(usedSkill.base_value) || 0;
                    let sc = String(usedSkill.scaling_stat).toLowerCase().trim();
                    let sVal = pAtk;
                    if (sc === 'hp') sVal = p.maxHp;
                    if (sc === 'def') sVal = pDef;
                    if (sc === 'luk') sVal = pLuk;
                    healAmount = Math.floor((baseVal + (sVal * multiplier)) * sdMults.heal);
                } else {
                    healAmount = Math.floor(p.maxHp * 0.25 * sdMults.heal);
                }

                let tType = String(usedSkill.target_type).trim().toLowerCase();
                let isPartyHeal = ['ally_all', '전체', '파티'].includes(tType);

                if (isPartyHeal) {
                    battleState.party.forEach(memb => {
                        if (!memb.isDead) memb.currentHp = Math.min(memb.maxHp, memb.currentHp + healAmount);
                    });
                    logBattle(`✨ <span style="color:#4dff88;">[파티 전체 회복]</span> 파티원 체력 +${healAmount}!`);
                } else {
                    p.currentHp = Math.min(p.maxHp, p.currentHp + healAmount);
                    logBattle(`✨ <span style="color:#4dff88;">[회복]</span> ${p.name} 체력 +${healAmount}!`);
                }
                updatePartyHpBars();
            }
            if (effectType !== '없음' && !['null', '3연격', '처형', '방어관통', '회복'].includes(effectType) && effectDuration > 0) {
                let tType = String(usedSkill.target_type).trim().toLowerCase();
                let isBuffEffect = ['은신', '보호막', '광폭화', '마력집중', '회피증가', '재생', '더블히트'].includes(effectType) || ['나', '자신', 'self', '본인', 'ally_single', 'ally_all'].includes(tType);
                if (isBuffEffect) {
                    // 💡 대상이 전체 파티원일 경우
                    if (['ally_all', '전체', '파티'].includes(tType)) {
                        battleState.party.forEach(memb => {
                            if (!memb.isDead) memb.effects.push({ type: effectType, duration: effectDuration });
                        });
                        logBattle(`✨ 파티 전체에 [${effectType}] 부여!`);
                    } else {
                        // 단일 대상일 경우 시전자 본인에게 부여
                        p.effects.push({ type: effectType, duration: effectDuration });
                        logBattle(`✨ ${p.name}에게 [${effectType}] 부여!`);
                    }
                } else {
                    if ((Math.random() * 100) < ((Number(battleState.monster.luk) || 0) * 0.2) && effectType !== '강력한기절') logBattle(`🛡️ 보스가 [${effectType}] 저항!`);
                    else {
                        let actualType = (effectType === '방깎출혈') ? '출혈' : effectType;
                        battleState.monsterEffects.push({ type: actualType, duration: effectDuration });
                        if (effectType === '방깎출혈') battleState.monsterEffects.push({ type: '방어감소', duration: effectDuration });
                        logBattle(`💥 보스에게 [${effectType}] 부여!`);
                    }
                }
            }
        }, effectDelay);
    } else { logBattle(`<span style="color:#4d94ff;">[${p.name} 공격]</span>`); }

    // 타격 연산
    if (!usedSkill || (mainSkillType !== 'heal' && mainSkillType !== 'buff' && effectType !== '회복')) {
        for (let h = 1; h <= hitCount; h++) {
            setTimeout(() => {
                let isCritHit = (Math.random() * 100) < ((pLuk * (Number(sysConfig.crit_per_luk) || 0.5)) + p.relicEffects.critRate);
                if (p.effects.some(e => e.type === '은신')) { isCritHit = true; if (h === hitCount) p.effects = p.effects.filter(e => e.type !== '은신'); }

                let hitCritMult = isCritHit ? (1.5 + p.relicEffects.critDmg) : 1.0;
                let execMult = (effectType === '처형') ? 1.0 + (1 - (battleState.monsterCurrentHp / battleState.monsterMaxHp)) * 1.5 : 1.0;
                let baseDmg = usedSkill ? Math.floor(((Number(usedSkill.base_value) || 0) + (pAtk * multiplier)) * hitCritMult * execMult * sdMults.dmg) : Math.floor(pAtk * hitCritMult * sdMults.dmg);

                let fDef = (effectType === '방어관통' || effectType === 'pierce') ? 0 : mDef;
                const defC = Number(sysConfig.def_constant) || 50;
                let finalDmg = Math.max(1, Math.floor(baseDmg * (defC / (defC + fDef))));

                // 💡 [기믹] 철벽 방어 (주기적인 턴마다 데미지를 1로 고정)
                if (battleState.isBoss && (battleState.gimmick_type === 'shield' || battleState.gimmick_type === '철벽')) {
                    if (battleState.turnCount % Math.max(1, battleState.gimmick_value) === 0) {
                        finalDmg = 1;
                        logBattle('🛡️ <b style="color:#34D399;">[철벽] 보스가 단단한 방어막을 전개하여 피해를 최소화했습니다!</b>');
                    }
                }

                battleState.monsterCurrentHp = Math.max(0, battleState.monsterCurrentHp - finalDmg);
                logBattle(`${hitCount > 1 ? "&lt;" + h + "타&gt; " : ""}${isCritHit ? "💥치명타! " : ""}적에게 ${finalDmg} 피해!`);

                document.getElementById('monsterHpBar').style.width = (battleState.monsterCurrentHp / battleState.monsterMaxHp * 100) + '%';
                document.getElementById('monsterHpText').innerText = `HP: ${battleState.monsterCurrentHp} / ${battleState.monsterMaxHp}`;
                playAnim('battleMonsterImg', 'anim-damage', 250);
            }, effectDelay + (250 * h));
        }
    }

    // 턴 마무리 및 다음으로 넘기기
    setTimeout(() => {
        if (usedSkill) p.effects = p.effects.filter(e => e.type !== '마력집중');
        p.skills.forEach(sk => { if (sk !== usedSkill && sk.currentCd > 0) sk.currentCd--; });
        p.effects.forEach(e => e.duration--);
        p.effects = p.effects.filter(e => e.duration > 0);
        renderPartyUI();

        if (battleState.monsterCurrentHp <= 0) {
            logBattle(`🎉 <b style="color:#ffd700;">${battleState.monster.name} 처치!</b>`);
            setTimeout(() => handleRaidMonsterDefeat(), 1500); return;
        }
        // 💡 다음 파티원으로 넘기지 않고 바로 보스의 반격 턴으로 연결!
        battleState.turnTimer = setTimeout(raidMonsterTurnAuto, 1000);
    }, effectDelay + (250 * hitCount) + 100);
}

// 💡 딜레이 시간을 매개변수(기본값 1000ms)로 받을 수 있도록 변경
function nextRaidTurn(delayTime = 1000) {
    if (!battleState.isAutoRunning) return;

    // 💡 보스 턴이 끝난 후 호출됨. 다음 파티원으로 인덱스 증가
    battleState.currentTurnIdx++;

    // 모든 파티원이 한 번씩 다 때렸으면 0번 파티원으로 초기화 (새로운 라운드 시작)
    if (battleState.currentTurnIdx >= battleState.party.length) {
        battleState.party.forEach(memb => document.getElementById(`partyMember_${memb.uiIndex}`).style.borderColor = '#333');
        battleState.currentTurnIdx = 0;
        battleState.raidRound++; // 💡 신규: 라운드 증가
    }

    // 다음 파티원 턴 시작 (매개변수로 받은 지연 시간 적용)
    battleState.turnTimer = setTimeout(raidPlayerTurnAuto, delayTime);
}

function raidMonsterTurnAuto() {
    if (!battleState.isAutoRunning) return;

    const sdMults = getSuddenDeathMults();

    let canAct = true;

    // 💡 보스가 3번 행동하므로, 쿨타임과 도트 데미지(독/출혈)는 1라운드(마지막 파티원 타격 후)에 딱 한 번만 깎이도록 통제!
    let isRoundEnd = (battleState.currentTurnIdx >= battleState.party.length - 1);

    if (isRoundEnd) {
        let pRate = (Number(sysConfig.poison_dmg) || 5) / 100;
        let bRate = (Number(sysConfig.bleed_dmg) || 10) / 100;
        let fRate = (Number(sysConfig.burn_dmg) || 3) / 100;

        for (let i = battleState.monsterEffects.length - 1; i >= 0; i--) {
            let type = String(battleState.monsterEffects[i].type);
            if (['중독', '출혈', '화상', '저주'].includes(type)) {
                let dmg = 1;
                if (type === '중독') dmg = Math.floor(battleState.monsterMaxHp * pRate);
                if (type === '출혈') dmg = Math.floor(battleState.monsterCurrentHp * bRate);
                if (type === '화상') dmg = Math.floor(battleState.monsterMaxHp * fRate);
                if (type === '저주') dmg = Math.floor(battleState.monsterMaxHp * 0.05);
                if (dmg < 1) dmg = 1;

                battleState.monsterCurrentHp = Math.max(0, battleState.monsterCurrentHp - dmg);
                logBattle(`<span style="color:#b366ff;">[${type}]</span> 보스가 ${dmg} 피해!`);
            }
            else if (['기절', '빙결', '구속', '마비'].includes(type)) { logBattle(`💫 보스 [${type}] 행동불가!`); canAct = false; }
            else if (type === '재생') {
                let heal = Math.floor(battleState.monsterMaxHp * 0.05);
                battleState.monsterCurrentHp = Math.min(battleState.monsterMaxHp, battleState.monsterCurrentHp + heal);
                logBattle(`✨ <span style="color:#4dff88;">[재생]</span> 보스 회복 +${heal}!`);
            }
        } // for문 끝
    } // 💡 isRoundEnd 괄호 닫기

    document.getElementById('monsterHpBar').style.width = (battleState.monsterCurrentHp / battleState.monsterMaxHp * 100) + '%';
    document.getElementById('monsterHpText').innerText = `HP: ${battleState.monsterCurrentHp} / ${battleState.monsterMaxHp}`;

    if (battleState.monsterCurrentHp <= 0) {
        logBattle(`🎉 <b style="color:#ffd700;">상태이상으로 보스가 쓰러졌습니다!</b>`);
        setTimeout(() => handleRaidMonsterDefeat(), 1500); return;
    }

    // 기절 등으로 행동 불가일 때
    if (!canAct) {
        if (battleState.monsterSkill && battleState.monsterCd > 0) battleState.monsterCd--;
        if (isRoundEnd) {
            battleState.monsterEffects.forEach(e => e.duration--);
            battleState.monsterEffects = battleState.monsterEffects.filter(e => e.duration > 0);
        }
        renderMonsterSkillsUI();
        // 💡 행동 불가여도 턴은 다음 파티원에게 정상적으로 넘김
        nextRaidTurn();
        return;
    }

    playAnim('battleMonsterImg', 'anim-attack-m', 300);

    let aliveMembers = battleState.party.filter(p => !p.isDead);
    if (aliveMembers.length === 0) return;

    let targetP = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];

    let usedSkill = null;
    let mIsSilenced = battleState.monsterEffects.some(e => e.type === '침묵');
    if (battleState.monsterSkill && !mIsSilenced) {
        if (battleState.monsterCd <= 0) {
            let mSk = battleState.monsterSkill;
            if ((Math.random() * 100) < (Number(mSk.base_prob) || 50)) {
                usedSkill = mSk; battleState.monsterCd = Number(usedSkill.cooldown) || 3;
            } else {
                // 스킬 대기 메시지는 스팸 방지를 위해 1라운드에 1번만 출력
                if (isRoundEnd) logBattle(`<span style="color:#888; font-size:0.8em;">(보스 스킬 대기 중...)</span>`);
            }
        } else {
            // 💡 쿨타임은 매 몬스터 턴마다 깎임
            battleState.monsterCd--;
        }
        renderMonsterSkillsUI();
    } else if (mIsSilenced) logBattle('💬 침묵 상태!');

    let mAtk = Number(battleState.monster.atk) || 0;
    battleState.monsterEffects.forEach(eff => { if (eff.type === '광폭화') mAtk *= 1.2; if (['공격감소', '저주'].includes(eff.type)) mAtk *= 0.8; });

    let effectDelay = 0; let baseDmg = 0; let effectType = '없음'; let isAoE = false;
    const isCrit = (Math.random() * 100) < 10;
    const critMult = isCrit ? 1.5 : 1.0;
    let critText = isCrit ? "💥크리티컬! " : "";

    if (usedSkill) {
        logBattle(`<span style="color:#ffdb4d;">[보스 스킬 발동]</span> ${usedSkill.name}! ${critText}`);
        const rawSpecial = String(usedSkill.special_effect || '없음').toLowerCase().trim();
        effectType = effectTranslator[rawSpecial] || usedSkill.special_effect;
        if (['none', 'null', 'undefined', '없음', '', 'false'].includes(String(effectType).toLowerCase())) {
            effectType = '없음';
        }
        if (['전체', 'all', 'enemy_all'].includes(String(usedSkill.target_type).toLowerCase().trim())) isAoE = true;

        if (usedSkill.effect_url && String(usedSkill.effect_url).trim() !== '') {
            effectDelay = Number(usedSkill.effect_time) || 1000;
            let isBuff = ['광폭화', '재생', '보호막'].includes(effectType);
            playSkillEffect(isBuff ? 'monster' : 'partyEffect_' + targetP.uiIndex, usedSkill.effect_url, effectDelay);
        }

        setTimeout(() => {
            if (['광폭화', '재생'].includes(effectType)) {
                battleState.monsterEffects.push({ type: effectType, duration: Number(usedSkill.duration) || 0 });
                logBattle(`🔥 보스가 [${effectType}] 상태가 됨!`);
            }
        }, effectDelay);

        if (effectType === '체력비례피해') baseDmg = 9999;
        else baseDmg = Math.floor(mAtk * (Number(usedSkill.multiplier) || Number(usedSkill.muliplier) || 1.5) * critMult * sdMults.dmg);
    } else {
        logBattle(`<span style="color:#ff4d4d;">[보스의 공격]</span> ${critText}`);
        baseDmg = Math.floor(mAtk * critMult * sdMults.dmg);
    }

    // 타격 적용 (광역 or 단일)
    setTimeout(() => {
        let targets = isAoE ? aliveMembers : [targetP];

        targets.forEach(p => {
            let pDef = p.def; let pLuk = p.luk;
            p.effects.forEach(eff => {
                if (eff.type === '보호막') pDef = Math.floor(pDef * 1.5);
                if (eff.type === '행운감소') pLuk *= 0.8;
                if (['방깎출혈', '방어감소', '저주'].includes(eff.type)) pDef *= 0.8;
            });

            let dodgeRate = (pLuk * 0.2) + p.relicEffects.dodge;
            if (p.effects.some(e => e.type === '회피증가')) dodgeRate += 40;

            if (p.purpleDodgeActive) {
                logBattle(`🟣 <b style="color:#d966ff;">${p.name}, 장막 방어!</b>`); p.purpleDodgeActive = false;
            } else if (p.effects.some(e => e.type === '은신')) {
                logBattle(`🌫️ <span style="color:#aaa;">${p.name}, 은신 회피!</span>`);
            } else if ((Math.random() * 100) < dodgeRate) {
                logBattle(`💨 <span style="color:#4dff88;">${p.name} 회피!</span>`);
            } else {
                // 💡 [수정] 레이드 보스 스킬에 '처형' 기믹 추가 적용
                let fDef = (effectType === '방어관통' || effectType === 'pierce') ? 0 : pDef;
                let execMult = (effectType === '처형' || effectType === 'execution') ? 1.0 + (1 - (p.currentHp / p.maxHp)) * 1.5 : 1.0;
                let currentBaseDmg = Math.floor(baseDmg * execMult);
                const defC = Number(sysConfig.def_constant) || 50;

                let finalDmg = effectType === '체력비례피해' ? Math.floor(p.maxHp * 0.2 * sdMults.dmg) : Math.max(1, Math.floor(currentBaseDmg * (defC / (defC + fDef))));

                p.currentHp = Math.max(0, p.currentHp - finalDmg);
                logBattle(`${p.name}에게 ${finalDmg} 피해!`);

                // 💡 컨테이너가 뒤집히지 않도록 반전이 없는 기본 anim-damage 적용
                playAnim(`partyMember_${p.uiIndex}`, 'anim-damage', 400);

                if (effectType === '흡혈' || effectType === '맹독흡혈') {
                    let heal = Math.floor(finalDmg * 0.5 * sdMults.heal);
                    battleState.monsterCurrentHp = Math.min(battleState.monsterMaxHp, battleState.monsterCurrentHp + heal);
                    logBattle(`🩸 보스가 체력을 ${heal} 흡수했습니다!`);
                    updateHpBars();
                }
            }

            if (p.currentHp <= 0) {
                p.isDead = true; document.getElementById(`partyMember_${p.uiIndex}`).style.opacity = '0.3';
                logBattle(`☠️ <b style="color:#ff4d4d;">${p.name} 쓰러짐!</b>`);
            }
        });

        updatePartyHpBars();

        if (battleState.party.every(memb => memb.isDead)) {
            logBattle('☠️ <b style="color:#ff4d4d;">파티가 전멸했습니다... (레이드 실패)</b>');
            battleState.isAutoRunning = false; setTimeout(() => finishRaid(false), 2000);
        } else {
            // 💡 라운드 종료 시에만 보스 디버프 턴수 감소
            if (isRoundEnd) {
                battleState.monsterEffects.forEach(e => e.duration--);
                battleState.monsterEffects = battleState.monsterEffects.filter(e => e.duration > 0);
            }
            // 💡 보스 턴 종료 후 다음 파티원에게 턴을 넘김
            nextRaidTurn();
        }
    }, effectDelay + 150);
}

function handleRaidMonsterDefeat() {
    if (battleState.isFleeing) return;

    battleState.isAutoRunning = false;
    clearTimeout(battleState.turnTimer);

    // 💡 [몬스터 도감] 레이드 몬스터 처치 성공 시 도감에 누적 기록 (처치 횟수용)
    if (battleState.monster) {
        const mId = battleState.monster.monster_id || battleState.monster.boss_id;
        if (mId) {
            const rawMonsters = String(currentStudent.monster_data || "").replace(/!/g, '');
            let myMonsters = rawMonsters ? rawMonsters.split(',').map(x => x.trim()).filter(Boolean) : [];
            myMonsters.push(mId);
            currentStudent.monster_data = "!" + myMonsters.join(',');
            updateFastFirebaseStudent(currentStudent);
        }
    }

    // 💡 [개편] 골드 대신 경험치 누적 (몬스터 난이도 비례)
    const star = Number(battleState.monster.difficulty) || 1;
    const expGain = battleState.monster.name.includes('[보스]') ? (star * 30) : (star * 10);
    totalRaidReward += expGain; // totalRaidReward를 이제 경험치 누적용으로 사용합니다!

    document.getElementById('raidStageInfo').innerText = `[ ${currentRaidStage} 계층 클리어! ] 누적 획득 예정: ${totalRaidReward} EXP`;

    showUiConfirm(
        `🎉 ${currentRaidStage}계층 토벌 성공!`,
        `누적 경험치: <b style="color:#60A5FA;">${totalRaidReward} EXP</b><br><br>다음 계층으로 나아가시겠습니까?<br><span style="color:#ff4d4d; font-size:0.8em;">(전멸 시 보상을 잃고 탐험 기회가 차감됩니다. 현재 체력 유지)</span>`,
        "proceedToNextRaidStage()"
    );

    // "취소" 버튼의 기능을 "탈출(수령)"으로 덮어씌움
    const btns = document.getElementById('uiPopupButtons').getElementsByTagName('button');
    if (btns.length > 0) {
        btns[0].innerText = "포기하고 현재 보상만 획득";
        btns[0].style.background = "#42B3A4";
        btns[0].onclick = function () { closeUiPopup(); finishRaid(true); };
    }
}

function proceedToNextRaidStage() {
    currentRaidStage++;
    startRaidStage();
}

function finishRaid(isSuccess) {
    if (battleState.isFleeing) return;
    document.getElementById('battleModal').style.display = 'none';

    const maxRaid = Number(sysConfig.max_weekly_raid) || 1;

    battleState.party.forEach(p => {
        let stObj = window.allStudentsData.find(s => s.name === p.name);
        if (!stObj) return;

        let curRaid = (stObj.weekly_raid !== undefined && stObj.weekly_raid !== "") ? Number(stObj.weekly_raid) : maxRaid;
        stObj.weekly_raid = Math.max(0, curRaid - 1);
    });

    if (!isSuccess) {
        updateFastFirebaseStudent(currentStudent);
        showUiAlert("💀 던전 탐험 실패", "파티가 전멸하여 보상을 얻지 못했습니다...<br><br><span style='color:#ff4d4d; font-size:0.9em;'>(참여한 파티원 전원의 탐험 기회가 1 차감됩니다.)</span>", "renderDashboard()");
        return;
    }

    let isFullClear = false;
    const d = currentRaidDungeon;
    let nextMobId = currentRaidStage === 1 ? d.mob2_id : (currentRaidStage === 2 ? d.mob3_id : null);
    if (!nextMobId || String(nextMobId).trim() === '' || currentRaidStage > 3) {
        isFullClear = true;
    }

    const rewardBoxId = d.reward_box || "";
    const boxData = lootBoxesData.find(b => b.box_id === rewardBoxId);
    const boxName = boxData ? boxData.box_name : "전리품 상자";

    let msg = `획득 경험치: <b style="color:var(--Highlight);">전원 ${totalRaidReward} EXP</b><br>`;
    let boxToGive = isFullClear ? boxName : "";

    if (isFullClear) {
        msg += `획득 전리품: <b style="color:var(--TextGold);">${boxName}</b> (전원 지급)<br><br><span style="color:var(--Green); font-size:0.85em; font-weight:bold;">(가방에서 상자를 열어 보상을 확인하세요!)</span>`;
    } else {
        msg += `<span style="color:var(--TextLock); font-size:0.8em;">(중도 포기하여 전리품 상자는 지급되지 않습니다.)</span><br><br>`;
    }

    let sharedRaidExp = Math.max(1, Math.floor(totalRaidReward / (raidParty.length || 3)));
    const expMax = Number(sysConfig.exp_max) || 200;
    const pointsPerLevel = Number(sysConfig.points_per_level) || 3;
    let leveledUpMembers = [];

    battleState.party.forEach(p => {
        let stObj = window.allStudentsData.find(s => s.name === p.name);
        if (!stObj) return;

        // 1. 경험치 지급 및 누적
        stObj.exp = (Number(stObj.exp) || 0) + sharedRaidExp;

        // 2. 💡 [핵심 버그 수정] 파티원 각각 레벨업 및 포인트 지급 체크
        let memberLeveled = false;
        while (stObj.exp >= expMax) {
            stObj.exp -= expMax;
            stObj.level = (Number(stObj.level) || 1) + 1;
            stObj.level_points = (Number(stObj.level_points) || 0) + pointsPerLevel;
            memberLeveled = true;
        }
        if (memberLeveled) {
            leveledUpMembers.push(`${stObj.name}(Lv.${stObj.level})`);
        }

        // 3. 전리품 상자 지급
        if (boxToGive) {
            let items = stObj.inventory ? String(stObj.inventory).split(',') : [];
            items.push(boxToGive);
            stObj.inventory = items.join(',');
        }

        // 4. 현재 로그인한 본인(currentStudent) 상태 즉시 동기화
        if (currentStudent && currentStudent.name === stObj.name) {
            currentStudent.exp = stObj.exp;
            currentStudent.level = stObj.level;
            currentStudent.level_points = stObj.level_points;
            currentStudent.inventory = stObj.inventory;
        }
    });

    if (leveledUpMembers.length > 0) {
        msg += `<br><br>🎊 <b>레벨업 달성:</b> <span style="color:var(--Highlight); font-weight:bold;">${leveledUpMembers.join(', ')}</span>`;
    }

    // 📝 [Firebase 파티 던전 로그 전송]
    pushFirebaseLog('common', {
        time: new Date().toISOString(),
        name: currentStudent.name,
        category: "파티 던전",
        content: `${d.dungeon_name} (${raidParty.join(', ')}) -> 전원 ${totalRaidReward} EXP` + (boxToGive ? ` / [${boxToGive}] 지급` : '')
    });

    // 💡 [안정화 패치] 전체 학생 DB 덮어쓰기를 제거하고, 실제 파티에 참여한 3명만 개별 안전 업데이트
    Promise.all(battleState.party.map(p => {
        let stObj = window.allStudentsData.find(s => s.name === p.name);
        return stObj ? updateFastFirebaseStudent(stObj) : Promise.resolve();
    })).then(() => {
        showUiAlert("🏆 던전 탐험 보상 획득", msg, "renderDashboard()");
    });
}

// ==========================================
// 💀 보스전 시스템
// ==========================================
if (typeof window.bossList === 'undefined') {
    window.bossList = [];
}

function openBossSelection() {
    if (!checkFeatureLock('boss', '1:1 보스 도전', 2)) return;
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = '#1E1B4B';
    subModal.querySelector('.modal-content').style.borderColor = '#A78BFA';

    let html = '<h2 style="color:#A78BFA; margin-bottom: 5px;">💀 보스 레이드</h2>' +
        '<p style="color:#CBD5E1; font-size:0.9em;">주간 보스 도전 기회 1회와 보스 도전권 1장을 함께 소모하여 강력한 보스에게 도전합니다.</p>' +
        '<div class="stage-container">';

    (bossList || []).forEach(b => {
        const stars = '💀'.repeat(Number(b.difficulty) || 1);
        html += `
                    <div class="monster-card" style="border-color:#A78BFA; background:#312E81;">
                        <div class="stars">${stars}</div>
                        <img src="${b.icon_url || ''}" style="width:100px; height:100px; object-fit:contain; margin-bottom:10px;">
                        <h4 style="margin: 5px 0; color: white;">${b.name}</h4>
                        <div style="font-size: 0.8em; color: #ddd; margin-bottom: 10px;">HP: ${b.hp} | ATK: ${b.atk}</div>
                        <button class="small-btn" style="width: 100%; background:#8B5CF6; color: white;" onclick="checkBossEntry('${b.boss_id}')">보스 도전</button>
                    </div>`;
    });

    html += '</div><button style="margin-top:20px; width:100%; padding:12px; border-radius:10px; border:none; background:#444; color:white;" onclick="closeSubModal()">닫기</button>';
    subBody.innerHTML = html;
    subModal.style.display = 'flex';
}

function checkBossEntry(bossId) {
    const boss = bossList.find(b => String(b.boss_id).trim() === String(bossId).trim());
    if (!boss) return alert("보스 정보를 찾을 수 없습니다.");

    // 🩹 1. penalty_end_time 직관적 비교 기반 보스방 패널티 점검
    if (currentStudent.penalty_end_time) {
        const penaltyEndTime = Number(currentStudent.penalty_end_time);
        const now = new Date().getTime();
        if (now < penaltyEndTime) {
            const remainMs = penaltyEndTime - now;
            const remainH = Math.floor(remainMs / (1000 * 60 * 60));
            const remainM = Math.floor((remainMs % (1000 * 60 * 60)) / (1000 * 60));

            const isFleePenalty = remainMs <= (2 * 60 * 60 * 1000);
            const penaltyTitle = isFleePenalty ? '🏃 후퇴 후 재정비 중' : '🩹 중상 (회복 중)';
            showUiAlert(penaltyTitle, '부상 또는 패널티로 인해 회복 중입니다.<br>완치되기 전에는 보스에게 도전할 수 없습니다!<br><br><span style="color:#ff4d4d; font-weight:bold; font-size:1.2em;">남은 시간: ' + remainH + '시간 ' + remainM + '분</span>', '');
            return;
        }
    }

    const maxWeeklyBoss = Number(sysConfig.max_weekly_boss) || 3;
    const currentBossChance = currentStudent.weekly_boss !== undefined ? Number(currentStudent.weekly_boss) : maxWeeklyBoss;

    if (currentBossChance <= 0) {
        showUiAlert("🚫 도전 불가", "이번 주 보스 도전 기회를 모두 소진했습니다.<br><br><span style='font-size:0.9em; color:var(--TextSub);'>상점에서 <b style='color:var(--Highlight);'>보스 도전기회 추가 티켓</b>을 구매해 사용하면 1회 회복할 수 있습니다.</span>", "");
        return;
    }

    const bossGrade = String(boss.require || boss.Require || '하급').trim();
    const reqTicket = bossGrade + ' 보스 도전권';

    const rawInv = String(currentStudent.inventory || "");
    let items = rawInv ? rawInv.split(',').map(x => x.trim()).filter(Boolean) : [];
    const ticketIdx = items.indexOf(reqTicket);

    if (ticketIdx === -1) {
        showUiAlert("🚫 도전 불가", "가방에 <b style='color:var(--Red);'>" + reqTicket + "</b>이(가) 없습니다!<br>상점에서 구매 후 도전하세요.", "");
        return;
    }

    showUiConfirm(
        "💀 보스 레이드 입장",
        "보스 <b style='color:var(--Red);'>" + boss.name + "</b>에게 도전하시겠습니까?<br><br><span style='color:var(--Highlight); font-weight:bold;'>※ 입장 시 주간 보스 도전 기회 1회와 [" + reqTicket + "] 1장이 즉시 소모됩니다.</span>",
        "startBossBattle('" + bossId + "', 'ticket')"
    );
}

function startBossBattle(bossId, type) {
    const boss = bossList.find(b => String(b.boss_id).trim() === String(bossId).trim());
    if (!boss) return alert("보스 정보를 찾을 수 없습니다.");

    battleState.bossEntryType = type;

    showGlobalLoading("💀 보스 레이드 입장 처리 중...");

    const bossGrade = String(boss.require || boss.Require || '하급').trim();
    const reqTicket = bossGrade + ' 보스 도전권';

    const rawInv = String(currentStudent.inventory || "");
    let items = rawInv ? rawInv.split(',').map(x => x.trim()).filter(Boolean) : [];
    const ticketIdx = items.indexOf(reqTicket);

    if (ticketIdx > -1) {
        items.splice(ticketIdx, 1);
    }
    currentStudent.inventory = items.join(',');

    const maxBoss = Number(sysConfig.max_weekly_boss) || 3;
    let curBoss = (currentStudent.weekly_boss !== undefined && currentStudent.weekly_boss !== "") ? Number(currentStudent.weekly_boss) : maxBoss;
    currentStudent.weekly_boss = Math.max(0, curBoss - 1);

    updateFastFirebaseStudent(currentStudent);

    hideGlobalLoading();
    closeSubModal();
    enterBattle(bossId, true);
}

function checkAndStartTower() {
    if (!checkFeatureLock('tower', '도전의 탑', 2)) return;
    const maxTower = Number(sysConfig.max_weekly_tower) || 1;
    const weeklyTower = (currentStudent.weekly_tower !== undefined && currentStudent.weekly_tower !== "") ? Number(currentStudent.weekly_tower) : maxTower;
    if (weeklyTower <= 0) {
        showUiAlert('🚫 입장 불가', '이번 주 도전의 탑 기회를 모두 소진했습니다.<br><span style="font-size:0.8em; color:#aaa;">(매주 월요일 자정 초기화)</span>', '');
        return;
    }
    showUiConfirm("🗼 도전의 탑", "도전의 탑은 쉴 틈 없이 23층까지 진행되는 서바이벌입니다.<br>도중에 패배하거나 이탈하면 즉시 정산됩니다.<br><br>도전하시겠습니까?", "startTower()");
}

function startTower() {
    battleState.isTower = true;
    battleState.towerFloor = 1;
    battleState.towerBossCount = 0;
    battleState.towerMonsterIds = [];

    document.getElementById('singlePlayerContainer').style.display = 'block';
    document.getElementById('partyPlayerContainer').style.display = 'none';
    document.getElementById('raidStageInfo').style.display = 'block';

    const pStats = getPlayerTotalStats();

    battleState.isFleeing = false;
    battleState.turnCount = 1;

    // 💡 가호 보너스가 계산되기 전 스탯 임시 변수 할당
    let baseHp = pStats.hp;
    let baseAtk = pStats.atk;
    let baseDef = pStats.def;
    let baseLuk = pStats.luk;

    const bColor = String(currentStudent.blessing).trim();
    if (bColor === 'Red' || bColor === '빨간색') {
        baseAtk = Math.floor(baseAtk * 1.1);
    } else if (bColor === 'Blue' || bColor === '파란색') {
        baseDef = Math.floor(baseDef * 1.1);
    } else if (bColor === 'Green' || bColor === '초록색') {
        baseHp = Math.floor(baseHp * 1.1);
    } else if (bColor === 'Yellow' || bColor === '노란색') {
        baseLuk = Math.floor(baseLuk * 1.1);
    }

    // 💡 최종 체력 계산 및 세션 데이터 주입
    const hpPerPoint = Number(sysConfig.hp_per_point) || 10;
    battleState.playerMaxHp = baseHp * hpPerPoint;
    battleState.playerCurrentHp = battleState.playerMaxHp;

    battleState.playerAtk = baseAtk;
    battleState.playerDef = baseDef;
    battleState.playerLuk = baseLuk;

    battleState.purpleDodgeActive = (bColor === 'Purple' || bColor === '보라색');

    battleState.relicEffects = { dodge: 0, critRate: 0, critDmg: 0, regen: 0, skillProb: 0, goldMult: 0 };
    [currentStudent.relic_1, currentStudent.relic_2].forEach(rid => {
        if (rid && rid !== 'null' && rid !== 'false') {
            const r = relicsData.find(x => String(x.relic_id) === String(rid));
            if (r) {
                const t = String(r.effect_type).toLowerCase();
                const v = Number(r.value) || 0;
                if (t === 'dodge_up') battleState.relicEffects.dodge += v * 100;
                if (t === 'crit_up') battleState.relicEffects.critRate += v * 100;
                if (t === 'crit_dmg') battleState.relicEffects.critDmg += v;
                if (t === 'hp_regen') battleState.relicEffects.regen += v;
                if (t === 'skill_prob') battleState.relicEffects.skillProb += v * 100;
                if (t === 'gold_up') battleState.relicEffects.goldMult += v;
            }
        }
    });

    // 💡 [수정] 동료(용병) 특수 옵션 추출 추가
    [currentStudent.party_m1, currentStudent.party_m2].forEach(mId => {
        if (mId && mId !== 'null' && mId !== 'false' && String(mId).trim() !== '') {
            const merc = mercenariesData.find(x => String(x.merc_id) === String(mId));
            if (merc) {
                const t = String(merc.option_type).toUpperCase();
                const v = Number(merc.option_value) || 0;
                if (t === 'EVD_UP') battleState.relicEffects.dodge += v * 100;
                if (t === 'CRIT_UP') battleState.relicEffects.critRate += v * 100;
                if (t === 'CRIT_DMG_UP') battleState.relicEffects.critDmg += v;
            }
        }
    });

    const currentSkinId = currentStudent.equipped_skin || 'HD001';
    const skinObj = skinsData.find(x => String(x.skin_id) === String(currentSkinId));
    const pImgSrc = (skinObj && skinObj.skin_url) ? skinObj.skin_url : 'https://drive.google.com/thumbnail?id=1uoFPxFfpUaxE3eZCbrVU8oEvQLyQTg9b&sz=w200';
    document.getElementById('battlePlayerImg').src = pImgSrc;

    const pNameEl = document.getElementById('battlePlayerName');
    pNameEl.innerText = currentStudent.name;
    pNameEl.style.color = `var(--${currentStudent.blessing || 'Highlight'})`;
    pNameEl.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';

    document.getElementById('battleLog').innerHTML = '';
    setupPlayerSkills();

    loadTowerFloor();
}

function loadTowerFloor() {
    let isBoss = false;
    let targetMonster = null;
    let f = battleState.towerFloor;

    let nIdx = 0;
    if (f <= 7) nIdx = f - 1;
    else if (f === 8) { isBoss = true; targetMonster = bossList[0] || bossList[bossList.length - 1]; }
    else if (f <= 12) nIdx = f - 2;
    else if (f === 13) { isBoss = true; targetMonster = bossList[1] || bossList[bossList.length - 1]; }
    else if (f <= 17) nIdx = f - 3;
    else if (f === 18) { isBoss = true; targetMonster = bossList[2] || bossList[bossList.length - 1]; }
    else if (f <= 23) nIdx = f - 4;

    if (!isBoss) {
        targetMonster = monsterList[Math.min(nIdx, monsterList.length - 1)];
    }

    if (!targetMonster) {
        showUiAlert("오류", "몬스터 정보를 불러올 수 없습니다.", "renderDashboard()");
        return;
    }

    if ([5, 10, 15, 20].includes(f)) {
        let heal = Math.floor((battleState.playerMaxHp - battleState.playerCurrentHp) * 0.3);
        if (heal > 0) {
            battleState.playerCurrentHp += heal;
            updateHpBars();
            showUiAlert("✨ 회복의 샘", f + "층에 도달하여 잃은 체력의 30%(" + heal + ")를 회복했습니다!", "setupTowerBattleStage()");
            battleState.tempMonsterForTower = targetMonster;
            battleState.tempIsBossForTower = isBoss;
            return;
        }
    }

    battleState.tempMonsterForTower = targetMonster;
    battleState.tempIsBossForTower = isBoss;
    setupTowerBattleStage();
}

function setupTowerBattleStage() {
    let targetMonster = battleState.tempMonsterForTower;
    let isBoss = battleState.tempIsBossForTower;

    battleState.isBoss = isBoss;
    battleState.gimmick_type = isBoss ? String(targetMonster.gimmick_type || '없음').trim().toLowerCase() : '없음';
    battleState.gimmick_value = isBoss ? Number(targetMonster.gimmick_value) || 0 : 0;
    battleState.turnCount = 1;

    battleState.monster = targetMonster;
    battleState.monsterMaxHp = Number(targetMonster.hp);
    battleState.monsterCurrentHp = battleState.monsterMaxHp;

    battleState.playerEffects = [];
    battleState.monsterEffects = [];
    battleState.monsterCd = 1;

    const mSkillId = targetMonster.skill_list || targetMonster.skill_id || targetMonster.skill;
    battleState.monsterSkill = mSkillId ? monsterSkillsData.find(x => String(x.skill_id) === String(mSkillId).trim()) : null;

    document.getElementById('battleTitle').innerText = '🗼 도전의 탑 ' + battleState.towerFloor + '층';
    const stInfo = document.getElementById('raidStageInfo');
    stInfo.style.display = 'block';
    stInfo.innerText = '[수문장: ' + targetMonster.name + ']';

    document.getElementById('battleMonsterName').innerText = targetMonster.name;
    const mImg = document.getElementById('battleMonsterImg');
    mImg.src = targetMonster.icon_url ? targetMonster.icon_url : 'https://via.placeholder.com/120/444444/FFFFFF?text=Monster';

    const sizeMap = { 1: 120, 2: 180, 3: 240, 4: 300 };
    const mSize = Number(targetMonster.size) || 2;
    const finalSize = sizeMap[mSize] || 120;
    mImg.style.width = finalSize + 'px';
    mImg.style.height = finalSize + 'px';
    mImg.width = 64;
    mImg.height = 64;
    mImg.classList.add('pixelated-monster');

    renderMonsterSkillsUI();
    updateHpBars();

    logBattle('🗼 <b>' + battleState.towerFloor + '층</b> 진입! [' + targetMonster.name + '] 등장!');

    document.getElementById('battleModal').style.display = 'flex';
    battleState.isAutoRunning = true;
    battleState.turnTimer = setTimeout(playerTurnAuto, 1000);
}

function handleTowerMonsterDefeat() {
    let mId = battleState.monster.monster_id || battleState.monster.boss_id;
    if (mId) battleState.towerMonsterIds.push(mId);

    if (battleState.isBoss) {
        battleState.towerBossCount++;
    }

    if (battleState.towerFloor >= 23) {
        endTowerAndReward(true);
    } else {
        battleState.towerFloor++;
        loadTowerFloor();
    }
}

function handleTowerPlayerDefeat() {
    endTowerAndReward(false);
}

function endTowerAndReward(isMaxClear = false) {
    battleState.isAutoRunning = false;
    clearTimeout(battleState.turnTimer);
    document.getElementById('battleModal').style.display = 'none';

    let clearedFloors = battleState.towerFloor - (battleState.playerCurrentHp > 0 && isMaxClear ? 0 : 1);
    if (isMaxClear && battleState.playerCurrentHp > 0) clearedFloors = 23;

    currentStudent.max_tower_floor = Math.max(Number(currentStudent.max_tower_floor) || 0, clearedFloors);

    let validBossCount = 0;
    if (clearedFloors >= 8) validBossCount++;
    if (clearedFloors >= 13) validBossCount++;
    if (clearedFloors >= 18) validBossCount++;

    // 💡 10티 단위 고정 수식 적용 (완주 시 200티)
    let rmAmount = (Math.floor(clearedFloors / 2) * 10) + (validBossCount * 30);
    let realCurrency = sysConfig.currency_name || '티';

    let msg = `당신의 이번 주 최고 기록은 <b>${clearedFloors}층</b>입니다!<br>`;
    if (rmAmount > 0) {
        msg += `<br>보상: <b style="color:var(--Highlight);">[현실 재화] ${rmAmount}${realCurrency} 교환권</b>`;
    } else {
        msg += `<br><span style="color:#aaa;">아쉽게도 보상을 획득하지 못했습니다.</span>`;
    }

    showUiAlert("🗼 도전의 탑 정산", msg, "renderDashboard()");

    if (rmAmount > 0) {
        let items = currentStudent.inventory ? String(currentStudent.inventory).split(',') : [];
        items.push(`[현실 재화] ${rmAmount}${realCurrency} 교환권`);
        currentStudent.inventory = items.join(',');
    }

    if (battleState.towerMonsterIds.length > 0) {
        const rawMonsters = String(currentStudent.monster_data || "").replace(/!/g, '');
        let myMonsters = rawMonsters ? rawMonsters.split(',').map(x => x.trim()).filter(Boolean) : [];
        myMonsters.push(...battleState.towerMonsterIds);
        currentStudent.monster_data = "!" + myMonsters.join(',');
    }

    const maxTower = Number(sysConfig.max_weekly_tower) || 1;
    let curTower = (currentStudent.weekly_tower !== undefined && currentStudent.weekly_tower !== "") ? Number(currentStudent.weekly_tower) : maxTower;
    currentStudent.weekly_tower = Math.max(0, curTower - 1);

    // 📝 [Firebase 도전의 탑 로그 전송]
    pushFirebaseLog('common', {
        time: new Date().toISOString(),
        name: currentStudent.name,
        category: "도전의 탑",
        content: `${clearedFloors}층 정복 -> ` + (rmAmount > 0 ? `[현실 재화] ${rmAmount}${realCurrency} 교환권` : '보상 없음')
    });

    updateFastFirebaseStudent(currentStudent);
}

// ==========================================
// 🐲 월드 보스 10턴 서바이벌 전투 엔진
// ==========================================
function startWorldBossRaid(wbId) {
    const activeBoss = (worldBossesData || []).find(b => String(b.wb_id) === String(wbId));
    if (!activeBoss) return showUiAlert("오류", "보스 데이터를 찾을 수 없습니다.", "");

    closeSubModal();
    document.getElementById('singlePlayerContainer').style.display = 'block';
    document.getElementById('partyPlayerContainer').style.display = 'none';
    document.getElementById('raidStageInfo').style.display = 'block';

    const pStats = getPlayerTotalStats();

    const bossMaxHp = Number(activeBoss.max_hp) || Number(worldBossState.max_hp) || 150000;

    battleState = {
        isWorldBoss: true,
        wbBossData: activeBoss,
        wbTurn: 1,
        wbMaxTurns: Number(activeBoss.turn_limit) || 10,
        wbDamageTotal: 0,
        monster: activeBoss,
        monsterMaxHp: bossMaxHp,
        monsterCurrentHp: Math.max(1, Number(worldBossState.current_hp) || bossMaxHp),
        playerMaxHp: pStats.hp * (Number(sysConfig.hp_per_point) || 10),
        playerCurrentHp: pStats.hp * (Number(sysConfig.hp_per_point) || 10),
        playerAtk: pStats.atk,
        playerDef: pStats.def,
        playerLuk: pStats.luk,
        skills: [],
        playerEffects: [],
        monsterEffects: [],
        isAutoRunning: true,
        turnTimer: null,
        relicEffects: { dodge: 0, critRate: 0, critDmg: 0, regen: 0, skillProb: 0, goldMult: 0 }
    };

    // 가호 보정
    const bColor = String(currentStudent.blessing).trim();
    if (bColor === 'Red') battleState.playerAtk = Math.floor(battleState.playerAtk * 1.1);
    else if (bColor === 'Blue') battleState.playerDef = Math.floor(battleState.playerDef * 1.1);
    else if (bColor === 'Green') { battleState.playerMaxHp = Math.floor(battleState.playerMaxHp * 1.1); battleState.playerCurrentHp = battleState.playerMaxHp; }
    else if (bColor === 'Yellow') battleState.playerLuk = Math.floor(battleState.playerLuk * 1.1);
    battleState.purpleDodgeActive = (bColor === 'Purple');

    // 대표 스킨 및 아바타
    const currentSkinId = currentStudent.equipped_skin || 'HD001';
    const skinObj = skinsData.find(x => String(x.skin_id) === String(currentSkinId));
    document.getElementById('battlePlayerImg').src = (skinObj && skinObj.skin_url) ? skinObj.skin_url : 'https://via.placeholder.com/150';

    // 동료 아바타 연동
    const m1Box = document.getElementById('merc1BattleBox');
    const m1Img = document.getElementById('merc1BattleImg');
    if (m1Box && m1Img) {
        const m1Obj = mercenariesData.find(m => String(m.merc_id) === String(currentStudent.party_m1));
        if (m1Obj && m1Obj.icon_url) { m1Img.src = m1Obj.icon_url; m1Box.style.display = 'flex'; }
        else { m1Box.style.display = 'none'; }
    }

    const m2Box = document.getElementById('merc2BattleBox');
    const m2Img = document.getElementById('merc2BattleImg');
    if (m2Box && m2Img) {
        const m2Obj = mercenariesData.find(m => String(m.merc_id) === String(currentStudent.party_m2));
        if (m2Obj && m2Obj.icon_url) { m2Img.src = m2Obj.icon_url; m2Box.style.display = 'flex'; }
        else { m2Box.style.display = 'none'; }
    }

    // 보스 세팅
    document.getElementById('battleTitle').innerText = `[월드 보스 레이드] ${activeBoss.name}`;
    document.getElementById('raidStageInfo').innerText = `[ 1 / ${battleState.wbMaxTurns} 턴 ] 누적 딜량: 0`;
    document.getElementById('battlePlayerName').innerHTML = getTitleHtml(currentStudent);
    document.getElementById('battleMonsterName').innerText = activeBoss.name;

    const mImg = document.getElementById('battleMonsterImg');
    mImg.src = activeBoss.icon_url || 'https://via.placeholder.com/150';
    mImg.style.width = '240px';
    mImg.style.height = '240px';

    setupPlayerSkills();
    updateHpBars();
    document.getElementById('battleLog').innerHTML = '';
    logBattle(`월드 보스 <b>[${activeBoss.name}]</b>와의 결전이 시작되었습니다!`);
    logBattle(`(목표: ${battleState.wbMaxTurns}턴 동안 살아남으며 최대 피해를 입히세요!)`);

    document.getElementById('battleModal').style.display = 'flex';
    battleState.turnTimer = setTimeout(worldBossPlayerTurnAuto, 1000);
}

function worldBossPlayerTurnAuto() {
    if (!battleState.isAutoRunning) return;

    const gType = String(battleState.wbBossData.gimmick_type || '없음').trim().toLowerCase();
    const gVal = Number(battleState.wbBossData.gimmick_value) || 0;

    // 💡 [기믹 1] 타임어택: 지정 턴에 도달하면 보스가 폭주하여 전멸기 발동
    if ((gType === 'time_attack' || gType === '타임어택') && gVal > 0 && battleState.wbTurn >= gVal) {
        logBattle('⏱️ <b style="color:var(--Red);">[타임 오버] 보스가 폭주하여 즉사 전멸기를 사용합니다!</b>');
        battleState.playerCurrentHp = 0;
        updateHpBars();
        playAnim('battlePlayerImg', 'anim-damage-p', 400);
        setTimeout(() => finishWorldBossSession(false), 1200);
        return;
    }

    document.getElementById('raidStageInfo').innerText = `[ ${battleState.wbTurn} / ${battleState.wbMaxTurns} 턴 ] 누적 딜량: ${battleState.wbDamageTotal.toLocaleString()}`;

    // 상태이상 체크
    const canAct = processStatusEffects(true);
    if (battleState.playerCurrentHp <= 0) {
        logBattle('☠️ <b style="color:#ff4d4d;">보스의 압도적인 위압감에 쓰러졌습니다!</b>');
        setTimeout(() => finishWorldBossSession(false), 1200);
        return;
    }

    if (!canAct) {
        decrementStatusEffects(true);
        battleState.turnTimer = setTimeout(worldBossMonsterTurnAuto, 1000);
        return;
    }

    // 스킬 추첨 및 공격 연산 (철저한 본인 스펙 반영)
    let pAtk = battleState.playerAtk;
    let pLuk = battleState.playerLuk;
    let bDef = Number(battleState.wbBossData.def) || 10;

    let usedSkill = null;
    for (let i = 0; i < battleState.skills.length; i++) {
        let sk = battleState.skills[i];
        if (sk.currentCd === 0) {
            let finalProb = (Number(sk.base_prob) || 50) + (pLuk * 0.5);
            if ((Math.random() * 100) < finalProb) {
                usedSkill = sk;
                usedSkill.currentCd = Number(usedSkill.cooldown) || 3;
                break;
            }
        }
    }

    let attackTarget = 'battlePlayerImg';
    if (usedSkill) {
        if (usedSkill.ownerType === 'm1') attackTarget = 'merc1BattleImg';
        else if (usedSkill.ownerType === 'm2') attackTarget = 'merc2BattleImg';
    }
    playAnim(attackTarget, 'anim-attack-p', 300);

    let multiplier = usedSkill ? (Number(usedSkill.multiplier) || Number(usedSkill.muliplier) || 1.5) : 1.0;
    const isCrit = (Math.random() * 100) < (pLuk * 0.5);
    const critMult = isCrit ? 1.5 : 1.0;

    let hitDmg = Math.max(10, Math.floor((pAtk * multiplier * critMult) - bDef));

    // 💡 [기믹 2] 철벽: N턴 주기마다 피해를 1로 고정
    if ((gType === 'shield' || gType === '철벽') && gVal > 0 && battleState.wbTurn % gVal === 0) {
        hitDmg = 1;
        logBattle('🛡️ <b style="color:#34D399;">[철벽] 보스가 단단한 방어막을 전개하여 피해를 1로 줄였습니다!</b>');
    }

    battleState.wbDamageTotal += hitDmg;

    setTimeout(() => {
        let logPrefix = usedSkill ? `✨ [스킬] ${usedSkill.name}!` : `⚔️ [일반 공격]`;
        logBattle(`${logPrefix} ${isCrit ? "💥크리티컬! " : ""}보스에게 <b>${hitDmg.toLocaleString()}</b>의 피해!`);
        playAnim('battleMonsterImg', 'anim-damage', 250);
        document.getElementById('raidStageInfo').innerText = `[ ${battleState.wbTurn} / ${battleState.wbMaxTurns} 턴 ] 누적 딜량: ${battleState.wbDamageTotal.toLocaleString()}`;
        
        battleState.skills.forEach(sk => { if (sk !== usedSkill && sk.currentCd > 0) sk.currentCd--; });
        renderBattleSkillsUI();

        decrementStatusEffects(true);
        battleState.turnTimer = setTimeout(worldBossMonsterTurnAuto, 1000);
    }, 400);
}

function worldBossMonsterTurnAuto() {
    if (!battleState.isAutoRunning) return;

    playAnim('battleMonsterImg', 'anim-attack-m', 300);

    const gType = String(battleState.wbBossData.gimmick_type || '없음').trim().toLowerCase();
    const gVal = Number(battleState.wbBossData.gimmick_value) || 0;

    let bAtk = Number(battleState.wbBossData.atk) || 80;

    // 💡 [기믹 3] 광폭화: 보스 체력 비율 이하 시 공격력 1.5배 증가
    const curHp = Math.max(0, Number(worldBossState.current_hp) || battleState.monsterMaxHp);
    const hpPercent = (curHp / battleState.monsterMaxHp) * 100;
    if ((gType === 'berserk' || gType === '광폭화') && gVal > 0 && hpPercent <= gVal) {
        bAtk = Math.floor(bAtk * 1.5);
        logBattle('💢 <b style="color:var(--Red);">[광폭화] 마왕이 분노하여 공격력이 대폭 상승했습니다!</b>');
    }

    let turnScaling = 1.0 + (battleState.wbTurn * 0.08); // 턴 경과에 따른 점증 공격력
    let bossDamage = Math.max(5, Math.floor((bAtk * turnScaling) - (battleState.playerDef * 0.6)));

    setTimeout(() => {
        if (battleState.purpleDodgeActive) {
            logBattle('🟣 <b style="color:#d966ff;">[가호] 보스의 공격을 어둠의 장막으로 1회 무효화했습니다!</b>');
            battleState.purpleDodgeActive = false;
        } else {
            battleState.playerCurrentHp = Math.max(0, battleState.playerCurrentHp - bossDamage);
            logBattle(`💥 보스의 맹공! 플레이어가 <b>${bossDamage}</b> 피해를 입었습니다.`);
            updateHpBars();
            playAnim('battlePlayerImg', 'anim-damage-p', 400);

            // 💡 [기믹 4] 흡혈: 플레이어에게 입힌 피해 비례 흡혈
            if ((gType === 'lifesteal' || gType === '흡혈') && gVal > 0) {
                let heal = Math.floor(bossDamage * (gVal / 100));
                if (heal > 0) {
                    logBattle(`🩸 <b style="color:var(--Red);">[흡혈] 보스가 내 생명력을 ${heal}만큼 흡수했습니다!</b>`);
                }
            }
        }

        if (battleState.playerCurrentHp <= 0) {
            logBattle('☠️ <b style="color:#ff4d4d;">보스의 맹공을 버티지 못하고 쓰러졌습니다!</b>');
            setTimeout(() => finishWorldBossSession(false), 1200);
            return;
        }

        // 10턴 생존 완주 체크
        if (battleState.wbTurn >= battleState.wbMaxTurns) {
            logBattle('🎉 <b style="color:#ffd700;">10턴 동안 마왕에게 맞서 끝까지 살아남았습니다!</b>');
            setTimeout(() => finishWorldBossSession(true), 1200);
            return;
        }

        battleState.wbTurn++;
        battleState.turnTimer = setTimeout(worldBossPlayerTurnAuto, 1000);
    }, 400);
}

async function finishWorldBossSession(isSurvived) {
    battleState.isAutoRunning = false;
    clearTimeout(battleState.turnTimer);
    document.getElementById('battleModal').style.display = 'none';

    showGlobalLoading("🐲 월드 보스 레이드 결과 정산 중...");

    const activeBoss = battleState.wbBossData;
    const finalDamage = battleState.wbDamageTotal;

    // 한국 시간(KST) 기준 오늘 출전 날짜 기록
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstDate = new Date(utc + (9 * 60 * 60 * 1000));
    const todayStr = `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;

    // 1. 학생 상태 갱신 (오늘 참여일자 기록, 골드/경험치 지급)
    currentStudent.last_wb_date = todayStr;
    currentStudent.wb_total_damage = (Number(currentStudent.wb_total_damage) || 0) + finalDamage;

    const rewardGold = Number(activeBoss.daily_gold) || 50;
    const rewardExp = Number(activeBoss.daily_exp) || 30;

    currentStudent.game_money = (Number(currentStudent.game_money) || 0) + rewardGold;
    currentStudent.exp = (Number(currentStudent.exp) || 0) + rewardExp;

    // 레벨업 체크
    const expMax = Number(sysConfig.exp_max) || 200;
    const pointsPerLevel = Number(sysConfig.points_per_level) || 3;
    let leveledUp = false;
    while (currentStudent.exp >= expMax) {
        currentStudent.exp -= expMax;
        currentStudent.level = (Number(currentStudent.level) || 1) + 1;
        currentStudent.level_points = (Number(currentStudent.level_points) || 0) + pointsPerLevel;
        leveledUp = true;
    }

    // 2. 파이어베이스 실시간 보스 체력 차감 및 기여도 랭킹 반영
    try {
        const curHp = Math.max(0, (Number(worldBossState.current_hp) || activeBoss.max_hp) - finalDamage);
        const isCleared = (curHp <= 0);

        const currentContribs = worldBossState.contributions || {};
        currentContribs[currentStudent.name] = (Number(currentContribs[currentStudent.name]) || 0) + finalDamage;

        worldBossState.current_hp = curHp;
        worldBossState.contributions = currentContribs;
        worldBossState.is_cleared = isCleared;

        // 📝 [Firebase 월드 보스 로그 전송]
        pushFirebaseLog('common', {
            time: new Date().toISOString(),
            name: currentStudent.name,
            category: "월드 보스",
            content: `${activeBoss.name} 참전 -> 피해량 ${finalDamage.toLocaleString()} 딜 (+${rewardGold}골드 / +${rewardExp}EXP)`
        });

        await Promise.all([
            updateFastFirebaseStudent(currentStudent),
            fetch(`https://learning-explorer-default-rtdb.firebaseio.com/gameData/worldBoss/${activeBoss.wb_id}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_hp: curHp,
                    is_cleared: isCleared,
                    contributions: currentContribs
                })
            })
        ]);

        hideGlobalLoading();
        updateWorldBossBanner(activeBoss);

        const outcomeTitle = isSurvived ? "🎉 10턴 생존 완주 성공!" : "⚔️ 전투 종료";
        const msg = `오늘 가한 총 피해량: <b style="color:#EF4444; font-size:1.3em;">${finalDamage.toLocaleString()} 딜</b><br>` +
            `내 누적 기여도: <b style="color:#FBBF24;">${currentStudent.wb_total_damage.toLocaleString()} 딜</b><br><br>` +
            `🎁 <b>일일 참여 보상 지급</b>: <span style="color:#34D399;">+${rewardGold} 골드</span> / <span style="color:#60A5FA;">+${rewardExp} EXP</span>` +
            (leveledUp ? `<br><br>🎊 <b>Lv.${currentStudent.level}</b>로 레벨업했습니다!` : '');

        showUiAlert(outcomeTitle, msg, "renderDashboard()");

    } catch (e) {
        hideGlobalLoading();
        showUiAlert("정산 오류", "결과 저장 중 오류가 발생했습니다: " + e, "renderDashboard()");
    }
}