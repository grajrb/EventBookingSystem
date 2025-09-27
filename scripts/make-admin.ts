import 'dotenv/config';
import { hashPassword } from '../server/services/auth';
import { storage } from '../server/storage';

/**
 * Usage (Windows cmd examples):
 *   npx tsx scripts/make-admin.ts email=admin@example.com password=StrongPass123 name="Admin User"
 * Any omitted field will use a default.
 */
async function run() {
  // Parse simple key=value args
  const args = process.argv.slice(2).reduce<Record<string,string>>((acc, cur) => {
    const [k, ...rest] = cur.split('=');
    if (k) acc[k] = rest.join('=');
    return acc;
  }, {});

  const email = args.email || 'admin@example.com';
  const password = args.password || 'ChangeMe123!';
  const name = args.name || 'Admin User';

  const existing = await storage.getUserByEmail(email);
  if (existing) {
    const update: any = { isAdmin: true };
    if (args.password) {
      update.password = await hashPassword(password);
    }
    await storage.updateUser(existing.id, update);
    console.log(`[make-admin] Updated existing user '${email}' -> isAdmin=true${args.password ? ' (password reset)' : ''}`);
  } else {
    const hashed = await hashPassword(password);
    const user = await storage.createUser({ email, password: hashed, name, isAdmin: true });
    console.log(`[make-admin] Created new admin '${email}' (id=${user.id})`);
  }
}

run().then(()=>process.exit()).catch(e => { console.error(e); process.exit(1); });
