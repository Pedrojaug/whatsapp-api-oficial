import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface AppLoaderProps {
  onComplete: () => void;
}

export default function AppLoader({ onComplete }: AppLoaderProps) {
  const overlayRef  = useRef<HTMLDivElement>(null);
  const logoRef     = useRef<HTMLDivElement>(null);
  const textWrapRef = useRef<HTMLDivElement>(null);
  const brightRef   = useRef<HTMLDivElement>(null);
  const brushRef    = useRef<HTMLDivElement>(null);
  const taglineRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Measure rendered text width so the brush travels the exact right distance
    const w = textWrapRef.current?.offsetWidth ?? 380;

    // Block starts just off the left edge of the text (hidden before "S")
    gsap.set(brushRef.current, { x: -48 });
    // Bright text fully clipped (invisible)
    gsap.set(brightRef.current, { clipPath: "inset(0 100% 0 0)" });

    const tl = gsap.timeline();

    // 1. Logo fades in
    tl.to(logoRef.current, {
      opacity: 1,
      duration: 0.42,
      ease: "power2.out",
    });

    // 2. Dim brand text appears
    tl.to(textWrapRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
    }, "-=0.1");

    // 3. Brief pause — build anticipation
    tl.to({}, { duration: 0.24 });

    // 4a. Block sweeps left → right, exits just past the last letter
    tl.to(brushRef.current, {
      x: w + 6,
      duration: 0.72,
      ease: "power2.inOut",
    });
    // 4b. Bright text reveals in sync with the brush
    tl.to(brightRef.current, {
      clipPath: "inset(0 0% 0 0)",
      duration: 0.72,
      ease: "power2.inOut",
    }, "<");

    // 5. Tagline fades in as stroke finishes
    tl.to(taglineRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
    }, "-=0.2");

    // 6. Hold — let the brand breathe
    tl.to({}, { duration: 0.42 });

    // 7. Fade out content before green (prevents "Send" vanishing into same-color bg)
    tl.to([logoRef.current, textWrapRef.current, taglineRef.current], {
      opacity: 0,
      duration: 0.18,
      ease: "power2.in",
    });

    // 8. Snap background to green, then slide the whole overlay up
    tl.call(() => {
      if (overlayRef.current) overlayRef.current.style.background = "#25d366";
    });
    tl.to(overlayRef.current, {
      yPercent: -100,
      duration: 0.85,
      ease: "power4.inOut",
      delay: 0.05,
      onComplete,
    });

    return () => { tl.kill(); };
  }, [onComplete]);

  const textStyle: React.CSSProperties = {
    fontSize: "clamp(2rem, 5vw, 3.2rem)",
    fontWeight: 800,
    fontFamily: "'Nunito', sans-serif",
    letterSpacing: "-0.025em",
    whiteSpace: "nowrap",
    lineHeight: 1,
  };

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#080808",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "22px",
        }}
      >
        {/* Logo mark */}
        <div ref={logoRef} style={{ opacity: 0 }}>
          <img
            src="/logo-mark.png"
            alt="Send Inteligentte"
            style={{ width: 54, height: 54, objectFit: "contain" }}
          />
        </div>

        {/* Brand name with paint-stroke reveal */}
        <div
          ref={textWrapRef}
          style={{ position: "relative", opacity: 0, display: "inline-block" }}
        >
          {/* Dim base layer — always visible, very faint */}
          <div style={textStyle}>
            <span style={{ color: "rgba(37,211,102,0.2)" }}>Send</span>
            <span style={{ color: "rgba(255,255,255,0.15)" }}> Inteligentte</span>
          </div>

          {/* Bright revealed layer — shown where brush has passed */}
          <div
            ref={brightRef}
            style={{
              ...textStyle,
              position: "absolute",
              inset: 0,
              clipPath: "inset(0 100% 0 0)",
            }}
          >
            <span style={{ color: "#25d366" }}>Send</span>
            <span style={{ color: "#fff" }}> Inteligentte</span>
          </div>

          {/* Block cursor — solid square sweeps left→right, same height as text */}
          <div
            ref={brushRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "44px",
              height: "100%",
              pointerEvents: "none",
              background: "#25d366",
            }}
          />
        </div>

        {/* Tagline */}
        <div
          ref={taglineRef}
          style={{
            opacity: 0,
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.2)",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          por Inteligentte Lab
        </div>
      </div>
    </div>
  );
}
