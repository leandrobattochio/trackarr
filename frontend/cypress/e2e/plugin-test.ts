import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";
import { setEditorValue } from "../support/monaco";

const INTEGRATION_ID = "0b8e7c1a-5d2f-4c3e-9a1b-2f6d8e4c7a90";
const SEEDPOOL_YAML = "pluginId: seedpool\ndisplayName: Seedpool\nversion: 1.0.0\nschemaVersion: 1\nbaseUrls:\n  - https://seedpool.org/\n";
const EDITED_LINE = "# unsaved tweak";

function seedpoolPlugin(overrides: Record<string, unknown> = {}) {
  return {
    pluginId: "seedpool",
    displayName: "Seedpool",
    definitionValid: true,
    definitionError: null,
    baseUrls: ["https://seedpool.org/"],
    dashboard: { byteUnitSystem: "binary", metrics: [] },
    fields: [{ name: "apiKey", label: "API Key", type: "password", required: true, sensitive: true }],
    customFields: [],
    origin: "official",
    version: "1.0.0",
    baseVersion: null,
    latestOfficialVersion: "1.0.0",
    outdated: false,
    orphan: false,
    deprecated: false,
    incompatible: false,
    incompatibleVersion: null,
    requiredSchemaVersion: null,
    requiredAppVersion: null,
    incompatibleMessage: null,
    hiddenOfficial: false,
    lastSyncFailed: false,
    ...overrides,
  };
}

const seedpoolIntegration = {
  id: INTEGRATION_ID,
  pluginId: "seedpool",
  dashboard: null,
  payload: { baseUrl: "https://seedpool.org/", cron: "0 * * * *" },
  url: "https://seedpool.org/",
  requiredRatio: null,
  lastSyncAt: null,
  nextAutomaticSyncAt: null,
  lastSyncResult: "authFailed",
  configurationValid: true,
  configurationError: null,
  stats: null,
};

function stubPlugin(plugin: Record<string, unknown>, integrations: unknown[], dryRun: Record<string, unknown>) {
  cy.intercept({ method: "GET", pathname: "/api/plugins" }, { statusCode: 200, body: [plugin] }).as("getPlugins");
  cy.intercept(
    { method: "GET", pathname: "/api/plugins/seedpool" },
    { statusCode: 200, body: SEEDPOOL_YAML, headers: { "content-type": "text/plain" } },
  ).as("getDefinition");
  cy.intercept({ method: "GET", pathname: "/api/plugins/seedpool/diff" }, {
    statusCode: 200,
    body: {
      pluginId: "seedpool",
      origin: "override",
      baseVersion: "1.0.0",
      latestOfficialVersion: "1.1.0",
      base: SEEDPOOL_YAML,
      yours: `${SEEDPOOL_YAML}# mine\n`,
      latestOfficial: SEEDPOOL_YAML.replace("version: 1.0.0", "version: 1.1.0"),
      changelog: [],
    },
  }).as("getDiff");
  cy.intercept({ method: "GET", pathname: "/api/integrations" }, { statusCode: 200, body: integrations }).as("getIntegrations");
  cy.intercept({ method: "POST", pathname: "/api/plugins/test" }, { statusCode: 200, body: dryRun }).as("testPlugin");
}

Given("the plugin api reports Seedpool with one integration and a successful dry run", () => {
  stubPlugin(seedpoolPlugin(), [seedpoolIntegration], {
    outcome: "success",
    steps: [{ name: "profile", method: "GET", path: "/api/user", statusCode: 200 }],
    stats: {
      ratio: 2.5,
      uploadedBytes: 1073741824,
      downloadedBytes: 429496729,
      seedBonus: "1,234",
      buffer: null,
      hitAndRuns: 0,
      requiredRatio: 1,
      seedingTorrents: 12,
      leechingTorrents: 0,
      activeTorrents: 12,
    },
    failedField: null,
    error: null,
  });
});

Given("the plugin api reports an outdated Seedpool override whose last sync failed and a failing dry run", () => {
  stubPlugin(
    seedpoolPlugin({ origin: "override", baseVersion: "1.0.0", latestOfficialVersion: "1.1.0", outdated: true, lastSyncFailed: true }),
    [seedpoolIntegration],
    {
      outcome: "authFailed",
      steps: [{ name: "profile", method: "GET", path: "/api/user", statusCode: 401 }],
      stats: null,
      failedField: { step: "profile", field: "ratio", error: "No element matched '.ratio'." },
      error: "The tracker rejected the credentials.",
    },
  );
});

Given("the plugin api reports Seedpool without any integration", () => {
  stubPlugin(seedpoolPlugin(), [{ ...seedpoolIntegration, pluginId: "asc" }], { outcome: "success", steps: [], stats: null, failedField: null, error: null });
});

When("I open the Seedpool plugin editor", () => {
  cy.visit("/plugins?plugin=seedpool");
  cy.contains("seedpool · editable").should("be.visible");
  cy.get(".monaco-editor").should("contain.text", "pluginId");
});

When("I change the Seedpool YAML without saving", () => {
  setEditorValue((current) => `${current}${EDITED_LINE}\n`);
  cy.contains("button", "Save").should("be.enabled");
});

When("I open the Seedpool update review", () => {
  cy.visit("/plugins/seedpool/update");
  cy.contains("Review Seedpool update").should("be.visible");
});

When("I click Test", () => {
  cy.contains("button", /^Test$/).should("be.enabled").click();
});

When("I click Test official", () => {
  cy.contains("button", "Test official").should("be.enabled").click();
});

Then("I should be asked which Seedpool integration to use", () => {
  cy.get("[role='dialog']")
    .should("be.visible")
    .and("contain.text", "No snapshot is saved and the integration is not changed.")
    .within(() => {
      cy.contains("label", "https://seedpool.org/").find("input[type='radio']").should("be.checked");
    });
});

When("I run the test", () => {
  cy.get("[role='dialog']").contains("button", "Run test").click();
});

Then("the dry run should use the unsaved editor YAML", () => {
  cy.wait("@testPlugin").its("request.body").should((body) => {
    expect(body.integrationId).to.eq(INTEGRATION_ID);
    expect(body.yaml).to.contain("pluginId: seedpool").and.contain(EDITED_LINE);
    expect(body).not.to.have.property("useOfficial");
  });
  cy.get("@getDefinition.all").should("have.length.at.least", 1);
});

Then("the dry run should use the official Seedpool", () => {
  cy.wait("@testPlugin").its("request.body").should("deep.equal", { integrationId: INTEGRATION_ID, useOfficial: true });
});

Then("I should see a successful result with step statuses and stats", () => {
  cy.get("[data-testid='plugin-test-result']").should("have.attr", "data-outcome", "success");
  cy.get("[data-testid='plugin-test-outcome']").should("have.text", "Success");
  cy.get("[data-testid='plugin-test-step-profile']").should("contain.text", "GET /api/user").and("contain.text", "HTTP 200");
  cy.get("[data-testid='plugin-test-stats']").should("contain.text", "Ratio2.5").and("contain.text", "Uploaded1 GB");
  cy.get("[data-testid='plugin-test-failed-field']").should("not.exist");
});

Then("I should see a failed result with the HTTP status and the failing field", () => {
  cy.get("[data-testid='plugin-test-result']").should("have.attr", "data-outcome", "authFailed");
  cy.get("[data-testid='plugin-test-outcome']").should("have.text", "Authentication failed");
  cy.get("[data-testid='plugin-test-step-profile']").should("contain.text", "HTTP 401");
  cy.get("[data-testid='plugin-test-error']").should("contain.text", "The tracker rejected the credentials.");
  cy.get("[data-testid='plugin-test-failed-field']")
    .should("contain.text", "Failed field ratio in step profile")
    .and("contain.text", "No element matched '.ratio'.");
  cy.contains("No stats were extracted.").should("be.visible");
});

Then("the Test button should be disabled with an explanation", () => {
  cy.contains("button", /^Test$/).should("be.disabled");
  cy.get("[data-testid='plugin-test-unavailable']").should(
    "contain.text",
    "No integration uses Seedpool. Add one to test this plugin with its settings.",
  );
});
