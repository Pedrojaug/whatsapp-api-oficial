import { prisma } from "../src/db";

async function main() {
  const email = "pedro.j.augustos@gmail.com";
  console.log(`Cleaning up mock data for user: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true }
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    return;
  }

  const mockAccount = user.accounts.find(acc => acc.name === "Conta Meta Teste");

  if (!mockAccount) {
    console.log("No mock account 'Conta Meta Teste' found. Real data is clean!");
    return;
  }

  console.log(`Found mock account: "${mockAccount.name}" (ID: ${mockAccount.id})`);
  
  // Delete mock messages
  const deletedMessages = await prisma.message.deleteMany({
    where: { accountId: mockAccount.id }
  });
  console.log(`Deleted ${deletedMessages.count} mock messages.`);

  // Delete mock account
  await prisma.account.delete({
    where: { id: mockAccount.id }
  });
  console.log("Deleted mock account.");

  console.log("\nCleanup finished! Only your real accounts and data remain.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
