ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_unique
  ON users (stripe_customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_unique
  ON users (stripe_subscription_id);