import { useEffect, useRef } from 'react';
import type { HTMLAttributes } from 'react';

/**
 * A screen's scrolling area. It takes focus when it appears, so the arrow keys, Space, Page Up/Down, Home and End scroll it at once
 * (a browser scrolls the focused area; without this only Tab, which scrolls whatever it focuses, moved the page).
 */
export function ScrollMain(props: HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return <main ref={ref} tabIndex={-1} {...props} />;
}
