Feature: Add tracker validation
  Scenario: Validate add tracker input before creating an integration
    Given the add tracker dashboard api is stubbed
    When I open the dashboard with add tracker stubs
    And I open the Seedpool add tracker dialog
    And I submit the add tracker form without entering values
    Then I should see required add tracker validation messages
    When I enter invalid typed add tracker values
    Then I should see typed add tracker validation messages
    When I enter valid Seedpool add tracker values
    And I submit the add tracker form
    Then the Seedpool integration should be created from the add tracker dialog
