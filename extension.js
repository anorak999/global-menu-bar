import { GLib, Gio } from 'gi://GLib';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, ExtensionUtils } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as MenuModel from './lib/menuModel.js';

const REGISTRAR_NAME = 'com.canonical.AppMenu.Registrar';
const REGISTRAR_PATH = '/com/canonical/AppMenu/Registrar';
const REGISTRAR_IFACE = 'com.canonical.AppMenuRegistrar';

const DBUS_XML = `
<node>
  <interface name="${REGISTRAR_IFACE}">
    <method name="RegisterWindow">
      <arg type="s" name="windowId" direction="in"/>
      <arg type="o" name="menuObjectPath" direction="in"/>
    </method>
    <method name="UnregisterWindow">
      <arg type="s" name="windowId" direction="in"/>
    </method>
    <method name="GetMenuForWindow">
      <arg type="s" name="windowId" direction="in"/>
      <arg type="o" name="menuObjectPath" direction="out"/>
    </method>
  </interface>
</node>
`;

class GlobalMenuButton extends PanelMenu.Button {
    constructor(extension) {
        super(0.0, 'Global Menu Bar', false);

        this._extension = extension;
        this._menuItems = new Map();
        this._currentModel = null;
        this._actionGroup = new Gio.SimpleActionGroup();

        this._box = new St.BoxLayout({ style_class: 'global-menu-bar-box' });
        this.add_child(this._box);

        this._settings = extension._settings;
        this._settings.connectObject('changed', () => this._updateFromSettings(), this);

        this._updateFromSettings();
    }

    _updateFromSettings() {
        this._showDesktopLabel = this._settings.get_boolean('show-desktop-label');
        this._itemSpacing = this._settings.get_int('item-spacing');
        this._showStatusIndicator = this._settings.get_boolean('show-status-indicator');
        this._box.spacing = this._itemSpacing;
        this._rebuildMenu();
    }

    setMenuModel(menuModel, windowTitle) {
        this._currentModel = menuModel;
        this._windowTitle = windowTitle;
        this._rebuildMenu();
    }

    clearMenu() {
        this._currentModel = null;
        this._windowTitle = null;
        this._rebuildMenu();
    }

    setNoMenuAvailable() {
        this._showStatusIndicator = true;
        this._rebuildMenu();
    }

    _rebuildMenu() {
        this._box.destroy_all_children();
        this._menuItems.clear();
        this._actionGroup.remove_all();

        if (!this._currentModel) {
            if (this._showDesktopLabel) {
                this._showDesktopState();
            } else if (this._showStatusIndicator) {
                this._showNoMenuState();
            }
            return;
        }

        const topEntries = MenuModel.getTopLevelEntries(this._currentModel);

        if (topEntries.length === 0) {
            if (this._showStatusIndicator) {
                this._showNoMenuState();
            }
            return;
        }

        for (const entry of topEntries) {
            this._createTopLevelButton(entry);
        }
    }

    _showDesktopState() {
        const label = new St.Label({
            text: 'Desktop',
            style_class: 'global-menu-bar-desktop-label',
        });
        this._box.add_child(label);
    }

    _showNoMenuState() {
        const label = new St.Label({
            text: 'No Menu',
            style_class: 'global-menu-bar-status-indicator',
        });
        this._box.add_child(label);
    }

    _createTopLevelButton(entry) {
        const button = new St.Button({
            style_class: 'global-menu-bar-menu-button',
            label: entry.label,
            reactive: true,
            can_focus: true,
        });

        button.connect('clicked', () => this._onMenuButtonClicked(button, entry));

        this._box.add_child(button);
        this._menuItems.set(button, entry);
    }

    _onMenuButtonClicked(button, entry) {
        if (entry.submenu) {
            this._showSubmenu(button, entry);
        } else if (entry.section) {
            this._showSectionMenu(button, entry);
        }
    }

    _showSubmenu(button, entry) {
        this.menu.removeAll();

        const submenuEntries = MenuModel.getSubmenuEntries(entry.submenu);
        for (const subEntry of submenuEntries) {
            const item = this._createMenuItem(subEntry, this.menu);
            if (item) {
                this.menu.addMenuItem(item);
            }
        }

        this.menu.open(true);
    }

    _showSectionMenu(button, entry) {
        this.menu.removeAll();

        const sectionEntries = MenuModel.getSubmenuEntries(entry.section);
        for (const subEntry of sectionEntries) {
            const item = this._createMenuItem(subEntry, this.menu);
            if (item) {
                this.menu.addMenuItem(item);
            }
        }

        this.menu.open(true);
    }

    _createMenuItem(entry, parentMenu) {
        if (entry.isSeparator) {
            return new PopupMenu.PopupSeparatorMenuItem();
        }

        if (entry.section) {
            const section = new PopupMenu.PopupMenuSection();
            const children = MenuModel.getSubmenuEntries(entry.section);
            for (const child of children) {
                const item = this._createMenuItem(child, section);
                if (item) section.addMenuItem(item);
            }
            return section;
        }

        if (entry.submenu) {
            const submenu = new PopupMenu.PopupSubMenuMenuItem(entry.label);
            const children = MenuModel.getSubmenuEntries(entry.submenu);
            for (const child of children) {
                const item = this._createMenuItem(child, submenu.menu);
                if (item) submenu.menu.addMenuItem(item);
            }
            return submenu;
        }

        if (entry.action) {
            const item = new PopupMenu.PopupMenuItem(entry.label);

            item.connect('activate', () => {
                const target = entry.target;
                if (target !== null) {
                    this._actionGroup.activate_action(entry.action, target);
                } else {
                    this._actionGroup.activate_action(entry.action, null);
                }
            });

            return item;
        }

        return null;
    }

    destroy() {
        this._settings.disconnectObject(this);
        this.menu.removeAll();
        super.destroy();
    }
}

class AppMenuRegistrarImpl {
    constructor(extension) {
        this._extension = extension;
    }

    RegisterWindow(invocation, windowId, menuObjectPath) {
        const sender = invocation.get_sender();
        if (!sender) {
            invocation.return_dbus_error('org.freedesktop.DBus.Error.Failed', 'No sender');
            return;
        }

        this._extension._registerWindow(windowId, sender, menuObjectPath);
        invocation.return_value(null);
    }

    UnregisterWindow(invocation, windowId) {
        const sender = invocation.get_sender();
        if (!sender) {
            invocation.return_dbus_error('org.freedesktop.DBus.Error.Failed', 'No sender');
            return;
        }

        this._extension._unregisterWindow(windowId, sender);
        invocation.return_value(null);
    }

    GetMenuForWindow(invocation, windowId) {
        const entry = this._extension._registry.get(windowId);
        if (entry) {
            invocation.return_value(GLib.Variant.new('(o)', [entry.menuObjectPath]));
        } else {
            invocation.return_dbus_error('org.freedesktop.DBus.Error.UnknownMethod', 'Window not registered');
        }
    }
}

export default class GlobalMenuExtension extends Extension {
    constructor(uuid) {
        super(uuid);
        this._indicator = null;
        this._menuButton = null;
        this._settings = null;
        this._focusWindowId = null;
        this._registry = new Map();
        this._ownNameId = 0;
        this._sessionType = null;
        this._registrarSkeleton = null;
        this._exportedObject = null;
        this._currentMenuModel = null;
        this._destroyed = false;
    }

    enable() {
        this._destroyed = false;
        this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.global-menu-bar');

        this._sessionType = this._detectSessionType();
        log(`Global Menu Bar: Session type: ${this._sessionType}`);

        this._menuButton = new GlobalMenuButton(this);
        this._indicator = this._menuButton;
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');

        global.display.connectObject('notify::focus-window', () => this._onFocusWindowChanged(), this);

        this._ownNameId = Gio.bus_own_name(
            Gio.BusType.SESSION,
            REGISTRAR_NAME,
            Gio.BusNameOwnerFlags.NONE,
            () => this._onBusAcquired(),
            () => { },
            () => this._onNameLost()
        );

        this._onFocusWindowChanged();
    }

    disable() {
        this._destroyed = true;

        global.display.disconnectObject(this);

        if (this._ownNameId) {
            Gio.bus_unown_name(this._ownNameId);
            this._ownNameId = 0;
        }

        if (this._exportedObject) {
            this._exportedObject.unexport();
            this._exportedObject = null;
        }

        this._registrarSkeleton = null;

        if (this._currentMenuModel) {
            this._currentMenuModel.disconnectObject(this);
            this._currentMenuModel = null;
        }

        for (const [windowId, entry] of this._registry) {
            if (entry.watchId) {
                Gio.DBus.session.unwatch_name(entry.watchId);
            }
        }
        this._registry.clear();

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._menuButton = null;
        this._settings = null;
        this._focusWindowId = null;
    }

    _detectSessionType() {
        const sessionType = GLib.getenv('XDG_SESSION_TYPE');
        if (sessionType) {
            return sessionType;
        }

        try {
            const display = global.display;
            if (display.get_default_seat) {
                return 'wayland';
            }
        } catch (e) { }

        return 'x11';
    }

    _onBusAcquired() {
        try {
            this._registrarSkeleton = new AppMenuRegistrarImpl(this);

            const impl = this._registrarSkeleton;

            this._exportedObject = Gio.DBusExportedObject.wrapJSObject(
                DBUS_XML,
                impl
            );

            this._exportedObject.export(Gio.DBus.session, REGISTRAR_PATH);

            log('Global Menu Bar: Registrar exported successfully');
        } catch (e) {
            logError(e, 'Failed to export registrar');
        }
    }

    _onNameLost() {
        log('Global Menu Bar: Another AppMenu registrar is already running');
        if (this._menuButton) {
            this._menuButton.clearMenu();
            this._menuButton.setNoMenuAvailable();
        }
    }

    _onFocusWindowChanged() {
        if (this._destroyed) return;

        const focusWindow = global.display.focus_window;

        if (!focusWindow) {
            this._focusWindowId = null;
            if (this._menuButton) {
                this._menuButton.clearMenu();
            }
            return;
        }

        let windowId = null;

        if (this._sessionType === 'x11' || focusWindow.get_window_type() === Meta.WindowType.XWAYLAND) {
            const xid = focusWindow.get_xwindow();
            if (xid) {
                windowId = xid.toString();
            }
        }

        if (!windowId) {
            this._focusWindowId = null;
            if (this._menuButton) {
                this._menuButton.clearMenu();
            }
            return;
        }

        if (this._focusWindowId === windowId) {
            return;
        }

        this._focusWindowId = windowId;
        this._updateMenuForWindow(windowId, focusWindow.get_title());
    }

    _updateMenuForWindow(windowId, windowTitle) {
        const entry = this._registry.get(windowId);

        if (!entry) {
            if (this._menuButton) {
                this._menuButton.clearMenu();
            }
            return;
        }

        this._loadMenu(entry.busName, entry.menuObjectPath, windowTitle);
    }

    _loadMenu(busName, objectPath, windowTitle) {
        if (this._currentMenuModel) {
            this._currentMenuModel.disconnectObject(this);
            this._currentMenuModel = null;
        }

        const proxy = new Gio.DBusProxy({
            g_connection: Gio.DBus.session,
            name: busName,
            object_path: objectPath,
            interface_name: 'com.canonical.dbusmenu',
            do_not_auto_start: true,
            do_not_connect_signals: true,
        });

        proxy.init_async(GLib.PRIORITY_DEFAULT, null, (proxy, res) => {
            try {
                proxy.init_finish(res);
            } catch (e) {
                logError(e, `Failed to load menu for ${busName}${objectPath}`);
                if (!this._destroyed && this._menuButton) {
                    this._menuButton.clearMenu();
                }
                return;
            }

            if (this._destroyed) return;

            const menuModel = new Gio.DBusMenuModel({
                connection: Gio.DBus.session,
                name: busName,
                object_path: objectPath,
            });

            menuModel.connectObject('items-changed', () => {
                if (!this._destroyed && this._menuButton && this._focusWindowId) {
                    this._updateMenuForWindow(this._focusWindowId, windowTitle);
                }
            }, this);

            this._currentMenuModel = menuModel;

            if (this._menuButton) {
                this._menuButton.setMenuModel(menuModel, windowTitle);
            }
        });
    }

    _registerWindow(windowId, busName, menuObjectPath) {
        log(`Global Menu Bar: Registering window ${windowId} from ${busName}`);

        const watchId = Gio.DBus.session.watch_name(
            busName,
            Gio.BusNameWatcherFlags.NONE,
            (connection, name) => { },
            (connection, name) => this._onProviderVanished(windowId)
        );

        const entry = { busName, menuObjectPath, watchId };
        this._registry.set(windowId, entry);

        if (this._focusWindowId === windowId) {
            this._loadMenu(busName, menuObjectPath, global.display.focus_window?.get_title() || '');
        }
    }

    _unregisterWindow(windowId, busName) {
        const entry = this._registry.get(windowId);

        if (entry && entry.busName === busName) {
            log(`Global Menu Bar: Unregistering window ${windowId}`);

            if (entry.watchId) {
                Gio.DBus.session.unwatch_name(entry.watchId);
            }

            this._registry.delete(windowId);

            if (this._focusWindowId === windowId) {
                this._focusWindowId = null;
                if (this._menuButton) {
                    this._menuButton.clearMenu();
                }
            }
        }
    }

    _onProviderVanished(windowId) {
        log(`Global Menu Bar: Provider vanished for window ${windowId}`);
        this._unregisterWindow(windowId, this._registry.get(windowId)?.busName || '');
    }
}
