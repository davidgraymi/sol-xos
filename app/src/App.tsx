import React, { useState, useMemo, useEffect } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import Lobby from "./components/Lobby";
import GameComponent from "./components/GameComponent";
import CreateGameForm from "./components/CreateGameForm";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

// Default styles that can be overridden by your app
import "@solana/wallet-adapter-react-ui/styles.css";

type View = "lobby" | "create" | "game";

function App() {
  const endpoint = getSolanaEndpoint();
  const connection = useMemo(
    () => new Connection(endpoint, "processed"),
    [endpoint]
  );
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      // Add more wallets as needed
    ],
    []
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
        if (!cancelled)
          setConnectionError(
            `Cannot connect to Solana ${process.env.REACT_APP_SOLANA_NETWORK} . Please ensure your validator is running.`
          );
      }
    }
    checkConnection();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  if (connectionError) {
    return (
      <div className="background-xo">
        <div
          style={{
            background: "#222",
            padding: 32,
            borderRadius: 12,
            boxShadow: "0 2px 16px #0008",
            maxWidth: 350,
            margin: "auto",
          }}
        >
          <h2>Connection Error</h2>
          <p>{connectionError}</p>
          <button
            style={{
              background: "#ff6600",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              padding: "10px 24px",
              fontWeight: "bold",
              marginTop: 16,
            }}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
        <XOBackgroundStyles />
      </div>
    );
  }

  return (
    <ConnectionProvider endpoint={connection.rpcEndpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="background-xo">
            <div className="main-container">
              <h1 style={{ textAlign: "center", color: "white" }}>
                Solana Tic-Tac-Toe
              </h1>
              <div className="wallet-btn-row">
                <WalletMultiButton />
              </div>
              {view === "lobby" && (
                <Lobby
                  onSelectGame={(pda) => {
                    setSelectedGame(pda);
                    setView("game");
                  }}
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
            <XOBackgroundStyles />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function getSolanaEndpoint() {
  const network = process.env.REACT_APP_SOLANA_NETWORK;
  if (network === "localnet") {
    return "http://127.0.0.1:8899";
  } else if (
    Object.values(WalletAdapterNetwork).includes(
      network as WalletAdapterNetwork
    )
  ) {
    // Safe to cast
    return clusterApiUrl(network as WalletAdapterNetwork);
  } else {
    // fallback
    return clusterApiUrl(WalletAdapterNetwork.Devnet);
  }
}

// Add this component at the bottom of your file
function XOBackgroundStyles() {
  return (
    <style>
      {`
      .background-xo {
        min-height: 100vh;
        min-width: 100vw;
        position: relative;
        overflow: hidden;
        background: #111;
        font-family: sans-serif;
      }
      .main-container {
        max-width: 900px;
        margin: 0 auto;
        padding: 32px;
        position: relative;
        z-index: 1;
        background: rgba(17,17,17,0.92);
        border-radius: 18px;
        box-shadow: 0 2px 16px #0008;
      }
      .wallet-btn-row {
        display: flex;
        justify-content: center;
        margin-bottom: 24px;
      }
      /* Responsive styles */
      @media (max-width: 600px) {
        .main-container {
          padding: 12px;
          max-width: 100vw;
        }
      }
      /* XO background pattern */
      .background-xo::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background-image:
          repeating-linear-gradient(135deg, transparent, transparent 80px, rgba(255,255,255,0.03) 80px, rgba(255,255,255,0.03) 160px),
          url("data:image/svg+xml;utf8,<svg width='120' height='120' xmlns='http://www.w3.org/2000/svg'><text x='10' y='60' font-size='64' fill='rgba(255,255,255,0.08)'>X</text><text x='60' y='110' font-size='64' fill='rgba(255,255,255,0.08)'>O</text></svg>");
        background-size: 240px 240px, 120px 120px;
        background-repeat: repeat;
        opacity: 1;
        animation: xo-move 40s linear infinite;
      }
      @keyframes xo-move {
        0% { background-position: 0 0, 0 0; }
        100% { background-position: 240px 240px, 120px 120px; }
      }
      `}
    </style>
  );
}

export default App;
