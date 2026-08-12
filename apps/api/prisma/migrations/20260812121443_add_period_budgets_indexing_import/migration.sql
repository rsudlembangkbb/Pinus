-- AlterEnum
ALTER TYPE "ImportBatchType" ADD VALUE 'INDEXING_SCORE';

-- AlterTable
ALTER TABLE "calculation_periods" ADD COLUMN     "administrativeBudget" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitTeamFixedPortionPercent" DECIMAL(6,3) NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "indexing_scores" ADD COLUMN     "importBatchId" TEXT;

-- AddForeignKey
ALTER TABLE "indexing_scores" ADD CONSTRAINT "indexing_scores_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
