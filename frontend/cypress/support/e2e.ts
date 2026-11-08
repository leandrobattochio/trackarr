// Cypress support entrypoint.

// A fresh database opens What's New by itself; mark it read so the dialog does not cover other specs.
beforeEach(() => {
  cy.request("POST", `${Cypress.env("apiUrl")}/api/whats-new/read`);
});

// Chrome reports this when a Radix popover resizes inside a scrolling dialog; it is not an app error.
Cypress.on("uncaught:exception", (error) => !error.message.includes("ResizeObserver loop"));
