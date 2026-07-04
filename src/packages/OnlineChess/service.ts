import { Chess } from "chess.js";
import type { Service } from "../../packages.ts";
import { randomId } from "../../utils.ts";

interface GameStartRequest {
  opponentName: string;
  opponentClientId: string;
}

interface GameInfo {
  hostName: string;
  hostClientId: string;
  opponentName: string;
  opponentClientId: string;
  gameId: string;
  fen: string;
}

interface OnlineChessServerObject {
  startGame(req: GameStartRequest): GameInfo;
  getGameInfo(gameId: string): GameInfo | null;
  makeMove(gameId: string, move: { from: string; to: string; promotion: string }): void;
  updateListener(info: GameInfo): void;
}

export interface Controller {
  object: OnlineChessServerObject;
  useGameList(): GameInfo[];
  startGameWith(clientId: string): Promise<void>;
  doMove(gameId: string, move: string): Promise<void>;
}

interface DB {
  games: Record<string, GameInfo>;
}

const service: Service = {
  info: {
    name: "Online Chess Server Service",
    autostart: false,
  },
  async start(sdk) {
    const db = await sdk.jsonDB<DB>("/chess.json");
    db.object.games ??= {};

    const myId = sdk.conn.name;
    const myName = sdk.deviceName;

    function applyMove(turn: "w" | "b", gameId: string, move: { from: string; to: string; promotion: string }) {
      const info = db.object.games[gameId];
      const chess = new Chess(info.fen);
      if (chess.turn() !== turn) throw "Incorrect turn";
      chess.move(move);
      info.fen = chess.fen();
    }

    const object: OnlineChessServerObject = {
      startGame(req) {
        const info: GameInfo = {
          hostName: myName,
          hostClientId: myId,
          opponentClientId: req.opponentClientId,
          opponentName: req.opponentName,
          gameId: randomId(),
          // starting position
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        };
        db.object.games[info.gameId] = info;
        return info;
      },
      getGameInfo(gameId) {
        const info: GameInfo | undefined = db.object.games[gameId];
        if (!info || info.hostClientId !== myId) return null;
        return info;
      },
      makeMove(gameId, move) {
        const info: GameInfo | undefined = db.object.games[gameId];
        if (!info || info?.hostClientId !== myId) throw "Game doesn't exist or this server is not the host.";
        applyMove("b", info.gameId, move);
        sdk.conn.call<void>(`${info.opponentClientId}::onlinechess::updateListener`, [info]).then(() => {
          console.log(`[Chess Server Service]: successfully notified opponent of successful move!`);
        });
      },
      updateListener(info) {
        db.object.games[info.gameId] = info;
      },
    };

    sdk.conn.exposeObject(object, "onlinechess");

    async function updateGames() {
      const promises = [];

      for (const gameId in db.object.games) {
        promises.push(
          (async () => {
            const g = db.object.games[gameId];
            if (g.hostClientId === myId) return;
            const info = await sdk.conn.call<GameInfo | null>(`${g.hostClientId}::onlinechess::getGameInfo`, [
              g.gameId,
            ]);
            if (!info) return;
            db.object.games[info.gameId] = info;
          })(),
        );
      }

      await Promise.allSettled(promises);
    }

    updateGames();

    const controller: Controller = {
      object,
      useGameList: () => Object.values(db.use("games")),
      async startGameWith(clientId) {
        const info = await sdk.conn.call<GameInfo>(`${clientId}::onlinechess::startGame`, [{
          opponentClientId: myId,
          opponentName: myName,
        }]);
        db.object.games[info.gameId] = info;
      },
      async doMove(gameId, moveIn) {
        const parsedMove = JSON.parse(moveIn);
        const move = {
          from: parsedMove[0],
          to: parsedMove[1],
          promotion: "q",
        };
        const info = db.object.games[gameId];
        if (info.hostClientId === myId) {
          applyMove("w", info.gameId, move);
          sdk.conn.call<void>(`${info.opponentClientId}::onlinechess::updateListener`, [info]).then(() => {
            console.log(`[Chess Server Service]: successfully notified host of successful move!`);
          });
        } else {
          await sdk.conn.call<void>(`${info.hostClientId}::onlinechess::makeMove`, [gameId, move]);
        }
      },
    };

    return {
      exposed: controller,
      stop() {
        sdk.conn.unexposeObject("onlinechess");
      },
    };
  },
};

export default service;
