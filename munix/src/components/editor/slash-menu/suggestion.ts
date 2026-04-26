import { ReactRenderer } from "@tiptap/react";
import type { Editor, Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { exitSuggestion } from "@tiptap/suggestion";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import i18next from "i18next";
import { filterSlashItems, getSlashItems, type SlashItem } from "./commands";
import { SlashMenuList, type SlashMenuListHandle } from "./slash-menu-list";

export interface SlashCommandProps {
  editor: Editor;
  range: Range;
}

const slashPluginKey = new PluginKey("slashSuggestion");

/**
 * `editor` namespace 의 키를 i18next 싱글턴으로 즉시 해석.
 *
 * 모듈 레벨 상수 (`slashSuggestion`) 안에서 t 함수를 안전하게 호출하기 위해
 * react-i18next 의 hook 을 거치지 않고 i18next.t 를 직접 사용한다.
 * 언어가 바뀌면 다음 슬래시 호출부터 새 언어로 표시 — 이미 띄워둔 메뉴는
 * 언어 변경 시 자동 갱신되지는 않지만 (드물게 발생) 다음 호출부터 정상 동작한다.
 */
function tEditor(key: string): string {
  return i18next.t(key, { ns: "editor" }) as string;
}

export const slashSuggestion: Omit<
  SuggestionOptions<SlashItem, SlashCommandProps>,
  "editor"
> = {
  char: "/",
  allowSpaces: false,
  startOfLine: false,
  pluginKey: slashPluginKey,

  items: ({ query }) => {
    // 호출 시점마다 i18next.t 로 새 items 생성 — 언어가 바뀐 후에도 정확.
    const all = getSlashItems(tEditor);
    return filterSlashItems(all, query, tEditor).slice(0, 10);
  },

  command: ({ editor, range, props }) => {
    const item = props as unknown as SlashItem;
    item.run({ editor, range });
  },

  render: () => {
    let component: ReactRenderer<SlashMenuListHandle> | null = null;
    let popup: TippyInstance[] = [];
    let removeOutsidePointerDown: (() => void) | null = null;

    const cleanupOutsidePointerDown = () => {
      removeOutsidePointerDown?.();
      removeOutsidePointerDown = null;
    };

    return {
      onStart: (props: SuggestionProps<SlashItem, SlashCommandProps>) => {
        component = new ReactRenderer(SlashMenuList, {
          props: {
            items: props.items,
            command: (item: SlashItem) =>
              props.command(item as unknown as SlashCommandProps),
          },
          editor: props.editor,
        });
        if (!props.clientRect) return;
        popup = tippy("body", {
          getReferenceClientRect: () => {
            const rect = props.clientRect?.();
            return rect ?? new DOMRect();
          },
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          hideOnClick: false,
          placement: "bottom-start",
        });

        const doc = props.editor.view.dom.ownerDocument;
        const onPointerDown = (event: PointerEvent) => {
          const target = event.target as Node | null;
          if (!target) return;
          if (component?.element.contains(target)) return;
          if (props.editor.view.dom.contains(target)) return;
          exitSuggestion(props.editor.view, slashPluginKey);
        };

        doc.addEventListener("pointerdown", onPointerDown, true);
        removeOutsidePointerDown = () => {
          doc.removeEventListener("pointerdown", onPointerDown, true);
        };
      },

      onUpdate(props: SuggestionProps<SlashItem, SlashCommandProps>) {
        component?.updateProps({
          items: props.items,
          command: (item: SlashItem) =>
            props.command(item as unknown as SlashCommandProps),
        });
        if (!props.clientRect) return;
        popup[0]?.setProps({
          getReferenceClientRect: () => {
            const rect = props.clientRect?.();
            return rect ?? new DOMRect();
          },
        });
      },

      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup[0]?.hide();
          return true;
        }
        return component?.ref?.onKeyDown({ event: props.event }) ?? false;
      },

      onExit() {
        cleanupOutsidePointerDown();
        popup[0]?.destroy();
        component?.destroy();
        component = null;
        popup = [];
      },
    };
  },
};
