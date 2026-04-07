(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.WakePatrol = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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

  function clearPatrolTimeouts(hostWindow, timers) {
    hostWindow.clearTimeout(timers.warningTimeout);
    hostWindow.clearTimeout(timers.emergencyTimeout);
    timers.warningTimeout = null;
    timers.emergencyTimeout = null;
  }

  function getPatrolStatus(options) {
    const {
      isProPlan,
      safeMode,
      hasDrinks,
      prompt,
      totalAlcoholGrams,
      alcoholThreshold,
      lastDrinkTime,
      now,
      warningHandled,
      emergencyHandled,
      formatPromptCountdown,
      formatDuration,
      freeHeadline,
      freeDetail,
    } = options;

    if (!isProPlan) return { headline: freeHeadline, detail: freeDetail };
    if (safeMode) return { headline: "守候已关闭", detail: "你已手动结束本次酒局。" };
    if (!hasDrinks) return { headline: "尚未启动", detail: "开始记录饮酒后才会计算守候节奏。" };
    if (prompt) {
      return {
        headline: prompt.level === "warning" ? "预警拦截中" : "紧急拦截中",
        detail: `${formatPromptCountdown(prompt.endsAt)} 后尝试唤起短信。`,
      };
    }
    if (totalAlcoholGrams < alcoholThreshold) {
      return { headline: "等待超量", detail: "达到你的量后，30 / 60 分钟无操作才触发提醒。" };
    }

    const anchor = lastDrinkTime ?? now;
    const elapsed = now - anchor;
    const warningRemaining = Math.max(ALERT_RULES.warning.inactivityMs - elapsed, 0);
    const emergencyRemaining = Math.max(ALERT_RULES.emergency.inactivityMs - elapsed, 0);

    if (!warningHandled) {
      return {
        headline: warningRemaining > 0 ? `${formatDuration(warningRemaining)}后预警` : "预警待触发",
        detail: `紧急提醒剩余 ${formatDuration(emergencyRemaining)}。`,
      };
    }

    if (!emergencyHandled) {
      return {
        headline: emergencyRemaining > 0 ? `${formatDuration(emergencyRemaining)}后紧急` : "紧急待触发",
        detail: "预警已处理，系统继续观察你的状态。",
      };
    }

    return { headline: "本轮提醒已处理", detail: "再次加减酒后，会重新开始 30 / 60 分钟守候。" };
  }

  function decidePatrolSchedule(options) {
    const {
      isProPlan,
      hasConfig,
      safeMode,
      totalAlcoholGrams,
      alcoholThreshold,
      lastDrinkTime,
      now,
      warningHandled,
      emergencyHandled,
    } = options;

    if (!isProPlan || !hasConfig || safeMode || totalAlcoholGrams < alcoholThreshold) {
      return { warningDelayMs: null, emergencyDelayMs: null, immediatePromptLevel: null };
    }

    const anchor = lastDrinkTime ?? now;
    const elapsed = now - anchor;

    if (!emergencyHandled && elapsed >= ALERT_RULES.emergency.inactivityMs) {
      return { warningDelayMs: null, emergencyDelayMs: null, immediatePromptLevel: "emergency" };
    }
    if (!warningHandled && elapsed >= ALERT_RULES.warning.inactivityMs) {
      return { warningDelayMs: null, emergencyDelayMs: null, immediatePromptLevel: "warning" };
    }

    return {
      warningDelayMs: warningHandled ? null : Math.max(ALERT_RULES.warning.inactivityMs - elapsed, 0),
      emergencyDelayMs: emergencyHandled ? null : Math.max(ALERT_RULES.emergency.inactivityMs - elapsed, 0),
      immediatePromptLevel: null,
    };
  }

  function composeSafetyMessage(level, drinkSummary) {
    if (level === "safe") {
      return `【应酬开局了】我正在应酬，当前饮用：${drinkSummary}，状态安全，无需担心。`;
    }
    if (level === "warning") {
      return `【还没散，报个平安】当前饮用：${drinkSummary}，已超量，请提醒休息。`;
    }
    return `【我喝断片儿了，请速来接我】当前饮用：${drinkSummary}，长时间无操作，建议关注安全。`;
  }

  function openSmsComposer(hostWindow, navigatorObject, phone, message) {
    const sanitizedPhone = String(phone || "").replace(/[^\d+]/g, "");
    if (!sanitizedPhone) return false;

    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigatorObject.userAgent || "");
      hostWindow.location.href = `sms:${sanitizedPhone}${isIOS ? "&" : "?"}body=${encodeURIComponent(message)}`;
      return true;
    } catch {
      return false;
    }
  }

  async function copyText(hostDocument, navigatorObject, text) {
    try {
      if (navigatorObject.clipboard?.writeText) {
        await navigatorObject.clipboard.writeText(text);
        return true;
      }
      const textarea = hostDocument.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.cssText = "position:fixed;opacity:0";
      hostDocument.body.appendChild(textarea);
      textarea.select();
      hostDocument.execCommand("copy");
      textarea.remove();
      return true;
    } catch {
      return false;
    }
  }

  function vibrate(navigatorObject, level) {
    if (navigatorObject.vibrate && ALERT_RULES[level]?.vibration) {
      navigatorObject.vibrate(ALERT_RULES[level].vibration);
    }
  }

  function stopVibration(navigatorObject) {
    if (navigatorObject.vibrate) navigatorObject.vibrate(0);
  }

  return {
    ALERT_RULES,
    clearPatrolTimeouts,
    getPatrolStatus,
    decidePatrolSchedule,
    composeSafetyMessage,
    openSmsComposer,
    copyText,
    vibrate,
    stopVibration,
  };
});
