function getTitleHtml(s) {
    // 칭호가 없는 학생도 높이가 틀어지지 않도록 투명한 공백 할당
    let titleHtml = '<span style="display:block; font-size:0.45em; margin-bottom:2px; opacity:0;">&nbsp;</span>';

    if (s && s.equipped_title && String(s.equipped_title).trim() !== '' && String(s.equipped_title) !== 'undefined') {
        // 칭호 영역: 말줄임표 삭제 및 자연스러운 두 줄 바꿈 허용 (white-space:normal)
        titleHtml = '<span style="display:block; font-size:0.45em; color:var(--TextGold); margin-bottom:2px; text-shadow:none; width:100%; white-space:normal; word-break:keep-all;">' + s.equipped_title + '</span>';
    }

    // 이름 영역: 말줄임표 삭제 및 자연스러운 두 줄 바꿈 허용 (white-space:normal)
    return titleHtml + '<span style="display:block; width:100%; white-space:normal; word-break:keep-all;">' + s.name + '</span>';
}

let currentStudent = null;
let tempStats = { hp: 0, atk: 0, def: 0, luk: 0, remain: 0 };

// 💡 파이어베이스 학생 데이터 실시간 동기화 헬퍼 함수
async function updateFastFirebaseStudent(student) {
    if (!window.allStudentsData || !student || !student.name) return;
    const idx = window.allStudentsData.findIndex(s => s.name === student.name);
    if (idx === -1) return;
    try {
        await fetch(`https://learning-explorer-default-rtdb.firebaseio.com/gameData/students/${idx}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(student)
        });
    } catch (e) {
        console.error("파이어베이스 학생 데이터 저장 실패:", e);
    }
}
let originalStats = { hp: 5, atk: 5, def: 5, luk: 5 };
let currentEquipType = 'weapon';

let sysConfig = {};
let mercenariesData = []; // 💡 [신규] 동료(용병) 데이터 전역 변수
// 💡 유물 효과 한글 번역 사전 (ui 표시용)
const relicEffectTranslator = {
    'hp_up': '최대 체력 증가(고정)',
    'atk_up': '공격력 증가(고정)',
    'def_up': '방어력 증가(고정)',
    'luk_up': '행운 증가(고정)',
    'hp_mult': '최대 체력 증가(비율)',
    'atk_mult': '공격력 증가(비율)',
    'def_mult': '방어력 증가(비율)',
    'hp_regen': '턴 종료 시 체력 회복',
    'dodge_up': '회피 확률 증가',
    'crit_up': '치명타 확률 증가',
    'crit_dmg': '치명타 데미지 증가',
    'gold_up': '전투 승리 보상 증가',
    'forge_up': '대장간 강화 확률 증가',
    'skill_prob': '스킬 발동 확률 증가' // cool_down 대신 이걸 씁니다.
};
if (typeof enhanceData === 'undefined') var enhanceData = [];
if (typeof skillsData === 'undefined') var skillsData = [];
if (typeof relicsData === 'undefined') var relicsData = [];
if (typeof skinsData === 'undefined') var skinsData = [];
if (typeof noticesData === 'undefined') var noticesData = [];
if (typeof lootBoxesData === 'undefined') var lootBoxesData = [];
if (typeof shopData === 'undefined') var shopData = [];
if (typeof bossList === 'undefined') var bossList = [];
if (typeof questsData === 'undefined') var questsData = [];
if (typeof submissionsData === 'undefined') var submissionsData = [];

let canReroll = true;
let currentTargetSlot = 1;

// 💡 전체 몬스터 데이터와 스킬 데이터를 담을 전역 변수
let monsterList = [];
let monsterSkillsData = [];

// 💡 레이드 전용 전역 변수 추가
let dungeonsData = [];
let isRaidModeSelect = false;
let raidParty = [];
let currentRaidDungeon = null;
let currentRaidStage = 0;
let totalRaidReward = 0;

// 💡 파이어베이스 연동 시 initGameData에서 모든 데이터가 자동 세팅되므로 로드 로그로 대체합니다.
window.addEventListener('DOMContentLoaded', () => {
    console.log("파이어베이스 초고속 데이터베이스 준비 완료");
});

const FIREBASE_DB_URL = "https://learning-explorer-default-rtdb.firebaseio.com/gameData.json";

window.onload = function () {
    fetchFastGameData();
};

async function fetchFastGameData() {
    try {
        const res = await fetch(FIREBASE_DB_URL);
        const data = await res.json();
        if (data) initGameData(data);
    } catch (e) {
        console.error("파이어베이스 데이터 로딩 실패:", e);
    }
}

// [신규] 수동 동기화 함수 (교사 퀘스트 관리 및 제출자 명단 완벽 동기화 패치)
function manualRefresh() {
    showUiAlert("🔄 동기화 중...", "최신 정보를 불러옵니다.", "");

    fetchFastGameData().then(() => {
        if (currentStudent && window.allStudentsData) {
            currentStudent = window.allStudentsData.find(s => s.name === currentStudent.name) || currentStudent;
            if (document.getElementById('detailModal').style.display === 'flex') {
                renderDashboard();
            }
        }
        closeUiPopup();
    });
}

function initGameData(data) {
    if (typeof data === 'string' && data.startsWith("Error")) { alert(data); return; }
    sysConfig = data.system.config || {};
    enhanceData = data.system.enhance || [];
    skillsData = data.skills || [];
    relicsData = data.relics || [];
    skinsData = data.skins || [];
    noticesData = data.notices || [];
    lootBoxesData = data.lootBoxes || [];
    shopData = data.shopItems || [];
    mercenariesData = data.mercenaries || [];
    if (data.monsters) monsterList = data.monsters;
    if (data.monsterSkills) monsterSkillsData = data.monsterSkills;
    if (data.dungeons) dungeonsData = data.dungeons;
    if (data.bosses) bossList = data.bosses;

    renderButtons(data.students);
}

// 💡 백그라운드 이미지 캐싱 함수 (화면에는 보이지 않음)
function preloadGameImages() {
    const urlsToPreload = [];

    // 1. 모든 몬스터 이미지 주소 수집
    if (monsterList && monsterList.length > 0) {
        monsterList.forEach(m => { if (m.icon_url) urlsToPreload.push(m.icon_url); });
    }

    // 2. 모든 스킨(아바타) 이미지 주소 수집
    if (skinsData && skinsData.length > 0) {
        skinsData.forEach(s => { if (s.skin_url) urlsToPreload.push(s.skin_url); });
    }

    // 브라우저의 Image 객체를 생성하여 주소를 할당하면 자동으로 캐시에 저장됨
    urlsToPreload.forEach(url => {
        const img = new Image();
        img.src = url;
    });
    console.log("✅ 총 " + urlsToPreload.length + "개의 이미지가 백그라운드에서 캐싱되었습니다.");
}

function renderButtons(students) {
    // 레이드에서 학생들 스탯을 통째로 꺼내오기 위해 글로벌 변수에 원본 저장
    window.allStudentsData = students;

    const grid = document.getElementById('studentGrid');
    document.getElementById('loading').style.display = 'none';
    grid.innerHTML = '';

    students.forEach(s => {
        if (!s.name) return;
        const btn = document.createElement('button');
        btn.className = 'student-btn ' + (s.blessing ? 'btn-' + s.blessing : '');
        if (!s.blessing) btn.style.backgroundColor = '#E2E8F0';

        // 텍스트가 넘치면 말줄임표 없이 자연스럽게 줄바꿈되도록 수정
        btn.innerHTML = '<div style="width:100%; line-height:1.2; white-space:normal;">' + getTitleHtml(s) + '</div><div style="font-size: 0.7em; opacity: 0.8; margin-top:5px;">📚 ' + (s.reading_count || 0) + '편</div>';

        // 💡 학생 클릭 로직: 레이드 선택 분기를 없애고 바로 학생 정보 열기
        btn.onclick = () => {
            currentStudent = s;
            openStudentDetail();
        };
        grid.appendChild(btn);
    });
}

// 💡 1. 본인 확인 로그인 흐름 (교사 모드 패스 기능 추가)
function openStudentDetail() {
    // 🚨 [신규] 교사 모드가 활성화되어 있다면, 학생 비밀번호를 묻지 않고 바로 입장(프리패스)합니다!
    if (isTeacherMode) {
        openStudentDetailAfterAuth();
        return;
    }

    const rawPw = currentStudent.password || '';
    if (rawPw === '') {
        // 비밀번호가 없으면 최초 설정 화면
        showPasswordSetupPrompt();
    } else {
        // 비밀번호가 있으면 로그인 화면
        showPasswordLoginPrompt();
    }
}

// 💡 2. 인증 성공 시 호출되는 진짜 대시보드 오픈 함수 (기존 openStudentDetail 역할)
function openStudentDetailAfterAuth() {
    const modal = document.getElementById('detailModal');
    modal.style.display = 'flex';
    if (!currentStudent.blessing) showBlessingSelection();
    else renderDashboard();

    // 💡 최신 공지사항 점검 및 강제 알림 팝업 (교사 모드가 아닐 때만 실행!)
    if (!isTeacherMode) {
        const activeNotices = noticesData.filter(n => String(n.is_active).toLowerCase() === 'true');
        if (activeNotices.length > 0) {
            const latestNoticeId = activeNotices[activeNotices.length - 1].notice_id;
            if (String(currentStudent.last_read_notice) !== String(latestNoticeId)) {
                // 아직 안 읽은 공지가 있다면 뱃지 유지 + 강제 팝업 알림
                document.getElementById('noticeBadge').style.display = 'flex';
                setTimeout(() => {
                    showUiAlert("📢 새로운 소식", "새로운 공지사항이 등록되었습니다!<br><br><span style='color:var(--Red); font-size:0.9em;'>(화면 상단의 [길드 게시판]을 꼭 확인해주세요.)</span>", "");
                }, 500);
            } else {
                // 모두 읽었다면 뱃지 숨김
                document.getElementById('noticeBadge').style.display = 'none';
            }
        }
    }
}

// 💡 1. 최초 핀번호 설정 팝업 (엔터키 지원)
function showPasswordSetupPrompt() {
    document.getElementById('uiPopupTitle').innerHTML = '🔒 비밀번호 설정';
    document.getElementById('uiPopupMessage').innerHTML = '내 계정을 보호할 <b>4자리 숫자 PIN</b>을 설정하세요.<br><br><input type="password" id="uiPopupInput" class="num-input" style="width:80%; background:#111; color:#fff; border:1px solid var(--Highlight);" maxlength="4" placeholder="숫자 4자리">';
    let confirmScript = "let val = document.getElementById('uiPopupInput').value; processPasswordSetup(val);";
    document.getElementById('uiPopupButtons').innerHTML =
        '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeUiPopup()">취소</button>' +
        '<button id="uiPopupConfirmBtn" style="flex:1; padding:12px; border-radius:10px; border:none; background:#4d94ff; color:white; font-weight:bold; font-size:1.1em; cursor:pointer;" onclick="' + confirmScript + '">확인</button>';
    document.getElementById('uiPopup').style.display = 'flex';

    setTimeout(() => {
        const inputEl = document.getElementById('uiPopupInput');
        inputEl.focus();
        inputEl.addEventListener("keypress", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                document.getElementById('uiPopupConfirmBtn').click();
            }
        });
    }, 100);
}

// 💡 4. 핀번호 설정 검증 및 저장
function processPasswordSetup(pin) {
    // 정규식을 사용해 오직 '숫자 4자리'만 통과시킴
    if (!/^\d{4}$/.test(pin)) {
        showUiAlert('❌ 오류', '비밀번호는 반드시 <b>숫자 4자리</b>여야 합니다.', 'showPasswordSetupPrompt()');
        return;
    }

    // 로컬 데이터에 ! 붙여서 즉시 반영
    currentStudent.password = '!' + pin;
    closeUiPopup();

    openStudentDetailAfterAuth();
    updateFastFirebaseStudent(currentStudent);
}

// 💡 2. 로그인 팝업 (엔터키 지원)
function showPasswordLoginPrompt() {
    document.getElementById('uiPopupTitle').innerHTML = '🔒 본인 확인';
    document.getElementById('uiPopupMessage').innerHTML = '<span style="color:var(--Highlight); font-weight:bold;">' + currentStudent.name + '</span> 모험가의 <b>비밀번호 4자리</b>를 입력하세요.<br><br><input type="password" id="uiPopupInput" class="num-input" style="width:80%; background:#111; color:#fff; border:1px solid var(--Highlight);" maxlength="4">';
    let confirmScript = "let val = document.getElementById('uiPopupInput').value; processPasswordLogin(val);";
    document.getElementById('uiPopupButtons').innerHTML =
        '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeUiPopup()">취소</button>' +
        '<button id="uiPopupConfirmBtn" style="flex:1; padding:12px; border-radius:10px; border:none; background:#4d94ff; color:white; font-weight:bold; font-size:1.1em; cursor:pointer;" onclick="' + confirmScript + '">확인</button>';
    document.getElementById('uiPopup').style.display = 'flex';

    setTimeout(() => {
        const inputEl = document.getElementById('uiPopupInput');
        inputEl.focus();
        inputEl.addEventListener("keypress", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                document.getElementById('uiPopupConfirmBtn').click();
            }
        });
    }, 100);
}

// 💡 6. 로그인 핀번호 검증
function processPasswordLogin(pin) {
    // 시트에 저장된 비번에서 !를 떼어내고 비교
    const correctPin = String(currentStudent.password).replace('!', '').trim();

    if (pin === correctPin) {
        closeUiPopup();
        openStudentDetailAfterAuth();
    } else {
        showUiAlert('❌ 오류', '비밀번호가 일치하지 않습니다.', 'showPasswordLoginPrompt()');
    }
}

function showBlessingSelection() {
    const body = document.getElementById('modalBody');
    const bList = [
        { id: 'Red', n: '🔴 용기의 가호(공격력 보너스)' }, { id: 'Blue', n: '🔵 지혜의 가호(방어력 보너스)' },
        { id: 'Green', n: '🟢 끈기의 가호(체력 보너스)' }, { id: 'Yellow', n: '🟡 행운의 가호(행운 보너스)' }, { id: 'Purple', n: '🟣 희망의 가호(1회 확정 회피)' }
    ];
    body.innerHTML = '<h2>✨ 가호의 각성</h2><p>' + currentStudent.name + ' 모험가여, 영혼의 색을 선택하라.</p>';
    bList.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'blessing-select-btn btn-' + b.id;
        btn.innerText = b.n;
        // 💡 투박한 브라우저 confirm 대신 예쁜 게임 UI 팝업창 연결
        btn.onclick = () => showUiConfirm("✨ 가호 선택", "[" + b.n + "]을(를) 선택하시겠습니까?<br><span style='font-size:0.8em; color:#aaa;'>(한 번 선택하면 바꿀 수 없습니다)</span>", `saveBlessing('${b.id}')`);
        body.appendChild(btn);
    });
}

function saveBlessing(bId) {
    document.getElementById('modalBody').innerHTML = '<h3 style="margin-top: 50px; color:var(--Highlight);">각성 진행 중...</h3>';

    // 💡 1. 로컬 데이터에 즉시 임시 반영 (빠른 화면 전환을 위함)
    currentStudent.blessing = bId;
    currentStudent.hp_points = 5;
    currentStudent.atk_points = 5;
    currentStudent.def_points = 5;
    currentStudent.luk_points = 5;

    // 💡 [수정] 기존에 보유한 스킨이 없을 때만(최초 시작 시에만) 기본 스킨을 지급합니다.
    // (2분기 소프트 리셋 시, 학생들이 1분기에 획득한 스킨이 날아가는 것을 방지)
    if (!currentStudent.unlocked_skins || currentStudent.unlocked_skins === "") {
        currentStudent.unlocked_skins = "!HD001,!HD002,!HD003,!HD004,!HD005,!HD006,!HD007,!HD008";
        currentStudent.equipped_skin = "HD001";
    }

    renderDashboard();
    updateFastFirebaseStudent(currentStudent);
}

// ==========================================
// 대시보드 메인 (스탯 보너스 분리 표기: 장비=초록, 유물=주황)
// ==========================================
// --- 대시보드 렌더링 함수 중 스탯 계산 부분 수정 ---
function renderDashboard() {
    const s = currentStudent;
    const body = document.getElementById('modalBody');

    // 💡 대시보드 원래 너비(900px)로 안전 원복
    const modalContent = document.querySelector('#detailModal .modal-content');
    if (modalContent) modalContent.style.maxWidth = '900px';

    const currentWeek = Number(sysConfig.current_week) || 1;
    const maxPerWeek = Number(sysConfig.max_weekly_books) || 3;
    const maxReadingLimit = currentWeek * maxPerWeek;
    const actualReading = Number(s.reading_count) || 0;
    const appliedReading = Math.min(actualReading, maxReadingLimit);

    const ppb = Number(sysConfig.point_per_book) || 4;
    const totalPoints = appliedReading * ppb + (Number(s.bonus_points) || 0);

    const baseHp = Number(s.hp_points) || 5;
    const baseAtk = Number(s.atk_points) || 5;
    const baseDef = Number(s.def_points) || 5;
    const baseLuk = Number(s.luk_points) || 5;

    const usedHp = Math.max(0, baseHp - 5);
    const usedAtk = Math.max(0, baseAtk - 5);
    const usedDef = Math.max(0, baseDef - 5);
    const usedLuk = Math.max(0, baseLuk - 5);
    const used = usedHp + usedAtk + usedDef + usedLuk;

    const rW = (Number(sysConfig.rate_weapon) || 7) / 100;
    const rH = (Number(sysConfig.rate_head) || 5) / 100;
    const rB = (Number(sysConfig.rate_body) || 5) / 100;
    const rA = (Number(sysConfig.rate_acc) || 5) / 100;

    const calcEquip = (base, rate, lv) => {
        const val = base * rate * lv;
        return Number.isInteger(val) ? val : Number(val.toFixed(1));
    };

    let equipBonus = {
        hp: calcEquip(baseHp, rH, Number(s.head_lv) || 0),
        atk: calcEquip(baseAtk, rW, Number(s.weapon_lv) || 0),
        def: calcEquip(baseDef, rB, Number(s.body_lv) || 0),
        luk: calcEquip(baseLuk, rA, Number(s.accessory_lv) || 0)
    };

    let relicBonus = { hp: 0, atk: 0, def: 0, luk: 0 };
    const applyRelicBonus = (relicId) => {
        if (relicId && relicId !== 'null' && relicId !== 'false' && String(relicId).trim() !== '') {
            const r = relicsData.find(x => String(x.relic_id) === String(relicId));
            if (r) {
                const val = Number(r.value) || 0;
                const type = String(r.effect_type).toUpperCase();
                if (type.includes('HP') || type.includes('체력')) relicBonus.hp += val;
                if (type.includes('ATK') || type.includes('공격력')) relicBonus.atk += val;
                if (type.includes('DEF') || type.includes('방어력')) relicBonus.def += val;
                if (type.includes('LUK') || type.includes('행운')) relicBonus.luk += val;
            }
        }
    };
    applyRelicBonus(s.relic_1);
    applyRelicBonus(s.relic_2);

    // 💡 [신규] 배치된 동료(용병) 옵션 스탯 합산 (FLAT 및 PERCENT 적용)
    let mercBonus = { hp: 0, atk: 0, def: 0, luk: 0 };
    [s.party_m1, s.party_m2].forEach(mId => {
        if (mId && mId !== 'null' && mId !== 'false' && String(mId).trim() !== '') {
            const merc = mercenariesData.find(x => String(x.merc_id) === String(mId));
            if (merc) {
                const val = Number(merc.option_value) || 0;
                const isPct = String(merc.option_calc_type).toUpperCase() === 'PERCENT';
                const type = String(merc.option_type).toUpperCase();

                if (type.includes('HP')) mercBonus.hp += isPct ? Math.floor((baseHp + equipBonus.hp) * val) : val;
                if (type.includes('ATK')) mercBonus.atk += isPct ? Math.floor((baseAtk + equipBonus.atk) * val) : val;
                if (type.includes('DEF')) mercBonus.def += isPct ? Math.floor((baseDef + equipBonus.def) * val) : val;
                if (type.includes('LUK')) mercBonus.luk += isPct ? Math.floor((baseLuk + equipBonus.luk) * val) : val;
            }
        }
    });

    // 동료 보너스를 유물 보너스 항목에 합산하여 UI에 통합 표시
    relicBonus.hp += mercBonus.hp;
    relicBonus.atk += mercBonus.atk;
    relicBonus.def += mercBonus.def;
    relicBonus.luk += mercBonus.luk;

    const renderStatHtml = (label, base, eBonus, rBonus, statType) => {
        let totalBonus = eBonus + rBonus;
        let total = base + totalBonus;
        let max = 150;
        let basePercent = Math.min(100, (base / max) * 100);
        let bonusPercent = Math.min(100 - basePercent, (totalBonus / max) * 100);
        let isOvercharge = total >= max;

        let colorMap = { 'hp': 'var(--Green)', 'atk': 'var(--Red)', 'def': 'var(--Purple)', 'luk': 'var(--Yellow)' };
        let baseColor = colorMap[statType] || 'var(--Highlight)';

        let numHtml = '<b style="font-size:1.1em; color:var(--TextMain);">' + base + '</b>';
        if (eBonus > 0) numHtml += ' <span style="color:var(--Blue); font-weight:bold; font-size:0.9em; margin-left:5px;">(+' + eBonus + ')</span>';
        if (rBonus > 0) {
            const displayR = Number.isInteger(rBonus) ? rBonus : Number(rBonus.toFixed(1));
            numHtml += ' <span style="color:var(--TextGold); font-weight:bold; font-size:0.9em; margin-left:5px;">(+' + displayR + ')</span>';
        }

        let barContainerStyle = 'width: 100%; background: #475569; height: 8px; border-radius: 4px; margin-top: 6px; position: relative;';
        if (isOvercharge) {
            barContainerStyle += ' box-shadow: 0 0 6px 1px rgba(245, 158, 11, 0.8); border: 1px solid #FCD34D;';
        } else {
            barContainerStyle += ' overflow: hidden;';
        }

        let baseRadius = bonusPercent > 0 ? '4px 0 0 4px' : '4px';

        let barHtml = '<div style="' + barContainerStyle + '">';
        barHtml += '<div style="height: 100%; position: absolute; left: 0; top: 0; width: ' + basePercent + '%; background: ' + baseColor + '; z-index: 1; border-radius: ' + baseRadius + ';"></div>';
        if (bonusPercent > 0) {
            barHtml += '<div style="height: 100%; position: absolute; left: calc(' + basePercent + '% - 1px); top: 0; width: calc(' + bonusPercent + '% + 1px); background: repeating-linear-gradient(45deg, #38BDF8, #38BDF8 4px, #7DD3FC 4px, #7DD3FC 8px); z-index: 2; border-radius: 0 4px 4px 0;"></div>';
        }
        barHtml += '</div>';

        return '<div style="width: 100%; margin-bottom: 10px; border-bottom: 1px dashed var(--BorderColor); padding-bottom: 8px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center;">' +
            '<span style="color:var(--TextSub); font-weight:bold; font-size:0.95em;">' + label + '</span>' +
            '<div>' + numHtml + '</div>' +
            '</div>' + barHtml + '</div>';
    };

    const getSlotHtml = (isUnlocked, equipName, slotTitle, isSkill = false, slotNum = 1) => {
        const slotBgColor = isSkill ? '#F0F9FF' : '#FFF1F2'; // 연한 하늘색, 연한 분홍색
        if (!isUnlocked || String(isUnlocked).toLowerCase() === 'false') {
            return '<div class="slot-row" style="background:var(--BgLock); color:var(--TextLock); border:none;"><div>🔒 ' + slotTitle + ' 잠김</div><button class="small-btn" style="background:var(--TextSub);" onclick="promptUnlockSlot(\'' + (isSkill ? 'skill' : 'relic') + '\', ' + slotNum + ')">[확장]</button></div>';
        } else {
            let displayName = equipName || '미장착';
            let iconHtml = '<span class="icon-box" style="background:var(--BgEmpty); border-color:var(--BorderColor);"></span>';

            if (isSkill && equipName) {
                const sk = skillsData.find(x => String(x.skill_id) === String(equipName));
                displayName = sk ? sk.name : equipName;
                if (sk && sk.icon_url) {
                    let blessClass = sk.blessing ? 'blessing-' + sk.blessing.trim() : 'blessing-None';
                    iconHtml = '<img src="' + sk.icon_url + '" class="skill-icon-pixel ' + blessClass + '" style="margin-right:8px;">';
                }
            } else if (!isSkill && equipName && equipName !== 'null' && equipName !== 'false' && equipName !== true) {
                const relic = relicsData.find(r => String(r.relic_id) === String(equipName));
                if (relic) {
                    displayName = relic.name;
                    iconHtml = '<img src="' + relic.icon_url + '" style="width:24px; height:24px; object-fit:contain; border-radius:4px; background:#FEF3C7; border:2px solid var(--Yellow); image-rendering:pixelated; padding:2px; vertical-align:middle; margin-right:8px;">';
                }
            }

            const clickAttr = isSkill ? 'onclick="openEquipUI(' + slotNum + ')"' : 'onclick="openRelicEquipUI(' + slotNum + ')"';
            return '<div class="slot-row" style="background:' + slotBgColor + '; color:var(--TextMain); border:1px solid var(--BorderColor); box-shadow:0 2px 4px rgba(0,0,0,0.05);"><div>' + iconHtml + ' <span style="font-weight:bold;">' + displayName + '</span></div><button class="small-btn" style="background:var(--BtnShop); border:none;" ' + clickAttr + '>[장착]</button></div>';
        }
    };

    const currentSkinId = s.equipped_skin || 'HD001';
    const skinObj = skinsData.find(x => String(x.skin_id) === String(currentSkinId));
    const skinImgUrl = (skinObj && skinObj.skin_url) ? skinObj.skin_url : 'https://via.placeholder.com/150/444444/FFFFFF?text=NoSkin';

    const blessingMap = {
        'Red': '🔴 용기', 'Blue': '🔵 지혜', 'Green': '🟢 끈기',
        'Yellow': '🟡 행운', 'Purple': '🟣 희망'
    };
    const displayBlessing = blessingMap[s.blessing] || s.blessing;

    const expMax = Number(sysConfig.exp_max) || 100;
    const expPercent = Math.min(100, ((Number(s.exp) || 0) / expMax) * 100);

    const remainStats = totalPoints + (Number(s.level_points) || 0) - used;
    const nBadge = remainStats > 0 ? '<span class="n-badge" style="top:-5px; right:-5px; font-size:0.7em;">N</span>' : '';

    let tabState = window.currentDashTab || 'info';
    if (['forge', 'prep'].includes(tabState)) tabState = 'equip'; // 기존 탭 이름 호환 처리
    window.currentDashTab = tabState;

    const getTabClass = (t) => 'dash-tab ' + (tabState === t ? 'active' : '');
    const getOnclick = (t) => 'onclick="window.currentDashTab=\'' + t + '\'; renderDashboard();"';

    const tabsHtml =
        '<div style="display:flex; margin-bottom:15px; border-bottom: 2px solid var(--BorderColor); overflow-x: auto;">' +
        '  <div class="' + getTabClass('info') + '" ' + getOnclick('info') + '>👤 정보</div>' +
        '  <div class="' + getTabClass('stats') + '" ' + getOnclick('stats') + ' style="position:relative;">📊 능력치' + nBadge + '</div>' +
        '  <div class="' + getTabClass('equip') + '" ' + getOnclick('equip') + '>🎒 장비</div>' +
        '  <div class="' + getTabClass('shop') + '" ' + getOnclick('shop') + '>🛒 상점</div>' +
        '  <div class="' + getTabClass('bag') + '" ' + getOnclick('bag') + '>🎒 가방</div>' +
        '</div>';

    let tabContent = '';
    if (tabState === 'info') {
        tabContent =
            '<div style="text-align:center; color:var(--' + s.blessing + '); font-weight:bold; font-size:1.1em; margin-bottom: 10px;">' + displayBlessing + '의 가호 적용 중</div>' +
            '<div class="stat-row" style="font-size:1.05em; padding-bottom:4px; margin-bottom:6px;"><span style="color:var(--TextSub);">💰 소지 자금</span> <div><b style="color:var(--TextGold);">' + (Number(s.game_money) || 0) + '</b> ' + (sysConfig.game_money_currency || '골드') + '</div></div>' +
            '<div class="stat-row" style="font-size:1.05em; padding-bottom:4px; margin-bottom:6px;"><span style="color:var(--TextSub);">📚 독서록</span> <div><b style="color:var(--TextMain);">' + actualReading + '</b> 편 <span style="font-size:0.85em; font-weight:bold; color:' + (actualReading >= maxReadingLimit ? 'var(--Red)' : 'var(--Blue)') + ';">(적용: ' + appliedReading + '/' + maxReadingLimit + ')</span> <button class="small-btn" style="background:var(--TextSub); border:none; padding:2px 6px;" onclick="openReadingCountEdit()">수정</button></div></div>' +
            '<div class="stat-row" style="font-size:1.05em; padding-bottom:4px; margin-bottom:6px;"><span style="color:var(--TextSub);">⚔️ 사냥 기회</span> <b style="color:var(--TextGold);">' + (s.weekly_battles !== undefined ? s.weekly_battles : (Number(sysConfig.max_weekly_battles) || 2)) + ' / ' + (Number(sysConfig.max_weekly_battles) || 2) + '</b></div>' +
            '<div class="stat-row" style="font-size:1.05em; padding-bottom:4px; margin-bottom:6px;"><span style="color:var(--TextSub);">💀 보스 도전 기회</span> <b style="color:var(--TextGold);">' + (s.weekly_boss !== undefined ? s.weekly_boss : (Number(sysConfig.max_weekly_boss) || 3)) + ' / ' + (Number(sysConfig.max_weekly_boss) || 3) + '</b></div>' +
            '<div class="stat-row" style="font-size:1.05em; padding-bottom:4px; margin-bottom:6px;"><span style="color:var(--TextSub);">🏰 던전 탐험 기회</span> <b style="color:var(--TextGold);">' + (s.weekly_raid !== undefined ? s.weekly_raid : (Number(sysConfig.max_weekly_raid) || 1)) + ' / ' + (Number(sysConfig.max_weekly_raid) || 1) + '</b></div>' +
            '<div class="stat-row" style="font-size:1.05em; padding-bottom:4px; margin-bottom:6px;"><span style="color:var(--TextSub);">🗼 도전의 탑 기회</span> <b style="color:var(--TextGold);">' + (s.weekly_tower !== undefined ? s.weekly_tower : (Number(sysConfig.max_weekly_tower) || 1)) + ' / ' + (Number(sysConfig.max_weekly_tower) || 1) + '</b></div>' +
            '<div style="display:flex; gap:10px; margin-top:10px;">' +
            '  <button class="btn-main" style="flex:1; background:var(--BtnShop); display:flex; align-items:center; justify-content:center; gap:5px; padding:10px; font-size:1em;" onclick="openEncyclopedia(\'skill\')"><span style="font-size:1.2em;">📖</span> 도감 확인</button>' +
            '  <button class="btn-main" style="flex:1; background:var(--BtnShop); display:flex; align-items:center; justify-content:center; gap:5px; padding:10px; font-size:1em;" onclick="openStudentQuestBoard()"><span style="font-size:1.2em;">📜</span> 의뢰소 진입</button>' +
            '</div>';
    } else if (tabState === 'stats') {
        tabContent =
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">' +
            '  <div style="font-size:1.1em; font-weight:bold; color:var(--TextMain);">잔여 포인트: <span style="color:var(--TextPoint);">' + remainStats + '</span></div>' +
            '  <button class="small-btn" style="background:var(--Highlight); padding:6px 12px; font-size:0.9em;" onclick="openStatAllocation()">능력치 분배</button>' +
            '</div>' +
            '<div style="display:flex; flex-direction:column; gap:5px;">' +
            renderStatHtml('체력(HP)', baseHp, equipBonus.hp, relicBonus.hp, 'hp') +
            renderStatHtml('공격(ATK)', baseAtk, equipBonus.atk, relicBonus.atk, 'atk') +
            renderStatHtml('방어(DEF)', baseDef, equipBonus.def, relicBonus.def, 'def') +
            renderStatHtml('행운(LUK)', baseLuk, equipBonus.luk, relicBonus.luk, 'luk') +
            '</div>';
    } else if (tabState === 'equip') {
        tabContent =
            '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">' +
            '  <div>' +
            '    <div style="font-size:1.1em; font-weight:bold; color:var(--TextMain); margin-bottom:10px; border-bottom:1px solid var(--Highlight); padding-bottom:5px;">🔮 장착 <span style="color:var(--Blue);">스킬</span> 및 <span style="color:var(--Red);">유물</span></div>' +
            '    <div style="display:flex; flex-direction:column; gap:0;">' +
            getSlotHtml(true, s.equipped_1, '대표 스킬', true, 1) +
            getSlotHtml(true, s.relic_1, '유물 1', false, 1) +
            getSlotHtml(s.relic_slot_2_unlocked, s.relic_2, '유물 2', false, 2) +
            '    </div>' +
            '  </div>' +
            '  <div>' +
            '    <div style="font-size:1.1em; font-weight:bold; color:var(--TextMain); margin-bottom:10px; border-bottom:1px solid var(--BorderColor); padding-bottom:5px;">⚔️ 장비 강화 현황</div>' +
            '    <div style="display:flex; flex-direction:column; gap:10px; padding-top:5px;">' +
            '      <div class="stat-row" style="font-size:1.1em;"><span style="color:var(--TextSub);">⚔️ 무기</span> <b style="color:var(--TextMain);">+' + (s.weapon_lv || 0) + '</b></div>' +
            '      <div class="stat-row" style="font-size:1.1em;"><span style="color:var(--TextSub);">🛡️ 투구</span> <b style="color:var(--TextMain);">+' + (s.head_lv || 0) + '</b></div>' +
            '      <div class="stat-row" style="font-size:1.1em;"><span style="color:var(--TextSub);">👕 갑옷</span> <b style="color:var(--TextMain);">+' + (s.body_lv || 0) + '</b></div>' +
            '      <div class="stat-row" style="font-size:1.1em;"><span style="color:var(--TextSub);">💍 장신구</span> <b style="color:var(--TextMain);">+' + (s.accessory_lv || 0) + '</b></div>' +
            '    </div>' +
            '  </div>' +
            '</div>';
    } else if (tabState === 'shop') {
        const gameCurrency = sysConfig.game_money_currency || '골드';

        let shopItemsHtml = '';
        if (shopData.length === 0) {
            shopItemsHtml = '<div style="padding:10px; text-align:center; color:var(--TextSub);">현재 판매 중인 아이템이 없습니다.</div>';
        } else {
            shopData.forEach(item => {
                if (!item.item_id) return;

                // 이모지가 없으면 기본 상자 아이콘
                const icon = item.icon || '📦';
                const price = Number(item.price) || 0;

                // effect_type에 따른 버튼 색상 분기
                let btnColor = 'var(--Highlight)';
                if (item.effect_type === 'heal_injury') btnColor = 'var(--Green)';
                else if (item.effect_type === 'reset_stat') btnColor = 'var(--Purple)';

                shopItemsHtml +=
                    '<div style="background:#fff; border:1px solid var(--BorderColor); padding:10px 15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">' +
                    '  <div style="display:flex; align-items:center; gap:10px;">' +
                    '    <div style="font-size:1.5em;">' + icon + '</div>' +
                    '    <div><div style="font-weight:bold; font-size:1.05em; color:var(--TextMain);">' + item.item_name + '</div><div style="font-size:0.8em; color:var(--TextSub);">' + (item.description || '') + '</div></div>' +
                    '  </div>' +
                    '  <button class="small-btn" style="background:' + btnColor + '; padding:6px 10px; min-width:70px;" onclick="buyShopItem(\'' + item.item_id + '\')">' + price + ' ' + gameCurrency + '</button>' +
                    '</div>';
            });
        }

        tabContent =
            '<div style="text-align:left;">' +
            '  <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom:15px;">' +
            '    <button class="btn-main" style="margin-top:0; padding:10px; background:var(--Highlight);" onclick="openSkillShop()">🔮 스킬 뽑기</button>' +
            '    <button class="btn-main" style="margin-top:0; padding:10px; background:var(--Red);" onclick="openRelicShop()">🏺 유물 뽑기</button>' +
            '    <button class="btn-main" style="margin-top:0; padding:10px; background:var(--Blue);" onclick="openMercenaryShop()">🛡️ 동료 뽑기</button>' +
            '    <button class="btn-main" style="margin-top:0; padding:10px; background:var(--Yellow); color:black;" onclick="openForge()">🔨 대장간 진입</button>' +
            '  </div>' +
            '  <div style="display:grid; grid-template-columns: 1fr; gap: 8px; max-height:300px; overflow-y:auto; overflow-x:hidden; padding-right:6px; overscroll-behavior:contain; -webkit-overflow-scrolling:touch;">' +
            shopItemsHtml +
            '  </div>' +
            '</div>';
    } else if (tabState === 'bag') {
        const rawInv = String(currentStudent.inventory || "");
        const items = rawInv ? rawInv.split(',').map(x => x.trim()).filter(Boolean) : [];
        const itemCount = {};
        items.forEach(item => { itemCount[item] = (itemCount[item] || 0) + 1; });

        let bagHtml = '';
        if (Object.keys(itemCount).length === 0) {
            bagHtml = '<div style="padding:30px 10px; color:var(--TextLock); font-size:1em; text-align:center; background:var(--BgEmpty); border-radius:10px;">가방이 텅 비어있습니다.</div>';
        } else {
            bagHtml = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px; max-height:300px; overflow-y:auto; padding-right:5px;">';
            for (const [itemName, count] of Object.entries(itemCount)) {
                let itemIcon = '🎟️';
                let glowStyle = '';
                if (itemName.includes('상자') || itemName.includes('급')) {
                    itemIcon = '⚱️';
                    if (itemName.includes('나무') || itemName.includes('C급')) glowStyle = 'filter: drop-shadow(0 0 5px #9CA3AF);';
                    else if (itemName.includes('철') || itemName.includes('B급')) glowStyle = 'filter: drop-shadow(0 0 8px #3B82F6);';
                    else if (itemName.includes('은') || itemName.includes('A급')) glowStyle = 'filter: drop-shadow(0 0 12px #8B5CF6);';
                    else if (itemName.includes('금') || itemName.includes('S급')) glowStyle = 'filter: drop-shadow(0 0 15px #F59E0B);';
                    else if (itemName.includes('전설') || itemName.includes('SS급')) glowStyle = 'filter: drop-shadow(0 0 20px #EF4444);';
                }

                bagHtml +=
                    '<div style="background:#FFFFFF; border:1px solid var(--BorderColor); border-radius:10px; padding:10px; box-shadow:0 2px 4px rgba(0,0,0,0.05); text-align:center;">' +
                    '  <div style="font-size:30px; margin-bottom:5px; ' + glowStyle + '">' + itemIcon + '</div>' +
                    '  <div style="font-weight:bold; color:var(--TextMain); font-size:0.9em; margin-bottom:5px; word-break:keep-all;">' + itemName + '</div>' +
                    '  <div style="color:#10B981; font-weight:bold; font-size:1em; margin-bottom:10px;">' + count + '개</div>' +
                    '  <button class="small-btn" style="width:100%; background:#10B981; color:white; padding:6px; border:none;" onclick="promptUseItem(\'' + itemName + '\')">사용</button>' +
                    '</div>';
            }
            bagHtml += '</div>';
        }
        tabContent =
            '<div style="font-size:1.1em; font-weight:bold; color:var(--TextMain); margin-bottom:15px;">🎒 전리품 목록</div>' +
            bagHtml;
    }

    body.innerHTML =
        '<div class="dash-layout">' +
        '  <div class="db-section" style="flex: 1; min-width: 250px; align-items: center; text-align: center; position: relative;">' +
        '    <div style="position: absolute; top: 15px; right: 15px; display: flex; flex-direction: column; gap: 5px; z-index: 5;">' +
        '      <button class="small-btn" style="padding: 6px 12px; font-size: 0.85em; background:var(--BtnShop); border:none;" onclick="openWardrobe()">옷장 열기</button>' +
        '      <button class="small-btn" style="padding: 6px 12px; font-size: 0.85em; background:var(--Yellow); color:black; border:none;" onclick="openTitleUI()">🏷️ 칭호 장착</button>' +
        '      <button class="small-btn" style="padding: 6px 12px; font-size: 0.85em; background:var(--Purple); color:white; border:none;" onclick="openExpeditionModal()">⚔️ 원정대</button>' +
        '    </div>' +
        '    <h4 style="margin:0 0 10px 0; color:var(--TextGold); width:100%; text-align:left; font-size:1.1em;">🧑‍🎤 아바타</h4>' +
        '    <div style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center; width: 100%; min-height: 180px;">' +
        '      <img src="' + skinImgUrl + '" style="width: 80%; max-height: 220px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1)); transform: scaleX(-1);">' +
        '    </div>' +
        '    <div style="display:flex; align-items:flex-end; justify-content:center; gap:8px; margin-top:15px;">' +
        '      <span style="font-size:1.2em; color:var(--Yellow); font-weight:bold; margin-bottom:3px;">Lv.' + (s.level || 1) + '</span>' +
        '      <div style="text-align:center;"><span style="font-size:1.8em; font-weight:bold; color:var(--Highlight); line-height:1.1;">' + getTitleHtml(s) + '</span></div>' +
        '    </div>' +
        '    <div style="width:100%; background:#475569; height:8px; border-radius:4px; margin-top:10px; margin-bottom:5px; overflow:hidden;" title="경험치: ' + (s.exp || 0) + '/' + expMax + '">' +
        '      <div style="width:' + expPercent + '%; background:#FBBF24; height:100%; box-shadow:0 0 5px #FBBF24;"></div>' +
        '    </div>' +
        '    <div style="font-size: 0.9em; color: var(--TextSub); font-weight:bold;">EXP: ' + (s.exp || 0) + ' / ' + expMax + '</div>' +
        '  </div>' +

        '  <div style="flex: 2; display: flex; flex-direction: column;">' +
        tabsHtml +
        '    <div class="db-section" style="flex-grow: 1;">' +
        tabContent +
        '    </div>' +
        '  </div>' +
        '</div>' +

        '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:20px;">' +
        '  <button style="padding:15px; border-radius:10px; border:none; background:var(--BtnBattle); color:white; font-weight:bold; font-size:1.1em; cursor:pointer; box-shadow:0 4px 6px rgba(230, 74, 25, 0.2);" onclick="openStageSelection()">⚔️ 일반 사냥</button>' +
        '  <button style="padding:15px; border-radius:10px; border:none; background:var(--Purple); color:white; font-weight:bold; font-size:1.1em; cursor:pointer; box-shadow:0 4px 6px rgba(167, 139, 250, 0.3);" onclick="openBossSelection()">💀 보스 도전</button>' +
        '  <button style="padding:15px; border-radius:10px; border:none; background:#ff9900; color:white; font-weight:bold; font-size:1.1em; cursor:pointer; box-shadow:0 4px 6px rgba(245, 158, 11, 0.3);" onclick="openStudentRaidSetup()">🏰 파티 던전</button>' +
        '  <button style="padding:15px; border-radius:10px; border:none; background:#10B981; color:white; font-weight:bold; font-size:1.1em; cursor:pointer; box-shadow:0 4px 6px rgba(16, 185, 129, 0.3);" onclick="checkAndStartTower()">🗼 도전의 탑</button>' +
        '</div>' +
        '<button style="margin-top:10px; width:100%; padding:12px; border-radius:10px; border:none; background:var(--TextSub); color:white; font-size:1.1em; cursor:pointer;" onclick="closeModal()">닫기</button>';
}

// ==========================================
// 1. 독서록 수정 로직
// ==========================================
function openReadingCountEdit() {
    const body = document.getElementById('modalBody');
    const currentCount = currentStudent.reading_count || 0;
    body.innerHTML =
        '<h2 style="color:#4d94ff;">📚 독서록 갱신</h2>' +
        '<div style="background:#222; padding:30px; border-radius:15px; margin-bottom:20px; border:1px solid #444;">' +
        '  <input type="number" id="newReadingCount" class="num-input" value="' + currentCount + '" min="0">' +
        '</div>' +
        '<div style="display:flex; gap:10px;">' +
        '  <button style="flex:1; padding:15px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="renderDashboard()">취소</button>' +
        '  <button style="flex:1; padding:15px; border-radius:10px; border:none; background:#4d94ff; color:white; font-weight:bold; font-size:1.1em; cursor:pointer;" onclick="saveReadingCount()">저장</button>' +
        '</div>';
}

function saveReadingCount() {
    if (!isTeacherMode) {
        showUiAlert("🔒 권한 없음", "독서록 수정은 교사 모드에서만 가능합니다.", "");
        return;
    }
    const inputVal = document.getElementById('newReadingCount').value;
    const newCount = Number(inputVal);
    if (inputVal === "" || isNaN(newCount) || newCount < 0) { alert("올바른 숫자를 입력해주세요."); return; }

    currentStudent.reading_count = newCount;
    renderDashboard();
    updateFastFirebaseStudent(currentStudent);
}

function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
    // 💡 창을 닫아도 타이머가 끝날 때까지 교사 모드가 유지되도록 disable 삭제
}

// ==========================================
// 🎮 게임 전용 커스텀 팝업 컨트롤러
// ==========================================
function showUiConfirm(title, message, onConfirmCode) {
    document.getElementById('uiPopupTitle').innerHTML = title;
    document.getElementById('uiPopupMessage').innerHTML = message;
    document.getElementById('uiPopupButtons').innerHTML =
        '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeUiPopup()">취소</button>' +
        '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:#4d94ff; color:white; font-weight:bold; font-size:1.1em; cursor:pointer;" onclick="this.disabled=true; closeUiPopup(); ' + onConfirmCode + '">확인</button>';
    document.getElementById('uiPopup').style.display = 'flex';
}

function showUiAlert(title, message, onOkCode) {
    document.getElementById('uiPopupTitle').innerHTML = title;
    document.getElementById('uiPopupMessage').innerHTML = message;
    document.getElementById('uiPopupButtons').innerHTML =
        '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:var(--Highlight); color:black; font-weight:bold; font-size:1.1em; cursor:pointer;" onclick="closeUiPopup(); ' + (onOkCode || '') + '">확인</button>';
    document.getElementById('uiPopup').style.display = 'flex';
}

function closeUiPopup() { document.getElementById('uiPopup').style.display = 'none'; }

// 서브 모달만 닫기
function closeSubModal() {
    document.getElementById('subModal').style.display = 'none';
}

// 💡 [신규] 전역 클릭 차단 로딩창 켜기/끄기 공용 함수
function showGlobalLoading(msg) {
    const overlay = document.getElementById('globalLoadingOverlay');
    const textEl = document.getElementById('globalLoadingText');
    if (overlay) {
        if (textEl) textEl.innerText = msg || "⏳ 서버와 통신 중입니다...";
        overlay.style.display = 'flex';
    }
}

function hideGlobalLoading() {
    const overlay = document.getElementById('globalLoadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ==========================================
// 👑 명예의 전당 시스템
// ==========================================
function openHallOfFame(tabType) {
    if (!tabType) tabType = 'reading'; // 기본값은 독서왕

    if (!window.allStudentsData || window.allStudentsData.length === 0) {
        return showUiAlert('⚠️ 안내', '아직 모험가 데이터가 없습니다.', '');
    }

    // 1. 탭 종류에 따른 정렬 로직
    let sorted = [...window.allStudentsData].sort((a, b) => {
        if (tabType === 'reading') {
            const countA = Number(a.reading_count) || 0;
            const countB = Number(b.reading_count) || 0;
            if (countB !== countA) return countB - countA;

            const lvA = Number(a.level) || 1;
            const lvB = Number(b.level) || 1;
            if (lvB !== lvA) return lvB - lvA;

            return String(a.name).localeCompare(String(b.name), 'ko');
        } else {
            const floorA = Number(a.max_tower_floor) || 0;
            const floorB = Number(b.max_tower_floor) || 0;
            if (floorB !== floorA) return floorB - floorA;

            const lvA = Number(a.level) || 1;
            const lvB = Number(b.level) || 1;
            if (lvB !== lvA) return lvB - lvA;

            const getScore = (lv) => { const l = Number(lv) || 0; return l * l; };
            const equipA = getScore(a.weapon_lv) + getScore(a.head_lv) + getScore(a.body_lv) + getScore(a.accessory_lv);
            const equipB = getScore(b.weapon_lv) + getScore(b.head_lv) + getScore(b.body_lv) + getScore(b.accessory_lv);
            if (equipB !== equipA) return equipB - equipA;

            return String(a.name).localeCompare(String(b.name), 'ko');
        }
    });

    // 2. 상위 3명 추출 및 시상대 배치
    const top3 = sorted.slice(0, 3);
    const displayOrder = [];
    if (top3[1]) displayOrder.push({ data: top3[1], rank: 2, className: 'podium-2', color: '#C0C0C0', icon: '🥈' });
    if (top3[0]) displayOrder.push({ data: top3[0], rank: 1, className: 'podium-1', color: '#FFD700', icon: '🥇' });
    if (top3[2]) displayOrder.push({ data: top3[2], rank: 3, className: 'podium-3', color: '#CD7F32', icon: '🥉' });

    let podiumHtml = '';
    displayOrder.forEach(item => {
        const s = item.data;
        const skinId = s.equipped_skin || 'HD001';
        const skinObj = skinsData.find(x => String(x.skin_id) === String(skinId));
        const skinImgUrl = (skinObj && skinObj.skin_url) ? skinObj.skin_url : 'https://via.placeholder.com/150/444444/FFFFFF?text=NoSkin';
        const bColor = s.blessing ? 'var(--' + s.blessing + ')' : '#fff';

        let statText = tabType === 'reading'
            ? '📚 독서록 ' + (Number(s.reading_count) || 0) + '편'
            : '🗼 탑 최고 ' + (Number(s.max_tower_floor) || 0) + '층';

        podiumHtml +=
            '<div class="podium-rank ' + item.className + '">' +
            '  <img src="' + skinImgUrl + '" class="podium-avatar">' +
            '  <div style="font-size:1.5em; margin-bottom:5px;">' + item.icon + '</div>' +
            '  <div style="font-weight:bold; font-size:1.1em; color:' + bColor + '; text-align:center; word-break:keep-all; line-height:1.2;">' + getTitleHtml(s) + '</div>' +
            '  <div style="color:white; font-size:0.9em; margin-top:5px; background:rgba(0,0,0,0.5); padding:3px 8px; border-radius:10px; border:1px solid #444; white-space:nowrap;">' + statText + '</div>' +
            '</div>';
    });

    // 3. 탭 및 설명 텍스트
    const tabActiveReading = tabType === 'reading' ? 'active' : '';
    const tabActiveAdventure = tabType === 'adventure' ? 'active' : '';

    const tabHtml =
        '<div style="display:flex; margin-bottom:15px; border-bottom: 1px solid #444;">' +
        '  <div class="hof-tab ' + tabActiveReading + '" onclick="openHallOfFame(\'reading\')">📚 독서왕</div>' +
        '  <div class="hof-tab ' + tabActiveAdventure + '" onclick="openHallOfFame(\'adventure\')">⚔️ 모험왕</div>' +
        '</div>';

    const descText = tabType === 'reading'
        ? '가장 많은 지혜를 탐구한 위대한 모험가들입니다.<br><span style="font-size:0.9em; color:#888;">※ 순위 기준: 1. 독서록 편수 / 2. 캐릭터 레벨</span>'
        : '도전의 탑에서 한계를 돌파한 위대한 모험가들입니다.<br><span style="font-size:0.9em; color:#888;">※ 순위 기준: 1. 탑 도달 층수 / 2. 캐릭터 레벨 / 3. 장비 점수</span>';

    // 4. 모달 내부 덮어쓰기
    const modalContent = document.querySelector('#hofModal .modal-content');
    modalContent.innerHTML =
        '<span class="close-btn" onclick="document.getElementById(\'hofModal\').style.display=\'none\'">×</span>' +
        '<h2 style="color:#FFD700; margin-top:0; font-size:2em; text-shadow: 0 0 15px rgba(255,215,0,0.5);">👑 명예의 전당</h2>' +
        tabHtml +
        '<p style="color:#aaa;">' + descText + '</p>' +
        '<div id="hofPodium" class="podium-container">' +
        podiumHtml +
        '</div>' +
        '<button class="btn-main" style="background:#444; margin-top:40px;" onclick="document.getElementById(\'hofModal\').style.display=\'none\'">닫기</button>';

    document.getElementById('hofModal').style.display = 'flex';
}

// 비밀번호 입력용 커스텀 팝업
function showUiPrompt(title, message, onConfirmCode, maxLength = 6) {
    document.getElementById('uiPopupTitle').innerHTML = title;
    document.getElementById('uiPopupMessage').innerHTML = message + '<br><br><input type="password" id="uiPopupInput" class="num-input" maxlength="' + maxLength + '" style="width:80%; background:#111; color:#fff; border:1px solid var(--Highlight);">';
    let confirmScript = "this.disabled=true; let val = document.getElementById('uiPopupInput').value; closeUiPopup(); " + onConfirmCode;
    document.getElementById('uiPopupButtons').innerHTML =
        '<button style="flex:1; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeUiPopup()">취소</button>' +
        '<button id="uiPopupConfirmBtn" style="flex:1; padding:12px; border-radius:10px; border:none; background:#4d94ff; color:white; font-weight:bold; font-size:1.1em; cursor:pointer;" onclick="' + confirmScript + '">확인</button>';
    document.getElementById('uiPopup').style.display = 'flex';

    setTimeout(() => {
        const inputEl = document.getElementById('uiPopupInput');
        inputEl.focus();
        inputEl.addEventListener("keypress", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                document.getElementById('uiPopupConfirmBtn').click();
            }
        });
    }, 100);
}

// ==========================================
// 📜 모험가 길드 (학생 모드)
// ==========================================
function openStudentQuestBoard() {
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = 'var(--Bg)';
    subModal.querySelector('.modal-content').style.borderColor = '#8B5CF6';
    subModal.style.display = 'flex';

    renderStudentQuestBoard();
}

function renderStudentQuestBoard() {
    const subBody = document.getElementById('subModalBody');

    // 현재 진행 중인(active) 퀘스트만 필터링 (최신순 역순 정렬)
    const activeQuests = questsData.filter(q => String(q.is_active).toLowerCase() === 'true').reverse();

    let listHtml = '';
    if (activeQuests.length === 0) {
        listHtml = '<div style="color:var(--TextSub); padding:40px 20px; font-size:1.1em; text-align:center;">현재 등록된 의뢰가 없습니다.</div>';
    } else {
        listHtml = activeQuests.map(q => {
            if (!q.quest_id) return '';

            // 💡 [수정] submissionsData 빈 값 방어
            const safeSubmissions = submissionsData || [];

            let mySubs = safeSubmissions.filter(s => String(s.quest_id) === String(q.quest_id) && String(s.student_name) === currentStudent.name);
            // 💡 [핵심 해결] 백엔드 데이터 순서와 무관하게 '최신 날짜'를 무조건 1순위로 가져오도록 정렬합니다.
            mySubs.sort((a, b) => {
                const timeA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
                const timeB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
                return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
            });
            let mySub = mySubs.length > 0 ? mySubs[0] : undefined;

            // 💡 [신규] 퀘스트 반복 주기(일일, 주간, 월간) 판별 로직
            if (mySub && q.repeat_cycle !== '1회성' && mySub.submitted_at) {
                const subDate = new Date(mySub.submitted_at);
                const today = new Date();
                let isSameCycle = false;

                if (q.repeat_cycle === '일일반복') {
                    isSameCycle = subDate.getDate() === today.getDate() && subDate.getMonth() === today.getMonth() && subDate.getFullYear() === today.getFullYear();
                } else if (q.repeat_cycle === '주간반복') {
                    const getMonday = function (d) {
                        const date = new Date(d);
                        const day = date.getDay();
                        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                        return new Date(date.setDate(diff)).setHours(0, 0, 0, 0);
                    };
                    isSameCycle = getMonday(subDate) === getMonday(today);
                } else if (q.repeat_cycle === '월반복') {
                    isSameCycle = subDate.getMonth() === today.getMonth() && subDate.getFullYear() === today.getFullYear();
                } else {
                    isSameCycle = true;
                }

                if (!isSameCycle) mySub = undefined;
            }

            let statusText = '미제출';
            let statusColor = 'var(--TextLock)';
            let statusBg = 'var(--BgLock)';

            if (mySub) {
                statusText = mySub.status; // 시트에 기록된 상태 가져오기
                // 상태에 따른 뱃지 색상 변경
                if (statusText === '제출완료' || statusText === '승인대기' || statusText === '진행중') {
                    statusText = '승인 대기중 ⏳'; // 텍스트를 학생에게 친절하게 변경
                    statusColor = '#D97706'; // 주황색
                    statusBg = '#FEF3C7';
                } else if (statusText === '승인완료') {
                    statusText = '승인 완료 ✅';
                    statusColor = '#059669'; // 초록색
                    statusBg = '#D1FAE5';
                }
            }

            let repeatBadge = '';
            if (q.repeat_cycle && q.repeat_cycle !== '1회성') {
                repeatBadge = '<span style="background:#3B82F6; color:white; padding:2px 6px; border-radius:4px; font-size:0.75em; margin-right:6px; vertical-align:middle;">' + q.repeat_cycle + '</span>';
            }

            return '<div style="background:var(--Bg); border:1px solid var(--BorderColor); border-radius:10px; padding:15px; margin-bottom:12px; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:0.2s; box-shadow:0 2px 4px rgba(0,0,0,0.05);" onclick="showStudentQuestDetail(\'' + q.quest_id + '\')" onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 4px 8px rgba(0,0,0,0.1)\'" onmouseout="this.style.transform=\'none\'; this.style.boxShadow=\'0 2px 4px rgba(0,0,0,0.05)\'">' +
                '  <div style="flex:1;">' +
                '    <div style="font-weight:bold; color:var(--TextMain); font-size:1.1em; margin-bottom:6px; display:flex; align-items:center;">' + repeatBadge + q.title + '</div>' +
                '    <div style="display:flex; gap:10px; font-size:0.85em;">' +
                '      <span style="color:#D97706; font-weight:bold;">💰 ' + q.reward_gold + ' ' + (sysConfig.game_money_currency || '골드') + '</span>' +
                '      <span style="color:#059669; font-weight:bold;">⭐ ' + q.reward_point + ' pt</span>' +
                '      <span style="color:#60A5FA; font-weight:bold;">✨ ' + (q.reward_exp || 0) + ' EXP</span>' +
                '    </div>' +
                '  </div>' +
                '  <div style="background:' + statusBg + '; color:' + statusColor + '; padding:5px 10px; border-radius:15px; font-size:0.8em; font-weight:bold; text-align:center; min-width:60px;">' + statusText + '</div>' +
                '</div>';
        }).join('');
    }

    subBody.innerHTML =
        '<h2 style="color:var(--TextGold); margin-bottom: 5px;">📜 길드 의뢰소</h2>' +
        '<p style="color:var(--TextSub); font-size:0.9em; margin-bottom:20px;">모험가 길드에서 온 의뢰를 완수하고 보상을 받으세요!</p>' +
        '<div style="max-height:450px; overflow-y:auto; padding-right:5px; padding-bottom:10px;">' + listHtml + '</div>' +
        '<button style="margin-top:15px; width:100%; padding:15px; border-radius:10px; border:none; background:var(--TextSub); color:white; font-size:1.1em; cursor:pointer;" onclick="closeSubModal()">닫기</button>';
}

function showStudentQuestDetail(questId) {
    const q = questsData.find(x => String(x.quest_id) === questId);
    if (!q) return;

    const safeSubmissions = submissionsData || [];

    let mySubs = safeSubmissions.filter(s => String(s.quest_id) === String(q.quest_id) && String(s.student_name) === currentStudent.name);
    // 💡 [핵심 해결] 백엔드 데이터 순서와 무관하게 '최신 날짜'를 무조건 1순위로 가져오도록 정렬합니다.
    mySubs.sort((a, b) => {
        const timeA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const timeB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    let mySub = mySubs.length > 0 ? mySubs[0] : undefined;

    // 💡 [신규] 퀘스트 반복 주기(일일, 주간, 월간) 판별 로직
    if (mySub && q.repeat_cycle !== '1회성' && mySub.submitted_at) {
        const subDate = new Date(mySub.submitted_at);
        const today = new Date();
        let isSameCycle = false;

        if (q.repeat_cycle === '일일반복') {
            isSameCycle = subDate.getDate() === today.getDate() && subDate.getMonth() === today.getMonth() && subDate.getFullYear() === today.getFullYear();
        } else if (q.repeat_cycle === '주간반복') {
            const getMonday = function (d) {
                const date = new Date(d);
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                return new Date(date.setDate(diff)).setHours(0, 0, 0, 0);
            };
            isSameCycle = getMonday(subDate) === getMonday(today);
        } else if (q.repeat_cycle === '월반복') {
            isSameCycle = subDate.getMonth() === today.getMonth() && subDate.getFullYear() === today.getFullYear();
        } else {
            isSameCycle = true;
        }

        if (!isSameCycle) mySub = undefined;
    }

    // 💡 [수정] 제출완료(=승인 대기중)이거나 승인완료일 경우 모두 수정 불가!
    const isSubmitted = mySub && (mySub.status === '제출완료' || mySub.status === '승인완료' || mySub.status === '승인 대기중 ⏳' || mySub.status === '승인 완료 ✅');
    const isApproved = mySub && (mySub.status === '승인완료' || mySub.status === '승인 완료 ✅');
    const isRequireText = String(q.require_text).toLowerCase() === 'true';

    let myAnswer = mySub ? mySub.answer_text : '';

    let inputHtml = '';
    if (isSubmitted) {
        // 💡 이미 제출했다면 텍스트를 읽기 전용으로만 표시
        const ansDisp = myAnswer ? String(myAnswer).replace(/[\n\r]/g, '<br>') : '(제출한 텍스트가 없습니다)';
        let btnMsg = isApproved ? '✅ 이미 승인된 의뢰입니다' : '⏳ 승인 대기 중... (수정 불가)';
        let btnBg = isApproved ? '#059669' : '#D97706';

        inputHtml = '<div style="background:var(--BgLock); padding:15px; border-radius:8px; border:1px solid var(--BorderColor); color:var(--TextMain); margin-bottom:20px; font-size:0.95em; line-height:1.5;">' + ansDisp + '</div>' +
            '<button class="btn-main" style="background:' + btnBg + '; cursor:default;" disabled>' + btnMsg + '</button>';
    } else {
        // 아직 미제출 상태
        if (isRequireText) {
            inputHtml = '<textarea id="studentQAnswer" placeholder="의뢰에 대한 답변이나 성찰 일지를 여기에 작성해주세요." style="width:100%; box-sizing:border-box; height:120px; padding:15px; margin-bottom:20px; border-radius:8px; border:1px solid var(--BorderColor); background:white; color:var(--TextMain); resize:vertical; font-size:0.95em; line-height:1.5; font-family:inherit;">' + myAnswer + '</textarea>';
        } else {
            inputHtml = '<div style="color:var(--TextSub); font-size:0.9em; margin-bottom:20px; text-align:center;">(이 의뢰는 별도의 텍스트 제출이 필요하지 않습니다)</div>';
        }
        const isAuto = String(q.is_auto_approve).toLowerCase() === 'true';
        if (isAuto) {
            // 💡 마지막 파라미터로 isRequireText(텍스트 필수 여부)를 추가 전달합니다.
            inputHtml += '<button class="btn-main" style="background:var(--Yellow); color:black; font-weight:bold; font-size:1.1em; padding:15px; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.4);" onclick="autoCompleteStudentQuest(\'' + q.quest_id + '\', ' + q.reward_gold + ', ' + q.reward_point + ', ' + (q.reward_exp || 0) + ', ' + isRequireText + ')">💰 즉시 완료하고 보상받기</button>';
        } else {
            inputHtml += '<button class="btn-main" style="background:#8B5CF6; color:white; font-size:1.1em; padding:15px;" onclick="submitStudentQuest(\'' + q.quest_id + '\', ' + isRequireText + ')">🚀 의뢰 완수 보고하기</button>';
        }
    }

    const descFormatted = String(q.description).replace(/[\n\r]/g, '<br>');

    let repeatBadge = '';
    if (q.repeat_cycle && q.repeat_cycle !== '1회성') {
        repeatBadge = '<span style="background:#3B82F6; color:white; padding:3px 8px; border-radius:4px; font-size:0.65em; margin-right:8px; vertical-align:middle;">' + q.repeat_cycle + '</span>';
    }

    document.getElementById('subModalBody').innerHTML =
        '<div style="text-align:left;">' +
        '  <button class="small-btn" style="background:var(--TextSub); margin-bottom:15px;" onclick="renderStudentQuestBoard()">⬅ 목록으로 돌아가기</button>' +
        '  <h2 style="color:var(--TextMain); margin:0 0 10px 0; font-size:1.4em; display:flex; align-items:center;">' + repeatBadge + q.title + '</h2>' +
        '  <div style="display:flex; gap:10px; margin-bottom:15px;">' +
        '    <span style="color:#D97706; font-weight:bold; font-size:0.9em;">💰 ' + q.reward_gold + ' ' + (sysConfig.game_money_currency || '골드') + '</span>' +
        '    <span style="color:#059669; font-weight:bold; font-size:0.9em;">⭐ ' + q.reward_point + ' pt</span>' +
        '    <span style="color:#60A5FA; font-weight:bold; font-size:0.9em;">✨ ' + (q.reward_exp || 0) + ' EXP</span>' +
        '  </div>' +
        '  <div style="background:var(--Bg); padding:15px; border-radius:8px; border:1px solid var(--BorderColor); color:var(--TextSub); margin-bottom:20px; font-size:0.95em; line-height:1.6;">' + descFormatted + '</div>' +
        '  <h4 style="color:var(--TextGold); margin-bottom:10px;">' + (isRequireText ? '✍️ 나의 기록' : '완수 보고') + '</h4>' +
        '  ' + inputHtml +
        '</div>';
}

function submitStudentQuest(questId, isRequireText) {
    let answerText = '';
    if (isRequireText) {
        answerText = document.getElementById('studentQAnswer').value.trim();
        if (!answerText) {
            return showUiAlert("⚠️ 알림", "내용을 작성해주세요!", "");
        }
    }

    showGlobalLoading("📜 퀘스트 보고서 제출 중...");

    if (!window.submissionsData) window.submissionsData = [];
    const newSub = {
        quest_id: questId,
        student_name: currentStudent.name,
        status: '제출완료',
        answer_text: answerText,
        submitted_at: new Date().toISOString()
    };

    const existingIdx = window.submissionsData.findIndex(s => String(s.quest_id) === String(questId) && String(s.student_name) === currentStudent.name);
    if (existingIdx > -1) window.submissionsData[existingIdx] = newSub;
    else window.submissionsData.push(newSub);

    fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/submissions.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.submissionsData)
    }).then(() => {
        hideGlobalLoading();
        showUiAlert("🎉 제출 완료!", "길드에 성공적으로 보고되었습니다!<br>선생님의 승인을 기다려주세요.", "openStudentQuestBoard()");
    }).catch(err => {
        hideGlobalLoading();
        showUiAlert("❌ 제출 실패", err);
    });
}

function autoCompleteStudentQuest(questId, rewardGold, rewardPoint, rewardExp, isRequireText) {
    let answerText = "일일 퀘스트 자동 완수";

    // 💡 텍스트가 필수인 의뢰라면 화면에서 작성한 글을 긁어옵니다.
    if (isRequireText) {
        answerText = document.getElementById('studentQAnswer').value.trim();
        if (!answerText) {
            return showUiAlert("⚠️ 알림", "내용을 작성해주세요!", "");
        }
    }

    showGlobalLoading("💰 의뢰 완수 및 보상 수령 중...");

    currentStudent.game_money = (Number(currentStudent.game_money) || 0) + Number(rewardGold);
    currentStudent.bonus_points = (Number(currentStudent.bonus_points) || 0) + Number(rewardPoint);
    currentStudent.exp = (Number(currentStudent.exp) || 0) + Number(rewardExp);
    renderDashboard();

    currentStudent.quest_count = (Number(currentStudent.quest_count) || 0) + 1;

    // 레벨업 수동 체크
    const expMax = Number(sysConfig.exp_max) || 200;
    const pointsPerLevel = Number(sysConfig.points_per_level) || 3;
    let leveledUp = false;
    while (currentStudent.exp >= expMax) {
        currentStudent.exp -= expMax;
        currentStudent.level = (Number(currentStudent.level) || 1) + 1;
        currentStudent.level_points = (Number(currentStudent.level_points) || 0) + pointsPerLevel;
        leveledUp = true;
    }

    renderDashboard();

    if (!window.submissionsData) window.submissionsData = [];
    const newSub = {
        quest_id: questId,
        student_name: currentStudent.name,
        status: '승인완료',
        answer_text: answerText,
        submitted_at: new Date().toISOString()
    };

    const existingIdx = window.submissionsData.findIndex(s => String(s.quest_id) === String(questId) && String(s.student_name) === currentStudent.name);
    if (existingIdx > -1) window.submissionsData[existingIdx] = newSub;
    else window.submissionsData.push(newSub);

    Promise.all([
        updateFastFirebaseStudent(currentStudent),
        fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/submissions.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.submissionsData)
        })
    ]).then(() => {
        hideGlobalLoading();
        const gameCurrency = sysConfig.game_money_currency || '골드';
        if (leveledUp) {
            showUiAlert("🎊 의뢰 완수 & 레벨 업!!", "보상으로 <b>" + rewardGold + " " + gameCurrency + "</b>, <b>" + rewardPoint + " pt</b>, <b>" + rewardExp + " EXP</b>를 획득했습니다!<br><br>레벨이 <b>" + currentStudent.level + "</b>(으)로 올랐습니다!", "openStudentQuestBoard()");
        } else {
            showUiAlert("🎉 의뢰 완수!", "보상으로 <b>" + rewardGold + " " + gameCurrency + "</b>, <b>" + rewardPoint + " pt</b>, <b>" + rewardExp + " EXP</b>를 즉시 획득했습니다.", "openStudentQuestBoard()");
        }
    }).catch(err => {
        hideGlobalLoading();
        showUiAlert("❌ 통신 오류", err);
    });
}

// 1. [학생/공통] 공지사항 게시판 열기 (리스트 형태)
function openNoticeBoard() {
    const activeNotices = noticesData.filter(n => String(n.is_active).toLowerCase() === 'true');

    // 로그인 상태라면 읽음 처리 점검
    if (currentStudent && activeNotices.length > 0) {
        const latestNoticeId = activeNotices[activeNotices.length - 1].notice_id;
        if (String(currentStudent.last_read_notice) !== String(latestNoticeId)) {
            document.getElementById('noticeBadge').style.display = 'none';
            currentStudent.last_read_notice = latestNoticeId;
            updateFastFirebaseStudent(currentStudent);
        }
    }

    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = 'var(--Bg)';
    subModal.querySelector('.modal-content').style.borderColor = '#F87171';

    let listHtml = '';
    if (activeNotices.length === 0) {
        listHtml = '<div style="color:var(--TextSub); padding:40px 20px; text-align:center;">등록된 소식이 없습니다.</div>';
    } else {
        // 최신순으로 정렬하여 제목만 리스트업
        listHtml = activeNotices.slice().reverse().map(n => {
            const dateStr = n.date ? new Date(n.date).toLocaleDateString() : '';
            let catColor = '#3B82F6';
            if (n.category === '이벤트') catColor = '#F59E0B';
            else if (n.category === '긴급') catColor = '#EF4444';

            return '<div style="background:var(--Bg); border:1px solid var(--BorderColor); border-radius:10px; padding:15px; margin-bottom:10px; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:0.2s;" onclick="showNoticeDetail(\'' + n.notice_id + '\')" onmouseover="this.style.backgroundColor=\'#FFF1F1\'" onmouseout="this.style.backgroundColor=\'var(--Bg)\'">' +
                '  <div style="flex:1;">' +
                '    <span style="color:' + catColor + '; font-weight:bold; font-size:0.85em; margin-right:5px;">[' + n.category + ']</span>' +
                '    <span style="font-weight:bold; color:var(--TextMain);">' + n.title + '</span>' +
                '  </div>' +
                '  <div style="color:var(--TextLock); font-size:0.8em; margin-left:10px;">' + dateStr + '</div>' +
                '</div>';
        }).join('');
    }

    subBody.innerHTML =
        '<h2 style="color:#F87171; margin-bottom: 5px;">📢 길드 게시판</h2>' +
        '<p style="color:var(--TextSub); font-size:0.9em; margin-bottom:20px;">알림을 클릭하여 상세 내용을 확인하세요.</p>' +
        '<div style="max-height:450px; overflow-y:auto; padding-right:5px; padding-bottom:10px;">' + listHtml + '</div>' +
        '<button style="margin-top:15px; width:100%; padding:15px; border-radius:10px; border:none; background:var(--TextSub); color:white; font-size:1.1em; cursor:pointer;" onclick="closeSubModal()">닫기</button>';

    subModal.style.display = 'flex';
}

// 💡 [신규] 공지사항 개별 상세 정보 팝업
function showNoticeDetail(noticeId) {
    const n = noticesData.find(x => String(x.notice_id) === String(noticeId));
    if (!n) return;

    const contentFormatted = String(n.content).replace(/[\n\r]/g, '<br>');
    const dateStr = n.date ? new Date(n.date).toLocaleDateString() : '';

    let detailHtml =
        '<div style="text-align:left;">' +
        '  <div style="font-size:0.9em; color:var(--TextLock); margin-bottom:5px;">' + dateStr + ' 소식</div>' +
        '  <h3 style="margin:0 0 15px 0; color:white; border-bottom:2px solid #F87171; padding-bottom:10px;">' + n.title + '</h3>' +
        '  <div style="background:var(--Bg); padding:20px; border-radius:10px; color:var(--TextSub); line-height:1.7; min-height:100px; max-height:40vh; overflow-y:auto; font-size:1.05em; word-break:break-all;">' + contentFormatted + '</div>' +
        '</div>';

    // 게임 UI 팝업(showUiAlert)을 활용하여 상세 내용 표시
    showUiAlert('📜 상세 내용', detailHtml, 'openNoticeBoard()');
}