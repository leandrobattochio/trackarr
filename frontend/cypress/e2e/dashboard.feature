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
    When I unlock card reordering
    And I drag the "Seedpool" card onto the "BJ-Share" card
    And I reload the dashboard
    Then the dashboard cards should be ordered as "Fearnopeer, BJ-Share, Seedpool"

  Scenario: Drag a dashboard card to the left and keep the order after reload
    Given I reset existing integrations
    And I have multiple integrations on the dashboard
    When I open the dashboard
    Then the dashboard cards should be ordered as "Seedpool, Fearnopeer, BJ-Share"
    When I unlock card reordering
    And I drag the "BJ-Share" card onto the "Seedpool" card
    When I reload the dashboard
    Then the dashboard cards should be ordered as "BJ-Share, Seedpool, Fearnopeer"

  Scenario: Drag lock toggle is visible and locked by default
    Given I reset existing integrations
    And I have multiple integrations on the dashboard
    When I open the dashboard
    Then the drag lock toggle should be visible and locked
    And the edit mode banner should not be visible

  Scenario: Edit mode banner appears when unlocked and disappears when locked
    Given I reset existing integrations
    And I have multiple integrations on the dashboard
    When I open the dashboard
    Then the edit mode banner should not be visible
    When I unlock card reordering
    Then the edit mode banner should be visible
    When I lock card reordering
    Then the edit mode banner should not be visible

  Scenario: Cards cannot be reordered when locked
    Given I reset existing integrations
    And I have multiple integrations on the dashboard
    When I open the dashboard
    Then the dashboard cards should be ordered as "Seedpool, Fearnopeer, BJ-Share"
    When I try to drag the "Seedpool" card onto the "BJ-Share" card while locked
    Then the dashboard cards should be ordered as "Seedpool, Fearnopeer, BJ-Share"

  Scenario: Cards can be reordered after unlocking
    Given I reset existing integrations
    And I have multiple integrations on the dashboard
    When I open the dashboard
    Then the dashboard cards should be ordered as "Seedpool, Fearnopeer, BJ-Share"
    When I unlock card reordering
    And I drag the "Seedpool" card onto the "BJ-Share" card
    Then the dashboard cards should be ordered as "Fearnopeer, BJ-Share, Seedpool"
