import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolXos } from "../target/types/sol_xos";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert, expect } from "chai";
import { getLogs } from "@solana-developers/helpers";

describe("sol-xos", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.solXos as Program<SolXos>;
  const provider = anchor.getProvider();
  const wallet = provider.wallet as anchor.Wallet;

  let playerTwo: Keypair = Keypair.generate();
  let wagerAmount = (1 * LAMPORTS_PER_SOL);
  const uniqueId = new anchor.BN(Date.now());
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('tictactoe'), wallet.publicKey.toBuffer(), uniqueId.toBuffer("le", 8)], program.programId);

  before(async () => {
    const airdropSignature = await provider.connection.requestAirdrop(
      playerTwo.publicKey,
      5 * LAMPORTS_PER_SOL // Airdrop 5 SOL for testing
    );
    await provider.connection.confirmTransaction(airdropSignature, "confirmed");
    console.log("Airdrop confirmed.");
    console.log(`Initial Player 2 Balance: ${await provider.connection.getBalance(playerTwo.publicKey)} LAMPORTS`);
    console.log(`--- Test Setup Complete ---\n`);
  });

  beforeEach(async () => { });

  it("should create a new game", async () => {
    const initBalance = await provider.connection.getBalance(wallet.publicKey);

    const tx = await program.methods
      .createGame(uniqueId, new anchor.BN(wagerAmount))
      .accounts({
        playerOne: wallet.publicKey,
      })
      .signers([wallet.payer])
      .rpc().catch((err) => {
        getLogs(provider.connection, tx).then((logs) => {
          console.log("Transaction logs:", logs);
        });
        throw err;
      });

    expect(tx).to.be.a("string");

    const endBalance = await provider.connection.getBalance(wallet.publicKey);
    const balanceDif = initBalance - endBalance;
    const game = program.account.game.fetch(pda);
    const pot = (await game).potAmount.toNumber();
    const p1 = (await game).playerOne;
    const p2 = (await game).playerTwo;
    const state = (await game).state;
    const turn = (await game).turn;
    const winner = (await game).winner;

    // Assertions
    assert.closeTo(balanceDif, wagerAmount, LAMPORTS_PER_SOL * 0.003, "User balance should decrease by the wager amount + gas fees");
    assert.equal(pot, wagerAmount, "Game account balance should increase by the exact wager amount");
    assert.equal(p1.toString(), wallet.publicKey.toString(), "Player 1 should be the wallet public key");
    assert.equal(p2.toString(), PublicKey.default.toString(), "Player 2 should be default (not joined yet)");
    assert.isTrue(state.waitingForPlayerTwo ? true : false, "Game state should be waiting for player two");
    assert.equal(turn.toString(), p1.toString(), "Turn should be player 1");
    assert.isNull(winner, "Winner should be null at this point");

    console.log(`Create Game Test: User: ${initBalance} -> ${endBalance} LAMPORTS, Game: 0 -> ${pot} LAMPORTS`);
  });

  it("should join an existing game", async () => {
    const initBalance = await provider.connection.getBalance(playerTwo.publicKey);

    let game = program.account.game.fetch(pda);
    const initPot = (await game).potAmount.toNumber();

    // Now, join the game
    const tx = await program.methods
      .joinGame(new anchor.BN(wagerAmount))
      .accounts({
        playerTwo: playerTwo.publicKey,
        game: pda,
      })
      .signers([playerTwo])
      .rpc();
    expect(tx).to.be.a("string");

    game = program.account.game.fetch(pda);

    const endBalance = await provider.connection.getBalance(playerTwo.publicKey);
    const balanceDif = initBalance - endBalance;
    const endPot = (await game).potAmount.toNumber();
    const p1 = (await game).playerOne;
    const p2 = (await game).playerTwo;
    const state = (await game).state;
    const turn = (await game).turn;
    const winner = (await game).winner;

    // Assertions
    assert.equal(balanceDif, wagerAmount, "User balance should decrease by the wager amount");
    assert.equal(endPot, wagerAmount * 2, "Game account balance should increase by the exact wager amount");
    assert.equal(p1.toString(), wallet.publicKey.toString(), "Player 1 should be the wallet public key");
    assert.equal(p2.toString(), playerTwo.publicKey.toString(), "Player 2 should be the player 2 public key");
    assert.isTrue(state.playing ? true : false, "Game state should be playing");
    assert.equal(turn.toString(), p1.toString(), "Turn should be player 1");
    assert.isNull(winner, "Winner should be null at this point");

    console.log(`Join Existing Game Test: User: ${initBalance} -> ${endBalance} LAMPORTS, Game: ${initPot} -> ${endPot} LAMPORTS`);
  });

  it("should play a move", async () => {
    // Now, play a move
    const moveRow = 0;
    const moveCol = 0;
    const tx = await program.methods
      .makeMove(moveRow, moveCol)
      .accounts({
        player: wallet.publicKey,
        game: pda,
      })
      .signers([wallet.payer])
      .rpc();

    expect(tx).to.be.a("string");

    const game = program.account.game.fetch(pda);
    const pot = (await game).potAmount.toNumber();
    const p1 = (await game).playerOne;
    const p2 = (await game).playerTwo;
    const state = (await game).state;
    const turn = (await game).turn;
    const winner = (await game).winner;

    // Assertions
    assert.equal(pot, wagerAmount * 2, "Game account balance should be the same as before");
    assert.equal(p1.toString(), wallet.publicKey.toString(), "Player 1 should be the same as before");
    assert.equal(p2.toString(), playerTwo.publicKey.toString(), "Player 2 should be the same as before");
    assert.isTrue(state.playing ? true : false, "Game state should be playing");
    assert.equal(turn.toString(), p2.toString(), "Turn should be player 2 now");
    assert.isNull(winner, "Winner should be null at this point");
  });
});
