/*
  Warnings:

  - You are about to drop the column `reuestedId` on the `OtpSession` table. All the data in the column will be lost.
  - Added the required column `requestId` to the `OtpSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OtpSession" DROP COLUMN "reuestedId",
ADD COLUMN     "requestId" TEXT NOT NULL;
