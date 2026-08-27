// ==========================================
// 🛡️ 안전 변수 초기화
// ==========================================
if (typeof window.canReroll === 'undefined') window.canReroll = true;

// ==========================================
// 🛒 상점 시스템 (잡화 동적 구매)
// ==========================================
function buyShopItem(itemId) {
    const item = shopData.find(x => String(x.item_id) === String(itemId));
    if (!item) return;
    const cost = Number(item.price) || 0;
    const currentMoney = Number(currentStudent.game_money) || 0;
    const gameCurrency = sysConfig.game_money_currency || '골드';

    // 💡 [신규] 슬롯 확장권 중복 구매 방지 방어 로직
    const invStr = String(currentStudent.inventory || '');
    if (item.effect_type === 'UNLOCK_RELIC_SLOT2' || item.item_name.includes('유물 슬롯')) {
        const isUnlocked = String(currentStudent.relic_slot_2_unlocked).toUpperCase() === 'TRUE';
        if (isUnlocked) {
            showUiAlert("⚠️ 구매 불가", "이미 두 번째 유물 슬롯이 해금되어 있습니다.", "");
            return;
        }
        if (invStr.includes(item.item_name)) {
            showUiAlert("⚠️ 구매 불가", "이미 가방에 [" + item.item_name + "]을(를) 보유하고 있습니다.<br>가방에서 먼저 사용해 주세요.", "");
            return;
        }
    }
    if (item.effect_type === 'UNLOCK_MERC_SLOT2' || item.item_name.includes('동료 슬롯')) {
        const isUnlocked = String(currentStudent.merc_slot2_unlocked).toUpperCase() === 'TRUE';
        if (isUnlocked) {
            showUiAlert("⚠️ 구매 불가", "이미 두 번째 동료 슬롯이 해금되어 있습니다.", "");
            return;
        }
        if (invStr.includes(item.item_name)) {
            showUiAlert("⚠️ 구매 불가", "이미 가방에 [" + item.item_name + "]을(를) 보유하고 있습니다.<br>가방에서 먼저 사용해 주세요.", "");
            return;
        }
    }

    if (currentMoney < cost) {
        showUiAlert("⚠️ 자금 부족", "소지한 재화가 부족합니다.<br><span style='font-size:0.9em; color:#aaa;'>(필요: " + cost + gameCurrency + " / 보유: " + currentMoney + gameCurrency + ")</span>", "");
        return;
    }

    let confirmMsg = "<b style='color:var(--Highlight);'>[" + item.item_name + "]</b>을(를) 구매하시겠습니까?<br><span style='font-size:0.9em; color:var(--TextSub);'>" + (item.description || '') + "</span>";
    if (item.effect_type === 'reset_stat') {
        confirmMsg = "<b style='color:var(--Red);'>[" + item.item_name + "]을(를) 구매하시겠습니까?</b><br><span style='font-size:0.9em; color:var(--TextSub);'>구매 즉시 능력치가 초기화되며 포인트가 반환됩니다.</span>";
    }

    showUiConfirm("🛒 상점 구매", confirmMsg + "<br><br><span style='font-size:1.1em; font-weight:bold; color:var(--TextGold);'>비용: " + cost + " " + gameCurrency + "</span>", "processBuyItem('" + itemId + "')");
}

function processBuyItem(itemId) {
    const item = shopData.find(x => String(x.item_id) === String(itemId));
    if (!item) return;

    const cost = Number(item.price) || 0;
    const currentMoney = Number(currentStudent.game_money) || 0;

    if (currentMoney < cost) {
        showUiAlert("⚠️ 구매 실패", "잔액이 부족합니다.", "");
        return;
    }

    // 💡 [화면 차단] 결제 통신 중 전체 클릭 차단
    showGlobalLoading("🛒 상점 상품 결제 처리 중...");

    currentStudent.game_money = currentMoney - cost;
    let items = currentStudent.inventory ? String(currentStudent.inventory).split(',') : [];
    items.push(item.item_name);
    currentStudent.inventory = items.join(',');

    updateFastFirebaseStudent(currentStudent);

    // 📝 [Firebase 상점 구매 로그 전송]
    pushFirebaseLog('common', {
        time: new Date().toISOString(),
        name: currentStudent.name,
        category: "상점 구매",
        content: item.item_name + " (" + cost + "골드)"
    });

    hideGlobalLoading();
    renderDashboard();
    showUiAlert("🎁 구매 완료!", "[" + item.item_name + "]을(를) 구매했습니다!<br>가방에서 확인하고 원할 때 사용하세요.", "");
}

// ==========================================
// 🔮 스킬 상점 시스템 (UI 팝업 적용)
// ==========================================
function openSkillShop() {
    canReroll = true;
    const cost = Number(sysConfig.skill_price) || 50;
    const gameCurrency = sysConfig.game_money_currency || '골드'; // 💡 인게임 화폐 단위 로드
    const body = document.getElementById('modalBody');
    body.innerHTML =
        '<h2 style="color:var(--Highlight);">📖 스킬 상점</h2>' +
        '<div style="font-size:80px; margin:20px 0;">📚</div>' +
        '<p style="color:var(--TextSub);">새로운 지식을 탐구하시겠습니까?</p>' +
        '<button class="btn-main" style="background:var(--Highlight);" onclick="promptDrawSkills(false)">스킬 뽑기 (비용: ' + cost + gameCurrency + ')</button>' +
        '<button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">돌아가기</button>';
}

function promptDrawSkills(isReroll) {
    if (isReroll) { drawSkills(true); return; } // 리롤은 무료

    // 💡 [연타 방지] 클릭 즉시 모달 내의 모든 버튼을 비활성화
    const btns = document.querySelectorAll('#modalBody .btn-main');
    btns.forEach(btn => btn.disabled = true);

    const cost = Number(sysConfig.skill_price) || 50;
    const gameCurrency = sysConfig.game_money_currency || '골드';
    const currentMoney = Number(currentStudent.game_money) || 0;

    if (currentMoney < cost) {
        btns.forEach(btn => btn.disabled = false); // 실패 시 버튼 다시 활성화
        showUiAlert("⚠️ 자금 부족", "소지한 재화가 부족합니다.<br><span style='font-size:0.9em; color:#aaa;'>(필요: " + cost + gameCurrency + " / 보유: " + currentMoney + gameCurrency + ")</span>", "");
        return;
    }

    currentStudent.game_money = currentMoney - cost;
    updateFastFirebaseStudent(currentStudent);
    drawSkills(false);
}

function drawSkills(isReroll) {
    // 브라우저 confirm 창 제거됨 (UI 팝업에서 승인 후 넘어옴)
    // 💡 [오류 수정] .replace('!', '') 대신 정규식 /!/g 를 사용하여 문자열 내의 모든 느낌표를 완벽히 제거
    const rawSkills = String(currentStudent.unlocked_skills || "").replace(/!/g, '');
    const myUnlocked = rawSkills ? rawSkills.split(',').map(x => x.trim()).filter(Boolean) : [];
    let unowned = skillsData.filter(sk => sk.skill_id && !myUnlocked.includes(String(sk.skill_id)));

    const body = document.getElementById('modalBody');
    if (unowned.length === 0) {
        body.innerHTML = '<h2 style="color:#4dff88;">✨ 마스터!</h2><p>더 이상 모을 스킬이 없습니다.</p><button class="btn-main" onclick="renderDashboard()">돌아가기</button>'; return;
    }

    unowned.sort(() => 0.5 - Math.random());
    const choices = unowned.slice(0, Math.min(3, unowned.length));

    body.innerHTML = '<h2 style="color:var(--Highlight);">' + (isReroll ? '🔄 다시 집중하는 중...' : '✨ 지식을 탐구하는 중...') + '</h2><div style="font-size:80px; margin:40px 0;" class="anim-book">📚</div><p style="color:var(--TextSub);">어떤 스킬이 등장할까요?</p>';

    setTimeout(() => {
        let cardsHtml = choices.map((sk, index) => {
            let blessClass = sk.blessing ? `blessing-${sk.blessing.trim()}` : 'blessing-None';
            let iconDisplay = sk.icon_url ? '<img src="' + sk.icon_url + '" class="skill-icon-pixel ' + blessClass + '" style="width:60px; height:60px; margin: 0 auto 10px auto; display:block;">' : '<div class="skill-icon">🔮</div>';
            return '<div class="skill-card anim-card" style="background:#F8FAFC; border: 2px solid var(--Highlight); color:var(--TextMain); animation-delay: ' + (index * 0.3) + 's;" onclick="selectSkill(\'' + sk.skill_id + '\', \'' + sk.name + '\')">' + iconDisplay + '<div class="skill-name" style="color:var(--Highlight);">' + sk.name + '</div><div class="skill-desc" style="color:var(--TextSub);">' + sk.description + '</div></div>';
        }).join('');

        const rerollBtn = canReroll ? '<button class="btn-main btn-reroll" style="background:var(--Yellow); margin-top:20px;" onclick="doReroll()">리롤 (1회 무료)</button>' : '';
        body.innerHTML = '<h2 style="color:var(--Highlight);">✨ 지식의 발견</h2><p style="color:var(--TextSub);">원하는 스킬 하나를 선택하세요!</p><div class="skill-cards-container">' + cardsHtml + '</div>' + rerollBtn + '<button class="btn-main" style="background:var(--TextSub); margin-top:10px;" onclick="renderDashboard()">포기하기</button>';
    }, 1200);
}

function selectSkill(skillId, skillName) {
    showUiConfirm("✨ 지식 획득", "[<b style=\"color:var(--Highlight);\">" + skillName + "</b>] 스킬을 획득하시겠습니까?", "processSelectSkill('" + skillId + "', '" + skillName + "')");
}

function processSelectSkill(skillId, skillName) {
    // 💡 [오류 수정] 모든 ! 제거 정규식 적용
    const rawSkills = String(currentStudent.unlocked_skills || "").replace(/!/g, '');
    let myUnlocked = rawSkills ? rawSkills.split(',').map(x => x.trim()).filter(Boolean) : [];
    if (!myUnlocked.includes(String(skillId))) myUnlocked.push(skillId);
    currentStudent.unlocked_skills = "!" + myUnlocked.join(',');

    updateFastFirebaseStudent(currentStudent);
    showUiAlert("🎉 획득 완료!", "[<b style=\"color:var(--Highlight);\">" + skillName + "</b>] 스킬을 얻었습니다!", "renderDashboard()");
}

// ==========================================
// 🏺 유물 상점 시스템 (UI 팝업 적용)
// ==========================================
function openRelicShop() {
    const body = document.getElementById('modalBody');
    const cost = Number(sysConfig.relic_price) || 100;
    const gameCurrency = sysConfig.game_money_currency || '골드'; // 💡 인게임 화폐 단위 로드
    body.innerHTML =
        '<h2 style="color:var(--Highlight);">🏺 유물 상점</h2>' +
        '<div style="font-size:80px; margin:20px 0;" class="anim-pot">🏺</div>' +
        '<p style="color:var(--TextSub);">고대의 항아리 속에 잠든 유물을 깨우시겠습니까?</p>' +
        '<button class="btn-main" style="background:var(--Highlight);" onclick="promptDrawRelic()">유물 뽑기 (비용: ' + cost + gameCurrency + ')</button>' +
        '<button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">돌아가기</button>';
}

function promptDrawRelic() {
    // 💡 [연타 방지] 클릭 즉시 모달 내의 모든 버튼을 비활성화
    const btns = document.querySelectorAll('#modalBody .btn-main');
    btns.forEach(btn => btn.disabled = true);

    const cost = Number(sysConfig.relic_price) || 100;
    const gameCurrency = sysConfig.game_money_currency || '골드';
    const currentMoney = Number(currentStudent.game_money) || 0;

    if (currentMoney < cost) {
        btns.forEach(btn => btn.disabled = false); // 실패 시 버튼 다시 활성화
        showUiAlert("⚠️ 자금 부족", "소지한 재화가 부족합니다.<br><span style='font-size:0.9em; color:#aaa;'>(필요: " + cost + gameCurrency + " / 보유: " + currentMoney + gameCurrency + ")</span>", "");
        return;
    }

    // 로컬 데이터 즉시 차감 및 화면 갱신
    currentStudent.game_money = currentMoney - cost;
    updateFastFirebaseStudent(currentStudent);
    drawRelic();
}

function drawRelic() {
    const rawRelics = String(currentStudent.unlocked_relics || "").replace(/!/g, '');
    const myRelics = rawRelics ? rawRelics.split(',').map(x => x.trim()).filter(Boolean) : [];
    let unowned = relicsData.filter(r => r.relic_id && !myRelics.includes(String(r.relic_id)));

    const body = document.getElementById('modalBody');
    if (unowned.length === 0) {
        body.innerHTML = '<h2>🏆 유물 마스터</h2><p>모든 유물을 손에 넣었습니다!</p><button class="btn-main" onclick="renderDashboard()">돌아가기</button>';
        return;
    }

    body.innerHTML = '<h2 style="color:var(--Highlight);">🏺 유물 발굴 중...</h2><div style="margin:50px 0;"><span class="anim-pot">🏺</span></div><p style="color:var(--TextSub);">항아리 속에서 고대의 기운이 느껴집니다!</p>';

    setTimeout(() => {
        const picked = unowned[Math.floor(Math.random() * unowned.length)];
        const translator = (typeof relicEffectTranslator !== 'undefined') ? relicEffectTranslator : {};
        const effName = translator[picked.effect_type] || picked.effect_type;

        let valStr = (picked.effect_type.includes('mult') || (picked.effect_type.includes('up') && !picked.effect_type.match(/^(hp|atk|def|luk|gold)_up$/))) ? (picked.value * 100) + '%' : picked.value;
        if (picked.effect_type === 'gold_up') valStr += (sysConfig.currency_name || '골드');

        body.innerHTML = '<h2 style="color:var(--Highlight);">✨ 유물 발견!</h2><div class="relic-card" style="background:#F8FAFC; border: 2px solid var(--Highlight);"><img src="' + picked.icon_url + '" class="relic-pop"><h3 style="color:var(--Highlight); margin:15px 0;">' + picked.name + '</h3><p style="font-size:0.9em; color:var(--TextMain); line-height:1.5;">' + picked.description + '</p><div style="font-size:0.8em; color:var(--TextSub); margin-top:10px; font-weight:bold;">효과: ' + effName + ' (+' + valStr + ')</div></div><button class="btn-main" style="background:var(--Highlight); margin-top:20px;" onclick="selectRelic(\'' + picked.relic_id + '\', \'' + picked.name + '\')">가방에 보관하기</button>';
    }, 1500);
}

function selectRelic(relicId, relicName) {
    showUiConfirm("🏺 유물 획득", "[<b style=\"color:var(--Highlight);\">" + relicName + "</b>] 유물을 획득하시겠습니까?", "processSelectRelic('" + relicId + "', '" + relicName + "')");
}

function processSelectRelic(relicId, relicName) {
    // 💡 [오류 수정] 모든 ! 제거 정규식 적용
    const rawRelics = String(currentStudent.unlocked_relics || "").replace(/!/g, '');
    let myRelics = rawRelics ? rawRelics.split(',').map(x => x.trim()).filter(Boolean) : [];
    if (!myRelics.includes(String(relicId))) myRelics.push(relicId);
    currentStudent.unlocked_relics = "!" + myRelics.join(',');

    updateFastFirebaseStudent(currentStudent);
    showUiAlert("🎉 발굴 완료!", "[<b style=\"color:var(--Highlight);\">" + relicName + "</b>] 유물을 얻었습니다!", "renderDashboard()");
}

// --- [복구] 스킬 리롤 처리 함수 ---
function doReroll() {
    canReroll = false;
    drawSkills(true); // 비용 확인 없이 바로 섞어서 다시 보여줍니다.
}

// ==========================================
// 📖 수집 도감 시스템
// ==========================================
// 💡 에러 원인 완벽 해결: 구글 앱스 스크립트 파싱 버그를 피하기 위해 복잡한 HTML 문자열 결합 방식 전면 수정
// 💡 1. 도감 아이디만 넘겨서 상세 팝업을 띄우는 함수 (스킬 수치, 계수 등 완벽 표시)
function showEncyclopediaDetail(type, id, isBoss = false) {
    if (type === 'skill') {
        const sk = skillsData.find(s => String(s.skill_id) === String(id));
        if (sk) {
            const safeDesc = String(sk.description || '').replace(/[\n\r]/g, ' ');

            // 아이콘 세팅 (없으면 이모지)
            const skBlessing = sk.blessing && String(sk.blessing).trim() !== '' && String(sk.blessing).trim() !== 'None' ? String(sk.blessing).trim() : 'Highlight';
            const bColor = 'var(--' + skBlessing + ')';
            let iconDisplay = sk.icon_url
                ? '<img src="' + sk.icon_url + '" style="width:60px; height:60px; object-fit:contain; border-radius:10px; border:2px solid ' + bColor + '; box-shadow: 0 0 10px ' + bColor + '; margin-bottom:5px; background:#111; image-rendering:pixelated;">'
                : '<div style="font-size:50px; margin-bottom:5px;">🔮</div>';

            // 상세 스탯을 예쁜 박스 안에 조립
            let detailHtml =
                iconDisplay +
                '<div style="font-size:1.3em; font-weight:bold; color:var(--Highlight); margin-bottom:15px;">' + sk.name + '</div>' +
                '<div style="background:#111; padding:15px; border-radius:10px; border:1px solid #444; text-align:left; font-size:0.95em; line-height:1.6; color:#ddd;">' +
                '  <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444;">' + safeDesc + '</div>' +
                '  <div><span style="color:#4d94ff;">▪ 대상:</span> ' + (sk.target_type || '-') + ' &nbsp;|&nbsp; <span style="color:#4d94ff;">▪ 타입:</span> ' + (sk.effect_type || '-') + '</div>' +
                '  <div style="margin-top:5px;"><span style="color:#4dff88;">▪ 기본위력:</span> ' + (sk.base_value || 0) + ' &nbsp;|&nbsp; <span style="color:#4dff88;">▪ 계수:</span> ' + (sk.scaling_stat || '-') + ' x' + (sk.multiplier ?? sk.muliplier ?? 1.0) + '</div>' +
                '  <div style="margin-top:5px;"><span style="color:#ffd700;">▪ 특수효과:</span> ' + (sk.special_effect || '없음') + ' (' + (sk.duration || 0) + '턴)</div>' +
                '  <div style="color:#ff4d4d; font-weight:bold; margin-top:10px; text-align:center; background:rgba(255,77,77,0.1); padding:5px; border-radius:5px;">⏳ 쿨타임: ' + (sk.cooldown || 0) + '턴</div>' +
                '</div>';

            showUiAlert('📖 스킬 상세 정보', detailHtml, '');
        }
    } else if (type === 'monster') {
        // 💡 [신규] 몬스터/보스 상세 정보 및 처치 횟수 렌더링
        const m = isBoss ? bossList.find(x => String(x.boss_id) === String(id)) : monsterList.find(x => String(x.monster_id) === String(id));
        if (m) {
            // 💡 [오류 수정] 모든 ! 제거 정규식 적용
            const rawMonsters = String(currentStudent.monster_data || "").replace(/!/g, '');
            const unlockedIds = rawMonsters ? rawMonsters.split(',').map(x => x.trim()).filter(Boolean) : [];
            const killCount = unlockedIds.filter(x => x === String(id)).length;

            const stars = (isBoss ? '💀' : '★').repeat(Number(m.difficulty) || 1);
            const mSkillId = m.skill_list || m.skill_id || m.skill;
            let skillText = '<span style="color:#aaa;">보유 스킬 없음</span>';

            // 몬스터가 사용하는 스킬 정보 로드
            if (mSkillId) {
                const msData = monsterSkillsData.find(x => String(x.skill_id) === String(mSkillId).trim());
                if (msData) {
                    skillText = '<span style="color:var(--Highlight); font-weight:bold;">[' + msData.name + ']</span><br><span style="font-size:0.9em; color:#ddd;">' + msData.description + '</span>';
                } else {
                    skillText = '<span style="color:var(--Highlight); font-weight:bold;">[' + mSkillId + ']</span>';
                }
            }

            let iconDisplay = m.icon_url
                ? '<img src="' + m.icon_url + '" class="pixelated-monster" style="width:80px; height:80px; object-fit:contain; margin-bottom:10px; filter: drop-shadow(0 0 5px rgba(255,0,0,0.3));">'
                : '<div style="font-size:60px; margin-bottom:10px;">👹</div>';

            let detailHtml =
                '<div style="text-align:center;">' +
                iconDisplay +
                '<div style="font-size:1.1em; color:var(--Yellow); letter-spacing:2px; margin-bottom:5px;">' + stars + '</div>' +
                '<div style="font-size:1.4em; font-weight:bold; color:' + (isBoss ? 'var(--Red)' : 'var(--Highlight)') + '; margin-bottom:5px;">' + m.name + '</div>' +
                '<div style="font-size:0.9em; color:var(--TextGold); font-weight:bold; margin-bottom:15px; background:rgba(217, 119, 6, 0.1); display:inline-block; padding:3px 10px; border-radius:10px; border:1px solid rgba(217, 119, 6, 0.3);">⚔️ 총 ' + killCount + '회 처치</div>' +
                '</div>' +
                '<div style="background:#111; padding:15px; border-radius:10px; border:1px solid #444; text-align:left; font-size:0.95em; line-height:1.6; color:#ddd;">' +
                '  <div style="display:flex; justify-content:space-around; margin-bottom:10px; border-bottom:1px dashed #444; padding-bottom:10px;">' +
                '    <span>❤️ HP: <b style="color:var(--Green);">' + (m.hp || 0) + '</b></span>' +
                '    <span>⚔️ ATK: <b style="color:var(--Red);">' + (m.atk || 0) + '</b></span>' +
                '    <span>🛡️ DEF: <b style="color:var(--Purple);">' + (m.def || 0) + '</b></span>' +
                '  </div>' +
                '  <div><b style="color:#FBBF24;">🔮 사용 스킬:</b><br>' + skillText + '</div>' +
                (isBoss && m.gimmick_type && m.gimmick_type !== '없음' ? '<div style="margin-top:10px; padding-top:10px; border-top:1px dashed #444;"><b style="color:var(--Red);">🚨 보스 기믹:</b><br><span style="color:#ddd;">[' + m.gimmick_type + '] 수치: ' + (m.gimmick_value || 0) + '</span></div>' : '') +
                '</div>';

            showUiAlert('📖 몬스터 상세 정보', detailHtml, '');
        }
    } else {
        const re = relicsData.find(r => String(r.relic_id) === String(id));
        if (re) {
            const safeDesc = String(re.description || '').replace(/[\n\r]/g, '<br>');
            const effName = relicEffectTranslator[re.effect_type] || re.effect_type;

            let valStr = (re.effect_type.includes('mult') || re.effect_type.includes('up') && !re.effect_type.match(/^(hp|atk|def|luk|gold)_up$/)) ? (re.value * 100) + '%' : re.value;
            if (re.effect_type === 'gold_up') valStr += (sysConfig.currency_name || '골드');

            // 아이콘 세팅 (없으면 이모지) - 스킬과 동일하게 Highlight 적용
            let iconDisplay = re.icon_url
                ? '<img src="' + re.icon_url + '" style="width:60px; height:60px; object-fit:contain; image-rendering:pixelated; border-radius:10px; border:2px solid var(--Highlight); margin-bottom:5px; background:#111;">'
                : '<div style="font-size:50px; margin-bottom:5px;">🏺</div>';

            // 유물 상세 효과를 예쁜 박스 안에 조립 - 스킬과 동일한 Highlight 계열 적용
            let detailHtml =
                iconDisplay +
                '<div style="font-size:1.3em; font-weight:bold; color:var(--Highlight); margin-bottom:15px;">' + re.name + '</div>' +
                '<div style="background:#111; padding:15px; border-radius:10px; border:1px solid #444; text-align:left; font-size:0.95em; line-height:1.6; color:#ddd;">' +
                '  <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed #444;">' + safeDesc + '</div>' +
                '  <div style="color:var(--Highlight); font-weight:bold; font-size:1.1em; text-align:center; margin-top:10px; background:rgba(37, 99, 235, 0.1); padding:8px; border-radius:5px;">✨ ' + effName + ' +' + valStr + '</div>' +
                '</div>';

            showUiAlert('📖 유물 상세 정보', detailHtml, '');
        }
    }
}

function openEncyclopedia(tabType) {
    const body = document.getElementById('modalBody');

    let tabsHtml =
        '<div style="display:flex; margin-bottom:15px;">' +
        '  <div class="equip-tab ' + (tabType === 'skill' ? 'active' : '') + '" onclick="openEncyclopedia(\'skill\')">🔮 스킬 도감</div>' +
        '  <div class="equip-tab ' + (tabType === 'relic' ? 'active' : '') + '" onclick="openEncyclopedia(\'relic\')">🏺 유물 도감</div>' +
        '  <div class="equip-tab ' + (tabType === 'monster' ? 'active' : '') + '" onclick="openEncyclopedia(\'monster\')">👹 몬스터 도감</div>' +
        '</div>';

    let contentHtml = '';
    let totalCount = 0;
    let myCount = 0;

    if (tabType === 'skill') {
        const raw = String(currentStudent.unlocked_skills || "").replace(/!/g, '');
        const unlockedIds = raw ? raw.split(',').map(x => x.trim()).filter(Boolean) : [];
        const validSkills = skillsData.filter(s => s.skill_id);
        totalCount = validSkills.length;
        myCount = unlockedIds.length;

        let gridItems = validSkills.map(sk => {
            const isOwned = unlockedIds.includes(String(sk.skill_id));
            const iconSrc = sk.icon_url || '';
            const filterStyle = isOwned ? '' : 'filter: grayscale(100%) opacity(0.4);';
            const iconTag = iconSrc ? '<img src="' + iconSrc + '" class="encyc-icon" style="' + filterStyle + '">' : '<div style="font-size:30px; margin-bottom:5px; ' + filterStyle + '">🔮</div>';
            const nameDisp = isOwned ? '<div class="encyc-name" style="color:#4d94ff;">' + sk.name + '</div>' : '<div class="encyc-name" style="color:#666;">???</div>';

            if (isOwned) {
                return '<div class="encyc-item" style="cursor:pointer; border-color:#4d94ff;" onclick="showEncyclopediaDetail(\'skill\', \'' + sk.skill_id + '\')">' + iconTag + nameDisp + '</div>';
            } else {
                return '<div class="encyc-item">' + iconTag + nameDisp + '</div>';
            }
        }).join('');

        contentHtml = '<div class="encyc-grid">' + gridItems + '</div>';

    } else if (tabType === 'monster') {
        // 💡 [신규] 몬스터 도감 탭 구축 (처치한 몬스터만 활성화 및 횟수 기록)
        const raw = String(currentStudent.monster_data || "").replace(/!/g, '');
        const unlockedIds = raw ? raw.split(',').map(x => x.trim()).filter(Boolean) : [];

        const validMonsters = monsterList.filter(m => m.monster_id);
        const validBosses = bossList.filter(b => b.boss_id);
        const combinedMonsters = [...validMonsters, ...validBosses];

        totalCount = combinedMonsters.length;

        let uniqueKilled = 0; // 고유 몬스터 종류 수 카운트용

        let gridItems = combinedMonsters.map(m => {
            const isBoss = !!m.boss_id;
            const mId = m.monster_id || m.boss_id;
            const killCount = unlockedIds.filter(id => id === String(mId)).length; // 처치 횟수 계산
            const isOwned = killCount > 0; // 한 번이라도 처치했는지 여부

            if (isOwned) uniqueKilled++; // 도감 달성률을 위해 종류별로만 1 카운트

            const iconSrc = m.icon_url || '';

            const filterStyle = isOwned ? 'image-rendering:pixelated;' : 'image-rendering:pixelated; filter: grayscale(100%) opacity(0.4);';
            const iconTag = iconSrc ? '<img src="' + iconSrc + '" class="encyc-icon" style="' + filterStyle + '">' : '<div style="font-size:30px; margin-bottom:5px; ' + filterStyle + '">👹</div>';

            const killBadge = isOwned ? '<div style="font-size:0.8em; color:var(--TextGold); margin-top:3px; font-weight:bold;">⚔️ ' + killCount + '회</div>' : '';
            const nameDisp = isOwned ? '<div class="encyc-name" style="color:' + (isBoss ? 'var(--Red)' : 'var(--Highlight)') + ';">' + (isBoss ? '[보스]<br>' : '') + m.name + killBadge + '</div>' : '<div class="encyc-name" style="color:var(--TextLock);">???</div>';

            if (isOwned) {
                return '<div class="encyc-item" style="cursor:pointer; border-color:' + (isBoss ? 'var(--Red)' : 'var(--Highlight)') + ';" onclick="showEncyclopediaDetail(\'monster\', \'' + mId + '\', ' + isBoss + ')">' + iconTag + nameDisp + '</div>';
            } else {
                return '<div class="encyc-item">' + iconTag + nameDisp + '</div>';
            }
        }).join('');

        myCount = uniqueKilled; // 달성률에 고유 카운트 적용
        contentHtml = '<div class="encyc-grid">' + gridItems + '</div>';
    } else {
        const raw = String(currentStudent.unlocked_relics || "").replace(/!/g, '');
        const unlockedIds = raw ? raw.split(',').map(x => x.trim()).filter(Boolean) : [];
        const validRelics = relicsData.filter(r => r.relic_id);
        totalCount = validRelics.length;
        myCount = unlockedIds.length;

        let gridItems = validRelics.map(re => {
            const isOwned = unlockedIds.includes(String(re.relic_id));
            const iconSrc = re.icon_url || '';
            const filterStyle = isOwned ? 'image-rendering:pixelated;' : 'image-rendering:pixelated; filter: grayscale(100%) opacity(0.4);';
            const iconTag = iconSrc ? '<img src="' + iconSrc + '" class="encyc-icon" style="' + filterStyle + '">' : '<div style="font-size:30px; margin-bottom:5px; ' + filterStyle + '">🏺</div>';
            const nameDisp = isOwned ? '<div class="encyc-name" style="color:var(--Highlight);">' + re.name + '</div>' : '<div class="encyc-name" style="color:var(--TextLock);">???</div>';

            if (isOwned) {
                return '<div class="encyc-item" style="cursor:pointer; border-color:var(--Highlight);" onclick="showEncyclopediaDetail(\'relic\', \'' + re.relic_id + '\')">' + iconTag + nameDisp + '</div>';
            } else {
                return '<div class="encyc-item">' + iconTag + nameDisp + '</div>';
            }
        }).join('');

        contentHtml = '<div class="encyc-grid">' + gridItems + '</div>';
    }

    const progress = totalCount === 0 ? 0 : Math.floor((myCount / totalCount) * 100);

    body.innerHTML =
        '<h2>📖 수집 도감</h2>' +
        tabsHtml +
        '<div style="background:#222; padding:15px; border-radius:10px; margin-bottom:15px; border:1px solid #444; text-align:left;">' +
        '  <div style="display:flex; justify-content:space-between; margin-bottom:8px;">' +
        '    <span style="font-weight:bold; color:#ccc;">수집 달성률</span>' +
        '    <span style="color:var(--Highlight); font-weight:bold; font-size:1.1em;">' + myCount + ' / ' + totalCount + ' (<span style="color:white;">' + progress + '%</span>)</span>' +
        '  </div>' +
        '  <div style="width:100%; background:#111; height:12px; border-radius:6px; overflow:hidden;">' +
        '    <div style="width:' + progress + '%; background:var(--Highlight); height:100%; transition: width 0.5s ease-in-out;"></div>' +
        '  </div>' +
        '</div>' +
        // 💡 [핵심 수정] overflow-y를 scroll로 고정시켜 스크롤바가 생겼다 없어졌다 하는 현상 방지!
        // 💡 가로 스크롤 방지(overflow-x:hidden) 및 카드가 커질 공간 확보(padding:5px)
        '<div style="max-height:350px; overflow-y:scroll; overflow-x:hidden; padding:5px; margin-bottom:15px;">' +
        contentHtml +
        '</div>' +
        '<button class="btn-main" style="background:#444;" onclick="renderDashboard()">돌아가기</button>';
}

// ==========================================
// 🎒 인벤토리 (가방) 시스템
// ==========================================
function openInventory() {
    window.currentDashTab = 'bag';
    renderDashboard();
}

function promptUseItem(itemName) {
    // 💡 1. 전리품 상자 개봉 로직 연결
    const boxData = lootBoxesData.find(b => b.box_name === itemName);
    if (boxData) {
        showUiConfirm(
            "📦 전리품 상자 개봉",
            "[<b style='color:var(--TextGold);'>" + itemName + "</b>]을(를) 여시겠습니까?<br><span style='font-size:0.85em; color:var(--TextSub);'>행운(LUK) 스탯이 높을수록 최고급 보상이 뜹니다!</span>",
            "openLootBox('" + itemName + "', '" + boxData.box_id + "')"
        );
        return;
    }

    // 💡 2. 보스 도전권 안내
    if (itemName.includes('보스 도전권')) {
        showUiAlert('⚠️ 안내', '보스 도전권은 혼자서 도전하는 <b style="color:var(--Red);">1대1 보스전</b> 입장 시 사용됩니다.<br><br><span style="font-size:0.85em; color:var(--TextSub);">(가방에서는 직접 사용할 수 없으며, 메인 화면의 보스 도전을 이용하세요.)</span>', '');
        return;
    }

    // 💡 3. 현재 가방 내 동일 아이템 보유 개수 파악
    const rawInv = String(currentStudent.inventory || "");
    const items = rawInv ? rawInv.split(',').map(x => x.trim()).filter(Boolean) : [];
    const count = items.filter(x => x === itemName).length;

    // 💡 단일 수량일 때
    if (count <= 1) {
        showUiConfirm(
            "🎟️ 아이템 사용",
            "[<b style='color:var(--Highlight);'>" + itemName + "</b>]을(를) 사용하시겠습니까?<br><br><span style='font-size:0.85em; color:var(--Red);'>(선생님께 확인을 받고 나서 [확인]을 눌러주세요!)</span>",
            "processUseItem('" + itemName + "', 1)"
        );
        return;
    }

    // 💡 4. 복수 수량일 때: 수량 선택(묶음 사용) 팝업 제공
    document.getElementById('uiPopupTitle').innerHTML = '🎟️ 아이템 묶음 사용';
    document.getElementById('uiPopupMessage').innerHTML =
        '<b style="color:var(--Highlight); font-size:1.15em;">[' + itemName + ']</b><br>' +
        '<span style="color:var(--TextSub); font-size:0.9em;">(보유 수량: <b>' + count + '개</b>)</span><br><br>' +
        '<div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:10px;">' +
        '  <button class="small-btn" style="width:36px; height:36px; font-size:1.2em; background:var(--BtnShop);" onclick="let el=document.getElementById(\'batchUseInput\'); el.value=Math.max(1, Number(el.value)-1);">-</button>' +
        '  <input type="number" id="batchUseInput" class="num-input" value="' + count + '" min="1" max="' + count + '" style="width:80px; text-align:center; font-size:1.3em;">' +
        '  <button class="small-btn" style="width:36px; height:36px; font-size:1.2em; background:var(--BtnShop);" onclick="let el=document.getElementById(\'batchUseInput\'); el.value=Math.min(' + count + ', Number(el.value)+1);">+</button>' +
        '</div>' +
        '<button class="small-btn" style="background:#475569; padding:4px 10px; font-size:0.8em; margin-bottom:10px;" onclick="document.getElementById(\'batchUseInput\').value=' + count + ';">최대 수량(' + count + '개) 선택</button><br>' +
        '<span style="font-size:0.85em; color:var(--Red);">(선생님께 보여드리기 직전에 눌러주세요!)</span>';

    const confirmCode = "let qty = Math.min(" + count + ", Math.max(1, Number(document.getElementById('batchUseInput').value) || 1)); processUseItem('" + itemName + "', qty);";

    document.getElementById('uiPopupButtons').innerHTML =
        '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeUiPopup()">취소</button>' +
        '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--Highlight); color:white; font-weight:bold; font-size:1.1em; cursor:pointer;" onclick="closeUiPopup(); ' + confirmCode + '">사용하기</button>';

    document.getElementById('uiPopup').style.display = 'flex';
}

// 💡 [신규] 전리품 상자 개봉 애니메이션 및 결과 출력
function openLootBox(itemName, boxId) {
    // 1. 가방에서 상자 1개 임시 차감 (화면 즉시 반영)
    const rawInv = String(currentStudent.inventory || "");
    let items = rawInv ? rawInv.split(',').map(x => x.trim()).filter(Boolean) : [];
    const index = items.indexOf(itemName);
    if (index > -1) items.splice(index, 1);
    currentStudent.inventory = items.join(',');

    // 화면을 개봉 애니메이션으로 전환
    const body = document.getElementById('modalBody');

    let itemIcon = '⚱️';
    let glowStyle = '';
    if (itemName.includes('나무') || itemName.includes('C급')) glowStyle = 'filter: drop-shadow(0 0 10px #9CA3AF);';
    else if (itemName.includes('철') || itemName.includes('B급')) glowStyle = 'filter: drop-shadow(0 0 15px #3B82F6);';
    else if (itemName.includes('은') || itemName.includes('A급')) glowStyle = 'filter: drop-shadow(0 0 25px #8B5CF6);';
    else if (itemName.includes('금') || itemName.includes('S급')) glowStyle = 'filter: drop-shadow(0 0 35px #F59E0B);';
    else if (itemName.includes('전설') || itemName.includes('SS급')) glowStyle = 'filter: drop-shadow(0 0 50px #EF4444);';

    body.innerHTML = '<h2 style="color:var(--TextGold);">상자 개봉 중...</h2><div style="font-size:100px; margin:40px 0; ' + glowStyle + '" class="anim-pot">' + itemIcon + '</div><p style="color:var(--TextSub);">두근두근...</p>';

    // 💡 [화면 차단] 상자 개봉 연산 중 클릭 차단
    showGlobalLoading("📦 전리품 상자 개봉 중...");

    const box = lootBoxesData.find(b => b.box_id === boxId);
    const minM = Number(box ? box.min_money : 0) || 0;
    const maxM = Number(box ? box.max_money : 0) || 0;
    const earnedGold = Math.floor(minM + Math.random() * (maxM - minM + 1));

    let earnedItems = [];
    if (box) {
        if (Math.random() * 100 <= (Number(box.prob_1) || 0) && box.item_1) earnedItems.push(box.item_1);
        if (Math.random() * 100 <= (Number(box.prob_2) || 0) && box.item_2) earnedItems.push(box.item_2);
        if (Math.random() * 100 <= (Number(box.prob_3) || 0) && box.item_3) earnedItems.push(box.item_3);
        if (earnedItems.length === 0 && box.item_1) earnedItems.push(box.item_1);
    }

    currentStudent.game_money = (Number(currentStudent.game_money) || 0) + earnedGold;
    if (earnedItems.length > 0) {
        let curItems = currentStudent.inventory ? String(currentStudent.inventory).split(',') : [];
        curItems.push(...earnedItems);
        currentStudent.inventory = curItems.join(',');
    }

    updateFastFirebaseStudent(currentStudent);

    // 📝 [Firebase 상자 개봉 로그 전송]
    pushFirebaseLog('common', {
        time: new Date().toISOString(),
        name: currentStudent.name,
        category: "상자 개봉",
        content: itemName + " -> " + earnedGold + "골드 / " + (earnedItems.join(',') || '아이템 없음')
    });

    setTimeout(() => {
        hideGlobalLoading();
        let formattedItems = earnedItems.map(item => '<span style="color:var(--Highlight); background:rgba(59, 130, 246, 0.1); padding:5px 12px; border-radius:8px; display:inline-block; margin:4px 3px; font-weight:bold; border:1px solid rgba(59, 130, 246, 0.3); box-shadow:0 2px 4px rgba(0,0,0,0.05);">' + item + '</span>').join('');
        let itemsHtml = earnedItems.length > 0 ? '<div style="margin-top:15px; padding-top:15px; border-top:1px dashed var(--BorderColor);"><div style="font-weight:bold; color:var(--TextMain); font-size:1em; margin-bottom:8px;">✨ 획득 전리품</div><div>' + formattedItems + '</div></div>' : '';
        let currencyUnit = sysConfig.game_money_currency || '골드';

        body.innerHTML = '<h2 style="color:var(--TextGold);">🎉 개봉 결과!</h2>' +
            '<div style="background:var(--BgDashboard); padding:25px; border-radius:15px; border:2px solid var(--TextGold); margin:20px 0; font-size:1.1em; line-height:1.5; color:var(--TextMain); box-shadow: 0 6px 15px rgba(217, 119, 6, 0.15);">' +
            '  <div style="font-weight:bold; font-size:1.1em;">💰 재화: <b style="color:var(--TextGold); font-size:1.2em;">' + earnedGold + '</b> <span style="font-size:0.9em; color:var(--TextSub);">' + currencyUnit + '</span></div>' +
            '  ' + itemsHtml +
            '</div>' +
            '<button class="btn-main" onclick="openInventory()">가방으로 돌아가기</button>';
    }, 1000);
}

function processUseItem(itemName, count = 1) {
    const useCount = Math.max(1, Number(count) || 1);
    const rawInv = String(currentStudent.inventory || "");
    let items = rawInv ? rawInv.split(',').map(x => x.trim()).filter(Boolean) : [];

    // 💡 지정한 수량(useCount)만큼 인벤토리에서 순차 제거
    let removedCount = 0;
    for (let i = 0; i < useCount; i++) {
        const index = items.indexOf(itemName);
        if (index > -1) {
            items.splice(index, 1);
            removedCount++;
        }
    }
    currentStudent.inventory = items.join(',');

    // 📝 [Firebase 아이템 사용 로그 전송]
    pushFirebaseLog('common', {
        time: new Date().toISOString(),
        name: currentStudent.name,
        category: "아이템 사용",
        content: itemName + (removedCount > 1 ? " x" + removedCount : "")
    });

    // 🧪 [신규] 망각의 물약 사용 처리 (스탯 초기화, 포인트 전액 환급, 가호 재선택 - 기존 레벨/재화 보존)
    if (itemName.includes('망각의 물약') || itemName.includes('망각')) {
        currentStudent.hp_points = 5;
        currentStudent.atk_points = 5;
        currentStudent.def_points = 5;
        currentStudent.luk_points = 5;
        currentStudent.blessing = "TEMP"; // 💡 'TEMP'로 지정하여 saveBlessing에서 레벨/재화 리셋 방어

        updateFastFirebaseStudent(currentStudent);
        showUiAlert(
            "🧪 망각의 물약 사용 완료!",
            "정신이 맑아지며 영혼이 초기 상태로 정화되었습니다.<br><br>" +
            "▪ <b>투자한 모든 스탯 포인트가 반환되었습니다.</b><br>" +
            "▪ <b>새로운 가호(속성)를 다시 선택할 수 있습니다.</b>",
            "closeModal(); openStudentDetail();"
        );
        return;
    }

    if (itemName === '보스 도전기회 추가 티켓') {
        currentStudent.weekly_boss = (Number(currentStudent.weekly_boss) || 0) + removedCount;
        updateFastFirebaseStudent(currentStudent);
        showUiAlert("🎫 사용 완료!", "[보스 도전기회 추가 티켓] <b>" + removedCount + "장</b>을 사용했습니다.<br><br><span style='color:var(--Red); font-weight:bold;'>보스 도전 기회가 " + removedCount + "회 회복되었습니다.</span>", "openInventory()");
        return;
    }

    if (itemName.includes('유물 슬롯 확장권') || itemName.includes('유물 슬롯 해금권')) {
        currentStudent.relic_slot_2_unlocked = "TRUE";
        updateFastFirebaseStudent(currentStudent);
        showUiAlert("🔓 슬롯 해금 완료!", "[유물 슬롯 확장권]을 사용하여 <b>두 번째 유물 슬롯</b>이 해금되었습니다!<br><span style='color:var(--Highlight); font-weight:bold;'>이제 유물을 2개까지 장착할 수 있습니다.</span>", "renderDashboard()");
    } else if (itemName.includes('동료 슬롯 확장권') || itemName.includes('동료 슬롯 해금권')) {
        currentStudent.merc_slot2_unlocked = "TRUE";
        updateFastFirebaseStudent(currentStudent);
        showUiAlert("🔓 슬롯 해금 완료!", "[동료 슬롯 확장권]을 사용하여 <b>두 번째 동료 슬롯</b>이 해금되었습니다!<br><span style='color:var(--Highlight); font-weight:bold;'>파티 관리 메뉴에서 2번째 동료를 배치할 수 있습니다.</span>", "renderDashboard()");
    } else if (itemName.includes('치료제') || itemName.includes('회복약') || itemName.includes('부상')) {
        currentStudent.last_defeat = 0;
        currentStudent.penalty_end_time = 0;
        if (window.allStudentsData) {
            let target = window.allStudentsData.find(x => x.name === currentStudent.name);
            if (target) {
                target.last_defeat = 0;
                target.penalty_end_time = 0;
            }
        }
        updateFastFirebaseStudent(currentStudent);
        showUiAlert("🩹 치료 완료!", "[" + itemName + "]을(를) 사용하여 부상을 완치했습니다!<br><span style='color:var(--Green); font-weight:bold;'>이제 다시 사냥터에 입장할 수 있습니다.</span>", "renderDashboard()");
    } else {
        // 💡 [신규] 현실 재화(티) 교환권일 경우 총 합산 티(Ticket) 계산 출력
        const rmMatch = itemName.match(/\[현실 재화\]\s*(\d+)(.*?)\s*교환권/);
        let totalNotice = "";
        if (rmMatch) {
            const singleVal = Number(rmMatch[1]) || 0;
            const currencyUnit = rmMatch[2] || sysConfig.currency_name || '티';
            const totalVal = singleVal * removedCount;
            totalNotice = "<br><br><span style='font-size:1.25em; color:var(--TextGold); font-weight:bold;'>총 지급액: " + totalVal + currencyUnit + "</span>";
        }

        updateFastFirebaseStudent(currentStudent);
        showUiAlert(
            "🎉 사용 완료!",
            "<b>[" + itemName + "] " + removedCount + "개</b>를 사용했습니다!" + totalNotice + "<br><br><span style='font-size:0.95em; color:var(--Highlight); font-weight:bold;'>선생님께 이 화면을 보여드리고 보상을 받으세요.</span>",
            "openInventory()"
        );
    }
}

// ==========================================
// 🏰 동료(용병) 뽑기 시스템 (용병 길드)
// ==========================================
function openMercenaryShop() {
    if (!checkFeatureLock('merc_shop', '동료(용병) 뽑기', 3)) return;
    const body = document.getElementById('modalBody');
    const cost = Number(sysConfig.merc_price) || 100;
    const gameCurrency = sysConfig.game_money_currency || '골드';

    // system 시트 설정 수치 동적 로드 (기본값 설정 포함)
    const probC = sysConfig.merc_prob_c !== undefined ? Number(sysConfig.merc_prob_c) : 50;
    const probB = sysConfig.merc_prob_b !== undefined ? Number(sysConfig.merc_prob_b) : 35;
    const probA = sysConfig.merc_prob_a !== undefined ? Number(sysConfig.merc_prob_a) : 12;
    const probS = sysConfig.merc_prob_s !== undefined ? Number(sysConfig.merc_prob_s) : 3;

    body.innerHTML =
        '<h2 style="color:var(--Highlight);">🏰 용병 길드</h2>' +
        '<div style="font-size:80px; margin:20px 0;" class="anim-pot">🛡️</div>' +
        '<p style="color:var(--TextSub);">용병 길드에서 함께 모험을 떠날 미지의 동료를 영입하세요!</p>' +
        '<div style="font-size:0.85em; color:var(--TextLock); margin-bottom:20px;">(확률: C급 ' + probC + '% / B급 ' + probB + '% / A급 ' + probA + '% / S급 ' + probS + '%)<br>※ 이미 올클리어한 등급은 상위 등급으로 자동 승급됩니다!</div>' +
        '<button class="btn-main" style="background:var(--Highlight);" onclick="promptDrawMercenary()">동료 영입하기 (' + cost + ' ' + gameCurrency + ')</button>' +
        '<button class="btn-main" style="background:var(--TextSub);" onclick="renderDashboard()">돌아가기</button>';
}

function promptDrawMercenary() {
    const cost = Number(sysConfig.merc_price) || 100;
    const gameCurrency = sysConfig.game_money_currency || '골드';
    const currentMoney = Number(currentStudent.game_money) || 0;

    if (currentMoney < cost) {
        showUiAlert("⚠️ 자금 부족", "소지한 재화가 부족합니다.<br><span style='font-size:0.9em; color:#aaa;'>(필요: " + cost + " " + gameCurrency + " / 보유: " + currentMoney + " " + gameCurrency + ")</span>", "");
        return;
    }

    processDrawMercenary();
}

function processDrawMercenary() {
    const body = document.getElementById('modalBody');
    body.innerHTML = '<h2 style="color:var(--Highlight);">🏰 용병 계약 작성 중...</h2><div style="margin:50px 0;"><span class="anim-pot">📜</span></div><p style="color:var(--TextSub);">미지의 용병이 계약서에 서명하고 있습니다!</p>';

    showGlobalLoading("📜 용병 계약서 작성 중...");

    const cost = Number(sysConfig.merc_price) || 100;
    const currentMoney = Number(currentStudent.game_money) || 0;

    if (currentMoney < cost) {
        hideGlobalLoading();
        showUiAlert("⚠️ 자금 부족", "골드가 부족합니다.", "renderDashboard()");
        return;
    }

    const rawUnlocked = String(currentStudent.unlocked_mercenaries || "").replace(/!/g, '');
    let unlockedIds = rawUnlocked ? rawUnlocked.split(',').map(x => x.trim()).filter(Boolean) : [];

    let unowned = (mercenariesData || []).filter(m => m.merc_id && !unlockedIds.includes(String(m.merc_id)));
    if (unowned.length === 0) {
        hideGlobalLoading();
        showUiAlert("🏆 도감 올클리어", "이미 모든 동료를 영입하셨습니다!", "renderDashboard()");
        return;
    }

    const pickedMerc = unowned[Math.floor(Math.random() * unowned.length)];
    unlockedIds.push(String(pickedMerc.merc_id));

    currentStudent.game_money = currentMoney - cost;
    currentStudent.unlocked_mercenaries = "!" + unlockedIds.join(',');

    updateFastFirebaseStudent(currentStudent);

    const tier = String(pickedMerc.tier || 'C').toUpperCase();
    let tierColor = 'var(--Green)';
    let tierBg = 'rgba(16, 185, 129, 0.1)';
    let tierGlow = '0 0 15px rgba(16, 185, 129, 0.4)';

    if (tier === 'B') {
        tierColor = 'var(--Blue)';
        tierBg = 'rgba(59, 130, 246, 0.1)';
        tierGlow = '0 0 20px rgba(59, 130, 246, 0.5)';
    } else if (tier === 'A') {
        tierColor = 'var(--Purple)';
        tierBg = 'rgba(139, 92, 246, 0.15)';
        tierGlow = '0 0 25px rgba(139, 92, 246, 0.6)';
    } else if (tier === 'S') {
        tierColor = 'var(--Yellow)';
        tierBg = 'rgba(245, 158, 11, 0.2)';
        tierGlow = '0 0 35px rgba(245, 158, 11, 0.8)';
    }

    const jobMap = { 'WARRIOR': '⚔️ 전사', 'ARCHER': '🏹 궁수', 'MAGE': '🔮 마법사', 'ROGUE': '🗡️ 도적' };
    const jobName = jobMap[String(pickedMerc.job).toUpperCase()] || pickedMerc.job || '용병';

    const iconHtml = pickedMerc.icon_url
        ? '<img src="' + pickedMerc.icon_url + '" style="width:110px; height:110px; object-fit:contain; border-radius:50%; border:3px solid ' + tierColor + '; box-shadow:' + tierGlow + '; margin-bottom:15px; background:#FFFFFF; padding:4px;">'
        : '<div style="font-size:70px; margin-bottom:15px;">🛡️</div>';

    const optTypeMap = {
        'HP_UP': '체력 증가', 'DEF_UP': '방어력 증가', 'ATK_UP': '공격력 증가',
        'LUK_UP': '행운 증가', 'CRIT_UP': '치명타율 증가', 'CRIT_DMG_UP': '치명피해 증가',
        'DAMAGE_REDUCE': '피해 감소', 'DEF_PEN': '방어 관통', 'DMG_UP': '피해 증가',
        'SKILL_DMG': '스킬 피해 증가', 'HEAL_UP': '회복량 증가', 'EVD_UP': '회피율 증가'
    };
    const optName = optTypeMap[String(pickedMerc.option_type).toUpperCase()] || pickedMerc.option_type;
    const isPct = String(pickedMerc.option_calc_type).toUpperCase() === 'PERCENT';
    const optValStr = isPct ? Math.round(Number(pickedMerc.option_value) * 100) + '%' : pickedMerc.option_value;

    setTimeout(() => {
        hideGlobalLoading();
        body.innerHTML =
            '<h2 style="color:' + tierColor + ';">🎉 신규 동료 영입!</h2>' +
            '<div style="background:' + tierBg + '; border: 2px solid ' + tierColor + '; border-radius:25px; padding:25px; margin:20px 0; box-shadow:' + tierGlow + ';">' +
            '  ' + iconHtml +
            '  <div style="font-size:0.9em; color:' + tierColor + '; font-weight:bold; margin-bottom:5px;">[' + tier + '등급] ' + jobName + '</div>' +
            '  <h3 style="color:var(--TextMain); margin:0 0 10px 0; font-size:1.5em;">' + pickedMerc.name + '</h3>' +
            '  <div style="font-size:0.95em; color:var(--TextSub); font-weight:bold; background:rgba(255,255,255,0.7); padding:8px; border-radius:8px; display:inline-block; border:1px solid var(--BorderColor);">' +
            '    ✨ 용병 효과: ' + optName + ' +' + optValStr +
            '  </div>' +
            '</div>' +
            '<button class="btn-main" style="background:var(--Highlight);" onclick="openMercenaryShop()">다시 영입하기</button>' +
            '<button class="btn-main" style="background:var(--TextSub); margin-top:8px;" onclick="renderDashboard()">가방/대시보드로</button>';
    }, 1000);
}