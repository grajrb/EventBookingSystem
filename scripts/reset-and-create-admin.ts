import 'dotenv/config';
import { db } from '../server/db';
import { users, events, bookings } from '../shared/schema';
async function resetAndCreateAdmin() {
  // Delete all data
  await db.delete(bookings);
  await db.delete(events);
  await db.delete(users);

  // Create new admin user
  const email = 'gauravupadhayay9801@gmail.com';
  const password = 'admin12345'; // Change as needed
  const name = 'Gaurav Upadhayay';
  const hashed = await (await import('../server/services/auth')).hashPassword(password);
  await db.insert(users).values({
    email,
    password: hashed,
    name,
    isAdmin: true,
  });
  console.log('All data dropped and new admin created:', email);
}

resetAndCreateAdmin().then(() => process.exit());
