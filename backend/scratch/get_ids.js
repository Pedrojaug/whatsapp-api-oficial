const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

// Override DATABASE_URL with user's new password
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_BDYbgupJZ7f8@ep-cool-star-acnfeopf-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "minha-chave-secreta-super-segura-do-hub";

async function main() {
  const accounts = await prisma.account.findMany();
  console.log('--- ACCOUNTS ---');
  accounts.forEach(acc => {
    console.log(`ID: ${acc.id} | Name: ${acc.name} | Phone ID: ${acc.phoneNumberId}`);
  });

  const users = await prisma.user.findMany();
  console.log('--- USERS ---');
  users.forEach(user => {
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    console.log(`User ID: ${user.id} | Email: ${user.email} | JWT Token:\nBearer ${token}\n`);
  });
}

main().catch(err => {
  console.error(err);
}).finally(() => {
  prisma.$disconnect();
});
