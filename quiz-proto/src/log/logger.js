export function createLogger() {
  const lines = [];

  return {
    log(event) {
      lines.push(JSON.stringify(event));
    },
    reset() {
      lines.length = 0;
    },
    exportLines() {
      return lines.join("\n") + (lines.length ? "\n" : "");
    },
    getLines() {
      return [...lines];
    },
    count() {
      return lines.length;
    },
  };
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
