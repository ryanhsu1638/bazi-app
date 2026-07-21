/**
 * bazi.js — 八字排盤核心引擎
 * ------------------------------------------------------------
 * 依賴 astro.js 提供的節氣計算（年柱／月柱交界判斷）。
 *
 * 排盤依據：
 *   年柱：以「立春」為界（非農曆正月初一）
 *   月柱：以十二個「節」為界，月干依「五虎遁」由年干推出
 *   日柱：以儒略日（JD）連續計算 60 甲子循環，
 *         錨點已用兩筆獨立公開資料交叉驗證：
 *         1984-02-02（JD整數2445733，正午）＝ 丙寅日（index=2）
 *         2000-01-01 ＝ 戊午日（index=54）－ 驗證通過
 *   時柱：日干依「五鼠遁」推出時干，時支依出生時刻對應
 *
 * 子時流派（早子時／晚子時）可切換：
 *   晚子時（預設）：23:00-24:59 仍算當天，日柱不換
 *   早子時：23:00 之後即算隔天，日柱提前換
 */

const Bazi = (() => {
  const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  const TIANGAN_WUXING = {
    甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
    己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水'
  };
  const DIZHI_WUXING = {
    子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
    午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水'
  };

  const TIANGAN_YINYANG = { 甲: '陽', 乙: '陰', 丙: '陽', 丁: '陰', 戊: '陽', 己: '陰', 庚: '陽', 辛: '陰', 壬: '陽', 癸: '陰' };

  // 地支藏干（本氣／中氣／餘氣），依傳統命理通行表
  const DIZHI_HIDDEN_STEMS = {
    子: ['癸'],
    丑: ['己', '癸', '辛'],
    寅: ['甲', '丙', '戊'],
    卯: ['乙'],
    辰: ['戊', '乙', '癸'],
    巳: ['丙', '戊', '庚'],
    午: ['丁', '己'],
    未: ['己', '丁', '乙'],
    申: ['庚', '壬', '戊'],
    酉: ['辛'],
    戌: ['戊', '辛', '丁'],
    亥: ['壬', '甲']
  };

  // 60 甲子納音表（傳統固定對照表，出自《三命通會》通行版本）
  const NAYIN_TABLE = {
    甲子: '海中金', 乙丑: '海中金', 丙寅: '爐中火', 丁卯: '爐中火',
    戊辰: '大林木', 己巳: '大林木', 庚午: '路旁土', 辛未: '路旁土',
    壬申: '劍鋒金', 癸酉: '劍鋒金', 甲戌: '山頭火', 乙亥: '山頭火',
    丙子: '澗下水', 丁丑: '澗下水', 戊寅: '城頭土', 己卯: '城頭土',
    庚辰: '白蠟金', 辛巳: '白蠟金', 壬午: '楊柳木', 癸未: '楊柳木',
    甲申: '泉中水', 乙酉: '泉中水', 丙戌: '屋上土', 丁亥: '屋上土',
    戊子: '霹靂火', 己丑: '霹靂火', 庚寅: '松柏木', 辛卯: '松柏木',
    壬辰: '長流水', 癸巳: '長流水', 甲午: '沙中金', 乙未: '沙中金',
    丙申: '山下火', 丁酉: '山下火', 戊戌: '平地木', 己亥: '平地木',
    庚子: '壁上土', 辛丑: '壁上土', 壬寅: '金箔金', 癸卯: '金箔金',
    甲辰: '覆燈火', 乙巳: '覆燈火', 丙午: '天河水', 丁未: '天河水',
    戊申: '大驛土', 己酉: '大驛土', 庚戌: '釵釧金', 辛亥: '釵釧金',
    壬子: '桑柘木', 癸丑: '桑柘木', 甲寅: '大溪水', 乙卯: '大溪水',
    丙辰: '沙中土', 丁巳: '沙中土', 戊午: '天上火', 己未: '天上火',
    庚申: '石榴木', 辛酉: '石榴木', 壬戌: '大海水', 癸亥: '大海水'
  };

  // 日柱計算錨點（已交叉驗證，見檔頭說明）
  const DAY_ANCHOR_JD = 2445733; // 1984-02-02 正午的整數儒略日
  const DAY_ANCHOR_INDEX = 2; // 對應 丙寅（60甲子中索引2，從甲子=0起算）

  function ganzhiIndexToStr(idx) {
    const gan = TIANGAN[idx % 10];
    const zhi = DIZHI[idx % 12];
    return gan + zhi;
  }

  /**
   * 計算日柱（回傳 60 甲子索引 0-59）
   * @param {number} year 西元年（用當地時間視角，已含時辰校正後的「當地日期」）
   * @param {number} month
   * @param {number} day
   * @param {number} tzOffsetMinutes 時區（分鐘），例如台北 +480
   */
  function calcDayPillarIndex(year, month, day, tzOffsetMinutes) {
    // 用正午（12:00 當地時間）取整數儒略日，避免日界的浮點誤差
    const jd = Astro.toJulianDay(year, month, day, 12, 0, tzOffsetMinutes);
    const jdInt = Math.floor(jd + 0.5); // 正午JD理論上已是整數，+0.5保險取整
    const diff = jdInt - DAY_ANCHOR_JD;
    const idx = (((diff + DAY_ANCHOR_INDEX) % 60) + 60) % 60;
    return idx;
  }

  /**
   * 五虎遁：由年干起「正月」（寅月）的月干
   * 甲己之年丙作首，乙庚之歲戊為頭，丙辛必定尋庚起，丁壬壬位順行流，戊癸何方發，甲寅之上好追求
   */
  function getYinMonthStemIndex(yearStemIdx) {
    // 甲0己5 -> 丙2 ； 乙1庚6 -> 戊4 ； 丙2辛7 -> 庚6 ； 丁3壬8 -> 壬8 ； 戊4癸9 -> 甲0
    const map = { 0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0 };
    return map[yearStemIdx];
  }

  /**
   * 五鼠遁：由日干起「子時」的時干
   * 甲己還加甲，乙庚丙作初，丙辛從戊起，丁壬庚子居，戊癸何方發，壬子是真途
   */
  function getZiHourStemIndex(dayStemIdx) {
    const map = { 0: 0, 5: 0, 1: 2, 6: 2, 2: 4, 7: 4, 3: 6, 8: 6, 4: 8, 9: 8 };
    return map[dayStemIdx];
  }

  // 時支對照（每兩小時一個時辰，23:00起算子時）
  function getHourBranchIndex(hour) {
    // 23,0 -> 子(0)；1,2 -> 丑(1)；3,4->寅(2)...
    const adjusted = (hour + 1) % 24; // 讓 23:00-00:59 落在同一組
    return Math.floor(adjusted / 2) % 12;
  }

  /**
   * 主排盤函式
   * @param {object} input
   *   year, month, day, hour, minute — 出生當地時間
   *   tzOffsetMinutes — 時區（分鐘），例如台北 +480，紐約冬令 -300
   *   ziShiRule — 'late'（晚子時，預設）或 'early'（早子時）
   */
  function calculate(input) {
    const { year, month, day, hour, minute, tzOffsetMinutes, ziShiRule = 'late' } = input;

    // ---------- 年柱：以「立春」為界 ----------
    const jdBirth = Astro.toJulianDay(year, month, day, hour, minute, tzOffsetMinutes);
    // 該年立春（用出生年估算節氣，若出生在該年立春之前，年柱要用「前一年」）
    const termsThisYear = Astro.getMajorTermsForYear(year);
    const lichun = termsThisYear[0]; // 12節第一個就是立春
    let baziYear = year;
    if (jdBirth < lichun.jd) {
      baziYear = year - 1;
    }
    // 年干支：以西元年與甲子年的關係推算（西元4年為甲子年的一個參考點：西元4年為甲子年）
    // 通用公式：(西元年 - 4) mod 60 = 該年干支在60甲子的索引（適用於「立春換年」的干支曆）
    const yearGanzhiIdx = (((baziYear - 4) % 60) + 60) % 60;
    const yearStemIdx = yearGanzhiIdx % 10;
    const yearBranchIdx = yearGanzhiIdx % 12;

    // ---------- 月柱：以十二節為界 ----------
    // 取得「以出生年為準」以及「前一年」的12節，因為若出生月份在該年立春之前，
    // 節氣交界可能要參照到前一年年底的節氣（例如小寒在1月上旬，用前一年12節資料即可涵蓋）
    const termsForMonthCalc = baziYear === year ? termsThisYear : Astro.getMajorTermsForYear(baziYear);
    const termsNextYear = Astro.getMajorTermsForYear(baziYear + 1);
    // 12節依序：立春0 驚蟄1 清明2 立夏3 芒種4 小暑5 立秋6 白露7 寒露8 立冬9 大雪10 小寒11
    // 月支對照：立春後為寅月(2)，驚蟄後為卯月(3)...大雪後為子月(0)，小寒後為丑月(1)
    const allTermsSorted = [...termsForMonthCalc, ...termsNextYear].sort((a, b) => a.jd - b.jd);
    // 找出生日期落在哪兩個節氣之間
    let monthBranchIdx = 0; // 預設丑
    // 12節對應地支索引（寅=2 為起點）
    const termToBranch = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];
    // 組合 termsForMonthCalc 的12個節氣，依序對照 termToBranch
    let matched = false;
    for (let i = 0; i < termsForMonthCalc.length; i++) {
      const cur = termsForMonthCalc[i].jd;
      const next = i + 1 < termsForMonthCalc.length ? termsForMonthCalc[i + 1].jd : termsNextYear[0].jd;
      if (jdBirth >= cur && jdBirth < next) {
        monthBranchIdx = termToBranch[i];
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 落在該年小寒之後、次年立春之前，屬於丑月
      monthBranchIdx = 1;
    }

    const monthStemStartIdx = getYinMonthStemIndex(yearStemIdx); // 寅月的月干
    // 寅=2 為起點，往後每個地支月干+1（十天干循環）
    const branchOffsetFromYin = (monthBranchIdx - 2 + 12) % 12;
    const monthStemIdx = (monthStemStartIdx + branchOffsetFromYin) % 10;

    // ---------- 日柱 ----------
    // 依子時流派決定「排盤用日期」：早子時規則下，23:00後的出生時刻要算作隔天的日柱
    let dayCalcYear = year, dayCalcMonth = month, dayCalcDay = day;
    if (ziShiRule === 'early' && hour >= 23) {
      const nextDay = Astro.fromJulianDay(Astro.toJulianDay(year, month, day, 12, 0, tzOffsetMinutes) + 1);
      dayCalcYear = nextDay.year;
      dayCalcMonth = nextDay.month;
      dayCalcDay = nextDay.day;
    }
    const dayGanzhiIdx = calcDayPillarIndex(dayCalcYear, dayCalcMonth, dayCalcDay, tzOffsetMinutes);
    const dayStemIdx = dayGanzhiIdx % 10;
    const dayBranchIdx = dayGanzhiIdx % 12;

    // ---------- 時柱 ----------
    const hourBranchIdx = getHourBranchIndex(hour);
    const ziStartStemIdx = getZiHourStemIndex(dayStemIdx);
    const hourStemIdx = (ziStartStemIdx + hourBranchIdx) % 10;

    function buildPillar(stemIdx, branchIdx) {
      const stem = TIANGAN[stemIdx];
      const branch = DIZHI[branchIdx];
      return {
        stem,
        branch,
        ganzhi: stem + branch,
        stemWuxing: TIANGAN_WUXING[stem],
        branchWuxing: DIZHI_WUXING[branch],
        hiddenStems: DIZHI_HIDDEN_STEMS[branch],
        nayin: NAYIN_TABLE[stem + branch]
      };
    }

    const yearPillar = buildPillar(yearStemIdx, yearBranchIdx);
    const monthPillar = buildPillar(monthStemIdx, monthBranchIdx);
    const dayPillar = buildPillar(dayStemIdx, dayBranchIdx);
    const hourPillar = buildPillar(hourStemIdx, hourBranchIdx);

    const dayMasterStem = dayPillar.stem; // 日主

    return {
      input,
      lichunInfo: Astro.fromJulianDay(lichun.jd),
      baziYear,
      pillars: { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar },
      dayMaster: dayMasterStem,
      dayMasterWuxing: TIANGAN_WUXING[dayMasterStem]
    };
  }

  // ============================================================
  // 十神計算
  // ------------------------------------------------------------
  // 以「日主」（日干）為中心，依對方天干的五行生克關係與陰陽同異，
  // 判斷是比肩／劫財／食神／傷官／偏財／正財／七殺／正官／偏印／正印
  // ============================================================
  const WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生
  const WUXING_KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' }; // 我克

  function getShishen(dayMasterStem, targetStem) {
    if (targetStem === dayMasterStem) return '比肩';
    const dmWx = TIANGAN_WUXING[dayMasterStem];
    const dmYy = TIANGAN_YINYANG[dayMasterStem];
    const tgWx = TIANGAN_WUXING[targetStem];
    const tgYy = TIANGAN_YINYANG[targetStem];
    const sameYinYang = dmYy === tgYy;

    if (tgWx === dmWx) {
      return sameYinYang ? '比肩' : '劫財';
    }
    if (WUXING_SHENG[dmWx] === tgWx) {
      return sameYinYang ? '食神' : '傷官';
    }
    if (WUXING_KE[dmWx] === tgWx) {
      return sameYinYang ? '偏財' : '正財';
    }
    if (WUXING_KE[tgWx] === dmWx) {
      return sameYinYang ? '七殺' : '正官';
    }
    if (WUXING_SHENG[tgWx] === dmWx) {
      return sameYinYang ? '偏印' : '正印';
    }
    return '未知';
  }

  function attachShishen(chart) {
    const dm = chart.dayMaster;
    ['year', 'month', 'day', 'hour'].forEach((key) => {
      const pillar = chart.pillars[key];
      pillar.stemShishen = key === 'day' ? '日主' : getShishen(dm, pillar.stem);
      pillar.hiddenStemsShishen = pillar.hiddenStems.map((hs) => ({
        stem: hs,
        shishen: getShishen(dm, hs)
      }));
    });
    return chart;
  }

  // ============================================================
  // 五行比例統計
  // ------------------------------------------------------------
  function calcWuxingRatio(chart) {
    const counter = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    ['year', 'month', 'day', 'hour'].forEach((key) => {
      const pillar = chart.pillars[key];
      counter[pillar.stemWuxing] += 1;
      const weights = [1, 0.5, 0.3];
      pillar.hiddenStems.forEach((hs, i) => {
        counter[TIANGAN_WUXING[hs]] += weights[i] || 0.3;
      });
    });
    const total = Object.values(counter).reduce((a, b) => a + b, 0);
    const ratio = {};
    Object.keys(counter).forEach((wx) => {
      ratio[wx] = Math.round((counter[wx] / total) * 1000) / 10;
    });
    return ratio;
  }

  // ============================================================
  // 簡化版神煞（僅列入命理上最常見、規則明確的幾種）
  // ============================================================
  const TAOHUA_MAP = {
    申: '酉', 子: '酉', 辰: '酉',
    巳: '午', 酉: '午', 丑: '午',
    寅: '卯', 午: '卯', 戌: '卯',
    亥: '子', 卯: '子', 未: '子'
  };
  const YIMA_MAP = {
    申: '寅', 子: '寅', 辰: '寅',
    巳: '亥', 酉: '亥', 丑: '亥',
    寅: '申', 午: '申', 戌: '申',
    亥: '巳', 卯: '巳', 未: '巳'
  };
  const HUAGAI_MAP = {
    申: '辰', 子: '辰', 辰: '辰',
    巳: '丑', 酉: '丑', 丑: '丑',
    寅: '戌', 午: '戌', 戌: '戌',
    亥: '未', 卯: '未', 未: '未'
  };

  function calcShensha(chart) {
    const dayBranch = chart.pillars.day.branch;
    const allBranches = ['year', 'month', 'day', 'hour'].map((k) => chart.pillars[k].branch);

    const results = [];
    const taohuaTarget = TAOHUA_MAP[dayBranch];
    const yimaTarget = YIMA_MAP[dayBranch];
    const huagaiTarget = HUAGAI_MAP[dayBranch];

    if (allBranches.includes(taohuaTarget)) {
      results.push({ name: '桃花', desc: '人緣佳、異性緣強，感情機會多，但也需留意情感糾葛' });
    }
    if (allBranches.includes(yimaTarget)) {
      results.push({ name: '驛馬', desc: '奔波走動之象，適合外地發展、業務往來或異地工作' });
    }
    if (allBranches.includes(huagaiTarget)) {
      results.push({ name: '華蓋', desc: '聰慧孤高，適合宗教、藝術、命理、研究等專業領域' });
    }
    return results;
  }

  return {
    TIANGAN,
    DIZHI,
    TIANGAN_WUXING,
    DIZHI_WUXING,
    TIANGAN_YINYANG,
    DIZHI_HIDDEN_STEMS,
    NAYIN_TABLE,
    calculate,
    ganzhiIndexToStr,
    getShishen,
    attachShishen,
    calcWuxingRatio,
    calcShensha
  };
})();
