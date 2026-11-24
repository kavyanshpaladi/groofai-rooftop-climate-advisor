import { useEffect, useRef, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";

// A button that fires once when pressed and keeps firing while it is held down.
export function RepeatButton({ onRepeat, ...props }: Omit<ComponentProps<typeof Button>, "onClick"> & { onRepeat: () => void }) {
  const fn = useRef(onRepeat);
  fn.current = onRepeat;
  const timers = useRef<{ wait?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});
  const stop = () => { clearTimeout(timers.current.wait); clearInterval(timers.current.tick); };
  useEffect(() => stop, []);
  return (
    <Button
      {...props}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        stop();
        fn.current();
        timers.current.wait = setTimeout(() => { timers.current.tick = setInterval(() => fn.current(), 80); }, 350);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      // Keyboard presses (Enter/Space) arrive as clicks without a pointer.
      onClick={(e) => { if (e.detail === 0) fn.current(); }}
    />
  );
}
