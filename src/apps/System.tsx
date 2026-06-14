import { exportJSON, importJSON } from "../storage.ts";

export default function System() {
  function clearStorage() {
    localStorage.setItem("tabletos", "{}");
  }

  function doExport() {
    const data = exportJSON();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tabletos_data.json";
    a.click();
  }

  function doImport() {
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
  }

  return (
    <div>
      system operations:<br />
      <button onClick={() => clearStorage()}>Clear storage</button>
      <div className="file-backup">
        File backup export/import
        <button
          onClick={doExport}
        >
          Export JSON
        </button>
        <button
          onClick={doImport}
        >
          Import JSON
        </button>
      </div>
    </div>
  );
}
