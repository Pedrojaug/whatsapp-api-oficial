"use client";

import { useEffect } from "react";

/** Mesma lista usada no bloco `.js-reveal` de styles.css — mantenha as duas em sincronia. */
const REVEAL_SELECTOR = [
  ".metrics-band",
  ".section-head",
  ".pain-grid > article",
  ".steps-grid > li",
  ".features-grid > article",
  ".comparison-wrap",
  ".testimonials-grid > figure",
  ".pricing-grid > .price-card",
  ".inclusion-panel",
  ".guarantee-card",
  ".faq-list > details",
  ".final-cta-inner",
  ".footer-inner > *",
].join(", ");

/**
 * Camada de movimento progressiva: tudo aqui é enriquecimento.
 * A página funciona inteira sem este componente — ele só liga
 * spotlight, tilt e contagem quando o navegador e o usuário permitem.
 */
export function MotionLayer() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reduced.matches) {
      return;
    }

    const cleanups: (() => void)[] = [];

    /* --- 1. Spotlight seguindo o cursor nos cards --- */
    const spotlightGroups = document.querySelectorAll<HTMLElement>("[data-spotlight]");

    spotlightGroups.forEach((group) => {
      const onMove = (event: PointerEvent) => {
        const cards = group.querySelectorAll<HTMLElement>(":scope > *");

        cards.forEach((card) => {
          const box = card.getBoundingClientRect();
          card.style.setProperty("--mx", `${event.clientX - box.left}px`);
          card.style.setProperty("--my", `${event.clientY - box.top}px`);
        });
      };

      group.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => group.removeEventListener("pointermove", onMove));
    });

    /* --- 2. Tilt 3D no mockup do painel --- */
    const tilt = document.querySelector<HTMLElement>("[data-tilt]");

    if (tilt && window.matchMedia("(hover: hover) and (min-width: 1181px)").matches) {
      let frame = 0;

      const onMove = (event: PointerEvent) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const box = tilt.getBoundingClientRect();
          const px = (event.clientX - box.left) / box.width - 0.5;
          const py = (event.clientY - box.top) / box.height - 0.5;
          tilt.style.setProperty("--rx", `${(-py * 6).toFixed(2)}deg`);
          tilt.style.setProperty("--ry", `${(px * 8).toFixed(2)}deg`);
        });
      };

      const onLeave = () => {
        cancelAnimationFrame(frame);
        tilt.style.setProperty("--rx", "0deg");
        tilt.style.setProperty("--ry", "0deg");
      };

      tilt.addEventListener("pointermove", onMove, { passive: true });
      tilt.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        cancelAnimationFrame(frame);
        tilt.removeEventListener("pointermove", onMove);
        tilt.removeEventListener("pointerleave", onLeave);
      });
    }

    /* --- 3. Contagem dos números quando entram na tela --- */
    const counters = document.querySelectorAll<HTMLElement>("[data-count]");

    if (counters.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            const el = entry.target as HTMLElement;
            observer.unobserve(el);

            const raw = el.dataset.count ?? "";
            const match = raw.match(/[\d.,]+/);

            // Placeholders como "[NÚMERO]" não têm dígito: só revela, sem contar.
            if (!match) {
              return;
            }

            const digits = match[0];
            const target = Number(digits.replace(/\./g, "").replace(",", "."));

            if (!Number.isFinite(target) || target <= 0) {
              return;
            }

            const decimals = digits.includes(",") ? digits.split(",")[1].length : 0;
            const format = (value: number) =>
              value.toLocaleString("pt-BR", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              });

            const duration = 1100;
            const start = performance.now();

            const tick = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              el.textContent = raw.replace(digits, format(target * eased));

              if (progress < 1) {
                requestAnimationFrame(tick);
              } else {
                el.textContent = raw;
              }
            };

            requestAnimationFrame(tick);
          });
        },
        { rootMargin: "0px 0px -15% 0px" },
      );

      counters.forEach((counter) => observer.observe(counter));
      cleanups.push(() => observer.disconnect());
    }

    /* --- 4. Reveal ao rolar ---
       Só habilitamos o estado inicial invisível depois que um quadro é
       efetivamente desenhado. Se o navegador não estiver animando (aba oculta,
       economia de energia, renderizador sem composição), nada é escondido e a
       página aparece completa. */
    const root = document.documentElement;
    const supportsViewTimeline = CSS.supports("animation-timeline", "view()");
    let observer: IntersectionObserver | undefined;

    const frame = requestAnimationFrame(() => {
      if (supportsViewTimeline) {
        root.classList.add("motion-ready");
        return;
      }

      root.classList.add("motion-ready", "js-reveal");

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer?.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
      );

      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((target) => observer?.observe(target));
    });

    cleanups.push(() => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      root.classList.remove("motion-ready", "js-reveal");
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
