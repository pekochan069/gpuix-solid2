import assert from "node:assert/strict";

import { createRoot } from "gpuix-solid2";
import type { HostElement, NativeRenderer } from "gpuix-solid2";
import {
  createButton,
  createCheckbox,
  createCheckboxGroup,
  createCheckboxGroupItem,
  createDisclosure,
  createKeyboard,
  createLocale,
  createMenu,
  createMenuItem,
  createNumberField,
  createSearchField,
  createTab,
  createTabList,
  createTabPanel,
  createToggleButtonGroup,
  createToggleButtonGroupItem,
} from "gpuix-solid2-aria";
import {
  createCheckboxGroupState,
  createDisclosureState,
  createNumberFieldState,
  createSearchFieldState,
  createTabListState,
  createToggleState,
  createToggleGroupState,
  createTreeState,
  Item,
} from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { merge } from "solid-js";

for (const name of ["window", "document", "navigator", "HTMLElement"]) {
  Reflect.deleteProperty(globalThis, name);
  assert.equal(name in globalThis, false);
}

assert.throws(() => import.meta.resolve("@solidjs/web"));

assert.throws(() => import.meta.resolve("@solid2-aria/core"));

let check!: HostElement;
let button!: HostElement;
let groupItem!: HostElement;
let toggleGroup!: HostElement;
let toggleItem!: HostElement;
let disclosureTrigger!: HostElement;
let tabList!: HostElement;
let tabPanel!: HostElement;
let searchInput!: HostElement;
let clearSearch!: HostElement;
let numberInput!: HostElement;
let increaseNumber!: HostElement;
let menu!: HostElement;
let menuItem!: HostElement;
let menuActions = 0;
const tabNodes = new Map<number, HostElement>();
let selected = () => false;
let count = 0;
let key = "";
const renderer: NativeRenderer = { applyBatch: () => [] };
const app = createRoot(renderer);

try {
  app.render(() => {
    const state = createToggleState();

    const menuState = createTreeState({
      children: (entry: { id: number }) =>
        Item({
          children: "Native action",
          key: entry.id,
          textValue: "Native action",
        }),
      items: [{ id: 0 }],
      selectionMode: "single",
    });

    const nativeMenu = createMenu(
      {
        "aria-label": "Actions",
        onAction: () => {
          menuActions += 1;
        },
      },
      menuState,
      () => menu
    );

    const nativeMenuItem = createMenuItem(
      { key: 0 },
      menuState,
      () => menuItem
    );

    const number = createNumberField(
      { "aria-label": "Amount" },
      createNumberFieldState({ defaultValue: 1.5, locale: "de-DE", step: 0.5 }),
      () => numberInput
    );

    const increase = createButton(
      number.incrementButtonProps,
      () => increaseNumber
    );

    const disclosure = createDisclosure(
      {},
      createDisclosureState({}),
      () => disclosureTrigger
    );

    const checkbox = createCheckbox(
      { "aria-label": "Accept" },
      state,
      () => check
    );

    const press = createButton(
      {
        onPress: () => {
          count += 1;
        },
      },
      () => button
    );

    const keyboard = createKeyboard({
      onKeyDown: (event) => {
        key = event.key ?? "";
      },
    });

    selected = () => state.isSelected;
    assert.equal(createLocale().locale, "en-US");
    const groupState = createCheckboxGroupState({ defaultValue: ["news"] });
    const group = createCheckboxGroup({ "aria-label": "Topics" }, groupState);

    const item = createCheckboxGroupItem(
      { value: "news" },
      groupState,
      () => groupItem
    );

    const toggleGroupState = createToggleGroupState({
      defaultSelectedKeys: [1],
    });

    const toggles = createToggleButtonGroup(
      { "aria-label": "Alignment" },
      toggleGroupState,
      () => toggleGroup
    );

    const toggle = createToggleButtonGroupItem(
      { id: 1 },
      toggleGroupState,
      () => toggleItem
    );

    const tabState = createTabListState({
      children: (entry: { id: number }) =>
        Item({
          children: String(entry.id),
          key: entry.id,
          textValue: String(entry.id),
        }),
      items: [{ id: 0 }, { id: 1 }],
    });

    const tabs = createTabList({}, tabState, () => tabList);
    const panel = createTabPanel({}, tabState);

    const search = createSearchField(
      { "aria-label": "Search" },
      createSearchFieldState({ defaultValue: "query" }),
      () => searchInput
    );

    const clear = createButton(search.clearButtonProps, () => clearSearch);

    return [
      jsx(
        "div",
        merge(nativeMenu.menuProps, {
          children: jsx(
            "div",
            merge(nativeMenuItem.menuItemProps, {
              ref: (node: HostElement) => {
                menuItem = node;
              },
            })
          ),
          ref: (node: HostElement) => {
            menu = node;
          },
        })
      ),
      jsx(
        "input",
        merge(number.inputProps, {
          ref: (node: HostElement) => {
            numberInput = node;
          },
        })
      ),
      jsx(
        "div",
        merge(increase.buttonProps, {
          ref: (node: HostElement) => {
            increaseNumber = node;
          },
        })
      ),
      jsx(
        "input",
        merge(search.inputProps, {
          ref: (node: HostElement) => {
            searchInput = node;
          },
        })
      ),
      jsx(
        "div",
        merge(clear.buttonProps, {
          ref: (node: HostElement) => {
            clearSearch = node;
          },
        })
      ),
      jsx(
        "div",
        merge(tabs.tabListProps, {
          children: [0, 1].map((tabKey) => {
            const tab = createTab(
              { key: tabKey },
              tabState,
              () => tabNodes.get(tabKey) ?? null
            );

            return jsx(
              "div",
              merge(tab.tabProps, {
                ref: (node: HostElement) => {
                  tabNodes.set(tabKey, node);
                },
              })
            );
          }),
          ref: (node: HostElement) => {
            tabList = node;
          },
        })
      ),
      jsx(
        "div",
        merge(panel.tabPanelProps, {
          ref: (node: HostElement) => {
            tabPanel = node;
          },
        })
      ),
      jsx(
        "div",
        merge(disclosure.buttonProps, {
          ref: (node: HostElement) => {
            disclosureTrigger = node;
          },
        })
      ),
      jsx(
        "div",
        merge(toggles.groupProps, {
          children: jsx(
            "div",
            merge(toggle.buttonProps, {
              ref: (node: HostElement) => {
                toggleItem = node;
              },
            })
          ),
          ref: (node: HostElement) => {
            toggleGroup = node;
          },
        })
      ),
      jsx(
        "div",
        merge(group.groupProps, {
          children: jsx(
            "div",
            merge(item.inputProps, {
              ref: (node: HostElement) => {
                groupItem = node;
              },
            })
          ),
        })
      ),
      jsx(
        "div",
        merge(checkbox.inputProps, {
          ref: (node: HostElement) => {
            check = node;
          },
        })
      ),
      jsx(
        "div",
        merge(press.buttonProps, keyboard.keyboardProps, {
          ref: (node: HostElement) => {
            button = node;
          },
        })
      ),
    ];
  });
  app.dispatch({ elementId: check.id, eventType: "keyDown", key: "space" });
  app.dispatch({ elementId: check.id, eventType: "keyUp", key: "space" });
  assert.equal(selected(), true);
  assert.equal(numberInput.props.get("value"), "1,5");
  app.dispatch({ elementId: numberInput.id, eventType: "keyDown", key: "up" });
  assert.equal(numberInput.props.get("value"), "2");
  app.dispatch({ elementId: increaseNumber.id, eventType: "click" });
  assert.equal(numberInput.props.get("value"), "2,5");
  app.dispatch({
    elementId: numberInput.id,
    eventType: "change",
    value: "3,7",
  });
  app.dispatch({ elementId: numberInput.id, eventType: "submit" });
  assert.equal(numberInput.props.get("value"), "3,5");
  assert.equal(check.props.get("aria-checked"), true);
  app.dispatch({ elementId: button.id, eventType: "click" });
  assert.equal(count, 1);
  app.dispatch({ elementId: button.id, eventType: "keyDown", key: "down" });
  assert.equal(key, "ArrowDown");
  assert.equal(groupItem.props.get("aria-checked"), true);
  app.dispatch({ elementId: groupItem.id, eventType: "keyDown", key: "space" });
  app.dispatch({ elementId: groupItem.id, eventType: "keyUp", key: "space" });
  assert.equal(groupItem.props.get("aria-checked"), false);
  assert.equal(toggleGroup.props.get("role"), "radiogroup");
  assert.equal(toggleItem.props.get("aria-checked"), true);
  app.dispatch({
    elementId: toggleItem.id,
    eventType: "keyDown",
    key: "enter",
  });
  app.dispatch({ elementId: toggleItem.id, eventType: "keyUp", key: "enter" });
  assert.equal(toggleItem.props.get("aria-checked"), false);
  app.dispatch({
    elementId: disclosureTrigger.id,
    eventType: "keyDown",
    key: "space",
  });
  assert.equal(disclosureTrigger.props.get("aria-expanded"), true);
  app.dispatch({
    elementId: disclosureTrigger.id,
    eventType: "keyUp",
    key: "space",
  });
  app.dispatch({ elementId: disclosureTrigger.id, eventType: "click" });
  assert.equal(disclosureTrigger.props.get("aria-expanded"), false);
  const firstTab = tabNodes.get(0);
  const secondTab = tabNodes.get(1);
  assert.ok(firstTab && secondTab);
  assert.equal(firstTab.props.get("aria-selected"), true);
  app.dispatch({ elementId: firstTab.id, eventType: "keyDown", key: "right" });
  assert.equal(secondTab.props.get("aria-selected"), true);
  assert.equal(
    tabPanel.props.get("aria-id"),
    secondTab.props.get("aria-controls")
  );
  assert.equal(
    tabPanel.props.get("aria-labelledby"),
    secondTab.props.get("aria-id")
  );
  assert.equal(searchInput.props.get("role"), "searchbox");
  app.dispatch({
    elementId: searchInput.id,
    eventType: "change",
    value: "native",
  });
  assert.equal(searchInput.props.get("value"), "native");
  app.dispatch({
    elementId: searchInput.id,
    eventType: "keyDown",
    key: "escape",
  });
  assert.equal(searchInput.props.get("value"), "");
  app.dispatch({ elementId: menuItem.id, eventType: "keyDown", key: "space" });
  assert.equal(menuItem.props.get("aria-checked"), true);
  app.dispatch({ elementId: menuItem.id, eventType: "keyUp", key: "space" });
  assert.equal(menuActions, 1);
  app.dispatch({ elementId: menuItem.id, eventType: "click" });
  assert.equal(menuItem.props.get("aria-checked"), false);
  assert.equal(menuActions, 2);
  assert.equal(menu.props.get("role"), "menu");
  app.dispatch({
    elementId: searchInput.id,
    eventType: "change",
    value: "clear",
  });
  app.dispatch({ elementId: clearSearch.id, eventType: "click" });
  assert.equal(searchInput.props.get("value"), "");
  console.log(
    "Compiled native consumer passed without browser globals, @solidjs/web, or upstream SSR."
  );
} finally {
  app.unmount();
}
