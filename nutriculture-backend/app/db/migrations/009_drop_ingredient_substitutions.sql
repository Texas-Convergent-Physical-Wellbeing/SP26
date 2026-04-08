-- Remove ingredient substitution cache (ingredients store/substitute API removed).
-- DROP is safe when the table never existed (e.g. fresh install without the old 009 create).

DROP TABLE IF EXISTS ingredient_substitutions;
