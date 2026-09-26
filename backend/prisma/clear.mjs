import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [statusEvents, attachments, requests, requestTypes] = await prisma.$transaction([
    prisma.statusEvent.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.request.deleteMany(),
    prisma.requestType.deleteMany(),
  ]);

  console.log(
    `Cleared ${requests.count} requests, ${requestTypes.count} request types, ` +
      `${statusEvents.count} status events, and ${attachments.count} attachments.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });