(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.WakeRender = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function renderCountdownStages() {
    return `<div class="countdown-stages">
    <div class="stage-row" data-stage="empty">
      <span class="stage-emoji">—</span>
      <span class="stage-label">尚未开始饮酒</span>
      <div class="stage-timing"><span class="stage-time">—</span><small class="stage-clock">—</small></div>
    </div>
    <div class="stage-row high" data-stage="high">
      <span class="stage-emoji">🤯</span>
      <span class="stage-label">离清醒还差得远</span>
      <div class="stage-timing"><span class="stage-time">00:00:00</span><small class="stage-clock">约 —</small></div>
    </div>
    <div class="stage-row mild" data-stage="mild">
      <span class="stage-emoji">🙂</span>
      <span class="stage-label">快清醒了</span>
      <div class="stage-timing"><span class="stage-time">00:00:00</span><small class="stage-clock">约 —</small></div>
    </div>
    <div class="stage-row clear" data-stage="clear">
      <span class="stage-emoji">😌</span>
      <span class="stage-label">基本清醒了</span>
      <div class="stage-timing"><span class="stage-time">00:00:00</span><small class="stage-clock">约 —</small></div>
    </div>
  </div>`;
  }

  function getCountdownStageItems(metrics) {
    if (metrics.totalAlcoholGrams <= 0) {
      return [{ tone: "", emoji: "—", label: "尚未开始饮酒", done: true, timeMs: 0 }];
    }

    const items = [];
    if (metrics.tHigh > 0) items.push({ tone: "high", emoji: "🤯", label: "离清醒还差得远", timeMs: metrics.tHigh });
    if (metrics.tMild > 0) items.push({ tone: "mild", emoji: "🙂", label: "快清醒了", timeMs: metrics.tMild });
    if (metrics.tClear > 0) items.push({ tone: "clear", emoji: "😌", label: "基本清醒了", timeMs: metrics.tClear });

    if (items.length > 0) return items;
    return [{ tone: "clear", emoji: "😌", label: "已经清醒了", done: true, timeMs: 0 }];
  }

  function renderUpgradeCard(plan) {
    if (plan !== "free") return "";
    return `<section class="market-card upgrade-card">
    <div class="section-head"><h2>升级 Pro</h2><p>保持现在的 UI，不打断记录主流程。</p></div>
    <div class="pro-callout">
      <strong>把真正兜底的能力放到付费层</strong>
      <p>解锁安全守候、多联系人、更强提醒策略、历史记录 / 复盘、导出、自定义酒类。</p>
      <button class="ghost-btn" data-action="open-upgrade" type="button">查看 Pro 权益</button>
    </div>
  </section>`;
  }

  function getSeverityLabel(metrics) {
    if (metrics.ratio >= 1.5) return "已经非常高了";
    if (metrics.ratio >= 1.0) return "已经很高了";
    if (metrics.ratio >= 0.5) return "有点上头了";
    return "还好";
  }

  function renderDrinkCard(drink, entry, options) {
    const shareLabel = options?.shareLabel || "0%";
    const safeMode = Boolean(options?.safeMode);
    return `<article class="drink-card">
    <div class="drink-card-top"><div><h3>${drink.name}</h3><div class="drink-meta">${drink.presetLabel} · 当前度数 ${formatPercent(entry.abv)}</div></div><div class="drink-count">${entry.count}${drink.unit}</div></div>
    <div class="drink-card-bottom"><div class="drink-meta">单次计入 ${entry.volumeMl}ml · 贡献 ${shareLabel}</div>
      <div class="drink-actions">
        <button class="circle-btn remove" data-action="drink-remove" data-drink="${drink.id}" type="button" ${entry.count === 0 || safeMode ? "disabled" : ""}>-</button>
        <button class="circle-btn add" data-action="drink-add" data-drink="${drink.id}" type="button" ${safeMode ? "disabled" : ""}>+</button>
      </div></div></article>`;
  }

  function renderCompactLogItem(item) {
    const labels = { safe: "应酬开局了", warning: "报个平安", emergency: "断片儿提醒" };
    return `<article class="compact-log-item ${item.type}"><div><strong>${labels[item.type] ?? item.type}</strong><span>${formatDateTime(item.at)}</span></div><small>${truncateText(item.message, 28)}</small></article>`;
  }

  function getStatus(options) {
    const safeMode = Boolean(options?.safeMode);
    const ratio = Number(options?.ratio) || 0;
    const totalAlcoholGrams = Number(options?.totalAlcoholGrams) || 0;
    const alcoholThreshold = Number(options?.alcoholThreshold) || 0;

    if (safeMode) return { label: "已结束", detail: "守候已关闭", className: "ended" };
    if (ratio >= 1.5) return { label: "高危", detail: "明显超量，界面切入红色重警示。", className: "red" };
    if (totalAlcoholGrams >= alcoholThreshold) return { label: "上头了", detail: "已经超过你的量了，注意节制。", className: "orange" };
    if (totalAlcoholGrams >= alcoholThreshold * 0.5) return { label: "微醺", detail: "已达一半，界面切入黄色留意区。", className: "yellow" };
    return { label: "清醒", detail: "仍在可控范围，界面保持冷静基调。", className: "calm" };
  }

  function getThemeClass(status) {
    return `theme-${status.className === "ended" ? "ended" : status.className === "red" ? "red" : status.className === "orange" ? "orange" : status.className === "yellow" ? "yellow" : "calm"}`;
  }

  function formatGrams(value) {
    return `${Number(value).toFixed(1)}g`;
  }

  function formatPercent(value) {
    const n = Number(value);
    return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
  }

  function formatDuration(ms) {
    const minutes = Math.max(0, Math.ceil(ms / 60000));
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    if (hours === 0) return `${restMinutes}分`;
    if (restMinutes === 0) return `${hours}小时`;
    return `${hours}小时${restMinutes}分`;
  }

  function formatLiveCountdown(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return days > 0 ? `${days}天 ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  }

  function formatPromptCountdown(endsAt) {
    return `${Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))}s`;
  }

  function formatRatio(value) {
    return `喝到你平时量的 ${Math.round(Math.max(value, 0) * 100)}% 了`;
  }

  function formatDateTime(ts) {
    const target = new Date(ts);
    const now = new Date();
    const hhmm = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(target);
    if (target.toDateString() === now.toDateString()) return `今天 ${hhmm}`;
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(target);
  }

  function formatTargetTime(ts) {
    const target = new Date(ts);
    const now = new Date();
    const hhmm = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(target);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (target.toDateString() === now.toDateString()) return `今天 ${hhmm}`;
    if (target.toDateString() === tomorrow.toDateString()) return `明天 ${hhmm}`;
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(target);
  }

  function formatGender(gender) {
    return gender === "male" ? "男" : gender === "female" ? "女" : "其他";
  }

  function maskPhone(phone) {
    const value = String(phone || "");
    return value.length < 7 ? value : `${value.slice(0, 3)}****${value.slice(-4)}`;
  }

  function truncateText(text, maxLength) {
    const value = String(text || "");
    return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
  }

  return {
    renderCountdownStages,
    getCountdownStageItems,
    renderUpgradeCard,
    getSeverityLabel,
    renderDrinkCard,
    renderCompactLogItem,
    getStatus,
    getThemeClass,
    formatGrams,
    formatPercent,
    formatDuration,
    formatLiveCountdown,
    formatPromptCountdown,
    formatRatio,
    formatDateTime,
    formatTargetTime,
    formatGender,
    maskPhone,
    truncateText,
  };
});
