// src/components/GameComponent.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN, Address, IdlAccounts, IdlTypes } from '@coral-xyz/anchor';
import idl from '../sol_xos.json';
import { PublicKey } from '@solana/web3.js';
import type { SolXos } from '../types/sol_xos'; // Adjust path if different

// Define the program ID from your IDL
const PROGRAM_ID: PublicKey = new PublicKey(idl.address);

type GameAccount = IdlAccounts<SolXos>['game'];

const GameComponent: React.FC = () => {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [program, setProgram] = useState<Program<SolXos> | null>(null);
  const [gameId, setGameId] = useState<Address>(''); // For the unique game ID
  const [gameAccount, setGameAccount] = useState<GameAccount | null>(null);
  const [stakeAmount, setStakeAmount] = useState<string>('0.01'); // Default stake in SOL
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    console.log("Attempting to initialize program...");
    console.log("IDL loaded:", idl); // IMPORTANT: Check what 'idl' actually contains
    console.log("Program ID from IDL:", idl.address); // IMPORTANT: Verify program address

    if (wallet && connection) {
      try {
        const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
        const program = new Program<SolXos>(idl as SolXos, provider);
        setProgram(program);
        console.log("Program initialized successfully.");
      } catch (e) {
        console.error("Error initializing Anchor program:", e);
        // You might see the 'kind' error here in the console, indicating the IDL issue
      }
    }
  }, [wallet, connection]);

  const fetchGame = useCallback(async () => {
    if (!program || !gameId || !wallet?.publicKey) return;

    try {
      const account = await program.account.game.fetch(gameId);
      setGameAccount(account as GameAccount);
      console.log('Fetched game account:', account);
    } catch (error) {
      console.error('Error fetching game:', error);
      // setGameAccount(null);
    }
  }, [program, gameId, wallet]);

  // Refetch game data periodically or after transactions
  useEffect(() => {
    const interval = setInterval(fetchGame, 1000); // Fetch every 5 seconds
    return () => clearInterval(interval);
  }, [fetchGame]);

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

      setGameId(tx.pubkeys.game); // Store the unique ID to fetch the game
      alert('Game created successfully!');
      fetchGame();
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game. Check console for details.');
    }
  };

  const handleJoinGame = async () => {
    if (!program || !wallet?.publicKey || !gameId || !stakeAmount) return;

    try {
      const stakeLamports = new BN(parseFloat(stakeAmount) * web3.LAMPORTS_PER_SOL);

      await program.methods
        .joinGame(stakeLamports)
        .accounts({
          game: gameId,
          playerTwo: wallet.publicKey,
        })
        .rpc();

      alert('Game joined successfully!');
      fetchGame();
    } catch (error) {
      console.error('Error joining game:', error);
      alert('Failed to join game. Check console for details.');
    }
  };

  const handleMakeMove = async () => {
    if (!program || !wallet?.publicKey || !gameId || !selectedCell) return;

    try {
      await program.methods
        .makeMove(selectedCell.row, selectedCell.col)
        .accounts({
          game: gameId,
          player: wallet.publicKey,
        })
        .rpc();

      alert(`Move made at (${selectedCell.row}, ${selectedCell.col})!`);
      setSelectedCell(null); // Clear selection
      fetchGame();
    } catch (error) {
      console.error('Error making move:', error);
      alert('Failed to make move. Check console for details.');
    }
  };

  const handleClaimWinnings = async () => {
    if (!program || !wallet?.publicKey || !gameId) return;

    try {
      await program.methods
        .claimWinnings()
        .accounts({
          game: gameId,
          winner: wallet.publicKey,
        })
        .rpc();

      alert('Winnings claimed successfully!');
      fetchGame();
    } catch (error) {
      console.error('Error claiming winnings:', error);
      alert('Failed to claim winnings. Check console for details.');
    }
  };

  const handleClaimDrawStake = async () => {
    if (!program || !wallet?.publicKey || !gameId) return;

    try {
      await program.methods
        .claimDrawStake()
        .accounts({
          game: gameId,
          player: wallet.publicKey,
        })
        .rpc();

      alert('Draw stake claimed successfully!');
      fetchGame();
    } catch (error) {
      console.error('Error claiming draw stake:', error);
      alert('Failed to claim draw stake. Check console for details.');
    }
  };

  const getPlayerMark = (mark: number | null) => {
    if (mark === 0) return 'X';
    if (mark === 1) return 'O';
    return '';
  };

  const getGameState = (state: GameAccount['state']) => {
    if (state.waitingForPlayerTwo) return 'Waiting for Player Two';
    if (state.playing) return 'Playing';
    if (state.ended) return 'Ended';
    if (state.draw) return 'Draw';
    if (state.claimed) return 'Claimed';
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
                  value={gameId.toString()}
                  onChange={(e) => setGameId(e.target.value)}
                  placeholder="Enter Game ID or leave blank for new"
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
            <button onClick={handleJoinGame} disabled={!program || !gameId}>
              Join Game
            </button>
            <button onClick={fetchGame} disabled={!program || !gameId}>
              Fetch Game Data
            </button>
          </div>

          {gameAccount && (
            <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px' }}>
              <h3>Current Game State</h3>
              <p>
                <strong>Game ID:</strong> {gameId.toString()}
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

              <button
                onClick={handleClaimWinnings}
                disabled={
                  !program ||
                  !gameAccount.state.ended ||
                  gameAccount.winner?.toBase58() !== wallet.publicKey.toBase58()
                }
              >
                Claim Winnings
              </button>
              <button
                onClick={handleClaimDrawStake}
                disabled={
                  !program ||
                  !gameAccount.state.draw ||
                  (gameAccount.playerOne.toBase58() !== wallet.publicKey.toBase58() &&
                    gameAccount.playerTwo.toBase58() !== wallet.publicKey.toBase58())
                }
              >
                Claim Draw Stake
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GameComponent;
