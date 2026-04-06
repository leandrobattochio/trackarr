import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

Given("I reset existing integrations", () => {
  cy.request(`${Cypress.env("apiUrl")}/api/integrations`).then(({ body }) => {
    const integrations = body as Array<{ id: string }>;

    integrations.forEach((integration) => {
      cy.request("DELETE", `${Cypress.env("apiUrl")}/api/integrations/${integration.id}`);
    });
  });
});

Given("I open the dashboard", () => {
  cy.visit("/");
  cy.contains("Dashboard").should("be.visible");
});

Then("I should see the empty integrations state", () => {
  cy.contains("No integrations yet. Add a tracker to get started.").should("be.visible");
});

When("I add a Seedpool integration", () => {
  cy.contains("button", "Add Tracker").click();
  cy.contains("button", "Seedpool").click();

  cy.get("#baseUrl").clear().type("https://seedpool.org");
  cy.get("#apiKey").clear().type("test-api-key");
  cy.get("#required_ratio").clear().type("1.25");
  cy.get("#cron").clear().type("0 * * * *");

  cy.contains("button", "Connect").click();
});

Then("I should see the Seedpool integration on the dashboard", () => {
  cy.contains("Seedpool").should("be.visible");
  cy.contains("No integrations yet. Add a tracker to get started.").should("not.exist");
});
