Feature: Manage plugins
  Scenario: Inspect disk-backed plugin definitions and start a new draft
    Given I open the manage plugins page
    Then I should see the disk-backed plugin catalog
    When I select the Seedpool plugin definition
    Then I should see the Seedpool definition editor
    When I start a new plugin draft
    Then I should see the new plugin draft editor
