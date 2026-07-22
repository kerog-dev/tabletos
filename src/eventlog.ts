import { useEffect, useState } from "react";
import type { Sdk } from "./sdk.ts";
import { Urgency } from "./toast.tsx";
import { compress, decompress, randomId } from "./utils.ts";

export enum EventUrgency {
  Debug,
  Info,
  Warning,
  Error,
  Critical,
}

export interface Event {
  id: string;
  namespace: string;
  title: string;
  description: string | null;
  urgency: EventUrgency;
  timestamp: number;
}

type EncodedEvent = [string, string, string, string | null, number, number];

interface JSONEncoding {
  createdAt: number;
  events: EncodedEvent[];
}

class EventLog {
  private readonly events: Event[] = [];
  private createdAt: number = Date.now();
  private saveDebounceId: any | null = null;

  private readonly updateListeners: (() => void)[] = [];

  constructor() {
    this.loadEvents();
  }

  private async loadEvents() {
    await (window as any).$ready;
    const { fs, toast }: Sdk = (window as any).$;

    try {
      if (!await fs.pathExists("/eventlog.json.gz")) return;
      const blob = await fs.readBlobFile("/eventlog.json.gz");
      const shouldArchive = blob.size > 1024 * 1024 * 20;
      const decompressed = await decompress(blob);
      const text = (new TextDecoder()).decode(await decompressed.arrayBuffer());
      const json: JSONEncoding = JSON.parse(text);
      if (!(json.events instanceof Array) || typeof json.createdAt !== "number") throw "Bad event log file!";
      this.createdAt = json.createdAt;
      this.events.push(...json.events.map(e => this.decodeEvent(e)));
      if (shouldArchive) await this.archive();
    } catch (e) {
      toast({ title: "Error loading event log", desc: String(e), urgency: Urgency.Error });
    }
  }

  private async saveEvents() {
    await (window as any).$ready;
    const { fs, toast }: Sdk = (window as any).$;

    try {
      const data: JSONEncoding = {
        createdAt: this.createdAt,
        events: this.events.map(e => this.encodeEvent(e)),
      };
      const text = JSON.stringify(data);
      const blob = await compress(new Blob([text], { type: "text/json" }));
      await fs.writeFile("/eventlog.json.gz", blob);
    } catch (e) {
      toast({ title: "Error saving event log", desc: String(e), urgency: Urgency.Error });
    }
  }

  private async archive() {
    await (window as any).$ready;
    const { fs, toast }: Sdk = (window as any).$;

    try {
      await fs.move("/eventlog.json.gz", `/eventlog-${Date.now()}.json.gz.ar`);
      const keep = 500;
      this.events.splice(0, this.events.length - keep);
      this.createdAt = Date.now();
    } catch (e) {
      toast({ title: "Error archiving event log", desc: String(e), urgency: Urgency.Error });
    }
  }

  private decodeEvent(e: EncodedEvent): Event {
    return {
      id: e[0],
      namespace: e[1],
      title: e[2],
      description: e[3],
      urgency: e[4],
      timestamp: e[5] + this.createdAt,
    };
  }

  private encodeEvent(e: Event): EncodedEvent {
    return [e.id, e.namespace, e.title, e.description, e.urgency, e.timestamp - this.createdAt];
  }

  private debouncedSave() {
    // TODO: fix multiple at once
    if (this.saveDebounceId) clearTimeout(this.saveDebounceId);
    this.saveDebounceId = setTimeout(() => this.saveEvents(), 2000);
  }

  private addEvent(event: Event) {
    this.events.push(event);
    this.debouncedSave();
    this.updateListeners.forEach(l => l());
  }

  add(namespace: string, title: string, urgency: EventUrgency, description?: string) {
    const event: Event = {
      id: randomId(8),
      namespace,
      title,
      description: description ?? null,
      urgency,
      timestamp: Date.now(),
    };
    this.addEvent(event);
  }

  getEvents(): Event[] {
    return this.events;
  }

  useEvents(): Event[] {
    const [events, setEvents] = useState(() => [...this.events]);

    useEffect(() => {
      const listener = () => {
        setEvents([...this.events]);
      };

      this.updateListeners.push(listener);
      return () => {
        const i = this.updateListeners.findIndex(l => l === listener);
        if (i === -1) return;
        this.updateListeners.splice(i, 1);
      };
    }, []);

    return events;
  }
}

const eventlog = new EventLog();

export { eventlog };
