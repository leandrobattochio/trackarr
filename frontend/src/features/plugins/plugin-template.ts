export const NEW_PLUGIN_TEMPLATE = `pluginId: custom-plugin
displayName: Custom Plugin
fields:
  - name: cron
    label: Sync Schedule
    type: cron
    required: true
    sensitive: false
  - name: baseUrl
    label: Base URL
    type: text
    required: true
    sensitive: false
http:
  baseUrl: "{{baseUrl}}"
  headers:
    Accept: application/json
authFailure:
  httpStatusCodes:
    - 401
    - 403
steps:
  - name: fetchStats
    method: GET
    url: api/user
    responseType: json
    extract:
      ratio:
        path: data.ratio
        transform: decimal
      uploaded:
        path: data.uploaded
        transform: byteSize
mapping:
  ratio: steps.fetchStats.ratio
  uploadedBytes: steps.fetchStats.uploaded
dashboard:
  metrics:
    - stat: uploadedBytes
      label: Uploaded
      format: bytes
      icon: arrow-up
      tone: success
`;
