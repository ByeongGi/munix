/**
 * PropertyTypesSlice — vault scope frontmatter 속성 타입 (`.obsidian/types.json`).
 * (ADR-031 Phase B-δ: property-types-store 마이그레이션)
 *
 * IPC `loadPropertyTypes` / `savePropertyTypes` 는 backend ActiveVault 어댑터로
 * 자동 라우팅 (Phase A-5). 명시 vault_id 전달은 Phase B-ε 또는 D 에서.
 */

import type { StateCreator } from "zustand";

import { ipc } from "@/lib/ipc";
import { isPropertyType, type PropertyType } from "@/types/frontmatter";
import { resolvePropertyType } from "@/lib/property-type-resolve";

export type PropertyTypesStatus = "idle" | "loading" | "ready" | "error";

export interface PropertyTypesState {
  /** explicit 타입만 (`.obsidian/types.json` 'types' 객체). */
  types: Record<string, PropertyType>;
  status: PropertyTypesStatus;

  load: () => Promise<void>;
  setType: (field: string, type: PropertyType) => Promise<void>;
  removeType: (field: string) => Promise<void>;
  reload: () => Promise<void>;
  resolve: (field: string, value: unknown) => PropertyType;
}

export interface PropertyTypesSlice {
  propertyTypes: PropertyTypesState;
}

function filterKnownTypes(
  raw: Record<string, string>,
): Record<string, PropertyType> {
  const out: Record<string, PropertyType> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (isPropertyType(v)) out[k] = v;
  }
  return out;
}

function defaultPropertyTypesState(): PropertyTypesState {
  return {
    types: {},
    status: "idle",
    load: async () => {},
    setType: async () => {},
    removeType: async () => {},
    reload: async () => {},
    resolve: (field, value) => resolvePropertyType(field, value, undefined),
  };
}

export function defaultPropertyTypesSlice(): PropertyTypesSlice {
  return { propertyTypes: defaultPropertyTypesState() };
}

export const createPropertyTypesSlice: StateCreator<
  PropertyTypesSlice,
  [],
  [],
  PropertyTypesSlice
> = (set, get) => {
  const update = (patch: Partial<PropertyTypesState>) =>
    set((s) => ({ propertyTypes: { ...s.propertyTypes, ...patch } }));

  return {
    propertyTypes: {
      types: {},
      status: "idle",

      load: async () => {
        update({ status: "loading" });
        try {
          const raw = await ipc.loadPropertyTypes();
          update({ types: filterKnownTypes(raw), status: "ready" });
        } catch (e) {
          console.warn("[property-types] load failed:", e);
          update({ types: {}, status: "error" });
        }
      },

      setType: async (field, type) => {
        const prev = get().propertyTypes.types;
        const next = { ...prev, [field]: type };
        update({ types: next });
        try {
          await ipc.savePropertyTypes(next);
        } catch (e) {
          console.warn("[property-types] save failed, rolling back:", e);
          update({ types: prev });
        }
      },

      removeType: async (field) => {
        const prev = get().propertyTypes.types;
        if (!(field in prev)) return;
        const next = { ...prev };
        delete next[field];
        update({ types: next });
        try {
          await ipc.savePropertyTypes(next);
        } catch (e) {
          console.warn("[property-types] save failed, rolling back:", e);
          update({ types: prev });
        }
      },

      reload: async () => {
        try {
          const raw = await ipc.loadPropertyTypes();
          update({ types: filterKnownTypes(raw), status: "ready" });
        } catch (e) {
          console.warn("[property-types] reload failed:", e);
        }
      },

      resolve: (field, value) => {
        const explicit = get().propertyTypes.types[field];
        return resolvePropertyType(field, value, explicit);
      },
    },
  };
};
