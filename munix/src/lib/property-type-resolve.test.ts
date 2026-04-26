import { describe, expect, it } from "vitest";
import { resolvePropertyType } from "./property-type-resolve";

describe("resolvePropertyType", () => {
  describe("explicit 우선", () => {
    it("explicit 'text' 이면 휴리스틱 무시하고 text", () => {
      expect(resolvePropertyType("tags", ["a"], "text")).toBe("text");
    });
    it("explicit 'number' 이면 boolean 값이라도 number", () => {
      expect(resolvePropertyType("foo", true, "number")).toBe("number");
    });
    it("explicit 'datetime' 이면 ISO date 라도 datetime", () => {
      expect(resolvePropertyType("foo", "2024-01-01", "datetime")).toBe(
        "datetime",
      );
    });
  });

  describe("키 이름 특수", () => {
    it("'tags' 키는 tags 반환", () => {
      expect(resolvePropertyType("tags", null, undefined)).toBe("tags");
    });
    it("'tag' (단수) 키도 tags 반환", () => {
      expect(resolvePropertyType("tag", null, undefined)).toBe("tags");
    });
    it("'aliases' 키는 aliases 반환", () => {
      expect(resolvePropertyType("aliases", null, undefined)).toBe("aliases");
    });
    it("'alias' (단수) 키도 aliases 반환", () => {
      expect(resolvePropertyType("alias", null, undefined)).toBe("aliases");
    });
    it("키 이름 특수가 typeof 보다 우선 (tags + boolean 값)", () => {
      // 사용자가 실수로 tags에 boolean 넣어도 multitext 위젯으로 보여야 함
      expect(resolvePropertyType("tags", true, undefined)).toBe("tags");
    });
  });

  describe("값 typeof", () => {
    it("boolean 값 → checkbox", () => {
      expect(resolvePropertyType("draft", false, undefined)).toBe("checkbox");
      expect(resolvePropertyType("published", true, undefined)).toBe(
        "checkbox",
      );
    });
    it("number 값 → number", () => {
      expect(resolvePropertyType("rating", 5, undefined)).toBe("number");
      expect(resolvePropertyType("count", 0, undefined)).toBe("number");
    });
    it("배열 값 → multitext (날짜 키 이름이 아닌 경우)", () => {
      expect(resolvePropertyType("categories", ["a", "b"], undefined)).toBe(
        "multitext",
      );
    });
    it("빈 배열도 multitext", () => {
      expect(resolvePropertyType("foo", [], undefined)).toBe("multitext");
    });
  });

  describe("키 이름 정규식 (날짜류)", () => {
    it("'created' 키 + ISO date 값 → date", () => {
      expect(resolvePropertyType("created", "2024-01-01", undefined)).toBe(
        "date",
      );
    });
    it("'updated' 키 + ISO datetime 값 → datetime", () => {
      expect(
        resolvePropertyType("updated", "2024-01-01T10:30:00", undefined),
      ).toBe("datetime");
    });
    it("'due' 키 + 빈 문자열 → date", () => {
      expect(resolvePropertyType("due", "", undefined)).toBe("date");
    });
    it("'modified' 키 + null → date", () => {
      expect(resolvePropertyType("modified", null, undefined)).toBe("date");
    });
    it("'PUBLISHED' 대소문자 무시", () => {
      expect(resolvePropertyType("PUBLISHED", "2024-01-01", undefined)).toBe(
        "date",
      );
    });
    it("'start' / 'end' 키도 date", () => {
      expect(resolvePropertyType("start", null, undefined)).toBe("date");
      expect(resolvePropertyType("end", null, undefined)).toBe("date");
    });
    it("'deadline' 키도 date", () => {
      expect(resolvePropertyType("deadline", null, undefined)).toBe("date");
    });
  });

  describe("값 모양 (ISO date / datetime)", () => {
    it("ISO date 문자열 + 비-날짜 키 → date", () => {
      expect(resolvePropertyType("foo", "2024-01-01", undefined)).toBe("date");
    });
    it("ISO datetime 문자열 + 비-날짜 키 → datetime", () => {
      expect(resolvePropertyType("foo", "2024-01-01T10:30:00", undefined)).toBe(
        "datetime",
      );
    });
    it("ISO datetime 일부 (T뒤 시각) → datetime", () => {
      expect(resolvePropertyType("foo", "2024-01-01T10:30", undefined)).toBe(
        "datetime",
      );
    });
    it("타임존 포함 ISO datetime → datetime", () => {
      expect(
        resolvePropertyType("foo", "2024-01-01T10:30:00+09:00", undefined),
      ).toBe("datetime");
    });
  });

  describe("fallback (text)", () => {
    it("일반 문자열 → text", () => {
      expect(resolvePropertyType("title", "hello", undefined)).toBe("text");
    });
    it("빈 문자열 → text", () => {
      expect(resolvePropertyType("foo", "", undefined)).toBe("text");
    });
    it("null → text", () => {
      expect(resolvePropertyType("foo", null, undefined)).toBe("text");
    });
    it("undefined → text", () => {
      expect(resolvePropertyType("foo", undefined, undefined)).toBe("text");
    });
    it("객체 (복합 YAML) → text — 표시는 readonly", () => {
      expect(resolvePropertyType("nested", { a: 1 }, undefined)).toBe("text");
    });
  });

  describe("엣지케이스", () => {
    it("키 이름이 빈 문자열 → 값 typeof 적용", () => {
      expect(resolvePropertyType("", true, undefined)).toBe("checkbox");
    });
    it("키 이름이 비-ASCII (한글)", () => {
      expect(resolvePropertyType("태그", null, undefined)).toBe("text");
    });
    it("'date' 정확 일치", () => {
      expect(resolvePropertyType("date", null, undefined)).toBe("date");
    });
    it("'datetime' 키는 정규식 미스매치 → text", () => {
      // DATE_KEY_RE 는 'datetime' 자체를 매칭하지 않음 (의도)
      // 사용자가 키 이름을 'datetime' 으로 짓는 경우는 드물고, 명시 explicit로 해결
      expect(resolvePropertyType("datetime", null, undefined)).toBe("text");
    });
  });
});
