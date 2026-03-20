const STORAGE_KEYS = {
  config: "wake-app-config",
  session: "wake-app-session",
};

const DRINKS = {
  beer: {
    id: "beer",
    name: "啤酒",
    unit: "瓶",
    defaultVolumeMl: 500,
    defaultAbv: 5,
    presetLabel: "500ml / 瓶",
  },
  wine: {
    id: "wine",
    name: "红酒",
    unit: "杯",
    defaultVolumeMl: 150,
    defaultAbv: 13,
    presetLabel: "150ml / 杯",
  },
  baijiu: {
    id: "baijiu",
    name: "白酒",
    unit: "两",
    defaultVolumeMl: 50,
    defaultAbv: 52,
    presetLabel: "50ml / 两",
  },
  spirits: {
    id: "spirits",
    name: "洋酒",
    unit: "杯",
    defaultVolumeMl: 50,
    defaultAbv: 40,
    presetLabel: "50ml / 杯",
  },
};

const ALERT_RULES = {
  warning: {
    inactivityMs: 30 * 60 * 1000,
    countdownMs: 60 * 1000,
    title: "饮酒预警",
    description: "已超量且 30 分钟无操作，60 秒后将尝试唤起短信。",
    vibration: [250, 150, 250, 150, 800],
  },
  emergency: {
    inactivityMs: 60 * 60 * 1000,
    countdownMs: 60 * 1000,
    title: "紧急提醒",
    description: "已超量且 60 分钟无操作，60 秒后将尝试唤起短信。",
    vibration: [450, 150, 450, 150, 450, 150, 900],
  },
};

const WIDMARK = {
  male: 0.68,
  female: 0.55,
  other: 0.60,
  eliminationRate: 0.015,
};

const app = document.querySelector("#app");

const state = {
  config: loadConfig(),
  session: loadSession(),
  ui: {
    modal: null,
    prompt: null,
    toast: null,
  },
  timers: {
    warningTimeout: null,
    emergencyTimeout: null,
    promptTick: null,
    vibrationTick: null,
    clockTick: null,
    toastTick: null,
  },
};

bootstrap();

function bootstrap() {
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
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !parsed.gender ||
      !Number.isFinite(Number(parsed.weight)) ||
      !Number.isFinite(Number(parsed.alcoholThreshold)) ||
      !parsed.emergencyContact
    ) {
      return null;
    }

    return {
      gender: parsed.gender,
      weight: Number(parsed.weight),
      alcoholThreshold: Number(parsed.alcoholThreshold),
      emergencyContact: String(parsed.emergencyContact).trim(),
    };
  } catch (error) {
    return null;
  }
}

function createEmptySession() {
  const drinks = {};

  Object.values(DRINKS).forEach((drink) => {
    drinks[drink.id] = {
      count: 0,
      abv: drink.defaultAbv,
      volumeMl: drink.defaultVolumeMl,
    };
  });

  return {
    dateKey: getTodayKey(),
    startedAt: null,
    lastDrinkTime: null,
    safeMode: false,
    safeReportSent: false,
    warningHandled: false,
    emergencyHandled: false,
    messageLog: [],
    snapshots: [],
    drinks,
  };
}

function loadSession() {
  const fallback = createEmptySession();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.session);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.dateKey !== getTodayKey()) {
      window.localStorage.removeItem(STORAGE_KEYS.session);
      return fallback;
    }

    const session = createEmptySession();
    session.startedAt = Number.isFinite(Number(parsed.startedAt))
      ? Number(parsed.startedAt)
      : null;
    session.lastDrinkTime = Number.isFinite(Number(parsed.lastDrinkTime))
      ? Number(parsed.lastDrinkTime)
      : null;
    session.safeMode = Boolean(parsed.safeMode);
    session.safeReportSent = Boolean(parsed.safeReportSent);
    session.warningHandled = Boolean(parsed.warningHandled);
    session.emergencyHandled = Boolean(parsed.emergencyHandled);
    session.messageLog = Array.isArray(parsed.messageLog)
      ? parsed.messageLog.filter(
          (item) => item && item.type && Number.isFinite(Number(item.at))
        )
      : [];
    session.snapshots = Array.isArray(parsed.snapshots)
      ? parsed.snapshots.filter(
          (s) => s && Number.isFinite(Number(s.at)) && Number.isFinite(Number(s.totalGrams))
        )
      : [];

    Object.values(DRINKS).forEach((drink) => {
      const savedDrink = parsed.drinks?.[drink.id] ?? {};
      session.drinks[drink.id] = {
        count: clampInt(savedDrink.count, 0),
        abv: clampNumber(savedDrink.abv, 0.1, 96, drink.defaultAbv),
        volumeMl: clampNumber(
          savedDrink.volumeMl,
          10,
          1000,
          drink.defaultVolumeMl
        ),
      };
    });

    return session;
  } catch (error) {
    return fallback;
  }
}

function saveConfig() {
  if (!state.config) {
    window.localStorage.removeItem(STORAGE_KEYS.config);
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEYS.config,
    JSON.stringify(state.config)
  );
}

function saveSession() {
  window.localStorage.setItem(
    STORAGE_KEYS.session,
    JSON.stringify(state.session)
  );
}

function render() {
  app.innerHTML = state.config ? renderDashboard() : renderSetup();
  syncLiveMetrics();
  syncPromptCountdown();
  syncToast();
}

function renderSetup() {
  return `
    <main class="setup-card">
      <h1>醒了吗</h1>
      <p>极简 2D 饮酒安全兜底与清醒计时工具。所有配置仅保存在你的手机或浏览器本地。</p>
      <form id="setup-form" class="form-grid">
        <div class="field">
          <label for="gender">性别</label>
          <select id="gender" name="gender" required>
            <option value="">请选择</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div class="field">
          <label for="weight">体重 (kg)</label>
          <input id="weight" name="weight" type="number" min="30" max="300" step="0.1" required />
        </div>
        <div class="field">
          <label for="alcoholThreshold">个人酒量阈值 (纯酒精 g)</label>
          <input id="alcoholThreshold" name="alcoholThreshold" type="number" min="5" max="500" step="0.1" required />
          <div class="field-hint">参考：500ml / 5% 啤酒约等于 20g 纯酒精。</div>
        </div>
        <div class="field">
          <label for="emergencyContact">紧急联系人手机号</label>
          <input id="emergencyContact" name="emergencyContact" type="tel" inputmode="tel" required />
          <div class="field-hint">建议填亲友、死党、好兄弟等，关键时刻为你兜底。</div>
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" data-action="load-demo" type="button">填充演示数据</button>
          <button class="primary-btn" type="submit">进入酒局页</button>
        </div>
      </form>
      <div class="setup-note">
        <strong>当前版本说明</strong>
        <p>纯前端 Web 版无法静默自动发短信。触发报备/预警时，应用会尝试自动唤起系统短信页并预填内容，同时复制短信文案。</p>
      </div>
    </main>
    ${renderToast()}
  `;
}

function renderDashboard() {
  const metrics = getMetrics();
  const status = getStatus(metrics);
  const themeClass = getThemeClass(status);
  const safeButtonLabel = state.session.safeMode
    ? "开始新一局"
    : "我已安全 / 结束酒局";

  return `
    <div class="market-shell ${themeClass}">
    <main class="app-shell">
      <section class="topbar">
        <div class="brand-lockup">
          <div class="brand-mark">醒</div>
          <div class="brand-wording">
            <strong>醒了吗</strong>
            <span>Drinking Safety Market</span>
          </div>
        </div>
        <div class="search-shell">
          <span class="search-icon">⌕</span>
          <span>搜索酒局状态、清醒时间、提醒节奏...</span>
        </div>
        <div class="header-actions">
          <button class="ghost-btn" data-action="load-demo" type="button">Demo</button>
          <button class="ghost-btn" data-action="open-settings" type="button">设置</button>
          <button class="ghost-btn" data-action="clear-session" type="button">清空</button>
          <span class="status-chip ${status.className}" data-bind="statusLabel">${status.label}</span>
        </div>
      </section>

      <nav class="market-tabs">
        <span class="market-tab active">概览</span>
        <span class="market-tab">饮酒市场</span>
        <span class="market-tab">清醒曲线</span>
        <span class="market-tab">巡逻提醒</span>
      </nav>

      <section class="dashboard-grid">
        <article class="market-card hero-card">
          <div class="market-card-head">
            <div>
              <div class="market-context">Tonight Session · Live Estimate</div>
              <h1>今晚还能多久清醒</h1>
              <p class="tagline">把这局酒当成一张实时行情面板。黄、橙、红会跟着醉酒度一起上升。</p>
            </div>
            <div class="market-head-actions">
              <span class="status-chip ${status.className}" data-bind="statusLabelSecondary">${status.label}</span>
              <button class="mini-btn" data-action="load-demo" type="button">演示一局</button>
            </div>
          </div>
          <div class="market-main">
            <div class="odds-board">
              ${renderStatsBoard(metrics)}
              <div class="market-subnote" data-bind="lastDrinkAt">${metrics.lastDrinkLabel}</div>
            </div>
            <div class="trend-panel">
              <div class="trend-legend">
                <span><i class="legend-dot yellow"></i>轻度</span>
                <span><i class="legend-dot orange"></i>中度</span>
                <span><i class="legend-dot red"></i>重度</span>
              </div>
              <div class="trend-chart">
                <div class="trend-gridlines">
                  <span>150%</span>
                  <span>100%</span>
                  <span>50%</span>
                </div>
                <div class="trend-bars">
                  ${renderTrendBars(metrics, status)}
                </div>
              </div>
              <div class="trend-footer">
                <span>开始</span>
                <span>50% 阈值</span>
                <span>当前</span>
              </div>
              <div class="market-summary">
                <strong data-bind="drinkSummary">${metrics.drinkSummary}</strong>
                <p class="profile-meta" data-bind="ratioDetail">${metrics.ratioLabel}</p>
              </div>
            </div>
          </div>
        </article>

        <aside class="side-rail">
          <section class="rail-card severity-card">
            <div class="section-head">
              <h2>醉酒度</h2>
              <p>Theme follows level</p>
            </div>
            <div class="severity-value">${formatRatio(metrics.ratio)}</div>
            <div class="severity-scale">
              <div class="severity-stop yellow ${metrics.ratio >= 0.5 ? "active" : ""}">
                <span>黄</span>
                <small>微醺</small>
              </div>
              <div class="severity-stop orange ${metrics.ratio >= 1 ? "active" : ""}">
                <span>橙</span>
                <small>醉酒</small>
              </div>
              <div class="severity-stop red ${metrics.ratio >= 1.5 ? "active" : ""}">
                <span>红</span>
                <small>高危</small>
              </div>
            </div>
            <p class="profile-meta" data-bind="statusDetail">${status.detail}</p>
          </section>

          <section class="rail-card patrol-card">
            <div class="section-head">
              <h2>静默巡逻</h2>
              <p>30 / 60 min</p>
            </div>
            <strong data-bind="patrolHeadline">${metrics.patrolHeadline}</strong>
            <p class="profile-meta" data-bind="patrolDetail">${metrics.patrolDetail}</p>
            <div class="patrol-metrics">
              <div>
                <small>清醒倒计时</small>
                <strong data-bind="soberCountdown">${metrics.soberCountdownLabel}</strong>
              </div>
              <div>
                <small>预计清醒</small>
                <strong data-bind="soberAt">${metrics.soberAtLabel}</strong>
              </div>
            </div>
          </section>

          <section class="rail-card news-card">
            <div class="section-head">
              <h2>最近提醒</h2>
              <p>Today only</p>
            </div>
            ${
              metrics.messageLog.length
                ? `<div class="compact-log-list">${metrics.messageLog
                    .slice(0, 4)
                    .map(renderCompactLogItem)
                    .join("")}</div>`
                : `<p class="log-empty">还没有触发报备或提醒。</p>`
            }
          </section>
        </aside>
      </section>

      <section class="drinks-card market-card">
        <div class="section-head">
          <h2>饮酒市场</h2>
          <p>首次加某类酒时可修改度数，后续沿用本次酒局设置。</p>
        </div>
        <div class="drink-list">
          ${Object.values(DRINKS)
            .map((drink) => renderDrinkCard(drink, state.session.drinks[drink.id]))
            .join("")}
        </div>
      </section>

      <section class="lower-grid">
        <section class="profile-card market-card">
          <div class="section-head">
            <h2>本机档案</h2>
            <p>仅存在本地，不上传服务器。</p>
          </div>
          <dl>
            <div>
              <dt>性别</dt>
              <dd>${formatGender(state.config.gender)}</dd>
            </div>
            <div>
              <dt>体重</dt>
              <dd>${state.config.weight} kg</dd>
            </div>
            <div>
              <dt>阈值</dt>
              <dd>${formatGrams(state.config.alcoholThreshold)}</dd>
            </div>
            <div>
              <dt>紧急联系人</dt>
              <dd>${maskPhone(state.config.emergencyContact)}</dd>
            </div>
          </dl>
        </section>

        <section class="disclaimer market-card">
          <div class="section-head">
            <h2>免责声明</h2>
            <p>这不是医疗工具。</p>
          </div>
          <ul>
            <li>计算方式按“纯酒精摄入 ÷ 8g/h”估算，仅供兜底参考。</li>
            <li>浏览器无法在页面彻底关闭后继续巡逻，也无法真正静默自动发短信。</li>
            <li>预警触发后会先给你 60 秒本地拦截窗口，再尝试唤起系统短信页并复制文案。</li>
          </ul>
        </section>
      </section>
    </main>

    <div class="sticky-safe-wrap">
      <button class="sticky-safe-btn ${
        state.session.safeMode ? "ended" : ""
      }" data-action="toggle-safe-mode" type="button">${safeButtonLabel}</button>
    </div>

    ${renderModal()}
    ${renderToast()}
    </div>
  `;
}

function renderStatsBoard(metrics) {
  return `
    <div class="stats-board">
      <div class="stat-row">
        <span>累计纯酒精</span>
        <strong data-bind="totalAlcohol">${formatGrams(metrics.totalAlcoholGrams)}</strong>
      </div>
      <div class="stat-row">
        <span>估算 BAC</span>
        <strong data-bind="estimatedBAC">${formatBAC(metrics.estimatedBAC)}</strong>
      </div>
      <div class="stat-row">
        <span>个人阈值</span>
        <strong data-bind="thresholdLine">阈值 ${formatGrams(
          state.config.alcoholThreshold
        )}</strong>
      </div>
      ${metrics.drinkBreakdown.length ? metrics.drinkBreakdown.map(renderDrinkRankRow).join("") : `
        <div class="stat-row empty">
          <span>还未开始</span>
          <strong>0%</strong>
        </div>
      `}
    </div>
  `;
}

function renderDrinkRankRow(item) {
  return `
    <div class="stat-row rank-row">
      <span>${item.name}</span>
      <strong>${item.shareLabel}</strong>
    </div>
  `;
}

function renderDrinkCard(drink, entry) {
  const isEnded = state.session.safeMode;
  const metrics = getMetrics();
  const breakdownItem = metrics.drinkBreakdown.find((item) => item.id === drink.id);
  const shareLabel = breakdownItem ? breakdownItem.shareLabel : "0%";

  return `
    <article class="drink-card">
      <div class="drink-card-top">
        <div>
          <h3>${drink.name}</h3>
          <div class="drink-meta">${drink.presetLabel} · 当前度数 ${formatPercent(
            entry.abv
          )}</div>
        </div>
        <div class="drink-count">${entry.count}${drink.unit}</div>
      </div>
      <div class="drink-card-bottom">
        <div class="drink-meta">单次计入 ${entry.volumeMl}ml · 贡献 ${shareLabel}</div>
        <div class="drink-actions">
          <button
            class="circle-btn remove"
            data-action="drink-remove"
            data-drink="${drink.id}"
            type="button"
            ${entry.count === 0 || isEnded ? "disabled" : ""}
          >
            -
          </button>
          <button
            class="circle-btn add"
            data-action="drink-add"
            data-drink="${drink.id}"
            type="button"
            ${isEnded ? "disabled" : ""}
          >
            +
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderCompactLogItem(item) {
  const labels = {
    safe: "平安报备",
    warning: "饮酒预警",
    emergency: "紧急提醒",
  };

  return `
    <article class="compact-log-item ${item.type}">
      <div>
        <strong>${labels[item.type] ?? item.type}</strong>
        <span>${formatDateTime(item.at)}</span>
      </div>
      <small>${truncateText(item.message, 28)}</small>
    </article>
  `;
}

function renderLogItem(item) {
  const labels = {
    safe: "平安报备",
    warning: "饮酒预警",
    emergency: "紧急提醒",
  };

  return `
    <article class="log-item ${item.type}">
      <strong>${labels[item.type] ?? item.type}</strong>
      <span>${formatDateTime(item.at)}</span>
      <span>${item.message}</span>
    </article>
  `;
}

function renderModal() {
  if (!state.ui.modal && !state.ui.prompt) {
    return "";
  }

  if (state.ui.prompt) {
    const prompt = state.ui.prompt;
    const message = composeMessage(prompt.level);

    return `
      <div class="modal-backdrop">
        <section class="modal-panel ${prompt.level}">
          <h2>${ALERT_RULES[prompt.level].title}</h2>
          <p>${ALERT_RULES[prompt.level].description}</p>
          <div class="countdown-value">
            <span data-bind="promptCountdown">${formatPromptCountdown(
              prompt.endsAt
            )}</span>
            <small>后尝试唤起短信</small>
          </div>
          <p class="prompt-subtext">未拦截时会给 ${maskPhone(
            state.config.emergencyContact
          )} 发送：</p>
          <p>${message}</p>
          <div class="modal-actions">
            <button class="secondary-btn" data-action="cancel-prompt" type="button">取消本次提醒</button>
            <button class="primary-btn" data-action="send-now" data-level="${
              prompt.level
            }" type="button">立即打开短信</button>
          </div>
        </section>
      </div>
    `;
  }

  if (state.ui.modal.type === "settings") {
    return `
      <div class="modal-backdrop">
        <section class="modal-panel">
          <h2>设置</h2>
          <p>修改本机档案，不影响已发送记录。</p>
          <form id="settings-form" class="form-grid">
            <div class="field">
              <label for="settings-gender">性别</label>
              <select id="settings-gender" name="gender" required>
                <option value="male" ${
                  state.config.gender === "male" ? "selected" : ""
                }>男</option>
                <option value="female" ${
                  state.config.gender === "female" ? "selected" : ""
                }>女</option>
                <option value="other" ${
                  state.config.gender === "other" ? "selected" : ""
                }>其他</option>
              </select>
            </div>
            <div class="field">
              <label for="settings-weight">体重 (kg)</label>
              <input id="settings-weight" name="weight" type="number" min="30" max="300" step="0.1" value="${
                state.config.weight
              }" required />
            </div>
            <div class="field">
              <label for="settings-threshold">个人酒量阈值 (纯酒精 g)</label>
              <input id="settings-threshold" name="alcoholThreshold" type="number" min="5" max="500" step="0.1" value="${
                state.config.alcoholThreshold
              }" required />
            </div>
            <div class="field">
              <label for="settings-contact">紧急联系人手机号</label>
              <input id="settings-contact" name="emergencyContact" type="tel" inputmode="tel" value="${
                state.config.emergencyContact
              }" required />
            </div>
            <div class="modal-actions">
              <button class="secondary-btn" data-action="close-modal" type="button">取消</button>
              <button class="primary-btn" type="submit">保存设置</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  if (state.ui.modal.type === "abv") {
    const drink = DRINKS[state.ui.modal.drinkId];
    const entry = state.session.drinks[drink.id];

    return `
      <div class="modal-backdrop">
        <section class="modal-panel">
          <h2>确认 ${drink.name} 度数</h2>
          <p>首次记录该酒类时可调整度数，后续本次酒局沿用这一设定。</p>
          <form id="abv-form" class="form-grid">
            <input type="hidden" name="drinkId" value="${drink.id}" />
            <div class="field">
              <label for="abv-value">酒精度 (%)</label>
              <input
                id="abv-value"
                name="abv"
                type="number"
                min="0.1"
                max="96"
                step="0.1"
                value="${entry.abv}"
                required
              />
            </div>
            <div class="field">
              <label for="volume-value">单次容量 (ml)</label>
              <input
                id="volume-value"
                name="volumeMl"
                type="number"
                min="10"
                max="1000"
                step="1"
                value="${entry.volumeMl}"
                required
              />
            </div>
            <div class="modal-actions">
              <button class="secondary-btn" data-action="close-modal" type="button">取消</button>
              <button class="primary-btn" type="submit">确认并加 1</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  if (state.ui.modal.type === "clear-confirm") {
    return `
      <div class="modal-backdrop">
        <section class="modal-panel">
          <h2>清空本次酒局？</h2>
          <p>会清除今日酒局数据、巡逻记录和所有倒计时，本机档案设置会保留。</p>
          <div class="modal-actions">
            <button class="secondary-btn" data-action="close-modal" type="button">取消</button>
            <button class="primary-btn" data-action="confirm-clear-session" type="button">确认清空</button>
          </div>
        </section>
      </div>
    `;
  }

  return "";
}

function renderToast() {
  if (!state.ui.toast) {
    return "";
  }

  return `
    <div class="toast-wrap">
      <div class="toast">${state.ui.toast}</div>
    </div>
  `;
}

function startClock() {
  clearInterval(state.timers.clockTick);
  state.timers.clockTick = window.setInterval(() => {
    const rolledOver = rolloverSessionIfNeeded();
    if (rolledOver) {
      clearPrompt();
      schedulePatrol();
      render();
      return;
    }
    syncLiveMetrics();
    syncPromptCountdown();
  }, 1000);
}

function syncLiveMetrics() {
  if (!state.config) {
    return;
  }

  const metrics = getMetrics();
  const status = getStatus(metrics);
  bindText("totalAlcohol", formatGrams(metrics.totalAlcoholGrams));
  bindText("estimatedBAC", formatBAC(metrics.estimatedBAC));
  bindText("thresholdLine", `阈值 ${formatGrams(state.config.alcoholThreshold)}`);
  bindText("soberCountdown", metrics.soberCountdownLabel);
  bindText("soberAt", metrics.soberAtLabel);
  bindText("lastDrinkAt", metrics.lastDrinkLabel);
  bindText("statusLabel", status.label);
  bindText("statusLabelSecondary", status.label);
  bindText("statusDetail", status.detail);
  bindText("ratioDetail", metrics.ratioLabel);
  bindText("drinkSummary", metrics.drinkSummary);
  bindText("patrolHeadline", metrics.patrolHeadline);
  bindText("patrolDetail", metrics.patrolDetail);

  document
    .querySelectorAll("[data-bind='statusLabel'], [data-bind='statusLabelSecondary']")
    .forEach((statusChip) => {
      statusChip.className = `status-chip ${status.className}`;
    });
}

function syncPromptCountdown() {
  if (!state.ui.prompt) {
    return;
  }

  bindText("promptCountdown", formatPromptCountdown(state.ui.prompt.endsAt));
}

function syncToast() {
  if (!state.ui.toast) {
    return;
  }

  clearTimeout(state.timers.toastTick);
  state.timers.toastTick = window.setTimeout(() => {
    state.ui.toast = null;
    render();
  }, 2600);
}

function bindText(name, value) {
  const element = document.querySelector(`[data-bind='${name}']`);
  if (element) {
    element.textContent = value;
  }
}

function calculateBAC(totalAlcoholGrams) {
  if (!state.config || totalAlcoholGrams <= 0) {
    return { bac: 0, soberHours: 0 };
  }

  const r = WIDMARK[state.config.gender] ?? WIDMARK.other;
  const weightGrams = state.config.weight * 1000;
  const bac = totalAlcoholGrams / (weightGrams * r) * 100;
  const soberHours = bac / WIDMARK.eliminationRate;

  return { bac, soberHours };
}

function getMetrics() {
  const totals = Object.values(DRINKS).reduce(
    (accumulator, drink) => {
      const entry = state.session.drinks[drink.id];
      const alcoholGrams =
        entry.count * entry.volumeMl * (entry.abv / 100) * 0.8;

      accumulator.totalAlcoholGrams += alcoholGrams;
      if (entry.count > 0) {
        accumulator.summary.push(
          `${drink.name} ${entry.count}${drink.unit} (${formatPercent(entry.abv)})`
        );
        accumulator.breakdown.push({
          id: drink.id,
          name: drink.name,
          count: entry.count,
          unit: drink.unit,
          alcoholGrams,
        });
      }

      return accumulator;
    },
    { totalAlcoholGrams: 0, summary: [], breakdown: [] }
  );

  const hasDrinks = totals.summary.length > 0;
  const { bac, soberHours } = calculateBAC(totals.totalAlcoholGrams);
  const estimatedSoberMs = soberHours * 60 * 60 * 1000;
  const anchorTime = hasDrinks
    ? state.session.lastDrinkTime ?? state.session.startedAt
    : null;
  const soberAt = anchorTime ? anchorTime + estimatedSoberMs : null;
  const remainingSoberMs = soberAt ? Math.max(soberAt - Date.now(), 0) : 0;
  const ratio = state.config
    ? totals.totalAlcoholGrams / state.config.alcoholThreshold
    : 0;
  const patrolStatus = getPatrolStatus({
    totalAlcoholGrams: totals.totalAlcoholGrams,
    hasDrinks,
  });
  const drinkBreakdown = totals.breakdown
    .sort((a, b) => b.alcoholGrams - a.alcoholGrams)
    .map((item) => ({
      ...item,
      share:
        totals.totalAlcoholGrams > 0 ? item.alcoholGrams / totals.totalAlcoholGrams : 0,
      shareLabel: `${
        totals.totalAlcoholGrams > 0
          ? Math.round((item.alcoholGrams / totals.totalAlcoholGrams) * 100)
          : 0
      }%`,
    }));

  return {
    totalAlcoholGrams: totals.totalAlcoholGrams,
    estimatedBAC: bac,
    soberHours,
    soberAt,
    soberCountdownLabel:
      totals.totalAlcoholGrams > 0 ? formatDuration(remainingSoberMs) : "0分",
    soberAtLabel: soberAt
      ? remainingSoberMs > 0
        ? `预计清醒：${formatDateTime(soberAt)}`
        : "预计清醒：已到达"
      : "预计清醒时刻：未开始",
    ratio,
    ratioLabel: state.config
      ? hasDrinks
        ? `已到阈值 ${Math.min(ratio * 100, 999).toFixed(0)}%`
        : "尚未开始饮酒记录"
      : "",
    lastDrinkLabel: anchorTime
      ? `最后操作 ${formatDateTime(anchorTime)}`
      : "还没开始记录",
    drinkSummary: totals.summary.length
      ? totals.summary.join("、")
      : "未记录饮酒",
    drinkBreakdown,
    snapshots: state.session.snapshots || [],
    patrolHeadline: patrolStatus.headline,
    patrolDetail: patrolStatus.detail,
    messageLog: [...state.session.messageLog].sort((a, b) => b.at - a.at),
  };
}

function getPatrolStatus({ totalAlcoholGrams, hasDrinks }) {
  if (state.session.safeMode) {
    return {
      headline: "巡逻已关闭",
      detail: "你已手动结束本次酒局。",
    };
  }

  if (!hasDrinks) {
    return {
      headline: "尚未启动",
      detail: "开始记录饮酒后才会计算巡逻节奏。",
    };
  }

  if (state.ui.prompt) {
    return {
      headline:
        state.ui.prompt.level === "warning" ? "预警拦截中" : "紧急拦截中",
      detail: `${formatPromptCountdown(
        state.ui.prompt.endsAt
      )} 后尝试唤起短信。`,
    };
  }

  if (totalAlcoholGrams < state.config.alcoholThreshold) {
    return {
      headline: "等待超阈值",
      detail: "达到个人阈值后，30 / 60 分钟无操作才触发提醒。",
    };
  }

  const anchor = state.session.lastDrinkTime ?? Date.now();
  const elapsed = Date.now() - anchor;
  const warningRemaining = Math.max(ALERT_RULES.warning.inactivityMs - elapsed, 0);
  const emergencyRemaining = Math.max(
    ALERT_RULES.emergency.inactivityMs - elapsed,
    0
  );

  if (!state.session.warningHandled) {
    return {
      headline:
        warningRemaining > 0 ? `${formatDuration(warningRemaining)}后预警` : "预警待触发",
      detail: `紧急提醒剩余 ${formatDuration(emergencyRemaining)}。`,
    };
  }

  if (!state.session.emergencyHandled) {
    return {
      headline:
        emergencyRemaining > 0
          ? `${formatDuration(emergencyRemaining)}后紧急`
          : "紧急待触发",
      detail: "预警已处理，系统继续观察你的状态。",
    };
  }

  return {
    headline: "本轮提醒已处理",
    detail: "再次加减酒后，会重新开始 30 / 60 分钟巡逻。",
  };
}

function getStatus(metrics) {
  if (state.session.safeMode) {
    return {
      label: "已结束",
      detail: "巡逻已关闭",
      className: "ended",
    };
  }

  if (metrics.ratio >= 1.5) {
    return {
      label: "高危",
      detail: "明显超量，界面切入红色重警示。",
      className: "red",
    };
  }

  if (metrics.totalAlcoholGrams >= state.config.alcoholThreshold) {
    return {
      label: "醉酒",
      detail: "已超阈值，界面切入橙色观察区。",
      className: "orange",
    };
  }

  if (metrics.totalAlcoholGrams >= state.config.alcoholThreshold * 0.5) {
    return {
      label: "微醺",
      detail: "已达 50%，界面切入黄色留意区。",
      className: "yellow",
    };
  }

  return {
    label: "清醒",
    detail: "仍在可控范围，界面保持冷静基调。",
    className: "calm",
  };
}

function getThemeClass(status) {
  if (status.className === "yellow") {
    return "theme-yellow";
  }

  if (status.className === "orange") {
    return "theme-orange";
  }

  if (status.className === "red") {
    return "theme-red";
  }

  if (status.className === "ended") {
    return "theme-ended";
  }

  return "theme-calm";
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const action = target.dataset.action;

  if (action === "open-settings") {
    state.ui.modal = { type: "settings" };
    render();
    return;
  }

  if (action === "load-demo") {
    loadDemoScenario();
    return;
  }

  if (action === "close-modal") {
    state.ui.modal = null;
    render();
    return;
  }

  if (action === "clear-session") {
    state.ui.modal = { type: "clear-confirm" };
    render();
    return;
  }

  if (action === "confirm-clear-session") {
    clearPrompt();
    clearPatrolTimers();
    state.session = createEmptySession();
    saveSession();
    state.ui.modal = null;
    showToast("本次酒局已清空。");
    render();
    return;
  }

  if (action === "toggle-safe-mode") {
    if (state.session.safeMode) {
      state.session = createEmptySession();
      saveSession();
      showToast("已开始新一局。");
    } else {
      state.session.safeMode = true;
      saveSession();
      showToast("本次酒局已结束，巡逻已停止。");
    }

    clearPrompt();
    schedulePatrol();
    render();
    return;
  }

  if (action === "drink-add") {
    const drinkId = target.dataset.drink;
    const entry = state.session.drinks[drinkId];

    if (state.session.safeMode) {
      return;
    }

    if (entry.count === 0) {
      state.ui.modal = { type: "abv", drinkId };
      render();
      return;
    }

    applyDrinkChange(drinkId, 1);
    return;
  }

  if (action === "drink-remove") {
    const drinkId = target.dataset.drink;
    if (state.session.safeMode) {
      return;
    }

    applyDrinkChange(drinkId, -1);
    return;
  }

  if (action === "cancel-prompt") {
    if (state.ui.prompt) {
      markAlertHandled(state.ui.prompt.level);
      showToast("本次提醒已拦截。");
      clearPrompt();
      schedulePatrol();
      render();
    }
    return;
  }

  if (action === "send-now") {
    const level = target.dataset.level;
    if (level) {
      markAlertHandled(level);
      clearPrompt();
      dispatchSafetyMessage(level);
      schedulePatrol();
      render();
    }
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (form.id === "setup-form") {
    event.preventDefault();
    const data = new FormData(form);
    state.config = readConfigForm(data);
    saveConfig();
    state.ui.modal = null;
    showToast("本机档案已保存。");
    render();
    schedulePatrol();
    maybeTriggerSafeReport();
    return;
  }

  if (form.id === "settings-form") {
    event.preventDefault();
    const data = new FormData(form);
    state.config = readConfigForm(data);
    saveConfig();
    state.ui.modal = null;
    showToast("设置已更新。");
    render();
    schedulePatrol();
    maybeTriggerSafeReport();
    return;
  }

  if (form.id === "abv-form") {
    event.preventDefault();
    const data = new FormData(form);
    const drinkId = String(data.get("drinkId"));
    const entry = state.session.drinks[drinkId];
    entry.abv = clampNumber(data.get("abv"), 0.1, 96, entry.abv);
    entry.volumeMl = clampNumber(data.get("volumeMl"), 10, 1000, entry.volumeMl);
    state.ui.modal = null;
    applyDrinkChange(drinkId, 1);
  }
});

function readConfigForm(formData) {
  return {
    gender: String(formData.get("gender")),
    weight: clampNumber(formData.get("weight"), 30, 300, 70),
    alcoholThreshold: clampNumber(
      formData.get("alcoholThreshold"),
      5,
      500,
      40
    ),
    emergencyContact: String(formData.get("emergencyContact")).trim(),
  };
}

function applyDrinkChange(drinkId, delta) {
  const entry = state.session.drinks[drinkId];
  const nextCount = Math.max(0, entry.count + delta);
  const now = Date.now();

  entry.count = nextCount;
  state.session.startedAt = state.session.startedAt ?? now;
  state.session.lastDrinkTime = now;
  state.session.warningHandled = false;
  state.session.emergencyHandled = false;

  const currentTotalGrams = Object.values(DRINKS).reduce((sum, d) => {
    const e = state.session.drinks[d.id];
    return sum + e.count * e.volumeMl * (e.abv / 100) * 0.8;
  }, 0);
  if (!state.session.snapshots) {
    state.session.snapshots = [];
  }
  state.session.snapshots.push({ at: now, totalGrams: currentTotalGrams });

  clearPrompt();
  saveSession();
  schedulePatrol();
  maybeTriggerSafeReport();
  render();
}

function maybeTriggerSafeReport() {
  if (!state.config || state.session.safeMode || state.session.safeReportSent) {
    return;
  }

  const metrics = getMetrics();
  if (
    metrics.totalAlcoholGrams > 0 &&
    metrics.totalAlcoholGrams >= state.config.alcoholThreshold * 0.5
  ) {
    state.session.safeReportSent = true;
    saveSession();
    dispatchSafetyMessage("safe");
    render();
  }
}

function schedulePatrol() {
  clearPatrolTimers();

  if (!state.config || state.session.safeMode) {
    return;
  }

  const metrics = getMetrics();
  if (metrics.totalAlcoholGrams < state.config.alcoholThreshold) {
    return;
  }

  const anchor = state.session.lastDrinkTime ?? Date.now();
  const elapsed = Date.now() - anchor;

  if (!state.session.emergencyHandled && elapsed >= ALERT_RULES.emergency.inactivityMs) {
    triggerPrompt("emergency");
    return;
  }

  if (!state.session.warningHandled && elapsed >= ALERT_RULES.warning.inactivityMs) {
    triggerPrompt("warning");
    return;
  }

  if (!state.session.warningHandled) {
    const warningDelay = Math.max(
      ALERT_RULES.warning.inactivityMs - elapsed,
      0
    );
    state.timers.warningTimeout = window.setTimeout(() => {
      triggerPrompt("warning");
    }, warningDelay);
  }

  if (!state.session.emergencyHandled) {
    const emergencyDelay = Math.max(
      ALERT_RULES.emergency.inactivityMs - elapsed,
      0
    );
    state.timers.emergencyTimeout = window.setTimeout(() => {
      triggerPrompt("emergency");
    }, emergencyDelay);
  }
}

function clearPatrolTimers() {
  clearTimeout(state.timers.warningTimeout);
  clearTimeout(state.timers.emergencyTimeout);
  state.timers.warningTimeout = null;
  state.timers.emergencyTimeout = null;
}

function triggerPrompt(level) {
  if (state.ui.prompt || state.session.safeMode) {
    return;
  }

  const metrics = getMetrics();
  if (metrics.totalAlcoholGrams < state.config.alcoholThreshold) {
    return;
  }

  if (level === "warning" && state.session.warningHandled) {
    return;
  }

  if (level === "emergency" && state.session.emergencyHandled) {
    return;
  }

  clearPrompt();
  state.ui.prompt = {
    level,
    endsAt: Date.now() + ALERT_RULES[level].countdownMs,
  };
  render();

  vibrate(level);
  state.timers.vibrationTick = window.setInterval(() => {
    vibrate(level);
  }, 2400);

  state.timers.promptTick = window.setInterval(() => {
    if (!state.ui.prompt) {
      return;
    }

    if (Date.now() >= state.ui.prompt.endsAt) {
      const promptLevel = state.ui.prompt.level;
      markAlertHandled(promptLevel);
      clearPrompt();
      dispatchSafetyMessage(promptLevel);
      schedulePatrol();
      render();
      return;
    }

    syncPromptCountdown();
  }, 250);
}

function clearPrompt() {
  clearInterval(state.timers.promptTick);
  clearInterval(state.timers.vibrationTick);
  state.timers.promptTick = null;
  state.timers.vibrationTick = null;
  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
  state.ui.prompt = null;
}

function markAlertHandled(level) {
  if (level === "warning") {
    state.session.warningHandled = true;
  }

  if (level === "emergency") {
    state.session.emergencyHandled = true;
  }

  saveSession();
}

function composeMessage(level) {
  const summary = getMetrics().drinkSummary;

  if (level === "safe") {
    return `【平安报备】我正在应酬，当前饮用：${summary}，状态安全，无需担心。`;
  }

  if (level === "warning") {
    return `【饮酒预警】亲友已超量，当前饮用：${summary}，处于醉酒状态，请提醒休息。`;
  }

  return `【紧急提醒】亲友醉酒后长时间无操作，当前饮用：${summary}，建议关注其安全。`;
}

async function dispatchSafetyMessage(level) {
  if (!state.config) {
    return;
  }

  const message = composeMessage(level);
  state.session.messageLog.unshift({
    type: level,
    at: Date.now(),
    message,
  });
  state.session.messageLog = state.session.messageLog.slice(0, 10);
  saveSession();

  const copied = await copyText(message);
  const opened = openSmsComposer(state.config.emergencyContact, message);

  if (opened && copied) {
    showToast("已尝试唤起短信页，并复制短信文案。");
  } else if (opened) {
    showToast("已尝试唤起短信页。");
  } else if (copied) {
    showToast("浏览器未能直接打开短信，文案已复制。");
  } else {
    showToast("浏览器未能直接打开短信，请手动复制巡逻记录。");
  }

  render();
}

function openSmsComposer(phone, message) {
  const cleanPhone = String(phone || "").replace(/[^\d+]/g, "");
  if (!cleanPhone) {
    return false;
  }

  try {
    const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    const separator = isIOS ? "&" : "?";
    const url = `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
    window.location.href = url;
    return true;
  } catch (error) {
    return false;
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    return true;
  } catch (error) {
    return false;
  }
}

function showToast(message) {
  state.ui.toast = message;
  render();
}

function renderTrendBars(metrics, status) {
  const snaps = metrics.snapshots || [];
  const barCount = 20;

  if (snaps.length >= 2) {
    const maxGrams = Math.max(...snaps.map((s) => s.totalGrams), 1);
    const step = Math.max(1, Math.floor(snaps.length / barCount));
    const sampled = [];
    for (let i = 0; i < snaps.length; i += step) {
      sampled.push(snaps[i]);
    }
    while (sampled.length < barCount) {
      sampled.push(snaps[snaps.length - 1]);
    }
    const display = sampled.slice(0, barCount);

    return display
      .map((snap, index) => {
        const pct = Math.max(8, Math.min(95, (snap.totalGrams / maxGrams) * 90 + 5));
        const active = index === display.length - 1 ? "active" : "";
        const delay = index * 40;
        return `<span class="trend-bar ${status.className} ${active}" style="height:${pct}%;animation-delay:${delay}ms"></span>`;
      })
      .join("");
  }

  const heights = Array.from({ length: barCount }, (_, index) => {
    const base = 18 + ((index * 11) % 23);
    const wave = Math.sin((index + 1) / 2.2) * 11;
    const ratioLift = Math.min(metrics.ratio * 14, 36);
    return Math.max(12, Math.min(92, Math.round(base + wave + ratioLift)));
  });

  return heights
    .map((height, index) => {
      const active = index === heights.length - 1 ? "active" : "";
      const delay = index * 40;
      return `<span class="trend-bar ${status.className} ${active}" style="height:${height}%;animation-delay:${delay}ms"></span>`;
    })
    .join("");
}

function loadDemoScenario() {
  clearPrompt();
  clearPatrolTimers();

  state.config = {
    gender: "male",
    weight: 78,
    alcoholThreshold: 50,
    emergencyContact: "13800138000",
  };

  const now = Date.now();
  const demoSession = createEmptySession();
  demoSession.startedAt = now - 45 * 60 * 1000;
  demoSession.lastDrinkTime = now - 12 * 60 * 1000;
  demoSession.safeReportSent = true;
  demoSession.drinks.beer.count = 2;
  demoSession.drinks.wine.count = 1;
  demoSession.drinks.baijiu.count = 1;
  demoSession.messageLog = [
    {
      type: "safe",
      at: now - 10 * 60 * 1000,
      message:
        "【平安报备】我正在应酬，当前饮用：啤酒 2瓶 (5%)、红酒 1杯 (13%)、白酒 1两 (52%)，状态安全，无需担心。",
    },
  ];
  demoSession.snapshots = [
    { at: now - 42 * 60 * 1000, totalGrams: 20.0 },
    { at: now - 38 * 60 * 1000, totalGrams: 40.0 },
    { at: now - 30 * 60 * 1000, totalGrams: 40.0 },
    { at: now - 25 * 60 * 1000, totalGrams: 55.6 },
    { at: now - 18 * 60 * 1000, totalGrams: 55.6 },
    { at: now - 12 * 60 * 1000, totalGrams: 76.4 },
  ];

  state.session = demoSession;
  saveConfig();
  saveSession();
  showToast("已载入演示酒局。");
  render();
  schedulePatrol();
}

function vibrate(level) {
  if (navigator.vibrate) {
    navigator.vibrate(ALERT_RULES[level].vibration);
  }
}

function formatGrams(value) {
  return `${Number(value).toFixed(1)}g`;
}

function formatBAC(value) {
  if (!value || value <= 0) {
    return "0.000%";
  }
  return `${Number(value).toFixed(3)}%`;
}

function formatPercent(value) {
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}分`;
  }

  if (minutes === 0) {
    return `${hours}小时`;
  }

  return `${hours}小时${minutes}分`;
}

function formatPromptCountdown(endsAt) {
  const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return `${seconds}s`;
}

function formatRatio(value) {
  return `${Math.round(Math.max(value, 0) * 100)}%`;
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  if (isToday) {
    return `今天 ${time}`;
  }

  const full = new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return full;
}

function formatGender(gender) {
  if (gender === "male") {
    return "男";
  }

  if (gender === "female") {
    return "女";
  }

  return "其他";
}

function maskPhone(phone) {
  const value = String(phone || "");
  if (value.length < 7) {
    return value;
  }

  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function truncateText(text, maxLength) {
  const value = String(text || "");
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rolloverSessionIfNeeded() {
  if (state.session.dateKey === getTodayKey()) {
    return false;
  }

  state.session = createEmptySession();
  saveSession();
  return true;
}

function clampInt(value, min) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, number);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(number, min), max);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
