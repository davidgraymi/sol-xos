use anchor_lang::prelude::*;

declare_id!("7z3jyerk9MU8GYZK5N3jja6q9zfCtCWEPk1JNh4htY3P");

#[program]
pub mod sol_xos {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
