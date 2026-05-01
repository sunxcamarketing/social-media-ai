-- Billing address fields for invoice generation. DACH/EU standard:
-- recipient + optional company, street, zip, city, country, VAT-ID for B2B
-- reverse-charge, separate billing email if invoices go to accounting.
ALTER TABLE configs
  ADD COLUMN IF NOT EXISTS "billingName"    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingCompany" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingStreet"  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingZip"     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingCity"    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingCountry" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingVatId"   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingEmail"   TEXT DEFAULT '';
