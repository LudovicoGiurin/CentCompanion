-- Admin bootstrap.
--
-- This migration intentionally seeds no account. Create the first admin
-- manually after running the migrations, so no credentials live in source
-- control:
--
--   INSERT INTO "users" (
--     "email", "username", "password_hash", "role",
--     "email_verified", "display_name", "created_at", "updated_at"
--   ) VALUES (
--     'you@example.com', 'your-username', '<bcrypt hash>', 'admin'::"user_role",
--     true, 'Your Name', now(), now()
--   );
--
-- Generate the hash with bcryptjs (cost 12), matching worker/_shared/auth.ts:
--
--   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'your-password'

SELECT 1;
