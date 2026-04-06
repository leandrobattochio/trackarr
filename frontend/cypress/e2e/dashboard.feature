Feature: Dashboard integrations
  Scenario: Create a Seedpool integration from the dashboard
    Given I reset existing integrations
    And I open the dashboard
    Then I should see the empty integrations state
    When I add a Seedpool integration
    Then I should see the Seedpool integration on the dashboard
