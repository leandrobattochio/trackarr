import { WIKI_URL } from "@/shared/lib/docs";

export const NEW_PLUGIN_TEMPLATE = `# How to write a plugin: ${WIKI_URL}/Writing-a-Plugin
pluginId: <your-plugin-id>
displayName: My Tracker
version: 1.0.0
schemaVersion: 1

baseUrls:
  - https://tracker.example/

fields:
  - name: apiKey
    label: API Key
    type: password
    required: true
    sensitive: true

http:
  headers:
    Accept: application/json

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

mapping:
  ratio: "steps.fetchStats.ratio"
  uploadedBytes: "steps.fetchStats.uploaded"
  downloadedBytes: "steps.fetchStats.downloaded"
  seedBonus: "steps.fetchStats.bonus"
  requiredRatio: "fields.required_ratio"

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
