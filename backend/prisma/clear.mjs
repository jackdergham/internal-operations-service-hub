import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [comments, assignments, statusEvents, attachments, requests, requestTypes] = await prisma.$transaction([
    prisma.fulfillmentComment.deleteMany(),
    prisma.queueAssignment.deleteMany(),
    prisma.statusEvent.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.request.deleteMany(),
    prisma.requestType.deleteMany(),
  ]);

  console.log(
    `Cleared ${requests.count} requests, ${requestTypes.count} request types, ` +
      `${statusEvents.count} status events, ${attachments.count} attachments, ` +
      `${assignments.count} queue assignments, and ${comments.count} comments.`,
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