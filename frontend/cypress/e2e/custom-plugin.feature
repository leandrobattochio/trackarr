Feature: Custom plugins
  Scenario: Create a custom plugin from the blank template
    Given I open the plugin editor
    When I start a new plugin draft
    Then the editor should hold the blank template with a pluginId placeholder
    When I create the draft without replacing the placeholder
    Then I should see the API's message "is invalid. It must match"
    When I create the draft with the official id "seedpool"
    Then I should see the API's message "belongs to an official plugin, so a custom plugin cannot use it."
    When I create the draft with a new custom id
    Then the new plugin should be listed as Custom
    And the API should report the new plugin as custom

  Scenario: Deleting a custom plugin used by an integration is blocked
    Given a custom plugin used by an integration
    And I open the plugin editor for that custom plugin
    When I delete the custom plugin
    Then I should see the integration that blocks the deletion
    When I close the dialog, delete that integration and delete the custom plugin again
    Then the custom plugin should be gone
