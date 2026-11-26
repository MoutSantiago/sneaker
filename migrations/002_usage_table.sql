CREATE TABLE IF NOT EXISTS usage (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS product_use (
  usage_id INT NOT NULL REFERENCES usage(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  PRIMARY KEY (usage_id, product_id)
);

-- 1. Cargar valores únicos existentes en la nueva tabla usage
INSERT INTO usage (name)
SELECT DISTINCT TRIM(usage)
FROM product
WHERE usage IS NOT NULL
  AND BTRIM(usage) <> '';

-- 2. Vincular productos existentes con su usage correspondiente en product_use
INSERT INTO product_use (usage_id, product_id)
SELECT DISTINCT u.id, p.id
FROM product p
JOIN usage u
  ON u.name = TRIM(p.usage)
WHERE p.usage IS NOT NULL
  AND BTRIM(p.usage) <> ''
ON CONFLICT (usage_id, product_id) DO NOTHING;

-- 3. Eliminar la columna antigua una vez migrados los datos
ALTER TABLE product
  DROP COLUMN usage;