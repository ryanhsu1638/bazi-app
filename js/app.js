/**
 * app.js — 主應用程式邏輯
 * ------------------------------------------------------------
 * 負責：畫面路由切換、表單輸入處理、呼叫排盤引擎、渲染命盤結果、
 * 兌換碼解鎖付費內容、IndexedDB 歷史紀錄存取、24 小時倒數。
 */

const App = (() => {
  // ------------------------------------------------------------
  // 兌換碼設定
  // 這裡先放一組預設示範碼，正式使用前請自行修改成您想要的兌換碼。
  // 也可以放多組，逗號分隔即可，例如 ['BAZI2026', 'VIP888']
  // ------------------------------------------------------------
  const VALID_REDEEM_CODES = ['BAZI2026'];

  let currentGender = 'male';
  let currentChartId = null; // 目前顯示中的命盤在 IndexedDB 的 id
  let currentChart = null; // 目前顯示中的排盤結果（含十神）
  let currentAnalysis = null; // 目前顯示中的 AI 分析結果

  // ---------- 合盤配對狀態 ----------
  let matchGenderB = 'male';
  let currentMatchingResult = null;
  let matchingUnlocked = false;

  const WUXING_COLORS = { 木: '#4ADE80', 火: '#F87171', 土: '#D4AF37', 金: '#E5E7EB', 水: '#00C2FF' };

  // ---------- 畫面路由 ----------
  function goTo(screenName) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
    const target = document.getElementById('screen-' + screenName);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));
    const navBtn = document.querySelector(`.nav-item[data-nav="${screenName}"]`);
    if (navBtn) navBtn.classList.add('active');

    if (screenName === 'history') {
      renderHistoryList();
    }
    if (screenName === 'match') {
      populateMatchPersonASelect();
    }
    window.scrollTo(0, 0);
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ---------- 性別切換 ----------
  function selectGender(g) {
    currentGender = g;
    document.querySelectorAll('.gender-toggle .opt').forEach((el) => {
      el.classList.toggle('selected', el.dataset.gender === g);
    });
  }

  // ---------- 時區下拉選單初始化 ----------
  const TIMEZONE_OPTIONS = [
    { label: 'UTC-12:00', offset: -720 }, { label: 'UTC-11:00', offset: -660 },
    { label: 'UTC-10:00 (夏威夷)', offset: -600 }, { label: 'UTC-09:00', offset: -540 },
    { label: 'UTC-08:00 (洛杉磯)', offset: -480 }, { label: 'UTC-07:00', offset: -420 },
    { label: 'UTC-06:00', offset: -360 }, { label: 'UTC-05:00 (紐約)', offset: -300 },
    { label: 'UTC-04:00', offset: -240 }, { label: 'UTC-03:00', offset: -180 },
    { label: 'UTC-02:00', offset: -120 }, { label: 'UTC-01:00', offset: -60 },
    { label: 'UTC+00:00 (倫敦)', offset: 0 }, { label: 'UTC+01:00 (柏林)', offset: 60 },
    { label: 'UTC+02:00', offset: 120 }, { label: 'UTC+03:00', offset: 180 },
    { label: 'UTC+04:00', offset: 240 }, { label: 'UTC+05:00', offset: 300 },
    { label: 'UTC+05:30 (印度)', offset: 330 }, { label: 'UTC+06:00', offset: 360 },
    { label: 'UTC+07:00 (曼谷)', offset: 420 }, { label: 'UTC+08:00 (台北/香港/新加坡)', offset: 480 },
    { label: 'UTC+09:00 (東京/首爾)', offset: 540 }, { label: 'UTC+10:00 (雪梨)', offset: 600 },
    { label: 'UTC+12:00 (紐西蘭)', offset: 720 }
  ];

  function initTimezoneSelect() {
    const optionsHtml = TIMEZONE_OPTIONS.map(
      (tz) => `<option value="${tz.offset}" ${tz.offset === 480 ? 'selected' : ''}>${tz.label}</option>`
    ).join('');
    document.getElementById('input-timezone').innerHTML = optionsHtml;
    document.getElementById('match-timezone-b').innerHTML = optionsHtml;
  }

  // ---------- 表單送出 → 排盤 ----------
  async function submitChart() {
    const name = document.getElementById('input-name').value.trim() || '未命名';
    const year = parseInt(document.getElementById('input-year').value, 10);
    const month = parseInt(document.getElementById('input-month').value, 10);
    const day = parseInt(document.getElementById('input-day').value, 10);
    const timeStr = document.getElementById('input-time').value || '12:00';
    const [hour, minute] = timeStr.split(':').map((v) => parseInt(v, 10));
    const city = document.getElementById('input-city').value.trim();
    const country = document.getElementById('input-country').value.trim();
    const tzOffsetMinutes = parseInt(document.getElementById('input-timezone').value, 10);
    const ziShiRule = document.getElementById('input-zishi').value;

    if (!year || !month || !day || Number.isNaN(hour)) {
      showToast('請完整填寫出生年、月、日、時間');
      return;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      showToast('請確認月份與日期是否正確');
      return;
    }

    const input = { year, month, day, hour, minute: minute || 0, tzOffsetMinutes, ziShiRule };

    let chart;
    try {
      chart = Bazi.calculate(input);
      Bazi.attachShishen(chart);
    } catch (e) {
      console.error(e);
      showToast('排盤發生錯誤，請確認輸入資料是否正確');
      return;
    }

    const wuxingRatio = Bazi.calcWuxingRatio(chart);
    const shensha = Bazi.calcShensha(chart);
    const analysis = AIRules.generateFullAnalysis(chart, currentGender, wuxingRatio);

    const record = {
      name,
      gender: currentGender,
      city,
      country,
      input,
      chart,
      wuxingRatio,
      shensha,
      analysis,
      unlocked: false
    };

    let id;
    try {
      id = await BaziDB.saveChart(record);
    } catch (e) {
      console.error(e);
      showToast('儲存命盤時發生錯誤');
      return;
    }

    currentChartId = id;
    currentChart = chart;
    currentAnalysis = analysis;

    renderResult(record);
    goTo('result');
  }

  // ---------- 渲染命盤結果 ----------
  function renderResult(record) {
    document.getElementById('result-title').textContent = record.name + ' 的命盤';

    // 四柱
    const pillarLabels = { year: '年柱', month: '月柱', day: '日柱', hour: '時柱' };
    const grid = document.getElementById('pillars-grid');
    grid.innerHTML = ['year', 'month', 'day', 'hour'].map((key) => {
      const p = record.chart.pillars[key];
      return `
        <div class="pillar-col">
          <div class="label">${pillarLabels[key]}</div>
          <div class="stem">${p.stem}</div>
          <div class="branch">${p.branch}</div>
          <div class="shishen">${p.stemShishen}</div>
          <div class="hidden-stems">藏干 ${p.hiddenStems.join('')}</div>
        </div>`;
    }).join('');

    document.getElementById('result-daymaster').textContent =
      `日主：${record.chart.dayMaster}（${record.chart.dayMasterWuxing}） ・ 納音：${record.chart.pillars.day.nayin}`;

    // 日元屬性 + 特殊格局（免費展示，提升解鎖興趣）
    const gejuCard = document.getElementById('geju-card');
    if (record.analysis.free.gejuInfo) {
      gejuCard.style.display = 'block';
      document.getElementById('result-day-element').textContent = record.analysis.free.dayElementLabel;
      document.getElementById('result-geju-name').textContent = record.analysis.free.gejuInfo.name;
      document.getElementById('result-geju-teaser').textContent = record.analysis.free.gejuInfo.teaser;
    } else {
      // 舊版本存的命盤紀錄沒有這項資料，優雅隱藏，不顯示空白卡片
      gejuCard.style.display = 'none';
    }

    // 五行圓餅圖
    renderWuxingChart(record.wuxingRatio);

    // 五行喜用建議
    const xiyong = Bazi.calcWuxingXiyong(record.chart);
    document.getElementById('result-yongshen').innerHTML =
      `生於<span class="text-gold" style="font-weight:700">${xiyong.periodLabel}</span>，喜用五行：<span class="text-tech mono" style="font-weight:700">${xiyong.favored.join('、')}</span><br>${xiyong.desc}`;

    // 免費：基礎性格
    document.getElementById('result-personality').textContent = record.analysis.free.personality;

    // 神煞（已依強度排序，最上面即為命主影響最大的神煞）
    const shenshaCard = document.getElementById('shensha-card');
    const shenshaList = document.getElementById('shensha-list');
    if (record.shensha.length > 0) {
      shenshaCard.style.display = 'block';
      const tierColor = { 強: '#D4AF37', 中等: '#00C2FF', 一般: '#9AA3B8' };
      shenshaList.innerHTML = record.shensha.map((s, idx) => {
        const topBadge = idx === 0 && s.tier !== '一般'
          ? '<span class="badge badge-locked" style="margin-left:6px">命主最具影響力</span>' : '';
        return `
          <div style="margin-bottom:14px;padding-bottom:12px;${idx < record.shensha.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.08)' : ''}">
            <p style="margin-bottom:4px">
              <span class="text-gold" style="font-weight:700">${s.name}</span>
              <span class="mono" style="font-size:11px;color:${tierColor[s.tier]}">${s.tier}</span>
              ${topBadge}
            </p>
            <p style="margin-bottom:0">${s.desc}</p>
          </div>`;
      }).join('');
    } else {
      shenshaCard.style.display = 'none';
    }

    // 付費內容鎖定狀態
    if (record.unlocked) {
      showPaidContent(record.analysis, record.gender);
    } else {
      document.getElementById('paid-locked-wrap').style.display = 'block';
      document.getElementById('paid-content-wrap').style.display = 'none';
    }
  }

  function showPaidContent(analysis, gender) {
    document.getElementById('paid-locked-wrap').style.display = 'none';
    const wrap = document.getElementById('paid-content-wrap');
    wrap.style.display = 'block';
    document.getElementById('result-geju-achievement').textContent = analysis.paid.gejuAchievement || '';
    document.getElementById('result-talent').textContent = analysis.paid.talent;
    document.getElementById('result-career').textContent = analysis.paid.career;
    document.getElementById('result-relationship').textContent = analysis.paid.relationship;
    document.getElementById('relationship-title').textContent = gender === 'female' ? '感情策略（正緣・桃花）' : '感情策略';

    // 財富等級徽章
    if (analysis.wealthTierInfo) {
      document.getElementById('result-wealth-tier').innerHTML =
        `<span class="badge badge-locked" style="font-size:13px;padding:6px 14px">財富等級：${analysis.wealthTierInfo.tier}</span>`;
    }
    document.getElementById('result-wealth').textContent = analysis.paid.wealth;
    document.getElementById('result-health').textContent = analysis.paid.health;
  }

  // ---------- 五行圓餅圖（純 SVG 繪製，不依賴外部圖表庫）----------
  function renderWuxingChart(ratio) {
    const size = 120;
    const radius = size / 2;
    const center = size / 2;
    let cumulatePercent = 0;

    function getCoordinatesForPercent(percent) {
      const x = center + radius * Math.cos(2 * Math.PI * percent - Math.PI / 2);
      const y = center + radius * Math.sin(2 * Math.PI * percent - Math.PI / 2);
      return [x, y];
    }

    const order = ['木', '火', '土', '金', '水'];
    let paths = '';
    order.forEach((wx) => {
      const percent = (ratio[wx] || 0) / 100;
      if (percent <= 0) return;
      const [startX, startY] = getCoordinatesForPercent(cumulatePercent);
      cumulatePercent += percent;
      const [endX, endY] = getCoordinatesForPercent(cumulatePercent);
      const largeArcFlag = percent > 0.5 ? 1 : 0;
      paths += `<path d="M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z" fill="${WUXING_COLORS[wx]}" opacity="0.85" />`;
    });

    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${paths}
        <circle cx="${center}" cy="${center}" r="${radius * 0.55}" fill="#0B0F19" />
      </svg>`;
    document.getElementById('wuxing-svg-container').innerHTML = svg;

    const legend = order.map((wx) => `
      <div class="wuxing-legend-item">
        <span><span class="dot" style="background:${WUXING_COLORS[wx]}"></span>${wx}</span>
        <span class="mono">${ratio[wx] || 0}%</span>
      </div>`).join('');
    document.getElementById('wuxing-legend').innerHTML = legend;
  }

  // ---------- 兌換碼解鎖 ----------
  async function tryRedeem() {
    const codeInput = document.getElementById('redeem-code-input').value.trim().toUpperCase();
    if (!codeInput) {
      showToast('請輸入兌換碼');
      return;
    }
    if (!VALID_REDEEM_CODES.map((c) => c.toUpperCase()).includes(codeInput)) {
      showToast('兌換碼無效，請重新確認');
      return;
    }
    if (currentChartId != null) {
      try {
        const updated = await BaziDB.updateChart(currentChartId, { unlocked: true });
        showPaidContent(updated.analysis, updated.gender);
        showToast('解鎖成功！完整報告已開啟');
      } catch (e) {
        console.error(e);
        showToast('解鎖時發生錯誤，請重試');
      }
    }
  }

  // ---------- 歷史命盤列表 ----------
  async function renderHistoryList() {
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '<p class="text-sub text-center">載入中...</p>';
    let charts;
    try {
      charts = await BaziDB.listCharts();
    } catch (e) {
      listEl.innerHTML = '<p class="text-sub text-center">讀取歷史紀錄時發生錯誤</p>';
      return;
    }
    if (charts.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:32px;margin-bottom:12px">🗂</div>
          <p>尚無歷史命盤</p>
          <button class="btn btn-tech btn-sm" onclick="App.goTo('input')">立即排盤</button>
        </div>`;
      return;
    }
    const itemsHtml = charts.map((c) => {
      const dm = c.chart.dayMaster + c.chart.dayMasterWuxing;
      return `
        <div class="history-item" onclick="App.viewChart(${c.id})">
          <div>
            <div class="name">${c.name}　${c.gender === 'male' ? '男' : '女'}</div>
            <div class="meta">${c.input.year}-${String(c.input.month).padStart(2, '0')}-${String(c.input.day).padStart(2, '0')} ・ 日主${dm} ・ ${c.unlocked ? '已解鎖' : '未解鎖'}</div>
          </div>
          <div style="display:flex;gap:12px;align-items:center">
            <button class="delete-btn" onclick="event.stopPropagation(); App.confirmDeleteChart(${c.id}, '${c.name.replace(/'/g, "\\'")}')" aria-label="刪除">🗑</button>
            <span class="text-tech">›</span>
          </div>
        </div>`;
    }).join('');

    const footerHtml = `
      <div style="margin-top:16px;text-align:center">
        <span class="text-sub" style="font-size:12px">共 ${charts.length} 筆紀錄，資料僅存於本機</span>
      </div>`;

    listEl.innerHTML = itemsHtml + footerHtml;
  }

  async function confirmDeleteChart(id, name) {
    const sure = window.confirm(`確定要刪除「${name}」這筆命盤嗎？刪除後無法復原。`);
    if (!sure) return;
    try {
      await BaziDB.deleteChart(id);
      showToast('已刪除這筆命盤');
      renderHistoryList();
    } catch (e) {
      console.error(e);
      showToast('刪除時發生錯誤，請重試');
    }
  }

  async function viewChart(id) {
    let record;
    try {
      record = await BaziDB.getChart(id);
    } catch (e) {
      showToast('讀取命盤時發生錯誤');
      return;
    }
    if (!record) {
      showToast('找不到這筆命盤紀錄');
      return;
    }
    currentChartId = id;
    currentChart = record.chart;
    currentAnalysis = record.analysis;
    currentGender = record.gender;
    renderResult(record);
    goTo('result');
  }

  // ============================================================
  // 合盤配對
  // ============================================================

  async function populateMatchPersonASelect() {
    const sel = document.getElementById('match-person-a');
    const selB = document.getElementById('match-person-b');
    let charts;
    try {
      charts = await BaziDB.listCharts();
    } catch (e) {
      sel.innerHTML = '<option value="">讀取失敗</option>';
      selB.innerHTML = '<option value="">讀取失敗</option>';
      return;
    }
    if (charts.length === 0) {
      sel.innerHTML = '<option value="">尚無命盤，請先建立一筆</option>';
      selB.innerHTML = '<option value="">尚無命盤，請先建立一筆</option>';
      return;
    }
    const optionsHtml = charts.map((c) => {
      const dateStr = `${c.input.year}-${String(c.input.month).padStart(2, '0')}-${String(c.input.day).padStart(2, '0')}`;
      return `<option value="${c.id}">${c.name}（${dateStr}）</option>`;
    }).join('');
    sel.innerHTML = optionsHtml;
    selB.innerHTML = optionsHtml;
  }

  function selectGenderB(g) {
    matchGenderB = g;
    document.querySelectorAll('.gender-toggle .opt[data-gender-b]').forEach((el) => {
      el.classList.toggle('selected', el.dataset.genderB === g);
    });
  }

  // ---------- 對方資料來源切換（從歷史命盤選擇 / 手動輸入）----------
  let matchSourceB = 'history';

  function selectMatchSourceB(source) {
    matchSourceB = source;
    document.querySelectorAll('.gender-toggle .opt[data-source-b]').forEach((el) => {
      el.classList.toggle('selected', el.dataset.sourceB === source);
    });
    document.getElementById('match-b-history-wrap').style.display = source === 'history' ? 'block' : 'none';
    document.getElementById('match-b-manual-wrap').style.display = source === 'manual' ? 'block' : 'none';
  }

  async function submitMatching() {
    const personAId = parseInt(document.getElementById('match-person-a').value, 10);
    if (!personAId) {
      showToast('請先選擇你的命盤');
      return;
    }

    let recordA;
    try {
      recordA = await BaziDB.getChart(personAId);
    } catch (e) {
      showToast('讀取你的命盤時發生錯誤');
      return;
    }
    if (!recordA) {
      showToast('找不到選擇的命盤');
      return;
    }

    let chartB, nameB, genderB;

    if (matchSourceB === 'history') {
      // ---------- 從歷史命盤選擇對方 ----------
      const personBId = parseInt(document.getElementById('match-person-b').value, 10);
      if (!personBId) {
        showToast('請選擇對方的命盤');
        return;
      }
      let recordB;
      try {
        recordB = await BaziDB.getChart(personBId);
      } catch (e) {
        showToast('讀取對方命盤時發生錯誤');
        return;
      }
      if (!recordB) {
        showToast('找不到選擇的對方命盤');
        return;
      }
      chartB = recordB.chart;
      nameB = recordB.name;
      genderB = recordB.gender;
    } else {
      // ---------- 手動輸入對方資料 ----------
      nameB = document.getElementById('match-name-b').value.trim() || '對方';
      const yearB = parseInt(document.getElementById('match-year-b').value, 10);
      const monthB = parseInt(document.getElementById('match-month-b').value, 10);
      const dayB = parseInt(document.getElementById('match-day-b').value, 10);
      const timeStrB = document.getElementById('match-time-b').value || '12:00';
      const [hourB, minuteB] = timeStrB.split(':').map((v) => parseInt(v, 10));
      const tzOffsetB = parseInt(document.getElementById('match-timezone-b').value, 10);

      if (!yearB || !monthB || !dayB || Number.isNaN(hourB)) {
        showToast('請完整填寫對方的出生年、月、日、時間');
        return;
      }

      try {
        chartB = Bazi.calculate({
          year: yearB, month: monthB, day: dayB, hour: hourB, minute: minuteB || 0,
          tzOffsetMinutes: tzOffsetB, ziShiRule: 'late'
        });
        Bazi.attachShishen(chartB);
      } catch (e) {
        console.error(e);
        showToast('對方命盤排盤時發生錯誤，請確認資料是否正確');
        return;
      }
      genderB = matchGenderB;
    }

    const meta = { nameA: recordA.name, nameB, genderA: recordA.gender, genderB };
    const result = Matching.computeMatching(recordA.chart, chartB, meta);

    currentMatchingResult = result;
    matchingUnlocked = false;
    renderMatchingResult(result);
  }

  function renderMatchingResult(result) {
    document.getElementById('match-setup-wrap').style.display = 'none';
    document.getElementById('match-result-wrap').style.display = 'block';

    document.getElementById('match-score-level').textContent = result.level;
    document.getElementById('match-score-level').style.color = result.levelColor;
    document.getElementById('match-score-number').textContent = result.score;
    document.getElementById('match-score-number').style.color = result.levelColor;

    document.getElementById('match-daymasters').innerHTML =
      `${result.meta.nameA}：<span class="text-gold mono">${result.dayMasterA}</span>　${result.meta.nameB}：<span class="text-tech mono">${result.dayMasterB}</span>`;
    document.getElementById('match-free-summary').textContent = result.freeSummary;

    document.getElementById('match-locked-wrap').style.display = matchingUnlocked ? 'none' : 'block';
    document.getElementById('match-paid-wrap').style.display = matchingUnlocked ? 'block' : 'none';
    if (matchingUnlocked) {
      renderMatchingPaidContent(result);
    }
  }

  function renderMatchingPaidContent(result) {
    const yearRelText = result.yearBranchRelation.relations
      .map((r) => `${r.type}：${r.desc}`).join('\n');
    const dayRelText = result.dayBranchRelation.relations
      .map((r) => `${r.type}：${r.desc}`).join('\n');
    document.getElementById('match-year-relation').textContent =
      `${result.yearBranchRelation.branchA} × ${result.yearBranchRelation.branchB}　－　${yearRelText}`;
    document.getElementById('match-day-relation').textContent =
      `${result.dayBranchRelation.branchA} × ${result.dayBranchRelation.branchB}　－　${dayRelText}`;
    document.getElementById('match-nayin-relation').textContent =
      `${result.nayinRelation.nayinA}（${result.nayinRelation.nayinWxA}） × ${result.nayinRelation.nayinB}（${result.nayinRelation.nayinWxB}）　－　${result.nayinRelation.desc}`;
    document.getElementById('match-advice').textContent = result.paidAdvice;
  }

  function tryRedeemMatching() {
    const codeInput = document.getElementById('match-redeem-code-input').value.trim().toUpperCase();
    if (!codeInput) {
      showToast('請輸入兌換碼');
      return;
    }
    if (!VALID_REDEEM_CODES.map((c) => c.toUpperCase()).includes(codeInput)) {
      showToast('兌換碼無效，請重新確認');
      return;
    }
    matchingUnlocked = true;
    document.getElementById('match-locked-wrap').style.display = 'none';
    document.getElementById('match-paid-wrap').style.display = 'block';
    if (currentMatchingResult) {
      renderMatchingPaidContent(currentMatchingResult);
    }
    showToast('解鎖成功！完整合婚分析已開啟');
  }

  function resetMatching() {
    currentMatchingResult = null;
    matchingUnlocked = false;
    document.getElementById('match-setup-wrap').style.display = 'block';
    document.getElementById('match-result-wrap').style.display = 'none';
    document.getElementById('match-name-b').value = '';
    document.getElementById('match-year-b').value = '';
    document.getElementById('match-month-b').value = '';
    document.getElementById('match-day-b').value = '';
    document.getElementById('match-redeem-code-input').value = '';
    selectMatchSourceB('history');
    populateMatchPersonASelect();
  }

  // ---------- 初始化 ----------
  function init() {
    initTimezoneSelect();
  }

  return {
    init,
    goTo,
    selectGender,
    submitChart,
    tryRedeem,
    viewChart,
    confirmDeleteChart,
    selectGenderB,
    selectMatchSourceB,
    submitMatching,
    tryRedeemMatching,
    resetMatching
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
