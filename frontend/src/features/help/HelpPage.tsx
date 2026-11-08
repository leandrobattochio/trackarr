import { Fragment } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { WIKI_PAGES } from "@/shared/lib/docs";
import { usePageTitle } from "@/shared/hooks/use-page-title";

const pluginKinds = [
  {
    title: "Official",
    badge: "Official v1.2.0",
    description:
      "Published in the trackarr-plugins repository and downloaded on every start. Only the download changes them.",
  },
  {
    title: "Override",
    badge: "Edited (base v1.1.0)",
    description:
      "Your edited copy of an official plugin. It records the official version it was based on and is never overwritten by the download.",
  },
  {
    title: "Custom",
    badge: "Custom v1.0.0",
    description: "A plugin you created with New Plugin. The download never touches it.",
  },
];

const statusBadges = [
  { badge: "Outdated", description: "Your override is based on an older official version than the one installed." },
  { badge: "Orphan", description: "The official plugin was removed upstream; your override keeps working." },
  { badge: "Deprecated", description: "The official plugin was removed upstream but an integration still uses the cached copy." },
  { badge: "Incompatible", description: "A newer official version needs a newer trackarr; the last compatible version is kept." },
];

export default function HelpPage() {
  usePageTitle("TrackArr | Help");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold">Help</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            What the plugin kinds and badges mean. How to change or write a plugin is in the wiki.
          </p>
        </div>

        <Card className="border-border/50 bg-card/95">
          <CardHeader>
            <CardTitle>Plugins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-muted-foreground">
            <p className="max-w-4xl">
              Every integration runs one plugin. trackarr downloads the official plugins on every start; the result is
              shown in Settings &gt; About, and updated plugins appear in What&apos;s New. When an id has more than one
              plugin, your override wins over a custom plugin, which wins over the official one.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {pluginKinds.map((kind) => (
                <div key={kind.title} className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <h3 className="font-display text-base font-semibold text-foreground">{kind.title}</h3>
                  <span className="inline-block rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-foreground">
                    {kind.badge}
                  </span>
                  <p>{kind.description}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-base font-semibold text-foreground">Status badges</h3>
              <dl className="grid max-w-4xl gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-4">
                {statusBadges.map((status) => (
                  <Fragment key={status.badge}>
                    <dt className="font-medium text-foreground">{status.badge}</dt>
                    <dd>{status.description}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/95">
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2">
              {WIKI_PAGES.map((page) => (
                <li key={page.url}>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-full flex-col gap-1 rounded-2xl border border-border/60 bg-muted/10 p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    <span className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                      {page.title}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-sm text-muted-foreground">{page.description}</span>
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
