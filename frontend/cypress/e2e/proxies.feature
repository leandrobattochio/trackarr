Feature: Tracker proxies
  Scenario: Add, test and edit a proxy in Settings
    Given I reset existing integrations and proxies
    When I open the Proxies settings
    And I add the "Home VPN" SOCKS5 proxy at "127.0.0.1" port "1" with user "bob" and password "secret"
    Then the proxy "Home VPN" should be listed as "SOCKS5" at "127.0.0.1:1 · user bob"
    When I test the proxy "Home VPN" in its dialog
    Then the proxy test should report that it could not reach the test URL
    When I change the port of the proxy "Home VPN" to "1081"
    Then the proxy "Home VPN" should be listed as "SOCKS5" at "127.0.0.1:1081 · user bob"

  Scenario: Send an integration through a proxy and keep the proxy while it is used
    Given I reset existing integrations and proxies
    And the "Office" HTTP proxy exists
    And a Seedpool integration exists
    When I open the dashboard
    And I pick the proxy "Office" for the "Seedpool" integration
    Then the "Seedpool" integration should use the proxy "Office"
    When I open the Proxies settings
    And I delete the proxy "Office"
    Then I should see that the proxy is used by "Seedpool"
    And the proxy "Office" should be listed as "HTTP" at "127.0.0.1:3128 · no login"
    When I open the dashboard
    And I pick the proxy "No proxy" for the "Seedpool" integration
    And I open the Proxies settings
    And I delete the proxy "Office"
    Then there should be no proxies
