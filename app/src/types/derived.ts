import { IdlAccounts } from "@coral-xyz/anchor";
import { SolXos } from "./sol_xos";

export type GameAccount = IdlAccounts<SolXos>["game"];
