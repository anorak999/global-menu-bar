# Global Menu Bar for GNOME Shell

A macOS-style global menu bar for GNOME Shell that strips each application's in-window menu bar and renders it in the persistent top panel, switching contents on window focus change.

**Screenshot placeholder:** The screenshot should show the GNOME Shell top panel with a "File Edit View" menu bar visible, alongside a focused application window. When the user switches to a different application, the panel menu bar updates to show that application's menus.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GNOME Shell Top Panel                     │
│  [Activities] [Clock]                    File Edit View  [Tray] │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Global Menu Bar Extension                     │
│  ┌──────────────┐  ┌──────────────┐  └──────────────────────┘  │
│  │ Registrar    │  │ Focus        │  │ Menu Renderer            │
│  │ (DBus)       │  │ Tracker      │  │ (PanelMenu.Button)       │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              DBus: com.canonical.AppMenu.Registrar                │
│  RegisterWindow(windowId, objectPath)                           │
│  UnregisterWindow(windowId)                                      │
│  GetMenuForWindow(windowId) → objectPath                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Application Menu Export                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ GTK Apps     │  │ Qt Apps      │  │ Other Toolkit Apps   │  │
│  │ (unity-gtk-  │  │ (native      │  │ (appmenu-gtk-module) │  │
│  │  module)     │  │  platform)   │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

The extension operates as a consumer of the existing Canonical AppMenu/dbusmenu registrar protocol. Applications export their menus via platform-specific mechanisms, and the extension renders them in the top panel.

## How This Differs From / Relates to Existing Global-Menu Projects

This extension is part of a long lineage of attempts to bring global menu functionality to GNOME and Linux desktops:

- **vala-panel-appmenu (XFCE/MATE/Vala Panel)**: Provides global menus for XFCE, MATE, and Vala Panel desktops using `unity-gtk-module` as the backend. This project uses the same Canonical AppMenu registrar protocol as its menu source, but targets GNOME Shell specifically.

- **Gnome-Global-AppMenu**: An earlier GNOME Shell-specific implementation that attempted similar functionality. This extension learns from that project's approach and focuses on a clean, maintainable implementation using modern GNOME Shell 45+ APIs (ESM extensions).

- **unity-gtk-module / appmenu-gtk-module**: These are menu export shims that bridge GTK applications to the Canonical AppMenu protocol. This extension does not replace or include these modules — it consumes their output.

**What's reused**: The Canonical AppMenu/dbusmenu registrar protocol (`com.canonical.AppMenu.Registrar`), which is a well-defined D-Bus interface for menu export.

**What's new**: A clean, GNOME Shell-native renderer that integrates with modern Shell APIs (45+), handles XWayland windows correctly, and provides proper lifecycle management for extension enable/disable cycles.

## Requirements

- **GNOME Shell Version**: 46 or 47 (ESM extensions only)
- **Session Type**:
  - **X11**: Fully supported via `MetaWindow.get_xwindow()` (XID)
  - **XWayland**: Fully supported via `MetaWindow.get_xwindow()` (XID) — this is the primary supported path for GNOME 49+
  - **Native Wayland**: Not supported (no XID available)
- **Application Menu Export**: Applications must export menus via:
  - `appmenu-gtk-module` / `unity-gtk-module` (GTK apps)
  - Native Qt platform theme (Qt apps)
  - Equivalent export mechanism for other toolkits
  - This extension is a consumer, not a menu-export shim. Apps that don't export anything will show "No Menu" in the panel.

## Install Instructions

### Manual Installation

```bash
# Clone or download the extension
cd /path/to/extension

# Install dependencies (for schema compilation)
sudo apt install libglib2.0-dev

# Compile schemas and install
make install

# Enable the extension
gnome-extensions enable global-menu-bar@anorak999.github.com

# Restart GNOME Shell (X11: Alt+F2 → r; Wayland: log out and back in)
```

### Package Installation

```bash
# Build the extension package
make package

# The resulting .zip can be installed via gnome-extensions install
gnome-extensions install global-menu-bar@anorak999.github.com.zip
```

## Configuration

The extension preferences can be accessed via GNOME Extensions app or `gnome-extensions prefs`.

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `show-desktop-label` | boolean | `true` | Show "Desktop" label when no window is focused |
| `show-status-indicator` | boolean | `true` | Show "No Menu" status when no registrar-compatible menu is found |
| `item-spacing` | integer | `8` | Horizontal spacing between menu items in pixels (0-24) |

### Prefs UI Options

1. **Show "Desktop" label**: When enabled, displays "Desktop" in the panel when no window has focus.
2. **Show status indicator**: When enabled, displays "No Menu" when the focused window has no exported menu.
3. **Item spacing**: Adjusts the horizontal spacing between menu items (0-24 pixels).

## Limitations

### Native Wayland Apps Without XID

**This is a hard limitation by design.** Native Wayland applications do not expose an X11 XID (window identifier). The Canonical AppMenu registrar protocol relies on the window's XID to associate menus with windows. Without an XID:

- The extension cannot determine which Wayland window is being focused
- Menu export from native Wayland apps is impossible without the X11 window ID
- Apps will show "No Menu" in the panel

This affects:
- GNOME 49+ default sessions (X11 disabled by default)
- Pure Wayland applications that don't use XWayland compatibility

**Workaround**: Apps running under XWayland (most GTK/Qt apps) will have an XID and work correctly.

### Another AppMenu Registrar Is Already Running

If another AppMenu registrar (e.g., a previous version of this extension or another global menu implementation) is already running, the extension will:

1. Detect the name conflict via `name_lost` callback
2. Display a clear error state rather than failing silently
3. Stop attempting to export the registrar interface

To resolve: disable the conflicting extension and restart GNOME Shell.

### Menus of Apps Focused Before Extension Enable

When the extension is enabled, it only captures menu information for windows that are registered AFTER enable. Windows that were focused and registered BEFORE the extension was enabled will not have their menus displayed until:

1. The window is unfocused and re-focused, or
2. The application re-exports its menu

This is a known limitation of the Canonical AppMenu protocol design.

### Crashed/Exited Application Cleanup

The extension automatically detects when an application crashes or exits via D-Bus name watching. When this happens:

1. The application's menu entry is removed from the internal registry
2. If the crashed app was focused, the panel menu is cleared
3. No error dialogs or notifications are shown (silent cleanup)

### Menu Export Requirements

This extension only displays menus that are exported by applications. Applications that don't export menus (via `appmenu-gtk-module`, `unity-gtk-module`, Qt platform theme, or equivalent) will show "No Menu" in the panel. Common cases:

- Terminal emulators (typically no menus exported)
- Custom applications using non-standard UI frameworks
- Apps that use `GtkApplication.set_menubar()` without proper export configuration

## Manual QA / Testing

### Unit Tests (menuModel.js)

Run the pure function tests outside the Shell process:

```bash
cd /path/to/extension
make test
```

This runs `test/menuModel.test.js` under plain `gjs`, testing:
- Menu model traversal (top-level entries, submenus, sections)
- Action items with targets
- Separator handling
- Edge cases (empty models, nested structures)

### Manual Compositor Testing

Since menu rendering and focus tracking require the Shell compositor, these must be tested manually:

1. **Setup a nested Shell session**:
   ```bash
   dbus-run-session -- gnome-shell --nested --wayland
   ```

2. **Test app menu export**:
   ```bash
   # Install unity-gtk-module (if not already installed)
   sudo apt install unity-gtk-module-common

   # Run a GTK app with menu export
   GTK_DEBUG=interactive gedit
   ```

3. **Step-by-step manual checklist**:

   - [ ] Extension enables without errors (`gnome-extensions enable <uuid>`)
   - [ ] Panel shows "Desktop" label when no window is focused (if enabled)
   - [ ] Focus a GTK app → panel shows app's menu bar
   - [ ] Switch focus to another GTK app → panel updates to new app's menus
   - [ ] Click menu items in panel → menu actions work in app
   - [ ] Close focused app → panel clears menu
   - [ ] Disable extension (`gnome-extensions disable <uuid>`) → no errors
   - [ ] Re-enable extension → menu bar works again
   - [ ] Repeat enable/disable 5 times → no leaked state
   - [ ] Run multiple apps with menus → each shows correct menu when focused
   - [ ] Check `journalctl /usr/bin/gnome-shell` for errors during all operations

4. **Test name_lost detection**:
   ```bash
   # Run a competing registrar (if available)
   # Verify extension shows error state
   ```

5. **Test XWayland windows**:
   ```bash
   # Run an X11 app under XWayland
   GDK_BACKEND=x11 gedit
   ```

## Troubleshooting

### Blank Panel / No Menu Appears

1. **Check name_lost state**:
   ```bash
   gnome-extensions show global-menu-bar@anorak999.github.com
   ```
   Look for "Status" field. If it shows "Another AppMenu registrar is running", disable conflicting extensions.

2. **Check Shell logs**:
   ```bash
   journalctl /usr/bin/gnome-shell -f
   ```
   Look for "Global Menu Bar: " log messages to see registration events.

3. **Verify extension is enabled**:
   ```bash
   gnome-extensions list --enabled
   ```

### Menu Never Appears for One App

1. **Check if app exports menus**:
   ```bash
   gdbus call --session --dest org.freedesktop.DBus \
     --object-path /org/freedesktop/DBus \
     --method org.freedesktop.DBus.ListNames | grep -i appmenu
   ```
   If the app's bus name isn't in the list, it's not exporting.

2. **Verify toolkit export module**:
   - GTK apps: Check if `unity-gtk-module` is installed and running
   - Qt apps: Verify Qt platform theme supports menu export

3. **Check app's D-Bus interface**:
   ```bash
   gdbus introspect --session --dest <app-bus-name> \
     --object-path /com/canonical/AppMenu/Registrar
   ```

### Extension Crashes on Enable

1. **Check Shell version compatibility**:
   ```bash
   gnome-shell --version
   ```
   Ensure you're running GNOME Shell 46 or 47.

2. **Verify schema is installed**:
   ```bash
   gsettings list-schemas | grep global-menu-bar
   ```

3. **Reinstall extension**:
   ```bash
   make uninstall
   make install
   ```

## License

This extension is licensed under the **GPL-2.0-or-later** license, consistent with GNOME Shell extension conventions.

See [LICENSE](LICENSE) file for full text.

## Changelog

### v1.0 (2026-07-06)

- Initial release
- Support for GNOME Shell 46-47
- X11 and XWayland window support via XID
- Native Wayland documented as unsupported (by design)
- Full enable/disable lifecycle management using connectObject/disconnectObject
- Automatic cleanup of crashed/exited app menus
- Preference UI for appearance customization
- Unit tests for menu model traversal

---

**Author**: Himath Rajapaksha (anorak999)

**Email**: himath.hr@gmail.com

**Repository**: [GitHub](https://github.com/anorak999/global-menu-bar)

**Bug Reports**: [Issues](https://github.com/anorak999/global-menu-bar/issues)
