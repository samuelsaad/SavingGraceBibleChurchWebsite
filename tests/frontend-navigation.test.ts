import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { navigationScript } from "../src/frontend/scripts/navigation";

function setup() {
  type Handler = (event: Record<string, any>) => void;
  function target() {
    const events = new Map<string, Handler>();
    return { events, addEventListener: (name: string, handler: Handler) => events.set(name, handler), focus: vi.fn() };
  }
  const toggle = { ...target(), setAttribute: vi.fn(), getAttribute: () => null };
  const links = ["", "sermons/", "speakers/", "series/", "books/"].map((path) => ({
    ...target(), href: `http://127.0.0.1/frontend-preview/${path}`
  }));
  const menu = {
    ...target(), open: false,
    querySelector: (selector: string) => selector === "summary" ? toggle : links[1], querySelectorAll: () => links,
    hasAttribute: (name: string) => name === "data-sermon-menu",
    contains: (value: unknown) => value === toggle || links.includes(value as typeof links[number])
  };
  const document = { ...target(), querySelector: () => menu, querySelectorAll: () => [menu] };
  const assign = vi.fn();
  runInNewContext(navigationScript, { document, window: { location: { assign } } });
  function fire(element: ReturnType<typeof target>, name: string, fields: Record<string, unknown> = {}) {
    const event = { preventDefault: vi.fn(), ...fields };
    element.events.get(name)!(event);
    return event;
  }
  return { toggle, links, menu, document, assign, fire };
}

describe("Sermons disclosure enhancement", () => {
  it("leaves the first click to native disclosure and uses only an unmodified double-click to navigate", () => {
    const { toggle, links, assign, fire } = setup();
    expect(fire(toggle, "click", { detail: 1 }).preventDefault).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(fire(toggle, "click", { detail: 2 }).preventDefault).toHaveBeenCalledOnce();
    fire(toggle, "dblclick", { button: 0, ctrlKey: true });
    fire(toggle, "dblclick", { button: 1 });
    expect(assign).not.toHaveBeenCalled();
    fire(toggle, "dblclick", { button: 0 });
    expect(assign).toHaveBeenCalledExactlyOnceWith(links[1]!.href);
  });

  it("supports ArrowDown and Escape without replacing ordinary link navigation", () => {
    const { toggle, links, menu, assign, fire } = setup();
    fire(toggle, "keydown", { key: "ArrowDown" });
    expect(menu.open).toBe(true);
    expect(links[0]!.focus).toHaveBeenCalledOnce();
    expect(toggle.setAttribute).toHaveBeenLastCalledWith("aria-expanded", "true");
    const click = fire(menu, "click", { target: { closest: () => links[2] } });
    expect(click.preventDefault).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    menu.open = true;
    fire(menu, "keydown", { key: "Escape" });
    expect(menu.open).toBe(false);
    expect(toggle.focus).toHaveBeenCalledOnce();
  });

  it("closes on outside click or focus without stealing focus", () => {
    const { toggle, links, menu, document, fire } = setup();
    menu.open = true;
    fire(menu, "focusout", { relatedTarget: links[1] });
    expect(menu.open).toBe(true);
    fire(menu, "focusout", { relatedTarget: {} });
    expect(menu.open).toBe(false);
    menu.open = true;
    fire(document, "click", { target: toggle });
    expect(menu.open).toBe(true);
    fire(document, "click", { target: {} });
    expect(menu.open).toBe(false);
    expect(toggle.focus).not.toHaveBeenCalled();
  });
});
