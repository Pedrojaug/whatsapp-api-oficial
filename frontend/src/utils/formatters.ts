/**
 * Utilitários de formatação e tradução de flags/status para Português (BR)
 * Garante que usuários que não saibam inglês compreendam perfeitamente
 * todas as situações, planos, funções e status do sistema Send Inteligentte.
 */

// Status de Mensagem (WhatsApp Outbox / SSE)
export function formatMessageStatus(status: string): string {
  switch (status?.toUpperCase()) {
    case "PENDING":
      return "Pendente";
    case "SENT":
      return "Enviada";
    case "DELIVERED":
      return "Entregue";
    case "READ":
      return "Lida";
    case "FAILED":
      return "Falhou";
    case "RECEIVED":
      return "Recebida";
    default:
      return status || "-";
  }
}

// Direção da Mensagem
export function formatMessageDirection(direction: string): string {
  switch (direction?.toUpperCase()) {
    case "OUTGOING":
      return "Enviada (Saída)";
    case "INCOMING":
      return "Recebida (Entrada)";
    default:
      return direction || "-";
  }
}

// Planos / Tiers de Assinatura
export function formatPlanTier(tier: string): string {
  switch (tier?.toLowerCase()) {
    case "free":
      return "Gratuito (Teste)";
    case "paid":
      return "Pago (Pro)";
    case "pro":
      return "Plano Pro";
    case "starter":
      return "Plano Inicial";
    case "enterprise":
      return "Empresarial";
    default:
      return tier?.toUpperCase() || "GRATUITO";
  }
}

// Status da Assinatura / Acesso
export function formatSubscriptionStatus(status: string): string {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "Ativo (Em Dia)";
    case "TRIAL":
      return "Em Teste Grátis";
    case "PAST_DUE":
      return "Vencido / Pendente";
    case "CANCELED":
      return "Cancelado";
    case "SUSPENDED":
      return "Suspenso";
    default:
      return status || "-";
  }
}

// Perfis / Roles de Permissão
export function formatRole(role: string): string {
  switch (role?.toUpperCase()) {
    case "SUPERUSER":
      return "Superadministrador";
    case "USER":
      return "Usuário Regular";
    case "ADMIN":
      return "Administrador";
    default:
      return role || "Usuário";
  }
}

// Status de Templates Meta
export function formatTemplateStatus(status: string): string {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return "Aprovado";
    case "PENDING":
      return "Em Análise";
    case "REJECTED":
      return "Rejeitado";
    default:
      return status || "-";
  }
}

// Categorias de Templates Meta
export function formatTemplateCategory(category: string): string {
  switch (category?.toUpperCase()) {
    case "MARKETING":
      return "Marketing";
    case "UTILITY":
      return "Utilidade / Notificação";
    case "AUTHENTICATION":
      return "Autenticação (OTP)";
    default:
      return category || "-";
  }
}

// Status de Campanhas Recorrentes
export function formatCampaignStatus(status: string): string {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "Ativa";
    case "DRAFT":
      return "Rascunho";
    case "COMPLETED":
      return "Concluída";
    case "PAUSED":
      return "Pausada";
    default:
      return status || "-";
  }
}

// Frequência de Agendamento
export function formatScheduleType(type: string): string {
  switch (type?.toUpperCase()) {
    case "ONCE":
      return "Disparo Único";
    case "DAILY":
      return "Diário";
    case "WEEKLY":
      return "Semanal";
    case "MONTHLY":
      return "Mensal";
    default:
      return type || "-";
  }
}
