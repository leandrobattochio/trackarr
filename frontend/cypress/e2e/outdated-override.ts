import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

const BASE_YAML = "pluginId: seedpool\ndisplayName: Seedpool\nversion: 1.0.0\nschemaVersion: 1\nbaseUrls:\n  - https://seedpool.org/\n";
const YOUR_YAML = `${BASE_YAML}# my local fix\n`;
const OFFICIAL_YAML = BASE_YAML.replace("version: 1.0.0", "version: 1.1.0");

function seedpoolPlugin(overrides: Record<string, unknown>) {
  return {
    pluginId: "seedpool",
    displayName: "Seedpool",
    definitionValid: true,
    definitionError: null,
    baseUrls: ["https://seedpool.org/"],
    dashboard: { byteUnitSystem: "binary", metrics: [] },
    fields: [{ name: "apiKey", label: "API Key", type: "password", required: true, sensitive: true }],
    customFields: [],
    origin: "override",
    version: "1.0.0",
    baseVersion: "1.0.0",
    latestOfficialVersion: "1.1.0",
    outdated: true,
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

let overrideDeleted = false;

function stubOutdatedOverride(lastSyncFailed: boolean) {
  overrideDeleted = false;

  cy.intercept({ method: "GET", pathname: "/api/plugins" }, (request) => {
    request.reply({
      statusCode: 200,
      body: [
        overrideDeleted
          ? seedpoolPlugin({ origin: "official", version: "1.1.0", baseVersion: null, outdated: false, lastSyncFailed })
          : seedpoolPlugin({ lastSyncFailed }),
      ],
    });
  }).as("getPlugins");

  cy.intercept({ method: "GET", pathname: "/api/plugins/seedpool" }, (request) => {
    request.reply({ statusCode: 200, body: overrideDeleted ? OFFICIAL_YAML : YOUR_YAML, headers: { "content-type": "text/plain" } });
  }).as("getDefinition");

  cy.intercept({ method: "GET", pathname: "/api/plugins/seedpool/diff" }, {
    statusCode: 200,
    body: {
      pluginId: "seedpool",
      origin: "override",
      baseVersion: "1.0.0",
      latestOfficialVersion: "1.1.0",
      base: BASE_YAML,
      yours: YOUR_YAML,
      latestOfficial: OFFICIAL_YAML,
      changelog: [{ version: "1.1.0", date: "2026-11-08", notes: "Read the rebuilt stats page." }],
    },
  }).as("getDiff");

  cy.intercept({ method: "DELETE", pathname: "/api/plugins/seedpool/override" }, (request) => {
    overrideDeleted = true;
    request.reply({ statusCode: 204 });
  }).as("deleteOverride");
}

Given("the plugin api reports an outdated Seedpool override", () => {
  stubOutdatedOverride(false);
});

Given("the plugin api reports an outdated Seedpool override whose last sync failed", () => {
  stubOutdatedOverride(true);
});

When("I open the dashboard page", () => {
  cy.visit("/");
  cy.contains("Dashboard").should("be.visible");
});

When("I open the settings page from the sidebar", () => {
  cy.contains("a", "Settings").click();
  cy.location("pathname").should("eq", "/settings");
});

When("I open the Seedpool update review", () => {
  cy.visit("/plugins/seedpool/update");
  cy.contains("Review Seedpool update").should("be.visible");
});

Then("I should see the outdated override banner for Seedpool", () => {
  cy.get("[data-testid='outdated-overrides-banner']")
    .should("be.visible")
    .and("contain.text", "Seedpool uses an outdated override.")
    .and("contain.text", "A newer official version v1.1.0 is available. Your edited copy is based on v1.0.0.")
    .find("button")
    .should("not.exist");
});

When("I follow the Seedpool banner link", () => {
  cy.contains("a", "Review Seedpool update").click();
  cy.location("pathname").should("eq", "/plugins/seedpool/update");
});

Then("I should see the Seedpool update review with both diffs and the changelog", () => {
  cy.wait("@getDiff");
  cy.get("[data-testid='plugin-badge-outdated']").should("contain.text", "Outdated (official v1.1.0)");
  cy.get("[data-testid='outdated-override-warning']").should("have.attr", "data-highlighted", "false");
  cy.get("[data-testid='plugin-changelog']")
    .should("contain.text", "Official changes since v1.0.0")
    .and("contain.text", "Read the rebuilt stats page.");
  cy.get("[data-testid='diff-yours']").should("contain.text", "What you changed").find(".monaco-diff-editor").should("exist");
  cy.get("[data-testid='diff-upstream']").should("contain.text", "What changed upstream").find(".monaco-diff-editor").should("exist");
  cy.contains("button", "Use official").should("be.enabled");
  cy.contains("button", "Keep mine").should("be.enabled");
});

Then("I should not see the Test official button", () => {
  cy.contains("button", "Test official").should("not.exist");
});

Then("the outdated warning should be highlighted with Test official", () => {
  cy.get("[data-testid='outdated-override-warning']")
    .should("have.attr", "data-highlighted", "true")
    .and("contain.text", "The last sync of an integration using your copy failed.");
  cy.get("[data-testid='outdated-override-seedpool']").should("have.attr", "data-highlighted", "true");
  cy.contains("button", "Test official").should("exist");
});

When("I click Use official", () => {
  cy.contains("button", "Use official").click();
});

Then("I should be warned that the override is deleted with no backup", () => {
  cy.get("[role='alertdialog']").should("be.visible").and("contain.text", "Your override is deleted with no backup");
  cy.get("@deleteOverride.all").should("have.length", 0);
});

When("I confirm Use official", () => {
  cy.contains("button", "Delete my override").click();
});

Then("the Seedpool override should be deleted", () => {
  cy.wait("@deleteOverride");
  cy.contains("Seedpool now uses the official version.").should("be.visible");
});

Then("I should be back on the Seedpool plugin without the banner", () => {
  cy.location("pathname").should("eq", "/plugins");
  cy.location("search").should("eq", "?plugin=seedpool");
  cy.contains("seedpool · editable").should("be.visible");
  cy.get("[data-testid='plugin-badge-official']").should("contain.text", "Official v1.1.0");
  cy.get("[data-testid='outdated-overrides-banner']").should("not.exist");
});

When("I click Keep mine", () => {
  cy.contains("button", "Keep mine").click();
});

Then("I should be back on the Seedpool plugin with the banner still shown", () => {
  cy.location("pathname").should("eq", "/plugins");
  cy.location("search").should("eq", "?plugin=seedpool");
  cy.contains("seedpool · editable").should("be.visible");
  cy.get("[data-testid='outdated-overrides-banner']").should("be.visible");
  cy.get("[data-testid='editor-outdated-warning']").should("contain.text", "Review update");
});

Then("the Seedpool override should not be deleted", () => {
  cy.get("@deleteOverride.all").should("have.length", 0);
});
