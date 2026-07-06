import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GlobalMenuPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.global-menu-bar');

        const page = new Adw.PreferencesPage({
            title: 'Global Menu Bar',
            icon_name: 'view-list-symbolic',
        });
        window.add(page);

        const generalGroup = new Adw.PreferencesGroup({
            title: 'General',
            description: 'Configure the global menu bar appearance.',
        });
        page.add(generalGroup);

        const showDesktopRow = new Adw.SwitchRow({
            title: 'Show "Desktop" label',
            subtitle: 'Show a "Desktop" label when no window is focused.',
            active: settings.get_boolean('show-desktop-label'),
        });
        generalGroup.add(showDesktopRow);
        settings.bind('show-desktop-label', showDesktopRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const showStatusRow = new Adw.SwitchRow({
            title: 'Show status indicator',
            subtitle: 'Show a status indicator when no menu is available for the focused window.',
            active: settings.get_boolean('show-status-indicator'),
        });
        generalGroup.add(showStatusRow);
        settings.bind('show-status-indicator', showStatusRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Appearance',
            description: 'Customize the menu bar spacing.',
        });
        page.add(appearanceGroup);

        const spacingRow = new Adw.SpinRow({
            title: 'Item spacing',
            subtitle: 'Spacing between menu items in pixels.',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 24,
                step_increment: 1,
                page_increment: 4,
                value: settings.get_int('item-spacing'),
            }),
        });
        appearanceGroup.add(spacingRow);
        settings.bind('item-spacing', spacingRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    }
}