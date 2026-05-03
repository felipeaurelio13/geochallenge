-- Add MONUMENT to the Category enum.
-- Postgres requires ALTER TYPE ... ADD VALUE; values cannot be reordered safely,
-- so MONUMENT is appended at the end. Application code does not depend on enum order.
ALTER TYPE "Category" ADD VALUE 'MONUMENT';
