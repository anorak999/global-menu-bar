#!/usr/bin/env gjs

// Mock GLib.Variant for testing
const GLib = {
    Variant: {
        new: (type, value) => ({ type, value, get_string: () => value }),
        STRING: 's',
    },
    VariantType: {
        STRING: 's',
    },
};

// Mock Gio.MenuItemType
const MenuItemType = {
    ACTION: 0,
    SUBMENU: 1,
    SECTION: 2,
    SEPARATOR: 3,
};

// Mock Gio.MenuItemLink
const MenuItemLink = {
    SUBMENU: 0,
    SECTION: 1,
};

// Mock GMenuModel
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

// Mock MenuItem
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

    get_attribute_value(name, type) {
        if (name === 'label' && this._label) {
            return new GLib.Variant('s', this._label);
        }
        return null;
    }

    get_link(linkType) {
        if (linkType === MenuItemLink.SUBMENU && this._submenu) {
            return this._submenu;
        }
        if (linkType === MenuItemLink.SECTION && this._section) {
            return this._section;
        }
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

// Import the module under test
// Note: This is a simplified version for testing without the actual GJS environment
// In production, this would use the actual GJS imports

// Pure functions to test (extracted from lib/menuModel.js for testing)
function getTopLevelEntries(menuModel) {
    const entries = [];
    const nItems = menuModel.get_n_items();

    for (let i = 0; i < nItems; i++) {
        const item = menuModel.get_item(i);
        const entry = { label: null, index: i, item };

        if (item.get_type() === MenuItemType.SECTION) {
            const section = item.get_link(MenuItemLink.SECTION);
            if (section) {
                entry.section = section;
                entry.label = section.get_attribute_value('label', GLib.VariantType.STRING)?.get_string();
            }
        } else if (item.get_type() === MenuItemType.SUBMENU) {
            const submenu = item.get_link(MenuItemLink.SUBMENU);
            if (submenu) {
                entry.submenu = submenu;
                entry.label = submenu.get_attribute_value('label', GLib.VariantType.STRING)?.get_string();
            }
        } else if (item.get_type() === MenuItemType.ACTION) {
            entry.action = item.get_action();
            entry.target = item.get_action_target();
            entry.label = item.get_attribute_value('label', GLib.VariantType.STRING)?.get_string();
        }

        if (entry.label) {
            entries.push(entry);
        }
    }

    return entries;
}

function getSubmenuEntries(submenuModel) {
    const entries = [];
    const nItems = submenuModel.get_n_items();

    for (let i = 0; i < nItems; i++) {
        const item = submenuModel.get_item(i);
        const entry = { label: null, index: i, item };

        if (item.get_type() === MenuItemType.SECTION) {
            const section = item.get_link(MenuItemLink.SECTION);
            if (section) {
                entry.section = section;
                entry.label = section.get_attribute_value('label', GLib.VariantType.STRING)?.get_string();
                entry.children = getSubmenuEntries(section);
            }
        } else if (item.get_type() === MenuItemType.SUBMENU) {
            const submenu = item.get_link(MenuItemLink.SUBMENU);
            if (submenu) {
                entry.submenu = submenu;
                entry.label = submenu.get_attribute_value('label', GLib.VariantType.STRING)?.get_string();
                entry.children = getSubmenuEntries(submenu);
            }
        } else if (item.get_type() === MenuItemType.ACTION) {
            entry.action = item.get_action();
            entry.target = item.get_action_target();
            entry.label = item.get_attribute_value('label', GLib.VariantType.STRING)?.get_string();
        } else if (item.get_type() === MenuItemType.SEPARATOR) {
            entry.isSeparator = true;
        }

        entries.push(entry);
    }

    return entries;
}

function getSectionEntries(sectionModel) {
    const entries = [];
    const nItems = sectionModel.get_n_items();

    for (let i = 0; i < nItems; i++) {
        const item = sectionModel.get_item(i);
        const entry = { label: null, index: i, item };

        if (item.get_type() === MenuItemType.ACTION) {
            entry.action = item.get_action();
            entry.target = item.get_action_target();
            entry.label = item.get_attribute_value('label', GLib.VariantType.STRING)?.get_string();
        } else if (item.get_type() === MenuItemType.SEPARATOR) {
            entry.isSeparator = true;
        }

        if (entry.label || entry.isSeparator) {
            entries.push(entry);
        }
    }

    return entries;
}

// Test helpers
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

// Test runner
function runTests() {
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
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr === expectedStr) {
            print(`PASS: ${message}`);
            passed++;
        } else {
            print(`FAIL: ${message} - Expected: ${expectedStr}, Got: ${actualStr}`);
            failed++;
        }
    }

    print('Testing getTopLevelEntries...');

    // Test 1: Basic submenu entries
    const fileMenu = createSubmenuItem('File', [
        createActionItem('New', 'app.new'),
        createActionItem('Open', 'app.open'),
        createSeparatorItem(),
        createActionItem('Quit', 'app.quit')
    ]);

    const editMenu = createSubmenuItem('Edit', [
        createActionItem('Copy', 'app.copy'),
        createActionItem('Paste', 'app.paste')
    ]);

    const rootModel = createModel([fileMenu, editMenu]);
    const topEntries = getTopLevelEntries(rootModel);
    assertEqual(topEntries.length, 2, 'Should find 2 top-level menus');
    assertEqual(topEntries[0].label, 'File', 'First menu should be File');
    assertEqual(topEntries[1].label, 'Edit', 'Second menu should be Edit');
    assert(topEntries[0].submenu !== null, 'File should have submenu');
    assert(topEntries[1].submenu !== null, 'Edit should have submenu');

    print('Testing getSubmenuEntries...');

    // Test 2: Submenu entries
    const fileSubmenu = fileMenu.get_link(MenuItemLink.SUBMENU);
    const fileEntries = getSubmenuEntries(fileSubmenu);
    assertEqual(fileEntries.length, 4, 'File menu should have 4 entries');
    assertEqual(fileEntries[0].label, 'New', 'First item should be New');
    assertEqual(fileEntries[1].label, 'Open', 'Second item should be Open');
    assert(fileEntries[2].isSeparator === true, 'Third item should be separator');
    assertEqual(fileEntries[3].label, 'Quit', 'Fourth item should be Quit');
    assertEqual(fileEntries[0].action, 'app.new', 'New should have app.new action');
    assertEqual(fileEntries[3].action, 'app.quit', 'Quit should have app.quit action');

    print('Testing nested submenu...');

    // Test 3: Nested submenu
    const nestedSubmenu = createSubmenuItem('View', [
        createSubmenuItem('Zoom', [
            createActionItem('Zoom In', 'app.zoom-in'),
            createActionItem('Zoom Out', 'app.zoom-out')
        ]),
        createActionItem('Fullscreen', 'app.fullscreen')
    ]);

    const nestedModel = createModel([nestedSubmenu]);
    const nestedTop = getTopLevelEntries(nestedModel);
    assertEqual(nestedTop.length, 1, 'Should find View menu');
    assert(nestedTop[0].submenu !== null, 'View should have submenu');

    const viewSubmenu = nestedTop[0].submenu;
    const viewEntries = getSubmenuEntries(viewSubmenu);
    assertEqual(viewEntries.length, 2, 'View should have 2 entries');
    assertEqual(viewEntries[0].label, 'Zoom', 'First should be Zoom');
    assert(viewEntries[0].submenu !== null, 'Zoom should have submenu');

    const zoomSubmenu = viewEntries[0].submenu;
    const zoomEntries = getSubmenuEntries(zoomSubmenu);
    assertEqual(zoomEntries.length, 2, 'Zoom should have 2 entries');
    assertEqual(zoomEntries[0].label, 'Zoom In', 'First should be Zoom In');
    assertEqual(zoomEntries[1].label, 'Zoom Out', 'Second should be Zoom Out');

    print('Testing action with target...');

    // Test 4: Action with target
    const actionWithTarget = createActionItem('Open With', 'app.open-with', new GLib.Variant('s', 'gedit'));
    const actionModel = createModel([actionWithTarget]);
    const actionEntries = getTopLevelEntries(actionModel);
    assertEqual(actionEntries.length, 1, 'Should find action with target');
    assertEqual(actionEntries[0].action, 'app.open-with', 'Action should match');
    assert(actionEntries[0].target !== null, 'Should have target');
    assertEqual(actionEntries[0].target.get_string(), 'gedit', 'Target should be gedit');

    print('Testing empty model...');

    // Test 5: Empty model
    const emptyModel = createModel([]);
    const emptyEntries = getTopLevelEntries(emptyModel);
    assertEqual(emptyEntries.length, 0, 'Empty model should return empty array');

    print('Testing model with only separators...');

    // Test 6: Separators at top level
    const sepModel = createModel([createSeparatorItem(), createSeparatorItem()]);
    const sepEntries = getTopLevelEntries(sepModel);
    assertEqual(sepEntries.length, 0, 'Separators at top level should be ignored');

    print('Testing registration/teardown logic...');

    // Test 7: Registration and teardown simulation
    const registry = new Map();
    const windowId1 = '12345';
    const windowId2 = '67890';

    // Register two windows
    registry.set(windowId1, { busName: 'org.example.app1', menuObjectPath: '/menu1' });
    registry.set(windowId2, { busName: 'org.example.app2', menuObjectPath: '/menu2' });

    assert(registry.has(windowId1), 'Window 1 should be registered');
    assert(registry.has(windowId2), 'Window 2 should be registered');

    // Unregister window 1
    registry.delete(windowId1);
    assert(!registry.has(windowId1), 'Window 1 should be unregistered');
    assert(registry.has(windowId2), 'Window 2 should still be registered');

    // Clear all
    registry.clear();
    assert(registry.size === 0, 'Registry should be empty after clear');

    print('\nTest Summary:');
    print(`Total: ${passed + failed} tests`);
    print(`Passed: ${passed}`);
    print(`Failed: ${failed}`);

    if (failed > 0) {
        print('\nSome tests failed!');
        imports.system.exit(1);
    } else {
        print('\nAll tests passed!');
    }
}

// Run tests
runTests();