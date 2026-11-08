export function readLocalStorage<T>(key: string, parse: (value: unknown) => T | undefined): T | undefined {
  /* c8 ignore next 2 */
  if (typeof window === "undefined")
    return undefined;

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue === null ? undefined : parse(JSON.parse(rawValue));
  } catch {
    return undefined;
  }
}

export function writeLocalStorage(key: string, value: unknown) {
  /* c8 ignore next 2 */
  if (typeof window === "undefined")
    return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to persist ${key} to localStorage.`, error);
  }
}
