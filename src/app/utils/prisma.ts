import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 10000,    // Maximum wait time for a transaction
    timeout: 10000,    // Maximum time to run a transaction
  },
});
export default prisma;

