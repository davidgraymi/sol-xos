import React, { useState, useMemo, useEffect } from "react";
import { ConnectionProvider, useAnchorWallet, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection, PublicKey } from "@solana/web3.js";
import Lobby from "./components/Lobby";
import GameComponent from "./components/GameComponent";
import CreateGameForm from "./components/CreateGameForm"; // You'll create this

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

type View = "lobby" | "create" | "game";

function App() {
  const network = "http://127.0.0.1:8899";
  const connection = new Connection(network, "processed");
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      // Add more wallets as needed
    ],
    [network]
  );
  const [selectedGame, setSelectedGame] = useState<PublicKey | null>(null);
  const [view, setView] = useState<View>("lobby");
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Check connection on mount
  useEffect(() => {
    let cancelled = false;
    async function checkConnection() {
      try {
        // getEpochInfo will throw if not reachable
        await connection.getEpochInfo();
        if (!cancelled) setConnectionError(null);
      } catch (e) {
        if (!cancelled) setConnectionError("Cannot connect to Solana localnet. Please ensure your validator is running.");
      }
    }
    checkConnection();
    return () => { cancelled = true; };
  }, [network]);

  if (connectionError) {
    return (
      <div style={{ background: "#111", minHeight: "100vh", color: "#fff", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#222", padding: 32, borderRadius: 12, boxShadow: "0 2px 16px #0008" }}>
          <h2>Connection Error</h2>
          <p>{connectionError}</p>
          <button
            style={{ background: "#ff6600", color: "#fff", border: "none", borderRadius: 5, padding: "10px 24px", fontWeight: "bold", marginTop: 16 }}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ConnectionProvider endpoint={connection.rpcEndpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div style={{ background: "#111", minHeight: "100vh", color: "#fff", fontFamily: "sans-serif" }}>
            <div style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
              <h1 style={{ textAlign: "center" }}>Solana Tic-Tac-Toe</h1>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <WalletMultiButton />
              </div>
              {view === "lobby" && (
                <Lobby
                  onSelectGame={(pda) => { setSelectedGame(pda); setView("game"); }}
                  onCreateGame={() => setView("create")}
                />
              )}
              {view === "create" && (
                <CreateGameForm
                  onGameCreated={(gamePda) => {
                    setSelectedGame(gamePda);
                    setView("game");
                  }}
                  onBack={() => setView("lobby")}
                />
              )}
              {view === "game" && selectedGame && (
                <GameComponent
                  gamePda={selectedGame}
                  onBack={() => setView("lobby")}
                />
              )}
            </div>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
