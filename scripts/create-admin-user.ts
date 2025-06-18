import { hashPassword } from '../server/services/auth';
import { storage } from '../server/storage';

async function createAdminUser() {
  const email = 'shyamsingg19@gmail.com';
  const password = 'admin12345'; // Set your desired password here
  const name = 'Shyam Singh';

  // Check if user already exists
  const existing = await storage.getUserByEmail(email);
  if (existing) {
    // Update to admin if not already
    if (!existing.isAdmin) {
      await storage.updateUser(existing.id, { isAdmin: true });
      console.log('User promoted to admin.');
    } else {
      console.log('User already exists and is admin.');
    }
    return;
  }

  // Create new admin user
  const hashed = await hashPassword(password);
  await storage.createUser({
    email,
    password: hashed,
    name,
    isAdmin: true,
  });
  console.log('Admin user created.');
}

createAdminUser().then(() => process.exit());
