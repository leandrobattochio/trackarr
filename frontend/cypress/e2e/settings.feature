Feature: Settings page
  Scenario: View and update application settings
    Given the settings api is stubbed
    When I open the settings page
    Then I should see the current HTTP settings
    When I clear the User-Agent field
    And I save the HTTP settings
    Then I should see the settings validation error
    When I enter a new User-Agent value
    And I save the HTTP settings
    Then the updated settings should be persisted
    When I open the About tab
    Then I should see the system information
