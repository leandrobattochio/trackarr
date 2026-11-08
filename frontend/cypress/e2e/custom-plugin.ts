import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";
import { NEW_PLUGIN_TEMPLATE } from "../../src/features/plugins/plugin-template";
import { getEditor, setEditorValue } from "../support/monaco";

const apiUrl = () => Cypress.env("apiUrl") as string;
// Port 9 refuses connections, so an accidental sync never leaves the machine.
const TRACKER_URL = "http://127.0.0.1:9/";
let customId = "";

function newCustomId() {
  return `cypress-${Date.now()}`;
}

function customYaml(pluginId: string) {
  return NEW_PLUGIN_TEMPLATE.replace("<your-plugin-id>", pluginId)
    .replace("displayName: My Tracker", "displayName: Cypress Custom")
    .replace("https://tracker.example/", TRACKER_URL);
}

function customCard() {
  return cy.contains("button", customId).scrollIntoView();
}

Given("I open the plugin editor", () => {
  cy.visit("/plugins");
  cy.contains("Manage Plugins").should("be.visible");
});

When("I start a new plugin draft", () => {
  cy.contains("button", "New Plugin").click();
});

Then("the editor should hold the blank template with a pluginId placeholder", () => {
  cy.contains("h3", "New Plugin Draft").should("be.visible");
  cy.window()
    .its("monaco")
    .should((monaco) => {
      const value = getEditor(monaco).getValue();
      expect(value).to.match(/^pluginId: <your-plugin-id>$/m);
      expect(value).to.match(/^schemaVersion: 1$/m);
    });
});

When("I create the draft without replacing the placeholder", () => {
  cy.contains("button", "Create Plugin").click();
});

Then("I should see the API's message {string}", (message: string) => {
  cy.contains("div", message).should("be.visible");
  cy.contains("button", "Create Plugin").should("be.visible");
});

When("I create the draft with the official id {string}", (pluginId: string) => {
  setEditorValue((current) => current.replace(/^pluginId: .*$/m, `pluginId: ${pluginId}`));
  cy.contains("button", "Create Plugin").click();
});

When("I create the draft with a new custom id", () => {
  customId = newCustomId();
  setEditorValue((current) => current.replace(/^pluginId: .*$/m, `pluginId: ${customId}`));
  cy.contains("button", "Create Plugin").click();
});

Then("the new plugin should be listed as Custom", () => {
  cy.contains(`${customId} · editable`).should("be.visible");
  customCard().should("be.visible").and("contain.text", "Custom v1.0.0");
  cy.contains("button", "Delete").should("be.visible");
});

Then("the API should report the new plugin as custom", () => {
  cy.request(`${apiUrl()}/api/plugins`).then(({ body }) => {
    const plugin = (body as Array<{ pluginId: string; origin: string }>).find((item) => item.pluginId === customId);
    expect(plugin?.origin).to.equal("custom");
  });
  cy.request("DELETE", `${apiUrl()}/api/plugins/${customId}`);
});

Given("a custom plugin used by an integration", () => {
  customId = newCustomId();
  cy.request({
    method: "POST",
    url: `${apiUrl()}/api/plugins`,
    headers: { "Content-Type": "application/yaml" },
    body: customYaml(customId),
  });
  cy.request("POST", `${apiUrl()}/api/integrations`, {
    pluginId: customId,
    payload: JSON.stringify({ baseUrl: TRACKER_URL, apiKey: "cypress-key", required_ratio: "1", cron: "0 * * * *" }),
  })
    .its("body.id")
    .as("integrationId");
});

Given("I open the plugin editor for that custom plugin", () => {
  cy.visit(`/plugins?plugin=${customId}`);
  cy.contains(`${customId} · editable`).should("be.visible");
});

When("I delete the custom plugin", () => {
  cy.contains("button", "Delete").click();
  cy.get('[role="alertdialog"]').contains("button", "Delete plugin").click();
});

Then("I should see the integration that blocks the deletion", () => {
  cy.get('[role="alertdialog"]').within(() => {
    cy.contains("Cypress Custom is in use").should("be.visible");
    cy.contains(`Plugin '${customId}' is used by 1 integration(s).`).should("be.visible");
    cy.get('[data-testid="delete-blocking-integrations"] li').should("have.length", 1).and("have.text", TRACKER_URL);
  });
});

When("I close the dialog, delete that integration and delete the custom plugin again", () => {
  cy.get('[role="alertdialog"]').contains("button", "Close").click();
  cy.get("@integrationId").then((integrationId) => {
    cy.request("DELETE", `${apiUrl()}/api/integrations/${integrationId}`);
  });
  cy.contains("button", "Delete").click();
  cy.get('[role="alertdialog"]').contains("button", "Delete plugin").click();
});

Then("the custom plugin should be gone", () => {
  cy.get('[role="alertdialog"]').should("not.exist");
  cy.contains("button", customId).should("not.exist");
  cy.request(`${apiUrl()}/api/plugins`).then(({ body }) => {
    expect((body as Array<{ pluginId: string }>).map((item) => item.pluginId)).not.to.include(customId);
  });
});
