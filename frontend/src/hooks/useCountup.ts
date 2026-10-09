import { useState, useEffect, useRef } from "react";
import { gsap } from "gsap";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Anima um número até `target`. Parte do valor exibido no momento (não volta a zero a cada
 * atualização em tempo real) e mostra o valor final direto para quem pediu menos movimento.
 */
export function useCountup(target: number, duration = 1.1): number {
  const reduceMotion = prefersReducedMotion();
  const [value, setValue] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    const obj = { val: currentRef.current };
    const tween = gsap.to(obj, {
      val: target,
      duration,
      ease: "power2.out",
      onUpdate() {
        currentRef.current = obj.val;
        setValue(Math.round(obj.val));
      },
    });
    return () => { tween.kill(); };
  }, [target, duration, reduceMotion]);

  return reduceMotion ? target : value;
}
