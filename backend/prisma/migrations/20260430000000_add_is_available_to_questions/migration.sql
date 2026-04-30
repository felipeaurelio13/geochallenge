-- Add isAvailable flag to questions
-- Defaults to true for all existing questions.
-- Set to false by the validate-and-fix-images script for questions whose
-- image URLs are unreachable on both primary and fallback CDN.
ALTER TABLE "questions" ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;
