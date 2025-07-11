// jest.config.js
module.exports = {
  transformIgnorePatterns: [
    "node_modules/(?!(\\@walletconnect|\\@solana)/)"
  ],
  transform: {
    "^.+\\.(ts|tsx)$": "babel-jest",
  },
};
