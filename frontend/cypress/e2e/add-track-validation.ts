import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

const DASHBOARD_CARD_ORDER_STORAGE_KEY = "trackarr.dashboard.card-order";

const seedpoolPlugin = {
  pluginId: "seedpool",
  displayName: "Seedpool",
  definitionValid: true,
  definitionError: null,
  baseUrls: ["https://seedpool.org/", "https://alt.seedpool.org/"],
  dashboard: {
    byteUnitSystem: "binary",
    metrics: [],
  },
  fields: [
    { name: "apiKey", label: "API Key", type: "password", required: true, sensitive: true },
    { name: "required_ratio", label: "Required Ratio", type: "number", required: true, sensitive: false },
    { name: "cron", label: "Cron Expression", type: "cron", required: true, sensitive: false },
  ],
  customFields: [],
};

let createdIntegration: Record<string, unknown> | null = null;

Given("the add tracker dashboard api is stubbed", () => {
  createdIntegration = null;

  cy.intercept("GET", "/api/plugins", {
    statusCode: 200,
    body: [seedpoolPlugin],
  }).as("getPlugins");

  cy.intercept("GET", "/api/integrations", (request) => {
    request.reply({
      statusCode: 200,
      body: createdIntegration ? [createdIntegration] : [],
    });
  }).as("getIntegrations");

  cy.intercept("POST", "/api/integrations", (request) => {
    expect(request.body.pluginId).to.equal("seedpool");

    const payload = JSON.parse(request.body.payload as string) as Record<string, string>;
    expect(payload).to.deep.equal({
      baseUrl: "https://seedpool.org/",
      apiKey: "test-api-key",
      required_ratio: "1.25",
      cron: "0 * * * *",
    });

    createdIntegration = {
      id: "integration-seedpool-1",
      pluginId: "seedpool",
      dashboard: seedpoolPlugin.dashboard,
      payload: {
        baseUrl: payload.baseUrl,
        required_ratio: payload.required_ratio,
        cron: payload.cron,
      },
      url: payload.baseUrl,
      requiredRatio: 1.25,
      lastSyncAt: null,
      nextAutomaticSyncAt: null,
      lastSyncResult: null,
      configurationValid: true,
      configurationError: null,
      stats: null,
    };

    request.reply({
      statusCode: 201,
      body: createdIntegration,
    });
  }).as("createIntegration");
});

When("I open the dashboard with add tracker stubs", () => {
  cy.visit("/", {
    onBeforeLoad(window) {
      window.localStorage.removeItem(DASHBOARD_CARD_ORDER_STORAGE_KEY);
    },
  });

  cy.wait("@getPlugins");
  cy.wait("@getIntegrations");
  cy.contains("Dashboard").should("be.visible");
});

When("I open the Seedpool add tracker dialog", () => {
  cy.contains("button", "Add Tracker").click();
  cy.contains("button", "Seedpool").click();
});

When("I submit the add tracker form without entering values", () => {
  cy.contains("button", "Connect").click();
});

Then("I should see required add tracker validation messages", () => {
  cy.contains("API Key is required.").should("be.visible");
  cy.contains("Required Ratio is required.").should("be.visible");
  cy.contains("Cron Expression is required.").should("be.visible");
});

When("I enter invalid typed add tracker values", () => {
  cy.get("#required_ratio").clear().invoke("val", "1e").trigger("input").trigger("change");
  cy.get("#cron").clear().type("* * *");
});

Then("I should see typed add tracker validation messages", () => {
  cy.contains("Cron Expression must be a valid 5-part UTC cron expression.").should("be.visible");
  cy.get("body").should(($body) => {
    const text = $body.text();
    expect(
      text.includes("Required Ratio must be a valid number.") ||
      text.includes("Required Ratio is required."),
    ).to.equal(true);
  });
});

When("I enter valid Seedpool add tracker values", () => {
  cy.get("#apiKey").clear().type("test-api-key");
  cy.get("#required_ratio").clear().type("1.25");
  cy.get("#cron").clear().type("0 * * * *");
});

When("I submit the add tracker form", () => {
  cy.contains("button", "Connect").click();
});

Then("the Seedpool integration should be created from the add tracker dialog", () => {
  cy.wait("@createIntegration");
  cy.wait("@getIntegrations");
  cy.contains("No integrations yet. Add a tracker to get started.").should("not.exist");
  cy.contains("Seedpool").should("be.visible");
});
