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

When("I filter snapshots using the 15 minute preset", () => {
  cy.intercept("GET", "**/api/snapshots*", (req) => {
    if (req.query.range !== "15m") {
      req.continue();
      return;
    }

    req.alias = "presetSnapshots";
    req.reply({
      statusCode: 200,
      body: {
        integrationId: req.query.integrationId,
        range: "15m",
        from: "2026-04-06T00:45:00.000Z",
        to: "2026-04-06T01:00:00.000Z",
        items: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            integrationId: req.query.integrationId,
            capturedAt: "2026-04-06T00:50:00.000Z",
            uploadedBytes: 1024,
            downloadedBytes: 512,
            seedBonus: null,
            buffer: null,
            hitAndRuns: 0,
            ratio: 2.1,
            requiredRatio: 1.25,
            seedingTorrents: 4,
            leechingTorrents: 1,
            activeTorrents: 5,
          },
          {
            id: "22222222-2222-2222-2222-222222222222",
            integrationId: req.query.integrationId,
            capturedAt: "2026-04-06T00:58:00.000Z",
            uploadedBytes: 2048,
            downloadedBytes: 1024,
            seedBonus: null,
            buffer: null,
            hitAndRuns: 0,
            ratio: 2.2,
            requiredRatio: 1.25,
            seedingTorrents: 5,
            leechingTorrents: 1,
            activeTorrents: 6,
          },
        ],
      },
    });
  });

  cy.contains("button", "15 min").click();
  cy.contains("button", "Apply").click();
});

Then("the snapshots request should use the 15 minute preset", () => {
  cy.wait("@presetSnapshots")
    .its("request.query")
    .should((query) => {
      expect(query.range).to.equal("15m");
      expect(query.from).to.be.undefined;
      expect(query.to).to.be.undefined;
    });
});

Then("I should see snapshot results for that preset", () => {
  cy.contains("Points").parent().should("contain.text", "2");
});

When("I switch to a custom snapshot range", () => {
  cy.clock(new Date("2026-04-06T01:00:00.000Z").getTime(), ["Date"]);
  cy.contains("button", "Custom").click();
  cy.get("#snapshot-from").clear().type("2026-04-06T00:00");
  cy.get("#snapshot-to").clear().type("2026-04-06T00:30");
});

When("I apply the custom snapshot range", () => {
  cy.intercept("GET", "**/api/snapshots*", (req) => {
    if (req.query.range !== "custom") {
      req.continue();
      return;
    }

    req.alias = "customSnapshots";
    req.reply({
      statusCode: 200,
      body: {
        integrationId: req.query.integrationId,
        range: "custom",
        from: req.query.from,
        to: req.query.to,
        items: [
          {
            id: "33333333-3333-3333-3333-333333333333",
            integrationId: req.query.integrationId,
            capturedAt: "2026-04-06T00:15:00.000Z",
            uploadedBytes: 4096,
            downloadedBytes: 2048,
            seedBonus: null,
            buffer: null,
            hitAndRuns: 0,
            ratio: 2.3,
            requiredRatio: 1.25,
            seedingTorrents: 6,
            leechingTorrents: 2,
            activeTorrents: 8,
          },
        ],
      },
    });
  });

  cy.contains("button", "Apply").click();
});

Then("the snapshots request should use the custom range", () => {
  cy.wait("@customSnapshots")
    .its("request.query")
    .should((query) => {
      expect(query.range).to.equal("custom");
      expect(query.from).to.equal("2026-04-06T00:00:00.000Z");
      expect(query.to).to.equal("2026-04-06T00:30:00.000Z");
    });

  cy.url().should("include", "range=custom");
  cy.url().should("include", "from=2026-04-06T00%3A00");
  cy.url().should("include", "to=2026-04-06T00%3A30");
});

Then("I should see snapshot results for that custom range", () => {
  cy.contains("Points").parent().should("contain.text", "1");
});
