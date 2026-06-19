import { prisma } from "../src/db";

async function main() {
  const template = await prisma.template.findFirst({
    where: { name: "nosso_primeiro_teste" },
  });

  if (!template) {
    console.log("Template não encontrado!");
    return;
  }

  console.log("\n=== Template: nosso_primeiro_teste ===");
  console.log(`Status: ${template.status}`);
  console.log(`Idioma: ${template.language}`);
  console.log(`Categoria: ${template.category}`);
  console.log(`MetaID: ${template.metaId}`);
  console.log("\nComponentes (JSON completo):");
  console.log(JSON.stringify(template.components, null, 2));

  // Ver todas as mensagens com esse template
  const messages = await prisma.message.findMany({
    where: { templateName: "nosso_primeiro_teste" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      to: true,
      errorMessage: true,
      variables: true,
      wamid: true,
      body: true,
      createdAt: true,
    },
  });

  console.log("\n=== Mensagens com este template ===");
  for (const m of messages) {
    console.log(`\n[${m.status}] Para: ${m.to}`);
    console.log(`  Wamid: ${m.wamid || "(não enviado)"}`);
    console.log(`  Body: ${m.body || "(vazio)"}`);
    console.log(`  Variables JSON: ${JSON.stringify(m.variables)}`);
    if (m.errorMessage) console.log(`  ⚠️  ERRO: ${m.errorMessage}`);
    console.log(`  Criado: ${m.createdAt.toLocaleString("pt-BR")}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
