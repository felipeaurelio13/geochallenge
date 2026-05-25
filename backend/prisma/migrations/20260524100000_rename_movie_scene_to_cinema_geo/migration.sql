-- Rename Category enum value MOVIE_SCENE → CINEMA_GEO.
-- Postgres rewrites existing rows transparently: any Question.category = 'MOVIE_SCENE'
-- becomes 'CINEMA_GEO'. No data loss.
ALTER TYPE "Category" RENAME VALUE 'MOVIE_SCENE' TO 'CINEMA_GEO';
