import { useEffect, useRef, useState } from "react";
import "gchessboard";
import { Chess } from "chess.js";
import type { Sdk } from "../../sdk.ts";
import type { Controller } from "./service.ts";

const GChessboard = "g-chess-board" as any;

const { sv, conn: { name: connName } }: Sdk = (window as any).$;

const serviceName = "Online Chess Server Service";

function getStatus(chess: Chess): string {
  const side = chess.turn() === "w" ? "White" : "Black";
  if (chess.isCheckmate()) return `${side === "White" ? "Black" : "White"} wins by checkmate.`;
  if (chess.isStalemate() || chess.isDraw()) return `Draw.`;
  if (chess.inCheck()) return `${side} in check.`;
  return `${side} to move.`;
}

function Board({ gameId, exposed }: { gameId: string; exposed: Controller }) {
  const games = exposed.useGameList();
  const game = games.find(g => g.gameId === gameId);
  const boardRef = useRef<any>(null);
  const chess = !game ? null : new Chess(game.fen);
  const status = !chess ? null : getStatus(chess);

  useEffect(() => {
    const board = boardRef.current;
    if (!board || !game) return;

    const onMoveStart = (e: CustomEvent) => {
      const chessboard = new Chess(game.fen);
      e.detail.setTargets(
        chessboard.moves({ square: e.detail.from, verbose: true }).map((m: any) => m.to),
      );
    };

    const onMoveEnd = async (e: CustomEvent) => {
      try {
        await exposed.doMove(game.gameId, JSON.stringify([e.detail.from, e.detail.to]));
      } catch {
        e.preventDefault();
      }
    };

    board.addEventListener("movestart", onMoveStart);
    board.addEventListener("moveend", onMoveEnd);
    return () => {
      board.removeEventListener("movestart", onMoveStart);
      board.removeEventListener("moveend", onMoveEnd);
    };
  }, [game, exposed]);

  if (!game) return <div>Loading game...</div>;

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
        fen={game.fen}
        turn={chess?.turn() === "w" ? "white" : "black"}
        orientation={game.hostClientId === connName ? "white" : "black"}
        interactive={chess?.turn() === (game.hostClientId === connName ? "w" : "b")}
        style={{ width: "90cqmin", aspectRatio: "1/1" }}
      />
      <p
        style={{
          marginTop: 8,
          fontSize: 13,
          color: status?.includes("wins") || status?.includes("Draw") ? "#e55" : "#222",
          textAlign: "center",
        }}
      >
        {game.hostName} vs {game.opponentName}
        <br />
        {status}
      </p>
    </div>
  );
}

function GameList({ exposed, setGame }: { exposed: Controller; setGame: (gameId: string) => void }) {
  const list = exposed.useGameList();
  const [opponentName, setOpponentName] = useState("");

  return (
    <div>
      You are: {connName}
      <br />
      <input type="text" value={opponentName} onChange={e => setOpponentName(e.target.value)} />
      <button onClick={() => exposed.startGameWith(opponentName)}>Challenge</button>
      <br />
      Games:<br />
      {list.map(x => (
        <button onClick={() => setGame(x.gameId)}>
          {x.hostName} (host){x.hostName === connName ? " (you)" : ""} vs {x.opponentName}{" "}
          (opponent){x.hostName === connName ? " (you)" : ""}
        </button>
      ))}
    </div>
  );
}

export default function OnlineChess() {
  const serviceRunning = sv.useRunning(serviceName);
  const exposed = sv.get<Controller>(serviceName);
  const [game, setGame] = useState<string | null>(null);

  if (!serviceRunning) {
    return (
      <div>
        Service is stopped.<br />
        <button onClick={() => sv.start(serviceName)}>Start</button>
      </div>
    );
  }

  if (!exposed) {
    return (
      <div>
        Service running, loading games...
      </div>
    );
  }

  if (!game) return <GameList exposed={exposed} setGame={setGame} />;

  return <Board gameId={game} exposed={exposed} />;
}
