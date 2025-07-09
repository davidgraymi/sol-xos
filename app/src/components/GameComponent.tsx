import React, { useState, useEffect } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import idl from '../sol_xos.json';
import { AccountInfo, PublicKey } from '@solana/web3.js';
import type { SolXos } from '../types/sol_xos';
import type { GameAccount } from '../types/derived';

const PROGRAM_ID: PublicKey = new PublicKey(idl.address);

interface GameComponentProps {
  gamePda: PublicKey;
  onBack: () => void;
}

const GameComponent: React.FC<GameComponentProps> = ({ gamePda, onBack }) => {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [program, setProgram] = useState<Program<SolXos> | null>(null);
  const [gameAccount, setGameAccount] = useState<GameAccount | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);

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

  useEffect(() => {
    let listenerId: number;

    const subscribe = async () => {
      if (program && gamePda && !gamePda.equals(PublicKey.default)) {
        try {
          const updatedGameAccount = await program.account.game.fetch(gamePda);
          setGameAccount(updatedGameAccount);
        } catch (e) {
          setGameAccount(null);
        }

        listenerId = connection.onAccountChange(
          gamePda,
          async (accountInfo: AccountInfo<Buffer> | null) => {
            if (!accountInfo || accountInfo.data.length === 0) {
              setGameAccount(null);
              return;
            }
            try {
              const decoded = program.coder.accounts.decode("game", accountInfo.data);
              setGameAccount(decoded);
            } catch (err) {
              setGameAccount(null);
            }
          },
          "confirmed"
        );
      }
    };

    subscribe();

    return () => {
      if (listenerId !== undefined) {
        connection.removeAccountChangeListener(listenerId);
      }
    };
  }, [connection, program, gamePda]);

  const handleMakeMove = async () => {
    if (!program || !wallet?.publicKey || !selectedCell || !gameAccount) return;
    try {
      await program.methods
        .makeMove(selectedCell.row, selectedCell.col)
        .accounts({
          game: gamePda,
          player: wallet.publicKey,
          other:
            wallet.publicKey.equals(gameAccount?.playerOne)
              ? gameAccount.playerTwo
              : gameAccount.playerOne,
        })
        .rpc();
      setSelectedCell(null);
    } catch (error) {
      alert('Failed to make move.');
      console.error('Error making move:', error);
    }
  };

  const handleLeaveGame = async () => {
    if (!program || !wallet?.publicKey || !gameAccount) return;
    try {
      await program.methods
        .leaveGame()
        .accounts({
          game: gamePda,
          playerOne: wallet.publicKey
        })
        .rpc();
      onBack();
    } catch (error) {
      alert('Failed to leave game.');
      console.error('Error leaving game:', error);
    }
  };

  const handleForfeit = async () => {
    if (!program || !wallet?.publicKey || !gameAccount) return;
    try {
      await program.methods
        .makeMove(255, 255)
        .accounts({
          game: gamePda,
          player: wallet.publicKey,
          other: wallet.publicKey.equals(gameAccount.playerOne)
            ? gameAccount.playerTwo
            : gameAccount.playerOne,
        })
        .rpc();
      onBack();
    } catch (error) {
      alert('Failed to leave game.');
      console.error('Error leaving game:', error);
    }
  };

  const getGameState = (state: GameAccount['state']) => {
    if (state.waitingForPlayerTwo) return 'Waiting for Player Two';
    if (state.playing) return 'Playing';
    return 'Unknown';
  };

  const renderCell = (cell: any) => {
    if (cell?.x) return <span style={{ color: "#ff6600" }}>X</span>;
    if (cell?.o) return <span style={{ color: "#00bfff" }}>O</span>;
    return '';
  };

  const isGameOwner = (userPub: PublicKey | undefined, gameData: GameAccount) => {
    return (userPub?.toBase58() === gameData.playerOne.toBase58());
  };

  const isGamePlayer = (userPub: PublicKey | undefined, gameData: GameAccount) => {
    return (userPub?.toBase58() === gameData.playerOne.toBase58() || userPub?.toBase58() === gameData.playerTwo.toBase58());
  };

  return (
    <div style={{
      background: "#181818",
      color: "#fff",
      borderRadius: 10,
      padding: 24,
      maxWidth: 620,
      margin: "32px auto",
      boxShadow: "0 2px 16px #0008"
    }}>
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
      {(gameAccount && isGameOwner(wallet?.publicKey, gameAccount) && gameAccount.state.waitingForPlayerTwo) ?
        <button onClick={handleLeaveGame} style={{
          background: "#333",
          color: "#fff",
          border: "none",
          borderRadius: 5,
          padding: "8px 16px",
          marginBottom: 16,
          marginLeft: 16,
          cursor: "pointer"
        }}>
          Leave Game
        </button>
        : (gameAccount && isGamePlayer(wallet?.publicKey, gameAccount) && gameAccount.state.playing) &&
        <button onClick={handleForfeit} style={{
          background: "red",
          color: "#fff",
          border: "none",
          borderRadius: 5,
          padding: "8px 16px",
          marginBottom: 16,
          marginLeft: 16,
          cursor: "pointer"
        }}>
          Forfeit
        </button>
      }
      <h2 style={{ textAlign: "center" }}>Tic-Tac-Toe Game</h2>
      {!wallet?.publicKey && <p>Please connect your wallet to interact.</p>}
      {gameAccount ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <div><b>Game ID:</b> {gamePda.toBase58()}</div>
            <div><b>Player One:</b> {gameAccount.playerOne.toBase58()}</div>
            <div><b>Player Two:</b> {gameAccount.playerTwo.toBase58() === PublicKey.default.toBase58() ? "None" : gameAccount.playerTwo.toBase58()}</div>
            <div><b>Pot:</b> {gameAccount.potAmount.toNumber().toString() + " (" + (gameAccount.potAmount.toNumber() / web3.LAMPORTS_PER_SOL).toString() + "SOL)"}</div>
            <div><b>State:</b> {getGameState(gameAccount.state)}</div>
            <div><b>Current Turn:</b> {gameAccount.turn.toBase58() === wallet?.publicKey.toBase58() ? 'Yours' : 'Opponent'}</div>
            <div><b>Winner:</b> {gameAccount.winner ? gameAccount.winner.toBase58() : "None"}</div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 60px)',
            gap: '8px',
            justifyContent: 'center',
            margin: '24px 0'
          }}>
            {gameAccount.board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const isSelectable =
                  gameAccount.state.playing &&
                  gameAccount.turn.toBase58() === wallet?.publicKey.toBase58() &&
                  cell === null;
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    style={{
                      width: 60,
                      height: 60,
                      background: selectedCell?.row === rowIndex && selectedCell?.col === colIndex ? "#333" : "#222",
                      border: "2px solid #444",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2em",
                      cursor: isSelectable ? "pointer" : "default",
                      transition: "background 0.2s"
                    }}
                    onClick={() => {
                      if (isSelectable) setSelectedCell({ row: rowIndex, col: colIndex });
                    }}
                  >
                    {renderCell(cell)}
                  </div>
                );
              })
            )}
          </div>
          {selectedCell && (
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              Selected: ({selectedCell.row}, {selectedCell.col})
            </div>
          )}
          {isGamePlayer(wallet?.publicKey, gameAccount) &&
            <div style={{ textAlign: "center" }}>
              <button
                onClick={handleMakeMove}
                disabled={
                  !program ||
                  !selectedCell ||
                  !gameAccount.state.playing ||
                  gameAccount.turn.toBase58() !== wallet?.publicKey.toBase58()
                }
                style={{
                  background: "#ff6600",
                  color: "#fff",
                  border: "none",
                  borderRadius: 5,
                  padding: "10px 24px",
                  fontWeight: "bold",
                  fontSize: "1em",
                  cursor: "pointer",
                  opacity:
                    !program ||
                      !selectedCell ||
                      !gameAccount.state.playing ||
                      gameAccount.turn.toBase58() !== wallet?.publicKey.toBase58()
                      ? 0.5
                      : 1
                }}
              >
                Make Move
              </button>
            </div>
          }
        </>
      ) : (
        <div style={{ textAlign: "center", margin: "32px 0" }}>
          <p>Loading game data...</p>
        </div>
      )}
    </div>
  );
};

export default GameComponent;
