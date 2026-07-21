/**
 * astro.js — 天文計算模組
 * ------------------------------------------------------------
 * 八字排盤的「年柱」「月柱」交界不是用農曆初一，而是用「節氣」
 * （太陽在黃道上的位置）來判斷：
 *   - 年柱以「立春」為界
 *   - 月柱以十二個「節」（不含「氣」）為界：立春、驚蟄、清明、立夏、
 *     芒種、小暑、立秋、白露、寒露、立冬、大雪、小寒
 *
 * 本模組使用天文上「太陽視黃經」的低精度公式（誤差通常在數分鐘內，
 * 足以正確判斷節氣發生的「日期」，滿足排盤需求），
 * 透過二分逼近法反推每個節氣精確發生的世界時，再換算回使用者輸入的時區。
 *
 * 所有公式為天文學通用之太陽位置近似公式，非特定商業library的程式碼。
 */

const Astro = (() => {
  // ---------- 儒略日（Julian Day）轉換 ----------
  // 標準公式（Fliegel & Van Flandern），輸入為「當地時間」年月日時分，
  // outputTimezoneOffsetMinutes：使用者輸入時區與 UTC 的差（例如台北 +480 分鐘）
  function toJulianDay(year, month, day, hour, minute, tzOffsetMinutes) {
    // 先扣除時區差，換算成 UTC 時刻
    let totalMinutes = hour * 60 + minute - tzOffsetMinutes;
    let dayFraction = totalMinutes / 1440;
    let y = year;
    let m = month;
    let d = day + dayFraction;

    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD =
      Math.floor(365.25 * (y + 4716)) +
      Math.floor(30.6001 * (m + 1)) +
      d +
      B -
      1524.5;
    return JD;
  }

  // 儒略日轉回西元年月日時分（UTC）
  function fromJulianDay(jd) {
    const Z = Math.floor(jd + 0.5);
    const F = jd + 0.5 - Z;
    let A = Z;
    if (Z >= 2299161) {
      const alpha = Math.floor((Z - 1867216.25) / 36524.25);
      A = Z + 1 + alpha - Math.floor(alpha / 4);
    }
    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);

    const dayWithFraction = B - D - Math.floor(30.6001 * E) + F;
    const day = Math.floor(dayWithFraction);
    const dayFrac = dayWithFraction - day;
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;

    const totalMinutes = Math.round(dayFrac * 1440);
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    return { year, month, day, hour, minute };
  }

  // ---------- 太陽視黃經（低精度公式，Meeus《天文演算法》通用近似式）----------
  // 回傳角度 0-360 度
  function sunEclipticLongitude(jd) {
    const T = (jd - 2451545.0) / 36525; // 儒略世紀數
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T; // 太陽平黃經
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T; // 太陽平近點角
    const Mrad = (M * Math.PI) / 180;
    const C =
      (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
      0.000289 * Math.sin(3 * Mrad);
    let trueLongitude = L0 + C;
    trueLongitude = ((trueLongitude % 360) + 360) % 360;
    return trueLongitude;
  }

  // ---------- 反推「太陽視黃經 = targetDeg」發生的儒略日 ----------
  // 使用二分逼近法，在 [jdStart, jdEnd] 範圍內尋找
  function findSolarLongitudeCrossing(targetDeg, jdGuessCenter) {
    let lo = jdGuessCenter - 10;
    let hi = jdGuessCenter + 10;

    function angleDiff(jd) {
      let lon = sunEclipticLongitude(jd);
      let diff = lon - targetDeg;
      // 將角度差正規化到 -180 ~ 180，避免 0/360 邊界誤判
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      return diff;
    }

    let diffLo = angleDiff(lo);
    let diffHi = angleDiff(hi);

    // 若邊界符號相同，代表初始猜測範圍不含交點，擴大搜尋窗
    let iterations = 0;
    while (diffLo * diffHi > 0 && iterations < 5) {
      lo -= 5;
      hi += 5;
      diffLo = angleDiff(lo);
      diffHi = angleDiff(hi);
      iterations++;
    }

    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const diffMid = angleDiff(mid);
      if (Math.abs(diffMid) < 0.0001) return mid;
      if (diffLo * diffMid <= 0) {
        hi = mid;
        diffHi = diffMid;
      } else {
        lo = mid;
        diffLo = diffMid;
      }
    }
    return (lo + hi) / 2;
  }

  // 24 節氣名稱（黃經 0 度 = 春分，每 15 度一個節氣，依序排列）
  const SOLAR_TERMS = [
    '春分', '清明', '穀雨', '立夏', '小滿', '芒種',
    '夏至', '小暑', '大暑', '立秋', '處暑', '白露',
    '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
    '冬至', '小寒', '大寒', '立春', '雨水', '驚蟄'
  ];

  // 取得某年份「12 個節」（不含中氣）的西元月日與該節氣對應的儒略日，
  // 用於年柱／月柱交界判斷。回傳陣列，每項含 { name, jd, month(1-12對應12節) }
  // 12 節依序：立春 驚蟄 清明 立夏 芒種 小暑 立秋 白露 寒露 立冬 大雪 小寒
  const MAJOR_TERMS_IN_YEAR_ORDER = [
    { name: '立春', deg: 315 },
    { name: '驚蟄', deg: 345 },
    { name: '清明', deg: 15 },
    { name: '立夏', deg: 45 },
    { name: '芒種', deg: 75 },
    { name: '小暑', deg: 105 },
    { name: '立秋', deg: 135 },
    { name: '白露', deg: 165 },
    { name: '寒露', deg: 195 },
    { name: '立冬', deg: 225 },
    { name: '大雪', deg: 255 },
    { name: '小寒', deg: 285 }
  ];

  /**
   * 計算指定西元年附近，12 個節氣的儒略日時刻（UTC）
   * approxYear: 用來估算搜尋起點的西元年（通常用出生年，必要時會往前一年抓「小寒」）
   */
  function getMajorTermsForYear(approxYear) {
    // 用該年 1 月 1 日附近往回推算儒略日作為每個節氣的初始猜測中心，
    // 12節平均間隔約 30.4368 天，从1月初以此累加即可得到大略猜測點
    const jan1 = toJulianDay(approxYear, 1, 1, 0, 0, 0);
    const results = [];
    for (let i = 0; i < 12; i++) {
      const term = MAJOR_TERMS_IN_YEAR_ORDER[i];
      // 立春约在儒略日 jan1+31 附近，之后每个节大约间隔 30.44 天
      const guessCenter = jan1 + 31 + i * 30.4368;
      const jd = findSolarLongitudeCrossing(term.deg, guessCenter);
      results.push({ name: term.name, jd });
    }
    return results;
  }

  return {
    toJulianDay,
    fromJulianDay,
    sunEclipticLongitude,
    findSolarLongitudeCrossing,
    getMajorTermsForYear,
    SOLAR_TERMS,
    MAJOR_TERMS_IN_YEAR_ORDER
  };
})();
