import { useState } from "react";
import { sdk } from "../../getsdk.ts";
import styles from "./TicTacToe.module.css";

const { toast } = sdk();

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
    <div className={styles.app}>
      <div className={styles.board}>
        {board.map((tile, i) => <button key={i} onClick={() => handleClick(i)}>{tile}</button>)}
      </div>
      <div>
        <p>
          Current Player: {currentPlayer}
          <br />Winner: {winner}
        </p>
      </div>
    </div>
  );
}
