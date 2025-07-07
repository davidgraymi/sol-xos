// Import necessary crates from Anchor and Solana SDK
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, program::invoke_signed, system_instruction};
use anchor_lang::system_program;

// Declare the program ID. This will be automatically replaced by Anchor during deployment.
declare_id!("7z3jyerk9MU8GYZK5N3jja6q9zfCtCWEPk1JNh4htY3P");

// Define the program module
#[program]
pub mod sol_xos {
    use super::*;

    // Instruction to create a new game
    pub fn create_game(ctx: Context<CreateGame>, stake_amount: u64) -> Result<()> {
        // Get mutable references to the game account and player 1
        let game = &mut ctx.accounts.game;
        let player_one = &ctx.accounts.player_one;
        let system_program = &ctx.accounts.system_program;

        // Ensure the stake amount is greater than zero
        if stake_amount == 0 {
            return Err(ErrorCode::ZeroStakeNotAllowed.into());
        }

        // Transfer SOL from player_one to the game account
        // The game account is a PDA, so it can hold SOL directly.
        system_program::transfer(
            CpiContext::new(
                system_program.to_account_info(), // The system program is needed for SOL transfers.
                anchor_lang::system_program::Transfer {
                    from: player_one.to_account_info(), // The user's account (sender).
                    to: game.to_account_info(),  // The vault PDA (receiver).
                },
            ),
            stake_amount,
        )?;

        // Initialize game state
        game.player_one = player_one.key();
        game.player_two = Pubkey::default(); // Player two is not set yet
        game.turn = game.player_one; // Player one starts
        game.board = [[None; 3]; 3]; // Initialize an empty 3x3 board
        game.state = GameState::WaitingForPlayerTwo;
        game.pot_amount = stake_amount;
        game.winner = None; // No winner yet

        msg!(
            "Game created by {} with stake {} SOL",
            player_one.key(),
            stake_amount
        );
        Ok(())
    }

    // Instruction for a second player to join the game
    pub fn join_game(ctx: Context<JoinGame>, stake_amount: u64) -> Result<()> {
        // Get mutable references to the game account and player 2
        let game = &mut ctx.accounts.game;
        let player_two = &ctx.accounts.player_two;
        let system_program = &ctx.accounts.system_program;

        // Check if the game is waiting for a second player
        if game.state != GameState::WaitingForPlayerTwo {
            return Err(ErrorCode::GameAlreadyStartedOrFull.into());
        }

        // Ensure player_two is not player_one
        if player_two.key() == game.player_one {
            return Err(ErrorCode::CannotJoinOwnGame.into());
        }

        // Ensure the stake amount matches player one's stake
        if stake_amount != game.pot_amount {
            // pot_amount holds player_one's stake
            return Err(ErrorCode::StakeMismatch.into());
        }

        // Transfer SOL from player_one to the game account
        // The game account is a PDA, so it can hold SOL directly.
        system_program::transfer(
            CpiContext::new(
                system_program.to_account_info(), // The system program is needed for SOL transfers.
                anchor_lang::system_program::Transfer {
                    from: player_two.to_account_info(), // The user's account (sender).
                    to: game.to_account_info(),  // The vault PDA (receiver).
                },
            ),
            stake_amount,
        )?;

        // Update game state
        game.player_two = player_two.key();
        game.state = GameState::Playing;
        game.pot_amount += stake_amount; // Add player two's stake to the pot

        msg!(
            "Player {} joined the game. Total pot: {} SOL",
            player_two.key(),
            game.pot_amount
        );
        Ok(())
    }

    // Instruction to make a move in the game
    pub fn make_move(ctx: Context<MakeMove>, row: u8, col: u8) -> Result<()> {
        // Get mutable references to the game account and the player making the move
        let game = &mut ctx.accounts.game;
        let player = &ctx.accounts.player;

        // Ensure the game is in the 'Playing' state
        if game.state != GameState::Playing {
            return Err(ErrorCode::GameNotActive.into());
        }

        // Ensure it's the current player's turn
        if game.turn != player.key() {
            return Err(ErrorCode::NotYourTurn.into());
        }

        // Validate move coordinates
        if row >= 3 || col >= 3 {
            return Err(ErrorCode::InvalidMoveCoordinates.into());
        }

        // Check if the cell is already occupied
        if game.board[row as usize][col as usize].is_some() {
            return Err(ErrorCode::CellAlreadyOccupied.into());
        }

        // Determine the player's mark (X or O)
        let mark = if player.key() == game.player_one {
            PlayerMark::X
        } else {
            PlayerMark::O
        };

        // Place the mark on the board
        game.board[row as usize][col as usize] = Some(mark);

        msg!("Player {} made a move at ({}, {})", player.key(), row, col);

        // Check for win condition
        if check_win(&game.board, mark) {
            game.winner = Some(player.key());
            game.state = GameState::Ended;
            msg!("Player {} won the game!", player.key());
        } else if check_draw(&game.board) {
            game.state = GameState::Draw;
            msg!("The game is a draw!");
        } else {
            // Switch turns
            game.turn = if game.turn == game.player_one {
                game.player_two
            } else {
                game.player_one
            };
        }

        Ok(())
    }

    // Instruction to claim winnings after the game has ended
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        // Get mutable references to the game account and the winner
        let game = &mut ctx.accounts.game;
        let winner = &mut ctx.accounts.winner;

        // Ensure the game has ended
        if game.state != GameState::Ended {
            return Err(ErrorCode::GameNotEnded.into());
        }

        // Ensure the caller is the declared winner
        if game.winner.is_none() || game.winner.unwrap() != winner.key() {
            return Err(ErrorCode::NotTheWinner.into());
        }

        // Transfer the pot amount from the game account to the winner
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: game.to_account_info(),
                    to: winner.to_account_info(),
                },
            ),
            game.pot_amount,
        )?;

        msg!(
            "Player {} claimed {} SOL winnings.",
            winner.key(),
            game.pot_amount
        );

        // Reset pot amount and mark game as claimed
        game.pot_amount = 0;
        game.state = GameState::Claimed; // Prevent multiple claims

        Ok(())
    }

    // Instruction for players to claim their stake back if the game is a draw
    pub fn claim_draw_stake(ctx: Context<ClaimDrawStake>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player = &mut ctx.accounts.player;

        // Ensure the game is a draw
        if game.state != GameState::Draw {
            return Err(ErrorCode::GameNotDraw.into());
        }

        // Ensure the caller is one of the players
        if player.key() != game.player_one && player.key() != game.player_two {
            return Err(ErrorCode::NotAPlayer.into());
        }

        // Calculate half the pot amount for each player
        let half_pot = game.pot_amount / 2;

        // Transfer stake back to the player
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: game.to_account_info(),
                    to: player.to_account_info(),
                },
            ),
            half_pot,
        )?;

        msg!(
            "Player {} claimed {} SOL back from draw.",
            player.key(),
            half_pot
        );

        // Update pot amount (remaining for the other player to claim)
        game.pot_amount -= half_pot;

        // If both players have claimed, set state to claimed
        if game.pot_amount == 0 {
            game.state = GameState::Claimed;
        }

        Ok(())
    }
}

// Helper function to check for a win condition in Tic-Tac-Toe
fn check_win(board: &[[Option<PlayerMark>; 3]; 3], mark: PlayerMark) -> bool {
    // Check rows
    for row in 0..3 {
        if board[row][0] == Some(mark.clone())
            && board[row][1] == Some(mark.clone())
            && board[row][2] == Some(mark.clone())
        {
            return true;
        }
    }

    // Check columns
    for col in 0..3 {
        if board[0][col] == Some(mark.clone())
            && board[1][col] == Some(mark.clone())
            && board[2][col] == Some(mark.clone())
        {
            return true;
        }
    }

    // Check diagonals
    if (board[0][0] == Some(mark.clone())
        && board[1][1] == Some(mark.clone())
        && board[2][2] == Some(mark.clone()))
        || (board[0][2] == Some(mark.clone())
            && board[1][1] == Some(mark.clone())
            && board[2][0] == Some(mark.clone()))
    {
        return true;
    }

    false
}

// Helper function to check for a draw condition
fn check_draw(board: &[[Option<PlayerMark>; 3]; 3]) -> bool {
    for row in 0..3 {
        for col in 0..3 {
            if board[row][col].is_none() {
                return false; // Found an empty cell, not a draw yet
            }
        }
    }
    true // All cells are filled, and no winner, so it's a draw
}

// Context for the `create_game` instruction
#[derive(Accounts)]
#[instruction(stake_amount: u64)]
pub struct CreateGame<'info> {
    // Game account: A PDA derived from "game" seed and player_one's pubkey
    #[account(
        init,
        payer = player_one,
        space = 8 + Game::LEN, // 8 bytes for Anchor's discriminator + Game struct size
        seeds = [Game::SEED_PREFIX, player_one.key().as_ref()], // Seeds for PDA derivation
        bump
    )]
    pub game: Account<'info, Game>,
    // Player one (signer and payer for the game account)
    #[account(mut)]
    pub player_one: Signer<'info>,
    // The system program is required for creating accounts and transferring SOL
    pub system_program: Program<'info, System>,
}

// Context for the `join_game` instruction
#[derive(Accounts)]
#[instruction(stake_amount: u64)]
pub struct JoinGame<'info> {
    // Game account: Must be mutable to update its state and receive SOL
    #[account(mut)]
    pub game: Account<'info, Game>,
    // Player two (signer and payer for their stake)
    #[account(mut)]
    pub player_two: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}

// Context for the `make_move` instruction
#[derive(Accounts)]
pub struct MakeMove<'info> {
    // Game account: Must be mutable to update the board and turn
    #[account(mut)]
    pub game: Account<'info, Game>,
    // The player making the move (must be a signer)
    #[account(mut)]
    // Player account needs to be mutable if we were to deduct gas fees or similar, though not strictly needed for just signing
    pub player: Signer<'info>,
}

// Context for the `claim_winnings` instruction
#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    // Game account: Must be mutable to transfer SOL out and update state
    #[account(mut)]
    pub game: Account<'info, Game>,
    // The winner (recipient of SOL)
    #[account(mut)]
    pub winner: Signer<'info>, // Winner must sign to claim
    // The system program
    pub system_program: Program<'info, System>,
}

// Context for the `claim_draw_stake` instruction
#[derive(Accounts)]
pub struct ClaimDrawStake<'info> {
    // Game account: Must be mutable to transfer SOL out and update state
    #[account(mut)]
    pub game: Account<'info, Game>,
    // The player claiming their stake back
    #[account(mut)]
    pub player: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}

// Define the `Game` account structure
#[account]
pub struct Game {
    pub player_one: Pubkey,
    pub player_two: Pubkey,
    pub turn: Pubkey,                        // Whose turn it is
    pub board: [[Option<PlayerMark>; 3]; 3], // 3x3 Tic-Tac-Toe board
    pub state: GameState,
    pub pot_amount: u64,        // Total SOL in the pot
    pub winner: Option<Pubkey>, // The winner's pubkey
}

// Implement `LEN` trait for `Game` to calculate account size
impl Game {
    // Calculate the size of the Game account
    // Pubkey: 32 bytes
    // Option<PlayerMark>: 1 byte (enum) + 1 byte (discriminator for Option) = 2 bytes.
    // Board: 3x3 array of Option<PlayerMark> = 9 * 2 = 18 bytes
    // GameState: 1 byte (enum)
    // u64: 8 bytes
    // Option<Pubkey>: 32 bytes (Pubkey) + 1 byte (discriminator for Option) = 33 bytes
    const LEN: usize = 32 + 32 + 32 + (9 * (1 + 1)) + 1 + 8 + (32 + 1);
    pub const SEED_PREFIX: &'static [u8; 4] = b"game";
}

// Enum to represent the player's mark on the board
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PlayerMark {
    X,
    O,
}

// Enum to represent the game's current state
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameState {
    WaitingForPlayerTwo,
    Playing,
    Ended,   // Game ended with a winner
    Draw,    // Game ended in a draw
    Claimed, // Winnings have been claimed (or draw stakes claimed)
}

// Custom error codes for the program
#[error_code]
pub enum ErrorCode {
    #[msg("The game is not in the 'WaitingForPlayerTwo' state.")]
    GameAlreadyStartedOrFull,
    #[msg("You cannot join your own game.")]
    CannotJoinOwnGame,
    #[msg("The stake amount does not match the initial stake.")]
    StakeMismatch,
    #[msg("The game is not active.")]
    GameNotActive,
    #[msg("It's not your turn.")]
    NotYourTurn,
    #[msg("Invalid move coordinates. Row and column must be between 0 and 2.")]
    InvalidMoveCoordinates,
    #[msg("The selected cell is already occupied.")]
    CellAlreadyOccupied,
    #[msg("The game has not ended yet.")]
    GameNotEnded,
    #[msg("You are not the winner of this game.")]
    NotTheWinner,
    #[msg("Stake amount cannot be zero.")]
    ZeroStakeNotAllowed,
    #[msg("The game is not a draw.")]
    GameNotDraw,
    #[msg("You are not a player in this game.")]
    NotAPlayer,
}
