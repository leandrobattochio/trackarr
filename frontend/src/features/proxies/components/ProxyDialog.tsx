import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveProxy, useTestProxy } from "@/features/proxies/hooks";
import { DEFAULT_PORTS, initialForm, toDto, validateProxyForm, type ProxyForm } from "@/features/proxies/proxy-form";
import {
  PROXY_TYPE_LABELS,
  PROXY_TYPES,
  type ApiProxy,
  type ProxyDto,
  type ProxyTestResult,
  type ProxyType,
} from "@/features/proxies/types";

interface ProxyDialogProps {
  open: boolean;
  proxy: ApiProxy | null;
  onOpenChange: (open: boolean) => void;
}

export function ProxyDialog({ open, proxy, onOpenChange }: ProxyDialogProps) {
  const [form, setForm] = useState<ProxyForm>(() => initialForm(proxy));
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);
  const save = useSaveProxy();
  const test = useTestProxy();

  useEffect(() => {
    if (open) {
      setForm(initialForm(proxy));
      setError(null);
      setTestResult(null);
    }
  }, [open, proxy]);

  function update(changes: Partial<ProxyForm>) {
    setForm((current) => ({ ...current, ...changes }));
    setError(null);
    setTestResult(null);
  }

  function changeType(type: ProxyType) {
    const keepsPort = form.port !== DEFAULT_PORTS[form.type];
    update({ type, port: keepsPort ? form.port : DEFAULT_PORTS[type] });
  }

  function validated(): ProxyDto | null {
    const message = validateProxyForm(form);
    setError(message);
    return message ? null : toDto(form);
  }

  function handleTest() {
    const dto = validated();
    if (!dto) return;

    test.mutate(
      { id: proxy?.id ?? null, dto },
      {
        onSuccess: setTestResult,
        onError: (err) => setError(err.message),
      },
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const dto = validated();
    if (!dto) return;

    save.mutate(
      { id: proxy?.id ?? null, dto },
      {
        onSuccess: (saved) => {
          toast.success(`Proxy ${saved.name} saved`);
          onOpenChange(false);
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  const keepsSavedPassword = Boolean(proxy?.hasPassword) && !form.passwordChanged;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{proxy ? `Edit ${proxy.name}` : "Add proxy"}</DialogTitle>
          <DialogDescription>
            Trackers that use this proxy send their requests through it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          <div className="space-y-2">
            <Label htmlFor="proxy-name">Name</Label>
            <Input id="proxy-name" value={form.name} onChange={(event) => update({ name: event.target.value })} placeholder="Home VPN" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_1fr_6rem]">
            <div className="space-y-2">
              <Label htmlFor="proxy-type">Type</Label>
              <Select value={form.type} onValueChange={(value) => changeType(value as ProxyType)}>
                <SelectTrigger id="proxy-type" data-testid="proxy-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROXY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PROXY_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-host">Host</Label>
              <Input id="proxy-host" value={form.host} onChange={(event) => update({ host: event.target.value })} placeholder="10.0.0.2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-port">Port</Label>
              <Input id="proxy-port" inputMode="numeric" value={form.port} onChange={(event) => update({ port: event.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="proxy-username">Username (optional)</Label>
              <Input
                id="proxy-username"
                autoComplete="off"
                value={form.username}
                onChange={(event) => update({ username: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-password">Password (optional)</Label>
              <Input
                id="proxy-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                placeholder={keepsSavedPassword ? "Saved password unchanged" : undefined}
                disabled={!form.username.trim()}
                onChange={(event) => update({ password: event.target.value, passwordChanged: true })}
              />
            </div>
          </div>

          {form.type === "socks4" && (
            <p className="text-xs text-muted-foreground">
              SOCKS4 resolves the tracker's host name on this machine. Use SOCKS5 when only the proxy can resolve it.
            </p>
          )}

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          {testResult && (
            <div
              data-testid="proxy-test-result"
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                testResult.success ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
              }`}
            >
              {testResult.success
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
              <p className="min-w-0 break-words">
                {testResult.success
                  ? `Connected: ${testResult.testUrl} answered HTTP ${testResult.statusCode} through the proxy.`
                  : `Could not reach ${testResult.testUrl} through the proxy. ${testResult.error ?? ""}`}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleTest} disabled={test.isPending || save.isPending}>
              {test.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
              Test
            </Button>
            <Button type="submit" className="flex-1" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save proxy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
