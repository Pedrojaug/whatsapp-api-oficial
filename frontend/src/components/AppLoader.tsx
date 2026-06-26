import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

interface AppLoaderProps {
  onComplete: () => void;
}

export default function AppLoader({ onComplete }: AppLoaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const obj = { val: 0 };

    const tween = gsap.to(obj, {
      val: 100,
      duration: 1.5,
      ease: "power1.inOut",
      onUpdate() {
        setCount(Math.floor(obj.val));
      },
      onComplete() {
        // Fade out counter text
        gsap.to(contentRef.current, {
          opacity: 0,
          duration: 0.2,
          onComplete() {
            // Swap to green and slide the whole overlay up
            if (overlayRef.current) {
              overlayRef.current.style.background = "#25d366";
            }
            gsap.to(overlayRef.current, {
              yPercent: -100,
              duration: 0.85,
              ease: "power4.inOut",
              delay: 0.05,
              onComplete,
            });
          },
        });
      },
    });

    return () => tween.kill();
  }, [onComplete]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0d0e11",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        ref={contentRef}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "22px",
        }}
      >
        <img
          src="/logo-mark.png"
          alt="Send Inteligentte"
          style={{ width: 58, height: 58, objectFit: "contain" }}
        />

        <div style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.3)",
          fontFamily: "'Nunito', sans-serif",
        }}>
          Send Inteligentte
        </div>

        <div style={{
          fontSize: "4rem",
          fontWeight: 800,
          fontFamily: "'Nunito', sans-serif",
          color: "#25d366",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          minWidth: "3ch",
          textAlign: "right",
        }}>
          {count}
          <span style={{
            fontSize: "1.6rem",
            fontWeight: 700,
            color: "rgba(37,211,102,0.45)",
            marginLeft: "3px",
          }}>
            %
          </span>
        </div>
      </div>
    </div>
  );
}
