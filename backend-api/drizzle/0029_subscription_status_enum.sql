DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'grace_period', 'suspended', 'cancelled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE tenant_subscription
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE subscription_status USING status::subscription_status,
  ALTER COLUMN status SET DEFAULT 'trial';
