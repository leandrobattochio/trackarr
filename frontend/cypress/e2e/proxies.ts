import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

const apiUrl = () => Cypress.env("apiUrl") as string;

// Radix gives focus back to the trigger when the list closes; typing before that lands in the select.
function pickOption(triggerTestId: string, option: string) {
  cy.get(`[data-testid="${triggerTestId}"]`).click();
  cy.contains('[role="option"]', option).click();
  cy.get('[role="listbox"]').should("not.exist");
  cy.focused().should("have.attr", "data-testid", triggerTestId);
}

function proxyRow(name: string) {
  return cy.get(`[data-testid="proxy-row"][data-proxy-name="${name}"]`);
}

Given("I reset existing integrations and proxies", () => {
  cy.request(`${apiUrl()}/api/integrations`).then(({ body }) => {
    (body as Array<{ id: string }>).forEach((integration) => {
      cy.request("DELETE", `${apiUrl()}/api/integrations/${integration.id}`);
    });
  });
  cy.request(`${apiUrl()}/api/proxies`).then(({ body }) => {
    (body as Array<{ id: string }>).forEach((proxy) => {
      cy.request("DELETE", `${apiUrl()}/api/proxies/${proxy.id}`);
    });
  });
});

Given("the {string} HTTP proxy exists", (name: string) => {
  cy.request("POST", `${apiUrl()}/api/proxies`, { name, type: "http", host: "127.0.0.1", port: 3128, username: null, password: null });
});

Given("a Seedpool integration exists", () => {
  cy.request("POST", `${apiUrl()}/api/integrations`, {
    pluginId: "seedpool",
    payload: JSON.stringify({ baseUrl: "https://seedpool.org/", apiKey: "test-seedpool-key", required_ratio: "1.25", cron: "0 0 1 1 *" }),
  });
});

When("I open the Proxies settings", () => {
  cy.visit("/settings");
  cy.contains('[role="tab"]', "Proxies").click();
  cy.get('[data-testid="proxies-tab"]').should("be.visible");
});

When("I open the dashboard", () => {
  cy.visit("/");
  cy.contains("Dashboard").should("be.visible");
});

When(
  "I add the {string} SOCKS5 proxy at {string} port {string} with user {string} and password {string}",
  (name: string, host: string, port: string, username: string, password: string) => {
    cy.get('[data-testid="add-proxy"]').click();
    cy.get("#proxy-name").type(name);
    pickOption("proxy-type-select", "SOCKS5");
    cy.get("#proxy-host").type(host);
    cy.get("#proxy-port").clear().type(port);
    cy.get("#proxy-username").type(username);
    cy.get("#proxy-password").type(password);
    cy.contains("button", "Save proxy").click();
    cy.contains(`Proxy ${name} saved`).should("be.visible");
  },
);

Then("the proxy {string} should be listed as {string} at {string}", (name: string, type: string, address: string) => {
  proxyRow(name).should("contain.text", type).and("contain.text", address);
});

When("I test the proxy {string} in its dialog", (name: string) => {
  cy.get(`[aria-label="Edit ${name}"]`).click();
  cy.get('[role="dialog"]').contains("button", /^Test$/).click();
});

Then("the proxy test should report that it could not reach the test URL", () => {
  cy.get('[data-testid="proxy-test-result"]', { timeout: 20000 })
    .should("contain.text", "Could not reach")
    .and("contain.text", "through the proxy.");
  cy.get("body").type("{esc}");
});

When("I change the port of the proxy {string} to {string}", (name: string, port: string) => {
  cy.get(`[aria-label="Edit ${name}"]`).click();
  cy.get("#proxy-password").should("have.attr", "placeholder", "Saved password unchanged");
  cy.get("#proxy-port").clear().type(port);
  cy.contains("button", "Save proxy").click();
  cy.contains(`Proxy ${name} saved`).should("be.visible");
});

When("I pick the proxy {string} for the {string} integration", (proxy: string, tracker: string) => {
  cy.contains('[data-testid="tracker-card"]', tracker).find('[aria-label="Edit integration"]').click();
  pickOption("integration-proxy-select", proxy);
  // The edit form asks for the saved API key again before it saves.
  cy.get('[role="dialog"] input[id$="-apiKey"]').type("test-seedpool-key");
  cy.contains("button", "Save changes").click();
  cy.contains(`${tracker} updated`).should("be.visible");
});

Then("the {string} integration should use the proxy {string}", (tracker: string, proxy: string) => {
  cy.request(`${apiUrl()}/api/proxies`).then(({ body: proxies }) => {
    const proxyId = (proxies as Array<{ id: string; name: string }>).find((item) => item.name === proxy)?.id;
    cy.request(`${apiUrl()}/api/integrations`).its("body").should((integrations: Array<{ pluginId: string; proxyId: string | null }>) => {
      expect(integrations.find((integration) => integration.pluginId === tracker.toLowerCase())?.proxyId).to.equal(proxyId);
    });
  });
});

When("I delete the proxy {string}", (name: string) => {
  cy.get(`[aria-label="Delete ${name}"]`).click();
  cy.get('[role="alertdialog"]').contains("button", "Delete").click();
});

Then("I should see that the proxy is used by {string}", (tracker: string) => {
  cy.contains(`Used by: ${tracker}.`).should("be.visible");
});

Then("there should be no proxies", () => {
  cy.contains("No proxies yet.").should("be.visible");
});
