export function tryGetPluginId(yaml: string) {
  const match = yaml.match(/^\s*pluginId\s*:\s*["']?([A-Za-z0-9-]+)["']?\s*$/m);
  return match?.[1] ?? null;
}
