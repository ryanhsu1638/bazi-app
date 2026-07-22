/**
 * matching.js — 合婚配對分析引擎
 * ------------------------------------------------------------
 * 輸入兩份排盤結果（chartA / chartB），依傳統命理常用的合婚判斷方式：
 *   1. 雙方日主五行生克關係（相生 / 相剋 / 相同）
 *   2. 雙方年支關係（六合／六沖／三合／相刑／平和）－ 影響家庭背景與大方向的契合度
 *   3. 雙方日支關係（六合／六沖／三合／相刑／平和）－ 影響夫妻相處與親密關係的契合度
 * 三項合併計算一個 0-100 的參考分數，並產生對應的文字說明。
 *
 * ⚠️ 說明：傳統合婚方法流派眾多，本模組採用其中最通行、規則最明確的
 * 「日主生克 + 年支/日支合沖刑」simplified 方法，作為趣味參考，
 * 不代表窮盡所有命理合婚要素（完整合婚通常還會參考大運、命宮、用神互補等）。
 */

const Matching = (() => {
  // 日主五行關係 → 基礎分數與說明
  const WUXING_RELATION_SCORE = {
    'A生B': { score: 22, label: '你滋養對方', desc: '你的五行能量生助對方，個性上你常是付出、照顧的一方，關係穩定但需留意避免單方面付出過多。' },
    'B生A': { score: 22, label: '對方滋養你', desc: '對方的五行能量生助你，容易感受到被照顧、被支持，是相處起來很舒服的組合。' },
    '相同': { score: 16, label: '同氣相求', desc: '兩人五行屬性相同，個性或價值觀相近，容易有共鳴，但也要留意興趣過於相似而少了互補性。' },
    'A克B': { score: 10, label: '你較強勢', desc: '五行關係上你對對方形成克制，相處中你可能較容易主導，需要有意識地留空間給對方表達意見。' },
    'B克A': { score: 10, label: '對方較強勢', desc: '五行關係上對方對你形成克制，相處中對方可能較容易主導，需要留意自己的需求是否被充分聽見。' }
  };

  const BRANCH_RELATION_SCORE = {
    六合: 20,
    三合: 16,
    平和: 10,
    同支: 12,
    相刑: 4,
    六沖: 2
  };

  // 納音五行關係 → 分數與說明（權重低於日主，作為輔助判斷維度）
  const NAYIN_RELATION_SCORE = {
    'A生B': { score: 16, desc: '你的年柱納音生助對方的年柱納音，象徵你能為這段關係帶來滋養與助力。' },
    'B生A': { score: 16, desc: '對方的年柱納音生助你的年柱納音，象徵對方能為這段關係帶來滋養與助力。' },
    '相同': { score: 12, desc: '雙方年柱納音五行相同，先天氣場相近，容易有相似的家族背景或人生際遇。' },
    'A克B': { score: 6, desc: '你的年柱納音剋制對方的年柱納音，關係中你可能較容易居於主導地位。' },
    'B克A': { score: 6, desc: '對方的年柱納音剋制你的年柱納音，關係中對方可能較容易居於主導地位。' }
  };

  function scoreForBranchRelations(relations) {
    // 若命中多種關係，取分數最高的當作代表（例如同時六合又... 理論上很少同時命中兩種相斥關係）
    let best = { type: '平和', score: BRANCH_RELATION_SCORE['平和'] };
    relations.forEach((r) => {
      const s = BRANCH_RELATION_SCORE[r.type] ?? 10;
      if (s > best.score) best = { type: r.type, score: s, desc: r.desc };
    });
    return best;
  }

  function scoreToLevel(score) {
    if (score >= 80) return { level: '天作之合', color: '#D4AF37' };
    if (score >= 65) return { level: '相處和諧', color: '#00C2FF' };
    if (score >= 50) return { level: '互相磨合', color: '#5BD8FF' };
    return { level: '需多用心經營', color: '#F87171' };
  }

  /**
   * 計算合盤配對結果
   * @param {object} chartA 已由 Bazi.attachShishen 處理過的排盤結果
   * @param {object} chartB 同上
   * @param {object} meta { nameA, nameB, genderA, genderB }
   */
  function computeMatching(chartA, chartB, meta = {}) {
    const wxA = chartA.dayMasterWuxing;
    const wxB = chartB.dayMasterWuxing;
    const wxRelationKey = Bazi.getWuxingRelation(wxA, wxB);
    const wxInfo = WUXING_RELATION_SCORE[wxRelationKey] || WUXING_RELATION_SCORE['相同'];

    const yearBranchA = chartA.pillars.year.branch;
    const yearBranchB = chartB.pillars.year.branch;
    const yearRelations = Bazi.getBranchRelation(yearBranchA, yearBranchB);
    const yearBest = scoreForBranchRelations(yearRelations);

    const dayBranchA = chartA.pillars.day.branch;
    const dayBranchB = chartB.pillars.day.branch;
    const dayRelations = Bazi.getBranchRelation(dayBranchA, dayBranchB);
    const dayBest = scoreForBranchRelations(dayRelations);

    // 納音合婚：取雙方年柱納音的五行，判斷生克關係
    const nayinA = chartA.pillars.year.nayin;
    const nayinB = chartB.pillars.year.nayin;
    const nayinWxA = Bazi.getNayinWuxing(nayinA);
    const nayinWxB = Bazi.getNayinWuxing(nayinB);
    const nayinRelationKey = Bazi.getWuxingRelation(nayinWxA, nayinWxB);
    const nayinInfo = NAYIN_RELATION_SCORE[nayinRelationKey] || NAYIN_RELATION_SCORE['相同'];

    // 總分：日主生克(權重最高) + 年支合沖刑 + 日支合沖刑x2(夫妻宮權重加倍) + 納音合婚
    // 理論最高分：22(日主) + 20(年支) + 20x2(日支) + 16(納音) = 98
    // 理論最低分：10(日主) + 2(年支) + 2x2(日支) + 6(納音) = 22
    const rawScore = wxInfo.score + yearBest.score + dayBest.score * 2 + nayinInfo.score;
    const normalizedScore = Math.round(((rawScore - 22) / (98 - 22)) * 60 + 40); // 映射到 40-100 區間
    const clampedScore = Math.max(35, Math.min(98, normalizedScore));

    const levelInfo = scoreToLevel(clampedScore);

    return {
      meta,
      score: clampedScore,
      level: levelInfo.level,
      levelColor: levelInfo.color,
      dayMasterA: chartA.dayMaster + wxA,
      dayMasterB: chartB.dayMaster + wxB,
      wuxingRelation: {
        key: wxRelationKey,
        label: wxInfo.label,
        desc: wxInfo.desc
      },
      yearBranchRelation: {
        branchA: yearBranchA,
        branchB: yearBranchB,
        relations: yearRelations
      },
      dayBranchRelation: {
        branchA: dayBranchA,
        branchB: dayBranchB,
        relations: dayRelations
      },
      nayinRelation: {
        nayinA,
        nayinB,
        nayinWxA,
        nayinWxB,
        key: nayinRelationKey,
        desc: nayinInfo.desc
      },
      // 免費：只給總評等級 + 日主關係一句話
      freeSummary: `${meta.nameA || 'A'} 與 ${meta.nameB || 'B'} 的日主五行關係為「${wxInfo.label}」，初步配對等級：${levelInfo.level}。`,
      // 付費：完整分析建議
      paidAdvice: buildAdvice(wxInfo, yearBest, dayBest, nayinInfo, clampedScore)
    };
  }

  function buildAdvice(wxInfo, yearBest, dayBest, nayinInfo, score) {
    const parts = [];
    parts.push(`日主五行關係：${wxInfo.desc}`);
    parts.push(`年支關係（${yearBest.type}）：${yearBest.desc || '關係平和，無明顯先天阻力。'}`);
    parts.push(`日支關係（${dayBest.type}）：${dayBest.desc || '關係平和，無明顯先天阻力。'}日支代表夫妻宮，對親密關係與日常相處影響較大，建議特別留意這一項的提醒。`);
    parts.push(`納音合婚：${nayinInfo.desc}`);

    if (score >= 80) {
      parts.push('整體而言，這是一組先天契合度很高的組合，建議把握彼此的良好基礎，持續用心經營，感情發展可期。');
    } else if (score >= 65) {
      parts.push('整體而言，兩人相處基礎良好，只要用心溝通，是可以長期穩定發展的組合。');
    } else if (score >= 50) {
      parts.push('整體而言，兩人先天個性或步調有些差異，需要更多耐心磨合，但差異也可能帶來互補成長的機會，不代表不適合。');
    } else {
      parts.push('整體而言，兩人先天差異較明顯，相處上可能需要更多包容與溝通技巧，建議正式交往前多花時間深入了解彼此的價值觀與生活習慣。');
    }
    return parts.join('\n\n');
  }

  return {
    computeMatching
  };
})();
