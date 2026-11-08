import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

const apiUrl = () => Cypress.env("apiUrl") as string;
const RELEASE_URL = "https://github.com/leandrobattochio/trackarr/releases/tag/v0.5.0";

let read = false;
let readCalls = 0;

function app(overrides: Record<string, unknown>) {
  return {
    status: "available",
    installedVersion: "0.4.0",
    latestRelease: null,
    updateAvailable: false,
    releases: [],
    checkedAt: "2026-11-07T10:00:00Z",
    error: null,
    ...overrides,
  };
}

const seedpoolUpdate = {
  id: 7,
  pluginId: "seedpool",
  fromVersion: "1.0.0",
  toVersion: "1.1.0",
  appliedAt: "2026-11-07T10:00:00Z",
  changelog: [{ version: "1.1.0", date: "2026-11-06", notes: "Adds the buffer metric." }],
};

function stubWhatsNew(unread: { app: Record<string, unknown>; pluginUpdates: unknown[] }) {
  read = false;
  readCalls = 0;

  cy.intercept("GET", "/api/whats-new", (request) => {
    request.reply({
      statusCode: 200,
      body: read
        ? { shouldAutoOpen: false, lastReadAppVersion: "0.4.0", lastReadPluginChangeId: 7, lastReadAt: "2026-11-07T11:00:00Z", app: { ...unread.app, releases: [] }, pluginUpdates: [] }
        : { shouldAutoOpen: true, lastReadAppVersion: null, lastReadPluginChangeId: null, lastReadAt: null, ...unread },
    });
  }).as("getWhatsNew");

  cy.intercept("POST", "/api/whats-new/read", (request) => {
    read = true;
    readCalls += 1;
    request.reply({ statusCode: 204 });
  }).as("markWhatsNewRead");
}

const dialog = () => cy.get('[data-testid="whats-new-dialog"]');

Given("the What's New api reports a Seedpool update and unavailable trackarr release notes", () => {
  stubWhatsNew({
    app: app({ status: "unavailable", error: "The GitHub Releases API rate limit was reached (HTTP 403). Restart trackarr later to check again." }),
    pluginUpdates: [seedpoolUpdate],
  });
});

Given("the What's New api reports trackarr 0.5.0 is available", () => {
  const latest = { version: "0.5.0", tagName: "v0.5.0", name: "v0.5.0", url: RELEASE_URL, publishedAt: "2026-11-08T10:00:00Z", notes: "Newer release." };
  stubWhatsNew({
    app: app({
      updateAvailable: true,
      latestRelease: latest,
      releases: [{ version: "0.4.0", tagName: "v0.4.0", name: "v0.4.0", url: null, publishedAt: "2026-11-07T10:00:00Z", notes: "### Breaking changes\n- Plugins come from trackarr-plugins." }],
    }),
    pluginUpdates: [],
  });
});

Given("What's New was read on the server", () => {
  cy.request("POST", `${apiUrl()}/api/whats-new/read`);
  cy.intercept("GET", "/api/whats-new").as("getWhatsNew");
  cy.intercept("POST", "/api/whats-new/read").as("markWhatsNewRead");
});

When("I open the dashboard page", () => {
  cy.visit("/");
  cy.wait("@getWhatsNew");
});

When("I reload the page", () => {
  cy.reload();
  cy.wait("@getWhatsNew");
});

Then("What's New should open by itself", () => {
  dialog().should("be.visible").and("contain", "What's New");
});

Then("What's New should not open by itself", () => {
  cy.contains("button", "What's New").should("be.visible");
  dialog().should("not.exist");
});

Then("it should say it could not load trackarr release notes", () => {
  dialog().find('[data-testid="whats-new-app-unavailable"]').should("contain", "Could not load trackarr release notes.").and("contain", "rate limit");
});

Then("it should list the Seedpool update", () => {
  dialog()
    .find('[data-testid="whats-new-plugin-seedpool"]')
    .should("contain", "Seedpool")
    .and("contain", "v1.0.0 → v1.1.0")
    .and("contain", "Adds the buffer metric.");
});

Then("it should show the trackarr 0.4.0 release notes", () => {
  dialog().find('[data-testid="whats-new-app-0.4.0"]').should("contain", "v0.4.0").and("contain", "Plugins come from trackarr-plugins.");
});

Then("it should link to the trackarr 0.5.0 release in the dialog and the menu", () => {
  dialog().contains("a", "trackarr v0.5.0 available").should("have.attr", "href", RELEASE_URL);
  dialog().contains("button", /^Close$/).click();
  cy.get('[data-sidebar="sidebar"]').contains("a", "trackarr v0.5.0 available").should("have.attr", "href", RELEASE_URL);
});

When("I close What's New", () => {
  dialog().contains("button", /^Close$/).click();
  dialog().should("not.exist");
});

Then("everything should be marked as read", () => {
  cy.wait("@markWhatsNewRead");
  cy.wait("@getWhatsNew");
  cy.then(() => expect(readCalls).to.equal(1));
});

When("I open What's New from the menu", () => {
  cy.contains("button", "What's New").click();
  dialog().should("be.visible");
});

Then("What's New should list no new plugin update", () => {
  dialog().find('[data-testid="whats-new-plugins-section"]').should("contain", "No new plugin updates.");
  dialog().find('[data-testid="whats-new-plugin-seedpool"]').should("not.exist");
  cy.then(() => expect(readCalls).to.equal(1));
});

Then("the server should report What's New as read", () => {
  cy.wait("@markWhatsNewRead").its("response.statusCode").should("equal", 204);
  cy.request(`${apiUrl()}/api/whats-new`).then(({ body }) => {
    expect(body.shouldAutoOpen).to.equal(false);
    expect(body.lastReadAt).to.be.a("string");
    expect(body.pluginUpdates).to.deep.equal([]);
  });
});
