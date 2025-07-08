import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolXos } from "../target/types/sol_xos";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert, expect } from "chai";
import { getLogs } from "@solana-developers/helpers";

describe('sol-xos', () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.solXos as Program<SolXos>;
  const provider = anchor.getProvider();
  const approxGasFees: number = LAMPORTS_PER_SOL * 0.00001;

  describe("successful game, player 1 creates and wins", () => {
    const playerOne: Keypair = Keypair.generate();
    const playerTwo: Keypair = Keypair.generate();
    let uniqueId = new anchor.BN(Date.now());
    let [pda] = PublicKey.findProgramAddressSync([Buffer.from('tictactoe'), playerOne.publicKey.toBuffer(), uniqueId.toBuffer("le", 8)], program.programId);
    let p1OriginBalance: number;
    let p2OriginBalance: number;
    let rentWhenCreating: number;
    const wagerAmount: number = LAMPORTS_PER_SOL * 0.0001;
    const potTotal: number = wagerAmount * 2;

    before('get starting account balances', async () => {
      let airdropSignature = await provider.connection.requestAirdrop(
        playerOne.publicKey,
        1 * LAMPORTS_PER_SOL // Airdrop 1 SOL for testing
      );
      await provider.connection.confirmTransaction(airdropSignature, "confirmed");

      airdropSignature = await provider.connection.requestAirdrop(
        playerTwo.publicKey,
        1 * LAMPORTS_PER_SOL // Airdrop 1 SOL for testing
      );
      await provider.connection.confirmTransaction(airdropSignature, "confirmed");

      p1OriginBalance = await provider.connection.getBalance(playerOne.publicKey);
      p2OriginBalance = await provider.connection.getBalance(playerTwo.publicKey);

      console.log(`Player 1: ${playerOne.publicKey}, Balance: ${p1OriginBalance}`);
      console.log(`Player 2: ${playerTwo.publicKey}, Balance: ${p2OriginBalance}`);
      console.log(`Wager: ${wagerAmount}`);
    });

    it("create a new game", async () => {
      const p1InitBalance = await provider.connection.getBalance(playerOne.publicKey);

      const tx = await program.methods
        .createGame(uniqueId, new anchor.BN(wagerAmount))
        .accounts({
          playerOne: playerOne.publicKey,
        })
        .signers([playerOne])
        .rpc();

      expect(tx).to.be.a("string");

      // Get player 1 balance
      const p1EndBalance = await provider.connection.getBalance(playerOne.publicKey);

      // Get game state
      const game = program.account.game.fetch(pda);
      const pot = (await game).potAmount.toNumber();
      const p1 = (await game).playerOne;
      const p2 = (await game).playerTwo;
      const state = (await game).state;
      const turn = (await game).turn;
      const winner = (await game).winner;

      // Update how much rent cost the user
      rentWhenCreating = await provider.connection.getMinimumBalanceForRentExemption((await provider.connection.getAccountInfo(pda)).data.length);

      // Assertions
      assert.equal(p1EndBalance, p1InitBalance - wagerAmount - rentWhenCreating, "Player 1 balance should decrease by the wager amount + rent");
      assert.equal(pot, wagerAmount, "Game account balance should increase by the exact wager amount");
      assert.equal(p1.toString(), playerOne.publicKey.toString(), "Player 1 should be the player 1 public key");
      assert.equal(p2.toString(), PublicKey.default.toString(), "Player 2 should be default (not joined yet)");
      assert.isTrue(state.waitingForPlayerTwo ? true : false, "Game state should be waiting for player two");
      assert.equal(turn.toString(), p1.toString(), "Turn should be player 1");
      assert.isNull(winner, "Winner should be null at this point");
    });

    it("should join an existing game", async () => {
      const p2InitBalance = await provider.connection.getBalance(playerTwo.publicKey);

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

      const p2EndBalance = await provider.connection.getBalance(playerTwo.publicKey);

      const game = program.account.game.fetch(pda);
      const endPot = (await game).potAmount.toNumber();
      const p1 = (await game).playerOne;
      const p2 = (await game).playerTwo;
      const state = (await game).state;
      const turn = (await game).turn;
      const winner = (await game).winner;

      // Assertions
      assert.equal(p2EndBalance, p2InitBalance - wagerAmount, "Player 2 balance should decrease by the exact wager amount");
      assert.equal(endPot, potTotal, "Game account balance should increase by the exact wager amount");
      assert.equal(p1.toString(), playerOne.publicKey.toString(), "Player 1 should be the player 2 public key");
      assert.equal(p2.toString(), playerTwo.publicKey.toString(), "Player 2 should be the player 2 public key");
      assert.isTrue(state.playing ? true : false, "Game state should be playing");
      assert.equal(turn.toString(), p1.toString(), "Turn should be player 1");
      assert.isNull(winner, "Winner should be null at this point");
    });

    it("should play a move", async () => {
      let game = program.account.game.fetch(pda);

      const moveRow = 0;
      const moveCol = 0;
      const tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerOne.publicKey,
          game: pda,
          other: (await game).playerTwo,
        })
        .signers([playerOne])
        .rpc();

      expect(tx).to.be.a("string");

      game = program.account.game.fetch(pda);
      const pot = (await game).potAmount.toNumber();
      const p1 = (await game).playerOne;
      const p2 = (await game).playerTwo;
      const state = (await game).state;
      const turn = (await game).turn;
      const winner = (await game).winner;

      // Assertions
      assert.equal(pot, potTotal, "Game account balance should be the same as before");
      assert.equal(p1.toString(), playerOne.publicKey.toString(), "Player 1 should be the same as before");
      assert.equal(p2.toString(), playerTwo.publicKey.toString(), "Player 2 should be the same as before");
      assert.isTrue(state.playing ? true : false, "Game state should be playing");
      assert.equal(turn.toString(), p2.toString(), "Turn should be player 2 now");
      assert.isNull(winner, "Winner should be null at this point");
    });

    it("player 1 should win the game", async () => {
      let moveRow = 2;
      let moveCol = 0;
      let tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerTwo.publicKey,
          game: pda,
          other: playerOne.publicKey,
        })
        .signers([playerTwo])
        .rpc();

      moveRow = 0;
      moveCol = 1;
      tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerOne.publicKey,
          game: pda,
          other: playerTwo.publicKey,
        })
        .signers([playerOne])
        .rpc();
      expect(tx).to.be.a("string");

      moveRow = 2;
      moveCol = 1;
      tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerTwo.publicKey,
          game: pda,
          other: playerOne.publicKey,
        })
        .signers([playerTwo])
        .rpc();
      expect(tx).to.be.a("string");

      moveRow = 0;
      moveCol = 2;
      tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerOne.publicKey,
          game: pda,
          other: playerTwo.publicKey,
        })
        .signers([playerOne])
        .rpc();
      expect(tx).to.be.a("string");

      const gameAccountInfo = await program.provider.connection.getAccountInfo(pda);
      const p1EndBalance = await provider.connection.getBalance(playerOne.publicKey);
      const p2EndBalance = await provider.connection.getBalance(playerTwo.publicKey);

      // Assertions
      assert.equal(p1EndBalance, p1OriginBalance + wagerAmount, "Player 1 balance should increase by the wager amount");
      assert.equal(p2EndBalance, p2OriginBalance - wagerAmount, "Player 2 balance should decrease by the wager amount");
      assert.isNull(gameAccountInfo, "Game account should be closed");
    });

    after(async () => {
      const p1FinalBalance = await provider.connection.getBalance(playerOne.publicKey);
      const p2FinalBalance = await provider.connection.getBalance(playerTwo.publicKey);

      console.log(`Player 1: ${playerOne.publicKey}, Balance: ${p1FinalBalance}, Delta: ${p1FinalBalance - p1OriginBalance}`);
      console.log(`Player 2: ${playerTwo.publicKey}, Balance: ${p2FinalBalance}, Delta: ${p2FinalBalance - p2OriginBalance}`);
    });
  });

  describe("basic successful game, player 1 creates and player 2 wins", () => {
    const playerOne: Keypair = Keypair.generate();
    const playerTwo: Keypair = Keypair.generate();
    let uniqueId = new anchor.BN(Date.now());
    let [pda] = PublicKey.findProgramAddressSync([Buffer.from('tictactoe'), playerOne.publicKey.toBuffer(), uniqueId.toBuffer("le", 8)], program.programId);
    let p1OriginBalance: number;
    let p2OriginBalance: number;
    let rentWhenCreating: number;
    const wagerAmount: number = LAMPORTS_PER_SOL * 0.0000001;
    const potTotal: number = wagerAmount * 2;

    before('get starting account balances', async () => {
      let airdropSignature = await provider.connection.requestAirdrop(
        playerOne.publicKey,
        1 * LAMPORTS_PER_SOL // Airdrop 1 SOL for testing
      );
      await provider.connection.confirmTransaction(airdropSignature, "confirmed");

      airdropSignature = await provider.connection.requestAirdrop(
        playerTwo.publicKey,
        1 * LAMPORTS_PER_SOL // Airdrop 1 SOL for testing
      );
      await provider.connection.confirmTransaction(airdropSignature, "confirmed");

      p1OriginBalance = await provider.connection.getBalance(playerOne.publicKey);
      p2OriginBalance = await provider.connection.getBalance(playerTwo.publicKey);

      console.log(`Player 1: ${playerOne.publicKey}, Balance: ${p1OriginBalance}`);
      console.log(`Player 2: ${playerTwo.publicKey}, Balance: ${p2OriginBalance}`);
      console.log(`Wager: ${wagerAmount}`);
    });

    it("should create a new game", async () => {
      const p1InitBalance = await provider.connection.getBalance(playerOne.publicKey);

      const tx = await program.methods
        .createGame(uniqueId, new anchor.BN(wagerAmount))
        .accounts({
          playerOne: playerOne.publicKey,
        })
        .signers([playerOne])
        .rpc();

      expect(tx).to.be.a("string");

      // Get player 1 balance
      const p1EndBalance = await provider.connection.getBalance(playerOne.publicKey);

      // Get game state
      const game = program.account.game.fetch(pda);
      const pot = (await game).potAmount.toNumber();
      const p1 = (await game).playerOne;
      const p2 = (await game).playerTwo;
      const state = (await game).state;
      const turn = (await game).turn;
      const winner = (await game).winner;

      // Update how much rent cost the user
      rentWhenCreating = await provider.connection.getMinimumBalanceForRentExemption((await provider.connection.getAccountInfo(pda)).data.length);

      // Assertions
      assert.equal(p1EndBalance, p1InitBalance - wagerAmount - rentWhenCreating, "Player 1 balance should decrease by the wager amount + rent");
      assert.equal(pot, wagerAmount, "Game account balance should increase by the exact wager amount");
      assert.equal(p1.toString(), playerOne.publicKey.toString(), "Player 1 should be the player 1 public key");
      assert.equal(p2.toString(), PublicKey.default.toString(), "Player 2 should be default (not joined yet)");
      assert.isTrue(state.waitingForPlayerTwo ? true : false, "Game state should be waiting for player two");
      assert.equal(turn.toString(), p1.toString(), "Turn should be player 1");
      assert.isNull(winner, "Winner should be null at this point");
    });

    it("should join an existing game", async () => {
      const p2InitBalance = await provider.connection.getBalance(playerTwo.publicKey);

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

      const p2EndBalance = await provider.connection.getBalance(playerTwo.publicKey);

      game = program.account.game.fetch(pda);
      const endPot = (await game).potAmount.toNumber();
      const p1 = (await game).playerOne;
      const p2 = (await game).playerTwo;
      const state = (await game).state;
      const turn = (await game).turn;
      const winner = (await game).winner;

      // Assertions
      assert.equal(p2EndBalance, p2InitBalance - wagerAmount, "Player 2 balance should decrease by the exact wager amount");
      assert.equal(endPot, potTotal, "Game account balance should increase by the exact wager amount");
      assert.equal(p1.toString(), playerOne.publicKey.toString(), "Player 1 should be the player 2 public key");
      assert.equal(p2.toString(), playerTwo.publicKey.toString(), "Player 2 should be the player 2 public key");
      assert.isTrue(state.playing ? true : false, "Game state should be playing");
      assert.equal(turn.toString(), p1.toString(), "Turn should be player 1");
      assert.isNull(winner, "Winner should be null at this point");
    });

    it("should play a move", async () => {
      let game = program.account.game.fetch(pda);

      const moveRow = 0;
      const moveCol = 0;
      const tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerOne.publicKey,
          game: pda,
          other: (await game).playerTwo,
        })
        .signers([playerOne])
        .rpc();

      expect(tx).to.be.a("string");

      game = program.account.game.fetch(pda);
      const pot = (await game).potAmount.toNumber();
      const p1 = (await game).playerOne;
      const p2 = (await game).playerTwo;
      const state = (await game).state;
      const turn = (await game).turn;
      const winner = (await game).winner;

      // Assertions
      assert.equal(pot, potTotal, "Game account balance should be the same as before");
      assert.equal(p1.toString(), playerOne.publicKey.toString(), "Player 1 should be the same as before");
      assert.equal(p2.toString(), playerTwo.publicKey.toString(), "Player 2 should be the same as before");
      assert.isTrue(state.playing ? true : false, "Game state should be playing");
      assert.equal(turn.toString(), p2.toString(), "Turn should be player 2 now");
      assert.isNull(winner, "Winner should be null at this point");
    });

    it("player 2 should win the game", async () => {
      let moveRow = 0;
      let moveCol = 2;
      let tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerTwo.publicKey,
          game: pda,
          other: playerOne.publicKey,
        })
        .signers([playerTwo])
        .rpc();

      moveRow = 0;
      moveCol = 1;
      tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerOne.publicKey,
          game: pda,
          other: playerTwo.publicKey,
        })
        .signers([playerOne])
        .rpc();
      expect(tx).to.be.a("string");

      moveRow = 1;
      moveCol = 1;
      tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerTwo.publicKey,
          game: pda,
          other: playerOne.publicKey,
        })
        .signers([playerTwo])
        .rpc();
      expect(tx).to.be.a("string");

      moveRow = 2;
      moveCol = 2;
      tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerOne.publicKey,
          game: pda,
          other: playerTwo.publicKey,
        })
        .signers([playerOne])
        .rpc();
      expect(tx).to.be.a("string");

      moveRow = 2;
      moveCol = 0;
      tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerTwo.publicKey,
          game: pda,
          other: playerOne.publicKey,
        })
        .signers([playerTwo])
        .rpc();
      expect(tx).to.be.a("string");

      const gameAccountInfo = await program.provider.connection.getAccountInfo(pda);
      const p1EndBalance = await provider.connection.getBalance(playerOne.publicKey);
      const p2EndBalance = await provider.connection.getBalance(playerTwo.publicKey);

      // Assertions
      assert.equal(p1EndBalance, p1OriginBalance - wagerAmount, "Player 1 balance should decrease by the wager amount");
      assert.equal(p2EndBalance, p2OriginBalance + wagerAmount, "Player 2 balance should increase by the wager amount");
      assert.isNull(gameAccountInfo, "Game account should be closed");
    });

    after(async () => {
      const p1FinalBalance = await provider.connection.getBalance(playerOne.publicKey);
      const p2FinalBalance = await provider.connection.getBalance(playerTwo.publicKey);

      console.log(`Player 1: ${playerOne.publicKey}, Balance: ${p1FinalBalance}, Delta: ${p1FinalBalance - p1OriginBalance}`);
      console.log(`Player 2: ${playerTwo.publicKey}, Balance: ${p2FinalBalance}, Delta: ${p2FinalBalance - p2OriginBalance}`);
    });
  });

  describe("basic forfeit, player 1 creates and forfeits", () => {
    const playerOne: Keypair = Keypair.generate();
    const playerTwo: Keypair = Keypair.generate();
    let uniqueId = new anchor.BN(Date.now());
    let [pda] = PublicKey.findProgramAddressSync([Buffer.from('tictactoe'), playerOne.publicKey.toBuffer(), uniqueId.toBuffer("le", 8)], program.programId);
    let p1OriginBalance: number;
    let p2OriginBalance: number;
    let rentWhenCreating: number;
    const wagerAmount: number = LAMPORTS_PER_SOL * 0.01;
    const potTotal: number = wagerAmount * 2;

    before('get starting account balances', async () => {
      let airdropSignature = await provider.connection.requestAirdrop(
        playerOne.publicKey,
        1 * LAMPORTS_PER_SOL // Airdrop 1 SOL for testing
      );
      await provider.connection.confirmTransaction(airdropSignature, "confirmed");

      airdropSignature = await provider.connection.requestAirdrop(
        playerTwo.publicKey,
        1 * LAMPORTS_PER_SOL // Airdrop 1 SOL for testing
      );
      await provider.connection.confirmTransaction(airdropSignature, "confirmed");

      p1OriginBalance = await provider.connection.getBalance(playerOne.publicKey);
      p2OriginBalance = await provider.connection.getBalance(playerTwo.publicKey);

      console.log(`Player 1: ${playerOne.publicKey}, Balance: ${p1OriginBalance}`);
      console.log(`Player 2: ${playerTwo.publicKey}, Balance: ${p2OriginBalance}`);
      console.log(`Wager: ${wagerAmount}`);
    });

    it("should create a new game", async () => {
      const p1InitBalance = await provider.connection.getBalance(playerOne.publicKey);

      const tx = await program.methods
        .createGame(uniqueId, new anchor.BN(wagerAmount))
        .accounts({
          playerOne: playerOne.publicKey,
        })
        .signers([playerOne])
        .rpc();

      expect(tx).to.be.a("string");

      // Get player 1 balance
      const p1EndBalance = await provider.connection.getBalance(playerOne.publicKey);

      // Get game state
      const game = program.account.game.fetch(pda);
      const pot = (await game).potAmount.toNumber();
      const p1 = (await game).playerOne;
      const p2 = (await game).playerTwo;
      const state = (await game).state;
      const turn = (await game).turn;
      const winner = (await game).winner;

      // Update how much rent cost the user
      rentWhenCreating = await provider.connection.getMinimumBalanceForRentExemption((await provider.connection.getAccountInfo(pda)).data.length);

      // Assertions
      assert.equal(p1EndBalance, p1InitBalance - wagerAmount - rentWhenCreating, "Player 1 balance should decrease by the wager amount + rent");
      assert.equal(pot, wagerAmount, "Game account balance should increase by the exact wager amount");
      assert.equal(p1.toString(), playerOne.publicKey.toString(), "Player 1 should be the player 1 public key");
      assert.equal(p2.toString(), PublicKey.default.toString(), "Player 2 should be default (not joined yet)");
      assert.isTrue(state.waitingForPlayerTwo ? true : false, "Game state should be waiting for player two");
      assert.equal(turn.toString(), p1.toString(), "Turn should be player 1");
      assert.isNull(winner, "Winner should be null at this point");
    });

    it("should join an existing game", async () => {
      const p2InitBalance = await provider.connection.getBalance(playerTwo.publicKey);

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

      const p2EndBalance = await provider.connection.getBalance(playerTwo.publicKey);

      const game = program.account.game.fetch(pda);
      const endPot = (await game).potAmount.toNumber();
      const p1 = (await game).playerOne;
      const p2 = (await game).playerTwo;
      const state = (await game).state;
      const turn = (await game).turn;
      const winner = (await game).winner;

      // Assertions
      assert.equal(p2EndBalance, p2InitBalance - wagerAmount, "Player 2 balance should decrease by the exact wager amount");
      assert.equal(endPot, potTotal, "Game account balance should increase by the exact wager amount");
      assert.equal(p1.toString(), playerOne.publicKey.toString(), "Player 1 should be the player 2 public key");
      assert.equal(p2.toString(), playerTwo.publicKey.toString(), "Player 2 should be the player 2 public key");
      assert.isTrue(state.playing ? true : false, "Game state should be playing");
      assert.equal(turn.toString(), p1.toString(), "Turn should be player 1");
      assert.isNull(winner, "Winner should be null at this point");

    });

    it("should forfeit", async () => {
      let game = program.account.game.fetch(pda);

      // Now, play a move
      const moveRow = 255;
      const moveCol = 255;
      const tx = await program.methods
        .makeMove(moveRow, moveCol)
        .accounts({
          player: playerOne.publicKey,
          game: pda,
          other: (await game).playerTwo,
        })
        .signers([playerOne])
        .rpc();

      expect(tx).to.be.a("string");

      const gameAccountInfo = await program.provider.connection.getAccountInfo(pda);
      const p1EndBalance = await provider.connection.getBalance(playerOne.publicKey);
      const p2EndBalance = await provider.connection.getBalance(playerTwo.publicKey);

      // Assertions
      assert.equal(p1EndBalance, p1OriginBalance - wagerAmount, "Player 1 balance should decrease by the wager amount");
      assert.equal(p2EndBalance, p2OriginBalance + wagerAmount, "Player 2 balance should increase by the wager amount");
      assert.isNull(gameAccountInfo, "Game account should be closed");
    });

    after(async () => {
      const p1FinalBalance = await provider.connection.getBalance(playerOne.publicKey);
      const p2FinalBalance = await provider.connection.getBalance(playerTwo.publicKey);

      console.log(`Player 1: ${playerOne.publicKey}, Balance: ${p1FinalBalance}, Delta: ${p1FinalBalance - p1OriginBalance}`);
      console.log(`Player 2: ${playerTwo.publicKey}, Balance: ${p2FinalBalance}, Delta: ${p2FinalBalance - p2OriginBalance}`);
    });
  });
});

// TODO: trnasition to this method
function create_game(program: Program<SolXos>, creater: Keypair, uniqueId: anchor.BN, wager: number) {
  return program.methods
    .createGame(uniqueId, new anchor.BN(wager))
    .accounts({
      playerOne: creater.publicKey,
    })
    .signers([creater])
    .rpc();
}
