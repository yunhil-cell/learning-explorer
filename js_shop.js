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

async function processBuyItem(itemId) {
    const item = shopData.find(x => String(x.item_id) === String(itemId));
    if (!item) return;

    const cost = Number(item.price) || 0;

    showGlobalLoading("🛒 상점 상품 결제 처리 중...");

    try {
        const tx = await runStudentAtomicTransaction(
            currentStudent.name,
            student => {
                const currentMoney = Number(student.game_money) || 0;
                const invStr = String(student.inventory || '');

                if (item.effect_type === 'UNLOCK_RELIC_SLOT2' || item.item_name.includes('유물 슬롯')) {
                    const isUnlocked = String(student.relic_slot_2_unlocked).toUpperCase() === 'TRUE';

                    if (isUnlocked || invStr.includes(item.item_name)) {
                        return {
                            abort: true,
                            code: 'ALREADY_OWNED'
                        };
                    }
                }

                if (item.effect_type === 'UNLOCK_MERC_SLOT2' || item.item_name.includes('동료 슬롯')) {
                    const isUnlocked = String(student.merc_slot2_unlocked).toUpperCase() === 'TRUE';

                    if (isUnlocked || invStr.includes(item.item_name)) {
                        return {
                            abort: true,
                            code: 'ALREADY_OWNED'
                        };
                    }
                }

                if (currentMoney < cost) {
                    return {
                        abort: true,
                        code: 'NO_MONEY'
                    };
                }

                let items = student.inventory
                    ? String(student.inventory).split(',')
                    : [];

                items.push(item.item_name);

                student.game_money = currentMoney - cost;
                student.inventory = items.join(',');

                return {};
            }
        );

        if (!tx.committed) {
            hideGlobalLoading();

            if (tx.result.code === 'NO_MONEY') {
                showUiAlert(
                    "⚠️ 구매 실패",
                    "다른 접속에서 재화가 사용되어 현재 잔액이 부족합니다.",
                    "renderDashboard()"
                );
            } else {
                showUiAlert(
                    "⚠️ 구매 불가",
                    "이미 해금되었거나 가방에 보유 중인 상품입니다.",
                    "renderDashboard()"
                );
            }

            return;
        }

        pushFirebaseLog('common', {
            time: new Date().toISOString(),
            name: currentStudent.name,
            category: "상점 구매",
            content: item.item_name + " (" + cost + "골드)"
        });

        hideGlobalLoading();
        renderDashboard();

        showUiAlert(
            "🎁 구매 완료!",
            "[" + item.item_name + "]을(를) 구매했습니다!<br>가방에서 확인하고 원할 때 사용하세요.",
            ""
        );
    } catch (err) {
        hideGlobalLoading();

        await syncFreshCurrentStudent(true);

        showUiAlert(
            "❌ 구매 오류",
            "상품 저장 중 오류가 발생했습니다: " + err.message,
            "renderDashboard()"
        );
    }
}

// ==========================================
// 🔮 스킬 상점 시스템 (UI 팝업 적용)
// ==========================================
// 뽑기 복구 기록은 Firebase 전용입니다. students 시트 컬럼을 추가하지 않습니다.
let shopDrawBusy = false;
const shopDrawViews = {};

function getSavedShopDraw(student, kind) {
    return student && student.draw_state && student.draw_state[kind] || null;
}

function shopDrawOwnedIds(student, kind) {
    const field = kind === 'skill' ? 'unlocked_skills' : 'unlocked_relics';
    return String(student[field] || '').replace(/!/g, '').split(',').map(x => x.trim()).filter(Boolean);
}

function shopDrawHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function shopDrawContext(kind, draw) {
    return {
        owner: String(currentStudent.name).trim(),
        id: draw.id,
        revision: Number(draw.revision) || 0
    };
}

// 같은 화면의 중복 클릭은 차단하고, 다른 기기의 요청은 저장된 뽑기 ID로 검증합니다.
async function runShopDrawAction(kind, action, itemId, context) {
    if (shopDrawBusy || !currentStudent) return null;
    const owner = String(currentStudent.name).trim();
    if (context && context.owner !== owner) return null;
    const previous = getSavedShopDraw(currentStudent, kind);
    const previousId = previous ? previous.id : '';
    const previousStatus = previous ? previous.status : '';
    const idKey = kind === 'skill' ? 'skill_id' : 'relic_id';
    const field = kind === 'skill' ? 'unlocked_skills' : 'unlocked_relics';
    const catalog = kind === 'skill' ? skillsData : relicsData;
    const requestId = window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const createdAt = new Date().toISOString();
    const cost = Number(kind === 'skill' ? sysConfig.skill_price : sysConfig.relic_price) || (kind === 'skill' ? 50 : 100);
    // 충돌 재시도마다 무작위 결과를 다시 뽑지 않도록 순서는 요청당 한 번만 결정합니다.
    const ordered = (catalog || []).filter(item => item && item[idKey]).slice();
    for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
    shopDrawBusy = true;
    showGlobalLoading('뽑기 정보를 저장하고 있습니다...');
    try {
        const tx = await runStudentAtomicTransaction(owner, student => {
            const existing = getSavedShopDraw(student, kind);
            const resume = () => ({ abort: true, draw: existing });
            const owned = shopDrawOwnedIds(student, kind);
            if (action === 'start') {
                // 비용을 낸 미완료 뽑기가 있으면 재결제하지 않고 그대로 이어받습니다.
                if (existing && (existing.status === 'pending' || existing.status === 'ready')) return resume();
                if ((existing ? existing.id : '') !== previousId ||
                    (existing ? existing.status : '') !== previousStatus) return resume();
                if (!Number.isFinite(cost) || cost < 0) throw new Error('뽑기 가격 설정을 확인해주세요.');
                const seen = new Set();
                const choices = ordered.filter(item => {
                    const id = String(item[idKey]);
                    if (owned.includes(id) || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                }).slice(0, kind === 'skill' ? 3 : 1);
                if (!choices.length) throw new Error('더 이상 모을 ' + (kind === 'skill' ? '스킬' : '유물') + '이 없습니다. 재화는 차감되지 않았습니다.');
                const money = Number(student.game_money) || 0;
                if (money < cost) throw new Error('보유 재화가 부족합니다. 재화는 차감되지 않았습니다.');
                const draw = {
                    id: requestId, status: kind === 'skill' ? 'pending' : 'ready',
                    cost: cost, created_at: createdAt, choices: cloneStudentSyncData(choices),
                    reroll_used: false, revision: 0
                };
                student.game_money = money - cost;
                student.draw_state = Object.assign({}, student.draw_state || {}, { [kind]: draw });
                if (kind === 'relic') {
                    // 유물은 연출 전에 비용과 지급을 한 번에 확정합니다.
                    draw.selected_id = String(choices[0][idKey]);
                    student[field] = '!' + owned.concat(draw.selected_id).join(',');
                    student.relic_pull_count = (Number(student.relic_pull_count) || 0) + 1;
                }
                return { draw: draw, event: 'start' };
            }
            if (!existing || !context || existing.id !== context.id) {
                throw new Error('뽑기 상태가 변경되었습니다. 상점을 다시 열어 확인해주세요.');
            }
            // 완료된 요청의 재전송은 추가 지급/차감 없이 원래 결과를 돌려줍니다.
            if (existing.status === 'completed' || existing.status === 'forfeited') return resume();
            if ((Number(existing.revision) || 0) !== context.revision) return resume();
            if (action === 'reroll' && kind === 'skill') {
                if (existing.reroll_used) return resume();
                const seen = new Set();
                const choices = ordered.filter(item => {
                    const id = String(item[idKey]);
                    if (owned.includes(id) || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                }).slice(0, 3);
                if (!choices.length) throw new Error('선택 가능한 스킬이 없습니다. 선생님께 확인해주세요.');
                existing.choices = cloneStudentSyncData(choices);
                existing.reroll_used = true;
                existing.revision = context.revision + 1;
            } else if (action === 'select' && kind === 'skill') {
                const choice = (existing.choices || []).find(item => String(item.skill_id) === String(itemId));
                if (!choice) throw new Error('저장된 후보에 없는 스킬입니다. 상점을 다시 열어주세요.');
                if (owned.includes(String(itemId))) throw new Error('이미 보유한 스킬입니다. 다른 후보를 선택해주세요.');
                student[field] = '!' + owned.concat(String(itemId)).join(',');
                existing.selected_id = String(itemId);
                existing.status = 'completed';
            } else if (action === 'ack' && kind === 'relic') {
                if (String(existing.selected_id) !== String(itemId)) throw new Error('저장된 유물과 선택한 유물이 다릅니다.');
                existing.status = 'completed';
            } else if (action === 'forfeit' && kind === 'skill') {
                existing.status = 'forfeited';
            } else {
                throw new Error('올바르지 않은 뽑기 요청입니다.');
            }
            existing.updated_at = createdAt;
            return { draw: existing, event: action };
        });
        const draw = getSavedShopDraw(tx.student, kind);
        if (tx.committed && draw && tx.result.event) {
            const picked = (draw.choices || []).find(item => String(item[idKey]) === String(draw.selected_id));
            const currency = sysConfig.game_money_currency || '골드';
            let content = '';
            if (action === 'start' && kind === 'skill') content = `스킬 뽑기 시작 (${draw.cost}${currency} 소모, 선택 대기)`;
            if (action === 'start' && kind === 'relic') content = `유물 뽑기 ➔ [${picked ? picked.name : draw.selected_id}] 발굴 (${draw.cost}${currency} 소모)`;
            if (action === 'select') content = `스킬 뽑기 ➔ [${picked ? picked.name : draw.selected_id}] 획득 (결제한 뽑기 완료)`;
            if (action === 'forfeit') content = '스킬 뽑기 포기 (기존 규칙에 따라 환불 없음)';
            if (content) pushFirebaseLog('common', { time: createdAt, name: owner, category: '상점 구매', draw_id: draw.id, content: content });
        }
        if (!currentStudent || String(currentStudent.name).trim() !== owner) return null;
        return draw;
    } catch (err) {
        console.error('뽑기 저장 확인 필요:', err);
        if (currentStudent && String(currentStudent.name).trim() === owner) {
            await syncFreshCurrentStudent(true);
            showUiAlert('뽑기 확인', shopDrawHtml(err.message) + '<br>상점을 다시 열면 저장된 뽑기를 확인할 수 있습니다.', kind === 'skill' ? 'openSkillShop()' : 'openRelicShop()');
        }
        return null;
    } finally {
        shopDrawBusy = false;
        hideGlobalLoading();
    }
}

function showShopDrawOutcome(kind, draw) {
    if (!draw) return;
    if (draw.status === 'forfeited') {
        showUiAlert('뽑기 종료', '포기한 뽑기입니다. 재화는 환불되지 않습니다.', 'renderDashboard()');
        return;
    }
    const key = kind === 'skill' ? 'skill_id' : 'relic_id';
    const picked = (draw.choices || []).find(item => String(item[key]) === String(draw.selected_id));
    showUiAlert('획득 완료!', '[' + shopDrawHtml(picked ? picked.name : draw.selected_id) + '] 획득 정보가 저장되었습니다.', 'renderDashboard()');
}

function confirmShopDraw(kind, itemId, itemName, context) {
    if (!context || !currentStudent || context.owner !== String(currentStudent.name).trim()) return;
    showUiConfirm(kind === 'skill' ? '✨ 지식 획득' : '🏺 유물 획득',
        '[' + shopDrawHtml(itemName) + '] ' + (kind === 'skill' ? '스킬을 획득하시겠습니까?' : '유물은 가방에 저장되었습니다. 확인하시겠습니까?'), '');
    const buttons = document.getElementById('uiPopupButtons');
    buttons.lastElementChild.onclick = function () {
        this.disabled = true;
        closeUiPopup();
        if (kind === 'skill') processSelectSkill(itemId, itemName, context);
        else processSelectRelic(itemId, itemName, context);
    };
}

function promptForfeitSkill(context) {
    if (!context || context.owner !== String(currentStudent.name).trim()) return;
    showUiConfirm('스킬 뽑기 포기', '포기하면 이번 선택 기회가 사라지고 비용은 환불되지 않습니다.<br>나중에 고르려면 취소 후 창을 닫아주세요.', '');
    document.getElementById('uiPopupButtons').lastElementChild.onclick = async function () {
        this.disabled = true;
        closeUiPopup();
        const draw = await runShopDrawAction('skill', 'forfeit', '', context);
        if (draw && draw.status === 'pending') drawSkills(false);
        else if (draw) showShopDrawOutcome('skill', draw);
    };
}

function openSkillShop() {
    const pending = getSavedShopDraw(currentStudent, 'skill');
    if (pending && pending.status === 'pending') {
        drawSkills(false);
        return;
    }
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

async function promptDrawSkills(isReroll) {
    if (isReroll) return doReroll();
    const draw = await runShopDrawAction('skill', 'start');
    if (!draw) return;
    if (draw.status === 'pending') drawSkills(false);
    else showShopDrawOutcome('skill', draw);
}

async function processDrawMercenary() {
    const body = document.getElementById('modalBody');
    body.innerHTML = '<h2 style="color:var(--Highlight);">🏰 용병 계약 작성 중...</h2><div style="margin:50px 0;"><span class="anim-pot">📜</span></div><p style="color:var(--TextSub);">미지의 용병이 계약서에 서명하고 있습니다!</p>';

    showGlobalLoading("📜 용병 계약서 작성 중...");

    const cost = Number(sysConfig.merc_price) || 100;

    // 💡 등급 추첨 자체는 기존 확률 로직을 그대로 사용하고 1회만 결정
    const probC = sysConfig.merc_prob_c !== undefined ? Number(sysConfig.merc_prob_c) : 50;
    const probB = sysConfig.merc_prob_b !== undefined ? Number(sysConfig.merc_prob_b) : 35;
    const probA = sysConfig.merc_prob_a !== undefined ? Number(sysConfig.merc_prob_a) : 12;
    const probS = sysConfig.merc_prob_s !== undefined ? Number(sysConfig.merc_prob_s) : 3;

    const totalProb = probC + probB + probA + probS;
    const rand = Math.random() * (totalProb || 100);
    let rolledTier = "C";

    if (rand <= probS) rolledTier = "S";
    else if (rand <= probS + probA) rolledTier = "A";
    else if (rand <= probS + probA + probB) rolledTier = "B";
    else rolledTier = "C";

    try {
        const tx = await runStudentAtomicTransaction(
            currentStudent.name,
            student => {
                const currentMoney = Number(student.game_money) || 0;

                if (currentMoney < cost) {
                    return {
                        abort: true,
                        code: 'NO_MONEY'
                    };
                }

                const rawUnlocked = String(student.unlocked_mercenaries || "").replace(/!/g, '');

                let unlockedIds = rawUnlocked
                    ? rawUnlocked.split(',').map(x => x.trim()).filter(Boolean)
                    : [];

                let unownedByTier = {
                    C: [],
                    B: [],
                    A: [],
                    S: []
                };

                (mercenariesData || []).forEach(m => {
                    if (!m.merc_id) return;

                    const mId = String(m.merc_id).trim();
                    const mTier = String(m.tier || "C").trim().toUpperCase();

                    if (!unlockedIds.includes(mId)) {
                        if (unownedByTier[mTier]) {
                            unownedByTier[mTier].push(m);
                        } else {
                            unownedByTier.C.push(m);
                        }
                    }
                });

                const totalUnowned =
                    unownedByTier.C.length +
                    unownedByTier.B.length +
                    unownedByTier.A.length +
                    unownedByTier.S.length;

                if (totalUnowned === 0) {
                    return {
                        abort: true,
                        code: 'ALL_OWNED'
                    };
                }

                const tierOrder = ["C", "B", "A", "S"];
                let startIdx = tierOrder.indexOf(rolledTier);
                let pickedMerc = null;

                for (let t = startIdx; t < tierOrder.length; t++) {
                    let tName = tierOrder[t];

                    if (
                        unownedByTier[tName] &&
                        unownedByTier[tName].length > 0
                    ) {
                        let pool = unownedByTier[tName];
                        pickedMerc = pool[Math.floor(Math.random() * pool.length)];
                        break;
                    }
                }

                if (!pickedMerc) {
                    for (let t = startIdx - 1; t >= 0; t--) {
                        let tName = tierOrder[t];

                        if (
                            unownedByTier[tName] &&
                            unownedByTier[tName].length > 0
                        ) {
                            let pool = unownedByTier[tName];
                            pickedMerc = pool[Math.floor(Math.random() * pool.length)];
                            break;
                        }
                    }
                }

                if (!pickedMerc) {
                    return {
                        abort: true,
                        code: 'NO_MERC'
                    };
                }

                unlockedIds.push(String(pickedMerc.merc_id));

                student.game_money = currentMoney - cost;
                student.unlocked_mercenaries = "!" + unlockedIds.join(',');

                return {
                    pickedMerc: pickedMerc,
                    tier: String(pickedMerc.tier || 'C').toUpperCase()
                };
            }
        );

        if (!tx.committed) {
            hideGlobalLoading();

            if (tx.result.code === 'NO_MONEY') {
                showUiAlert(
                    "⚠️ 자금 부족",
                    "다른 접속에서 재화가 사용되어 현재 골드가 부족합니다.",
                    "renderDashboard()"
                );
            } else if (tx.result.code === 'ALL_OWNED') {
                showUiAlert(
                    "🏆 도감 올클리어",
                    "이미 모든 동료를 영입하셨습니다!<br>재화는 차감되지 않습니다.",
                    "renderDashboard()"
                );
            } else {
                showUiAlert(
                    "오류",
                    "추첨 가능한 용병이 없습니다.",
                    "renderDashboard()"
                );
            }

            return;
        }

        const pickedMerc = tx.result.pickedMerc;
        const tier = tx.result.tier;

        pushFirebaseLog('common', {
            time: new Date().toISOString(),
            name: currentStudent.name,
            category: "상점 구매",
            content: `동료 영입 ➔ [${tier}급] ${pickedMerc.name} 계약 (${cost}골드 소모)`
        });

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

        const jobMap = {
            'WARRIOR': '⚔️ 전사',
            'ARCHER': '🏹 궁수',
            'MAGE': '🔮 마법사',
            'ROGUE': '🗡️ 도적'
        };

        const jobName =
            jobMap[String(pickedMerc.job).toUpperCase()] ||
            pickedMerc.job ||
            '용병';

        const iconHtml = pickedMerc.icon_url
            ? '<img src="' + pickedMerc.icon_url + '" style="width:110px; height:110px; object-fit:contain; border-radius:50%; border:3px solid ' + tierColor + '; box-shadow:' + tierGlow + '; margin-bottom:15px; background:#FFFFFF; padding:4px;">'
            : '<div style="font-size:70px; margin-bottom:15px;">🛡️</div>';

        const optTypeMap = {
            'HP_UP': '건강 증가',
            'DEF_UP': '방어력 증가',
            'ATK_UP': '공격력 증가',
            'LUK_UP': '행운 증가',
            'CRIT_UP': '치명타율 증가',
            'CRIT_DMG_UP': '치명피해 증가',
            'DAMAGE_REDUCE': '피해 감소',
            'DEF_PEN': '방어 관통',
            'DMG_UP': '피해 증가',
            'SKILL_DMG': '스킬 피해 증가',
            'HEAL_UP': '회복량 증가',
            'EVD_UP': '회피율 증가'
        };

        const optName =
            optTypeMap[String(pickedMerc.option_type).toUpperCase()] ||
            pickedMerc.option_type;

        const isPct =
            String(pickedMerc.option_calc_type).toUpperCase() === 'PERCENT';

        const optValStr = isPct
            ? Math.round(Number(pickedMerc.option_value) * 100) + '%'
            : pickedMerc.option_value;

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
    } catch (err) {
        hideGlobalLoading();

        await syncFreshCurrentStudent(true);

        showUiAlert(
            "❌ 영입 오류",
            "용병 영입 저장 중 오류가 발생했습니다: " + err.message,
            "renderDashboard()"
        );
    }
}

function drawSkills(isReroll) {
    const draw = getSavedShopDraw(currentStudent, 'skill');
    if (!draw || draw.status !== 'pending') {
        if (draw) showShopDrawOutcome('skill', draw);
        else openSkillShop();
        return;
    }
    const choices = draw.choices || [];
    const context = shopDrawContext('skill', draw);
    shopDrawViews.skill = context;
    canReroll = !draw.reroll_used;
    const body = document.getElementById('modalBody');

    body.innerHTML = '<h2 style="color:var(--Highlight);">' + (isReroll ? '🔄 다시 집중하는 중...' : '✨ 지식을 탐구하는 중...') + '</h2><div style="font-size:80px; margin:40px 0;" class="anim-book">📚</div><p style="color:var(--TextSub);">어떤 스킬이 등장할까요?</p>';

    const waitingHtml = body.innerHTML;
    setTimeout(() => {
        if (!currentStudent || String(currentStudent.name).trim() !== context.owner ||
            document.getElementById('detailModal').style.display !== 'flex' ||
            body.innerHTML !== waitingHtml || shopDrawViews.skill !== context) return;
        let cardsHtml = choices.map((sk, index) => {
            const blessClass = sk.blessing ? 'blessing-' + String(sk.blessing).trim() : 'blessing-None';
            const iconDisplay = sk.icon_url ? '<img src="' + shopDrawHtml(sk.icon_url) + '" class="skill-icon-pixel ' + shopDrawHtml(blessClass) + '" style="width:60px; height:60px; margin: 0 auto 10px auto; display:block;">' : '<div class="skill-icon">🔮</div>';
            return '<div class="skill-card anim-card" style="background:#F8FAFC; border: 2px solid var(--Highlight); color:var(--TextMain); animation-delay: ' + (index * 0.3) + 's;">' + iconDisplay + '<div class="skill-name" style="color:var(--Highlight);">' + shopDrawHtml(sk.name) + '</div><div class="skill-desc" style="color:var(--TextSub);">' + shopDrawHtml(sk.description) + '</div></div>';
        }).join('');

        const rerollBtn = canReroll ? '<button class="btn-main btn-reroll" style="background:var(--Yellow); margin-top:20px;" onclick="doReroll()">리롤 (1회 무료)</button>' : '';
        body.innerHTML = '<h2 style="color:var(--Highlight);">✨ 지식의 발견</h2><p style="color:var(--TextSub);">원하는 스킬 하나를 선택하세요!</p><div class="skill-cards-container">' + cardsHtml + '</div>' + rerollBtn + '<button class="btn-main" style="background:var(--TextSub); margin-top:10px;" >포기하기</button>';
        body.querySelectorAll('.skill-card').forEach((card, index) => {
            const sk = choices[index];
            card.onclick = () => selectSkill(sk.skill_id, sk.name, context);
        });
        const reroll = body.querySelector('.btn-reroll');
        if (reroll) reroll.onclick = () => doReroll(context);
        body.lastElementChild.onclick = () => promptForfeitSkill(context);
    }, 1200);
}

function selectSkill(skillId, skillName, context = shopDrawViews.skill) {
    confirmShopDraw('skill', skillId, skillName, context);
}

async function processSelectSkill(skillId, skillName, context = shopDrawViews.skill) {
    const draw = await runShopDrawAction('skill', 'select', skillId, context);
    if (!draw) return;
    if (draw.status === 'pending') drawSkills(false);
    else showShopDrawOutcome('skill', draw);
}

// ==========================================
// 🏺 유물 상점 시스템 (UI 팝업 적용)
// ==========================================
function openRelicShop() {
    const pending = getSavedShopDraw(currentStudent, 'relic');
    if (pending && pending.status === 'ready') {
        drawRelic();
        return;
    }
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

async function promptDrawRelic() {
    const draw = await runShopDrawAction('relic', 'start');
    if (!draw) return;
    if (draw.status === 'ready') drawRelic();
    else showShopDrawOutcome('relic', draw);
}

function drawRelic() {
    const draw = getSavedShopDraw(currentStudent, 'relic');
    if (!draw || draw.status !== 'ready') {
        if (draw) showShopDrawOutcome('relic', draw);
        else openRelicShop();
        return;
    }
    const picked = (draw.choices || [])[0];
    if (!picked) return;
    const context = shopDrawContext('relic', draw);
    shopDrawViews.relic = context;
    const body = document.getElementById('modalBody');

    body.innerHTML = '<h2 style="color:var(--Highlight);">🏺 유물 발굴 중...</h2><div style="margin:50px 0;"><span class="anim-pot">🏺</span></div><p style="color:var(--TextSub);">항아리 속에서 고대의 기운이 느껴집니다!</p>';

    const waitingHtml = body.innerHTML;
    setTimeout(() => {
        if (!currentStudent || String(currentStudent.name).trim() !== context.owner ||
            document.getElementById('detailModal').style.display !== 'flex' ||
            body.innerHTML !== waitingHtml || shopDrawViews.relic !== context) return;
        const translator = (typeof relicEffectTranslator !== 'undefined') ? relicEffectTranslator : {};
        const effName = translator[picked.effect_type] || picked.effect_type;

        const effectType = String(picked.effect_type || '');
        let valStr = (effectType.includes('mult') || (effectType.includes('up') && !effectType.match(/^(hp|atk|def|luk|gold)_up$/))) ? (picked.value * 100) + '%' : picked.value;
        if (effectType === 'gold_up') valStr += (sysConfig.game_money_currency || '골드');
        body.innerHTML = '<h2 style="color:var(--Highlight);">✨ 유물 발견!</h2><div class="relic-card" style="background:#F8FAFC; border: 2px solid var(--Highlight);"><img src="' + shopDrawHtml(picked.icon_url) + '" class="relic-pop"><h3 style="color:var(--Highlight); margin:15px 0;">' + shopDrawHtml(picked.name) + '</h3><p style="font-size:0.9em; color:var(--TextMain); line-height:1.5;">' + shopDrawHtml(picked.description) + '</p><div style="font-size:0.8em; color:var(--TextSub); margin-top:10px; font-weight:bold;">효과: ' + shopDrawHtml(effName) + ' (+' + shopDrawHtml(valStr) + ')</div></div><button class="btn-main" style="background:var(--Highlight); margin-top:20px;">가방 저장 완료 · 확인</button>';
        body.lastElementChild.onclick = () => selectRelic(picked.relic_id, picked.name, context);
    }, 1500);
}

function selectRelic(relicId, relicName, context = shopDrawViews.relic) {
    confirmShopDraw('relic', relicId, relicName, context);
}

async function processSelectRelic(relicId, relicName, context = shopDrawViews.relic) {
    const draw = await runShopDrawAction('relic', 'ack', relicId, context);
    if (draw) showShopDrawOutcome('relic', draw);
}

// --- [복구] 스킬 리롤 처리 함수 ---
async function doReroll(context = shopDrawViews.skill) {
    const draw = await runShopDrawAction('skill', 'reroll', '', context);
    if (!draw) return;
    if (draw.status === 'pending') drawSkills(true);
    else showShopDrawOutcome('skill', draw);
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
async function processUseItem(itemName, count = 1) {
    const useCount = Math.max(1, Number(count) || 1);

    showGlobalLoading("🎒 아이템 사용 정보 저장 중...");

    try {
        const tx = await runStudentAtomicTransaction(
            currentStudent.name,
            student => {
                const rawInv = String(student.inventory || "");

                let items = rawInv
                    ? rawInv.split(',').map(x => x.trim()).filter(Boolean)
                    : [];

                let removedCount = 0;

                for (let i = 0; i < useCount; i++) {
                    const index = items.indexOf(itemName);

                    if (index > -1) {
                        items.splice(index, 1);
                        removedCount++;
                    }
                }

                if (removedCount === 0) {
                    return {
                        abort: true,
                        code: 'NO_ITEM'
                    };
                }

                student.inventory = items.join(',');

                if (itemName.includes('망각의 물약') || itemName.includes('망각')) {
                    student.hp_points = 5;
                    student.atk_points = 5;
                    student.def_points = 5;
                    student.luk_points = 5;
                    student.blessing = "TEMP";
                } else if (itemName === '보스 도전기회 추가 티켓') {
                    student.weekly_boss =
                        (Number(student.weekly_boss) || 0) +
                        removedCount;
                } else if (
                    itemName.includes('유물 슬롯 확장권') ||
                    itemName.includes('유물 슬롯 해금권')
                ) {
                    student.relic_slot_2_unlocked = "TRUE";
                } else if (
                    itemName.includes('동료 슬롯 확장권') ||
                    itemName.includes('동료 슬롯 해금권')
                ) {
                    student.merc_slot2_unlocked = "TRUE";
                } else if (
                    itemName.includes('치료제') ||
                    itemName.includes('회복약') ||
                    itemName.includes('부상')
                ) {
                    student.last_defeat = 0;
                    student.penalty_end_time = 0;
                }

                return {
                    removedCount: removedCount
                };
            }
        );

        if (!tx.committed) {
            hideGlobalLoading();

            showUiAlert(
                "⚠️ 사용 실패",
                "해당 아이템을 더 이상 보유하고 있지 않습니다.<br>다른 접속에서 이미 사용되었을 수 있습니다.",
                "openInventory()"
            );

            return;
        }

        const removedCount = tx.result.removedCount;

        pushFirebaseLog('common', {
            time: new Date().toISOString(),
            name: currentStudent.name,
            category: "아이템 사용",
            content: itemName + (removedCount > 1 ? " x" + removedCount : "")
        });

        hideGlobalLoading();

        if (itemName.includes('망각의 물약') || itemName.includes('망각')) {
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
            showUiAlert(
                "🎫 사용 완료!",
                "[보스 도전기회 추가 티켓] <b>" + removedCount + "장</b>을 사용했습니다.<br><br><span style='color:var(--Red); font-weight:bold;'>보스 도전 기회가 " + removedCount + "회 회복되었습니다.</span>",
                "openInventory()"
            );
            return;
        }

        if (
            itemName.includes('유물 슬롯 확장권') ||
            itemName.includes('유물 슬롯 해금권')
        ) {
            showUiAlert(
                "🔓 슬롯 해금 완료!",
                "[유물 슬롯 확장권]을 사용하여 <b>두 번째 유물 슬롯</b>이 해금되었습니다!<br><span style='color:var(--Highlight); font-weight:bold;'>이제 유물을 2개까지 장착할 수 있습니다.</span>",
                "renderDashboard()"
            );
            return;
        }

        if (
            itemName.includes('동료 슬롯 확장권') ||
            itemName.includes('동료 슬롯 해금권')
        ) {
            showUiAlert(
                "🔓 슬롯 해금 완료!",
                "[동료 슬롯 확장권]을 사용하여 <b>두 번째 동료 슬롯</b>이 해금되었습니다!<br><span style='color:var(--Highlight); font-weight:bold;'>파티 관리 메뉴에서 2번째 동료를 배치할 수 있습니다.</span>",
                "renderDashboard()"
            );
            return;
        }

        if (
            itemName.includes('치료제') ||
            itemName.includes('회복약') ||
            itemName.includes('부상')
        ) {
            showUiAlert(
                "🩹 치료 완료!",
                "[" + itemName + "]을(를) 사용하여 부상을 완치했습니다!<br><span style='color:var(--Green); font-weight:bold;'>이제 다시 사냥터에 입장할 수 있습니다.</span>",
                "renderDashboard()"
            );
            return;
        }

        const rmMatch =
            itemName.match(/\[현실 재화\]\s*(\d+)(.*?)\s*교환권/);

        let totalNotice = "";

        if (rmMatch) {
            const singleVal = Number(rmMatch[1]) || 0;
            const currencyUnit = rmMatch[2] || sysConfig.currency_name || '티';
            const totalVal = singleVal * removedCount;

            totalNotice =
                "<br><br><span style='font-size:1.25em; color:var(--TextGold); font-weight:bold;'>총 지급액: " +
                totalVal +
                currencyUnit +
                "</span>";
        }

        showUiAlert(
            "🎉 사용 완료!",
            "<b>[" + itemName + "] " + removedCount + "개</b>를 사용했습니다!" +
            totalNotice +
            "<br><br><span style='font-size:0.95em; color:var(--Highlight); font-weight:bold;'>선생님께 이 화면을 보여드리고 보상을 받으세요.</span>",
            "openInventory()"
        );
    } catch (err) {
        hideGlobalLoading();

        await syncFreshCurrentStudent(true);

        showUiAlert(
            "❌ 사용 오류",
            "아이템 사용 정보 저장 중 오류가 발생했습니다: " + err.message,
            "openInventory()"
        );
    }
}

function legacyProcessUseItemUnused(itemName, count = 1) {
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

function legacyProcessDrawMercenaryUnused() {
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

    // 💡 [밸런스 패치] 등급별 미보유 용병 풀 분류
    let unownedByTier = { C: [], B: [], A: [], S: [] };
    (mercenariesData || []).forEach(m => {
        if (!m.merc_id) return;
        const mId = String(m.merc_id).trim();
        const mTier = String(m.tier || "C").trim().toUpperCase();
        if (!unlockedIds.includes(mId)) {
            if (unownedByTier[mTier]) unownedByTier[mTier].push(m);
            else unownedByTier['C'].push(m);
        }
    });

    const totalUnowned = unownedByTier.C.length + unownedByTier.B.length + unownedByTier.A.length + unownedByTier.S.length;
    if (totalUnowned === 0) {
        hideGlobalLoading();
        showUiAlert("🏆 도감 올클리어", "이미 모든 동료를 영입하셨습니다!<br>재화는 차감되지 않습니다.", "renderDashboard()");
        return;
    }

    // 💡 system 시트 확률 연동 (기본: C 50% / B 35% / A 12% / S 3%)
    const probC = sysConfig.merc_prob_c !== undefined ? Number(sysConfig.merc_prob_c) : 50;
    const probB = sysConfig.merc_prob_b !== undefined ? Number(sysConfig.merc_prob_b) : 35;
    const probA = sysConfig.merc_prob_a !== undefined ? Number(sysConfig.merc_prob_a) : 12;
    const probS = sysConfig.merc_prob_s !== undefined ? Number(sysConfig.merc_prob_s) : 3;

    const totalProb = probC + probB + probA + probS;
    const rand = Math.random() * (totalProb || 100);
    let rolledTier = "C";

    if (rand <= probS) rolledTier = "S";
    else if (rand <= probS + probA) rolledTier = "A";
    else if (rand <= probS + probA + probB) rolledTier = "B";
    else rolledTier = "C";

    // 💡 해당 등급 올클리어 시 상위 등급으로 자동 승급 탐색
    const tierOrder = ["C", "B", "A", "S"];
    let startIdx = tierOrder.indexOf(rolledTier);
    let pickedMerc = null;

    for (let t = startIdx; t < tierOrder.length; t++) {
        let tName = tierOrder[t];
        if (unownedByTier[tName] && unownedByTier[tName].length > 0) {
            let pool = unownedByTier[tName];
            pickedMerc = pool[Math.floor(Math.random() * pool.length)];
            break;
        }
    }
    if (!pickedMerc) {
        for (let t = startIdx - 1; t >= 0; t--) {
            let tName = tierOrder[t];
            if (unownedByTier[tName] && unownedByTier[tName].length > 0) {
                let pool = unownedByTier[tName];
                pickedMerc = pool[Math.floor(Math.random() * pool.length)];
                break;
            }
        }
    }

    if (!pickedMerc) {
        hideGlobalLoading();
        showUiAlert("오류", "추첨 가능한 용병이 없습니다.", "renderDashboard()");
        return;
    }

    unlockedIds.push(String(pickedMerc.merc_id));
    currentStudent.game_money = currentMoney - cost;
    currentStudent.unlocked_mercenaries = "!" + unlockedIds.join(',');

    const tier = String(pickedMerc.tier || 'C').toUpperCase();

    // 📝 [Firebase 동료 뽑기 로그 전송]
    pushFirebaseLog('common', {
        time: new Date().toISOString(),
        name: currentStudent.name,
        category: "상점 구매",
        content: `동료 영입 ➔ [${tier}급] ${pickedMerc.name} 계약 (${cost}골드 소모)`
    });

    updateFastFirebaseStudent(currentStudent);
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
        'HP_UP': '건강 증가', 'DEF_UP': '방어력 증가', 'ATK_UP': '공격력 증가',
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