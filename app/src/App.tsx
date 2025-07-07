// src/App.tsx
import React, { useMemo } from 'react';
import { ConnectionProvider, useWallet, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, Connection } from '@solana/web3.js';
import GameComponent from './components/GameComponent';

import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  const network = "http://127.0.0.1:8899"; // Or 'Mainnet-beta', 'Testnet', 'Localnet'
  const connection = new Connection(network, 'processed');
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      // Add more wallets as needed
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={connection.rpcEndpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div style={{ padding: '20px' }}>
            <h1>Solana Tic-Tac-Toe</h1>
            <WalletMultiButton />
            <hr style={{ margin: '20px 0' }} />
            <GameComponent />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
