import React, { useEffect, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import idl from "../sol_xos.json";
import { PublicKey } from "@solana/web3.js";
import type { SolXos } from "../types/sol_xos";
import type { GameAccount } from "../types/derived";

const PROGRAM_ID = new PublicKey(idl.address);

const Lobby: React.FC<{
  onSelectGame: (gamePda: PublicKey) => void;
  onCreateGame: () => void;
}> = ({ onSelectGame, onCreateGame }) => {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [program, setProgram] = useState<Program<SolXos> | null>(null);
  const [games, setGames] = useState<{ pda: PublicKey; account: GameAccount }[]>([]);

  useEffect(() => {
    if (!wallet || !connection) return;
    try {
      const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
      setProgram(new Program<SolXos>(idl as SolXos, provider));
    } catch (e) {
      console.error("Error initializing Anchor program:", e);
    }
  }, [wallet, connection]);

  useEffect(() => {
    if (!wallet || !connection || !program) return;

    let subId: number;

    async function fetchGames() {
      // Fetch all game accounts
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: 8 + 32 + 32 + 32 + 18 + 1 + 8 + 33 }, // Adjust to your Game struct size
        ],
      });
      const decoded = await Promise.all(
        accounts.map(async (acc) => ({
          pda: acc.pubkey,
          account: program?.coder.accounts.decode("game", acc.account.data) as GameAccount,
        }))
      );
      setGames(decoded);
    }

    fetchGames();

    // Subscribe to changes
    subId = connection.onProgramAccountChange(PROGRAM_ID, () => fetchGames());

    return () => {
      if (subId) connection.removeProgramAccountChangeListener(subId);
    };
  }, [wallet, connection, program]);

  const handleJoinGame = async (gamePda: PublicKey, stake: BN) => {
    if (!program || !wallet) return;
    try {

      await program.methods
        .joinGame(stake)
        .accounts({
          game: gamePda,
          playerTwo: wallet.publicKey,
        }).rpc();

      onSelectGame(gamePda);
    } catch (error) {
      alert('Failed to join game.');
      console.error('Error joining game:', error);
      console.log(gamePda.toBase58().toString());
      console.log(stake.toNumber().toString());
    }
  };

  return (
    <div style={{ background: "#181818", color: "#fff", padding: 24, borderRadius: 10, minHeight: 400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Lobby</h2>
        <button onClick={onCreateGame} style={{ background: "#ff6600", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 5, fontWeight: "bold" }}>
          CREATE A GAME
        </button>
      </div>
      <table style={{ width: "100%", marginTop: 16, background: "#222", borderRadius: 8 }}>
        <thead>
          <tr style={{ background: "#333" }}>
            <th>Game ID</th>
            <th>Player One</th>
            <th>Player Two</th>
            <th>State</th>
            <th>Pot</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {games.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: 16 }}>No games found.</td>
            </tr>
          )}
          {games.map(({ pda, account }) => (
            <tr key={pda.toBase58()} style={{ borderBottom: "1px solid #444" }}>
              <td>{pda.toBase58().slice(0, 8)}...</td>
              <td>{account.playerOne.toBase58().slice(0, 8)}...</td>
              <td>{account.playerTwo.toBase58() === PublicKey.default.toBase58() ? "N/A" : account.playerTwo.toBase58().slice(0, 8) + "..."}</td>
              <td>{account.state.waitingForPlayerTwo ? "Waiting" : account.state.playing ? "Playing" : "Ended"}</td>
              <td>{(account.potAmount.toNumber() / web3.LAMPORTS_PER_SOL)} SOL</td>
              <td>
                {account.state.waitingForPlayerTwo ?
                  <button onClick={() => handleJoinGame(pda, account.potAmount)} style={{ background: "rgb(255, 102, 0)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 4 }}>
                    Join
                  </button>
                  : <div></div>
                }
              </td>
              <td>
                <button onClick={() => onSelectGame(pda)} style={{ background: "#444", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 4 }}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Lobby;