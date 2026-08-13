-- AlterTable
ALTER TABLE "Server" ADD COLUMN "prcKeyInvalid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Server" ADD COLUMN "prcKeyInvalidAt" TIMESTAMP(3);
