import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("@solana/wallet-adapter-wallets", () => ({
  PhantomWalletAdapter: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    publicKey: null,
    readyState: 1,
  })),
}));

test("renders learn react link", () => {
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
