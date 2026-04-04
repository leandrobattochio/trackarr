import { useEffect, useRef, useState } from "react";

interface UseAnimatedNumberOptions {
  duration?: number;
  decimals?: number;
  initialValue?: number;
  easing?: "easeOutCubic" | "linear";
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function linear(progress: number): number {
  return progress;
}

export function useAnimatedNumber(
  target: number,
  { duration = 1000, decimals = 0, initialValue = 0, easing = "easeOutCubic" }: UseAnimatedNumberOptions = {},
) {
  const [value, setValue] = useState(initialValue);
  const frameRef = useRef<number | null>(null);
  const valueRef = useRef(initialValue);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const startValue = valueRef.current;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easing === "linear" ? linear(progress) : easeOutCubic(progress);
      const nextValue = startValue + (target - startValue) * eased;
      const precision = Math.pow(10, decimals);
      const roundedValue = Math.round(nextValue * precision) / precision;

      valueRef.current = roundedValue;
      setValue(roundedValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        valueRef.current = target;
        setValue(target);
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [decimals, duration, easing, target]);

  return value;
}
