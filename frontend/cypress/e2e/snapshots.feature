Feature: Snapshot history
  Scenario: Open the snapshots page for an integration with no history yet
    Given I reset existing integrations
    And I have a Seedpool integration on the dashboard
    When I open snapshots for the Seedpool integration
    Then I should see the snapshots page for that integration
    And I should see that no snapshot data is available

  Scenario: Filter snapshots by preset and custom ranges
    Given I reset existing integrations
    And I have a Seedpool integration on the dashboard
    When I open snapshots for the Seedpool integration
    And I filter snapshots using the 15 minute preset
    Then the snapshots request should use the 15 minute preset
    And I should see snapshot results for that preset
    When I switch to a custom snapshot range
    And I apply the custom snapshot range
    Then the snapshots request should use the custom range
    And I should see snapshot results for that custom range
