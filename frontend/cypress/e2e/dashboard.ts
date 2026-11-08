import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

const DASHBOARD_CARD_ORDER_STORAGE_KEY = "trackarr.dashboard.card-order";
const DASHBOARD_VIEW_MODE_STORAGE_KEY = "trackarr.dashboard.view-mode";

const TRACKER_ITEMS = {
  card: { container: "dashboard-cards-grid", item: "tracker-card", title: "tracker-card-title" },
  row: { container: "dashboard-list", item: "tracker-row", title: "tracker-row-title" },
} as const;

type TrackerItemKind = keyof typeof TRACKER_ITEMS;

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
      window.localStorage.removeItem(DASHBOARD_VIEW_MODE_STORAGE_KEY);
    },
  });
  cy.contains("Dashboard").should("be.visible");
});

Given("I have multiple integrations on the dashboard", () => {
  createIntegration("seedpool", {
    baseUrl: "https://seedpool.org/",
    apiKey: "test-seedpool-key",
    required_ratio: "1.25",
    cron: "0 * * * *",
  });
  createIntegration("fearnopeer", {
    baseUrl: "https://fearnopeer.com/",
    apiKey: "test-fnp-key",
    required_ratio: "1.25",
    cron: "0 * * * *",
  });
  createIntegration("bj-share", {
    baseUrl: "https://bj-share.info/",
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

  cy.get("#apiKey").clear().type("test-api-key");
  cy.get("#required_ratio").clear().type("1.25");
  cy.get("#cron").clear().type("0 * * * *");

  cy.contains("button", "Connect").click();
});

Then("I should see the Seedpool integration on the dashboard", () => {
  cy.contains("Seedpool").should("be.visible");
  cy.contains("No integrations yet. Add a tracker to get started.").should("not.exist");
});

function expectTrackerOrder(kind: TrackerItemKind, expectedOrder: string) {
  const { container, title } = TRACKER_ITEMS[kind];
  const expectedTitles = expectedOrder.split(",").map((name) => name.trim());

  cy.get(`[data-testid="${container}"] [data-testid="${title}"]`)
    .should(($titles) => {
      expect([...$titles].map((element) => element.textContent?.trim() ?? "")).to.deep.equal(expectedTitles);
    });
}

function dragTracker(kind: TrackerItemKind, sourceTitle: string, targetTitle: string) {
  const itemSelector = `[data-testid="${TRACKER_ITEMS[kind].item}"]`;

  cy.contains(itemSelector, sourceTitle)
    .should("exist")
    .then(($source) => {
      const source = $source[0];

      if (!source)
        throw new Error(`Expected to find the ${kind} for ${sourceTitle}.`);

      const sourceId = source.getAttribute("data-tracker-id");
      expect(sourceId, `data-tracker-id for ${sourceTitle}`).to.be.a("string").and.not.equal("");

      if (!sourceId)
        throw new Error(`Expected the ${kind} for ${sourceTitle} to have a data-tracker-id attribute.`);

      cy.contains(itemSelector, targetTitle)
        .should("exist")
        .then(($target) => {
          const target = $target[0];

          if (!target)
            throw new Error(`Expected to find the ${kind} for ${targetTitle}.`);

          cy.window().then((window) => {
            const dataTransfer = new window.DataTransfer();
            dataTransfer.setData("text/plain", sourceId);
            const dispatch = (element: Element, type: string) =>
              element.dispatchEvent(new window.DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));

            dispatch(source, "dragstart");
            dispatch(target, "dragover");
            dispatch(target, "drop");
            dispatch(source, "dragend");
          });
        });
    });
}

Then("the dashboard cards should be ordered as {string}", (expectedOrder: string) => {
  expectTrackerOrder("card", expectedOrder);
});

Then("the dashboard rows should be ordered as {string}", (expectedOrder: string) => {
  expectTrackerOrder("row", expectedOrder);
});

When("I drag the {string} card onto the {string} card", (sourceTitle: string, targetTitle: string) => {
  dragTracker("card", sourceTitle, targetTitle);
});

When("I drag the {string} row onto the {string} row", (sourceTitle: string, targetTitle: string) => {
  dragTracker("row", sourceTitle, targetTitle);
});

When("I switch the dashboard to the {word} view", (mode: string) => {
  cy.get(`[data-testid="dashboard-view-${mode}"]`).click();
});

Then("the dashboard should show the trackers as cards", () => {
  cy.get('[data-testid="dashboard-cards-grid"]').should("be.visible");
  cy.get('[data-testid="dashboard-list"]').should("not.exist");
});

Then("the dashboard should show the trackers as a list", () => {
  cy.get('[data-testid="dashboard-list"]').should("be.visible");
  cy.get('[data-testid="dashboard-cards-grid"]').should("not.exist");
});

When("I reload the dashboard", () => {
  cy.reload();
  cy.contains("Dashboard").should("be.visible");
});
