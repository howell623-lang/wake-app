(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.WakeStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STORAGE_KEYS = {
    config: "wake-app-config",
    session: "wake-app-session",
    entitlement: "wake-app-entitlement",
  };

  const DEFAULT_ENTITLEMENT = { plan: "free" };

  function clampInt(value, min) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.max(min, n) : min;
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
  }

  function createEmptySession({ drinks, todayKey }) {
    const nextDrinks = {};
    Object.values(drinks).forEach((drink) => {
      nextDrinks[drink.id] = {
        count: 0,
        abv: drink.defaultAbv,
        volumeMl: drink.defaultVolumeMl,
      };
    });

    return {
      dateKey: todayKey,
      startedAt: null,
      lastDrinkTime: null,
      mealState: null,
      safeMode: false,
      safeReportSent: false,
      warningHandled: false,
      emergencyHandled: false,
      messageLog: [],
      snapshots: [],
      drinkEvents: [],
      drinks: nextDrinks,
    };
  }

  function loadConfig(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEYS.config);
      if (!raw) return null;
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
        heightCm: Number.isFinite(Number(parsed.heightCm)) ? Number(parsed.heightCm) : null,
        age: Number.isFinite(Number(parsed.age)) ? Number(parsed.age) : null,
        alcoholThreshold: Number(parsed.alcoholThreshold),
        emergencyContact: String(parsed.emergencyContact).trim(),
      };
    } catch {
      return null;
    }
  }

  function saveConfig(storage, config) {
    if (!config) {
      storage.removeItem(STORAGE_KEYS.config);
      return;
    }
    storage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
  }

  function loadEntitlement(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEYS.entitlement);
      if (!raw) return { ...DEFAULT_ENTITLEMENT };
      const parsed = JSON.parse(raw);
      if (!parsed || !["free", "pro", "supporter"].includes(parsed.plan)) {
        return { ...DEFAULT_ENTITLEMENT };
      }
      return { plan: parsed.plan };
    } catch {
      return { ...DEFAULT_ENTITLEMENT };
    }
  }

  function saveEntitlement(storage, entitlement) {
    storage.setItem(STORAGE_KEYS.entitlement, JSON.stringify(entitlement));
  }

  function loadSession(storage, options) {
    const { drinks, todayKey } = options;
    const fallback = createEmptySession({ drinks, todayKey });

    try {
      const raw = storage.getItem(STORAGE_KEYS.session);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.dateKey !== todayKey) {
        storage.removeItem(STORAGE_KEYS.session);
        return fallback;
      }

      const session = createEmptySession({ drinks, todayKey });
      session.startedAt = Number.isFinite(Number(parsed.startedAt)) ? Number(parsed.startedAt) : null;
      session.lastDrinkTime = Number.isFinite(Number(parsed.lastDrinkTime)) ? Number(parsed.lastDrinkTime) : null;
      session.mealState = parsed.mealState || null;
      session.safeMode = Boolean(parsed.safeMode);
      session.safeReportSent = Boolean(parsed.safeReportSent);
      session.warningHandled = Boolean(parsed.warningHandled);
      session.emergencyHandled = Boolean(parsed.emergencyHandled);
      session.messageLog = Array.isArray(parsed.messageLog)
        ? parsed.messageLog.filter((item) => item && item.type && Number.isFinite(Number(item.at)))
        : [];
      session.snapshots = Array.isArray(parsed.snapshots)
        ? parsed.snapshots.filter((item) => item && Number.isFinite(Number(item.at)) && Number.isFinite(Number(item.totalGrams)))
        : [];
      session.drinkEvents = Array.isArray(parsed.drinkEvents)
        ? parsed.drinkEvents.filter((event) => event && event.type && event.action && Number.isFinite(Number(event.timestamp)))
        : [];

      Object.values(drinks).forEach((drink) => {
        const savedValue = parsed.drinks?.[drink.id] ?? {};
        session.drinks[drink.id] = {
          count: clampInt(savedValue.count, 0),
          abv: clampNumber(savedValue.abv, 0.1, 96, drink.defaultAbv),
          volumeMl: clampNumber(savedValue.volumeMl, 10, 1000, drink.defaultVolumeMl),
        };
      });

      return session;
    } catch {
      return fallback;
    }
  }

  function saveSession(storage, session) {
    storage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  }

  return {
    STORAGE_KEYS,
    DEFAULT_ENTITLEMENT,
    createEmptySession,
    loadConfig,
    saveConfig,
    loadEntitlement,
    saveEntitlement,
    loadSession,
    saveSession,
  };
});
