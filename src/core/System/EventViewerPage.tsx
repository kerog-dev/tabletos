import { useMemo, useState } from "react";
import { useRouter } from "../../components/Router.tsx";
import { type Event, eventlog } from "../../eventlog.ts";
import { formatTime } from "../../utils.ts";

function EventComponent({ e }: { e: Event }) {
  // TODO
  return <>{e.id} {e.title} {e.description} {e.urgency} {formatTime(e.timestamp)}</>;
}

export function EventViewerPage() {
  const router = useRouter();
  const events = eventlog.useEvents();
  const namespaces = useMemo(() => {
    const namespaces = new Set<string>();
    events.forEach(e => namespaces.add(e.namespace));
    return [...namespaces.values()];
  }, [events]);
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const nsEvents = useMemo(() => events.filter(e => e.namespace === selectedNamespace), [selectedNamespace, events]);

  return (
    <div>
      <button onClick={() => router.navigate("Home")}>Back</button>
      <br />
      Namespaces:
      <br />
      {namespaces.map(n => (
        <button key={n} onClick={() => setSelectedNamespace(n)}>
          {n}
          {selectedNamespace === n ? " (selected)" : ""}
        </button>
      ))}
      <br />
      Events:
      <ul>
        {nsEvents.map(e => (
          <li key={e.id}>
            <EventComponent e={e} />
          </li>
        ))}
      </ul>
    </div>
  );
}
