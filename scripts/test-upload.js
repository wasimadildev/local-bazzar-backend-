const fs = require('fs');
const path = require('path');
const fetch = require('node:fetch');
const FormData = require('node:formdata');

(async () => {
  try {
    const backendUrl = 'http://localhost:4000';
    const tmpDir = path.join(__dirname, '..', 'tmp');
    const imagePath = path.join(tmpDir, 'test-upload.png');
    const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4BwQACfsD/wOqvFkAAAAASUVORK5CYII=';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    if (!fs.existsSync(imagePath)) fs.writeFileSync(imagePath, Buffer.from(imageBase64, 'base64'));

    const registerBody = {
      name: 'Test Upload User',
      phone: `9000000${Math.floor(Math.random() * 9000 + 1000)}`,
      password: 'TestPass123!'
    };

    const registerRes = await fetch(`${backendUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerBody)
    });
    if (!registerRes.ok) {
      const text = await registerRes.text();
      throw new Error(`Register failed ${registerRes.status}: ${text}`);
    }
    const registerData = await registerRes.json();
    const token = registerData.token;
    console.log('REGISTERED', registerData.user);

    const form = new FormData();
    form.append('title', 'Test Image Upload Listing');
    form.append('description', 'This listing tests image upload.');
    form.append('price', '10');
    form.append('categoryId', 'electronics');
    form.append('city', 'Karachi');
    form.append('condition', 'new');
    form.append('images', fs.createReadStream(imagePath), path.basename(imagePath));

    const uploadRes = await fetch(`${backendUrl}/api/listings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const uploadText = await uploadRes.text();
    if (!uploadRes.ok) {
      throw new Error(`Listing upload failed ${uploadRes.status}: ${uploadText}`);
    }
    const uploadData = JSON.parse(uploadText);
    console.log('LISTING CREATED', uploadData.listing.id);
    console.log(JSON.stringify(uploadData.listing, null, 2));
  } catch (error) {
    console.error('ERROR', error.message);
    process.exit(1);
  }
})();
