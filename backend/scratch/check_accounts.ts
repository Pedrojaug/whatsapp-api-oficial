import { prisma } from "../src/db";

async function main() {
  const email = "pedro.j.augustos@gmail.com";
  console.log(`Checking accounts for user: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: {
        include: {
          _count: {
            select: { messages: true }
          }
        }
      }
    }
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    return;
  }

  console.log("Accounts found:");
  for (const acc of user.accounts) {
    console.log(`- Account Name: "${acc.name}"`);
    console.log(`  ID: ${acc.id}`);
    console.log(`  Messages count: ${acc._count.messages}`);
    console.log(`  wabaId: ${acc.wabaId}`);
    console.log(`  phoneNumberId: ${acc.phoneNumberId}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
