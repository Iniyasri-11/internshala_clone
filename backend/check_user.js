const mongoose = require('mongoose');
const User = require('./Model/User');

const databaseUrl = 'mongodb://localhost:27017';

async function main() {
  await mongoose.connect(databaseUrl);
  try {
    const email = 'iniyasiva77@gmail.com';
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found');
      return;
    }
    console.log('lastPasswordResetRequest:', user.lastPasswordResetRequest);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
