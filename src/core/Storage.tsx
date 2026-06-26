import storage from "../lib/storage.ts";

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
    let nodeValueStr = nodeValue.toString();
    if (nodeValueStr.length > 50) nodeValueStr = nodeValueStr.slice(0, 50) + "...";
    return (
      <span>
        {nodeKey} ({nodePath}): {nodeValueStr} (
        <button onClick={() => deleteNode(nodePath)}>Delete</button>)
      </span>
    );
  }
  return (
    <>
      <span>
        {nodeKey} (<button onClick={() => deleteNode(nodePath)}>Delete</button>)
      </span>
      <ul>
        {Object.entries(nodeValue).map(([childKey, childValue]) => (
          <li key={childKey}>
            <StorageExplorerNode
              nodeKey={childKey}
              nodeValue={childValue}
              nodePath={`${nodePath}/${childKey}`}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Storage() {
  return (
    <div id="storage-explorer">
      <StorageExplorerNode
        nodeKey="<root>"
        nodeValue={storage}
        nodePath="<root>"
      />
    </div>
  );
}
