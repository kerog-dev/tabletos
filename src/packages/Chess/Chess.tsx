import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { useWindow } from "../../components/wm/WindowContext";

if (!customElements.get("g-chess-board")) {
  await import("gchessboard");
}

const GChessboard = "g-chess-board" as any;

let game = new Chess();

export default function ChessApp() {
  const boardRef = useRef<any>(null);
  const [status, setStatus] = useState("White to move");
  const appWindow = useWindow();

  function syncStatus() {
    const side = game.turn() === "w" ? "White" : "Black";
    if (game.isCheckmate()) setStatus(`${side === "White" ? "Black" : "White"} wins by checkmate`);
    else if (game.isStalemate() || game.isDraw()) setStatus("Draw");
    else if (game.inCheck()) setStatus(`${side} in check`);
    else setStatus(`${side} to move`);
  }

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const onMoveStart = (e: CustomEvent) => {
      e.detail.setTargets(
        game.moves({ square: e.detail.from, verbose: true }).map((m: any) => m.to),
      );
    };

    const onMoveEnd = (e: CustomEvent) => {
      const move = game.move({ from: e.detail.from, to: e.detail.to, promotion: "q" });
      if (move === null) e.preventDefault();
    };

    const onMoveFinished = () => {
      board.fen = game.fen();
      board.turn = game.turn() === "w" ? "white" : "black";
      syncStatus();
    };

    board.addEventListener("movestart", onMoveStart);
    board.addEventListener("moveend", onMoveEnd);
    board.addEventListener("movefinished", onMoveFinished);
    return () => {
      board.removeEventListener("movestart", onMoveStart);
      board.removeEventListener("moveend", onMoveEnd);
      board.removeEventListener("movefinished", onMoveFinished);
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        containerType: "size",
      }}
    >
      <GChessboard
        ref={boardRef}
        fen={game.fen()}
        interactive
        style={{ width: "90cqmin", aspectRatio: "1/1" }}
      />
      <p
        style={{
          marginTop: 8,
          fontSize: 13,
          color: status.includes("wins") || status.includes("Draw") ? "#e55" : "#222",
          textAlign: "center",
        }}
      >
        {status}
        <br />
        <button
          onClick={() => {
            if (confirm("Are you sure?")) {
              game = new Chess();
              appWindow?.kill();
            }
          }}
        >
          Restart
        </button>
      </p>
    </div>
  );
}
