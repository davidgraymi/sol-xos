import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import React, { useEffect, useState } from "react";
import { SolXos } from "../types/sol_xos";
import idl from '../sol_xos.json';

interface CreateGameFormProps {
  onBack: () => void;
  onGameCreated: (gamePda: PublicKey) => void;
}

const CreateGameForm: React.FC<CreateGameFormProps> = ({ onBack, onGameCreated }) => {
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [program, setProgram] = useState<Program<SolXos> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wallet && connection) {
      try {
        const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
        const program = new Program<SolXos>(idl as SolXos, provider);
        setProgram(program);
      } catch (e) {
        console.error("Error initializing Anchor program:", e);
      }
    }
  }, [wallet, connection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!program) {
      setError("Program not found.");
      return;
    }

    if (!wallet?.publicKey) {
      setError("Wallet not found.");
      return;
    }

    if (stakeAmount <= 0) {
      setError("Stake amount must be greater than 0.");
      return;
    }

    setError(null);

    try {
      const uniqueId = new BN(Date.now());
      const stakeLamports = new BN(stakeAmount * web3.LAMPORTS_PER_SOL);

      let tx = await program.methods
        .createGame(uniqueId, stakeLamports)
        .accounts({
          playerOne: wallet.publicKey,
        })
        .rpcAndKeys();
      onGameCreated(tx.pubkeys.game);
    } catch (error) {
      console.error('Error creating game:', error);
      setError('Failed to create game.');
    }
  };

  return (
    <div style={{ background: "#181818", color: "#fff", borderRadius: 10, padding: 24, maxWidth: 420, margin: "32px auto", boxShadow: "0 2px 16px #0008" }}>
      <button onClick={onBack} style={{
        background: "#333",
        color: "#fff",
        border: "none",
        borderRadius: 5,
        padding: "8px 16px",
        marginBottom: 16,
        cursor: "pointer"
      }}>
        ← Back to Lobby
      </button>
      <h2 style={{ textAlign: "center" }}>Create Game</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>Stake Amount (lamports)<br />
            <input
              type="number"
              value={stakeAmount}
              onChange={e => setStakeAmount(parseFloat(e.target.value))}
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #444", background: "#222", color: "#fff" }}
              required
            />
          </label>
        </div>
        {error && <div style={{ color: "#ff6666", marginBottom: 12 }}>{error}</div>}
        <button type="submit" style={{ background: "#ff6600", color: "#fff", border: "none", borderRadius: 5, padding: "10px 24px", fontWeight: "bold", fontSize: "1em", cursor: "pointer" }}>
          Create Game
        </button>
      </form>
    </div>
  );
};

export default CreateGameForm;
