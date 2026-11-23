import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyModelHealthFromQueue,
  classifyModelCostTier,
  mergeHostModelCatalogs,
  recommendModelForBmadSkill
} from "../scripts/bmad-engine.mjs";

function testModel(modelId, overrides = {}) {
  return {
    id: `test/${modelId}`,
    modelId,
    providerId: "test",
    providerName: "Test Provider",
    providerKind: "personal",
    subscriptionPlan: "test",
    contextWindow: 1000000,
    supportsImage: true,
    supportsVideo: false,
    supportsPdf: true,
    supportsNativeWebSearch: true,
    supportsJsonSchemaOutput: true,
    supportsToolCall: true,
    reasoningLevels: ["disabled", "enabled"],
    defaultReasoningLevel: "enabled",
    costTier: classifyModelCostTier(modelId),
    current: false,
    orderIndex: 0,
    ...overrides
  };
}

describe("model cost tiers", () => {
  it("classifies economy, standard and premium model names", () => {
    assert.equal(classifyModelCostTier("gemini-4-argon-high"), "economy");
    assert.equal(classifyModelCostTier("gemini-3.5-flash-lite"), "economy");
    assert.equal(classifyModelCostTier("gpt-oss-120b"), "economy");
    assert.equal(classifyModelCostTier("glm-5.3"), "standard");
    assert.equal(classifyModelCostTier("gemini-4-hydrogen-high"), "standard");
    assert.equal(classifyModelCostTier("claude-sonnet-5-5-high"), "standard");
    assert.equal(classifyModelCostTier("claude-opus-5-5-high"), "premium");
    assert.equal(classifyModelCostTier("gemini-4-hydrogen-xhigh"), "premium");
    assert.equal(classifyModelCostTier("qwen4-max"), "premium");
    assert.equal(classifyModelCostTier("deepseek-v4-pro"), "premium");
  });
});

describe("host model catalog merge", () => {
  it("keeps stored models when an advisor update carries a smaller partial list", () => {
    const stored = [
      { id: "p/a", modelId: "a" },
      { id: "p/b", modelId: "b" },
      { id: "p/c", modelId: "c" }
    ];
    const partial = [{ id: "p/b", modelId: "b", providerLabel: "Updated B", current: true }];

    const merged = mergeHostModelCatalogs(stored, partial);

    assert.equal(merged.length, 3);
    assert.deepEqual(
      merged.map((m) => m.id),
      ["p/a", "p/b", "p/c"]
    );
    assert.equal(merged[1].providerLabel, "Updated B");
    assert.equal(merged[1].current, true);
  });

  it("replaces the catalog when the incoming list is complete or larger", () => {
    const stored = [{ id: "p/a", modelId: "a" }];
    const incoming = [
      { id: "p/a", modelId: "a" },
      { id: "p/b", modelId: "b" }
    ];

    assert.deepEqual(mergeHostModelCatalogs(stored, incoming), incoming);
    assert.deepEqual(mergeHostModelCatalogs(stored, []), [
      { id: "p/a", modelId: "a" }
    ]);
  });
});

describe("model health from queue failures", () => {
  const now = Date.parse("2026-11-23T12:00:00.000Z");

  it("marks a model rate-limited after a recent failed queue task", () => {
    const models = [testModel("gemini-4-argon-high"), testModel("claude-sonnet-5-5-high")];
    const queueItems = [
      {
        model: "test/gemini-4-argon-high",
        status: "failed",
        resultSummary: "Provider answered rate_limited after retries",
        completedAt: "2026-11-23T11:00:00.000Z"
      }
    ];

    applyModelHealthFromQueue(models, queueItems, now);

    assert.equal(models[0].rateLimited, true);
    assert.equal(models[0].rateLimitedAt, "2026-11-23T11:00:00.000Z");
    assert.equal(models[1].rateLimited, undefined);
  });

  it("ignores old failures, successful tasks, and unrelated errors", () => {
    const models = [testModel("gemini-4-argon-high")];
    const queueItems = [
      {
        model: "test/gemini-4-argon-high",
        status: "failed",
        resultSummary: "rate_limited",
        completedAt: "2026-11-20T11:00:00.000Z"
      },
      {
        model: "test/gemini-4-argon-high",
        status: "done",
        resultSummary: "rate_limited",
        completedAt: "2026-11-23T11:00:00.000Z"
      },
      {
        model: "test/gemini-4-argon-high",
        status: "failed",
        resultSummary: "test failure",
        completedAt: "2026-11-23T11:00:00.000Z"
      }
    ];

    applyModelHealthFromQueue(models, queueItems, now);

    assert.equal(models[0].rateLimited, undefined);
  });
});

describe("economy-aware recommendations", () => {
  it("picks an economy model for build tasks when it matches a premium model", () => {
    const models = [testModel("gemini-4-argon-high"), testModel("claude-opus-5-5-high")];

    const recommendation = recommendModelForBmadSkill("/bmad-build-auto", models);

    assert.equal(recommendation.costTier, "economy");
    assert.equal(recommendation.modelId, "test/gemini-4-argon-high");
  });

  it("prefers a standard-cost model over a barely-leading premium model for review", () => {
    const models = [testModel("claude-opus-5-5-high"), testModel("claude-sonnet-5-5-high")];

    const recommendation = recommendModelForBmadSkill("/bmad-code-review", models);

    assert.equal(recommendation.costTier, "standard");
    assert.equal(recommendation.modelId, "test/claude-sonnet-5-5-high");
  });

  it("does not downgrade deep review work to a budget model", () => {
    const models = [
      testModel("claude-opus-5-5-high"),
      testModel("gemini-3.5-flash-lite", {
        contextWindow: 65536,
        supportsImage: false,
        supportsPdf: false,
        supportsNativeWebSearch: false,
        supportsJsonSchemaOutput: false
      })
    ];

    const recommendation = recommendModelForBmadSkill("/bmad-code-review", models);

    assert.equal(recommendation.costTier, "premium");
    assert.equal(recommendation.modelId, "test/claude-opus-5-5-high");
  });

  it("skips a recently rate-limited model when a healthy alternative exists", () => {
    const models = [testModel("gemini-4-argon-high"), testModel("claude-sonnet-5-5-high")];
    models[0].rateLimited = true;

    const recommendation = recommendModelForBmadSkill("/bmad-build-auto", models);

    assert.equal(recommendation.modelId, "test/claude-sonnet-5-5-high");
  });
});