Feature: Outdated override warning and diffs
  Scenario: an outdated override shows the banner, both diffs and the changelog
    Given the plugin api reports an outdated Seedpool override
    When I open the dashboard page
    Then I should see the outdated override banner for Seedpool
    When I open the settings page from the sidebar
    Then I should see the outdated override banner for Seedpool
    When I follow the Seedpool banner link
    Then I should see the Seedpool update review with both diffs and the changelog
    And I should not see the Test official button

  Scenario: the warning is highlighted when the override's last sync failed
    Given the plugin api reports an outdated Seedpool override whose last sync failed
    When I open the Seedpool update review
    Then the outdated warning should be highlighted with Test official

  Scenario: Use official deletes the override after a confirmation
    Given the plugin api reports an outdated Seedpool override
    When I open the Seedpool update review
    And I click Use official
    Then I should be warned that the override is deleted with no backup
    When I confirm Use official
    Then the Seedpool override should be deleted
    And I should be back on the Seedpool plugin without the banner

  Scenario: Keep mine changes nothing and the warning stays
    Given the plugin api reports an outdated Seedpool override
    When I open the Seedpool update review
    And I click Keep mine
    Then I should be back on the Seedpool plugin with the banner still shown
    And the Seedpool override should not be deleted
