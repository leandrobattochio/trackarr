import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

Given("I open the manage plugins page", () => {
  cy.visit("/plugins");
  cy.contains("Manage Plugins").should("be.visible");
});

Then("I should see the disk-backed plugin catalog", () => {
  cy.contains("Plugin Catalog").should("be.visible");
  cy.contains("Seedpool").should("be.visible");
  cy.contains("Disk").should("be.visible");
});

When("I select the Seedpool plugin definition", () => {
  cy.contains("button", "Seedpool").click();
});

Then("I should see the Seedpool definition editor", () => {
  cy.contains("Seedpool").should("be.visible");
  cy.contains("seedpool · editable").should("be.visible");
  cy.contains("button", "Save").should("be.disabled");
  cy.get(".monaco-editor").should("exist");
});

When("I start a new plugin draft", () => {
  cy.contains("button", "New Plugin").click();
});

Then("I should see the new plugin draft editor", () => {
  cy.contains("New Plugin Draft").should("be.visible");
  cy.contains("button", "Create Plugin").should("be.visible");
  cy.contains("Create writes a new physical YAML file into the plugin directory.").should("be.visible");
  cy.get(".monaco-editor").should("exist");
});
