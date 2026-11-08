Feature: What's New
  Scenario: What's New opens by itself once, keeps Plugins when release notes are unavailable, and is read after closing
    Given the What's New api reports a Seedpool update and unavailable trackarr release notes
    When I open the dashboard page
    Then What's New should open by itself
    And it should say it could not load trackarr release notes
    And it should list the Seedpool update
    When I close What's New
    Then everything should be marked as read
    When I reload the page
    Then What's New should not open by itself
    When I open What's New from the menu
    Then What's New should list no new plugin update

  Scenario: a newer trackarr release is announced
    Given the What's New api reports trackarr 0.5.0 is available
    When I open the dashboard page
    Then What's New should open by itself
    And it should show the trackarr 0.4.0 release notes
    And it should link to the trackarr 0.5.0 release in the dialog and the menu

  Scenario: the read state is stored on the server
    Given What's New was read on the server
    When I open the dashboard page
    Then What's New should not open by itself
    When I open What's New from the menu
    And I close What's New
    Then the server should report What's New as read
