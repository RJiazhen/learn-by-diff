import path from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { decodeSnapshotUriPath, encodeSnapshotUriPath } from "../src/ui/snapshotUri.ts";

describe("snapshot diff URIs", () => {
  test("round-trips a POSIX snapshot path", () => {
    const fsPath = "/tmp/learn/.learn/snapshots/glow/from/main.js";
    expect(decodeSnapshotUriPath(encodeSnapshotUriPath(fsPath))).toBe(path.normalize(fsPath));
  });

  test("decodes a Windows drive path encoded with a leading slash", () => {
    expect(decodeSnapshotUriPath("/C:/learn/.learn/snapshots/glow/to/main.js")).toBe(
      path.normalize("C:/learn/.learn/snapshots/glow/to/main.js"),
    );
  });
});
