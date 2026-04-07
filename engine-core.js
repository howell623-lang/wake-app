(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.WakeEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ETHANOL_DENSITY = 0.789;

  const DEFAULT_MEAL_PARAMS = {
    empty: { Fmeal: 1.0, tauAbsMin: 45 },
    light: { Fmeal: 0.9, tauAbsMin: 60 },
    normalMeal: { Fmeal: 0.8, tauAbsMin: 90 },
  };

  const DEFAULT_METABOLISM = {
    beta: 0.015,
    T_high: 0.08,
    T_mild: 0.03,
    T_clear: 0.005,
  };

  function normalizeEventAbv(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n > 1 ? n / 100 : n;
  }

  function getTimeUntilStableBelowThreshold(bacTrace, nowMin, threshold) {
    let lastAboveIndex = -1;
    for (let i = Math.max(nowMin, 0); i < bacTrace.length; i++) {
      if (bacTrace[i] > threshold) lastAboveIndex = i;
    }
    return lastAboveIndex === -1 ? 0 : (lastAboveIndex - nowMin + 1) * 60000;
  }

  function computeVd(config) {
    if (!config) return 40;
    const weight = Number(config.weight);
    const heightCm = Number(config.heightCm);
    const age = Number(config.age);

    if (config.gender === "male") {
      if (Number.isFinite(heightCm) && Number.isFinite(age)) {
        return 2.447 - 0.09516 * age + 0.1074 * heightCm + 0.3362 * weight;
      }
      return 0.7 * weight;
    }

    if (config.gender === "female") {
      if (Number.isFinite(heightCm)) {
        const heightM = heightCm / 100;
        const bmi = weight / (heightM * heightM);
        return weight * (0.7772 - 0.0099 * bmi);
      }
      return 0.6 * weight;
    }

    return 0.65 * weight;
  }

  function simulateBAC(options) {
    const config = options?.config || null;
    const session = options?.session || {};
    const now = Number.isFinite(Number(options?.now)) ? Number(options.now) : Date.now();
    const mealParams = options?.mealParams || DEFAULT_MEAL_PARAMS;
    const metabolism = options?.metabolism || DEFAULT_METABOLISM;

    const events = Array.isArray(session.drinkEvents)
      ? session.drinkEvents.filter((event) => event && event.action === "add")
      : [];

    if (events.length === 0) {
      return { currentBAC: 0, tHigh: 0, tMild: 0, tClear: 0, soberAtTime: null, peakBAC: 0 };
    }

    const vdLiters = computeVd(config);
    const elimGPerMin = (metabolism.beta * 10 * vdLiters) / 60;
    const mealState = session.mealState || "normalMeal";
    const meal = mealParams[mealState] || mealParams.normalMeal || DEFAULT_MEAL_PARAMS.normalMeal;
    const earliestTs = Math.min(...events.map((event) => Number(event.timestamp)));
    const totalAbsorptionMinutes = Math.max(
      ...events.map((event) => ((Number(event.timestamp) - earliestTs) / 60000) + meal.tauAbsMin)
    );
    const totalAlcoholInputGrams = events.reduce((sum, event) => {
      return sum + Number(event.volumeMl) * normalizeEventAbv(event.abv) * ETHANOL_DENSITY * meal.Fmeal;
    }, 0);
    const estimatedClearMinutes =
      Math.ceil(totalAlcoholInputGrams / Math.max(elimGPerMin, 0.01)) +
      Math.ceil(totalAbsorptionMinutes) +
      180;
    const totalMinutes = Math.max(
      Math.ceil((now - earliestTs) / 60000) + 720,
      estimatedClearMinutes
    );

    let bodyAlcoholGrams = 0;
    let peakBAC = 0;
    const nowMin = Math.ceil((now - earliestTs) / 60000);
    const bacTrace = [];

    for (let minute = 0; minute <= totalMinutes; minute++) {
      let inputPerMin = 0;
      for (const event of events) {
        const eventMinute = (Number(event.timestamp) - earliestTs) / 60000;
        if (minute >= eventMinute && minute < eventMinute + meal.tauAbsMin) {
          const grams = Number(event.volumeMl) * normalizeEventAbv(event.abv) * ETHANOL_DENSITY * meal.Fmeal;
          inputPerMin += grams / meal.tauAbsMin;
        }
      }

      bodyAlcoholGrams = Math.max(0, bodyAlcoholGrams + inputPerMin - elimGPerMin);
      const bac = vdLiters > 0 ? bodyAlcoholGrams / (10 * vdLiters) : 0;
      bacTrace.push(bac);
      if (bac > peakBAC) peakBAC = bac;
    }

    const currentBAC = bacTrace[Math.min(nowMin, bacTrace.length - 1)] ?? 0;
    const tHigh = getTimeUntilStableBelowThreshold(bacTrace, nowMin, metabolism.T_high);
    const tMild = getTimeUntilStableBelowThreshold(bacTrace, nowMin, metabolism.T_mild);
    const tClear = getTimeUntilStableBelowThreshold(bacTrace, nowMin, metabolism.T_clear);

    return {
      currentBAC,
      tHigh,
      tMild,
      tClear,
      soberAtTime: now + tClear,
      peakBAC,
    };
  }

  return {
    ETHANOL_DENSITY,
    DEFAULT_MEAL_PARAMS,
    DEFAULT_METABOLISM,
    computeVd,
    simulateBAC,
    normalizeEventAbv,
    getTimeUntilStableBelowThreshold,
  };
});
