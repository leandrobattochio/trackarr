Feature: Snapshot history
  Scenario: Open the snapshots page for an integration with no history yet
    Given I reset existing integrations
    And I have a Seedpool integration on the dashboard
    When I open snapshots for the Seedpool integration
    Then I should see the snapshots page for that integration
    And I should see that no snapshot data is available
