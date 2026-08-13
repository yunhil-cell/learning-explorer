// ==========================================
// 🔒 교사 모드 시스템 (메인 화면 배치 및 유지)
// ==========================================
let isTeacherMode = false;
let teacherModeTimer = null;

// 💡 버튼 UI를 실시간으로 업데이트하는 헬퍼 함수
function updateTeacherBtnUI() {
    const btn = document.getElementById('mainTeacherBtn');
    const questBtn = document.getElementById('questAdminBtn');
    const noticeBtn = document.getElementById('noticeAdminBtn');
    const exchangeBtn = document.getElementById('exchangeAdminBtn');
    if (!btn) return;
    if (isTeacherMode) {
        btn.style.background = '#ff4d4d';
        btn.innerHTML = '🔓 교사 모드 ON';
        if (questBtn) questBtn.style.display = 'block';
        if (noticeBtn) noticeBtn.style.display = 'block';
        if (exchangeBtn) exchangeBtn.style.display = 'block';
    } else {
        btn.style.background = '#444';
        btn.innerHTML = '🔒 교사 모드 OFF';
        if (questBtn) questBtn.style.display = 'none';
        if (noticeBtn) noticeBtn.style.display = 'none';
        if (exchangeBtn) exchangeBtn.style.display = 'none';
    }
}

function disableTeacherMode() {
    isTeacherMode = false;
    clearTimeout(teacherModeTimer);
    updateTeacherBtnUI();

    const subModal = document.getElementById('subModal');
    if (subModal.style.display === 'flex' && (document.getElementById('subModalBody').innerHTML.includes('길드 관리소') || document.getElementById('subModalBody').innerHTML.includes('환전소'))) {
        subModal.style.display = 'none';
    }
}

// ==========================================
// 💱 동적 환전소 시스템 (교사 전용)
// ==========================================
function openExchangeAdmin() {
    if (!checkTeacherAuth()) return;
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = '#0F172A';
    subModal.querySelector('.modal-content').style.borderColor = '#10B981';

    const gameCurrency = sysConfig.game_money_currency || '골드';
    const realCurrency = sysConfig.currency_name || '티';
    const exchangeRate = Number(sysConfig.exchange_rate) || 10;

    let html = '<h2 style="color:#10B981; margin-bottom: 5px;">💱 환전소 (교사 전용)</h2>' +
        '<p style="color:#CBD5E1; font-size:0.9em; margin-bottom:15px;">게임 재화(' + gameCurrency + ')를 현실 재화(' + realCurrency + ')로 ' + exchangeRate + ':1 교환해줍니다.</p>' +
        '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:10px; max-height:400px; overflow-y:auto; padding-right:5px;">';

    window.allStudentsData.forEach(s => {
        if (!s.name) return;
        const money = Number(s.game_money) || 0;
        const maxExchange = Math.floor(money / exchangeRate);

        html += '<div style="background:#1E293B; border:1px solid #334155; padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">' +
            '  <div>' +
            '    <div style="color:white; font-weight:bold; font-size:1.1em; margin-bottom:5px;">' + s.name + '</div>' +
            '    <div style="color:#FBBF24; font-size:0.9em;">보유: ' + money + ' ' + gameCurrency + '</div>' +
            '  </div>' +
            '  <button class="small-btn" style="background:#10B981; color:white; border:none; padding:8px 12px;" onclick="promptExchange(\'' + s.name + '\', ' + money + ', ' + maxExchange + ')">환전하기</button>' +
            '</div>';
    });

    html += '</div><button style="margin-top:20px; width:100%; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeSubModal()">닫기</button>';

    subBody.innerHTML = html;
    subModal.style.display = 'flex';
}

function promptExchange(studentName, currentMoney, maxExchange) {
    const gameCurrency = sysConfig.game_money_currency || '골드';
    const realCurrency = sysConfig.currency_name || '티';
    const exchangeRate = Number(sysConfig.exchange_rate) || 10;

    if (maxExchange <= 0) {
        showUiAlert("⚠️ 환전 불가", studentName + " 학생은 환전할 최소 금액(" + exchangeRate + gameCurrency + ")이 부족합니다.", "");
        return;
    }

    showUiPrompt("💱 환전 진행", studentName + " 학생에게 현실에서 지급할 <b>" + realCurrency + "</b> 개수를 적어주세요.<br><span style='font-size:0.8em; color:var(--TextLock);'>(최대 " + maxExchange + realCurrency + " 가능 / 1" + realCurrency + " 당 " + exchangeRate + gameCurrency + " 차감)</span>", "processExchange('" + studentName + "', val, " + maxExchange + ")", 3);
}

function processExchange(studentName, val, maxExchange) {
    const exchangeAmount = Number(val);
    if (isNaN(exchangeAmount) || exchangeAmount <= 0) {
        showUiAlert("❌ 오류", "올바른 숫자를 입력해주세요.", "openExchangeAdmin()");
        return;
    }
    if (exchangeAmount > maxExchange) {
        showUiAlert("❌ 한도 초과", "최대 " + maxExchange + "개까지만 환전 가능합니다.", "openExchangeAdmin()");
        return;
    }

    const exchangeRate = Number(sysConfig.exchange_rate) || 10;
    const cost = exchangeAmount * exchangeRate;
    const gameCurrency = sysConfig.game_money_currency || '골드';
    const realCurrency = sysConfig.currency_name || '티';

    const targetStudent = window.allStudentsData.find(s => s.name === studentName);

    // 💡 [신규 방어 로직] 환전 직전 한 번 더 잔액 확인!
    const currentMoney = targetStudent ? (Number(targetStudent.game_money) || 0) : 0;
    if (currentMoney < cost) {
        showUiAlert("❌ 한도 초과", "환전할 잔액이 부족합니다.", "openExchangeAdmin()");
        return;
    }

    if (targetStudent) {
        targetStudent.game_money = currentMoney - cost;
    }

    if (currentStudent && currentStudent.name === studentName) {
        currentStudent.game_money = targetStudent.game_money;
        if (document.getElementById('detailModal').style.display === 'flex') {
            renderDashboard();
        }
    }

    showUiAlert("🎉 환전 완료", studentName + " 학생의 " + cost + gameCurrency + "를 차감했습니다.<br><br><b style='color:#10B981; font-size:1.2em;'>" + exchangeAmount + realCurrency + "</b>를 오프라인에서 지급해주세요!", "openExchangeAdmin()");

    updateFastFirebaseStudent(targetStudent);
}

// 💡 2. 교사 모드 토글 (안내 문구 변경)
function toggleTeacherMode() {
    if (isTeacherMode) {
        disableTeacherMode();
        showUiAlert('🔒 교사 모드 종료', '교사 모드가 수동으로 잠금되었습니다.', '');
    } else {
        // 교사 PIN 입력 창 호출
        showUiPrompt('🔒 교사 모드', '교사용 PIN 번호 <b>6자리</b>를 입력하세요.', 'checkTeacherPin(val)', 6);
    }
}

// 💡 3. 교사 핀번호 검증 로직 (! 제거 처리 추가)
function checkTeacherPin(inputPin) {
    // 시트에 저장된 값(예: !090909)에서 '!'를 떼어내고 순수 숫자만 추출합니다.
    const correctPin = String(sysConfig.teacher_PIN || '!123456').replace('!', '').trim();

    if (inputPin === correctPin) {
        isTeacherMode = true;
        updateTeacherBtnUI(); // UI 즉시 빨간색으로 변경
        showUiAlert('🔓 승인 완료', '교사 모드가 활성화되었습니다.<br><span style="font-size:0.8em; color:#aaa;">(학생들의 장비를 강화할 수 있습니다.<br>마지막 동작 후 5분 뒤 자동 잠금)</span>', '');

        clearTimeout(teacherModeTimer);
        teacherModeTimer = setTimeout(disableTeacherMode, 300000); // 300초 타이머 시작
    } else {
        showUiAlert('❌ 오류', 'PIN 번호가 일치하지 않습니다.', '');
    }
}

// 재화 소모 전 권한을 체크하는 함수
function checkTeacherAuth() {
    if (isTeacherMode) {
        // 교사 모드일 때 강화를 누르면, 그 순간부터 다시 타이머 5분 연장!
        clearTimeout(teacherModeTimer);
        teacherModeTimer = setTimeout(disableTeacherMode, 300000);
        return true;
    } else {
        // 권한이 없으면 메인 화면에서 켜고 오라고 안내
        showUiAlert('🔒 권한 부족', '먼저 메인 화면 우측 상단의<br><b>교사 모드</b>를 켜주세요!', '');
        return false;
    }
}

// ==========================================
// 📜 모험가 길드 (퀘스트/성찰일지) 관리자 모드
// ==========================================
if (typeof window.questsData === 'undefined') window.questsData = [];
if (typeof window.submissionsData === 'undefined') window.submissionsData = [];
if (typeof window.noticesData === 'undefined') window.noticesData = [];

function openQuestAdmin() {
    if (!checkTeacherAuth()) return;
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = '#0F172A';
    subModal.querySelector('.modal-content').style.borderColor = '#8B5CF6';
    subModal.style.display = 'flex';

    renderQuestAdmin('create');
}

function renderQuestAdmin(tab, selectedQuestId = null, selectedStudent = null) {
    const subBody = document.getElementById('subModalBody');
    const safeSubmissions = submissionsData || []; // 💡 빈 데이터 에러 완벽 방어

    let tabsHtml =
        '<div style="display:flex; margin-bottom:15px; border-bottom:1px solid #334155; font-size:0.9em;">' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'list' ? '#A78BFA' : '#9CA3AF') + '; border-bottom:' + (tab === 'list' ? '3px solid #A78BFA' : 'none') + ';" onclick="renderQuestAdmin(\'list\')">의뢰 목록/채점</div>' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'create' ? '#A78BFA' : '#9CA3AF') + '; border-bottom:' + (tab === 'create' ? '3px solid #A78BFA' : 'none') + ';" onclick="renderQuestAdmin(\'create\')">새 의뢰 등록</div>' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'student' ? '#A78BFA' : '#9CA3AF') + '; border-bottom:' + (tab === 'student' ? '3px solid #A78BFA' : 'none') + ';" onclick="renderQuestAdmin(\'student\')">학생별 모아보기</div>' +
        '</div>';

    let contentHtml = '';

    // 💡 1. 퀘스트 생성 탭 (2분할 레이아웃 적용 및 EXP 보상 추가)
    if (tab === 'create') {
        contentHtml =
            '<div style="display:flex; gap:20px; text-align:left; color:#E2E8F0;">' +
            // 📦 좌측 패널 (의뢰 내용 및 조건)
            '  <div style="flex:1; background:#1E293B; padding:20px; border-radius:10px; display:flex; flex-direction:column;">' +
            '    <h3 style="color:#A78BFA; margin:0 0 15px 0; border-bottom:1px solid #334155; padding-bottom:10px;">📝 의뢰 내용</h3>' +
            '    <label style="font-weight:bold; color:#A78BFA;">의뢰 제목</label>' +
            '    <input type="text" id="newQTitle" placeholder="예: 오늘 배운 나눗셈 요약하기" style="width:100%; box-sizing:border-box; padding:12px; margin:8px 0 15px 0; border-radius:8px; border:1px solid #334155; background:#0F172A; color:white; font-size:1em;">' +
            '    <label style="font-weight:bold; color:#A78BFA;">상세 설명 (조건)</label>' +
            '    <textarea id="newQDesc" placeholder="학생들이 무엇을 적어야 하는지 자세히 안내해주세요." style="width:100%; box-sizing:border-box; height:120px; padding:12px; margin:8px 0 15px 0; border-radius:8px; border:1px solid #334155; background:#0F172A; color:white; resize:none; font-size:1em; font-family:inherit;"></textarea>' +
            '    <label style="display:flex; align-items:center; gap:10px; cursor:pointer; background:#0F172A; padding:15px; border-radius:8px; border:1px solid #334155; transition:0.2s; margin-bottom:10px;" onmouseover="this.style.borderColor=\'#8B5CF6\'" onmouseout="this.style.borderColor=\'#334155\'">' +
            '      <input type="checkbox" id="newQReq" checked style="width:20px; height:20px; accent-color:#8B5CF6; cursor:pointer;"> ' +
            '      <span style="font-size:0.95em; color:#E2E8F0;">학생이 직접 <b style="color:#A78BFA;">텍스트(성찰일지)</b>를 작성해야 하는 의뢰입니까?</span>' +
            '    </label>' +
            '    <label style="display:flex; align-items:center; gap:10px; cursor:pointer; background:#0F172A; padding:15px; border-radius:8px; border:1px solid #334155; transition:0.2s;" onmouseover="this.style.borderColor=\'#10B981\'" onmouseout="this.style.borderColor=\'#334155\'">' +
            '      <input type="checkbox" id="newQAuto" style="width:20px; height:20px; accent-color:#10B981; cursor:pointer;"> ' +
            '      <span style="font-size:0.95em; color:#E2E8F0;">교사 승인 없이 <b style="color:#34D399;">학생 스스로 완료(자동 승인)</b> 가능한 의뢰입니까?</span>' +
            '    </label>' +
            '  </div>' +
            // 📦 우측 패널 (보상 및 시스템 설정)
            '  <div style="flex:1; background:#1E293B; padding:20px; border-radius:10px; display:flex; flex-direction:column;">' +
            '    <h3 style="color:#FBBF24; margin:0 0 15px 0; border-bottom:1px solid #334155; padding-bottom:10px;">🎁 보상 및 설정</h3>' +
            '    <div style="display:flex; gap:15px; margin-bottom:15px;">' +
            '      <div style="flex:1;"><label style="font-weight:bold; color:#FBBF24;">보상 ' + (sysConfig.game_money_currency || '골드') + '</label><br><input type="number" id="newQGold" value="30" style="width:100%; box-sizing:border-box; padding:12px; margin-top:8px; border-radius:8px; border:1px solid #334155; background:#0F172A; color:#FBBF24; font-weight:bold; font-size:1.1em; text-align:center;"></div>' +
            '      <div style="flex:1;"><label style="font-weight:bold; color:#34D399;">보상 포인트</label><br><input type="number" id="newQPoint" value="1" style="width:100%; box-sizing:border-box; padding:12px; margin-top:8px; border-radius:8px; border:1px solid #334155; background:#0F172A; color:#34D399; font-weight:bold; font-size:1.1em; text-align:center;"></div>' +
            '      <div style="flex:1;"><label style="font-weight:bold; color:#60A5FA;">보상 EXP</label><br><input type="number" id="newQExp" value="10" style="width:100%; box-sizing:border-box; padding:12px; margin-top:8px; border-radius:8px; border:1px solid #334155; background:#0F172A; color:#60A5FA; font-weight:bold; font-size:1.1em; text-align:center;"></div>' +
            '    </div>' +
            '    <label style="font-weight:bold; color:#A78BFA;">반복 주기</label>' +
            '    <select id="newQRepeat" style="width:100%; padding:12px; margin:8px 0 15px 0; border-radius:8px; border:1px solid #334155; background:#0F172A; color:white; font-size:1em; cursor:pointer;">' +
            '      <option value="1회성">1회성 (반복 없음)</option>' +
            '      <option value="일일반복">일일 반복</option>' +
            '      <option value="주간반복">주간 반복</option>' +
            '      <option value="월반복">월 반복</option>' +
            '    </select>' +
            '    <div style="margin-top:auto;">' +
            '      <button class="btn-main" style="width:100%; background:#8B5CF6; color:white; font-size:1.2em; padding:15px; border:none; cursor:pointer; transition:0.2s; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.4);" onclick="createNewQuestAction()" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">🚀 새로운 의뢰 등록하기</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';
    }
    // 💡 2. 의뢰 목록 및 채점 탭
    else if (tab === 'list') {
        if (!questsData || questsData.length === 0) {
            contentHtml = '<div style="color:#9CA3AF; padding:20px;">등록된 퀘스트가 없습니다.</div>';
        } else if (!selectedQuestId) {
            let listHtml = questsData.slice().reverse().map(q => {
                if (!q.quest_id) return '';
                const isActive = String(q.is_active).toLowerCase() === 'true';
                const statusBadge = isActive ? '<span style="background:var(--Green); color:black; padding:2px 8px; border-radius:10px; font-size:0.7em;">진행중</span>' : '<span style="background:#444; color:#ccc; padding:2px 8px; border-radius:10px; font-size:0.7em;">마감됨</span>';
                return '<div style="background:#1E293B; border:1px solid #334155; border-radius:8px; padding:15px; margin-bottom:10px; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="renderQuestAdmin(\'list\', \'' + q.quest_id + '\')">' +
                    '  <div><div style="font-weight:bold; color:white; font-size:1.1em; margin-bottom:5px;">' + q.title + '</div>' + statusBadge + '</div>' +
                    '  <div style="color:#A78BFA; font-size:1.5em;">➔</div>' +
                    '</div>';
            }).join('');
            contentHtml = '<div style="max-height:400px; overflow-y:auto; padding-right:5px;">' + listHtml + '</div>';
        } else {
            const q = questsData.find(x => String(x.quest_id) === selectedQuestId);
            const isQActive = String(q.is_active).toLowerCase() === 'true';
            const activeAction = isQActive ? 'toggleQuestStatus(\'' + q.quest_id + '\', false)' : 'toggleQuestStatus(\'' + q.quest_id + '\', true)';
            const activeBtnText = isQActive ? '🛑 퀘스트 마감하기' : '🟢 퀘스트 다시 열기';
            const activeBtnColor = isQActive ? '#EF4444' : '#34D399';

            const subs = safeSubmissions.filter(s => String(s.quest_id) === String(q.quest_id));

            let subHtml = '';
            if (subs.length === 0) {
                subHtml = '<div style="color:#64748B; margin-top:20px;">아직 제출한 학생이 없습니다.</div>';
            } else {
                subHtml = subs.map(s => {
                    const isApproved = s.status === '승인완료';
                    const badgeColor = isApproved ? 'var(--Highlight)' : 'var(--Yellow)';
                    const btnText = isApproved ? '승인 취소' : '승인 및 보상지급';
                    const btnColor = isApproved ? '#444' : '#8B5CF6';
                    const nextStatus = isApproved ? '제출완료' : '승인완료';

                    const ansText = String(s.answer_text || '(텍스트 없음)').replace(/[\n\r]/g, '<br>');

                    return '<div style="background:#0F172A; border:1px solid #334155; border-radius:8px; padding:15px; margin-top:10px; text-align:left;">' +
                        '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">' +
                        '    <div><b style="color:white; font-size:1.1em;">' + s.student_name + '</b> <span style="background:' + badgeColor + '; color:black; padding:2px 8px; border-radius:10px; font-size:0.7em; font-weight:bold; margin-left:5px;">' + s.status + '</span></div>' +
                        '    <button class="small-btn" style="background:' + btnColor + '; padding:8px 12px; font-size:0.9em; border:none;" onclick="updateSubStatus(\'' + q.quest_id + '\', \'' + s.student_name + '\', \'' + nextStatus + '\', ' + q.reward_gold + ', ' + q.reward_point + ')">' + btnText + '</button>' +
                        '  </div>' +
                        '  <div style="color:#CBD5E1; font-size:0.95em; line-height:1.5; background:#1E293B; padding:10px; border-radius:5px;">' + ansText + '</div>' +
                        '</div>';
                }).join('');
            }

            contentHtml =
                '<div style="text-align:left;">' +
                '  <button class="small-btn" style="background:#334155; margin-bottom:15px;" onclick="renderQuestAdmin(\'list\')">⬅ 목록으로 돌아가기</button>' +
                '  <div style="background:#1E293B; padding:20px; border-radius:10px; border-left:4px solid #A78BFA; margin-bottom:20px;">' +
                '    <h3 style="color:white; margin:0 0 10px 0;">' + q.title + '</h3>' +
                '    <p style="color:#CBD5E1; margin:0 0 15px 0; font-size:0.9em;">' + String(q.description).replace(/[\n\r]/g, '<br>') + '</p>' +
                '    <div style="display:flex; gap:10px;">' +
                '      <span style="color:#FBBF24; font-weight:bold; font-size:0.9em;">💰 ' + q.reward_gold + ' ' + (sysConfig.game_money_currency || '골드') + '</span>' +
                '      <span style="color:#34D399; font-weight:bold; font-size:0.9em;">⭐ ' + q.reward_point + ' pt</span>' +
                '    </div>' +
                '    <button style="margin-top:15px; background:' + activeBtnColor + '; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;" onclick="' + activeAction + '">' + activeBtnText + '</button>' +
                '  </div>' +
                '  <h4 style="color:#A78BFA; margin-bottom:10px;">제출 현황</h4>' +
                '  <div style="max-height:300px; overflow-y:auto; padding-right:5px;">' + subHtml + '</div>' +
                '</div>';
        }
    }
    // 💡 3. 학생별 모아보기 탭
    else if (tab === 'student') {
        if (!window.allStudentsData || window.allStudentsData.length === 0) {
            contentHtml = '<div style="color:#9CA3AF; padding:20px;">학생 데이터가 없습니다.</div>';
        } else if (!selectedStudent) {
            let stuBtns = window.allStudentsData.map(s => {
                if (!s.name) return '';
                // 💡 안전한 배열로 계산
                const subCount = safeSubmissions.filter(sub => String(sub.student_name) === String(s.name)).length;
                return '<button style="background:#1E293B; color:white; border:1px solid #334155; padding:15px; border-radius:10px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between;" onclick="renderQuestAdmin(\'student\', null, \'' + s.name + '\')">' +
                    '  <span>' + s.name + '</span>' +
                    '  <span style="color:#A78BFA; font-size:0.8em;">📝 ' + subCount + '건</span>' +
                    '</button>';
            }).join('');
            contentHtml = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; max-height:400px; overflow-y:auto; padding-right:5px;">' + stuBtns + '</div>';
        } else {
            const subs = safeSubmissions.filter(s => String(s.student_name) === String(selectedStudent));
            let historyHtml = '';

            if (subs.length === 0) {
                historyHtml = '<div style="color:#64748B; margin-top:20px;">아직 제출한 퀘스트가 없습니다.</div>';
            } else {
                historyHtml = subs.slice().reverse().map(s => {
                    const qInfo = questsData.find(q => String(q.quest_id) === String(s.quest_id));
                    const qTitle = qInfo ? qInfo.title : "삭제된 퀘스트";
                    const badgeColor = s.status === '승인완료' ? 'var(--Highlight)' : '#444';
                    const ansText = String(s.answer_text || '').replace(/[\n\r]/g, '<br>');
                    let dateStr = "날짜 알 수 없음";
                    if (s.submitted_at) {
                        const d = new Date(s.submitted_at);
                        dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    }

                    return '<div style="background:#0F172A; border-left:4px solid ' + badgeColor + '; border-radius:4px 8px 8px 4px; padding:15px; margin-bottom:15px; text-align:left;">' +
                        '  <div style="font-size:0.8em; color:#9CA3AF; margin-bottom:5px;">' + dateStr + '</div>' +
                        '  <div style="font-weight:bold; color:white; font-size:1.1em; margin-bottom:10px;">Q. ' + qTitle + '</div>' +
                        '  <div style="color:#CBD5E1; font-size:0.95em; line-height:1.5;">' + ansText + '</div>' +
                        '</div>';
                }).join('');
            }

            contentHtml =
                '<div style="text-align:left;">' +
                '  <button class="small-btn" style="background:#334155; margin-bottom:15px;" onclick="renderQuestAdmin(\'student\')">⬅ 학생 목록으로</button>' +
                '  <h3 style="color:var(--Yellow); margin:0 0 15px 0;">🧑‍🎓 ' + selectedStudent + '의 모험 기록</h3>' +
                '  <div style="max-height:350px; overflow-y:auto; padding-right:5px;">' + historyHtml + '</div>' +
                '</div>';
        }
    }

    subBody.innerHTML = '<h2 style="color:#A78BFA; margin-bottom: 5px;">📜 길드 관리소</h2><p style="color:#CBD5E1; font-size:0.9em; margin-bottom:15px;">교사 전용 퀘스트 및 성찰일지 대시보드</p>' + tabsHtml + contentHtml + '<button style="margin-top:20px; width:100%; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeSubModal()">닫기</button>';
}

function createNewQuestAction() {
    const title = document.getElementById('newQTitle').value.trim();
    const desc = document.getElementById('newQDesc').value.trim();
    const gold = Number(document.getElementById('newQGold').value) || 0;
    const point = Number(document.getElementById('newQPoint').value) || 0;
    const exp = Number(document.getElementById('newQExp').value) || 0;
    const req = document.getElementById('newQReq').checked;
    const isAuto = document.getElementById('newQAuto').checked;
    const repeatCycle = document.getElementById('newQRepeat').value;

    if (!title) return showUiAlert("⚠️ 경고", "의뢰 제목을 입력해주세요!", "");

    const btn = document.querySelector('#subModalBody .btn-main');
    btn.innerText = "⏳ 등록 중...";
    btn.disabled = true;
    btn.style.background = "#555";

    if (!window.questsData) window.questsData = [];
    const newQuest = {
        quest_id: 'Q' + new Date().getTime(),
        title: title,
        description: desc,
        require_text: req,
        reward_gold: gold,
        reward_exp: exp,
        reward_point: point,
        is_active: true,
        is_auto_approve: isAuto,
        repeat_cycle: repeatCycle
    };
    window.questsData.push(newQuest);

    fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/quests.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.questsData)
    }).then(() => {
        showUiAlert("🎉 등록 완료!", "새로운 의뢰가 길드 게시판에 등록되었습니다.", "openQuestAdmin()");
    }).catch(err => {
        showUiAlert("❌ 등록 실패", err);
    });
}

// 💡 퀘스트 활성화/마감 토글
function toggleQuestStatus(questId, isActive) {
    const q = questsData.find(x => String(x.quest_id) === String(questId));
    if (q) q.is_active = isActive;

    fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/quests.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.questsData)
    }).then(() => {
        renderQuestAdmin('list');
    });
}

// 💡 학생 제출물 승인/취소 (승인 시 보상 지급 로직 포함)
function updateSubStatus(questId, studentName, newStatus, rewardGold, rewardPoint) {
    const safeSubmissions = submissionsData || [];
    const sub = safeSubmissions.find(s => String(s.quest_id) === String(questId) && String(s.student_name) === String(studentName));
    if (sub) sub.status = newStatus;

    const q = questsData.find(x => String(x.quest_id) === String(questId));
    const rewardExp = q ? (Number(q.reward_exp) || 0) : 0;

    if (newStatus === '승인완료') {
        const targetStudent = window.allStudentsData.find(x => x.name === studentName);
        if (targetStudent) {
            targetStudent.bonus_points = (Number(targetStudent.bonus_points) || 0) + Number(rewardPoint);
            targetStudent.game_money = (Number(targetStudent.game_money) || 0) + Number(rewardGold);
            targetStudent.exp = (Number(targetStudent.exp) || 0) + Number(rewardExp);
        }
    } else if (newStatus === '제출완료') {
        const targetStudent = window.allStudentsData.find(x => x.name === studentName);
        if (targetStudent) {
            targetStudent.bonus_points = Math.max(0, (Number(targetStudent.bonus_points) || 0) - Number(rewardPoint));
            targetStudent.game_money = Math.max(0, (Number(targetStudent.game_money) || 0) - Number(rewardGold));
            targetStudent.exp = Math.max(0, (Number(targetStudent.exp) || 0) - Number(rewardExp));
        }
    }

    const targetStudent = window.allStudentsData.find(x => x.name === studentName);
    let leveledUp = false;

    if (newStatus === '승인완료' && targetStudent) {
        targetStudent.quest_count = (Number(targetStudent.quest_count) || 0) + 1;
        const expMax = Number(sysConfig.exp_max) || 200;
        const pointsPerLevel = Number(sysConfig.points_per_level) || 3;
        while (targetStudent.exp >= expMax) {
            targetStudent.exp -= expMax;
            targetStudent.level = (Number(targetStudent.level) || 1) + 1;
            targetStudent.level_points = (Number(targetStudent.level_points) || 0) + pointsPerLevel;
            leveledUp = true;
        }
    } else if (newStatus === '제출완료' && targetStudent) {
        targetStudent.quest_count = Math.max(0, (Number(targetStudent.quest_count) || 0) - 1);
    }

    renderQuestAdmin('list', questId);

    Promise.all([
        updateFastFirebaseStudent(targetStudent),
        fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/submissions.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.submissionsData)
        })
    ]).then(() => {
        if (leveledUp) {
            showUiAlert("🎉 승인 및 레벨업 완료", studentName + " 학생이 의뢰 보상을 받고 <b>Lv." + targetStudent.level + "</b>(으)로 레벨 업 했습니다!", "");
        }
    });
}

// 2. [교사 전용] 공지사항 관리 UI 열기
function openNoticeAdmin() {
    if (!checkTeacherAuth()) return;
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = '#0F172A';
    subModal.querySelector('.modal-content').style.borderColor = '#3B82F6';
    subModal.style.display = 'flex';

    renderNoticeAdmin('create');
}

function renderNoticeAdmin(tab) {
    const subBody = document.getElementById('subModalBody');

    let tabsHtml =
        '<div style="display:flex; margin-bottom:15px; border-bottom:1px solid #334155; font-size:0.9em;">' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'create' ? '#60A5FA' : '#9CA3AF') + '; border-bottom:' + (tab === 'create' ? '3px solid #60A5FA' : 'none') + ';" onclick="renderNoticeAdmin(\'create\')">새 공지 등록</div>' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'list' ? '#60A5FA' : '#9CA3AF') + '; border-bottom:' + (tab === 'list' ? '3px solid #60A5FA' : 'none') + ';" onclick="renderNoticeAdmin(\'list\')">공지 목록 관리</div>' +
        '</div>';

    let contentHtml = '';

    if (tab === 'create') {
        contentHtml =
            '<div style="text-align:left; color:#E2E8F0; background:#1E293B; padding:20px; border-radius:10px;">' +
            '  <label style="font-weight:bold; color:#60A5FA;">분류 (카테고리)</label><br>' +
            '  <select id="newNCategory" style="width:100%; padding:12px; margin:8px 0 15px 0; border-radius:8px; border:1px solid #334155; background:#0F172A; color:white; font-size:1em;">' +
            '    <option value="업데이트">업데이트 (패치노트)</option><option value="이벤트">이벤트 (특별 행사)</option><option value="긴급">긴급 (중요 안내)</option><option value="안내">일반 안내</option>' +
            '  </select><br>' +
            '  <label style="font-weight:bold; color:#60A5FA;">공지 제목</label><br>' +
            '  <input type="text" id="newNTitle" placeholder="예: 1.1 패치노트 안내" style="width:100%; box-sizing:border-box; padding:12px; margin:8px 0 15px 0; border-radius:8px; border:1px solid #334155; background:#0F172A; color:white; font-size:1em;"><br>' +
            '  <label style="font-weight:bold; color:#60A5FA;">상세 내용 (줄바꿈 가능)</label><br>' +
            '  <textarea id="newNContent" placeholder="학생들에게 공지할 내용을 작성해주세요." style="width:100%; box-sizing:border-box; height:150px; padding:12px; margin:8px 0 15px 0; border-radius:8px; border:1px solid #334155; background:#0F172A; color:white; resize:vertical; font-size:1em; font-family:inherit;"></textarea><br>' +
            '  <button class="btn-main" style="background:#3B82F6; color:white; font-size:1.2em; padding:15px; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.4);" onclick="createNewNoticeAction()">📢 공지사항 게시하기</button>' +
            '</div>';
    } else if (tab === 'list') {
        if (!noticesData || noticesData.length === 0) {
            contentHtml = '<div style="color:#9CA3AF; padding:20px;">등록된 공지사항이 없습니다.</div>';
        } else {
            let listHtml = noticesData.slice().reverse().map(n => {
                if (!n.notice_id) return '';
                const isActive = String(n.is_active).toLowerCase() === 'true';
                const statusBadge = isActive ? '<span style="background:var(--Green); color:black; padding:2px 8px; border-radius:10px; font-size:0.7em;">게시중</span>' : '<span style="background:#444; color:#ccc; padding:2px 8px; border-radius:10px; font-size:0.7em;">숨김</span>';
                const activeAction = isActive ? 'toggleNoticeStatus(\'' + n.notice_id + '\', false)' : 'toggleNoticeStatus(\'' + n.notice_id + '\', true)';
                const activeBtnText = isActive ? '숨기기' : '다시 게시';
                const activeBtnColor = isActive ? '#EF4444' : '#34D399';

                return '<div style="background:#1E293B; border:1px solid #334155; border-radius:8px; padding:15px; margin-bottom:10px; text-align:left; display:flex; justify-content:space-between; align-items:center;">' +
                    '  <div>' +
                    '    <div style="font-weight:bold; color:white; font-size:1.1em; margin-bottom:5px;">[' + n.category + '] ' + n.title + '</div>' +
                    '    <div style="font-size:0.8em; color:#9CA3AF; margin-bottom:5px;">작성일: ' + (n.date ? new Date(n.date).toLocaleDateString() : '') + '</div>' +
                    '    ' + statusBadge +
                    '  </div>' +
                    '  <div style="display:flex; gap:5px;">' +
                    '    <button class="small-btn" style="background:' + activeBtnColor + '; padding:8px 12px; font-size:0.9em; border:none;" onclick="' + activeAction + '">' + activeBtnText + '</button>' +
                    '    <button class="small-btn" style="background:#64748B; padding:8px 12px; font-size:0.9em; border:none;" onclick="deleteNoticePrompt(\'' + n.notice_id + '\')">삭제</button>' +
                    '  </div>' +
                    '</div>';
            }).join('');
            contentHtml = '<div style="max-height:400px; overflow-y:auto; padding-right:5px;">' + listHtml + '</div>';
        }
    }

    subBody.innerHTML = '<h2 style="color:#60A5FA; margin-bottom: 5px;">📢 공지사항 관리</h2><p style="color:#CBD5E1; font-size:0.9em; margin-bottom:15px;">교사 전용 공지사항 대시보드</p>' + tabsHtml + contentHtml + '<button style="margin-top:20px; width:100%; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1.1em; cursor:pointer;" onclick="closeSubModal()">닫기</button>';
}

function createNewNoticeAction() {
    const category = document.getElementById('newNCategory').value;
    const title = document.getElementById('newNTitle').value.trim();
    const content = document.getElementById('newNContent').value.trim();

    if (!title || !content) return showUiAlert("⚠️ 경고", "제목과 내용을 모두 입력해주세요!", "");

    const btn = document.querySelector('#subModalBody .btn-main');
    btn.innerText = "⏳ 등록 중...";
    btn.disabled = true;
    btn.style.background = "#555";

    if (!window.noticesData) window.noticesData = [];
    const newNotice = {
        notice_id: 'N' + new Date().getTime(),
        date: new Date().toISOString().split('T')[0],
        category: category,
        title: title,
        content: content,
        is_active: true
    };
    window.noticesData.push(newNotice);

    fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/notices.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.noticesData)
    }).then(() => {
        showUiAlert("🎉 등록 완료!", "새로운 공지사항이 게시되었습니다.", "openNoticeAdmin()");
    }).catch(err => {
        showUiAlert("❌ 등록 실패", err);
    });
}

function toggleNoticeStatus(noticeId, isActive) {
    const n = noticesData.find(x => String(x.notice_id) === String(noticeId));
    if (n) n.is_active = isActive;

    fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/notices.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.noticesData)
    }).then(() => {
        renderNoticeAdmin('list');
    });
}

// 💡 [신규] 공지사항 삭제 프롬프트 및 실행
function deleteNoticePrompt(noticeId) {
    showUiConfirm("⚠️ 공지 삭제", "이 공지사항을 완전히 삭제하시겠습니까?<br><span style='font-size:0.8em; color:#aaa;'>(시트에서도 영구 삭제됩니다)</span>", "executeDeleteNotice('" + noticeId + "')");
}

function executeDeleteNotice(noticeId) {
    window.noticesData = (noticesData || []).filter(x => String(x.notice_id) !== String(noticeId));

    fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/notices.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.noticesData)
    }).then(() => {
        showUiAlert("🗑️ 삭제 완료!", "공지사항이 영구적으로 삭제되었습니다.", "openNoticeAdmin()");
    }).catch(err => {
        showUiAlert("❌ 삭제 실패", err);
    });
}