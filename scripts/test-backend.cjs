const fs = require('fs');
const path = require('path');

const baseUrl = 'http://localhost:4000';
const tmpDir = path.join(__dirname, '..', 'tmp');
const imagePath = path.join(tmpDir, 'test-image.png');
const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4BwQACfsD/wOqvFkAAAAASUVORK5CYII=';

if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
if (!fs.existsSync(imagePath)) fs.writeFileSync(imagePath, Buffer.from(imageBase64, 'base64'));

function randPhone() {
  return `9${Math.floor(1e8 + Math.random() * 9e8)}`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${url} failed ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function postJson(url, body, token) {
  return fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
}

async function patchJson(url, body, token) {
  return fetchJson(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
}

async function getJson(url, token) {
  return fetchJson(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
}

async function postForm(url, form, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return fetchJson(url, {
    method: 'POST',
    headers,
    body: form
  });
}

(async () => {
  try {
    const health = await getJson(`${baseUrl}/health`);
    console.log('health', health);

    const phone1 = randPhone();
    const user1 = await postJson(`${baseUrl}/api/auth/register`, { name: 'Test User 1', phone: phone1, password: 'TestPass123!' });
    const user1Login = await postJson(`${baseUrl}/api/auth/login`, { phone: phone1, password: 'TestPass123!' });
    const token1 = user1Login.token;

    const profile1 = await getJson(`${baseUrl}/api/me/profile`, token1);

    const form = new FormData();
    form.append('title', 'Test Listing');
    form.append('description', 'This is a test listing with image upload.');
    form.append('price', '10');
    form.append('categoryId', 'electronics');
    form.append('city', 'Test City');
    form.append('condition', 'new');
    form.append('images', fs.createReadStream(imagePath));

    const listing = await postForm(`${baseUrl}/api/listings`, form, token1);
    const listingId = listing.listing.id;
    const listingGet = await getJson(`${baseUrl}/api/listings/${listingId}`);
    const userListings = await getJson(`${baseUrl}/api/me/listings`, token1);
    const categories = await getJson(`${baseUrl}/api/listings/categories`);
    const search = await getJson(`${baseUrl}/api/listings?q=Test`);

    const phone2 = randPhone();
    const user2 = await postJson(`${baseUrl}/api/auth/register`, { name: 'Test User 2', phone: phone2, password: 'TestPass123!' });
    const user2Login = await postJson(`${baseUrl}/api/auth/login`, { phone: phone2, password: 'TestPass123!' });
    const token2 = user2Login.token;

    const conversation = await postJson(`${baseUrl}/api/conversations`, { listingId }, token2);
    const conversationId = conversation.conversation.id;
    const message = await postJson(`${baseUrl}/api/conversations/${conversationId}/messages`, { body: 'Hello, is this still available?' }, token2);
    const convGet = await getJson(`${baseUrl}/api/conversations/${conversationId}`, token2);

    const savedBefore = await getJson(`${baseUrl}/api/me/saved`, token1);
    const savedStatus = await patchJson(`${baseUrl}/api/me/saved/${listingId}`, { saved: true }, token1);
    const savedAfter = await getJson(`${baseUrl}/api/me/saved`, token1);

    console.log(JSON.stringify({
      health,
      registerOk: !!user1.token,
      loginOk: !!token1,
      profileOk: !!profile1.user,
      listingCreated: !!listing.listing,
      listingId,
      listingGetOk: !!listingGet.listing,
      userListingsCount: userListings.listings.length,
      categoriesCount: categories.categories.length,
      searchCount: search.listings.length,
      conversationId,
      messageOk: !!message.conversation,
      savedBefore: savedBefore.listings.length,
      savedAfter: savedAfter.listings.length
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('TEST_FAILED', error.message);
    process.exit(1);
  }
})();
