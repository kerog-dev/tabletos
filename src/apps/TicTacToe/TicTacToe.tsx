import { useState } from "react";
import type { Sdk } from "../../sdk.ts";

const { toast }: Sdk = (window as any).$;

enum TileState {
  Empty = " ",
  X = "X",
  O = "O",
}

type BoardOf<X> = [X, X, X, X, X, X, X, X, X];

export default function TicTacToe() {
  const [board, setBoard] = useState<BoardOf<TileState>>(
    Array(9).fill(TileState.Empty) as BoardOf<TileState>,
  );
  const [currentPlayer, setCurrentPlayer] = useState<TileState>(TileState.X);
  const [winner, setWinner] = useState<TileState | null>(null);

  const checkWinner = (b: typeof board): TileState | null => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // cols
      [0, 4, 8],
      [2, 4, 6], // diagonals
    ];
    for (const [a, b2, c] of lines) {
      if (b[a] !== TileState.Empty && b[a] === b[b2] && b[a] === b[c]) {
        return b[a];
      }
    }
    return null;
  };

  const handleClick = (index: number) => {
    if (board[index] !== TileState.Empty || winner !== null) return;
    const newBoard: typeof board = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);
    setCurrentPlayer(currentPlayer === TileState.X ? TileState.O : TileState.X);
    const newWinner = checkWinner(newBoard);
    if (newWinner) {
      setWinner(newWinner);
      toast({ title: `${newWinner === TileState.X ? "X" : newWinner === TileState.O ? "O" : ""} won!` });
    }
  };

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10px",
          width: "30vmin",
          height: "30vmin",
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {board.map((tile, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              fontSize: "3rem",
            }}
          >
            {tile === TileState.Empty ? " " : tile === TileState.X ? "X" : "O"}
          </button>
        ))}
      </div>
      <div>
        <p>Current Player: {currentPlayer}</p>
        <p>Winner: {winner}</p>
      </div>
    </div>
  );
}
