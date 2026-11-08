import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { readLocalStorage, writeLocalStorage } from "@/shared/lib/local-storage";

export function usePersistedState<T>(
  key: string,
  fallback: T,
  parse: (value: unknown) => T | undefined,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readLocalStorage(key, parse) ?? fallback);

  useEffect(() => {
    writeLocalStorage(key, value);
  }, [key, value]);

  return [value, setValue];
}
