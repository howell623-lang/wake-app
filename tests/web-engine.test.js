const assert = require("node:assert/strict");
const {
  computeVd,
  simulateBAC,
  normalizeEventAbv,
} = require("../engine-core.js");

function createConfig(overrides = {}) {
  return {
    gender: "male",
    weight: 78,
    heightCm: 175,
    age: 35,
    alcoholThreshold: 50,
    emergencyContact: "13800138000",
    ...overrides,
  };
}

function createSession(overrides = {}) {
  return {
    mealState: "light",
    drinkEvents: [],
    ...overrides,
  };
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("normalizeEventAbv handles percent and ratio inputs", () => {
  assert.equal(normalizeEventAbv(5), 0.05);
  assert.equal(normalizeEventAbv(0.52), 0.52);
  assert.equal(normalizeEventAbv(0), 0);
});

test("computeVd uses watson formula for male with full profile", () => {
  const vd = computeVd(createConfig());
  assert.ok(vd > 40 && vd < 50);
});

test("empty session returns zeroed BAC metrics", () => {
  const result = simulateBAC({
    config: createConfig(),
    session: createSession(),
    now: Date.now(),
  });
  assert.deepEqual(result, {
    currentBAC: 0,
    tHigh: 0,
    tMild: 0,
    tClear: 0,
    soberAtTime: null,
    peakBAC: 0,
  });
});

test("heavy session produces ordered countdown thresholds", () => {
  const now = Date.now();
  const result = simulateBAC({
    config: createConfig(),
    session: createSession({
      drinkEvents: Array.from({ length: 8 }, (_, index) => ({
        type: "spirits",
        action: "add",
        abv: 0.4,
        volumeMl: 50,
        timestamp: now - (8 - index) * 5 * 60 * 1000,
      })),
    }),
    now,
  });

  assert.ok(result.currentBAC > 0);
  assert.ok(result.peakBAC >= result.currentBAC);
  assert.ok(result.tHigh > 0);
  assert.ok(result.tMild >= result.tHigh);
  assert.ok(result.tClear >= result.tMild);
  assert.ok(result.soberAtTime > now);
});

test("food state changes clearance timing", () => {
  const now = Date.now();
  const drinkEvents = [
    {
      type: "beer",
      action: "add",
      abv: 0.05,
      volumeMl: 500,
      timestamp: now - 15 * 60 * 1000,
    },
    {
      type: "beer",
      action: "add",
      abv: 0.05,
      volumeMl: 500,
      timestamp: now - 10 * 60 * 1000,
    },
  ];

  const empty = simulateBAC({
    config: createConfig(),
    session: createSession({ mealState: "empty", drinkEvents }),
    now,
  });
  const fed = simulateBAC({
    config: createConfig(),
    session: createSession({ mealState: "normalMeal", drinkEvents }),
    now,
  });

  assert.ok(empty.currentBAC >= fed.currentBAC);
});
