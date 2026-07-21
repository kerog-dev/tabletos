import { type ReactNode, type RefObject, useEffect, useState } from "react";
import styles from "./ContextMenu.module.css";

export function ContextMenu(
  { children, parent, position, open, setOpen }: {
    children: ReactNode;
    parent?: RefObject<HTMLElement | null>;
    position?: [number, number];
    open?: boolean;
    setOpen?: (open: boolean) => void;
  },
) {
  const [parentPos, setParentPos] = useState<[number, number] | null>(null);
  const [x, y] = (parent === undefined
    ? position
    : parentPos) ?? [0, 0];

  useEffect(() => {
    if (!open || !parent || !parent.current) return;
    let canceled = false;

    function tick() {
      if (canceled) return;
      requestAnimationFrame(tick);
      if (!open || !parent || !parent.current) return;
      const { left, top } = parent.current.getBoundingClientRect();

      setParentPos([left + parent.current.offsetWidth, top + parent.current.offsetHeight]);
    }

    requestAnimationFrame(tick);
    return () => {
      canceled = true;
    };
  }, [open]);

  return (
    <div
      className={styles["context-menu"]}
      style={{ top: y + "px", left: x + "px", display: open ? undefined : "none" }}
      onClick={() => setOpen?.(false)}
    >
      {children}
    </div>
  );
}
