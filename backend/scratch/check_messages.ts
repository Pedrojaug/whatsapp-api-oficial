import { prisma } from "../src/db";

async function main() {
  console.log("Fetching the 10 most recent messages from the database...");

  const messages = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      account: {
        select: { name: true }
      }
    }
  });

  if (messages.length === 0) {
    console.log("No messages found in the database.");
    return;
  }

  messages.forEach((msg) => {
    console.log(`-----------------------------------------------`);
    console.log(`ID: ${msg.id}`);
    console.log(`Account: ${msg.account.name}`);
    console.log(`Direction: ${msg.direction}`);
    console.log(`To: ${msg.to}`);
    console.log(`Status: ${msg.status}`);
    console.log(`Type: ${msg.messageType}`);
    console.log(`Body: "${msg.body}"`);
    console.log(`Wamid: ${msg.wamid}`);
    console.log(`Error: ${msg.errorMessage}`);
    console.log(`Created At: ${msg.createdAt}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
