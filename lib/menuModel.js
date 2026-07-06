import { GLib, Gio } from 'gi://GLib';

export const MenuItemType = {
    ACTION: 0,
    SUBMENU: 1,
    SECTION: 2,
    SEPARATOR: 3,
};

export const MenuItemLink = {
    SUBMENU: 0,
    SECTION: 1,
};

export function getTopLevelEntries(menuModel) {
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

export function getSubmenuEntries(submenuModel) {
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
                entry.children = getSectionEntries(section);
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

export function activateMenuItem(actionGroup, action, target) {
    if (target !== null) {
        actionGroup.activate_action(action, target);
    } else {
        actionGroup.activate_action(action, null);
    }
}