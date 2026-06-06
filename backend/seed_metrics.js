const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1. Encontrar o usuário pedro@teste.com
  const user = await prisma.user.findFirst({
    where: { email: "pedro@teste.com" }
  });

  if (!user) {
    console.error("Usuário pedro@teste.com não encontrado. Rode o register primeiro.");
    return;
  }

  // 2. Criar ou atualizar a conta Meta API para Pedro
  const account = await prisma.account.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: "Conta Meta Teste"
      }
    },
    update: {
      wabaId: "123456789012345",
      phoneNumberId: "123456789012345",
      accessToken: "mock_facebook_token"
    },
    create: {
      userId: user.id,
      name: "Conta Meta Teste",
      wabaId: "123456789012345",
      phoneNumberId: "123456789012345",
      accessToken: "mock_facebook_token"
    }
  });

  console.log(`Conta configurada: ${account.name} (ID: ${account.id})`);

  // Limpar mensagens antigas da conta para evitar acúmulo desordenado nos testes
  await prisma.message.deleteMany({
    where: { accountId: account.id }
  });

  // 3. Gerar mensagens mockadas para os últimos 15 dias
  const now = new Date();
  
  // Vamos gerar mensagens para cada dia de (hoje - 14) até hoje
  for (let i = 0; i <= 14; i++) {
    const day = new Date();
    day.setDate(now.getDate() - i);
    
    // Determinar quantidade de mensagens com base no dia para dar um aspecto orgânico e dinâmico
    let sentCount = 0;
    let readCount = 0;
    let failedCount = 0;

    if (i === 0) { // Hoje
      sentCount = 18;
      readCount = 12;
      failedCount = 3;
    } else if (i === 1) { // Ontem
      sentCount = 25;
      readCount = 20;
      failedCount = 2;
    } else if (i <= 7) { // Últimos 7 dias
      sentCount = Math.floor(Math.random() * 15) + 5;
      readCount = Math.floor(Math.random() * sentCount);
      failedCount = Math.floor(Math.random() * 3);
    } else { // Outros dias
      sentCount = Math.floor(Math.random() * 20) + 8;
      readCount = Math.floor(Math.random() * sentCount);
      failedCount = Math.floor(Math.random() * 4);
    }

    // Criar as mensagens bem-sucedidas lidas
    for (let r = 0; r < readCount; r++) {
      const msgTime = new Date(day);
      msgTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
      await prisma.message.create({
        data: {
          accountId: account.id,
          to: `+551199999${String(1000 + r)}`,
          templateName: "boas_vindas",
          status: "READ",
          createdAt: msgTime
        }
      });
    }

    // Criar as mensagens bem-sucedidas entregues/enviadas mas não lidas
    const unread = sentCount - readCount;
    for (let u = 0; u < unread; u++) {
      const msgTime = new Date(day);
      msgTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
      await prisma.message.create({
        data: {
          accountId: account.id,
          to: `+551199999${String(2000 + u)}`,
          templateName: "boas_vindas",
          status: Math.random() > 0.5 ? "DELIVERED" : "SENT",
          createdAt: msgTime
        }
      });
    }

    // Criar falhas
    for (let f = 0; f < failedCount; f++) {
      const msgTime = new Date(day);
      msgTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
      await prisma.message.create({
        data: {
          accountId: account.id,
          to: `+551199999${String(3000 + f)}`,
          templateName: "boas_vindas",
          status: "FAILED",
          createdAt: msgTime
        }
      });
    }

    console.log(`Dia -${i} (${day.toISOString().split('T')[0]}): ${sentCount} enviados (lidos: ${readCount}), ${failedCount} falhas.`);
  }

  console.log("\nBanco de dados mockado com sucesso!");
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
