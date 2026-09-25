export default function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "360px",
        height: "100%",
        width: "100%",
        gap: "14px",
        padding: "40px 20px"
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          border: "2.5px solid rgba(0, 194, 107, 0.15)",
          borderTopColor: "var(--primary, #00c26b)",
          animation: "spin 0.7s linear infinite"
        }}
      />
      <span
        style={{
          fontSize: "0.8rem",
          color: "var(--text-muted, #94a3b8)",
          fontWeight: 500,
          letterSpacing: "0.2px"
        }}
      >
        Carregando tela...
      </span>
    </div>
  );
}
