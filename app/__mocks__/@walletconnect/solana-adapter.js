module.exports = {
  WalletConnectWalletAdapter: jest.fn().mockImplementation(() => ({
    publicKey: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn(),
    sendTransaction: jest.fn(),
    readyState: 1,
  })),
};
