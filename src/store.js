const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'db.json');

const initialData = {
  users: [],
  categories: [
    { id: 'vehicles', name: 'Vehicles' },
    { id: 'mobiles', name: 'Mobiles' },
    { id: 'property', name: 'Property' },
    { id: 'electronics', name: 'Electronics' },
    { id: 'furniture', name: 'Furniture' },
    { id: 'jobs', name: 'Jobs' },
    { id: 'services', name: 'Services' }
  ],
  listings: [],
  conversations: []
};

let writeQueue = Promise.resolve();

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(initialData, null, 2));
  }
}

async function readDb() {
  await ensureStore();
  const raw = await fs.readFile(dbPath, 'utf8');
  return JSON.parse(raw);
}

async function writeDb(data) {
  await ensureStore();
  const tmpPath = `${dbPath}.${randomUUID()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.rename(tmpPath, dbPath);
}

function updateDb(mutator) {
  writeQueue = writeQueue.then(async () => {
    const data = await readDb();
    const result = await mutator(data);
    await writeDb(data);
    return result;
  });

  return writeQueue;
}

module.exports = {
  readDb,
  updateDb
};
