/**
 * Generate a random password with only uppercase and lowercase letters
 * @param {number} length - Length of the password (default: 12)
 * @returns {string} - Random password
 */
function generatePassword(length = 12) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const characters = uppercase + lowercase;
  let password = '';

  for (let i = 0; i < length; i++) {
    password += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return password;
}

module.exports = { generatePassword };
