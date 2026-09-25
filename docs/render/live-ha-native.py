#!/usr/bin/env python3
"""Native HA 2026.9 editor and mobile check on a temporary synthetic dashboard.

Run with an external JSON containing base_url and token. The dashboard config
is live-ha-native-dashboard.json. Create it hidden/admin-only through HA's
dashboard API and delete it after the run. This script changes only the four
synthetic card titles; it never calls a card action.
"""

import json
from pathlib import Path
import sys
import time

from playwright.sync_api import sync_playwright


KINDS = ("downloads", "recent", "fix", "seer")
WIDTHS = (320, 480, 960)
MODES = ("light", "dark")


def editor_open(page, kind, already_editing=False):
    if not already_editing:
        page.get_by_role("button", name="Dashboard bearbeiten").evaluate("e => e.click()")
    page.locator("hui-card-options.panel ha-button").first.wait_for(timeout=15000)
    page.locator("hui-card-options.panel ha-button").first.evaluate("e => e.click()")
    page.locator(f"codex-arrstack-{kind}-card-editor input[name=title]").wait_for(timeout=15000)


def run(bundle, credentials, dashboard, output):
    private = json.loads(credentials.read_text(encoding="utf-8"))
    base = private["base_url"].rstrip("/")
    auth = {
        "hassUrl": base, "clientId": base + "/", "expires": 4102444800000,
        "expires_in": 315360000, "refresh_token": "",
        "access_token": private["token"],
    }
    # Installed elements retain their original names; this browser tab gets
    # isolated names for the local candidate. No HA resource is installed.
    source = (bundle.read_text(encoding="utf-8")
              .replace("arrstack-", "codex-arrstack-")
              .replace("codex-arrstack-Dienst", "arrstack-Dienst")
              .replace("ha-codex-arrstack-cards", "ha-arrstack-cards"))
    report = {"cards": [], "page_errors": 0}
    run_id = int(time.time())
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True,
                                      viewport={"width": 320, "height": 900})
        context.add_init_script(script=
            "localStorage.setItem('hassTokens', JSON.stringify(%s));" % json.dumps(auth))
        context.add_init_script(script=
            "window.addEventListener('DOMContentLoaded', () => {(function(){\n" +
            source + "\n})();});")
        errors = []
        for kind in KINDS:
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(type(error).__name__))
            page.goto(base + "/profile", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_function(
                "() => !!document.querySelector('home-assistant')?.hass", timeout=30000)
            tag = f"codex-arrstack-{kind}-card"
            title = f"Synthetischer {kind} Speichertest {run_id}"
            page.set_viewport_size({"width": 960, "height": 900})
            page.goto(f"{base}/{dashboard}/{kind}", wait_until="domcontentloaded",
                      timeout=30000)
            page.locator(tag).first.wait_for(timeout=30000)
            editor_open(page, kind)
            editor = page.locator(f"{tag}-editor")
            editor.evaluate("""ed => {
                window.__arrEvents=[];
                ed.addEventListener('config-changed', e =>
                    window.__arrEvents.push(JSON.parse(JSON.stringify(e.detail.config))));
            }""")
            input_box = page.locator(f"{tag}-editor input[name=title]")
            input_box.fill(title)
            page.wait_for_function("() => window.__arrEvents?.length > 0", timeout=5000)
            emitted = page.evaluate("""() => {
                const c=window.__arrEvents.at(-1);
                return {count:window.__arrEvents.length,title:c.title,
                    entry_id:c.entry_id,refresh_seconds:c.refresh_seconds};
            }""")
            keyboard = editor.evaluate("""ed => {
                const deep=root=>{for(const element of root.querySelectorAll('*')){
                    if(element.matches('input[name=title]'))return element;
                    if(element.shadowRoot){const found=deep(element.shadowRoot);
                        if(found)return found;}
                }return null;};
                const input=deep(ed);
                if(!input)return {found:false};
                let leaked=0, defaultPrevented=0;
                const outside=ed.getRootNode().host;
                const listener=()=>leaked++;
                outside.addEventListener('keydown',listener);
                outside.addEventListener('keyup',listener);
                document.addEventListener('keydown',listener);
                document.addEventListener('keyup',listener);
                for(const key of ['a','e','c','d','k']) {
                    for(const type of ['keydown','keyup']) {
                        const event=new KeyboardEvent(type,{key,bubbles:true,
                            composed:true,cancelable:true,
                            ctrlKey:key==='k',metaKey:key==='k'});
                        input.dispatchEvent(event);
                        if(event.defaultPrevented)defaultPrevented++;
                    }
                }
                outside.removeEventListener('keydown',listener);
                outside.removeEventListener('keyup',listener);
                document.removeEventListener('keydown',listener);
                document.removeEventListener('keyup',listener);
                return {found:true,leaked,defaultPrevented,focused:input.matches(':focus'),
                    connected:input.isConnected};
            }""")
            schema = editor.evaluate("""ed => {
                const s=ed.querySelector('ha-form').schema;
                return {names:s.map(x=>x.name),
                    instance_options:s.find(x=>x.name==='entry_id')?.selector.select.options.length,
                    service_options:s.find(x=>x.name==='service')?.selector.select.options.length};
            }""")
            geometry = []
            for mode in MODES:
                page.emulate_media(color_scheme=mode)
                for width in WIDTHS:
                    page.set_viewport_size({"width": width, "height": 900})
                    page.wait_for_timeout(120)
                    metric = editor.evaluate("""ed => ({width:ed.getBoundingClientRect().width,
                        overflow:ed.scrollWidth>ed.clientWidth+1,
                        real_form:ed.querySelector('ha-form').constructor!==HTMLElement})""")
                    metric.update({"viewport": width, "mode": mode})
                    geometry.append(metric)
                    editor.screenshot(path=str(output / f"editor-{kind}-{width}-{mode}.png"),
                                      timeout=10000)
            page.locator("hui-dialog-edit-card ha-button.gui-mode-button").evaluate(
                "e => e.click()")
            page.locator("hui-dialog-edit-card ha-yaml-editor").wait_for(timeout=10000)
            yaml_kept = page.locator("hui-dialog-edit-card ha-yaml-editor").evaluate(
                "(e, title) => String(e.yaml || '').includes(title)", title)
            page.locator("hui-dialog-edit-card ha-button.gui-mode-button").evaluate(
                "e => e.click()")
            input_box.wait_for(timeout=10000)
            visual_kept = input_box.input_value() == title
            save_enabled = page.locator(
                "hui-dialog-edit-card ha-button[slot=primaryAction]").evaluate(
                    "e => !e.disabled")
            page.locator("hui-dialog-edit-card ha-button[slot=primaryAction]").evaluate(
                "e => e.click()")
            page.locator("hui-dialog-edit-card ha-dialog[open]").wait_for(
                state="detached", timeout=15000)
            title_in_card = page.locator(tag).first.evaluate(
                "e => e.shadowRoot?.querySelector('.title')?.textContent?.trim()")
            editor_open(page, kind, already_editing=True)
            reopened = page.locator(f"{tag}-editor input[name=title]").input_value()
            page.locator("hui-dialog-edit-card ha-button[slot=secondaryAction]").last.evaluate(
                "e => e.click()")
            page.locator("hui-dialog-edit-card ha-dialog[open]").wait_for(
                state="detached", timeout=15000)
            page.locator("ha-button.exit-edit-mode").evaluate("e => e.click()")
            page.wait_for_timeout(800)
            card_metrics = []
            for mode in MODES:
                page.emulate_media(color_scheme=mode)
                for width in WIDTHS:
                    page.set_viewport_size({"width": width, "height": 900})
                    page.wait_for_timeout(250)
                    metric = page.locator(tag).first.evaluate("""e => ({
                        width:e.getBoundingClientRect().width,
                        overflow:e.scrollWidth>e.clientWidth+1,
                        title:e.shadowRoot?.querySelector('.title')?.textContent?.trim(),
                        visible:!!e.shadowRoot?.querySelector('ha-card')?.getBoundingClientRect().height
                    })""")
                    metric.update({"viewport": width, "mode": mode})
                    card_metrics.append(metric)
                    page.locator(tag).first.screenshot(
                        path=str(output / f"card-{kind}-{width}-{mode}.png"))
            report["cards"].append({
                "kind": kind, "emitted": emitted, "schema": schema,
                "keyboard": keyboard,
                "editor_geometry": geometry, "yaml_kept": yaml_kept,
                "visual_kept": visual_kept, "save_enabled": save_enabled,
                "title_in_card": title_in_card, "reopened": reopened,
                "card_geometry": card_metrics,
            })
            page.close()
        report["page_errors"] = len(errors)
        browser.close()
    return report


def main():
    if len(sys.argv) != 5:
        print("usage: live-ha-native.py bundle.js private-credentials.json test-dashboard output-dir")
        return 2
    try:
        result = run(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3],
                     Path(sys.argv[4]))
        checks = []
        for item in result["cards"]:
            checks.append(item["emitted"]["count"] > 0
                          and item["emitted"]["title"] == item["reopened"]
                          and item["emitted"]["entry_id"] == "codex-synthetic-entry"
                          and item["emitted"]["refresh_seconds"] == 0
                          and item["keyboard"] == {"found": True, "leaked": 0,
                              "defaultPrevented": 0, "focused": True,
                              "connected": True}
                          and item["schema"]["instance_options"] is not None
                          and item["schema"]["service_options"] > 0
                          and item["yaml_kept"] and item["visual_kept"]
                          and item["save_enabled"]
                          and item["title_in_card"] == item["reopened"]
                          and all(x["real_form"] and not x["overflow"]
                                  for x in item["editor_geometry"])
                          and all(x["visible"] and not x["overflow"]
                                  for x in item["card_geometry"]))
        summary = {"cards": len(result["cards"]), "passed": sum(checks),
                   "editor_variants": sum(len(x["editor_geometry"]) for x in result["cards"]),
                   "card_variants": sum(len(x["card_geometry"]) for x in result["cards"]),
                   "page_errors": result["page_errors"],
                   "instance_option_counts": [x["schema"]["instance_options"]
                                              for x in result["cards"]]}
        print(json.dumps(summary, ensure_ascii=False))
        return 0 if len(checks) == len(KINDS) and all(checks) and not result["page_errors"] else 1
    except Exception as error:
        # Browser exceptions may contain private URLs; report type only.
        frames = []
        trace = error.__traceback__
        while trace:
            if trace.tb_frame.f_code.co_filename == __file__:
                frames.append(trace.tb_lineno)
            trace = trace.tb_next
        print("Native HA probe failed:", type(error).__name__, "lines", frames)
        return 1


if __name__ == "__main__":
    sys.exit(main())
