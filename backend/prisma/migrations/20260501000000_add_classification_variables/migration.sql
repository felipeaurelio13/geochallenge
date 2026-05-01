-- Add geographic classification variables to questions
ALTER TABLE "questions" ADD COLUMN "isInsular"      BOOLEAN;
ALTER TABLE "questions" ADD COLUMN "isLandlocked"   BOOLEAN;
ALTER TABLE "questions" ADD COLUMN "subregion"      TEXT;
ALTER TABLE "questions" ADD COLUMN "populationTier" TEXT;
ALTER TABLE "questions" ADD COLUMN "areaTier"       TEXT;
ALTER TABLE "questions" ADD COLUMN "flagComplexity" TEXT;
