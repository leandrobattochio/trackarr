import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProxies } from "@/features/proxies/hooks";

// Radix Select cannot hold an empty value, so "no proxy" needs a value of its own.
const NO_PROXY = "none";

interface ProxySelectProps {
  value: string | null;
  onChange: (proxyId: string | null) => void;
}

export function ProxySelect({ value, onChange }: ProxySelectProps) {
  const { data: proxies = [] } = useProxies();

  return (
    <div className="space-y-2">
      <Label htmlFor="integration-proxy">Proxy</Label>
      <Select value={value ?? NO_PROXY} onValueChange={(next) => onChange(next === NO_PROXY ? null : next)}>
        <SelectTrigger id="integration-proxy" data-testid="integration-proxy-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROXY}>No proxy</SelectItem>
          {proxies.map((proxy) => (
            <SelectItem key={proxy.id} value={proxy.id}>
              {proxy.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Syncs and plugin tests of this tracker go through the proxy. Proxies are managed in Settings &gt; Proxies.
      </p>
    </div>
  );
}
