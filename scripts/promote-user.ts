#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: tsx scripts/promote-user.ts <email>');
    process.exit(1);
  }
  try {
    const result = await db.update(users).set({ isAdmin: true }).where(eq(users.email, email));
    if ((result.rowCount || 0) === 0) {
      console.error('No user found with that email');
      process.exit(2);
    }
    console.log(`User ${email} promoted to admin.`);
    process.exit(0);
  } catch (e) {
    console.error('Failed to promote user:', e);
    process.exit(3);
  }
}

main();
