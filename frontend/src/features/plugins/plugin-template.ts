export const NEW_PLUGIN_TEMPLATE = `# Unique stable identifier used by integrations and API routes.
pluginId: custom-plugin

# Human-readable name shown in the UI.
displayName: Custom Plugin

# User-supplied connection fields.
# Engine-owned fields like cron, required_ratio, and baseUrl are injected automatically,
# so do not declare them here.
fields:
  - name: apiKey
    label: API Key
    type: password
    required: true
    sensitive: true

# Optional extra fields for tracker-specific identifiers or switches.
# Remove this section entirely if you do not need custom fields.
customFields:
  - name: profileId
    label: Profile ID
    type: text
    required: false
    sensitive: false

# Shared HTTP settings applied before every step.
# baseUrl is engine-owned and automatically resolved from the integration payload.
http:
  headers:
    Accept: application/json

# Optional HTML markers that indicate auth/session failure.
authFailure:
  htmlPatterns:
    - "sign in"
    - "login"

# Request pipeline. Each step fetches data and optionally extracts values.
steps:
  - name: fetchStats
    method: GET
    url: "api/user?api_token={{apiKey}}"
    responseType: json
    extract:
      ratio:
        path: data.ratio
        transform: decimal
      uploaded:
        path: data.uploaded
        transform: byteSize
      downloaded:
        path: data.downloaded
        transform: byteSize
      bonus:
        path: data.bonus
        transform: toString
    validate:
      - field: ratio
        rule: notEmpty
        onFail: unknownError

# Final stat mapping consumed by the app.
mapping:
  ratio: "steps.fetchStats.ratio"
  uploadedBytes: "steps.fetchStats.uploaded"
  downloadedBytes: "steps.fetchStats.downloaded"
  seedBonus: "steps.fetchStats.bonus"
  requiredRatio: "fields.required_ratio"

# Dashboard card metrics shown on the main page.
dashboard:
  metrics:
    - stat: uploadedBytes
      label: Uploaded
      format: bytes
      icon: arrow-up
      tone: success
    - stat: downloadedBytes
      label: Downloaded
      format: bytes
      icon: arrow-down
      tone: primary
    - stat: seedBonus
      label: Bonus
      format: text
      icon: coins
      tone: warning
`;
