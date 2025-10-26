-- CreateTable
CREATE TABLE "OtpSession" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "reuestedId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpSession_pkey" PRIMARY KEY ("id")
);
