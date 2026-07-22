-- ============================================================
-- İl / İlçe / Mahalle referans tabloları + Müşteri Adresi
-- ============================================================

CREATE TABLE IF NOT EXISTS il (
    il_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ilce (
    ilce_id SERIAL PRIMARY KEY,
    il_id INTEGER NOT NULL REFERENCES il(il_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ilce_il_id ON ilce(il_id);

CREATE TABLE IF NOT EXISTS mahalle (
    mahalle_id SERIAL PRIMARY KEY,
    ilce_id INTEGER NOT NULL REFERENCES ilce(ilce_id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mahalle_ilce_id ON mahalle(ilce_id);

CREATE TABLE IF NOT EXISTS customer_address (
    address_id SERIAL PRIMARY KEY,
    cust_id INTEGER NOT NULL REFERENCES cust(cust_id) ON DELETE CASCADE,
    title VARCHAR(50) NOT NULL,
    il_id INTEGER NOT NULL REFERENCES il(il_id),
    ilce_id INTEGER NOT NULL REFERENCES ilce(ilce_id),
    mahalle_id INTEGER NOT NULL REFERENCES mahalle(mahalle_id),
    address_line VARCHAR(500) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_address_cust_id ON customer_address(cust_id);

-- Siparişin hangi adrese teslim edileceği (adres silinirse NULL kalır, sipariş bozulmaz)
ALTER TABLE cust_ord ADD COLUMN IF NOT EXISTS address_id INTEGER REFERENCES customer_address(address_id) ON DELETE SET NULL;
