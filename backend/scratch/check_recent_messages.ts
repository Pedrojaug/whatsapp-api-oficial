import { prisma } from "../src/db";

async function main() {
  // Pegar as últimas 20 mensagens de hoje, incluindo status e erros
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const messages = await prisma.message.findMany({
    where: {
      createdAt: { gte: today },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      wamid: true,
      to: true,
      status: true,
      templateName: true,
      direction: true,
      errorMessage: true,
      retryCount: true,
      createdAt: true,
      updatedAt: true,
      body: true,
    },
  });

  console.log(`\n=== Últimas ${messages.length} mensagens de hoje (${today.toLocaleDateString("pt-BR")}) ===\n`);
  
  for (const msg of messages) {
    console.log(`[${msg.status}] ${msg.direction} | ${msg.to} | Template: ${msg.templateName || "texto livre"}`);
    console.log(`  ID: ${msg.id}`);
    console.log(`  Wamid: ${msg.wamid || "(sem wamid — não foi enviado)"}`);
    console.log(`  Body: ${msg.body ? msg.body.substring(0, 80) : "(vazio)"}`);
    if (msg.errorMessage) {
      console.log(`  ⚠️  ERRO: ${msg.errorMessage}`);
    }
    console.log(`  Criado: ${msg.createdAt.toLocaleString("pt-BR")}`);
    console.log(`  Atualizado: ${msg.updatedAt.toLocaleString("pt-BR")}`);
    console.log("---");
  }

  // Verificar templates no banco
  const templates = await prisma.template.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      status: true,
      language: true,
      category: true,
      metaId: true,
      updatedAt: true,
    },
  });

  console.log("\n=== Templates no banco (últimos 10) ===\n");
  for (const t of templates) {
    console.log(`[${t.status}] ${t.name} | ${t.language} | MetaID: ${t.metaId || "(sem ID Meta)"}`);
    console.log(`  Atualizado: ${t.updatedAt.toLocaleString("pt-BR")}`);
    console.log("---");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
