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
    const statBtn = document.getElementById('statAdminBtn');
    const logBtn = document.getElementById('logAdminBtn');
    if (!btn) return;
    if (isTeacherMode) {
        btn.style.background = '#ff4d4d';
        btn.innerHTML = '🔓 교사 모드 ON';
        if (questBtn) questBtn.style.display = 'block';
        if (noticeBtn) noticeBtn.style.display = 'block';
        if (exchangeBtn) exchangeBtn.style.display = 'block';
        if (statBtn) statBtn.style.display = 'block';
        if (logBtn) logBtn.style.display = 'block';
    } else {
        btn.style.background = '#444';
        btn.innerHTML = '🔒 교사 모드 OFF';
        if (questBtn) questBtn.style.display = 'none';
        if (noticeBtn) noticeBtn.style.display = 'none';
        if (exchangeBtn) exchangeBtn.style.display = 'none';
        if (statBtn) statBtn.style.display = 'none';
        if (logBtn) logBtn.style.display = 'none';
    }
}

function disableTeacherMode() {
    isTeacherMode = false;
    clearTimeout(teacherModeTimer);
    updateTeacherBtnUI();

    const subModal = document.getElementById('subModal');
    if (subModal.style.display === 'flex' && (document.getElementById('subModalBody').innerHTML.includes('길드 관리소') || document.getElementById('subModalBody').innerHTML.includes('환전소') || document.getElementById('subModalBody').innerHTML.includes('학급 통계'))) {
        subModal.style.display = 'none';
    }
}

// ==========================================
// 📊 학급 통계 대시보드 시스템 (교사 전용)
// ==========================================
function openClassroomDashboard(tab = 'overview') {
    if (!checkTeacherAuth()) return;
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = '#0F172A';
    subModal.querySelector('.modal-content').style.borderColor = '#0D9488';
    subModal.style.display = 'flex';

    renderClassroomDashboard(tab);
}

function renderClassroomDashboard(tab = 'overview') {
    const subBody = document.getElementById('subModalBody');
    const students = window.allStudentsData || [];
    const subs = window.submissionsData || [];
    const sys = sysConfig || {};
    const gameCurrency = sys.game_money_currency || '골드';
    const realCurrency = sys.currency_name || '티';

    // 💡 1. 핵심 요약 지표 계산
    const totalStudents = students.filter(s => s && s.name).length;
    const totalBooks = students.reduce((sum, s) => sum + (Number(s.reading_count) || 0), 0);
    const avgBooks = totalStudents > 0 ? (totalBooks / totalStudents).toFixed(1) : 0;
    
    // 🎯 목표 권수(goal_count) 달성 학생 집계
    const goalCount = Number(sys.goal_count) || 20;
    const achievedStudents = students.filter(s => s && s.name && (Number(s.reading_count) || 0) >= goalCount);
    const achievedCount = achievedStudents.length;
    const achievedPct = totalStudents > 0 ? Math.round((achievedCount / totalStudents) * 100) : 0;

    const levels = students.map(s => Number(s.level) || 1);
    const maxLevel = levels.length > 0 ? Math.max(...levels) : 1;
    const minLevel = levels.length > 0 ? Math.min(...levels) : 1;
    const avgLevel = levels.length > 0 ? (levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1) : 1;

    const totalGold = students.reduce((sum, s) => sum + (Number(s.game_money) || 0), 0);

    // 💡 [개선] 현재 '진행 중(활성화)'인 퀘스트의 ID만 추출하여 해당 퀘스트의 미채점 건수만 정확히 집계
    const activeQuestIds = (window.questsData || [])
        .filter(q => q && String(q.is_active).toLowerCase() === 'true')
        .map(q => String(q.quest_id));

    const unapprovedSubs = subs.filter(s => s && s.status === '제출완료' && activeQuestIds.includes(String(s.quest_id)));
    const unapprovedCount = unapprovedSubs.length;

    // 미환전 현실 재화(RM) 교환권 수량 집계
    let totalPendingRM = 0;
    const studentRMMap = [];
    students.forEach(s => {
        if (!s.name) return;
        const inv = String(s.inventory || '');
        const matches = inv.matchAll(/\[현실 재화\]\s*(\d+).*?교환권/g);
        let sRM = 0;
        for (const m of matches) {
            sRM += Number(m[1]) || 0;
        }
        if (sRM > 0) {
            studentRMMap.push({ name: s.name, rm: sRM });
            totalPendingRM += sRM;
        }
    });

    // 💡 2. 상단 4종 요약 카드 HTML (목표 권수 달성 비율 표기)
    const summaryCardsHtml =
        '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom:15px;">' +
        '  <div style="background:#1E293B; border:1px solid #334155; border-radius:10px; padding:12px; text-align:center;">' +
        '    <div style="font-size:0.8em; color:#94A3B8;">📚 누적 독서 편수</div>' +
        '    <div style="font-size:1.4em; font-weight:bold; color:#38BDF8; margin:4px 0;">' + totalBooks + '<span style="font-size:0.6em; color:#94A3B8;">편</span></div>' +
        '    <div style="font-size:0.75em; color:#CBD5E1;">목표(' + goalCount + '권) 달성: <b style="color:#34D399;">' + achievedCount + '/' + totalStudents + '명 (' + achievedPct + '%)</b></div>' +
        '    <div style="width:100%; background:#334155; height:5px; border-radius:3px; margin-top:6px; overflow:hidden;"><div style="width:' + achievedPct + '%; background:#34D399; height:100%;"></div></div>' +
        '  </div>' +
        '  <div style="background:#1E293B; border:1px solid #334155; border-radius:10px; padding:12px; text-align:center;">' +
        '    <div style="font-size:0.8em; color:#94A3B8;">⚔️ 학급 평균 레벨</div>' +
        '    <div style="font-size:1.4em; font-weight:bold; color:#FBBF24; margin:4px 0;">Lv.' + avgLevel + '</div>' +
        '    <div style="font-size:0.75em; color:#CBD5E1;">최고 Lv.' + maxLevel + ' / 최저 Lv.' + minLevel + '</div>' +
        '  </div>' +
        '  <div style="background:#1E293B; border:1px solid #334155; border-radius:10px; padding:12px; text-align:center;">' +
        '    <div style="font-size:0.8em; color:#94A3B8;">💰 총 유통 골드</div>' +
        '    <div style="font-size:1.4em; font-weight:bold; color:#34D399; margin:4px 0;">' + totalGold.toLocaleString() + '</div>' +
        '    <div style="font-size:0.75em; color:#CBD5E1;">대기 RM: <b style="color:#10B981;">' + totalPendingRM + realCurrency + '</b></div>' +
        '  </div>' +
        '  <div style="background:#1E293B; border:1px solid ' + (unapprovedCount > 0 ? '#EF4444' : '#334155') + '; border-radius:10px; padding:12px; text-align:center; cursor:pointer;" onclick="openQuestAdmin(\'list\')">' +
        '    <div style="font-size:0.8em; color:#94A3B8;">📝 미채점 성찰일지</div>' +
        '    <div style="font-size:1.4em; font-weight:bold; color:' + (unapprovedCount > 0 ? '#EF4444' : '#94A3B8') + '; margin:4px 0;">' + unapprovedCount + '<span style="font-size:0.6em;">건</span></div>' +
        '    <div style="font-size:0.75em; color:#A78BFA;">[클릭 시 채점 이동 ➔]</div>' +
        '  </div>' +
        '</div>';

    // 💡 3. 탭 네비게이션
    const tabsHtml =
        '<div style="display:flex; margin-bottom:15px; border-bottom:1px solid #334155; font-size:0.9em;">' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'overview' ? '#2DD4BF' : '#9CA3AF') + '; border-bottom:' + (tab === 'overview' ? '3px solid #2DD4BF' : 'none') + ';" onclick="renderClassroomDashboard(\'overview\')">🚨 맞춤 케어 알림</div>' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'growth' ? '#2DD4BF' : '#9CA3AF') + '; border-bottom:' + (tab === 'growth' ? '3px solid #2DD4BF' : 'none') + ';" onclick="renderClassroomDashboard(\'growth\')">📚 독서 & 성장 분석</div>' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'economy' ? '#2DD4BF' : '#9CA3AF') + '; border-bottom:' + (tab === 'economy' ? '3px solid #2DD4BF' : 'none') + ';" onclick="renderClassroomDashboard(\'economy\')">💰 경제 & 아이템 현황</div>' +
        '</div>';

    let contentHtml = '';

    // ─────────────────────────────────────────
    // [탭 1] 🚨 맞춤 케어 알림 (Teacher Actionable Alert)
    // ─────────────────────────────────────────
    if (tab === 'overview') {
        const now = new Date().getTime();
        const injuredStudents = students.filter(s => s && s.name && s.penalty_end_time && Number(s.penalty_end_time) > now);
        const zeroBookStudents = students.filter(s => s && s.name && (!s.reading_count || Number(s.reading_count) === 0));

        let alertsHtml = '';

        // 1. 미채점 알림
        if (unapprovedCount > 0) {
            const studentNames = [...new Set(unapprovedSubs.map(sub => sub.student_name))].slice(0, 5).join(', ');
            alertsHtml +=
                '<div style="background:#1E293B; border-left:4px solid #EF4444; border-radius:6px; padding:12px 15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">' +
                '  <div>' +
                '    <div style="color:#EF4444; font-weight:bold; font-size:1em; margin-bottom:3px;">📝 승인 대기 중인 성찰일지가 있습니다! (' + unapprovedCount + '건)</div>' +
                '    <div style="color:#CBD5E1; font-size:0.85em;">제출 학생: ' + studentNames + (unapprovedSubs.length > 5 ? ' 외' : '') + '</div>' +
                '  </div>' +
                '  <button class="small-btn" style="background:#EF4444; color:white; border:none; padding:8px 12px;" onclick="openQuestAdmin(\'list\')">채점하기</button>' +
                '</div>';
        }

        // 2. 미환전 RM 교환권 보유 알림
        if (totalPendingRM > 0) {
            alertsHtml +=
                '<div style="background:#1E293B; border-left:4px solid #10B981; border-radius:6px; padding:12px 15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">' +
                '  <div>' +
                '    <div style="color:#10B981; font-weight:bold; font-size:1em; margin-bottom:3px;">💱 미환전 현실 재화 교환권 누적: 총 ' + totalPendingRM + realCurrency + '</div>' +
                '    <div style="color:#CBD5E1; font-size:0.85em;">보유 학생 ' + studentRMMap.length + '명이 오프라인 보상 지급을 대기 중입니다.</div>' +
                '  </div>' +
                '  <button class="small-btn" style="background:#10B981; color:white; border:none; padding:8px 12px;" onclick="openExchangeAdmin()">환전소 열기</button>' +
                '</div>';
        }

        // 3. 부상 / 패널티 학생 알림
        if (injuredStudents.length > 0) {
            const injuredNames = injuredStudents.map(s => {
                const remainMs = Number(s.penalty_end_time) - now;
                const remainH = Math.floor(remainMs / (1000 * 60 * 60));
                const remainM = Math.floor((remainMs % (1000 * 60 * 60)) / (1000 * 60));
                return s.name + ' (' + remainH + '시간 ' + remainM + '분)';
            }).join(', ');

            alertsHtml +=
                '<div style="background:#1E293B; border-left:4px solid #3B82F6; border-radius:6px; padding:12px 15px; margin-bottom:10px;">' +
                '  <div style="color:#60A5FA; font-weight:bold; font-size:1em; margin-bottom:3px;">🩹 부상 / 패널티 회복 중인 모험가 (' + injuredStudents.length + '명)</div>' +
                '  <div style="color:#CBD5E1; font-size:0.85em;">' + injuredNames + '</div>' +
                '</div>';
        }

        // 4. 독서 0권 학생 알림
        if (zeroBookStudents.length > 0) {
            const zeroNames = zeroBookStudents.map(s => s.name).join(', ');
            alertsHtml +=
                '<div style="background:#1E293B; border-left:4px solid #F59E0B; border-radius:6px; padding:12px 15px; margin-bottom:10px;">' +
                '  <div style="color:#FBBF24; font-weight:bold; font-size:1em; margin-bottom:3px;">⚠️ 독서록 작성이 필요한 학생 (' + zeroBookStudents.length + '명)</div>' +
                '  <div style="color:#CBD5E1; font-size:0.85em;">' + zeroNames + '</div>' +
                '</div>';
        }

        if (!alertsHtml) {
            alertsHtml = '<div style="color:#94A3B8; padding:30px 10px; text-align:center; background:#1E293B; border-radius:10px;">🎉 현재 즉시 조치가 필요한 특이사항이 없습니다. 학급이 매우 원활히 운영되고 있습니다!</div>';
        }

        contentHtml =
            '<div style="text-align:left;">' +
            '  <h4 style="color:#2DD4BF; margin:0 0 10px 0;">🔔 교사 맞춤 실시간 알림</h4>' +
            '  <div style="max-height:360px; overflow-y:auto; padding-right:5px;">' + alertsHtml + '</div>' +
            '</div>';
    }

    // ─────────────────────────────────────────
    // [탭 2] 📚 독서 & 성장 분석
    // ─────────────────────────────────────────
    else if (tab === 'growth') {
        // 독서 순위 TOP 5
        const sortedByBooks = [...students].filter(s => s && s.name).sort((a, b) => (Number(b.reading_count) || 0) - (Number(a.reading_count) || 0));
        const top5Books = sortedByBooks.slice(0, 5);

        // 가호 분포 계산
        const blessingCount = { Red: 0, Blue: 0, Green: 0, Yellow: 0, Purple: 0, None: 0 };
        students.forEach(s => {
            if (!s.name) return;
            const b = s.blessing || 'None';
            if (blessingCount[b] !== undefined) blessingCount[b]++;
            else blessingCount.None++;
        });

        // 탑 층수 TOP 5
        const sortedByTower = [...students].filter(s => s && s.name).sort((a, b) => (Number(b.max_tower_floor) || 0) - (Number(a.max_tower_floor) || 0));
        const top5Tower = sortedByTower.slice(0, 5);

        let top5BooksHtml = top5Books.map((s, idx) => {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const count = Number(s.reading_count) || 0;
            return '<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #334155; font-size:0.9em;">' +
                '  <span style="color:white;">' + (medals[idx] || '') + ' ' + s.name + '</span>' +
                '  <b style="color:#38BDF8;">' + count + '편 (Lv.' + (s.level || 1) + ')</b>' +
                '</div>';
        }).join('');

        let top5TowerHtml = top5Tower.map((s, idx) => {
            const floor = Number(s.max_tower_floor) || 0;
            return '<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #334155; font-size:0.9em;">' +
                '  <span style="color:white;">' + (idx + 1) + '. ' + s.name + '</span>' +
                '  <b style="color:#FBBF24;">' + floor + '층 정복</b>' +
                '</div>';
        }).join('');

        // 가호 바 그래프 계산
        const totalBlessingChosen = totalStudents - blessingCount.None;
        const getBlessingPct = (k) => totalBlessingChosen > 0 ? Math.round((blessingCount[k] / totalBlessingChosen) * 100) : 0;

        contentHtml =
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; text-align:left;">' +
            // 좌측: 독서 & 탑 랭킹
            '  <div style="background:#1E293B; border:1px solid #334155; border-radius:10px; padding:15px;">' +
            '    <div style="color:#38BDF8; font-weight:bold; margin-bottom:10px;">📖 독서 우수 모험가 TOP 5</div>' +
            '    ' + (top5BooksHtml || '<div style="color:#64748B;">기록 없음</div>') +
            '    <div style="color:#FBBF24; font-weight:bold; margin:15px 0 10px 0;">🗼 도전의 탑 랭킹 TOP 5</div>' +
            '    ' + (top5TowerHtml || '<div style="color:#64748B;">기록 없음</div>') +
            '  </div>' +
            // 우측: 가호 분포 & 스탯 성향
            '  <div style="background:#1E293B; border:1px solid #334155; border-radius:10px; padding:15px;">' +
            '    <div style="color:#2DD4BF; font-weight:bold; margin-bottom:12px;">✨ 가호(속성) 선택 분포</div>' +
            '    <div style="display:flex; height:18px; border-radius:6px; overflow:hidden; margin-bottom:10px; background:#334155;">' +
            '      <div style="width:' + getBlessingPct('Red') + '%; background:#EF4444;" title="용기(Red) ' + blessingCount.Red + '명"></div>' +
            '      <div style="width:' + getBlessingPct('Blue') + '%; background:#3B82F6;" title="지혜(Blue) ' + blessingCount.Blue + '명"></div>' +
            '      <div style="width:' + getBlessingPct('Green') + '%; background:#10B981;" title="끈기(Green) ' + blessingCount.Green + '명"></div>' +
            '      <div style="width:' + getBlessingPct('Yellow') + '%; background:#F59E0B;" title="행운(Yellow) ' + blessingCount.Yellow + '명"></div>' +
            '      <div style="width:' + getBlessingPct('Purple') + '%; background:#8B5CF6;" title="희망(Purple) ' + blessingCount.Purple + '명"></div>' +
            '    </div>' +
            '    <div style="font-size:0.8em; color:#CBD5E1; display:grid; grid-template-columns:1fr 1fr; gap:6px; line-height:1.4;">' +
            '      <div>🔴 용기(공격): ' + blessingCount.Red + '명 (' + getBlessingPct('Red') + '%)</div>' +
            '      <div>🔵 지혜(방어): ' + blessingCount.Blue + '명 (' + getBlessingPct('Blue') + '%)</div>' +
            '      <div>🟢 끈기(체력): ' + blessingCount.Green + '명 (' + getBlessingPct('Green') + '%)</div>' +
            '      <div>🟡 행운(행운): ' + blessingCount.Yellow + '명 (' + getBlessingPct('Yellow') + '%)</div>' +
            '      <div>🟣 희망(장막): ' + blessingCount.Purple + '명 (' + getBlessingPct('Purple') + '%)</div>' +
            '      <div>⚪ 미각성: ' + blessingCount.None + '명</div>' +
            '    </div>' +
            '  </div>' +
            '</div>';
    }

    // ─────────────────────────────────────────
    // [탭 3] 💰 경제 & 아이템 현황
    // ─────────────────────────────────────────
    else if (tab === 'economy') {
        // 골드 부자 순위
        const sortedByMoney = [...students].filter(s => s && s.name).sort((a, b) => (Number(b.game_money) || 0) - (Number(a.game_money) || 0));
        const top5Money = sortedByMoney.slice(0, 5);

        // 강화 실패 잔혹사 순위
        const sortedByForgeFail = [...students].filter(s => s && s.name).sort((a, b) => (Number(b.total_forge_fail) || 0) - (Number(a.total_forge_fail) || 0));
        const top5ForgeFail = sortedByForgeFail.filter(s => (Number(s.total_forge_fail) || 0) > 0).slice(0, 5);

        let top5MoneyHtml = top5Money.map((s, idx) => {
            const money = Number(s.game_money) || 0;
            return '<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #334155; font-size:0.9em;">' +
                '  <span style="color:white;">' + (idx + 1) + '. ' + s.name + '</span>' +
                '  <b style="color:#34D399;">' + money.toLocaleString() + ' ' + gameCurrency + '</b>' +
                '</div>';
        }).join('');

        let top5FailHtml = top5ForgeFail.map((s, idx) => {
            const fail = Number(s.total_forge_fail) || 0;
            return '<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #334155; font-size:0.9em;">' +
                '  <span style="color:white;">' + (idx + 1) + '. ' + s.name + '</span>' +
                '  <b style="color:#EF4444;">누적 ' + fail + '회 실패 💔</b>' +
                '</div>';
        }).join('');

        let rmListHtml = studentRMMap.slice(0, 6).map(item => {
            return '<div style="display:inline-block; background:#0F172A; border:1px solid #10B981; border-radius:6px; padding:4px 10px; margin:3px; font-size:0.85em; color:white;">' +
                item.name + ': <b style="color:#10B981;">' + item.rm + realCurrency + '</b>' +
                '</div>';
        }).join('');

        contentHtml =
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; text-align:left;">' +
            // 좌측: 골드 및 RM 보유 현황
            '  <div style="background:#1E293B; border:1px solid #334155; border-radius:10px; padding:15px;">' +
            '    <div style="color:#34D399; font-weight:bold; margin-bottom:10px;">💰 ' + gameCurrency + ' 보유 순위 TOP 5</div>' +
            '    ' + (top5MoneyHtml || '<div style="color:#64748B;">기록 없음</div>') +
            '    <div style="color:#10B981; font-weight:bold; margin:15px 0 8px 0;">💱 미환전 ' + realCurrency + ' 교환권 보유 명단</div>' +
            '    <div>' + (rmListHtml || '<span style="color:#64748B; font-size:0.85em;">현재 보유 학생 없음</span>') + '</div>' +
            '  </div>' +
            // 우측: 대장간 잔혹사
            '  <div style="background:#1E293B; border:1px solid #334155; border-radius:10px; padding:15px;">' +
            '    <div style="color:#EF4444; font-weight:bold; margin-bottom:10px;">🔨 대장간 강화 잔혹사 TOP 5</div>' +
            '    ' + (top5FailHtml || '<div style="color:#64748B; padding:10px 0;">아직 누적 실패 기록이 없습니다.</div>') +
            '    <div style="margin-top:15px; font-size:0.8em; color:#94A3B8; line-height:1.5; background:#0F172A; padding:10px; border-radius:6px;">' +
            '      💡 <b>인플레이션 관리 팁</b><br>총 유통 ' + gameCurrency + '가 과도하게 많을 경우, 상점의 소비 아이템 가격이나 대장간 비용을 조정하세요.' +
            '    </div>' +
            '  </div>' +
            '</div>';
    }

    subBody.innerHTML =
        '<h2 style="color:#2DD4BF; margin-bottom: 5px;">📊 학급 통계 대시보드</h2>' +
        '<p style="color:#CBD5E1; font-size:0.9em; margin-bottom:15px;">학급 전체의 독서, 레벨, 경제, 케어 필요 학생을 한눈에 파악합니다.</p>' +
        summaryCardsHtml +
        tabsHtml +
        contentHtml +
        '<div style="display:flex; gap:10px; margin-top:20px;">' +
        '  <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#EF4444; color:white; font-weight:bold; font-size:1em; cursor:pointer;" onclick="forceResetWeeklyBattlesAdmin()">🔄 주간 횟수 강제 초기화</button>' +
        '  <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1em; cursor:pointer;" onclick="closeSubModal()">닫기</button>' +
        '</div>';
}

// 💡 [교사 전용] 주간 횟수 수동 강제 초기화 실행 함수
function forceResetWeeklyBattlesAdmin() {
    showUiConfirm(
        "🔄 주간 횟수 초기화",
        "학급 전체 학생의 <b>사냥, 보스, 레이드, 도전의 탑 주간 횟수</b>를<br>설정된 최대치로 강제 초기화하시겠습니까?",
        "executeForceResetWeekly()"
    );
}

async function executeForceResetWeekly() {
    showGlobalLoading("🔄 주간 횟수 초기화 처리 중...");

    const maxBattles = Number(sysConfig.max_weekly_battles) || 2;
    const maxBoss = Number(sysConfig.max_weekly_boss) || 3;
    const maxRaid = Number(sysConfig.max_weekly_raid) || 1;
    const maxTower = Number(sysConfig.max_weekly_tower) || 1;

    const students = window.allStudentsData || [];
    students.forEach(s => {
        if (!s || !s.name) return;
        s.weekly_battles = maxBattles;
        s.weekly_boss = maxBoss;
        s.weekly_raid = maxRaid;
        s.weekly_tower = maxTower;
    });

    if (currentStudent) {
        currentStudent.weekly_battles = maxBattles;
        currentStudent.weekly_boss = maxBoss;
        currentStudent.weekly_raid = maxRaid;
        currentStudent.weekly_tower = maxTower;
    }

    const resetPayload = {
        weekly_battles: maxBattles,
        weekly_boss: maxBoss,
        weekly_raid: maxRaid,
        weekly_tower: maxTower
    };

    try {
        // 💡 [롤백 방어] 옛날 캐시로 학생 전체를 덮어쓰지 않고 주간 횟수 필드만 개별 PATCH
        const updatePromises = students.map(s => {
            if (!s || !s.name) return Promise.resolve();
            const sName = encodeURIComponent(String(s.name).trim());
            return fetch(`https://learning-explorer-default-rtdb.firebaseio.com/gameData/students/${sName}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resetPayload)
            });
        });
        await Promise.all(updatePromises);
        hideGlobalLoading();
        showUiAlert("🎉 초기화 완료", "전체 학생의 주간 횟수가 성공적으로 초기화되었습니다!", "renderClassroomDashboard('overview')");
        renderButtons(students);
    } catch(e) {
        hideGlobalLoading();
        showUiAlert("❌ 오류", "초기화 실패: " + e, "");
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
            const pendingSubs = subs.filter(s => s.status === '제출완료');

            // 💡 [신규] 일괄 승인 제어 툴바 HTML
            let batchBarHtml = '';
            if (pendingSubs.length > 0) {
                batchBarHtml =
                    '<div style="background:#1E293B; border:1px solid #8B5CF6; border-radius:8px; padding:10px 15px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">' +
                    '  <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:white; font-size:0.9em; font-weight:bold;">' +
                    '    <input type="checkbox" id="masterQuestChk" style="width:18px; height:18px; accent-color:#8B5CF6; cursor:pointer;" onchange="toggleAllQuestSubs(this)">' +
                    '    대기 중인 학생 전체 선택 (' + pendingSubs.length + '명)' +
                    '  </label>' +
                    '  <button id="batchApproveBtn" class="small-btn" style="background:#8B5CF6; color:white; padding:8px 16px; font-size:0.95em; font-weight:bold; opacity:0.5;" disabled onclick="batchApproveSelectedSubs(\'' + q.quest_id + '\')">🚀 선택한 0명 일괄 승인</button>' +
                    '</div>';
            }

            let subHtml = '';
            if (subs.length === 0) {
                subHtml = '<div style="color:#64748B; margin-top:20px;">아직 제출한 학생이 없습니다.</div>';
            } else {
                subHtml = subs.map(s => {
                    const isApproved = s.status === '승인완료';
                    const badgeColor = isApproved ? 'var(--Highlight)' : 'var(--Yellow)';
                    const btnText = isApproved ? '승인 취소' : '개별 승인';
                    const btnColor = isApproved ? '#444' : '#8B5CF6';
                    const nextStatus = isApproved ? '제출완료' : '승인완료';

                    // 미승인 학생일 때만 체크박스 노출
                    const chkHtml = !isApproved
                        ? '<input type="checkbox" class="quest-sub-chk" data-name="' + s.student_name + '" style="width:18px; height:18px; accent-color:#8B5CF6; cursor:pointer; margin-right:8px;" onchange="updateQuestBatchCount()">'
                        : '';

                    const ansText = String(s.answer_text || '(텍스트 없음)').replace(/[\n\r]/g, '<br>');

                    return '<div style="background:#0F172A; border:1px solid #334155; border-radius:8px; padding:15px; margin-top:10px; text-align:left;">' +
                        '  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">' +
                        '    <div style="display:flex; align-items:center;">' +
                        '      ' + chkHtml +
                        '      <b style="color:white; font-size:1.1em;">' + s.student_name + '</b>' +
                        '      <span style="background:' + badgeColor + '; color:black; padding:2px 8px; border-radius:10px; font-size:0.7em; font-weight:bold; margin-left:8px;">' + s.status + '</span>' +
                        '    </div>' +
                        '    <button class="small-btn" style="background:' + btnColor + '; padding:8px 12px; font-size:0.9em; border:none;" onclick="updateSubStatus(\'' + q.quest_id + '\', \'' + s.student_name + '\', \'' + nextStatus + '\', ' + q.reward_gold + ', ' + q.reward_point + ')">' + btnText + '</button>' +
                        '  </div>' +
                        '  <div style="color:#CBD5E1; font-size:0.95em; line-height:1.5; background:#1E293B; padding:10px; border-radius:5px;">' + ansText + '</div>' +
                        '</div>';
                }).join('');
            }

            contentHtml =
                '<div style="text-align:left;">' +
                '  <button class="small-btn" style="background:#334155; margin-bottom:15px;" onclick="renderQuestAdmin(\'list\')">⬅ 목록으로 돌아가기</button>' +
                '  <div style="background:#1E293B; padding:20px; border-radius:10px; border-left:4px solid #A78BFA; margin-bottom:15px;">' +
                '    <h3 style="color:white; margin:0 0 10px 0;">' + q.title + '</h3>' +
                '    <p style="color:#CBD5E1; margin:0 0 15px 0; font-size:0.9em;">' + String(q.description).replace(/[\n\r]/g, '<br>') + '</p>' +
                '    <div style="display:flex; gap:10px;">' +
                '      <span style="color:#FBBF24; font-weight:bold; font-size:0.9em;">💰 ' + q.reward_gold + ' ' + (sysConfig.game_money_currency || '골드') + '</span>' +
                '      <span style="color:#34D399; font-weight:bold; font-size:0.9em;">⭐ ' + q.reward_point + ' pt</span>' +
                '      <span style="color:#60A5FA; font-weight:bold; font-size:0.9em;">✨ ' + (q.reward_exp || 0) + ' EXP</span>' +
                '    </div>' +
                '    <button style="margin-top:15px; background:' + activeBtnColor + '; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;" onclick="' + activeAction + '">' + activeBtnText + '</button>' +
                '  </div>' +
                '  ' + batchBarHtml +
                '  <h4 style="color:#A78BFA; margin:10px 0;">제출 현황</h4>' +
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

    const targetStudent = window.allStudentsData.find(x => x.name === studentName);
    let leveledUp = false;

    if (newStatus === '승인완료') {
        if (targetStudent) {
            targetStudent.bonus_points = (Number(targetStudent.bonus_points) || 0) + Number(rewardPoint);
            targetStudent.game_money = (Number(targetStudent.game_money) || 0) + Number(rewardGold);
            targetStudent.exp = (Number(targetStudent.exp) || 0) + Number(rewardExp);
            targetStudent.quest_count = (Number(targetStudent.quest_count) || 0) + 1;

            const expMax = Number(sysConfig.exp_max) || 200;
            const pointsPerLevel = Number(sysConfig.points_per_level) || 3;
            while (targetStudent.exp >= expMax) {
                targetStudent.exp -= expMax;
                targetStudent.level = (Number(targetStudent.level) || 1) + 1;
                targetStudent.level_points = (Number(targetStudent.level_points) || 0) + pointsPerLevel;
                leveledUp = true;
            }
        }
    } else if (newStatus === '제출완료') {
        if (targetStudent) {
            targetStudent.bonus_points = Math.max(0, (Number(targetStudent.bonus_points) || 0) - Number(rewardPoint));
            targetStudent.game_money = Math.max(0, (Number(targetStudent.game_money) || 0) - Number(rewardGold));
            targetStudent.exp = Math.max(0, (Number(targetStudent.exp) || 0) - Number(rewardExp));
            targetStudent.quest_count = Math.max(0, (Number(targetStudent.quest_count) || 0) - 1);
        }
    }

    // 💡 [핵심] 현재 접속/조회 중인 학생 객체(currentStudent)도 즉시 동기화
    if (currentStudent && currentStudent.name === studentName && targetStudent) {
        currentStudent.bonus_points = targetStudent.bonus_points;
        currentStudent.game_money = targetStudent.game_money;
        currentStudent.exp = targetStudent.exp;
        currentStudent.level = targetStudent.level;
        currentStudent.level_points = targetStudent.level_points;
        currentStudent.quest_count = targetStudent.quest_count;
        if (document.getElementById('detailModal').style.display === 'flex') {
            renderDashboard();
        }
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

// 💡 [신규] 퀘스트 제출물 전체 선택/해제 토글
function toggleAllQuestSubs(masterChk) {
    const chks = document.querySelectorAll('.quest-sub-chk');
    chks.forEach(c => c.checked = masterChk.checked);
    updateQuestBatchCount();
}

// 💡 [신규] 일괄 승인 버튼 상태 및 인원수 실시간 업데이트
function updateQuestBatchCount() {
    const checked = document.querySelectorAll('.quest-sub-chk:checked').length;
    const btn = document.getElementById('batchApproveBtn');
    if (btn) {
        btn.innerText = '🚀 선택한 ' + checked + '명 일괄 승인';
        btn.disabled = (checked === 0);
        btn.style.opacity = (checked === 0 ? '0.5' : '1');
    }
}

// 💡 [신규] 선택한 학생들 원클릭 초고속 일괄 승인 & 보상 지급
function batchApproveSelectedSubs(questId) {
    const chks = document.querySelectorAll('.quest-sub-chk:checked');
    if (chks.length === 0) return;

    const targetNames = Array.from(chks).map(c => c.getAttribute('data-name'));
    const q = questsData.find(x => String(x.quest_id) === String(questId));
    if (!q) return;

    showGlobalLoading('📜 ' + targetNames.length + '명의 의뢰 일괄 승인 중...');

    const rewardGold = Number(q.reward_gold) || 0;
    const rewardPoint = Number(q.reward_point) || 0;
    const rewardExp = Number(q.reward_exp) || 0;
    const expMax = Number(sysConfig.exp_max) || 200;
    const pointsPerLevel = Number(sysConfig.points_per_level) || 3;

    let leveledUpNames = [];

    targetNames.forEach(sName => {
        // 1. 제출물 상태 변경
        const sub = (submissionsData || []).find(s => String(s.quest_id) === String(questId) && String(s.student_name) === String(sName));
        if (sub) sub.status = '승인완료';

        // 2. 학생 데이터 보상 반영
        const targetStudent = (window.allStudentsData || []).find(x => x.name === sName);
        if (targetStudent) {
            targetStudent.bonus_points = (Number(targetStudent.bonus_points) || 0) + rewardPoint;
            targetStudent.game_money = (Number(targetStudent.game_money) || 0) + rewardGold;
            targetStudent.exp = (Number(targetStudent.exp) || 0) + rewardExp;
            targetStudent.quest_count = (Number(targetStudent.quest_count) || 0) + 1;

            let leveled = false;
            while (targetStudent.exp >= expMax) {
                targetStudent.exp -= expMax;
                targetStudent.level = (Number(targetStudent.level) || 1) + 1;
                targetStudent.level_points = (Number(targetStudent.level_points) || 0) + pointsPerLevel;
                leveled = true;
            }
            if (leveled) leveledUpNames.push(sName + '(Lv.' + targetStudent.level + ')');

            if (currentStudent && currentStudent.name === sName) {
                currentStudent.bonus_points = targetStudent.bonus_points;
                currentStudent.game_money = targetStudent.game_money;
                currentStudent.exp = targetStudent.exp;
                currentStudent.level = targetStudent.level;
                currentStudent.level_points = targetStudent.level_points;
                currentStudent.quest_count = targetStudent.quest_count;
            }
        }
    });

    // 3. Firebase 일괄 동기화 (승인 대상 학생만 1:1 독립 방 저장하여 타 학생 롤백 방지)
    const studentSavePromises = targetNames.map(sName => {
        const targetStudent = (window.allStudentsData || []).find(x => x.name === sName);
        return targetStudent ? updateFastFirebaseStudent(targetStudent) : Promise.resolve();
    });

    Promise.all([
        ...studentSavePromises,
        fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/submissions.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.submissionsData)
        })
    ]).then(() => {
        hideGlobalLoading();
        renderQuestAdmin('list', questId);
        let lvMsg = leveledUpNames.length > 0 ? '<br><br>🎊 <b>레벨업 달성 모험가:</b> ' + leveledUpNames.join(', ') : '';
        showUiAlert('🎉 일괄 승인 완료!', '총 <b>' + targetNames.length + '명</b>의 의뢰를 일괄 승인하고 보상을 지급했습니다!' + lvMsg, '');
    }).catch(err => {
        hideGlobalLoading();
        showUiAlert('❌ 일괄 승인 실패', err, '');
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

// ==========================================
// 📜 실시간 로그 뷰어 시스템 (교사 전용 - 2차 다차원 필터 지원)
// ==========================================
async function openLogAdmin(tab = 'forge', filterStudent = 'ALL', filterSub = 'ALL') {
    if (!checkTeacherAuth()) return;
    const subModal = document.getElementById('subModal');
    const subBody = document.getElementById('subModalBody');

    subModal.querySelector('.modal-content').style.background = '#0F172A';
    subModal.querySelector('.modal-content').style.borderColor = '#6366F1';
    subModal.style.display = 'flex';

    subBody.innerHTML = '<div style="padding:40px; color:#A78BFA; font-size:1.2em;">⏳ 최신 로그를 불러오는 중...</div>';

    try {
        const [forgeRes, commonRes] = await Promise.all([
            fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/forgeLogs.json'),
            fetch('https://learning-explorer-default-rtdb.firebaseio.com/gameData/logs.json')
        ]);
        const forgeData = await forgeRes.json();
        const commonData = await commonRes.json();

        window.cachedForgeLogs = forgeData ? Object.values(forgeData) : [];
        window.cachedCommonLogs = commonData ? Object.values(commonData) : [];

        renderLogAdmin(tab, filterStudent, filterSub);
    } catch(e) {
        subBody.innerHTML = '<div style="color:#EF4444; padding:30px;">❌ 로그 로드 실패: ' + e + '</div>';
    }
}

function renderLogAdmin(tab = 'forge', filterStudent = 'ALL', filterSub = 'ALL') {
    const subBody = document.getElementById('subModalBody');
    const students = window.allStudentsData || [];

    // 1. 학생 선택 드롭다운 옵션 구성
    let studentOptions = '<option value="ALL"' + (filterStudent === 'ALL' ? ' selected' : '') + '>전체 학생 모아보기</option>';
    students.forEach(s => {
        if (s && s.name) {
            studentOptions += '<option value="' + s.name + '"' + (filterStudent === s.name ? ' selected' : '') + '>' + s.name + '</option>';
        }
    });

    // 2. 2차 세부 카테고리 필터 옵션 구성
    let subFilterOptions = '';
    if (tab === 'forge') {
        const equipOptions = [
            { val: 'ALL', label: '전체 부위 모아보기' },
            { val: 'weapon', label: '⚔️ 무기' },
            { val: 'head', label: '🛡️ 투구' },
            { val: 'body', label: '👕 갑옷' },
            { val: 'accessory', label: '💍 장신구' },
            { val: 'SUCCESS', label: '✅ 성공 기록만' },
            { val: 'FAIL', label: '❌ 실패 기록만' }
        ];
        subFilterOptions = equipOptions.map(opt => `<option value="${opt.val}"${filterSub === opt.val ? ' selected' : ''}>${opt.label}</option>`).join('');
    } else {
        const catOptions = [
            { val: 'ALL', label: '전체 활동/전투 모아보기' },
            { val: '일반 사냥', label: '⚔️ 일반 사냥' },
            { val: '보스 도전', label: '💀 보스 도전' },
            { val: '파티 던전', label: '🏰 파티 던전' },
            { val: '도전의 탑', label: '🗼 도전의 탑' },
            { val: '월드 보스', label: '🐲 월드 보스' },
            { val: '상점 구매', label: '🛒 상점 구매' },
            { val: '상자 개봉', label: '📦 상자 개봉' },
            { val: '아이템 사용', label: '🧪 아이템 사용' }
        ];
        subFilterOptions = catOptions.map(opt => `<option value="${opt.val}"${filterSub === opt.val ? ' selected' : ''}>${opt.label}</option>`).join('');
    }

    const filterHtml =
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">' +
        '  <div>' +
        '    <div style="font-size:0.8em; color:#94A3B8; margin-bottom:3px; text-align:left;">🔍 1차 필터 (학생):</div>' +
        '    <select id="logStudentFilter" style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid #334155; background:#1E293B; color:white; font-size:0.9em;" onchange="renderLogAdmin(\'' + tab + '\', this.value, document.getElementById(\'logSubFilter\').value)">' +
        studentOptions +
        '    </select>' +
        '  </div>' +
        '  <div>' +
        '    <div style="font-size:0.8em; color:#94A3B8; margin-bottom:3px; text-align:left;">🏷️ 2차 필터 (' + (tab === 'forge' ? '장비 부위' : '활동/전투 분류') + '):</div>' +
        '    <select id="logSubFilter" style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid #334155; background:#1E293B; color:#FBBF24; font-weight:bold; font-size:0.9em;" onchange="renderLogAdmin(\'' + tab + '\', document.getElementById(\'logStudentFilter\').value, this.value)">' +
        subFilterOptions +
        '    </select>' +
        '  </div>' +
        '</div>';

    const tabsHtml =
        '<div style="display:flex; margin-bottom:15px; border-bottom:1px solid #334155; font-size:0.95em;">' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'forge' ? '#818CF8' : '#9CA3AF') + '; border-bottom:' + (tab === 'forge' ? '3px solid #818CF8' : 'none') + ';" onclick="renderLogAdmin(\'forge\', \'' + filterStudent + '\', \'ALL\')">🔨 대장간 강화 로그</div>' +
        '  <div style="flex:1; padding:10px; cursor:pointer; font-weight:bold; color:' + (tab === 'common' ? '#818CF8' : '#9CA3AF') + '; border-bottom:' + (tab === 'common' ? '3px solid #818CF8' : 'none') + ';" onclick="renderLogAdmin(\'common\', \'' + filterStudent + '\', \'ALL\')">📜 일반 활동 / 아이템 / 전투</div>' +
        '</div>';

    let tableHtml = '';
    const equipMap = { 'weapon': '무기', 'head': '투구', 'body': '갑옷', 'accessory': '장신구' };

    if (tab === 'forge') {
        let logs = (window.cachedForgeLogs || []).slice().reverse();
        
        // 1차 학생 필터 적용
        if (filterStudent !== 'ALL') {
            logs = logs.filter(l => l && l.name === filterStudent);
        }

        // 2차 부위/결과 필터 적용
        if (filterSub !== 'ALL') {
            if (filterSub === 'SUCCESS') logs = logs.filter(l => l && l.result && l.result.includes('성공'));
            else if (filterSub === 'FAIL') logs = logs.filter(l => l && l.result && l.result.includes('실패'));
            else logs = logs.filter(l => l && (l.equip === filterSub || equipMap[l.equip] === filterSub));
        }

        if (logs.length === 0) {
            tableHtml = '<div style="padding:40px; color:#64748B;">조건에 일치하는 강화 로그가 없습니다.</div>';
        } else {
            let rowsHtml = logs.map(l => {
                const dateStr = l.time ? new Date(l.time).toLocaleString('ko-KR', { hour12: false }) : '-';
                const eqName = equipMap[l.equip] || l.equip || '-';
                const isWin = (l.result && l.result.includes('성공'));
                const resultBadge = isWin
                    ? '<span style="color:#10B981; font-weight:bold;">성공 ✅</span>'
                    : '<span style="color:#EF4444; font-weight:bold;">실패 ❌</span>';

                return '<tr style="border-bottom:1px solid #1E293B;">' +
                    '  <td style="padding:8px; font-size:0.8em; color:#94A3B8;">' + dateStr + '</td>' +
                    '  <td style="padding:8px; font-weight:bold; color:white;">' + (l.name || '-') + '</td>' +
                    '  <td style="padding:8px; color:#CBD5E1;">' + eqName + '</td>' +
                    '  <td style="padding:8px; font-weight:bold; color:#FBBF24;">' + (l.level || '-') + '</td>' +
                    '  <td style="padding:8px;">' + resultBadge + '</td>' +
                    '  <td style="padding:8px; color:#94A3B8; font-size:0.85em;">' + (l.fail || '-') + '</td>' +
                    '</tr>';
            }).join('');

            tableHtml =
                '<div style="max-height:340px; overflow-y:auto; border:1px solid #334155; border-radius:8px;">' +
                '  <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9em; background:#0F172A;">' +
                '    <thead style="background:#1E293B; color:#A78BFA; position:sticky; top:0;">' +
                '      <tr><th style="padding:10px;">시간</th><th>학생명</th><th>부위</th><th>단계</th><th>결과</th><th>누적실패</th></tr>' +
                '    </thead>' +
                '    <tbody>' + rowsHtml + '</tbody>' +
                '  </table>' +
                '</div>';
        }
    } else {
        let logs = (window.cachedCommonLogs || []).slice().reverse();

        // 1차 학생 필터 적용
        if (filterStudent !== 'ALL') {
            logs = logs.filter(l => l && l.name === filterStudent);
        }

        // 2차 카테고리/전투 유형 필터 적용 (과거 호환성 지원)
        if (filterSub !== 'ALL') {
            logs = logs.filter(l => {
                if (!l) return false;
                const cat = String(l.category || '');
                const content = String(l.content || '');

                if (filterSub === '일반 사냥') {
                    return cat === '일반 사냥' || (cat === '전투 승리' && !content.includes('[보스]'));
                }
                if (filterSub === '보스 도전') {
                    return cat === '보스 도전' || (cat === '전투 승리' && content.includes('[보스]'));
                }
                if (filterSub === '파티 던전') {
                    return cat === '파티 던전' || cat.includes('던전') || cat.includes('레이드');
                }
                if (filterSub === '도전의 탑') {
                    return cat === '도전의 탑' || cat.includes('탑') || content.includes('층 정복');
                }
                if (filterSub === '월드 보스') {
                    return cat === '월드 보스' || cat.includes('월드') || content.includes('피해량');
                }
                return cat === filterSub;
            });
        }

        if (logs.length === 0) {
            tableHtml = '<div style="padding:40px; color:#64748B;">조건에 일치하는 활동/전투 로그가 없습니다.</div>';
        } else {
            let rowsHtml = logs.map(l => {
                const dateStr = l.time ? new Date(l.time).toLocaleString('ko-KR', { hour12: false }) : '-';
                let catColor = '#38BDF8';
                const cat = l.category || '-';

                // 세부 카테고리별 컬러 뱃지 매핑
                if (cat === '상점 구매') catColor = '#F59E0B';
                else if (cat === '아이템 사용') catColor = '#10B981';
                else if (cat === '상자 개봉') catColor = '#8B5CF6';
                else if (cat === '일반 사냥' || cat === '전투 승리') catColor = '#EC4899';
                else if (cat === '보스 도전') catColor = '#EF4444';
                else if (cat === '파티 던전') catColor = '#3B82F6';
                else if (cat === '도전의 탑') catColor = '#14B8A6';
                else if (cat === '월드 보스') catColor = '#F43F5E';

                return '<tr style="border-bottom:1px solid #1E293B;">' +
                    '  <td style="padding:8px; font-size:0.8em; color:#94A3B8; white-space:nowrap;">' + dateStr + '</td>' +
                    '  <td style="padding:8px; font-weight:bold; color:white; white-space:nowrap;">' + (l.name || '-') + '</td>' +
                    '  <td style="padding:8px; font-weight:bold; color:' + catColor + '; white-space:nowrap;">[' + cat + ']</td>' +
                    '  <td style="padding:8px; text-align:left; color:#CBD5E1; font-size:0.88em; word-break:break-all;">' + (l.content || '-') + '</td>' +
                    '</tr>';
            }).join('');

            tableHtml =
                '<div style="max-height:340px; overflow-y:auto; border:1px solid #334155; border-radius:8px;">' +
                '  <table style="width:100%; border-collapse:collapse; text-align:center; font-size:0.9em; background:#0F172A;">' +
                '    <thead style="background:#1E293B; color:#A78BFA; position:sticky; top:0;">' +
                '      <tr><th style="padding:10px; width:22%;">시간</th><th style="width:15%;">학생명</th><th style="width:23%;">분류</th><th style="width:40%;">내용</th></tr>' +
                '    </thead>' +
                '    <tbody>' + rowsHtml + '</tbody>' +
                '  </table>' +
                '</div>';
        }
    }

    subBody.innerHTML =
        '<h2 style="color:#818CF8; margin-bottom: 5px;">📜 실시간 로그 뷰어</h2>' +
        '<p style="color:#CBD5E1; font-size:0.85em; margin-bottom:15px;">학생별 및 활동/전투 유형별 2차 필터로 기록을 정밀 조회합니다.</p>' +
        tabsHtml +
        filterHtml +
        tableHtml +
        '<div style="display:flex; gap:10px; margin-top:15px;">' +
        '  <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#312E81; color:#A78BFA; font-weight:bold; cursor:pointer;" onclick="openLogAdmin(\'' + tab + '\', \'' + filterStudent + '\', \'' + filterSub + '\')">🔄 새로고침</button>' +
        '  <button style="flex:1; padding:12px; border-radius:10px; border:none; background:#444; color:white; font-size:1em; cursor:pointer;" onclick="closeSubModal()">닫기</button>' +
        '</div>';
}