// Import necessary crates from Anchor and Solana SDK
use anchor_lang::prelude::*;
use anchor_lang::system_program;

// Declare the program ID. This will be automatically replaced by Anchor during deployment.
declare_id!("7z3jyerk9MU8GYZK5N3jja6q9zfCtCWEPk1JNh4htY3P");

// Define the program module
#[program]
pub mod sol_xos {
    use super::*;

    // Instruction to create a new game
    pub fn create_game(ctx: Context<CreateGame>, _unique_id: u64, stake_amount: u64) -> Result<()> {
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
                    to: game.to_account_info(),         // The vault PDA (receiver).
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
                    to: game.to_account_info(),         // The vault PDA (receiver).
                },
            ),
            stake_amount,
        )?;

        // Update game state
        game.player_two = player_two.key();
        game.state = GameState::Playing;
        game.pot_amount += stake_amount; // Add player two's stake to the pot

        Ok(())
    }

    // Instruction to make a move in the game
    pub fn make_move(ctx: Context<MakeMove>, row: u8, col: u8) -> Result<()> {
        // Get mutable references to the game account and the player making the move
        let game = &mut ctx.accounts.game;
        let player = &ctx.accounts.player;
        let other = &ctx.accounts.other;
        let mark: PlayerMark;

        if player.key() == game.player_one {
            mark = PlayerMark::X;
        } else if player.key() == game.player_two {
            mark = PlayerMark::O;
        } else {
            return Err(ErrorCode::NotAPlayer.into());
        }

        if row == Game::FORFEIT && col == Game::FORFEIT {
            // Transfer the pot to the winner and close the game account
            let winner_account = other.to_account_info();
            let loser_account = player.to_account_info();
            let game_account = game.to_account_info();

            // Transfer the pot from game to winner
            game_account.sub_lamports(game.pot_amount)?;
            winner_account.add_lamports(game.pot_amount)?;

            // Close the game account and transfer the remaining rent back to the renter
            match mark {
                PlayerMark::X => game.close(loser_account.clone())?,
                PlayerMark::O => game.close(winner_account.clone())?,
            }

            return Ok(());
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

        // Place the mark on the board
        game.board[row as usize][col as usize] = Some(mark);

        // Check for win condition
        if check_win(&game.board, mark) {
            game.winner = Some(player.key());

            // Transfer the pot to the winner and close the game account
            let winner_account = player.to_account_info();
            let loser_account = other.to_account_info();
            let game_account = game.to_account_info();

            // Transfer the pot from game to winner
            game_account.sub_lamports(game.pot_amount)?;
            winner_account.add_lamports(game.pot_amount)?;

            // Close the game account and transfer the remaining rent back to the renter
            match mark {
                PlayerMark::X => game.close(winner_account)?,
                PlayerMark::O => game.close(loser_account)?,
            }
        } else if check_draw(&game.board) {
            // Divide the pot between both players
            let game_account = game.to_account_info();

            let pot = game.pot_amount;
            let half_pot = pot / 2;

            game_account.sub_lamports(half_pot)?;
            player.to_account_info().add_lamports(half_pot)?;

            game.pot_amount -= half_pot;

            game_account.sub_lamports(game.pot_amount)?;
            other.to_account_info().add_lamports(game.pot_amount)?;

            // Close the game account and transfer the remaining rent back to the renter
            match mark {
                PlayerMark::X => game.close(player.to_account_info())?,
                PlayerMark::O => game.close(other.to_account_info())?,
            }
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

    // Instruction for player one to leave the game before player two joins
    pub fn leave_game(_ctx: Context<LeaveGame>) -> Result<()> {
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
#[instruction(_unique_id: u64, stake_amount: u64)]
pub struct CreateGame<'info> {
    // Game account: A PDA derived from "game" seed and player_one's pubkey
    #[account(
        init,
        payer = player_one,
        space = 8 + Game::LEN, // 8 bytes for Anchor's discriminator + Game struct size
        seeds = [Game::SEED_PREFIX, player_one.key().as_ref(), _unique_id.to_le_bytes().as_ref()], // Seeds for PDA derivation
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
    #[account(mut, constraint = game.state == GameState::WaitingForPlayerTwo)]
    pub game: Account<'info, Game>,
    // Player two (signer and payer for their stake)
    #[account(mut)]
    pub player_two: Signer<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}

// Context for the `make_move` instruction
#[derive(Accounts)]
#[instruction(row: u8, col: u8)]
pub struct MakeMove<'info> {
    // Game account: Must be mutable to update the board and turn
    #[account(mut, constraint = game.state == GameState::Playing)]
    pub game: Account<'info, Game>,
    // The player making the move (must be a signer)
    #[account(mut)]
    pub player: Signer<'info>,
    // The other player in the game
    /// CHECK: Used to transfer SOL in case of a draw, forfeit, or win
    #[account(mut)]
    pub other: UncheckedAccount<'info>,
    // The system program
    pub system_program: Program<'info, System>,
}

// Context for the `leave_game` instruction
#[derive(Accounts)]
#[instruction()]
pub struct LeaveGame<'info> {
    // Game account: Must be mutable to update its state and receive SOL
    #[account(mut, constraint = game.state == GameState::WaitingForPlayerTwo, close = player_one)]
    pub game: Account<'info, Game>,
    // Player one
    #[account(mut, address = game.player_one)]
    pub player_one: Signer<'info>,
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
    pub const SEED_PREFIX: &'static [u8; 9] = b"tictactoe";
    const FORFEIT: u8 = u8::MAX; // Special value to indicate a forfeit move
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
    #[msg("It's not your turn.")]
    NotYourTurn,
    #[msg("Invalid move coordinates. Row and column must be between 0 and 2.")]
    InvalidMoveCoordinates,
    #[msg("The selected cell is already occupied.")]
    CellAlreadyOccupied,
    #[msg("Stake amount cannot be zero.")]
    ZeroStakeNotAllowed,
    #[msg("You are not a player in this game.")]
    NotAPlayer,
}
