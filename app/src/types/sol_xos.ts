/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sol_xos.json`.
 */
export type SolXos = {
  "address": "7z3jyerk9MU8GYZK5N3jja6q9zfCtCWEPk1JNh4htY3P",
  "metadata": {
    "name": "solXos",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createGame",
      "discriminator": [
        124,
        69,
        75,
        66,
        184,
        220,
        72,
        206
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  116,
                  97,
                  99,
                  116,
                  111,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "playerOne"
              },
              {
                "kind": "arg",
                "path": "uniqueId"
              }
            ]
          }
        },
        {
          "name": "playerOne",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "uniqueId",
          "type": "u64"
        },
        {
          "name": "stakeAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "joinGame",
      "discriminator": [
        107,
        112,
        18,
        38,
        56,
        173,
        60,
        128
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "playerTwo",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stakeAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "leaveGame",
      "discriminator": [
        218,
        226,
        6,
        0,
        243,
        34,
        125,
        201
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "playerOne",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "makeMove",
      "discriminator": [
        78,
        77,
        152,
        203,
        222,
        211,
        208,
        233
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "other",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "row",
          "type": "u8"
        },
        {
          "name": "col",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "game",
      "discriminator": [
        27,
        90,
        166,
        125,
        74,
        100,
        121,
        18
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "gameAlreadyStartedOrFull",
      "msg": "The game is not in the 'WaitingForPlayerTwo' state."
    },
    {
      "code": 6001,
      "name": "cannotJoinOwnGame",
      "msg": "You cannot join your own game."
    },
    {
      "code": 6002,
      "name": "stakeMismatch",
      "msg": "The stake amount does not match the initial stake."
    },
    {
      "code": 6003,
      "name": "notYourTurn",
      "msg": "It's not your turn."
    },
    {
      "code": 6004,
      "name": "invalidMoveCoordinates",
      "msg": "Invalid move coordinates. Row and column must be between 0 and 2."
    },
    {
      "code": 6005,
      "name": "cellAlreadyOccupied",
      "msg": "The selected cell is already occupied."
    },
    {
      "code": 6006,
      "name": "zeroStakeNotAllowed",
      "msg": "Stake amount cannot be zero."
    },
    {
      "code": 6007,
      "name": "notAPlayer",
      "msg": "You are not a player in this game."
    }
  ],
  "types": [
    {
      "name": "game",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "playerOne",
            "type": "pubkey"
          },
          {
            "name": "playerTwo",
            "type": "pubkey"
          },
          {
            "name": "turn",
            "type": "pubkey"
          },
          {
            "name": "board",
            "type": {
              "array": [
                {
                  "array": [
                    {
                      "option": {
                        "defined": {
                          "name": "playerMark"
                        }
                      }
                    },
                    3
                  ]
                },
                3
              ]
            }
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "gameState"
              }
            }
          },
          {
            "name": "potAmount",
            "type": "u64"
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "gameState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waitingForPlayerTwo"
          },
          {
            "name": "playing"
          }
        ]
      }
    },
    {
      "name": "playerMark",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "x"
          },
          {
            "name": "o"
          }
        ]
      }
    }
  ]
};
