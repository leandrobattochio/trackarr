import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

const DASHBOARD_CARD_ORDER_STORAGE_KEY = "trackarr.dashboard.card-order";

function createIntegration(pluginId: string, payload: Record<string, string>) {
  cy.request("POST", `${Cypress.env("apiUrl")}/api/integrations`, {
    pluginId,
    payload: JSON.stringify(payload),
  });
}

Given("I reset existing integrations", () => {
  cy.request(`${Cypress.env("apiUrl")}/api/integrations`).then(({ body }) => {
    const integrations = body as Array<{ id: string }>;

    integrations.forEach((integration) => {
      cy.request("DELETE", `${Cypress.env("apiUrl")}/api/integrations/${integration.id}`);
    });
  });
});

Given("I open the dashboard", () => {
  cy.visit("/", {
    onBeforeLoad(window) {
      window.localStorage.removeItem(DASHBOARD_CARD_ORDER_STORAGE_KEY);
    },
  });
  cy.contains("Dashboard").should("be.visible");
});

Given("I have multiple integrations on the dashboard", () => {
  createIntegration("seedpool", {
    baseUrl: "https://seedpool.org",
    apiKey: "test-seedpool-key",
    required_ratio: "1.25",
    cron: "0 * * * *",
  });
  createIntegration("fearnopeer", {
    baseUrl: "https://fearnopeer.com",
    apiKey: "test-fnp-key",
    required_ratio: "1.25",
    cron: "0 * * * *",
  });
  createIntegration("bj-share", {
    baseUrl: "https://bj-share.info",
    cookie: "uid=test; pass=test",
    username: "bj-user",
    required_ratio: "1.25",
    cron: "0 * * * *",
  });
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

Then("the dashboard cards should be ordered as {string}", (expectedOrder: string) => {
  const expectedTitles = expectedOrder.split(",").map((title) => title.trim());

  cy.get('[data-testid="dashboard-cards-grid"] [data-testid="tracker-card-title"]')
    .should(($titles) => {
      expect([...$titles].map((title) => title.textContent?.trim() ?? "")).to.deep.equal(expectedTitles);
    });
});

When("I drag the {string} card onto the {string} card", (sourceTitle: string, targetTitle: string) => {
  cy.window().then((window) => {
    const findCard = (title: string) =>
      [...window.document.querySelectorAll<HTMLElement>('[data-testid="tracker-card"]')]
        .find((element) => element.textContent?.includes(title));

    const sourceCard = findCard(sourceTitle);
    const targetCard = findCard(targetTitle);

    expect(sourceCard, `source card for ${sourceTitle}`).to.not.equal(undefined);
    expect(targetCard, `target card for ${targetTitle}`).to.not.equal(undefined);

    const sourceCardId = sourceCard?.getAttribute("data-tracker-id") ?? "";
    const dataTransfer = new window.DataTransfer();
    dataTransfer.setData("text/plain", sourceCardId);

    sourceCard?.dispatchEvent(new window.DragEvent("dragstart", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
    targetCard?.dispatchEvent(new window.DragEvent("dragover", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
    targetCard?.dispatchEvent(new window.DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
    sourceCard?.dispatchEvent(new window.DragEvent("dragend", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
  });
});

When("I reload the dashboard", () => {
  cy.reload();
  cy.contains("Dashboard").should("be.visible");
});
