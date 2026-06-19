import { prisma } from "../src/db";

async function main() {
  const email = "pedro.j.augustos@gmail.com";
  console.log(`Checking user: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    return;
  }

  console.log("Current User Status:");
  console.log(`- ID: ${user.id}`);
  console.log(`- Name: ${user.name}`);
  console.log(`- Email Verified: ${user.emailVerified}`);
  console.log(`- Verification Token: ${user.verificationToken}`);
  console.log(`- Token Expiry: ${user.verificationTokenExpiry}`);

  if (user.emailVerified) {
    console.log("User is already verified!");
    return;
  }

  // Generate verification URL
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
  const verificationLink = `${frontendUrl}/verify-email?token=${user.verificationToken}`;
  console.log(`\nVerification Link: ${verificationLink}`);

  console.log("\nUpdating user to verified status...");
  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    },
  });

  console.log(`Successfully verified! emailVerified: ${updatedUser.emailVerified}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
