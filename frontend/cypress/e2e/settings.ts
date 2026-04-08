import { Given, Then, When } from "@badeball/cypress-cucumber-preprocessor";

let currentSettings = {
  userAgent: "TrackArr/1.0",
};

let liveAboutInfo: Record<string, unknown> | null = null;

Given("the settings api is stubbed", () => {
  currentSettings = {
    userAgent: "TrackArr/1.0",
  };

  cy.intercept("GET", "/api/settings", (request) => {
    request.reply({
      statusCode: 200,
      body: currentSettings,
    });
  }).as("getSettings");

  cy.intercept("GET", "/api/about").as("getAbout");

  cy.intercept("PUT", "/api/settings", (request) => {
    expect(request.body).to.deep.equal({
      userAgent: "TrackArr/2.0",
    });

    currentSettings = {
      userAgent: request.body.userAgent as string,
    };

    request.reply({
      statusCode: 200,
      body: currentSettings,
    });
  }).as("updateSettings");
});

When("I open the settings page", () => {
  cy.visit("/settings");
  cy.wait("@getSettings");
  cy.wait("@getAbout").then(({ response }) => {
    liveAboutInfo = (response?.body ?? null) as Record<string, unknown> | null;
  });
  cy.contains("Settings").should("be.visible");
});

Then("I should see the current HTTP settings", () => {
  cy.contains("Outgoing Request Headers").should("be.visible");
  cy.get("#user-agent").should("have.value", "TrackArr/1.0");
  cy.contains("button", "Save").should("be.disabled");
});

When("I clear the User-Agent field", () => {
  cy.get("#user-agent").clear().type("   ");
});

When("I save the HTTP settings", () => {
  cy.contains("button", "Save").click();
});

Then("I should see the settings validation error", () => {
  cy.contains("User-Agent must not be empty.").should("be.visible");
  cy.get("@updateSettings.all").should("have.length", 0);
});

When("I enter a new User-Agent value", () => {
  cy.get("#user-agent").clear().type("TrackArr/2.0");
});

Then("the updated settings should be persisted", () => {
  cy.wait("@updateSettings");
  cy.wait("@getSettings");
  cy.contains("Settings saved.").should("be.visible");
  cy.get("#user-agent").should("have.value", "TrackArr/2.0");
  cy.contains("button", "Save").should("be.disabled");
});

When("I open the About tab", () => {
  cy.contains("button", "About").click();
});

Then("I should see the system information", () => {
  cy.contains("System Information").should("be.visible");
  expect(liveAboutInfo).to.not.equal(null);

  cy.contains("Version").should("be.visible");
  cy.contains(String(liveAboutInfo?.version)).should("be.visible");
  cy.contains(".NET").should("be.visible");
  cy.contains(String(liveAboutInfo?.dotNetVersion)).should("be.visible");
  cy.contains("10.").should("be.visible");
  cy.contains("Docker").should("be.visible");
  cy.contains(String(liveAboutInfo?.runningInDocker ? "Yes" : "No")).should("be.visible");
});
