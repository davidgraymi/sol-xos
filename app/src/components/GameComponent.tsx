// src/components/GameComponent.tsx
import React, { useState, useEffect } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import idl from '../sol_xos.json';
import { AccountInfo, PublicKey } from '@solana/web3.js';
import type { SolXos } from '../types/sol_xos';
import type { GameAccount } from '../types/derived';

// Define the program ID from your IDL
const PROGRAM_ID: PublicKey = new PublicKey(idl.address);

const GameComponent: React.FC = () => {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [program, setProgram] = useState<Program<SolXos> | null>(null);
  const [gamePda, setGamePda] = useState<PublicKey>(PublicKey.default); // For the unique game ID
  const [gameAccount, setGameAccount] = useState<GameAccount | null>(null);
  const [stakeAmount, setStakeAmount] = useState<string>('0.01'); // Default stake in SOL
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
      // Fetch the initial account data
      if (program !== null && gamePda !== PublicKey.default) {
        try {

          const updatedGameAccount = await program.account.game.fetch(gamePda);
          setGameAccount(updatedGameAccount);

        } catch (e) {
          console.warn("Game not found initially");
        }

        // Subscribe to account changes
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
              console.error("Failed to decode game data", err);
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

  const handleCreateGame = async () => {
    if (!program || !wallet?.publicKey || !stakeAmount) return;

    try {
      const uniqueId = new BN(Date.now()); // Simple unique ID for testing
      const stakeLamports = new BN(parseFloat(stakeAmount) * web3.LAMPORTS_PER_SOL);

      let tx = await program.methods
        .createGame(uniqueId, stakeLamports)
        .accounts({
          playerOne: wallet.publicKey,
        })
        .rpcAndKeys();

      setGamePda(tx.pubkeys.game); // Store the unique ID to fetch the game
      alert('Game created successfully!');
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game.');
    }
  };

  const handleJoinGame = async () => {
    if (!program || !wallet?.publicKey || gamePda === PublicKey.default || !stakeAmount) return;

    try {
      const stakeLamports = new BN(parseFloat(stakeAmount) * web3.LAMPORTS_PER_SOL);

      await program.methods
        .joinGame(stakeLamports)
        .accounts({
          game: gamePda,
          playerTwo: wallet.publicKey,
        })
        .rpc();

      alert('Game joined successfully!');
    } catch (error) {
      console.error('Error joining game:', error);
      alert('Failed to join game. Check console for details.');
    }
  };

  const handleMakeMove = async () => {
    if (!program || !wallet?.publicKey || gamePda === PublicKey.default || !selectedCell || !gameAccount) return;

    try {
      await program.methods
        .makeMove(selectedCell.row, selectedCell.col)
        .accounts({
          game: gamePda,
          player: wallet.publicKey,
          other: gameAccount.playerTwo,
        })
        .rpc();

      alert(`Move made at (${selectedCell.row}, ${selectedCell.col})!`);
      setSelectedCell(null); // Clear selection
    } catch (error) {
      console.error('Error making move:', error);
      alert('Failed to make move. Check console for details.');
    }
  };

  const getGameState = (state: GameAccount['state']) => {
    if (state.waitingForPlayerTwo) return 'Waiting for Player Two';
    if (state.playing) return 'Playing';
    return 'Unknown';
  };

  return (
    <div>
      <h2>Game Interaction</h2>

      {!wallet?.publicKey && <p>Please connect your wallet to interact.</p>}

      {wallet?.publicKey && (
        <>
          <div style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '15px' }}>
            <h3>Create or Join Game</h3>
            <div>
              <label>
                Game ID (for joining/fetching existing):
                <input
                  type="text"
                  value={gamePda === PublicKey.default ? '' : gamePda.toString()}
                  onChange={(e) => setGamePda(new PublicKey(e.target.value === PublicKey.default.toString() ? '' : e.target.value ))}
                  placeholder="Enter Game ID to join a game or leave blank to create a new one"
                  style={{ marginLeft: '10px', width: '200px' }}
                />
              </label>
              <br />
              <label style={{ marginTop: '10px', display: 'block' }}>
                Stake Amount (SOL):
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  step="0.001"
                  min="0"
                  style={{ marginLeft: '10px', width: '100px' }}
                />
              </label>
            </div>
            <button onClick={handleCreateGame} disabled={!program}>
              Create Game
            </button>
            <button onClick={handleJoinGame} disabled={!program || gamePda === PublicKey.default}>
              Join Game
            </button>
          </div>

          {gameAccount && (

            <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px' }}>
              <h3>Current Game State</h3>
              <p>
                <strong>Game ID:</strong> {gamePda?.toString()}
              </p>
              <p>
                <strong>Player One:</strong> {gameAccount.playerOne.toBase58()}
              </p>
              <p>
                <strong>Player Two:</strong>{' '}
                {gameAccount.playerTwo.toBase58() === PublicKey.default.toBase58()
                  ? 'N/A'
                  : gameAccount.playerTwo.toBase58()}
              </p>
              <p>
                <strong>Current Turn:</strong>{' '}
                {gameAccount.turn.toBase58() === wallet.publicKey.toBase58()
                  ? 'YOUR TURN'
                  : gameAccount.turn.toBase58()}
              </p>
              <p>
                <strong>Game State:</strong> {getGameState(gameAccount.state)}
              </p>
              <p>
                <strong>Pot Amount:</strong>{' '}
                {gameAccount.potAmount.toNumber() / web3.LAMPORTS_PER_SOL} SOL
              </p>
              <p>
                <strong>Winner:</strong>{' '}
                {gameAccount.winner ? gameAccount.winner.toBase58() : 'None'}
              </p>

              <h4>Board:</h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 50px)',
                  gap: '5px',
                  width: '165px',
                  margin: '10px auto',
                }}
              >
                {gameAccount.board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      style={{
                        width: '50px',
                        height: '50px',
                        border: '1px solid black',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '2em',
                        cursor:
                          gameAccount.state.playing &&
                            gameAccount.turn.toBase58() === wallet.publicKey.toBase58() &&
                            cell === null
                            ? 'pointer'
                            : 'default',
                        backgroundColor: selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                          ? 'lightblue'
                          : 'white',
                      }}
                      onClick={() => {
                        if (
                          gameAccount.state.playing &&
                          gameAccount.turn.toBase58() === wallet.publicKey.toBase58() &&
                          cell === null
                        ) {
                          setSelectedCell({ row: rowIndex, col: colIndex });
                        }
                      }}
                    >
                      {cell?.o ? 'O' : cell?.x ? 'X' : ''}
                    </div>
                  ))
                )}
              </div>
              {selectedCell && (
                <p>Selected: ({selectedCell.row}, {selectedCell.col})</p>
              )}
              <button
                onClick={handleMakeMove}
                disabled={!program || !selectedCell || !gameAccount.state.playing || gameAccount.turn.toBase58() !== wallet.publicKey.toBase58()}
              >
                Make Move
              </button>

              <hr style={{ margin: '15px 0' }} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GameComponent;
