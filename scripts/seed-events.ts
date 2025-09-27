import 'dotenv/config';
import { db } from '../server/db';
import { events } from '../shared/schema';
import { storage } from '../server/storage';

/**
 * Seeds a set of sample events. Ensures at least one admin exists to own them.
 * Usage:
 *   npx tsx scripts/seed-events.ts
 * Or via npm script (add one):
 *   npm run seed:events
 */
async function main() {
  // Find any existing user to assign as creator (prefer an admin)
  // Reusing storage.listUsers (not paginated) or fallback to first user
  let creatorId: number | null = null;
  try {
    const users = await storage.listUsers();
    const admin = users.find(u => u.isAdmin);
    if (admin) creatorId = admin.id; else if (users[0]) creatorId = users[0].id;
  } catch (e) {
    console.error('Could not fetch users; ensure DB reachable.', e);
  }
  if (!creatorId) {
    console.error('No users found. Create an admin first (npm run make:admin -- email=admin@example.com password=Admin123!).');
    process.exit(1);
  }

  const now = Date.now();
  const day = 24*60*60*1000;

  const img = (q: string) => `https://source.unsplash.com/featured/800x600?${encodeURIComponent(q)}`;
  const samples = [
    { title: 'Tech Innovators Summit', description: 'Conference on emerging technologies and innovation.', location: 'New York, NY', offsetDays: 7, tags: ['Technology','Conference'], image: img('technology conference') },
    { title: 'Digital Art Expo', description: 'Showcase of modern digital and NFT artworks.', location: 'San Francisco, CA', offsetDays: 14, tags: ['Arts & Culture'], image: img('digital art gallery') },
    { title: 'Startup Pitch Night', description: 'Founders pitch to VCs and angel investors.', location: 'Austin, TX', offsetDays: 10, tags: ['Business','Networking'], image: img('startup pitch') },
    { title: 'Live Jazz Evening', description: 'An intimate night of contemporary and classic jazz.', location: 'Chicago, IL', offsetDays: 5, tags: ['Music'], image: img('jazz concert') },
    { title: 'Marathon Prep Workshop', description: 'Training and nutrition strategies for runners.', location: 'Boston, MA', offsetDays: 21, tags: ['Sports','Health'], image: img('marathon training') },
    { title: 'Cloud Security Bootcamp', description: 'Deep dive into securing cloud-native architectures.', location: 'Seattle, WA', offsetDays: 18, tags: ['Technology','Security'], image: img('cloud security') },
    { title: 'VR Gaming Showcase', description: 'Experience next-gen VR titles and hardware.', location: 'Los Angeles, CA', offsetDays: 12, tags: ['Technology','Entertainment'], image: img('vr gaming') },
    { title: 'SaaS Growth Masterclass', description: 'Scaling strategies for B2B SaaS founders.', location: 'Remote / Virtual', offsetDays: 9, tags: ['Business','Workshop'], image: img('saas growth') },
  ];

  let created = 0;
  for (const s of samples) {
    const date = new Date(now + s.offsetDays * day);
    // Check if event with same title already exists
    const existing = await db.select().from(events).where((events as any).title.eq ? (events as any).title.eq(s.title) : undefined).catch(()=>[]);
    if (Array.isArray(existing) && existing.length) continue;

    await db.insert(events).values({
      title: s.title,
      description: s.description,
      location: s.location,
      date,
      totalSlots: 100,
      availableSlots: 100,
      image: s.image,
      tags: s.tags as any,
      createdBy: creatorId,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
    created++;
  }

  console.log(`Seed complete. Added ${created} new events (existing titles skipped).`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
