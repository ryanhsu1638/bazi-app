/**
 * ai-rules.js — 結構化命理知識庫規則引擎（加深版）
 * ------------------------------------------------------------
 * 不連網、不呼叫外部 AI API。純前端 JS 依「日主五行」「日主強弱」
 * 「十神分布（含所在柱位）」「五行對應十神強弱（財星/官殺/印星/食傷）」
 * 等多重排盤結果交叉比對規則庫，產生分析文字。
 *
 * 之後如需切換成真正呼叫 OpenAI/Claude/Gemini API，只需在 app.js
 * 呼叫本模組的地方替換成 fetch API 呼叫，此檔案的資料結構
 * （輸入：chart 排盤結果／輸出：{ personality, talent, career, ... }）
 * 可作為 API 版本的輸出格式規範。
 */

const AIRules = (() => {
  // ============================================================
  // 基礎五行生克對照（用於推算財星／官殺／印星／食傷分別對應哪個五行）
  // ============================================================
  const WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生
  const WUXING_KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' }; // 我克
  const REVERSE_SHENG = { 火: '木', 土: '火', 金: '土', 水: '金', 木: '水' }; // 生我
  const REVERSE_KE = { 土: '木', 金: '火', 水: '土', 木: '金', 火: '水' }; // 克我

  /**
   * 依日主五行，推算「十神能量對應的五行」
   * 比劫＝日主本身五行；印星＝生我者；食傷＝我生者；財星＝我克者；官殺＝克我者
   */
  function getTenGodWuxingMap(dayWx) {
    return {
      比劫: dayWx,
      印星: REVERSE_SHENG[dayWx],
      食傷: WUXING_SHENG[dayWx],
      財星: WUXING_KE[dayWx],
      官殺: REVERSE_KE[dayWx]
    };
  }

  function strengthLabel(ratio) {
    if (ratio >= 28) return '旺';
    if (ratio >= 15) return '中等';
    if (ratio >= 6) return '偏弱';
    return '極弱';
  }

  /**
   * 計算日主強弱（簡化版）
   * 支援力量 = 比劫(同五行) + 印星(生我)
   * 消耗力量 = 食傷(我生) + 財星(我克) + 官殺(克我)
   * 支援 - 消耗 差距大於 12 視為身強，小於 -12 視為身弱，中間視為中和
   */
  function calcDayMasterStrength(dayWx, wuxingRatio) {
    const map = getTenGodWuxingMap(dayWx);
    const support = (wuxingRatio[map.比劫] || 0) + (wuxingRatio[map.印星] || 0);
    const drain = (wuxingRatio[map.食傷] || 0) + (wuxingRatio[map.財星] || 0) + (wuxingRatio[map.官殺] || 0);
    const diff = support - drain;
    let level;
    if (diff >= 12) level = '身強';
    else if (diff <= -12) level = '身弱';
    else level = '中和';
    return { level, support: Math.round(support * 10) / 10, drain: Math.round(drain * 10) / 10, diff: Math.round(diff * 10) / 10 };
  }

  // ---------- 日主五行 → 核心性格基調 ----------
  const DAYMASTER_WUXING_PERSONALITY = {
    木: '性格上你像春天生長的樹木，富有生命力與開創精神，重視原則與理想，待人溫和但內心有主見，不喜歡被過度束縛，適合需要規劃與成長空間的環境。',
    火: '性格上你熱情外放，反應快、表達力強，天生具有感染力與領導特質，容易成為團體中的焦點，但也要留意情緒起伏過大、做事偏急躁的傾向。',
    土: '性格上你踏實穩重，重承諾、重信用，做事按部就班，是身邊的人可以依靠的存在，但有時也會過於保守，需要練習適度冒險與彈性應變。',
    金: '性格上你原則性強、意志堅定，做事講求效率與紀律，重義氣、重是非，具有一定的果斷力與行動力，但也要留意過於剛硬而顯得不易妥協。',
    水: '性格上你思維靈活、善於變通，觀察力敏銳，適應力強，喜歡吸收新知，人際手腕圓融，但也容易想法多變、不容易長期專注在單一目標上。'
  };

  const STRENGTH_PERSONALITY_NOTE = {
    身強: '從整體五行力量來看，你的日主偏「身強」——代表你本身的能量與意志力充足，做事較有主見、抗壓性強，不容易被外界輕易動搖，但也要留意有時過於堅持己見，適度聽取他人意見會讓人際關係更加分。',
    身弱: '從整體五行力量來看，你的日主偏「身弱」——代表你相對容易受環境或他人影響，性格上較為敏感細膩、懂得體察他人，但也容易因為想太多而猶豫不決，建議培養明確的決策原則，減少內耗。',
    中和: '從整體五行力量來看，你的日主力量「中和」——代表你的個性相對平衡，既有一定的主見，也懂得因應環境調整自己，是穩定度較高的命格組合，適應力普遍不錯。'
  };

  // ---------- 十神組合 → 天賦傾向（基礎說明） ----------
  const SHISHEN_TALENT = {
    比肩: '自主性強，適合獨立作業或自行創業，重視公平與對等關係，天生具有不依賴他人的能力。',
    劫財: '行動力強、敢衝敢拚，人脈廣、朋友多，天生具有號召力，但需留意財務上的合夥風險。',
    食神: '具有藝術與生活美學天賦，性情溫和，表達方式細膩優雅，適合創作、美食、設計相關領域。',
    傷官: '聰明反應快，表達力與創意兼具，天生具有打破常規的能力，適合需要展現個人特色的專業或表演相關工作。',
    偏財: '商業嗅覺敏銳，善於掌握機會財，天生具有跨界整合資源的能力，適合業務、投資、斜槓發展。',
    正財: '理財觀念務實穩健，做事按部就班，天生具有累積實力的耐性，適合長期經營型的專業領域。',
    七殺: '抗壓性強、行動力十足，天生具有在逆境中突圍的韌性，適合具挑戰性、需要決斷力的工作環境。',
    正官: '重視制度與紀律，責任感強，天生具有讓人信賴的穩定特質，適合在體制內穩健發展或管理職。',
    偏印: '思維獨特，喜歡鑽研冷門或專業領域，天生具有洞察表象之下本質的敏銳度，適合技術研發、命理玄學等專精工作。',
    正印: '學習能力強、重視內在修養，天生具有累積知識與資源的能力，適合教育、文化、顧問等需要專業累積的領域。'
  };

  // 十神所在柱位 → 對應人生階段的意涵
  const PILLAR_STAGE_MEANING = {
    year: { stage: '早年／原生家庭階段（約16歲以前）', note: '這股特質從小就展現，也與家庭給你的養分或期待有關，是你天賦的起點。' },
    month: { stage: '青壯年／核心發展階段（約16-40歲）', note: '這是你人生主要的舞台，這股特質最容易在事業與人際的核心圈中被看見、發揮影響力。' },
    day: { stage: '中年／自我與親密關係核心', note: '這股特質與你的自我認同、婚姻及最親密的人際互動緊密相關。' },
    hour: { stage: '晚年／子女與人生下半場（約40歲以後）', note: '這股特質會在人生的後半場、或是與晚輩子女的互動中更加彰顯。' }
  };

  // ---------- 財星強弱 → 財運補充說明 ----------
  const WEALTH_STRENGTH_NOTE = {
    旺: '從命盤結構看，你的「財星」力量旺盛，代表你天生對金錢機會的敏感度高，賺錢管道也相對多元，但財旺也要留意「財多身弱」的狀況——如果賺得快、花得也快，建議建立強制儲蓄的習慣，讓財富真正留得住。',
    中等: '從命盤結構看，你的「財星」力量中等，代表你的財運屬於穩健發展型，不會大起大落，透過長期規劃與紀律執行，財富是可以穩步累積的。',
    偏弱: '從命盤結構看，你的「財星」力量偏弱，代表你可能需要更主動地為自己創造賺錢機會，天生不是那種「錢自動找上門」的命格，建議透過提升專業技能、擴展人脈來間接增強財運，也可以參考上方「五行喜用建議」的建議五行，適度補強。',
    極弱: '從命盤結構看，你的「財星」力量非常薄弱，代表你天生的價值觀可能不那麼看重物質累積，更重視精神層面的滿足，這不是壞事，但若有明確的財富目標，會建議尋求專業理財規劃的協助，用紀律彌補天生財星不顯的狀況。'
  };

  // ---------- 財富等級評分表 ----------
  // 綜合「財星強弱」「日主強弱是否能擔財」「財庫有無」三項計算總分，
  // 對應到財富等級標籤。這是本專案自行設計的綜合評分方式，用於呈現一個
  // 較直觀的整體印象，並非傳統命理中單一固定的「財富等級」技法。
  const CAI_LEVEL_BASE_SCORE = { 旺: 3, 中等: 2, 偏弱: 1, 極弱: 0 };

  function calcWealthTier(caiLevel, strengthLevel, wealthStorage) {
    let score = CAI_LEVEL_BASE_SCORE[caiLevel] ?? 1;

    // 日主強弱調整：身強能擔財，財旺又身強是最理想的組合；
    // 身弱財旺則財來得多卻不易掌控，適度扣分反映「財多身弱」的風險
    if (strengthLevel === '身強') {
      if (caiLevel === '旺' || caiLevel === '中等') score += 1;
    } else if (strengthLevel === '身弱') {
      if (caiLevel === '旺') score -= 1;
    }

    // 財庫加分：有財庫代表存得住錢，是額外的加分項
    if (wealthStorage.hasStorage) {
      score += 1.5;
      // 財庫在日柱或時柱（較貼身的位置）額外再加一點
      if (wealthStorage.matchedPillarKeys.includes('day') || wealthStorage.matchedPillarKeys.includes('hour')) {
        score += 0.5;
      }
    }

    score = Math.max(0, score);

    let tier;
    if (score >= 4.5) tier = '上等財格';
    else if (score >= 3) tier = '中上財格';
    else if (score >= 1.5) tier = '中等財格';
    else if (score >= 0.5) tier = '平穩發展型';
    else tier = '需主動創造型';

    return { tier, score: Math.round(score * 10) / 10 };
  }

  // ---------- 財庫分析文字 ----------
  function buildWealthStorageNote(wealthStorage) {
    if (!wealthStorage.hasStorage) {
      return `以你的日主五行來看，「財星」對應的是「${wealthStorage.wealthElement}」，其墓庫地支「${wealthStorage.storageBranch}」並未出現在你的命盤中，代表傳統命理上所說的「財庫」不顯。這不代表賺不到錢，而是財富較容易隨賺隨用、不易自然沉澱，建議透過強制儲蓄、定期定額投資等紀律性做法，主動為自己建立「財庫」。`;
    }

    let note = `以你的日主五行來看，「財星」對應的是「${wealthStorage.wealthElement}」，其墓庫地支「${wealthStorage.storageBranch}」出現在你的${wealthStorage.matchedPillars.join('、')}，代表傳統命理上所說的「財庫」已經具備——你天生比較容易把賺到的錢留住、轉化為存款或資產，而不是賺多少花多少。`;

    if (wealthStorage.isClashed) {
      note += `\n\n不過要留意的是，這個財庫同時被你${wealthStorage.clashingPillars.join('、')}的地支「沖」到，傳統命理稱為「財庫逢沖」。這通常代表財務上容易出現較大金額的一次性進出（例如置產、大額投資、突發開銷等），不完全是壞事，有時反而是把存款轉化為實質資產的契機，但建議大額資金進出前，多一份審慎規劃。`;
    } else {
      note += '且這個財庫沒有被其他地支沖動，穩定度較高，是相對單純、有利於長期累積的格局。';
    }
    return note;
  }

  // ---------- 官殺強弱 → 事業補充說明 ----------
  const CAREER_PRESSURE_NOTE = {
    旺: '你命盤中的「官殺」力量旺盛，代表你天生承受工作壓力與責任的能耐較強，適合具挑戰性、需要扛起責任的職位，但也要留意長期高壓下的身心平衡，適度安排休息與紓壓管道。',
    中等: '你命盤中的「官殺」力量中等，代表你對工作壓力的承受度落在一般水準，能穩定地在崗位上發揮，也不至於長期過勞。',
    偏弱: '你命盤中的「官殺」力量偏弱，代表你天生不是特別追求體制內的權威地位，反而更適合彈性、自主性高的工作型態，若進入高壓體制內工作，可能需要更多心理調適。',
    極弱: '你命盤中的「官殺」力量非常薄弱，代表你對「被管束」或「上對下」的權威結構天生比較不適應，更適合能自己做主、彈性安排的工作模式，例如自由接案、創業或高度自主的專業角色。'
  };

  // ---------- 十神 → 感情傾向（男女分流，付費內容） ----------
  const RELATIONSHIP_ANALYSIS = {
    正官: { female: '「正官」代表正緣穩定、對象條件端正，感情發展偏向穩紮穩打，適合經由正式管道（親友介紹、穩定交友圈）認識對象，對方通常有責任感、重視承諾，是適合長期經營婚姻的類型。', male: '重視責任與制度，感情上傾向尋找價值觀契合、能共同規劃未來的長期伴侶，對感情態度認真，不喜歡曖昧不明的關係。' },
    七殺: { female: '「七殺」桃花強烈但需慎防「爛桃花」，對象類型偏向強勢或個性鮮明，感情起伏較大，建議感情初期多花時間觀察對方是否穩定可靠，避免被強烈的吸引力沖昏頭而忽略警訊。', male: '容易被有個性、有主見的對象吸引，感情節奏偏快，容易一見鍾情，需留意衝動之下做出的承諾，給彼此多一點時間確認。' },
    正財: { female: '感情觀務實，重視對方的經濟穩定性與生活能力，適合循序漸進發展的關係，不喜歡不切實際的浪漫，更看重對方是否可靠。', male: '「正財」為正緣象徵，代表對象顧家務實，婚姻穩定度高，適合認真經營的長期關係，你也天生懂得照顧伴侶的生活需求。' },
    偏財: { female: '異性緣佳、社交圈廣，桃花機會多，需留意選擇對象時避免只看外在條件或物質吸引力，多花時間了解對方的內在價值觀。', male: '容易有多段桃花機會，社交手腕靈活、異性緣佳，需要有意識地在感情中做出明確承諾，才能發展出穩定關係，避免給人不夠專一的印象。' },
    食神: { female: '感情觀溫和滋潤，重視生活情趣與相處品質，適合個性溫暖、懂得經營生活的對象，你在關係中會是懂得付出、營造幸福感的一方。', male: '重視伴侶的內在特質與陪伴感，感情發展細水長流，不喜歡激烈的情感波動，追求平順自在的相處模式。' },
    傷官: { female: '感情表現直接、有主見，容易吸引欣賞你才華與個性的對象，但需留意過於強勢或直率的表達方式，有時會讓伴侶感到壓力，適度展現溫柔的一面會讓關係更加分。', male: '欣賞有個性、有想法的對象，感情中重視智識上的共鳴，不喜歡平淡乏味的關係，需要伴侶能跟上你的思維節奏。' },
    比肩: { female: '感情中重視平等對待，不喜歡被過度掌控，適合找到能尊重你獨立性的伴侶，兩人像朋友一樣的相處模式最能讓你自在。', male: '感情中重視對等關係，不喜歡上對下的相處模式，適合個性獨立、有自己生活重心的伴侶。' },
    劫財: { female: '桃花機會不少，但也要留意在感情中因為過於重義氣而吃虧，建議在投入一段關係前，先確認對方是否值得信賴。', male: '朋友多、社交廣，感情機會也多，但需留意不要因為朋友圈的影響而在感情中三心二意，確立目標後應更專注經營。' },
    正印: { female: '感情觀偏向傳統穩重，重視精神層面的契合與被理解的感覺，適合能給予你安全感、願意花時間溝通的伴侶。', male: '重視伴侶帶給你的心靈滋養，欣賞有智慧、成熟穩重的對象，感情發展偏向細水長流。' },
    偏印: { female: '感情觀較為獨立、有個人堅持，不容易輕易對他人敞開心房，一旦認定對方便會深度投入，適合彼此都保有一定個人空間的關係。', male: '重視精神層面的深度交流，容易被特別、有故事的對象吸引，感情中重視理解而非表面熱鬧。' }
  };

  // ---------- 十神 → 事業方向（基礎，付費內容） ----------
  const CAREER_ANALYSIS = {
    正官: '適合體制內、大型企業、公家機關等重視制度與晉升軌道的工作環境，穩定發展、按部就班容易獲得升遷機會，你天生具有讓上級信賴、託付重任的特質。',
    七殺: '適合創業、業務開發、需要決斷力與抗壓性的工作，具有開創格局，是天生的戰將型人才，建議在人生精力最旺盛的階段積極布局，把握擴張機會。',
    正財: '適合財務、會計、資產管理等需要穩健操作的專業領域，也適合經營需要長期口碑累積的實體事業，長期累積可達到財富自由。',
    偏財: '適合業務銷售、投資理財、跨界斜槓經營，善於捕捉商機與整合資源，事業版圖容易多元發展，不喜歡被綁在單一固定的職務上。',
    食神: '適合設計、餐飲、藝術創作、內容創作等發揮個人美感與生活風格的領域，你的作品或成果往往帶有一種讓人感到舒服放鬆的特質。',
    傷官: '適合表演、行銷創意、自媒體經營等需要展現個人特色與創意表達的工作，你天生具有打破框架、創造話題的能力。',
    正印: '適合教育、學術研究、顧問諮詢等需要專業知識累積的領域，你的專業會隨著資歷累積而愈加深厚，是需要時間發酵的長期價值型工作者。',
    偏印: '適合技術研發、命理玄學、冷門專精領域，容易在小眾市場建立專業地位，你的價值往往在少數真正懂行的人眼中才會被看見。',
    比肩: '適合獨立接案、自營工作室或合夥創業，你在能自主決定做事方式的環境中最能發揮實力，不喜歡被過度干涉的工作模式。',
    劫財: '適合需要人脈與團隊合作的業務型工作，你天生擅長號召資源、集結夥伴一起完成目標，但合夥關係的權責劃分建議白紙黑字寫清楚。'
  };

  // ---------- 日主五行 → 財運基調（付費內容） ----------
  const WEALTH_BY_WUXING = {
    木: '你的財運走向偏向「穩健成長型」，適合長期布局的投資（如股票定期定額、不動產），忌諱短期投機。財運高峰期通常出現在五行走「火」運（木生火，才華轉化為實際收益）的階段。',
    火: '你的財運走向偏向「爆發集中型」，容易因人脈與機會財而有明顯的財富躍升期，但同時波動也較大，建議建立穩定的儲蓄機制平衡風險。走「土」運（火生土）時財運通常較為穩固。',
    土: '你的財運走向偏向「累積型」，不動產、實體資產、長期定存對你特別有利，財富累積速度雖不算最快，但相對穩健抗風險。走「金」運（土生金）時容易有實質收穫。',
    金: '你的財運走向偏向「紀律型」，適合有明確規則的投資工具（如債券、指數化投資），你在財務決策上重視原則，走「水」運（金生水）時財路容易打開、資金流動性提升。',
    水: '你的財運走向偏向「靈活型」，善於捕捉市場變化與跨界機會財，適合多元收入來源配置，走「木」運（水生木）時容易有新事業或新收入管道的開展。'
  };

  // ---------- 日主五行 → 健康提醒（付費內容） ----------
  const HEALTH_BY_WUXING = {
    木: { organ: '肝膽系統', note: '建議留意肝臟保養、情緒管理（木旺易怒、木弱易憂鬱），作息規律、避免熬夜有助於維持木氣暢達。' },
    火: { organ: '心血管與小腸系統', note: '建議留意心臟保健與睡眠品質，避免情緒過度亢奮或壓力累積導致心火過旺，適度的有氧運動有助於調節。' },
    土: { organ: '脾胃消化系統', note: '建議留意飲食規律與腸胃保養，思慮過度容易影響脾胃功能，細嚼慢嚥、避免暴飲暴食有幫助。' },
    金: { organ: '肺與呼吸系統、大腸', note: '建議留意呼吸道保健與環境空氣品質，秋冬季節尤其需要注意保暖，適度的深呼吸練習有助於肺氣循環。' },
    水: { organ: '腎臟與泌尿生殖系統', note: '建議留意腎氣保養、避免過度勞累耗損精力，充足睡眠與適量飲水有助於水氣涵養。' }
  };

  // 五行對應臟腑，供「五行偏弱提醒」使用
  const WUXING_ORGAN = {
    木: '肝膽', 火: '心臟與循環系統', 土: '脾胃消化', 金: '肺與呼吸道', 水: '腎臟與泌尿系統'
  };

  function getShishenCounter(chart) {
    const counter = {};
    ['year', 'month', 'hour'].forEach((key) => {
      const s = chart.pillars[key].stemShishen;
      counter[s] = (counter[s] || 0) + 1;
    });
    ['year', 'month', 'day', 'hour'].forEach((key) => {
      chart.pillars[key].hiddenStemsShishen.forEach((item, idx) => {
        const weight = idx === 0 ? 0.6 : 0.3;
        counter[item.shishen] = (counter[item.shishen] || 0) + weight;
      });
    });
    return counter;
  }

  function pickDominantShishen(chart) {
    const counter = getShishenCounter(chart);
    let dominant = '正官';
    let max = -1;
    Object.keys(counter).forEach((k) => {
      if (counter[k] > max) {
        max = counter[k];
        dominant = k;
      }
    });
    return dominant;
  }

  // ============================================================
  // 特殊格局判斷（免費版展示用）
  // ------------------------------------------------------------
  // 傳統命理「格局」理論流派眾多、規則精細，本功能為簡化版判斷，
  // 依優先順序檢查幾種較具代表性、規則相對明確的格局類型：
  //   1. 專旺格（一行得氣）：同類五行極度旺盛，幾乎無官殺剋制
  //      木→曲直格／火→炎上格／土→稼穡格／金→從革格／水→潤下格
  //   2. 從格：日主極度虛弱，命局氣勢一面倒向某一股力量
  //      從財格／從殺格／從兒格（從食傷）
  //   3. 特殊組合格局：殺印相生／官印相生／食神制殺／傷官配印／財多身弱
  //   4. 正格：以命盤中最鮮明的十神命名（一般格局，多數人屬於此類）
  // 多數命盤會落在「正格」，較少數才會落入專旺格或從格這類極端格局，
  // 這是符合命理常態的正常結果，並非判斷有誤。
  // ============================================================
  function determineGeju(chart, wuxingRatio, strengthInfo) {
    const wx = chart.dayMasterWuxing;
    const tenGodMap = getTenGodWuxingMap(wx);
    const biJie = wuxingRatio[tenGodMap.比劫] || 0;
    const yinXing = wuxingRatio[tenGodMap.印星] || 0;
    const shiShang = wuxingRatio[tenGodMap.食傷] || 0;
    const caiXing = wuxingRatio[tenGodMap.財星] || 0;
    const guanSha = wuxingRatio[tenGodMap.官殺] || 0;
    const support = biJie + yinXing;
    const counter = getShishenCounter(chart);
    const c = (name) => counter[name] || 0;

    // ---------- 1. 專旺格：同類五行極度旺盛，幾乎無官殺剋制 ----------
    const ZHUANWANG_NAME = { 木: '曲直格', 火: '炎上格', 土: '稼穡格', 金: '從革格', 水: '潤下格' };
    if (biJie >= 45 && guanSha <= 6) {
      return {
        name: ZHUANWANG_NAME[wx],
        category: '專旺格',
        teaser: `命局中「${wx}」的力量極度旺盛，幾乎不受剋制，形成命理上少見的「一行得氣」格局，代表你的天賦與命運走勢會高度集中在${wx}所代表的特質上，是相對少見、個性鮮明的命格類型。`
      };
    }

    // ---------- 2. 從格：日主極度虛弱，命局氣勢一面倒 ----------
    if (support <= 10 && strengthInfo.diff <= -30) {
      if (caiXing >= 20 && caiXing >= guanSha && caiXing >= shiShang) {
        return { name: '從財格', category: '從格', teaser: '你的日主力量極為薄弱，命局氣勢明顯一面倒向「財星」，形成命理上「捨己從財」的特殊格局，人生際遇與財運波動高度連動，格局特殊，並非常見命格。' };
      }
      if (guanSha >= 20 && guanSha >= caiXing && guanSha >= shiShang) {
        return { name: '從殺格', category: '從格', teaser: '你的日主力量極為薄弱，命局氣勢明顯一面倒向「官殺」，形成命理上「捨己從殺」的特殊格局，人生際遇容易與權威、體制或外在壓力緊密相關，格局特殊，並非常見命格。' };
      }
      if (shiShang >= 20 && shiShang >= caiXing && shiShang >= guanSha) {
        return { name: '從兒格', category: '從格', teaser: '你的日主力量極為薄弱，命局氣勢明顯一面倒向「食傷」，形成命理上「捨己從兒」的特殊格局，才華洋溢、表現欲強，人生舞台在於盡情展現自我，格局特殊，並非常見命格。' };
      }
    }

    // ---------- 3. 特殊組合格局 ----------
    if (guanSha >= 12 && yinXing >= 12) {
      if (c('七殺') >= c('正官')) {
        return { name: '殺印相生格', category: '特殊格局', teaser: '命局中「七殺」與「印星」同時具備一定力量，形成傳統命理推崇的「殺印相生」格局——外在的壓力與挑戰（殺）能被轉化為滋養自身的資源（印），代表你天生具有「化壓力為助力」的特殊能力。' };
      }
      return { name: '官印相生格', category: '特殊格局', teaser: '命局中「正官」與「印星」同時具備一定力量，形成傳統命理推崇的「官印相生」格局——體制內的地位或責任（官）能持續帶來資源與名聲的累積（印），是相對穩健、利於長期發展的格局組合。' };
    }
    if (shiShang >= 12 && guanSha >= 12 && c('食神') >= c('傷官')) {
      return { name: '食神制殺格', category: '特殊格局', teaser: '命局中「食神」與「七殺」同時具備一定力量，形成傳統命理推崇的「食神制殺」格局——你天生具有以柔克剛的智慧，能用從容不迫的方式化解外在的壓力與挑戰，而非正面硬碰硬。' };
    }
    if (shiShang >= 12 && yinXing >= 12 && c('傷官') >= c('食神')) {
      return { name: '傷官配印格', category: '特殊格局', teaser: '命局中「傷官」與「印星」同時具備一定力量，形成傳統命理中的「傷官配印」格局——你的創意、才華與表達能力（傷官）能被印星適度收斂與導正，讓聰明才智發揮在對的地方，而不流於恃才傲物。' };
    }
    if (caiXing >= 28 && strengthInfo.level === '身弱') {
      return { name: '財多身弱格', category: '特殊格局', teaser: '命局中「財星」力量旺盛，但日主本身力量偏弱，形成傳統命理所說的「財多身弱」——眼前的機會與資源不少，但如何真正消化、掌握住這些機會，是你這一生的重要課題。' };
    }
    if (caiXing >= 28 && strengthInfo.level === '身強') {
      return { name: '身強財旺格', category: '特殊格局', teaser: '命局中日主力量強健，「財星」力量也同步旺盛，形成傳統命理中理想的「身強財旺」組合——代表你不僅有機會賺錢，也天生具備足夠的能力去掌握、消化這些機會，是相對難得的好命格組合。' };
    }

    // ---------- 4. 正格：以命盤中最鮮明的十神命名 ----------
    const dominant = pickDominantShishen(chart);
    return {
      name: `${dominant}格`,
      category: '正格',
      teaser: `你的命局屬於命理上最常見的「正格」，以「${dominant}」為命局中最鮮明的主導力量，個性與人生發展方向會圍繞著這股特質展開，是根基相對穩固、發展脈絡清晰的格局類型。`
    };
  }

  // 找出「代表十神」第一次出現在哪一柱的天干（用於敘述人生階段）
  function findShishenPillar(chart, shishenName) {
    const order = ['year', 'month', 'day', 'hour'];
    for (const key of order) {
      if (key === 'day') continue; // 日干本身是日主，不計入
      if (chart.pillars[key].stemShishen === shishenName) {
        return key;
      }
    }
    return 'month'; // 找不到天干透出時，預設用月柱（核心發展階段）敘述
  }

  // 找出五行比例中最低的元素（用於健康提醒的「五行偏弱」補充）
  function findWeakestWuxing(wuxingRatio) {
    let weakest = '木';
    let min = 999;
    Object.keys(wuxingRatio).forEach((wx) => {
      if (wuxingRatio[wx] < min) {
        min = wuxingRatio[wx];
        weakest = wx;
      }
    });
    return { wx: weakest, ratio: min };
  }

  /**
   * 產生完整分析內容
   * @param {object} chart 已由 Bazi.attachShishen 處理過的排盤結果
   * @param {string} gender 'male' | 'female'
   * @param {object} wuxingRatio 由 Bazi.calcWuxingRatio 計算出的五行比例（百分比）
   */
  function generateFullAnalysis(chart, gender, wuxingRatio) {
    const wx = chart.dayMasterWuxing;
    const dominantShishen = pickDominantShishen(chart);
    const tenGodMap = getTenGodWuxingMap(wx);
    const strengthInfo = calcDayMasterStrength(wx, wuxingRatio);

    // ---------- 免費：基礎性格（加深：日主本性 + 身強身弱補充）----------
    const personality = `${DAYMASTER_WUXING_PERSONALITY[wx]}\n\n${STRENGTH_PERSONALITY_NOTE[strengthInfo.level]}`;

    // ---------- 免費：日元屬性 + 特殊格局（提升解鎖興趣用）----------
    const dayElementLabel = `${chart.dayMaster}${wx}`; // 例如「庚金」
    const gejuInfo = determineGeju(chart, wuxingRatio, strengthInfo);

    // ---------- 付費：天賦分析（加深：代表十神 + 所在柱位人生階段）----------
    const talentPillarKey = findShishenPillar(chart, dominantShishen);
    const talentStage = PILLAR_STAGE_MEANING[talentPillarKey];
    const talent = `你命盤中最鮮明的十神是「${dominantShishen}」：${SHISHEN_TALENT[dominantShishen] || SHISHEN_TALENT['正官']}\n\n這股特質主要顯現在${talentStage.stage}。${talentStage.note}`;

    // ---------- 付費：事業方向（加深：代表十神 + 官殺強弱補充）----------
    const guanshaRatio = wuxingRatio[tenGodMap.官殺] || 0;
    const guanshaLevel = strengthLabel(guanshaRatio);
    const career = `${CAREER_ANALYSIS[dominantShishen] || CAREER_ANALYSIS['正官']}\n\n${CAREER_PRESSURE_NOTE[guanshaLevel]}`;

    // ---------- 付費：感情分析（加深：代表十神 + 日支夫妻宮十神補充）----------
    const relationshipEntry = RELATIONSHIP_ANALYSIS[dominantShishen] || RELATIONSHIP_ANALYSIS['正財'];
    const relationshipBase = gender === 'female' ? relationshipEntry.female : relationshipEntry.male;
    const dayHiddenMain = chart.pillars.day.hiddenStemsShishen[0];
    const spousePalaceNote = dayHiddenMain
      ? `再從「夫妻宮」（日支藏干）來看，主氣為「${dayHiddenMain.shishen}」，這代表你對親密伴侶最深層、最真實的期待與相處模式核心，即使表面個性不同，這股力量往往才是感情中真正影響長期相處的關鍵。`
      : '';
    const relationship = `${relationshipBase}\n\n${spousePalaceNote}`;

    // ---------- 付費：財富運勢（加深：日主五行基調 + 財星強弱 + 財富等級 + 財庫分析）----------
    const caiRatio = wuxingRatio[tenGodMap.財星] || 0;
    const caiLevel = strengthLabel(caiRatio);
    const wealthStorage = Bazi.calcWealthStorage(chart);
    const wealthTierInfo = calcWealthTier(caiLevel, strengthInfo.level, wealthStorage);
    const wealthStorageNote = buildWealthStorageNote(wealthStorage);
    const wealth = `${WEALTH_BY_WUXING[wx]}\n\n${WEALTH_STRENGTH_NOTE[caiLevel]}\n\n${wealthStorageNote}`;

    // ---------- 付費：健康提醒（加深：日主五行對應臟腑 + 五行最弱項提醒）----------
    const healthBase = HEALTH_BY_WUXING[wx];
    const weakest = findWeakestWuxing(wuxingRatio);
    const weakestNote = weakest.wx !== wx
      ? `此外，你命盤中五行「${weakest.wx}」的力量相對最弱（約占${weakest.ratio}%），對應到「${WUXING_ORGAN[weakest.wx]}」這部分，平時也可以多留意保養，透過飲食或生活習慣適度補強。`
      : '你命盤中五行分布相對均衡，沒有特別顯著的弱項，維持規律作息與均衡飲食即可。';
    const health = `五行屬${wx}，主要對應「${healthBase.organ}」。${healthBase.note}\n\n${weakestNote}`;

    return {
      dominantShishen,
      strengthInfo,
      wealthTierInfo,
      gejuInfo,
      free: {
        personality,
        dayElementLabel,
        gejuInfo
      },
      paid: {
        talent,
        career,
        relationship,
        wealth,
        health
      }
    };
  }

  return {
    generateFullAnalysis,
    pickDominantShishen,
    calcDayMasterStrength,
    getTenGodWuxingMap
  };
})();
