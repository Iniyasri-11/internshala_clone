const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./Model/User');

const databaseUrl = 'mongodb://localhost:27017';

async function main() {
  await mongoose.connect(databaseUrl);
  try {
    const email = 'test@example.com';
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found');
      return;
    }
    console.log('Current User Password Hash in DB:', user.password);

    // Let's mock a password change to "newpassword123"
    const newPassword = 'newpassword123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    console.log('Updated User Password Hash in DB:', user.password);

    // Fetch user again to be 100% sure it was saved and read
    const updatedUser = await User.findOne({ email });
    console.log('Fetched Password Hash from DB:', updatedUser.password);

    // Now let's compare
    const match = await bcrypt.compare(newPassword, updatedUser.password);
    console.log('Does "newpassword123" match updated password?', match);

    // Let's also check with a different salt round
    const compareWithHashedDirect = await bcrypt.compare(newPassword, hashedPassword);
    console.log('Direct compare with generated hash:', compareWithHashedDirect);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
