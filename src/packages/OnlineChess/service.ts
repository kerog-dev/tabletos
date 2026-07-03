import { Chess } from "chess.js";
import { useEffect, useState } from "react";
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

const service: Service = {
  info: {
    name: "Online Chess Server Service",
    dependencies: [],
    autostart: false,
  },
  async start(sdk) {
    async function loadGameInfos(): Promise<Record<string, GameInfo>> {
      try {
        return JSON.parse(await sdk.fs.readTextFile("/chess.json"));
      } catch {
        if (!(await sdk.fs.pathExists("/chess.json"))) {
          await sdk.fs.writeFile("/chess.json", "{}");
        }
        return {};
      }
    }

    async function saveGameInfos(gameInfos: Record<string, GameInfo>) {
      await sdk.fs.writeFile("/chess.json", JSON.stringify(gameInfos));
    }

    const myId = sdk.conn.name;
    const myName = sdk.deviceName;

    const gameInfos: Record<string, GameInfo> = await loadGameInfos();

    let infoUpdateListeners: (() => void)[] = [];

    const onInfoUpdated = () =>
      infoUpdateListeners.forEach(l => {
        try {
          l();
        } catch {}
      });

    function applyMove(turn: "w" | "b", info: GameInfo, move: { from: string; to: string; promotion: string }) {
      const chess = new Chess(info.fen);
      if (chess.turn() !== turn) throw "Incorrect turn";
      chess.move(move);
      info.fen = chess.fen();
      onInfoUpdated();
      saveGameInfos(gameInfos);
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
        gameInfos[info.gameId] = info;
        onInfoUpdated();
        saveGameInfos(gameInfos);
        return info;
      },
      getGameInfo(gameId) {
        const info: GameInfo | undefined = gameInfos[gameId];
        if (!info || info.hostClientId !== myId) return null;
        return info;
      },
      makeMove(gameId, move) {
        if (gameInfos[gameId]?.hostClientId !== myId) throw "Game doesn't exist or this server is not the host.";
        const info: GameInfo = gameInfos[gameId];
        applyMove("b", info, move);
        sdk.conn.call<void>(`${info.opponentClientId}::onlinechess::updateListener`, [info]).then(() => {
          console.log(`[Chess Server Service]: successfully notified opponent of successful move!`);
        });
      },
      updateListener(info) {
        gameInfos[info.gameId] = info;
        onInfoUpdated();
        saveGameInfos(gameInfos);
      },
    };

    sdk.conn.exposeObject(object, "onlinechess");

    function updateGames() {
      Object.values(gameInfos).forEach(async g => {
        if (g.hostClientId === myId) return;
        const info = await sdk.conn.call<GameInfo | null>(`${g.hostClientId}::onlinechess::getGameInfo`, [g.gameId]);
        if (!info) return;
        gameInfos[info.gameId] = info;
        onInfoUpdated();
        saveGameInfos(gameInfos);
      });
    }

    updateGames();

    const controller: Controller = {
      object,
      useGameList(): GameInfo[] {
        const [gameList, setGameList] = useState<GameInfo[]>([]);

        useEffect(() => {
          const listener = () => {
            setGameList(Object.values(gameInfos));
          };

          listener();
          infoUpdateListeners.push(listener);

          return () => {
            infoUpdateListeners.splice(infoUpdateListeners.indexOf(listener), 1);
          };
        }, []);

        return gameList;
      },
      async startGameWith(clientId) {
        const info = await sdk.conn.call<GameInfo>(`${clientId}::onlinechess::startGame`, [{
          opponentClientId: myId,
          opponentName: myName,
        }]);
        gameInfos[info.gameId] = info;
        onInfoUpdated();
        await saveGameInfos(gameInfos);
      },
      async doMove(gameId, moveIn) {
        const parsedMove = JSON.parse(moveIn);
        const move = {
          from: parsedMove[0],
          to: parsedMove[1],
          promotion: "q",
        };
        const info = gameInfos[gameId];
        if (info.hostClientId === myId) {
          applyMove("w", info, move);
          sdk.conn.call<void>(`${info.opponentClientId}::onlinechess::updateListener`, [info]).then(() => {
            console.log(`[Chess Server Service]: successfully notified host of successful move!`);
          });
          await saveGameInfos(gameInfos);
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
