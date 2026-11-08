import { createContext, useContext, type ReactNode } from "react";

// Radix Select does not open in jsdom; this stand-in renders each item as a button that picks it.
const SelectContext = createContext<{ value?: string; onValueChange?: (value: string) => void }>({});

export function Select({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: ReactNode }) {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div data-testid="select" data-value={value}>{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ id, children, ...props }: { id?: string; children?: ReactNode }) {
  return <div id={id} {...props}>{children}</div>;
}

export function SelectValue() {
  const { value } = useContext(SelectContext);
  return <span data-testid="select-value">{value}</span>;
}

export function SelectContent({ children }: { children: ReactNode }) {
  return <div role="listbox">{children}</div>;
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  const { value: selected, onValueChange } = useContext(SelectContext);
  return (
    <button type="button" role="option" aria-selected={selected === value} onClick={() => onValueChange?.(value)}>
      {children}
    </button>
  );
}
