ALTER TABLE "User"
ADD COLUMN "activeRole" "RoleCode";

WITH role_stats AS (
  SELECT
    u.id AS user_id,
    BOOL_OR(ur.role = 'CONSUMER') AS has_consumer,
    BOOL_OR(ur.role = 'MERCHANT') AS has_merchant_role,
    BOOL_OR(ur.role = 'SERVICE_PROVIDER') AS has_service_provider_role,
    BOOL_OR(ur.role = 'FACTORY') AS has_factory_role,
    BOOL_OR(ur.role = 'REPRESENTATIVE') AS has_representative_role,
    BOOL_OR(ur.role = 'CARRIER') AS has_carrier_role,
    (
      CASE WHEN BOOL_OR(ur.role = 'MERCHANT') THEN 1 ELSE 0 END +
      CASE WHEN BOOL_OR(ur.role = 'SERVICE_PROVIDER') THEN 1 ELSE 0 END +
      CASE WHEN BOOL_OR(ur.role = 'FACTORY') THEN 1 ELSE 0 END +
      CASE WHEN BOOL_OR(ur.role = 'REPRESENTATIVE') THEN 1 ELSE 0 END +
      CASE WHEN BOOL_OR(ur.role = 'CARRIER') THEN 1 ELSE 0 END
    ) AS professional_count,
    EXISTS (SELECT 1 FROM "Merchant" m WHERE m."userId" = u.id) AS has_merchant_domain,
    EXISTS (SELECT 1 FROM "ServiceProvider" sp WHERE sp."userId" = u.id) AS has_service_provider_domain,
    EXISTS (SELECT 1 FROM "Factory" f WHERE f."userId" = u.id) AS has_factory_domain,
    EXISTS (SELECT 1 FROM "Representative" r WHERE r."userId" = u.id) AS has_representative_domain
  FROM "User" u
  LEFT JOIN "UserRole" ur ON ur."userId" = u.id
  GROUP BY u.id
)
UPDATE "User" u
SET "activeRole" = CASE
  WHEN rs.professional_count = 1
    AND rs.has_merchant_role
    AND rs.has_merchant_domain
    THEN 'MERCHANT'::"RoleCode"
  WHEN rs.professional_count = 1
    AND rs.has_service_provider_role
    AND rs.has_service_provider_domain
    THEN 'SERVICE_PROVIDER'::"RoleCode"
  WHEN rs.professional_count = 1
    AND rs.has_factory_role
    AND rs.has_factory_domain
    THEN 'FACTORY'::"RoleCode"
  WHEN rs.professional_count = 1
    AND rs.has_representative_role
    AND rs.has_representative_domain
    THEN 'REPRESENTATIVE'::"RoleCode"
  WHEN rs.professional_count = 1
    AND rs.has_carrier_role
    THEN 'CARRIER'::"RoleCode"
  WHEN rs.professional_count = 0
    AND rs.has_consumer
    THEN 'CONSUMER'::"RoleCode"
  ELSE NULL
END
FROM role_stats rs
WHERE rs.user_id = u.id;
