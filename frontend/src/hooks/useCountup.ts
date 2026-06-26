import { useState, useEffect } from "react";
import { gsap } from "gsap";

export function useCountup(target: number, duration = 1.1): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: target,
      duration,
      ease: "power2.out",
      onUpdate() {
        setValue(Math.round(obj.val));
      },
    });
    return () => { tween.kill(); };
  }, [target, duration]);

  return value;
}
