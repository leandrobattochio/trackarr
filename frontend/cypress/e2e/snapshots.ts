import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

Given("I reset existing integrations", () => {
  cy.request(`${Cypress.env("apiUrl")}/api/integrations`).then(({ body }) => {
    const integrations = body as Array<{ id: string }>;

    integrations.forEach((integration) => {
      cy.request("DELETE", `${Cypress.env("apiUrl")}/api/integrations/${integration.id}`);
    });
  });
});

Given("I have a Seedpool integration on the dashboard", () => {
  cy.visit("/");
  cy.contains("button", "Add Tracker").click();
  cy.contains("button", "Seedpool").click();

  cy.get("#baseUrl").clear().type("https://seedpool.org");
  cy.get("#apiKey").clear().type("test-api-key");
  cy.get("#required_ratio").clear().type("1.25");
  cy.get("#cron").clear().type("0 * * * *");

  cy.contains("button", "Connect").click();
  cy.contains("Seedpool").should("be.visible");
});

When("I open snapshots for the Seedpool integration", () => {
  cy.get('[aria-label="View snapshots"]').first().click();
});

Then("I should see the snapshots page for that integration", () => {
  cy.url().should("include", "/snapshots?integrationId=");
  cy.contains("Snapshots").should("be.visible");
  cy.contains("Seedpool snapshots").should("be.visible");
  cy.contains("button", "Apply").should("be.visible");
  cy.contains("button", "Reset").should("be.visible");
});

Then("I should see that no snapshot data is available", () => {
  cy.contains("No snapshot data was found for this integration in the selected time range.").should("be.visible");
});
