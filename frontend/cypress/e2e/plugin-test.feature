Feature: Test a plugin with an integration's settings
  Scenario: Test runs the editor YAML and shows a success
    Given the plugin api reports Seedpool with one integration and a successful dry run
    When I open the Seedpool plugin editor
    And I change the Seedpool YAML without saving
    And I click Test
    Then I should be asked which Seedpool integration to use
    When I run the test
    Then the dry run should use the unsaved editor YAML
    And I should see a successful result with step statuses and stats

  Scenario: Test official shows a failure with the failing field
    Given the plugin api reports an outdated Seedpool override whose last sync failed and a failing dry run
    When I open the Seedpool update review
    And I click Test official
    Then I should be asked which Seedpool integration to use
    When I run the test
    Then the dry run should use the official Seedpool
    And I should see a failed result with the HTTP status and the failing field

  Scenario: Test is disabled when no integration uses the plugin
    Given the plugin api reports Seedpool without any integration
    When I open the Seedpool plugin editor
    Then the Test button should be disabled with an explanation
