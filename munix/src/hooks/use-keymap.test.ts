import { describe, it, expect, vi } from "vitest";

// settings-store 가 모듈 로드 시 Tauri invoke 를 호출하므로 mock.
vi.mock("@/lib/ipc", () => ({
  ipc: {
    loadSettings: () => Promise.resolve("{}"),
    saveSettings: () => Promise.resolve(),
  },
}));

import { buildEffectiveKeymap, findConflicts } from "./use-keymap";
import { KEYMAP_REGISTRY } from "@/lib/keymap-registry";

describe("buildEffectiveKeymap", () => {
  it("returns defaults when no overrides", () => {
    const map = buildEffectiveKeymap({});
    for (const e of KEYMAP_REGISTRY) {
      expect(map.get(e.id)).toBe(e.defaultKey);
    }
  });

  it("applies single override", () => {
    const map = buildEffectiveKeymap({ "global.save": "mod+alt+s" });
    expect(map.get("global.save")).toBe("mod+alt+s");
  });

  it("normalizes override format", () => {
    const map = buildEffectiveKeymap({ "global.save": "Shift+Mod+S" });
    expect(map.get("global.save")).toBe("mod+shift+s");
  });

  it("falls back to default on unparseable override", () => {
    // 빈 문자열만 토큰 / modifier 만 있는 형태 → parse 실패 → default 로 폴백.
    const map = buildEffectiveKeymap({ "global.save": "mod+shift" });
    expect(map.get("global.save")).toBe("mod+s");
  });

  it("ignores unknown id", () => {
    // unknown id is simply absent from the result map (registry-only entries).
    const map = buildEffectiveKeymap({ "fake.id": "mod+x" });
    expect(map.has("fake.id")).toBe(false);
  });
});

describe("findConflicts", () => {
  it("no conflicts on defaults", () => {
    expect(findConflicts({})).toEqual([]);
  });

  it("detects user-introduced conflict", () => {
    // global.save 의 default 는 mod+s. global.newFile 을 mod+s 로 override 시키면
    // 두 entry 가 같은 키를 갖게 된다.
    const conflicts = findConflicts({ "global.newFile": "mod+s" });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.key).toBe("mod+s");
    expect(conflicts[0]?.ids.sort()).toEqual(
      ["global.newFile", "global.save"].sort(),
    );
  });

  it("does not flag conflict across scopes", () => {
    // editor.findInFile (mod+f) 과 global 의 임의 키를 mod+f 로 override 해도
    // scope 가 다르면 충돌로 보지 않음.
    const conflicts = findConflicts({ "global.save": "mod+f" });
    // global.save 만 mod+f 인 다른 global entry 와 충돌하면 잡힘. editor 와는 무관.
    const sameScope = conflicts.find((c) =>
      c.ids.every((id) => id.startsWith("global.")),
    );
    // 다른 global 이 mod+f 를 default 로 가지지 않으므로 충돌 없어야 함.
    expect(sameScope).toBeUndefined();
  });
});
