-- CreateTable
CREATE TABLE "QrTransaction" (
    "id" TEXT NOT NULL,
    "trxn" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "customer" TEXT NOT NULL,
    "network" INTEGER,
    "qrCodeUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrTransaction_trxn_key" ON "QrTransaction"("trxn");
