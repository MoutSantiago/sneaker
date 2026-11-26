CREATE TABLE IF NOT EXISTS brand (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

ALTER TABLE product
  ADD COLUMN brand_id INT;

-- 1. Cargar marcas únicas existentes desde product.brand
INSERT INTO brand (name)
SELECT DISTINCT BTRIM(brand)
FROM product
WHERE brand IS NOT NULL
  AND BTRIM(brand) <> '';

-- 2. Poblar brand_id en cada producto existente
UPDATE product p
SET brand_id = b.id
FROM brand b
WHERE b.name = BTRIM(p.brand)
  AND p.brand IS NOT NULL
  AND BTRIM(p.brand) <> '';

-- 3. Crear la clave foránea hacia brand(id)
ALTER TABLE product
  ADD CONSTRAINT fk_product_brand
  FOREIGN KEY (brand_id) REFERENCES brand(id);

-- 4. Endurecer la columna y eliminar la columna textual antigua
ALTER TABLE product
  ALTER COLUMN brand_id SET NOT NULL;

ALTER TABLE product
  DROP COLUMN brand;