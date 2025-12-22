-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL,
    "audioAssetUrl" TEXT,
    "audioTriggerTime" DOUBLE PRECISION,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timestampSec" DOUBLE PRECISION NOT NULL,
    "prompt" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "methodModelFramework" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "scientificReferenceFields" TEXT[],
    "sortOrder" INTEGER NOT NULL,
    "phaseId" TEXT NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScienceItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timestampsSec" DOUBLE PRECISION[],
    "sortOrder" INTEGER NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "ScienceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "authorName" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Phase_lessonId_idx" ON "Phase"("lessonId");

-- CreateIndex
CREATE INDEX "Intervention_phaseId_idx" ON "Intervention"("phaseId");

-- CreateIndex
CREATE INDEX "ScienceItem_lessonId_idx" ON "ScienceItem"("lessonId");

-- CreateIndex
CREATE INDEX "Comment_lessonId_idx" ON "Comment"("lessonId");

-- CreateIndex
CREATE INDEX "Comment_timestamp_idx" ON "Comment"("timestamp");

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScienceItem" ADD CONSTRAINT "ScienceItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
