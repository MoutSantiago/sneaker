CREATE TYPE product_type AS ENUM (
  'SHOELACE',
  'SHOE',
  'INSOLE',
  'SOCK'
);

CREATE TABLE IF NOT EXISTS product (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model VARCHAR(50) NOT NULL,
  description TEXT,
  brand VARCHAR(50) NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  type product_type NOT NULL,
  usage VARCHAR(30),
  material VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS product_variant (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id INT NOT NULL,
  size NUMERIC(4, 1) NOT NULL CHECK (size > 0),
  color VARCHAR(30) NOT NULL,
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  priority INT NOT NULL DEFAULT 0 CHECK (stock >= 0),

  CONSTRAINT fk_product_variant_product
    FOREIGN KEY (product_id)
    REFERENCES product(id)
    ON DELETE CASCADE,

  CONSTRAINT uq_product_variant
    UNIQUE (product_id, size, color)
);
