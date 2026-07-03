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
  turn: string;
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

// on startup: get game info
// on updated: store updated
// always when data updated: notify open apps
// apps on open get all data

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

    function startGameBoards(gameInfos: Record<string, GameInfo>) {
      return Object.fromEntries(Object.entries(gameInfos).map(([k, v]) => [k, new Chess(v.fen)]));
    }

    async function saveGameInfos(gameInfos: Record<string, GameInfo>) {
      await sdk.fs.writeFile("/chess.json", JSON.stringify(gameInfos));
    }

    const myId = sdk.conn.name;
    const myName = myId + "--name";

    const gameInfos: Record<string, GameInfo> = await loadGameInfos();
    const gameBoards: Record<string, Chess> = startGameBoards(gameInfos);

    let infoUpdateListeners: (() => void)[] = [];

    const onInfoUpdated = () =>
      infoUpdateListeners.forEach(l => {
        try {
          l();
        } catch {}
      });

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
          turn: "w",
        };
        const board = new Chess(info.fen);
        gameInfos[info.gameId] = info;
        onInfoUpdated();
        gameBoards[info.gameId] = board;
        saveGameInfos(gameInfos);
        return info;
      },
      getGameInfo(gameId) {
        if (gameInfos[gameId]?.hostClientId !== myId) return null;
        return gameInfos[gameId] ?? null;
      },
      makeMove(gameId, move) {
        if (gameInfos[gameId]?.hostClientId !== myId) throw "Game doesn't exist or this server is not the host.";
        const info: GameInfo = gameInfos[gameId];
        if (info.turn === "w") return;
        gameBoards[gameId].move(move);
        info.fen = gameBoards[gameId].fen();
        info.turn = gameBoards[gameId].turn();
        onInfoUpdated();
        sdk.conn.proxyObject<OnlineChessServerObject>(info.opponentClientId, "onlinechess").then(server =>
          server.updateListener(info).then(() =>
            console.log(`[Chess Server Service]: successfully notified opponent of successful move!`)
          )
        );
        saveGameInfos(gameInfos);
      },
      updateListener(info) {
        gameInfos[info.gameId] = info;
        onInfoUpdated();
        saveGameInfos(gameInfos);
      },
    };

    sdk.conn.exposeObject(object, "onlinechess");

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
        const object = await sdk.conn.proxyObject<OnlineChessServerObject>(clientId, "onlinechess");
        const info = await object.startGame({ opponentClientId: myId, opponentName: myName });
        const board = new Chess(info.fen);
        gameInfos[info.gameId] = info;
        gameBoards[info.gameId] = board;
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
          if (info.turn === "b") return;
          gameBoards[gameId].move(move);
          info.fen = gameBoards[gameId].fen();
          info.turn = gameBoards[gameId].turn();
          onInfoUpdated();
          sdk.conn.proxyObject<OnlineChessServerObject>(info.opponentClientId, "onlinechess").then(server =>
            server.updateListener(info).then(() =>
              console.log(`[Chess Server Service]: successfully notified host of successful move!`)
            )
          );
          await saveGameInfos(gameInfos);
        } else {
          const object = await sdk.conn.proxyObject<OnlineChessServerObject>(info.hostClientId, "onlinechess");
          await object.makeMove(gameId, move);
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
