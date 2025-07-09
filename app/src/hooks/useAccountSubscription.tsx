// hooks/useAccountSubscription.ts
import { useEffect } from "react";
import {
  Connection,
  PublicKey,
  AccountInfo,
  Commitment,
  AccountSubscriptionConfig,
} from "@solana/web3.js";
import { Address } from "@coral-xyz/anchor";

type SubscriptionCallback = (accountInfo: AccountInfo<Buffer> | null) => void;

export function useAccountSubscription({
  connection,
  accountPublicKey,
  callback,
  commitment = {commitment: "confirmed", encoding: "jsonParsed"},
}: {
  connection: Connection;
  accountPublicKey: PublicKey;
  callback: SubscriptionCallback;
  commitment?: AccountSubscriptionConfig;
}) {
  useEffect(() => {
    if (!accountPublicKey) return;

    const id = connection.onAccountChange(
      accountPublicKey,
      (updatedAccountInfo) => {
        callback(updatedAccountInfo);
      },
      commitment
    );

    return () => {
      connection.removeAccountChangeListener(id);
    };
  }, [accountPublicKey.toBase58()]);
}
