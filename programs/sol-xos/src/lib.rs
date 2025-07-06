mod constants;

use crate::constants::*;
use anchor_lang::prelude::*;

declare_id!("7z3jyerk9MU8GYZK5N3jja6q9zfCtCWEPk1JNh4htY3P");

#[program]
pub mod sol_xos {
    use super::*;

    pub fn initialize_game(
        ctx: Context<InitializeGame>,
        player_x: Pubkey,
        player_o: Pubkey,
    ) -> Result<()> {
        msg!("Tic Tac Toe game created");
        msg!("player_x: {}", player_x);
        msg!("player_o: {}", player_o);

        let game = &mut ctx.accounts.game;
        game.player_x = player_x;
        game.player_o = player_o;
        game.board = [const { None }; GAME_BOARD_SIZE];
        game.turn = Piece::X; // X always starts
        Ok(())
    }

    pub fn play(ctx: Context<Play>, position: usize) -> Result<()> {
        msg!(
            "Player {} is playing at position {}",
            ctx.accounts.player.key(),
            position
        );

        match ctx.accounts.game.turn {
            Piece::X => {
                if ctx.accounts.game.player_x != ctx.accounts.player.key() {
                    return Err(ErrorCode::NotYourTurn.into());
                }
            }
            Piece::O => {
                if ctx.accounts.game.player_o != ctx.accounts.player.key() {
                    return Err(ErrorCode::NotYourTurn.into());
                }
            }
        }

        // Ensure the position is within bounds
        if position >= GAME_BOARD_SIZE {
            return Err(ErrorCode::MoveOutOfBounds.into());
        }

        // Ensure the position is not already taken
        match &ctx.accounts.game.board[position] {
            Some(_) => return Err(ErrorCode::MoveAlreadyTaken.into()),
            None => ctx.accounts.game.board[position] = Some(ctx.accounts.game.turn.clone()),
        }

        // Check for win conditions
        for condition in WIN_CONDITIONS
            .iter()
            .filter(|&trio| trio.contains(&position))
        {
            if let Some(piece) = &ctx.accounts.game.board[condition[0]] {
                if ctx.accounts.game.board[condition[1]] == Some(piece.clone())
                    && ctx.accounts.game.board[condition[2]] == Some(piece.clone())
                {
                    
                    // Invoke the transfer instruction on the token program
                    transfer(
                        CpiContext::new(
                            ctx.accounts.system_program.to_account_info(),
                            Transfer {
                                from: ctx.accounts..to_account_info(),
                                to: ctx.accounts.recipient_token_account.to_account_info(),
                                authority: ctx.accounts.sender.to_account_info(),
                            },
                        ),
                        amount * 10u64.pow(ctx.accounts.mint_account.decimals as u32), // Transfer amount, adjust for decimals
                    )?;
                    ctx.accounts
                        .game
                        .close(ctx.accounts.player.to_account_info())?;
                    match piece {
                        Piece::X => todo!("Game over! X wins"),
                        Piece::O => todo!("Game over! O wins"),
                    };
                    return Ok(());
                }
            }
        }

        // Update turn
        ctx.accounts.game.turn = match ctx.accounts.game.turn {
            Piece::X => Piece::O,
            Piece::O => Piece::X,
        };

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(player_x: Pubkey, player_o: Pubkey)]
pub struct InitializeGame<'info> {
    #[account(
        init_if_needed,
        seeds = [player_x.as_array(), player_o.as_array()],
        bump,
        payer = owner,
        space = 8 + GameState::INIT_SPACE
    )]
    pub game: Account<'info, GameState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(position: usize)]
pub struct Play<'info> {
    #[account(mut)]
    pub game: Account<'info, GameState>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct GameState {
    pub player_x: Pubkey,
    pub player_o: Pubkey,
    pub board: [Option<Piece>; 9],
    pub turn: Piece,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace, PartialEq)]
pub enum Piece {
    X,
    O,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Not your turn")]
    NotYourTurn,
    #[msg("Move is already taken")]
    MoveAlreadyTaken,
    #[msg("Move is out of bounds")]
    MoveOutOfBounds,
}
