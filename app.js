const STORAGE_KEYS = { config: "wake-app-config", session: "wake-app-session", entitlement: "wake-app-entitlement" };
const TESTING_RESET_ON_LOAD = true;
const DEFAULT_ENTITLEMENT = { plan: "free" };
const PLAN_COPY = {
  free: {
    label: "Free",
    patrolHeadline: "安全守候为 Pro 功能",
    patrolDetail: "免费版保留完整酒局记录和基础倒计时；守候提醒、多联系人和更强兜底策略需要升级。",
  },
  pro: {
    label: "Pro",
    patrolHeadline: "安全守候已开启",
    patrolDetail: "达到你的量后，30 / 60 分钟无操作会进入提醒节奏。",
  },
};
const PRICING_COPY = {
  buyout: "一次买断，低价解锁完整兜底能力",
  supporter: "免费使用基础功能，也可通过赞助支持继续迭代",
};

const DRINKS = {
  beer:    { id: "beer",    name: "啤酒", unit: "瓶", defaultVolumeMl: 500, defaultAbv: 5,  presetLabel: "500ml / 瓶" },
  wine:    { id: "wine",    name: "红酒", unit: "杯", defaultVolumeMl: 150, defaultAbv: 13, presetLabel: "150ml / 杯" },
  spirits: { id: "spirits", name: "洋酒", unit: "杯", defaultVolumeMl: 50,  defaultAbv: 40, presetLabel: "50ml / 杯" },
  baijiu:  { id: "baijiu",  name: "白酒", unit: "两", defaultVolumeMl: 50,  defaultAbv: 52, presetLabel: "50ml / 两" },
};

const ETHANOL_DENSITY = 0.789;

const MEAL_PARAMS = {
  empty:      { Fmeal: 1.00, tauAbsMin: 45 },
  light:      { Fmeal: 0.90, tauAbsMin: 60 },
  normalMeal: { Fmeal: 0.80, tauAbsMin: 90 },
};

const METABOLISM = {
  beta: 0.015,
  T_high: 0.08,
  T_mild: 0.03,
  T_clear: 0.005,
};

const ALERT_RULES = {
  safe: {
    title: "应酬开局了",
    description: "已喝到你平时量的一半，系统自动报个平安。",
  },
  warning: {
    inactivityMs: 30 * 60 * 1000,
    countdownMs: 60 * 1000,
    title: "还没散，我没事儿，报个平安",
    description: "已超量且 30 分钟无操作，60 秒后将尝试唤起短信。",
    vibration: [250, 150, 250, 150, 800],
  },
  emergency: {
    inactivityMs: 60 * 60 * 1000,
    countdownMs: 60 * 1000,
    title: "我喝断片儿了，请速来接我",
    description: "已超量且 60 分钟无操作，60 秒后将尝试唤起短信。",
    vibration: [450, 150, 450, 150, 450, 150, 900],
  },
};

const app = document.querySelector("#app");

const state = {
  config: loadConfig(),
  session: loadSession(),
  entitlement: loadEntitlement(),
  ui: { modal: null, prompt: null, toast: null },
  timers: { warningTimeout: null, emergencyTimeout: null, promptTick: null, vibrationTick: null, clockTick: null, toastTick: null },
};

bootstrap();

function bootstrap() {
  if (TESTING_RESET_ON_LOAD) {
    window.localStorage.removeItem(STORAGE_KEYS.config);
    window.localStorage.removeItem(STORAGE_KEYS.session);
    state.config = null;
    state.session = createEmptySession();
  }
  rolloverSessionIfNeeded();
  render();
  startClock();
  schedulePatrol();
  maybeTriggerSafeReport();
  registerServiceWorker();
}

function loadConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.config);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !p.gender || !Number.isFinite(Number(p.weight)) || !Number.isFinite(Number(p.alcoholThreshold)) || !p.emergencyContact) return null;
    return {
      gender: p.gender,
      weight: Number(p.weight),
      heightCm: Number.isFinite(Number(p.heightCm)) ? Number(p.heightCm) : null,
      age: Number.isFinite(Number(p.age)) ? Number(p.age) : null,
      alcoholThreshold: Number(p.alcoholThreshold),
      emergencyContact: String(p.emergencyContact).trim(),
    };
  } catch { return null; }
}

function loadEntitlement() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.entitlement);
    if (!raw) return { ...DEFAULT_ENTITLEMENT };
    const p = JSON.parse(raw);
    if (!p || !["free", "pro", "supporter"].includes(p.plan)) return { ...DEFAULT_ENTITLEMENT };
    return { plan: p.plan };
  } catch { return { ...DEFAULT_ENTITLEMENT }; }
}

function createEmptySession() {
  const drinks = {};
  Object.values(DRINKS).forEach((d) => { drinks[d.id] = { count: 0, abv: d.defaultAbv, volumeMl: d.defaultVolumeMl }; });
  return {
    dateKey: getTodayKey(), startedAt: null, lastDrinkTime: null,
    mealState: null, safeMode: false, safeReportSent: false,
    warningHandled: false, emergencyHandled: false,
    messageLog: [], snapshots: [], drinkEvents: [], drinks,
  };
}

function loadSession() {
  const fallback = createEmptySession();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.session);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    if (!p || p.dateKey !== getTodayKey()) { window.localStorage.removeItem(STORAGE_KEYS.session); return fallback; }
    const s = createEmptySession();
    s.startedAt = Number.isFinite(Number(p.startedAt)) ? Number(p.startedAt) : null;
    s.lastDrinkTime = Number.isFinite(Number(p.lastDrinkTime)) ? Number(p.lastDrinkTime) : null;
    s.mealState = p.mealState || null;
    s.safeMode = Boolean(p.safeMode);
    s.safeReportSent = Boolean(p.safeReportSent);
    s.warningHandled = Boolean(p.warningHandled);
    s.emergencyHandled = Boolean(p.emergencyHandled);
    s.messageLog = Array.isArray(p.messageLog) ? p.messageLog.filter((i) => i && i.type && Number.isFinite(Number(i.at))) : [];
    s.snapshots = Array.isArray(p.snapshots) ? p.snapshots.filter((x) => x && Number.isFinite(Number(x.at)) && Number.isFinite(Number(x.totalGrams))) : [];
    s.drinkEvents = Array.isArray(p.drinkEvents) ? p.drinkEvents.filter((e) => e && e.type && e.action && Number.isFinite(Number(e.timestamp))) : [];
    Object.values(DRINKS).forEach((d) => {
      const sv = p.drinks?.[d.id] ?? {};
      s.drinks[d.id] = { count: clampInt(sv.count, 0), abv: clampNumber(sv.abv, 0.1, 96, d.defaultAbv), volumeMl: clampNumber(sv.volumeMl, 10, 1000, d.defaultVolumeMl) };
    });
    return s;
  } catch { return fallback; }
}

function saveConfig() {
  if (!state.config) { window.localStorage.removeItem(STORAGE_KEYS.config); return; }
  window.localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(state.config));
}

function saveSession() {
  window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(state.session));
}

function saveEntitlement() {
  window.localStorage.setItem(STORAGE_KEYS.entitlement, JSON.stringify(state.entitlement));
}

/* ====== Algorithm Engine: TBW/Widmark Event-Stream Simulation ====== */

function computeVd() {
  const c = state.config;
  if (!c) return 40;
  const w = c.weight;
  const h = c.heightCm;
  const a = c.age;
  if (c.gender === "male") {
    if (h && a) { const tbw = 2.447 - 0.09516 * a + 0.1074 * h + 0.3362 * w; return tbw; }
    return 0.7 * w;
  }
  if (c.gender === "female") {
    if (h) { const hm = h / 100; const bmi = w / (hm * hm); const v = 0.7772 - 0.0099 * bmi; return w * v; }
    return 0.6 * w;
  }
  return 0.65 * w;
}

function simulateBAC() {
  const events = state.session.drinkEvents.filter((e) => e.action === "add");
  if (events.length === 0) return { currentBAC: 0, tHigh: 0, tMild: 0, tClear: 0, soberAtTime: null, peakBAC: 0 };

  const VdL = computeVd();
  const beta = METABOLISM.beta;
  const elimGPerMin = (beta * 10 * VdL) / 60;
  const mealState = state.session.mealState || "normalMeal";
  const { Fmeal, tauAbsMin } = MEAL_PARAMS[mealState] || MEAL_PARAMS.normalMeal;

  const earliestTs = Math.min(...events.map((e) => e.timestamp));
  const now = Date.now();
  const totalMinutes = Math.ceil((now - earliestTs) / 60000) + 720;

  let bodyAlcG = 0;
  let peakBAC = 0;
  let currentBAC = 0;
  let tHigh = null, tMild = null, tClear = null;
  let passedNow = false;
  const nowMin = Math.ceil((now - earliestTs) / 60000);

  for (let t = 0; t <= totalMinutes; t++) {
    let inputPerMin = 0;
    for (const ev of events) {
      const evMin = (ev.timestamp - earliestTs) / 60000;
      if (t >= evMin && t < evMin + tauAbsMin) {
        const eventAbv = normalizeEventAbv(ev.abv);
        const Gi = ev.volumeMl * eventAbv * ETHANOL_DENSITY * Fmeal;
        inputPerMin += Gi / tauAbsMin;
      }
    }
    bodyAlcG = Math.max(0, bodyAlcG + inputPerMin - elimGPerMin);
    const bac = VdL > 0 ? bodyAlcG / (10 * VdL) : 0;
    if (bac > peakBAC) peakBAC = bac;

    if (t === nowMin) { currentBAC = bac; passedNow = true; }

    if (passedNow && t > nowMin) {
      if (tHigh === null && bac <= METABOLISM.T_high) tHigh = (t - nowMin) * 60000;
      if (tMild === null && bac <= METABOLISM.T_mild) tMild = (t - nowMin) * 60000;
      if (tClear === null && bac <= METABOLISM.T_clear) { tClear = (t - nowMin) * 60000; break; }
    }
  }

  if (currentBAC <= METABOLISM.T_high) tHigh = 0;
  if (currentBAC <= METABOLISM.T_mild) tMild = 0;
  if (currentBAC <= METABOLISM.T_clear) tClear = 0;

  const soberAtTime = tClear !== null && tClear > 0 ? now + tClear : (currentBAC > 0 ? now : null);

  return { currentBAC, tHigh: tHigh || 0, tMild: tMild || 0, tClear: tClear || 0, soberAtTime, peakBAC };
}

function getMetrics() {
  const totals = Object.values(DRINKS).reduce((acc, d) => {
    const e = state.session.drinks[d.id];
    const g = e.count * e.volumeMl * (e.abv / 100) * ETHANOL_DENSITY;
    acc.totalAlcoholGrams += g;
    if (e.count > 0) {
      acc.summary.push(`${d.name} ${e.count}${d.unit} (${formatPercent(e.abv)})`);
      acc.breakdown.push({ id: d.id, name: d.name, count: e.count, unit: d.unit, alcoholGrams: g });
    }
    return acc;
  }, { totalAlcoholGrams: 0, summary: [], breakdown: [] });

  const hasDrinks = totals.summary.length > 0;
  const sim = hasDrinks ? simulateBAC() : { currentBAC: 0, tHigh: 0, tMild: 0, tClear: 0, soberAtTime: null, peakBAC: 0 };
  const ratio = state.config ? totals.totalAlcoholGrams / state.config.alcoholThreshold : 0;
  const patrolStatus = getPatrolStatus({ totalAlcoholGrams: totals.totalAlcoholGrams, hasDrinks });
  const drinkBreakdown = totals.breakdown.sort((a, b) => b.alcoholGrams - a.alcoholGrams).map((item) => ({
    ...item,
    share: totals.totalAlcoholGrams > 0 ? item.alcoholGrams / totals.totalAlcoholGrams : 0,
    shareLabel: `${totals.totalAlcoholGrams > 0 ? Math.round((item.alcoholGrams / totals.totalAlcoholGrams) * 100) : 0}%`,
  }));

  const anchorTime = hasDrinks ? state.session.lastDrinkTime ?? state.session.startedAt : null;

  return {
    totalAlcoholGrams: totals.totalAlcoholGrams, ratio,
    currentBAC: sim.currentBAC, peakBAC: sim.peakBAC,
    tHigh: sim.tHigh, tMild: sim.tMild, tClear: sim.tClear,
    soberAtTime: sim.soberAtTime,
    lastDrinkLabel: anchorTime ? `最后操作 ${formatDateTime(anchorTime)}` : "还没开始记录",
    drinkSummary: totals.summary.length ? totals.summary.join("、") : "未记录饮酒",
    drinkBreakdown, snapshots: state.session.snapshots || [],
    patrolHeadline: patrolStatus.headline, patrolDetail: patrolStatus.detail,
    messageLog: [...state.session.messageLog].sort((a, b) => b.at - a.at),
  };
}

/* ====== Part 2: UI Rendering ====== */

function render() {
  app.innerHTML = state.config ? renderDashboard() : renderSetup();
  syncLiveMetrics();
  syncPromptCountdown();
  syncToast();
}

function renderSetup() {
  return `
    <main class="setup-card">
      <h1>醒了吗?</h1>
      <p class="setup-subtitle">Sober?</p>
      <p>极简饮酒安全兜底与清醒计时工具。所有配置仅保存在你的手机或浏览器本地。</p>
      <form id="setup-form" class="form-grid">
        <div class="field"><label for="gender">性别</label>
          <select id="gender" name="gender" required><option value="">请选择</option><option value="male">男</option><option value="female">女</option><option value="other">其他</option></select></div>
        <div class="field"><label for="weight">体重 (kg)</label>
          <input id="weight" name="weight" type="number" min="30" max="300" step="0.1" required /></div>
        <div class="field"><label for="heightCm">身高 (cm)</label>
          <input id="heightCm" name="heightCm" type="number" min="100" max="250" step="1" placeholder="选填，提高精度" /></div>
        <div class="field"><label for="age">年龄</label>
          <input id="age" name="age" type="number" min="16" max="120" step="1" placeholder="选填，提高精度" /></div>
        <div class="field"><label for="alcoholThreshold">你的量</label>
          <input id="alcoholThreshold" name="alcoholThreshold" type="number" min="5" max="500" step="0.1" required />
          <div class="field-hint">大概喝到这里，你会明显上头（纯酒精 g）。参考：500ml / 5% 啤酒约等于 20g。</div></div>
        <div class="field"><label for="emergencyContact">紧急联系人手机号</label>
          <input id="emergencyContact" name="emergencyContact" type="tel" inputmode="tel" required />
          <div class="field-hint">建议填亲友、死党、好兄弟等，关键时刻为你兜底。</div></div>
        <div class="modal-actions">
          <button class="secondary-btn" data-action="load-demo" type="button">填充演示数据</button>
          <button class="primary-btn" type="submit">进入酒局页</button></div>
      </form>
      <div class="setup-note"><strong>当前版本说明</strong><p>纯前端 Web 版无法静默自动发短信。触发报备/预警时，应用会尝试自动唤起系统短信页并预填内容，同时复制短信文案。</p></div>
    </main>${renderToast()}`;
}

function renderDashboard() {
  const metrics = getMetrics();
  const status = getStatus(metrics);
  const themeClass = getThemeClass(status);
  const safeBtn = state.session.safeMode ? "开始新一局" : "我已安全 / 结束酒局";
  const planLabel = state.entitlement.plan === "pro" ? "Pro" : state.entitlement.plan === "supporter" ? "Supporter" : "Free";
  const patrolCta = state.entitlement.plan === "free"
    ? `<div class="pro-callout"><strong>升级 Pro</strong><p>解锁安全守候、多联系人、更强提醒策略、历史记录与导出。</p><button class="ghost-btn" data-action="open-upgrade" type="button">查看 Pro 权益</button></div>`
    : "";

  return `<div class="market-shell ${themeClass}"><main class="app-shell">
    <section class="topbar">
      <div class="brand-lockup">
        <div class="brand-mark"><svg viewBox="0 0 36 36" width="28" height="28" fill="none"><circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="2"/><text x="18" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">?</text><path d="M12 8 Q14 4 18 6 Q22 8 20 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg></div>
        <div class="brand-wording"><strong>醒了吗?</strong><span>Sober?</span></div>
      </div>
      <div class="header-actions">
        <button class="ghost-btn" data-action="load-demo" type="button">Demo</button>
        <button class="ghost-btn" data-action="open-settings" type="button">设置</button>
        <button class="ghost-btn" data-action="clear-session" type="button">清空</button>
        <span class="status-chip plan-chip">${planLabel}</span>
        <span class="status-chip ${status.className}" data-bind="statusLabel">${status.label}</span>
      </div>
    </section>

    <section class="drinks-card market-card">
      <div class="section-head"><h2>喝了多少</h2><p>点 + 加酒，首次可调度数和容量。</p></div>
      <div class="drink-list">${Object.values(DRINKS).map((d) => renderDrinkCard(d, state.session.drinks[d.id], metrics)).join("")}</div>
    </section>

    <section class="market-card countdown-card">
      <div class="section-head"><h2>还要多久</h2><p>结果为估算值，进食、体型和饮酒速度都会影响实际情况。</p></div>
      ${renderCountdownStages(metrics)}
      <div class="countdown-meta">
        <div class="stat-row"><span>当前累计纯酒精</span><strong data-bind="totalAlcohol">${formatGrams(metrics.totalAlcoholGrams)}</strong></div>
        <div class="stat-row"><span>大概几点缓过来</span><strong data-bind="soberAt">${metrics.soberAtTime ? formatDateTime(metrics.soberAtTime) : "—"}</strong></div>
        <div class="stat-row"><span data-bind="lastDrinkAt">${metrics.lastDrinkLabel}</span></div>
      </div>
    </section>

    <section class="market-card severity-card">
      <div class="section-head"><h2>上头程度</h2></div>
      <div class="severity-value" data-bind="severityValue">${getSeverityLabel(metrics)}</div>
      <div class="severity-ratio">${formatRatio(metrics.ratio)}</div>
      <p class="profile-meta" data-bind="statusDetail">${status.detail}</p>
    </section>

    <section class="market-card patrol-card">
      <div class="section-head"><h2>安全守候</h2><p>30 / 60 min</p></div>
      <strong data-bind="patrolHeadline">${metrics.patrolHeadline}</strong>
      <p class="profile-meta" data-bind="patrolDetail">${metrics.patrolDetail}</p>
      ${patrolCta}
    </section>

    <section class="market-card news-card">
      <div class="section-head"><h2>最近提醒</h2><p>Today only</p></div>
      ${metrics.messageLog.length
        ? `<div class="compact-log-list">${metrics.messageLog.slice(0, 4).map(renderCompactLogItem).join("")}</div>`
        : `<p class="log-empty">还没有触发报备或提醒。</p>`}
    </section>

    <section class="profile-card market-card">
      <div class="section-head"><h2>本机档案</h2><p>仅存在本地，不上传服务器。</p></div>
      <dl>
        <div><dt>性别</dt><dd>${formatGender(state.config.gender)}</dd></div>
        <div><dt>体重</dt><dd>${state.config.weight} kg</dd></div>
        ${state.config.heightCm ? `<div><dt>身高</dt><dd>${state.config.heightCm} cm</dd></div>` : ""}
        ${state.config.age ? `<div><dt>年龄</dt><dd>${state.config.age}</dd></div>` : ""}
      <div><dt>你的量</dt><dd>${formatGrams(state.config.alcoholThreshold)}</dd></div>
        <div><dt>当前版本</dt><dd>${planLabel}</dd></div>
        <div><dt>紧急联系人</dt><dd>${maskPhone(state.config.emergencyContact)}</dd></div>
      </dl>
    </section>

    <section class="disclaimer market-card">
      <div class="section-head"><h2>免责声明</h2><p>这不是医疗工具。</p></div>
      <ul>
        <li>计算基于 Widmark/TBW 事件流估算模型，仅供兜底参考。</li>
        <li>浏览器无法在页面彻底关闭后继续守候，也无法真正静默自动发短信。</li>
        <li>预警触发后会先给你 60 秒本地拦截窗口，再尝试唤起系统短信页并复制文案。</li>
        <li>结果为估算值，进食、体型和饮酒速度都会影响实际情况。</li>
      </ul>
    </section>

  </main>
  <div class="sticky-safe-wrap"><button class="sticky-safe-btn ${state.session.safeMode ? "ended" : ""}" data-action="toggle-safe-mode" type="button">${safeBtn}</button></div>
  ${renderModal()}${renderToast()}</div>`;
}

function renderCountdownStages(metrics) {
  if (metrics.totalAlcoholGrams <= 0) {
    return `<div class="countdown-stages"><div class="stage-row"><span class="stage-label">尚未开始饮酒</span><span class="stage-time">—</span></div></div>`;
  }
  return `<div class="countdown-stages">
    <div class="stage-row high"><span class="stage-emoji">🤯</span><span class="stage-label">晕得厉害</span><span class="stage-time" data-bind="tHigh">预计还要 ${formatDuration(metrics.tHigh)}</span></div>
    <div class="stage-row mild"><span class="stage-emoji">😵‍💫</span><span class="stage-label">还有点晕</span><span class="stage-time" data-bind="tMild">预计还要 ${formatDuration(metrics.tMild)}</span></div>
    <div class="stage-row clear"><span class="stage-emoji">😌</span><span class="stage-label">基本清醒了</span><span class="stage-time" data-bind="tClear">预计还要 ${formatDuration(metrics.tClear)}</span></div>
  </div>`;
}

function getSeverityLabel(metrics) {
  if (metrics.ratio >= 1.5) return "已经非常高了";
  if (metrics.ratio >= 1.0) return "已经很高了";
  if (metrics.ratio >= 0.5) return "有点上头了";
  return "还好";
}

function renderDrinkCard(drink, entry, metrics) {
  const isEnded = state.session.safeMode;
  const bi = metrics.drinkBreakdown.find((i) => i.id === drink.id);
  const share = bi ? bi.shareLabel : "0%";
  return `<article class="drink-card">
    <div class="drink-card-top"><div><h3>${drink.name}</h3><div class="drink-meta">${drink.presetLabel} · 当前度数 ${formatPercent(entry.abv)}</div></div><div class="drink-count">${entry.count}${drink.unit}</div></div>
    <div class="drink-card-bottom"><div class="drink-meta">单次计入 ${entry.volumeMl}ml · 贡献 ${share}</div>
      <div class="drink-actions">
        <button class="circle-btn remove" data-action="drink-remove" data-drink="${drink.id}" type="button" ${entry.count === 0 || isEnded ? "disabled" : ""}>-</button>
        <button class="circle-btn add" data-action="drink-add" data-drink="${drink.id}" type="button" ${isEnded ? "disabled" : ""}>+</button>
      </div></div></article>`;
}

function renderCompactLogItem(item) {
  const labels = { safe: "应酬开局了", warning: "报个平安", emergency: "断片儿提醒" };
  return `<article class="compact-log-item ${item.type}"><div><strong>${labels[item.type] ?? item.type}</strong><span>${formatDateTime(item.at)}</span></div><small>${truncateText(item.message, 28)}</small></article>`;
}

function renderModal() {
  if (!state.ui.modal && !state.ui.prompt) return "";

  if (state.ui.prompt) {
    const p = state.ui.prompt;
    const msg = composeMessage(p.level);
    return `<div class="modal-backdrop"><section class="modal-panel ${p.level}">
      <h2>${ALERT_RULES[p.level].title}</h2><p>${ALERT_RULES[p.level].description}</p>
      <div class="countdown-value"><span data-bind="promptCountdown">${formatPromptCountdown(p.endsAt)}</span><small>后尝试唤起短信</small></div>
      <p class="prompt-subtext">未拦截时会给 ${maskPhone(state.config.emergencyContact)} 发送：</p><p>${msg}</p>
      <div class="modal-actions"><button class="secondary-btn" data-action="cancel-prompt" type="button">取消本次提醒</button><button class="primary-btn" data-action="send-now" data-level="${p.level}" type="button">立即打开短信</button></div>
    </section></div>`;
  }

  if (state.ui.modal.type === "session-start") {
    const nowStr = new Date().toTimeString().slice(0, 5);
    return `<div class="modal-backdrop"><section class="modal-panel">
      <h2>开始新酒局</h2><p>简单确认一下，方便更准确地估算。</p>
      <form id="session-start-form" class="form-grid">
        <div class="field"><label>今天吃了吗？</label>
          <select name="mealState" required><option value="empty">空腹</option><option value="light">吃了点</option><option value="normalMeal" selected>正常吃过饭</option></select></div>
        <div class="field"><label>从什么时候开始喝的？</label>
          <input name="startTime" type="time" value="${nowStr}" /></div>
        <input type="hidden" name="drinkId" value="${state.ui.modal.drinkId || ""}" />
        <div class="modal-actions"><button class="secondary-btn" data-action="close-modal" type="button">取消</button><button class="primary-btn" type="submit">确认开始</button></div>
      </form></section></div>`;
  }

  if (state.ui.modal.type === "settings") {
    const c = state.config;
    return `<div class="modal-backdrop"><section class="modal-panel">
      <h2>设置</h2><p>只保存在本机，不影响已经发出的记录。</p>
      <form id="settings-form" class="form-grid">
        <div class="field"><label for="settings-gender">性别</label><select id="settings-gender" name="gender" required><option value="male" ${c.gender==="male"?"selected":""}>男</option><option value="female" ${c.gender==="female"?"selected":""}>女</option><option value="other" ${c.gender==="other"?"selected":""}>其他</option></select></div>
        <div class="field"><label for="settings-weight">体重 (kg)</label><input id="settings-weight" name="weight" type="number" min="30" max="300" step="0.1" value="${c.weight}" required /></div>
        <div class="field"><label for="settings-height">身高 (cm)</label><input id="settings-height" name="heightCm" type="number" min="100" max="250" step="1" value="${c.heightCm || ""}" placeholder="选填" /></div>
        <div class="field"><label for="settings-age">年龄</label><input id="settings-age" name="age" type="number" min="16" max="120" step="1" value="${c.age || ""}" placeholder="选填" /></div>
        <div class="field"><label for="settings-threshold">你的量</label><input id="settings-threshold" name="alcoholThreshold" type="number" min="5" max="500" step="0.1" value="${c.alcoholThreshold}" required /><div class="field-hint">大概喝到这里，你会明显上头（纯酒精 g）</div></div>
        <div class="field"><label for="settings-contact">紧急联系人手机号</label><input id="settings-contact" name="emergencyContact" type="tel" inputmode="tel" value="${c.emergencyContact}" required /></div>
        <div class="settings-plan-card"><strong>Pro 权益</strong><p>安全守候、多联系人、更强提醒策略、历史记录 / 复盘、导出、自定义酒类。当前保持免费版可传播，不在首次进入时拦截。</p><button class="ghost-btn" data-action="open-upgrade" type="button">查看升级说明</button></div>
        <div class="modal-actions"><button class="secondary-btn" data-action="close-modal" type="button">取消</button><button class="primary-btn" type="submit">保存设置</button></div>
      </form></section></div>`;
  }

  if (state.ui.modal.type === "upgrade") {
    return `<div class="modal-backdrop"><section class="modal-panel">
      <h2>Pro 权益</h2><p>保持现在的记录体验不变，把真正兜底的能力放到付费层。</p>
      <div class="settings-plan-card">
        <strong>Free</strong>
        <p>完整记录酒局，查看基础倒计时和上头程度，不在首次进入时拦截。</p>
      </div>
      <div class="settings-plan-card">
        <strong>Pro</strong>
        <p>安全守候、多联系人、更强提醒策略、更精细算法、历史记录 / 复盘、导出、自定义酒类。</p>
      </div>
      <div class="settings-plan-card">
        <strong>定价方向</strong>
        <p>${PRICING_COPY.buyout}</p>
        <p>${PRICING_COPY.supporter}</p>
        <p>iPhone 原生版将预留 iOS 内购路径。</p>
      </div>
      <div class="modal-actions"><button class="secondary-btn" data-action="close-modal" type="button">先继续免费用</button><button class="primary-btn" data-action="upgrade-coming-soon" type="button">记下这个入口</button></div>
    </section></div>`;
  }

  if (state.ui.modal.type === "abv") {
    const drink = DRINKS[state.ui.modal.drinkId];
    const entry = state.session.drinks[drink.id];
    return `<div class="modal-backdrop"><section class="modal-panel">
      <h2>确认 ${drink.name} 度数</h2><p>首次记录该酒类时可调整度数，后续本次酒局沿用这一设定。</p>
      <form id="abv-form" class="form-grid"><input type="hidden" name="drinkId" value="${drink.id}" />
        <div class="field"><label for="abv-value">酒精度 (%)</label><input id="abv-value" name="abv" type="number" min="0.1" max="96" step="0.1" value="${entry.abv}" required /></div>
        <div class="field"><label for="volume-value">单次容量 (ml)</label><input id="volume-value" name="volumeMl" type="number" min="10" max="1000" step="1" value="${entry.volumeMl}" required /></div>
        <div class="modal-actions"><button class="secondary-btn" data-action="close-modal" type="button">取消</button><button class="primary-btn" type="submit">确认并加 1</button></div>
      </form></section></div>`;
  }

  if (state.ui.modal.type === "clear-confirm") {
    return `<div class="modal-backdrop"><section class="modal-panel">
      <h2>清空本次酒局？</h2><p>会清除今日酒局数据、守候记录和所有倒计时，本机档案设置会保留。</p>
      <div class="modal-actions"><button class="secondary-btn" data-action="close-modal" type="button">取消</button><button class="primary-btn" data-action="confirm-clear-session" type="button">确认清空</button></div>
    </section></div>`;
  }

  return "";
}

function renderToast() {
  if (!state.ui.toast) return "";
  return `<div class="toast-wrap"><div class="toast">${state.ui.toast}</div></div>`;
}

/* ====== Part 3: Event Handlers, Patrol, Utilities ====== */

function startClock() {
  clearInterval(state.timers.clockTick);
  state.timers.clockTick = window.setInterval(() => {
    if (rolloverSessionIfNeeded()) { clearPrompt(); schedulePatrol(); render(); return; }
    syncLiveMetrics();
    syncPromptCountdown();
  }, 1000);
}

function syncLiveMetrics() {
  if (!state.config) return;
  const metrics = getMetrics();
  const status = getStatus(metrics);
  bindText("totalAlcohol", formatGrams(metrics.totalAlcoholGrams));
  bindText("soberAt", metrics.soberAtTime ? formatDateTime(metrics.soberAtTime) : "—");
  bindText("tHigh", `预计还要 ${formatDuration(metrics.tHigh)}`);
  bindText("tMild", `预计还要 ${formatDuration(metrics.tMild)}`);
  bindText("tClear", `预计还要 ${formatDuration(metrics.tClear)}`);
  bindText("lastDrinkAt", metrics.lastDrinkLabel);
  bindText("statusLabel", status.label);
  bindText("statusDetail", status.detail);
  bindText("severityValue", getSeverityLabel(metrics));
  bindText("patrolHeadline", metrics.patrolHeadline);
  bindText("patrolDetail", metrics.patrolDetail);
  document.querySelectorAll("[data-bind='statusLabel']").forEach((el) => { el.className = `status-chip ${status.className}`; });
}

function syncPromptCountdown() {
  if (!state.ui.prompt) return;
  bindText("promptCountdown", formatPromptCountdown(state.ui.prompt.endsAt));
}

function syncToast() {
  if (!state.ui.toast) return;
  clearTimeout(state.timers.toastTick);
  state.timers.toastTick = window.setTimeout(() => { state.ui.toast = null; render(); }, 2600);
}

function bindText(name, value) {
  const el = document.querySelector(`[data-bind='${name}']`);
  if (el) el.textContent = value;
}

function getPatrolStatus({ totalAlcoholGrams, hasDrinks }) {
  if (!isProPlan()) return { headline: PLAN_COPY.free.patrolHeadline, detail: PLAN_COPY.free.patrolDetail };
  if (state.session.safeMode) return { headline: "守候已关闭", detail: "你已手动结束本次酒局。" };
  if (!hasDrinks) return { headline: "尚未启动", detail: "开始记录饮酒后才会计算守候节奏。" };
  if (state.ui.prompt) return { headline: state.ui.prompt.level === "warning" ? "预警拦截中" : "紧急拦截中", detail: `${formatPromptCountdown(state.ui.prompt.endsAt)} 后尝试唤起短信。` };
  if (totalAlcoholGrams < state.config.alcoholThreshold) return { headline: "等待超量", detail: "达到你的量后，30 / 60 分钟无操作才触发提醒。" };
  const anchor = state.session.lastDrinkTime ?? Date.now();
  const elapsed = Date.now() - anchor;
  const wR = Math.max(ALERT_RULES.warning.inactivityMs - elapsed, 0);
  const eR = Math.max(ALERT_RULES.emergency.inactivityMs - elapsed, 0);
  if (!state.session.warningHandled) return { headline: wR > 0 ? `${formatDuration(wR)}后预警` : "预警待触发", detail: `紧急提醒剩余 ${formatDuration(eR)}。` };
  if (!state.session.emergencyHandled) return { headline: eR > 0 ? `${formatDuration(eR)}后紧急` : "紧急待触发", detail: "预警已处理，系统继续观察你的状态。" };
  return { headline: "本轮提醒已处理", detail: "再次加减酒后，会重新开始 30 / 60 分钟守候。" };
}

function getStatus(metrics) {
  if (state.session.safeMode) return { label: "已结束", detail: "守候已关闭", className: "ended" };
  if (metrics.ratio >= 1.5) return { label: "高危", detail: "明显超量，界面切入红色重警示。", className: "red" };
  if (metrics.totalAlcoholGrams >= state.config.alcoholThreshold) return { label: "上头了", detail: "已经超过你的量了，注意节制。", className: "orange" };
  if (metrics.totalAlcoholGrams >= state.config.alcoholThreshold * 0.5) return { label: "微醺", detail: "已达一半，界面切入黄色留意区。", className: "yellow" };
  return { label: "清醒", detail: "仍在可控范围，界面保持冷静基调。", className: "calm" };
}

function getThemeClass(s) {
  return `theme-${s.className === "ended" ? "ended" : s.className === "red" ? "red" : s.className === "orange" ? "orange" : s.className === "yellow" ? "yellow" : "calm"}`;
}

/* -- Event Delegation -- */

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "open-settings") { state.ui.modal = { type: "settings" }; render(); return; }
  if (action === "open-upgrade") { state.ui.modal = { type: "upgrade" }; render(); return; }
  if (action === "upgrade-coming-soon") { state.ui.modal = null; showToast("已记录 Pro 入口，后续接真实买断/赞助解锁。"); return; }
  if (action === "load-demo") { loadDemoScenario(); return; }
  if (action === "close-modal") { state.ui.modal = null; render(); return; }
  if (action === "clear-session") { state.ui.modal = { type: "clear-confirm" }; render(); return; }
  if (action === "confirm-clear-session") { clearPrompt(); clearPatrolTimers(); state.session = createEmptySession(); saveSession(); state.ui.modal = null; showToast("本次酒局已清空。"); render(); return; }
  if (action === "toggle-safe-mode") {
    if (state.session.safeMode) { state.session = createEmptySession(); saveSession(); showToast("已开始新一局。"); }
    else { state.session.safeMode = true; saveSession(); showToast("本次酒局已结束，守候已停止。"); }
    clearPrompt(); schedulePatrol(); render(); return;
  }
  if (action === "drink-add") {
    const drinkId = target.dataset.drink;
    if (state.session.safeMode) return;
    if (!state.session.startedAt) { state.ui.modal = { type: "session-start", drinkId }; render(); return; }
    const entry = state.session.drinks[drinkId];
    if (entry.count === 0) { state.ui.modal = { type: "abv", drinkId }; render(); return; }
    applyDrinkChange(drinkId, 1);
    return;
  }
  if (action === "drink-remove") { if (!state.session.safeMode) applyDrinkChange(target.dataset.drink, -1); return; }
  if (action === "cancel-prompt") { if (state.ui.prompt) { markAlertHandled(state.ui.prompt.level); showToast("本次提醒已拦截。"); clearPrompt(); schedulePatrol(); render(); } return; }
  if (action === "send-now") { const lv = target.dataset.level; if (lv) { markAlertHandled(lv); clearPrompt(); dispatchSafetyMessage(lv); schedulePatrol(); render(); } }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "setup-form") {
    event.preventDefault();
    state.config = readConfigForm(new FormData(form));
    saveConfig(); state.ui.modal = null; showToast("本机档案已保存。"); render(); schedulePatrol(); maybeTriggerSafeReport(); return;
  }
  if (form.id === "settings-form") {
    event.preventDefault();
    state.config = readConfigForm(new FormData(form));
    saveConfig(); state.ui.modal = null; showToast("设置已更新。"); render(); schedulePatrol(); maybeTriggerSafeReport(); return;
  }
  if (form.id === "session-start-form") {
    event.preventDefault();
    const fd = new FormData(form);
    state.session.mealState = String(fd.get("mealState")) || "normalMeal";
    const timeStr = fd.get("startTime");
    if (timeStr) { const [h, m] = timeStr.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); state.session.startedAt = d.getTime(); }
    else { state.session.startedAt = Date.now(); }
    const drinkId = fd.get("drinkId");
    state.ui.modal = null;
    saveSession();
    if (drinkId && DRINKS[drinkId]) {
      const entry = state.session.drinks[drinkId];
      if (entry.count === 0) { state.ui.modal = { type: "abv", drinkId }; render(); return; }
      applyDrinkChange(drinkId, 1);
    } else { render(); }
    return;
  }
  if (form.id === "abv-form") {
    event.preventDefault();
    const fd = new FormData(form);
    const drinkId = String(fd.get("drinkId"));
    const entry = state.session.drinks[drinkId];
    entry.abv = clampNumber(fd.get("abv"), 0.1, 96, entry.abv);
    entry.volumeMl = clampNumber(fd.get("volumeMl"), 10, 1000, entry.volumeMl);
    state.ui.modal = null;
    applyDrinkChange(drinkId, 1);
  }
});

function readConfigForm(fd) {
  return {
    gender: String(fd.get("gender")),
    weight: clampNumber(fd.get("weight"), 30, 300, 70),
    heightCm: fd.get("heightCm") ? clampNumber(fd.get("heightCm"), 100, 250, null) : null,
    age: fd.get("age") ? clampNumber(fd.get("age"), 16, 120, null) : null,
    alcoholThreshold: clampNumber(fd.get("alcoholThreshold"), 5, 500, 40),
    emergencyContact: String(fd.get("emergencyContact")).trim(),
  };
}

function applyDrinkChange(drinkId, delta) {
  const entry = state.session.drinks[drinkId];
  const now = Date.now();
  entry.count = Math.max(0, entry.count + delta);
  state.session.startedAt = state.session.startedAt ?? now;
  state.session.lastDrinkTime = now;
  state.session.warningHandled = false;
  state.session.emergencyHandled = false;
  if (!state.session.mealState) state.session.mealState = "normalMeal";
  state.session.drinkEvents.push({ type: drinkId, action: delta > 0 ? "add" : "remove", abv: entry.abv / 100, volumeMl: entry.volumeMl, timestamp: now });
  const totalG = Object.values(DRINKS).reduce((s, d) => { const e = state.session.drinks[d.id]; return s + e.count * e.volumeMl * (e.abv / 100) * ETHANOL_DENSITY; }, 0);
  if (!state.session.snapshots) state.session.snapshots = [];
  state.session.snapshots.push({ at: now, totalGrams: totalG });
  clearPrompt(); saveSession(); schedulePatrol(); maybeTriggerSafeReport(); render();
}

function maybeTriggerSafeReport() {
  if (!isProPlan()) return;
  if (!state.config || state.session.safeMode || state.session.safeReportSent) return;
  const metrics = getMetrics();
  if (metrics.totalAlcoholGrams > 0 && metrics.totalAlcoholGrams >= state.config.alcoholThreshold * 0.5) {
    state.session.safeReportSent = true; saveSession(); dispatchSafetyMessage("safe"); render();
  }
}

function schedulePatrol() {
  clearPatrolTimers();
  if (!isProPlan()) return;
  if (!state.config || state.session.safeMode) return;
  const metrics = getMetrics();
  if (metrics.totalAlcoholGrams < state.config.alcoholThreshold) return;
  const anchor = state.session.lastDrinkTime ?? Date.now();
  const elapsed = Date.now() - anchor;
  if (!state.session.emergencyHandled && elapsed >= ALERT_RULES.emergency.inactivityMs) { triggerPrompt("emergency"); return; }
  if (!state.session.warningHandled && elapsed >= ALERT_RULES.warning.inactivityMs) { triggerPrompt("warning"); return; }
  if (!state.session.warningHandled) { state.timers.warningTimeout = window.setTimeout(() => triggerPrompt("warning"), Math.max(ALERT_RULES.warning.inactivityMs - elapsed, 0)); }
  if (!state.session.emergencyHandled) { state.timers.emergencyTimeout = window.setTimeout(() => triggerPrompt("emergency"), Math.max(ALERT_RULES.emergency.inactivityMs - elapsed, 0)); }
}

function clearPatrolTimers() { clearTimeout(state.timers.warningTimeout); clearTimeout(state.timers.emergencyTimeout); state.timers.warningTimeout = null; state.timers.emergencyTimeout = null; }

function triggerPrompt(level) {
  if (!isProPlan()) return;
  if (state.ui.prompt || state.session.safeMode) return;
  const m = getMetrics(); if (m.totalAlcoholGrams < state.config.alcoholThreshold) return;
  if (level === "warning" && state.session.warningHandled) return;
  if (level === "emergency" && state.session.emergencyHandled) return;
  clearPrompt(); state.ui.prompt = { level, endsAt: Date.now() + ALERT_RULES[level].countdownMs }; render();
  vibrate(level); state.timers.vibrationTick = window.setInterval(() => vibrate(level), 2400);
  state.timers.promptTick = window.setInterval(() => {
    if (!state.ui.prompt) return;
    if (Date.now() >= state.ui.prompt.endsAt) { const lv = state.ui.prompt.level; markAlertHandled(lv); clearPrompt(); dispatchSafetyMessage(lv); schedulePatrol(); render(); return; }
    syncPromptCountdown();
  }, 250);
}

function clearPrompt() { clearInterval(state.timers.promptTick); clearInterval(state.timers.vibrationTick); state.timers.promptTick = null; state.timers.vibrationTick = null; if (navigator.vibrate) navigator.vibrate(0); state.ui.prompt = null; }
function markAlertHandled(level) { if (level === "warning") state.session.warningHandled = true; if (level === "emergency") state.session.emergencyHandled = true; saveSession(); }

function composeMessage(level) {
  const summary = getMetrics().drinkSummary;
  if (level === "safe") return `【应酬开局了】我正在应酬，当前饮用：${summary}，状态安全，无需担心。`;
  if (level === "warning") return `【还没散，报个平安】当前饮用：${summary}，已超量，请提醒休息。`;
  return `【我喝断片儿了，请速来接我】当前饮用：${summary}，长时间无操作，建议关注安全。`;
}

async function dispatchSafetyMessage(level) {
  if (!isProPlan() && level !== "safe") return;
  if (!state.config) return;
  const message = composeMessage(level);
  state.session.messageLog.unshift({ type: level, at: Date.now(), message });
  state.session.messageLog = state.session.messageLog.slice(0, 10);
  saveSession();
  const copied = await copyText(message);
  const opened = openSmsComposer(state.config.emergencyContact, message);
  if (opened && copied) showToast("已尝试唤起短信页，并复制短信文案。");
  else if (opened) showToast("已尝试唤起短信页。");
  else if (copied) showToast("浏览器未能直接打开短信，文案已复制。");
  else showToast("浏览器未能直接打开短信，请手动复制守候记录。");
  render();
}

function openSmsComposer(phone, message) {
  const p = String(phone || "").replace(/[^\d+]/g, ""); if (!p) return false;
  try { const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent); window.location.href = `sms:${p}${isIOS?"&":"?"}body=${encodeURIComponent(message)}`; return true; } catch { return false; }
}
async function copyText(text) { try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly","readonly"); t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); return true; } catch { return false; } }
function showToast(msg) { state.ui.toast = msg; render(); }
function vibrate(level) { if (navigator.vibrate) navigator.vibrate(ALERT_RULES[level].vibration); }

function loadDemoScenario() {
  clearPrompt(); clearPatrolTimers();
  state.config = { gender: "male", weight: 78, heightCm: 175, age: 35, alcoholThreshold: 50, emergencyContact: "13800138000" };
  state.entitlement = { ...DEFAULT_ENTITLEMENT };
  saveEntitlement();
  const now = Date.now();
  const s = createEmptySession();
  s.startedAt = now - 45 * 60000; s.lastDrinkTime = now - 12 * 60000;
  s.mealState = "light"; s.safeReportSent = true;
  s.drinks.beer.count = 2; s.drinks.wine.count = 1; s.drinks.baijiu.count = 1;
  s.drinkEvents = [
    { type: "beer", action: "add", abv: 0.05, volumeMl: 500, timestamp: now - 42*60000 },
    { type: "beer", action: "add", abv: 0.05, volumeMl: 500, timestamp: now - 38*60000 },
    { type: "wine", action: "add", abv: 0.13, volumeMl: 150, timestamp: now - 25*60000 },
    { type: "baijiu", action: "add", abv: 0.52, volumeMl: 50, timestamp: now - 12*60000 },
  ];
  s.snapshots = [
    { at: now - 42*60000, totalGrams: 19.725 },
    { at: now - 38*60000, totalGrams: 39.45 },
    { at: now - 25*60000, totalGrams: 54.8385 },
    { at: now - 12*60000, totalGrams: 75.3585 },
  ];
  s.messageLog = [{ type: "safe", at: now - 10*60000, message: "【应酬开局了】我正在应酬，当前饮用：啤酒 2瓶 (5%)、红酒 1杯 (13%)、白酒 1两 (52%)，状态安全，无需担心。" }];
  state.session = s; saveConfig(); saveSession(); showToast("已载入演示酒局。"); render(); schedulePatrol();
}

/* -- Formatters & Utils -- */
function formatGrams(v) { return `${Number(v).toFixed(1)}g`; }
function formatPercent(v) { return `${Number(v).toFixed(v%1===0?0:1)}%`; }
function formatDuration(ms) { const m = Math.max(0, Math.ceil(ms/60000)); const h = Math.floor(m/60); const min = m%60; if (h===0) return `${min}分`; if (min===0) return `${h}小时`; return `${h}小时${min}分`; }
function formatPromptCountdown(endsAt) { return `${Math.max(0, Math.ceil((endsAt-Date.now())/1000))}s`; }
function formatRatio(v) { return `喝到你平时量的 ${Math.round(Math.max(v,0)*100)}% 了`; }
function formatDateTime(ts) { const d = new Date(ts); const t = new Date(); const f = new Intl.DateTimeFormat("zh-CN",{hour:"2-digit",minute:"2-digit",hour12:false}).format(d); if (d.toDateString()===t.toDateString()) return `今天 ${f}`; return new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(d); }
function formatGender(g) { return g==="male"?"男":g==="female"?"女":"其他"; }
function maskPhone(p) { const v=String(p||""); return v.length<7?v:`${v.slice(0,3)}****${v.slice(-4)}`; }
function truncateText(t,n) { const v=String(t||""); return v.length<=n?v:`${v.slice(0,n)}...`; }
function getTodayKey() { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; }
function rolloverSessionIfNeeded() { if (state.session.dateKey===getTodayKey()) return false; state.session=createEmptySession(); saveSession(); return true; }
function clampInt(v,min) { const n=Math.floor(Number(v)); return Number.isFinite(n)?Math.max(min,n):min; }
function clampNumber(v,min,max,fb) { const n=Number(v); return Number.isFinite(n)?Math.min(Math.max(n,min),max):fb; }
function normalizeEventAbv(v) { const n = Number(v); if (!Number.isFinite(n) || n <= 0) return 0; return n > 1 ? n / 100 : n; }
function isProPlan() { return state.entitlement.plan === "pro"; }
function registerServiceWorker() { if (!("serviceWorker" in navigator)) return; window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{});}); }
