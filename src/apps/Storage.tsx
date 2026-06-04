import storage, { exportJSON, importJSON } from "../storage.ts";

function deleteNode(path: string) {
  const keys = path.split("/").slice(1);
  let current = storage;
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }
  delete current[keys[keys.length - 1]];
}

function StorageExplorerNode({
  nodeKey,
  nodeValue,
  nodePath,
}: {
  nodeKey: string;
  nodeValue: any;
  nodePath: string;
}) {
  if (typeof nodeValue !== "object") {
    let nodeValueStr = nodeValue.toString()
    if (nodeValueStr.length > 50) nodeValueStr = nodeValueStr.slice(0, 50) + '...'
    return (
      <li>
        {nodeKey} ({nodePath}): {nodeValueStr} (
        <button onClick={() => deleteNode(nodePath)}>Delete</button>)
      </li>
    );
  }
  return (
    <li>
      <span>
        {nodeKey} (<button onClick={() => deleteNode(nodePath)}>Delete</button>)
      </span>
      <ul>
        {Object.entries(nodeValue).map(([childKey, childValue]) => (
          <li key={childKey}>
            <ul>
              <StorageExplorerNode
                nodeKey={childKey}
                nodeValue={childValue}
                nodePath={`${nodePath}/${childKey}`}
              />
            </ul>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function Storage() {
  return (
    <div>
      <div className="file-backup">
        <button
          onClick={() => {
            const data = exportJSON();
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "tabletos_data.json";
            a.click();
          }}
        >
          Export JSON
        </button>
        <button
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const data = e.target?.result as string;
                  if (
                    confirm(
                      "Are you sure you want to import this file? This will overwrite your current data.",
                    )
                  ) {
                    importJSON(data);
                  }
                };
                reader.readAsText(file);
              }
            };
            input.click();
          }}
        >
          Import JSON
        </button>
      </div>
      <ul id="storage-explorer">
        <StorageExplorerNode
          nodeKey="<root>"
          nodeValue={storage}
          nodePath="<root>"
        />
      </ul>
    </div>
  );
}
