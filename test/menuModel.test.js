#!/usr/bin/env gjs -m

// ESM test — imports the real lib/menuModel.js functions and exercises them
// against plain JS mock objects that implement just the GMenuModel interface.

import { getTopLevelEntries, getSubmenuEntries, MenuItemType, MenuItemLink } from '../lib/menuModel.js';

// ── Mock objects ────────────────────────────────────────────────────────────

class MockGMenuModel {
    constructor(items = []) {
        this._items = items;
    }
    get_n_items() {
        return this._items.length;
    }
    get_item(index) {
        return this._items[index];
    }
}

class MockMenuItem {
    constructor(type, label = null, action = null, target = null) {
        this._type = type;
        this._label = label;
        this._action = action;
        this._target = target;
        this._submenu = null;
        this._section = null;
    }
    get_type() {
        return this._type;
    }
    get_attribute_value(name, _type) {
        if (name === 'label' && this._label) {
            // Return a Variant-shaped object with get_string()
            return { get_string: () => this._label };
        }
        return null;
    }
    get_link(linkType) {
        if (linkType === MenuItemLink.SUBMENU && this._submenu)
            return this._submenu;
        if (linkType === MenuItemLink.SECTION && this._section)
            return this._section;
        return null;
    }
    get_action() {
        return this._action;
    }
    get_action_target() {
        return this._target;
    }
    set_submenu(model) {
        this._submenu = model;
    }
    set_section(model) {
        this._section = model;
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function createActionItem(label, action, target = null) {
    return new MockMenuItem(MenuItemType.ACTION, label, action, target);
}

function createSubmenuItem(label, children = []) {
    const submenu = new MockGMenuModel(children);
    const item = new MockMenuItem(MenuItemType.SUBMENU, label);
    item.set_submenu(submenu);
    return item;
}

function createSeparatorItem() {
    return new MockMenuItem(MenuItemType.SEPARATOR);
}

function createModel(items) {
    return new MockGMenuModel(items);
}

// ── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        print(`PASS: ${message}`);
        passed++;
    } else {
        print(`FAIL: ${message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        print(`PASS: ${message}`);
        passed++;
    } else {
        print(`FAIL: ${message} — expected ${e}, got ${a}`);
        failed++;
    }
}

// ── Tests ───────────────────────────────────────────────────────────────────

print('Testing getTopLevelEntries...');

const fileMenu = createSubmenuItem('File', [
    createActionItem('New', 'app.new'),
    createActionItem('Open', 'app.open'),
    createSeparatorItem(),
    createActionItem('Quit', 'app.quit'),
]);
const editMenu = createSubmenuItem('Edit', [
    createActionItem('Copy', 'app.copy'),
    createActionItem('Paste', 'app.paste'),
]);
const rootModel = createModel([fileMenu, editMenu]);
const topEntries = getTopLevelEntries(rootModel);

assertEqual(topEntries.length, 2, 'two top-level menus');
assertEqual(topEntries[0].label, 'File', 'first is File');
assertEqual(topEntries[1].label, 'Edit', 'second is Edit');
assert(topEntries[0].submenu !== null, 'File has submenu');
assert(topEntries[1].submenu !== null, 'Edit has submenu');

print('Testing getSubmenuEntries...');

const fileSubmenu = fileMenu.get_link(MenuItemLink.SUBMENU);
const fileEntries = getSubmenuEntries(fileSubmenu);
assertEqual(fileEntries.length, 4, 'File has 4 entries');
assertEqual(fileEntries[0].label, 'New', 'entry 0 = New');
assertEqual(fileEntries[1].label, 'Open', 'entry 1 = Open');
assert(fileEntries[2].isSeparator === true, 'entry 2 = separator');
assertEqual(fileEntries[3].label, 'Quit', 'entry 3 = Quit');
assertEqual(fileEntries[0].action, 'app.new', 'New action');
assertEqual(fileEntries[3].action, 'app.quit', 'Quit action');

print('Testing nested submenu...');

const nestedModel = createModel([
    createSubmenuItem('View', [
        createSubmenuItem('Zoom', [
            createActionItem('Zoom In', 'app.zoom-in'),
            createActionItem('Zoom Out', 'app.zoom-out'),
        ]),
        createActionItem('Fullscreen', 'app.fullscreen'),
    ]),
]);
const nestedTop = getTopLevelEntries(nestedModel);
assertEqual(nestedTop.length, 1, 'one top-level View');
assert(nestedTop[0].submenu !== null, 'View has submenu');

const viewEntries = getSubmenuEntries(nestedTop[0].submenu);
assertEqual(viewEntries.length, 2, 'View has 2 entries');
assertEqual(viewEntries[0].label, 'Zoom', 'entry 0 = Zoom');
assert(viewEntries[0].submenu !== null, 'Zoom has submenu');

const zoomEntries = getSubmenuEntries(viewEntries[0].submenu);
assertEqual(zoomEntries.length, 2, 'Zoom has 2 entries');
assertEqual(zoomEntries[0].label, 'Zoom In', 'Zoom In');
assertEqual(zoomEntries[1].label, 'Zoom Out', 'Zoom Out');

print('Testing action with target...');

const targetVariant = { get_string: () => 'gedit' };
const actionModel = createModel([
    createActionItem('Open With', 'app.open-with', targetVariant),
]);
const actionEntries = getTopLevelEntries(actionModel);
assertEqual(actionEntries.length, 1, 'one action entry');
assertEqual(actionEntries[0].action, 'app.open-with', 'action name');
assert(actionEntries[0].target !== null, 'has target');
assertEqual(actionEntries[0].target.get_string(), 'gedit', 'target = gedit');

print('Testing empty model...');

assertEqual(getTopLevelEntries(createModel([])).length, 0, 'empty → []');

print('Testing separators-only model...');

assertEqual(
    getTopLevelEntries(createModel([createSeparatorItem(), createSeparatorItem()])).length,
    0,
    'separators at top level → []',
);

print('Testing registry / teardown simulation...');

const registry = new Map();
registry.set('111', { busName: 'org.a', menuObjectPath: '/a' });
registry.set('222', { busName: 'org.b', menuObjectPath: '/b' });
assert(registry.has('111'), 'window 111 registered');
assert(registry.has('222'), 'window 222 registered');

registry.delete('111');
assert(!registry.has('111'), '111 unregistered');
assert(registry.has('222'), '222 still registered');

registry.clear();
assertEqual(registry.size, 0, 'registry empty after clear');

// ── Summary ─────────────────────────────────────────────────────────────────

print(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0)
    imports.system.exit(1);
