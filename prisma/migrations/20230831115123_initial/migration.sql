-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "slave_points" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");
