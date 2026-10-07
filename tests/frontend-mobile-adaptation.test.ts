import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { mobileNavigationScript } from "../src/frontend/scripts/mobile-navigation";
import { navigationScript } from "../src/frontend/scripts/navigation";

/** A minimal anonymous DOM tree that delivers the same cancelable event from
 * its target through each ancestor. Both production scripts share this tree;
 * isolated handler tests cannot detect a submenu Escape reaching the masthead.
 */
function navigationTree() {
  type TestEvent = {
    key?: string;
    target: TestNode;
    defaultPrevented: boolean;
    preventDefault(): void;
  };
  type Handler = (event: TestEvent) => void;
  let focused: TestNode | null = null;

  class TestNode {
    parent: TestNode | null = null;
    readonly handlers = new Map<string, Handler[]>();
    readonly attributes = new Map<string, string>();
    readonly selectors = new Map<string, TestNode[]>();
    readonly classes = new Set<string>();
    readonly classList = { add: (value: string) => this.classes.add(value) };
    readonly focus = vi.fn(() => { focused = this; });
    hidden = true;
    open = false;
    href = "";

    constructor(parent: TestNode | null = null) { this.parent = parent; }
    addEventListener(name: string, handler: Handler) {
      this.handlers.set(name, [...this.handlers.get(name) ?? [], handler]);
    }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    hasAttribute(name: string) { return this.attributes.has(name); }
    querySelector(selector: string) { return this.selectors.get(selector)?.[0] ?? null; }
    querySelectorAll(selector: string) { return this.selectors.get(selector) ?? []; }
    contains(candidate: TestNode) {
      for (let current: TestNode | null = candidate; current; current = current.parent) {
        if (current === this) return true;
      }
      return false;
    }
    closest(selector: string): TestNode | null {
      if (selector === "a[href]" && this.href) return this;
      return this.parent?.closest(selector) ?? null;
    }
  }

  const document = new TestNode();
  const header = new TestNode(document);
  const toggle = new TestNode(header);
  toggle.setAttribute("aria-expanded", "false");
  const submenu = new TestNode(header);
  const summary = new TestNode(submenu);
  const link = new TestNode(submenu);
  link.href = "http://127.0.0.1/sermons-v5/";
  const outside = new TestNode(document);
  document.selectors.set("[data-site-header]", [header]);
  document.selectors.set("[data-site-toggle]", [toggle]);
  document.selectors.set("[data-menu]", [submenu]);
  submenu.selectors.set("summary", [summary]);
  submenu.selectors.set("a[href]", [link]);
  submenu.selectors.set("[data-sermon-archive]", [link]);

  runInNewContext(`${navigationScript}\n${mobileNavigationScript}`, {
    document, window: { location: { assign: vi.fn() } }
  });

  function bubble(target: TestNode, type: string, key?: string, prevented = false) {
    const event: TestEvent = {
      ...(key ? { key } : {}), target, defaultPrevented: prevented,
      preventDefault() { this.defaultPrevented = true; }
    };
    for (let node: TestNode | null = target; node; node = node.parent) {
      for (const handler of node.handlers.get(type) ?? []) handler(event);
    }
    return event;
  }
  function openSubmenu() {
    bubble(toggle, "click");
    bubble(summary, "keydown", "ArrowDown");
  }
  return { header, toggle, submenu, summary, link, outside, bubble, openSubmenu, focused: () => focused };
}

describe("mobile navigation with nested disclosure event bubbling", () => {
  it("closes only the submenu on first Escape, then closes the masthead on second Escape", () => {
    const tree = navigationTree();
    tree.openSubmenu();
    expect(tree.submenu.open).toBe(true);
    expect(tree.toggle.getAttribute("aria-expanded")).toBe("true");
    expect(tree.focused()).toBe(tree.link);

    expect(tree.bubble(tree.link, "keydown", "Escape").defaultPrevented).toBe(true);
    expect(tree.submenu.open).toBe(false);
    expect(tree.summary.getAttribute("aria-expanded")).toBe("false");
    expect(tree.header.hasAttribute("data-nav-open")).toBe(true);
    expect(tree.toggle.getAttribute("aria-expanded")).toBe("true");
    expect(tree.focused()).toBe(tree.summary);
    expect(tree.toggle.focus).not.toHaveBeenCalled();

    expect(tree.bubble(tree.summary, "keydown", "Escape").defaultPrevented).toBe(true);
    expect(tree.header.hasAttribute("data-nav-open")).toBe(false);
    expect(tree.toggle.getAttribute("aria-expanded")).toBe("false");
    expect(tree.focused()).toBe(tree.toggle);
    expect(tree.toggle.focus).toHaveBeenCalledOnce();
  });

  it("retains the open masthead when a descendant already consumed Escape", () => {
    const tree = navigationTree();
    tree.bubble(tree.toggle, "click");
    tree.bubble(tree.link, "keydown", "Escape", true);
    expect(tree.header.hasAttribute("data-nav-open")).toBe(true);
    expect(tree.toggle.getAttribute("aria-expanded")).toBe("true");
    expect(tree.toggle.focus).not.toHaveBeenCalled();
  });

  it("preserves ordinary link navigation and outside-click dismissal without stealing focus", () => {
    const tree = navigationTree();
    tree.openSubmenu();
    expect(tree.bubble(tree.link, "click").defaultPrevented).toBe(false);
    expect(tree.submenu.open).toBe(false);
    expect(tree.header.hasAttribute("data-nav-open")).toBe(true);
    expect(tree.focused()).toBe(tree.link);

    expect(tree.bubble(tree.outside, "click").defaultPrevented).toBe(false);
    expect(tree.header.hasAttribute("data-nav-open")).toBe(false);
    expect(tree.toggle.getAttribute("aria-expanded")).toBe("false");
    expect(tree.focused()).toBe(tree.link);
    expect(tree.toggle.focus).not.toHaveBeenCalled();
  });
});
