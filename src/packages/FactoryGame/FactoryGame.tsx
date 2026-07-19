import { useEffect, useMemo, useRef, useState } from "react";

interface ItemType {
  name: string;
  buyPrice?: number;
  sellPrice?: number;
}

interface MachineSetting {
  name: string;
  ticks: number;
  input: Record<string, number>;
  output: Record<string, number>;
}

interface MachineType {
  name: string;
  cost: Record<string, number>;
  settings: MachineSetting[];
}

interface Machine {
  type: MachineType;
  enabled: boolean;
  setting: string | null;
  ticksUntilDone: number;
}

interface OrderType {
  items: Record<string, number>;
  ticks: number;
  extraReward: number;
}

interface Order {
  type: OrderType;
  remainingTicks: number;
}

class Game {
  private static readonly ITEM_TYPES: Record<string, ItemType> = {
    "apple": { name: "apple", buyPrice: 20 },
    "orange": { name: "orange", buyPrice: 20 },
    "banana": { name: "banana", buyPrice: 20 },
    "kiwi": { name: "kiwi", buyPrice: 20 },
    "fruit salad": {
      name: "fruit salad",
      sellPrice: 140,
    },
    "machine part": {
      name: "machine part",
      buyPrice: 50,
    },
  };

  private static readonly MACHINE_TYPES: Record<string, MachineType> = {
    "salad maker": {
      name: "salad maker",
      cost: {
        "machine part": 3,
      },
      settings: [
        {
          name: "make fruit salad",
          ticks: 250,
          input: { "apple": 2, "orange": 2, "banana": 2, "kiwi": 1 },
          output: {
            "fruit salad": 1,
          },
        },
      ],
    },
  };

  private static readonly ORDER_TYPES: OrderType[] = [
    {
      items: {
        "fruit salad": 1,
      },
      ticks: 5000,
      extraReward: 10,
    },
  ];

  // TODO: scale with difficultiy
  private static readonly ORDER_TIME = 3_000;

  private gold = 300;
  private readonly items: Partial<Record<string, number>> = {};
  private readonly machines: Machine[] = [];
  private readonly orders: Order[] = [];
  // we want an order right on game begin
  private nextOrderCounter = 0;

  constructor() {}

  tick() {
    for (const machine of this.machines) {
      if (machine.setting === null || !machine.enabled) continue;
      machine.ticksUntilDone -= 1;
      if (machine.ticksUntilDone <= 0) {
        const setting = machine.type.settings.find(s => s.name === machine.setting)!;
        machine.ticksUntilDone = setting.ticks;

        const input = Object.entries(setting.input);
        const output = Object.entries(setting.output);

        const canProduce = input.map(([name, amt]) => (this.items[name] ?? 0) >= amt).reduce(
          (acc, cur) => acc && cur,
          true,
        );

        if (canProduce) {
          input.forEach(([name, amt]) => {
            this.items[name] ??= 0;
            this.items[name] -= amt;
          });
          output.forEach(([name, amt]) => {
            this.items[name] ??= 0;
            this.items[name] += amt;
          });
        }
      }
    }

    for (const order of this.orders) {
      order.remainingTicks -= 1;

      if (order.remainingTicks <= 0) {
        const i = this.orders.findIndex(o => o === order);
        if (i === -1) continue;
        this.orders.splice(i, 1);
      }
    }

    this.nextOrderCounter--;
    if (this.nextOrderCounter <= 0) {
      // TODO: appropriate difficulty
      const type = Game.ORDER_TYPES[Math.floor(Math.random() * Game.ORDER_TYPES.length)];
      this.createOrder(type);
      this.nextOrderCounter = Game.ORDER_TIME;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drawText(
      ctx,
      `
        Gold: ${this.gold}
        Items: ${JSON.stringify(this.items, undefined, 4)}
        Machines: ${JSON.stringify(this.machines, undefined, 4)}
        Orders: ${JSON.stringify(this.orders, undefined, 4)}
      `.trim().split("\n").map(l => l.trim()).join("\n"),
      0,
      0,
    );
  }

  onMouseDown(pos: [number, number]) {
    console.log("down:", pos);
  }

  onMouseUp(pos: [number, number]) {
    console.log("up:", pos);
  }

  getUI() {
    const game = this;

    const formatObject = (o: Record<string, any>) => Object.entries(o).map(([k, v]) => `${v} ${k}`).join(", ");

    function MachineComponent({ m }: { m: Machine }) {
      return (
        <div>
          {m.type.name}
          <br />
          Enabled: {m.enabled ? "yes" : "no"}
          <br />
          <button onClick={() => m.enabled = !m.enabled}>Toggle</button>
          <br />
          Settings:
          <br />
          <button onClick={() => m.setting = null}>select none</button>
          <br />
          {m.type.settings.map(s => (
            <div key={s.name}>
              {s.name} ({formatObject(s.input)} {"-->"} {formatObject(s.output)}) ({s.ticks}{" "}
              ticks){m.setting === s.name && <>{" "}(enabled)</>}
              <button
                onClick={() => {
                  m.setting = s.name;
                  m.ticksUntilDone = s.ticks;
                }}
              >
                select
              </button>
            </div>
          ))}
        </div>
      );
    }

    function OrderComponent({ o }: { o: Order }) {
      function fulfill() {
        game.fulfillOrder(o);
      }

      function dismiss() {
        const i = game.orders.findIndex(o2 => o2 === o);
        if (i === -1) return;
        game.orders.splice(i, 1);
      }

      return (
        <div>
          order, {formatObject(o.type.items)}, {o.remainingTicks}/{o.type.ticks}, +{game.getOrderProfit(o.type)}{" "}
          gold<br />
          <button onClick={fulfill}>Fulfill</button>
          <button onClick={dismiss}>Dismiss</button>
        </div>
      );
    }

    // TODO: rerender on every tick
    return function UI() {
      return (
        <div style={{ position: "absolute", bottom: "0", right: "0", width: "20%", height: "90%" }}>
          Buy items:
          {Object.values(Game.ITEM_TYPES).filter(t => t.buyPrice !== undefined).map(t => (
            <button
              key={t.name}
              onClick={() => game.buyItem(t.name)}
            >
              {t.name} ({t.buyPrice})
            </button>
          ))}
          Buy machines:
          {Object.values(Game.MACHINE_TYPES).map(t => (
            <button key={t.name} onClick={() => game.buyMachine(t.name)}>
              {t.name} ({formatObject(t.cost)})
            </button>
          ))}
          Manage machines:
          {game.machines.map(m => <MachineComponent m={m} />)}
          <br />
          Orders:
          <br />
          {game.orders.map(o => <OrderComponent o={o} />)}
        </div>
      );
    };
  }

  private createOrder(type: OrderType) {
    this.orders.push({ type, remainingTicks: type.ticks });
  }

  private fulfillOrder(order: Order) {
    const i = this.orders.findIndex(o2 => o2 === order);
    if (i === -1) return;

    const cost = Object.entries(order.type.items);

    const canFulfill = cost.map(([name, amt]) => (this.items[name] ?? 0) >= amt).reduce((acc, cur) => acc && cur, true);
    if (!canFulfill) return;

    cost.forEach(([name, amt]) => {
      this.items[name] ??= 0;
      this.items[name] -= amt;
    });
    this.gold += this.getOrderProfit(order.type);
    this.orders.splice(i, 1);
  }

  private getOrderProfit(order: OrderType): number {
    let price = order.extraReward;

    Object.entries(order.items).forEach(([name, amount]) => {
      const type = Game.ITEM_TYPES[name];
      if (!type || type.sellPrice === undefined) return;
      price += type.sellPrice * (amount ?? 0);
    });

    return price;
  }

  private buyItem(name: string) {
    const type = Game.ITEM_TYPES[name];
    if (!type || type.buyPrice === undefined) return;
    if (this.gold < type.buyPrice) return;
    this.gold -= type.buyPrice;
    this.items[name] ??= 0;
    this.items[name]++;
  }

  private buyMachine(name: string) {
    const type = Game.MACHINE_TYPES[name];
    if (!type) return;
    const cost = Object.entries(type.cost);
    const canPurchase = cost.map(([name, amt]) => (this.items[name] ?? 0) >= amt).reduce(
      (acc, cur) => acc && cur,
      true,
    );
    if (!canPurchase) return;
    cost.forEach(([name, amt]) => {
      this.items[name] ??= 0;
      this.items[name] -= amt;
    });
    this.machines.push({ type, enabled: false, setting: null, ticksUntilDone: -1 });
  }

  private drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, centered = false) {
    const LINE_HEIGHT = 14;

    ctx.fillStyle = "#000000";
    ctx.font = "12px sans-serif";
    ctx.textAlign = centered ? "center" : "start";

    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + (i + 1.5) * LINE_HEIGHT);
  }
}

export default function FactoryGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [game, setGame] = useState(() => new Game());
  const GameUI = useMemo(() => game.getUI(), [game]);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");

    let canceled = false;

    function frame() {
      if (!canceled) requestAnimationFrame(frame);
      else return;
      if (!ctx) return;

      setTick(t => t + 1);
      game.tick();

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      game.draw(ctx);
    }

    frame();

    return () => {
      canceled = true;
    };
  }, [game]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
        width={canvasRef.current?.clientWidth}
        height={canvasRef.current?.clientHeight}
        onMouseDown={e => game.onMouseDown([e.nativeEvent.offsetX, e.nativeEvent.offsetY])}
        onMouseUp={e => game.onMouseUp([e.nativeEvent.offsetX, e.nativeEvent.offsetY])}
      />
      <GameUI />
      {import.meta.env.DEV && (
        <button
          onClick={() => setGame(new Game())}
          children={<>Reset game</>}
          style={{ position: "absolute", bottom: "0", right: "0", margin: "10px", opacity: "60%" }}
        />
      )}
    </div>
  );
}
