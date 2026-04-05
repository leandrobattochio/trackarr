import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { Braces, Database, FileCode2, FolderOpen, Loader2, Plus } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";
import { usePluginCatalog, usePluginDefinition } from "@/features/plugins/hooks";
import { NEW_PLUGIN_TEMPLATE } from "@/features/plugins/plugin-template";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import type { ApiPluginListItem } from "@/features/plugins/types";

const EDITOR_HEIGHT = "70vh";

function getSourceMeta(source: ApiPluginListItem["source"]) {
  if (source === "database") {
    return {
      label: "Database",
      icon: Database,
      className: "border-primary/40 bg-primary/10 text-primary",
    };
  }

  return {
    label: "Disk",
    icon: FolderOpen,
    className: "border-border/70 bg-muted/40 text-muted-foreground",
  };
}

export default function ManagePluginsPage() {
  usePageTitle("TrackArr | Manage Plugins");

  const { data: plugins = [], isLoading, error } = usePluginCatalog();
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  useEffect(() => {
    if (plugins.length === 0 || isCreatingNew) {
      return;
    }

    setSelectedPluginId((current) => current ?? plugins[0].pluginId);
  }, [plugins, isCreatingNew]);

  const selectedPlugin = useMemo(
    () => plugins.find((plugin) => plugin.pluginId === selectedPluginId) ?? null,
    [plugins, selectedPluginId],
  );

  const definitionQuery = usePluginDefinition(selectedPluginId ?? "", Boolean(selectedPluginId) && !isCreatingNew);

  useEffect(() => {
    if (!definitionQuery.data || isCreatingNew) {
      return;
    }

    setEditorValue(definitionQuery.data);
  }, [definitionQuery.data, isCreatingNew]);

  function handleSelectPlugin(pluginId: string) {
    setIsCreatingNew(false);
    setSelectedPluginId(pluginId);
    setEditorValue("");
  }

  function handleCreatePlugin() {
    setIsCreatingNew(true);
    setSelectedPluginId(null);
    setEditorValue(NEW_PLUGIN_TEMPLATE);
  }

  const activeSourceMeta = selectedPlugin ? getSourceMeta(selectedPlugin.source) : null;
  const selectedFieldCount = selectedPlugin?.fields.length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Manage Plugins</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Review built-in YAML definitions, inspect database overrides, and start new plugin drafts from a starter schema.
            </p>
          </div>
          <Button onClick={handleCreatePlugin} className="xl:self-start">
            <Plus className="h-4 w-4" />
            New Plugin
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="border-border/50 bg-card/95">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Plugin Catalog</CardTitle>
                  <CardDescription>Available disk and database definitions.</CardDescription>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Loaded</p>
                  <p className="font-display text-lg font-semibold">{plugins.length}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading && (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                  ))}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  Failed to load plugins: {error.message}
                </div>
              )}

              {!isLoading && !error && (
                <ScrollArea className="h-[70vh] pr-3">
                  <div className="space-y-3">
                    {plugins.map((plugin) => {
                      const sourceMeta = getSourceMeta(plugin.source);
                      const isActive = !isCreatingNew && selectedPluginId === plugin.pluginId;

                      return (
                        <button
                          key={plugin.pluginId}
                          type="button"
                          onClick={() => handleSelectPlugin(plugin.pluginId)}
                          className={cn(
                            "w-full rounded-xl border p-4 text-left transition-colors",
                            "hover:border-primary/50 hover:bg-muted/30",
                            isActive
                              ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                              : "border-border/60 bg-muted/10",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate font-display text-sm font-semibold">{plugin.displayName}</p>
                              <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                {plugin.pluginId}
                              </p>
                            </div>
                            <Badge variant="outline" className={cn("gap-1 rounded-full px-2 py-1", sourceMeta.className)}>
                              <sourceMeta.icon className="h-3 w-3" />
                              {sourceMeta.label}
                            </Badge>
                          </div>
                          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{plugin.pluginGroup}</span>
                            <span>{plugin.fields.length} fields</span>
                          </div>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleCreatePlugin}
                      className={cn(
                        "w-full rounded-xl border border-dashed p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5",
                        isCreatingNew ? "border-primary/60 bg-primary/10" : "border-border/60 bg-transparent",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Plus className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-display text-sm font-semibold">New Plugin Draft</p>
                          <p className="text-sm text-muted-foreground">
                            Open a starter YAML template without touching an existing definition.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/95">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">
                      {isCreatingNew ? "New Plugin Draft" : selectedPlugin?.displayName ?? "Plugin Definition"}
                    </CardTitle>
                    {activeSourceMeta && !isCreatingNew && (
                      <Badge variant="outline" className={cn("gap-1 rounded-full px-2 py-1", activeSourceMeta.className)}>
                        <activeSourceMeta.icon className="h-3 w-3" />
                        {activeSourceMeta.label}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {isCreatingNew
                      ? "Start from the baseline YAML schema and adjust metadata, fields, steps, and mappings."
                      : selectedPlugin
                        ? `${selectedPlugin.pluginId} from ${selectedPlugin.pluginGroup}`
                        : "Select a plugin definition from the catalog to inspect it."}
                  </CardDescription>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:w-auto">
                  <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fields</p>
                    <p className="mt-1 font-display text-lg font-semibold">{isCreatingNew ? "Template" : selectedFieldCount}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mode</p>
                    <p className="mt-1 font-display text-lg font-semibold">{isCreatingNew ? "Draft" : "Inspect"}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <Braces className="h-3.5 w-3.5" />
                    YAML Schema
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    The editor loads the raw definition exactly as returned by the backend.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <FileCode2 className="h-3.5 w-3.5" />
                    Drafting
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use the starter template to scaffold new metadata, fields, steps, and mapping blocks.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <Database className="h-3.5 w-3.5" />
                    Sources
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Catalog entries show whether the active definition currently comes from disk or the database.
                  </p>
                </div>
              </div>

              {definitionQuery.isLoading && !isCreatingNew && (
                <div className="flex h-[70vh] items-center justify-center rounded-xl border border-border/60 bg-muted/10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {definitionQuery.error && !isCreatingNew && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  Failed to load plugin YAML: {definitionQuery.error.message}
                </div>
              )}

              {!definitionQuery.isLoading && (!selectedPluginId || editorValue) && (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-[#0b1220] shadow-inner">
                  <Editor
                    height={EDITOR_HEIGHT}
                    defaultLanguage="yaml"
                    language="yaml"
                    theme="vs-dark"
                    value={editorValue}
                    onChange={(value) => setEditorValue(value ?? "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "JetBrains Mono, monospace",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      automaticLayout: true,
                      tabSize: 2,
                      padding: { top: 16, bottom: 16 },
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
