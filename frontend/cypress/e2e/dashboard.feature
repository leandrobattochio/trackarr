Feature: Dashboard integrations
  Scenario: Create a Seedpool integration from the dashboard
    Given I reset existing integrations
    And I open the dashboard
    Then I should see the empty integrations state
    When I add a Seedpool integration
    Then I should see the Seedpool integration on the dashboard

  Scenario: Drag a dashboard card to the right and keep the order after reload
    Given I reset existing integrations
    And I have multiple integrations on the dashboard
    When I open the dashboard
    Then the dashboard cards should be ordered as "Seedpool, Fearnopeer, BJ-Share"
    When I drag the "Seedpool" card onto the "BJ-Share" card
    And I reload the dashboard
    Then the dashboard cards should be ordered as "Fearnopeer, BJ-Share, Seedpool"

  Scenario: Drag a dashboard card to the left and keep the order after reload
    Given I reset existing integrations
    And I have multiple integrations on the dashboard
    When I open the dashboard
    Then the dashboard cards should be ordered as "Seedpool, Fearnopeer, BJ-Share"
    When I drag the "BJ-Share" card onto the "Seedpool" card
    When I reload the dashboard
    Then the dashboard cards should be ordered as "BJ-Share, Seedpool, Fearnopeer"
