import { ClassicLevel } from 'classic-level';
import path from 'node:path';

const DATA = path.join(process.env.HOME, 'foundrydata/Data/worlds/alienrpg-dev/data');
const usersDb = new ClassicLevel(path.join(DATA, 'users'), { valueEncoding: 'json' });

// Dump full user records to see the exact structure
for await (const [key, value] of usersDb.iterator()) {
  console.log(`\n=== ${value.name} (key: ${key}) ===`);
  console.log(JSON.stringify(value, null, 2));
}

await usersDb.close();
