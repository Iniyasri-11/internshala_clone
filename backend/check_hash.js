const bcrypt = require('bcryptjs');

const hash = '$2a$10$qgW/6r1YjMJ4WvvpjyaU1uGhmhRMM0w2TYi./ZgeZ36ylKz8WDXae';

async function main() {
  const candidates = [
    'password123',
    'newpassword123',
    'VRgEABBtBLRQ',
    'DjbLZInXpPxl',
    'iGPQylAdVLcw',
    'ymmhTapSxeFC',
  ];

  for (const c of candidates) {
    const match = await bcrypt.compare(c, hash);
    console.log(`Does "${c}" match?`, match);
  }
}

main();
