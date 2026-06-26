import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "API Oficial da Meta",
    description:
      "Integração direta com a Business API. Zero risco de ban, 100% dentro das políticas da plataforma.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Campanhas Automáticas",
    description:
      "Agende disparos únicos ou configure sequências recorrentes diárias, semanais e mensais. Sem esforço manual.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: "Analytics em Tempo Real",
    description:
      "Entrega, leitura e falhas por mensagem. Tome decisões baseadas em dados concretos, não em suposições.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
    title: "LGPD por Padrão",
    description:
      "Opt-out automático integrado em cada disparo. Conformidade embutida — sem configuração extra, sem risco.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Conecte seu número",
    description:
      "Link seu WhatsApp Business via Meta API. O processo leva menos de 5 minutos com nosso guia interativo.",
  },
  {
    number: "02",
    title: "Monte suas campanhas",
    description:
      "Crie templates aprovados pela Meta, organize listas de contatos e configure automações recorrentes.",
  },
  {
    number: "03",
    title: "Monitore em tempo real",
    description:
      "Acompanhe cada mensagem — entregue, lida ou com falha — e otimize suas campanhas com dados reais.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero words reveal
      gsap.from(".lp-hero-word", {
        opacity: 0,
        y: 64,
        duration: 0.82,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.25,
      });

      gsap.from(".lp-hero-badge", {
        opacity: 0,
        scale: 0.9,
        duration: 0.55,
        ease: "power3.out",
        delay: 0.1,
      });

      gsap.from([".lp-hero-sub", ".lp-hero-actions"], {
        opacity: 0,
        y: 28,
        duration: 0.7,
        stagger: 0.14,
        ease: "power3.out",
        delay: 0.95,
      });

      // Orb float animations
      gsap.to(".lp-orb-1", {
        x: 35,
        y: -28,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".lp-orb-2", {
        x: -28,
        y: 34,
        duration: 10,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 2.5,
      });
      gsap.to(".lp-orb-3", {
        x: 18,
        y: 22,
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 5,
      });

      // Features section
      gsap.from(".lp-features-title", {
        scrollTrigger: { trigger: ".lp-features", start: "top 78%" },
        opacity: 0,
        y: 36,
        duration: 0.7,
        ease: "power3.out",
      });
      gsap.from(".lp-feature-card", {
        scrollTrigger: { trigger: ".lp-features", start: "top 68%" },
        opacity: 0,
        y: 48,
        scale: 0.95,
        duration: 0.65,
        stagger: 0.1,
        ease: "power3.out",
      });

      // Steps
      gsap.from(".lp-steps-title", {
        scrollTrigger: { trigger: ".lp-steps", start: "top 78%" },
        opacity: 0,
        y: 36,
        duration: 0.7,
        ease: "power3.out",
      });
      gsap.from(".lp-step-item", {
        scrollTrigger: { trigger: ".lp-steps", start: "top 70%" },
        opacity: 0,
        x: -44,
        duration: 0.72,
        stagger: 0.14,
        ease: "power3.out",
      });

      // CTA
      gsap.from(".lp-cta-inner", {
        scrollTrigger: { trigger: ".lp-cta", start: "top 78%" },
        opacity: 0,
        y: 44,
        scale: 0.97,
        duration: 0.8,
        ease: "power3.out",
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        background: "#080808",
        color: "#fff",
        fontFamily: "'Nunito', sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* ── Navbar ── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "16px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(8,8,8,0.75)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/logo.png"
            alt="Send Inteligentte"
            style={{ height: "30px", objectFit: "contain" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.35)",
              cursor: "default",
              letterSpacing: "0.01em",
            }}
          >
            Send Inteligentte
          </span>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "9px 22px",
              background: "linear-gradient(135deg, #25d366, #128c5f)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.875rem",
              fontFamily: "'Nunito', sans-serif",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(37,211,102,0.3)",
              letterSpacing: "0.01em",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 6px 24px rgba(37,211,102,0.5)";
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 4px 16px rgba(37,211,102,0.3)";
              (e.currentTarget as HTMLButtonElement).style.transform = "";
            }}
          >
            Entrar →
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "140px 48px 100px",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        {/* Dot grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            pointerEvents: "none",
            maskImage:
              "radial-gradient(ellipse 90% 85% at 50% 40%, black 20%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 85% at 50% 40%, black 20%, transparent 100%)",
          }}
        />

        {/* Ambient orbs */}
        <div
          className="lp-orb-1"
          style={{
            position: "absolute",
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(37,211,102,0.11) 0%, transparent 72%)",
            top: "5%",
            left: "8%",
            pointerEvents: "none",
          }}
        />
        <div
          className="lp-orb-2"
          style={{
            position: "absolute",
            width: "380px",
            height: "380px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,194,107,0.07) 0%, transparent 70%)",
            bottom: "12%",
            right: "6%",
            pointerEvents: "none",
          }}
        />
        <div
          className="lp-orb-3"
          style={{
            position: "absolute",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)",
            top: "30%",
            right: "20%",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, maxWidth: "860px" }}>
          {/* Eyebrow badge */}
          <div
            className="lp-hero-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              borderRadius: "100px",
              border: "1px solid rgba(37,211,102,0.22)",
              background: "rgba(37,211,102,0.06)",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#25d366",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              marginBottom: "36px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#25d366",
                boxShadow: "0 0 8px #25d366",
                flexShrink: 0,
                animation: "lp-pulse 2s ease-in-out infinite",
              }}
            />
            API Oficial da Meta · 100% Seguro
          </div>

          {/* Headline line 1 */}
          <h1
            style={{
              fontSize: "clamp(2.8rem, 7vw, 5.4rem)",
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
              marginBottom: "6px",
              overflow: "hidden",
            }}
          >
            {"Dispare com inteligência.".split(" ").map((word, i) => (
              <span
                key={i}
                className="lp-hero-word"
                style={{ display: "inline-block", marginRight: "0.22em" }}
              >
                {word}
              </span>
            ))}
          </h1>

          {/* Headline line 2 */}
          <h1
            style={{
              fontSize: "clamp(2.8rem, 7vw, 5.4rem)",
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
              marginBottom: "36px",
              overflow: "hidden",
            }}
          >
            {"Escale com segurança.".split(" ").map((word, i) => (
              <span
                key={i}
                className="lp-hero-word"
                style={{
                  display: "inline-block",
                  marginRight: "0.22em",
                  color:
                    i === 0
                      ? "#25d366"
                      : "rgba(255,255,255,0.28)",
                }}
              >
                {word}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p
            className="lp-hero-sub"
            style={{
              fontSize: "clamp(1rem, 2vw, 1.18rem)",
              color: "rgba(255,255,255,0.42)",
              lineHeight: 1.72,
              maxWidth: "560px",
              margin: "0 auto 48px",
            }}
          >
            WhatsApp Business em escala. Campanhas automáticas, analytics em
            tempo real e conformidade LGPD — tudo em um painel limpo.
          </p>

          {/* CTAs */}
          <div
            className="lp-hero-actions"
            style={{
              display: "flex",
              gap: "14px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => navigate("/")}
              style={{
                padding: "15px 38px",
                background: "linear-gradient(135deg, #25d366, #128c5f)",
                border: "none",
                borderRadius: "10px",
                color: "#fff",
                fontWeight: 800,
                fontSize: "1rem",
                fontFamily: "'Nunito', sans-serif",
                cursor: "pointer",
                boxShadow: "0 6px 28px rgba(37,211,102,0.38)",
                letterSpacing: "0.015em",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(-2px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 10px 38px rgba(37,211,102,0.55)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 6px 28px rgba(37,211,102,0.38)";
              }}
            >
              Começar Agora — Grátis
            </button>
            <a
              href="#features"
              style={{
                padding: "15px 38px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "10px",
                color: "rgba(255,255,255,0.6)",
                fontWeight: 600,
                fontSize: "1rem",
                fontFamily: "'Nunito', sans-serif",
                cursor: "pointer",
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "all 0.2s ease",
                display: "inline-block",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background =
                  "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
                (e.currentTarget as HTMLAnchorElement).style.borderColor =
                  "rgba(255,255,255,0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background =
                  "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLAnchorElement).style.color =
                  "rgba(255,255,255,0.6)";
                (e.currentTarget as HTMLAnchorElement).style.borderColor =
                  "rgba(255,255,255,0.09)";
              }}
            >
              Ver como funciona ↓
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: "absolute",
            bottom: "44px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: 0.28,
            gap: "0",
          }}
        >
          <div
            style={{
              width: "1px",
              height: "52px",
              background:
                "linear-gradient(to bottom, transparent, rgba(255,255,255,0.7))",
              animation: "lp-scroll-drip 1.8s ease-in-out infinite",
            }}
          />
        </div>
      </section>

      {/* ── Features ── */}
      <section
        id="features"
        className="lp-features"
        style={{
          padding: "110px 48px",
          maxWidth: "1160px",
          margin: "0 auto",
        }}
      >
        <div
          className="lp-features-title"
          style={{ textAlign: "center", marginBottom: "64px" }}
        >
          <div
            style={{
              display: "inline-block",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.13em",
              textTransform: "uppercase",
              color: "#25d366",
              marginBottom: "14px",
            }}
          >
            Por que o Send Inteligentte?
          </div>
          <h2
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.18,
            }}
          >
            Tudo que você precisa,{" "}
            <span style={{ color: "rgba(255,255,255,0.28)" }}>
              num só lugar.
            </span>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "18px",
          }}
        >
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="lp-feature-card"
              style={{
                padding: "34px 30px",
                borderRadius: "16px",
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                transition: "all 0.3s ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(255,255,255,0.055)";
                (e.currentTarget as HTMLDivElement).style.borderColor =
                  "rgba(37,211,102,0.2)";
                (e.currentTarget as HTMLDivElement).style.transform =
                  "translateY(-5px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  "0 16px 40px rgba(0,0,0,0.35)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(255,255,255,0.025)";
                (e.currentTarget as HTMLDivElement).style.borderColor =
                  "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLDivElement).style.transform = "";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(37,211,102,0.08)",
                  border: "1px solid rgba(37,211,102,0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                {f.icon}
              </div>
              <h3
                style={{
                  fontSize: "1.06rem",
                  fontWeight: 700,
                  marginBottom: "10px",
                  color: "#fff",
                  letterSpacing: "-0.01em",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "rgba(255,255,255,0.4)",
                  lineHeight: 1.68,
                }}
              >
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        className="lp-steps"
        style={{
          padding: "110px 48px",
          background: "rgba(255,255,255,0.013)",
          borderTop: "1px solid rgba(255,255,255,0.055)",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
        }}
      >
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div
            className="lp-steps-title"
            style={{ marginBottom: "64px" }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                color: "#25d366",
                marginBottom: "14px",
              }}
            >
              Como Funciona
            </div>
            <h2
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                lineHeight: 1.18,
              }}
            >
              3 passos para{" "}
              <span style={{ color: "rgba(255,255,255,0.28)" }}>
                começar a escalar.
              </span>
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="lp-step-item"
                style={{
                  display: "flex",
                  gap: "28px",
                  alignItems: "flex-start",
                }}
              >
                {/* Number + connector */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: "54px",
                      height: "54px",
                      borderRadius: "50%",
                      background: "rgba(37,211,102,0.07)",
                      border: "1px solid rgba(37,211,102,0.22)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      color: "#25d366",
                      letterSpacing: "0.04em",
                      flexShrink: 0,
                    }}
                  >
                    {step.number}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      style={{
                        width: "1px",
                        height: "58px",
                        background:
                          "linear-gradient(to bottom, rgba(37,211,102,0.22), transparent)",
                        margin: "8px 0",
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div
                  style={{
                    paddingBottom: i < STEPS.length - 1 ? "28px" : "0",
                    paddingTop: "12px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.12rem",
                      fontWeight: 700,
                      marginBottom: "8px",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "0.92rem",
                      color: "rgba(255,255,255,0.38)",
                      lineHeight: 1.68,
                    }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="lp-cta"
        style={{
          padding: "130px 48px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            width: "700px",
            height: "350px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(37,211,102,0.07) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        />
        {/* Dot grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            pointerEvents: "none",
            maskImage:
              "radial-gradient(ellipse 70% 70% at 50% 50%, black 10%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 70% at 50% 50%, black 10%, transparent 100%)",
          }}
        />

        <div className="lp-cta-inner" style={{ position: "relative", zIndex: 1 }}>
          <h2
            style={{
              fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: "18px",
              lineHeight: 1.08,
            }}
          >
            Pronto para escalar<br />
            <span style={{ color: "#25d366" }}>seu WhatsApp?</span>
          </h2>
          <p
            style={{
              fontSize: "1rem",
              color: "rgba(255,255,255,0.38)",
              marginBottom: "44px",
              maxWidth: "380px",
              margin: "0 auto 44px",
              lineHeight: 1.65,
            }}
          >
            Comece gratuitamente. Sem cartão de crédito. Cancele a qualquer
            momento.
          </p>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "17px 52px",
              background: "linear-gradient(135deg, #25d366, #128c5f)",
              border: "none",
              borderRadius: "12px",
              color: "#fff",
              fontWeight: 800,
              fontSize: "1.08rem",
              fontFamily: "'Nunito', sans-serif",
              cursor: "pointer",
              boxShadow: "0 8px 40px rgba(37,211,102,0.42)",
              letterSpacing: "0.01em",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-3px) scale(1.025)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 14px 52px rgba(37,211,102,0.6)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 8px 40px rgba(37,211,102,0.42)";
            }}
          >
            Começar Agora — É Grátis →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: "28px 48px",
          borderTop: "1px solid rgba(255,255,255,0.055)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src="/logo-mark.png"
            alt=""
            style={{ height: "22px", objectFit: "contain" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span
            style={{
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            © 2025 Inteligentte Lab. Todos os direitos reservados.
          </span>
        </div>
        <div
          style={{
            fontSize: "0.78rem",
            color: "rgba(255,255,255,0.18)",
            letterSpacing: "0.04em",
          }}
        >
          Powered by Meta Business API
        </div>
      </footer>

      <style>{`
        @keyframes lp-scroll-drip {
          0%   { opacity: 0; transform: scaleY(0); transform-origin: top; }
          45%  { opacity: 1; transform: scaleY(1); transform-origin: top; }
          55%  { opacity: 1; transform: scaleY(1); transform-origin: bottom; }
          100% { opacity: 0; transform: scaleY(0); transform-origin: bottom; }
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #25d366; }
          50%       { opacity: 0.5; box-shadow: 0 0 14px #25d366; }
        }
        @media (max-width: 640px) {
          .lp-features, .lp-steps, .lp-cta {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}
