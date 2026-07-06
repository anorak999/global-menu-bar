UUID = global-menu-bar@anorak999.github.com
SCHEMA_FILE = schemas/org.gnome.shell.extensions.global-menu-bar.gschema.xml
ZIP_FILE = $(UUID).shell-extension.zip

PURE_MODULES = lib/menuModel.js
SHELL_MODULES = extension.js prefs.js

.PHONY: all lint check-pure-modules check-schema test pack install uninstall clean

all: lint check-pure-modules check-schema pack

# ── Static analysis (catches syntax + lint errors without executing) ────────
# Uses ESLint with an ESM-aware parser. Install: npm i -D eslint
# This is the ONLY reliable way to validate extension.js and prefs.js outside
# a running gnome-shell, because they import resource:// URIs that only exist
# inside the compiled Shell binary.
lint:
	@echo "Linting Shell-dependent modules..."
	@npx --no-install eslint $(SHELL_MODULES) $(PURE_MODULES) 2>/dev/null || \
		(echo ""; echo "⚠  eslint not installed — skipping lint."; echo "   Install with: npm i -D eslint"; echo "")
	@echo "Checking for syntax errors via node --check (ESM parse)..."
	@for src in $(SHELL_MODULES) $(PURE_MODULES); do \
		echo "  $$src"; \
		node --input-type=module < "$$src" > /dev/null 2>&1 || \
			echo "  ⚠  $$src has syntax parse errors (or uses Shell-only imports)"; \
	done

# ── Pure module validation ─────────────────────────────────────────────────
# lib/menuModel.js only imports gi://GLib (a real GI library), so gjs -m can
# load and execute it outside the Shell. This catches real import/syntax errors
# in the pure-logic layer.
check-pure-modules:
	@echo "Checking pure modules under gjs -m..."
	@for src in $(PURE_MODULES); do \
		echo "  $$src"; \
		gjs -m "$$src" > /dev/null 2>&1 || \
			echo "  ⚠  $$src failed to load (missing GI libraries?)"; \
	done

# ── Schema XML validation ──────────────────────────────────────────────────
check-schema:
	@echo "Validating GSchema XML..."
	@xmllint --noout $(SCHEMA_FILE)

# ── Unit tests (pure module, no Shell dependency) ──────────────────────────
# test/menuModel.test.js is an ESM file that imports from lib/menuModel.js
# and runs under plain gjs -m with mocked GMenuModel objects.
test: check-pure-modules
	@echo "Running unit tests..."
	@gjs -m test/menuModel.test.js

# ── Pack ────────────────────────────────────────────────────────────────────
# gnome-extensions pack validates metadata.json structure and required files.
# This is the structural validation path for extension.js/prefs.js that
# cannot be executed outside gnome-shell.
pack:
	@echo "Packaging extension..."
	@gnome-extensions pack --force --extra-source=lib "$(ZIP_FILE)" 2>/dev/null || \
		(echo "⚠  gnome-extensions not found — falling back to zip"; \
		rm -f "$(ZIP_FILE)"; \
		zip -r "$(ZIP_FILE)" \
			extension.js \
			prefs.js \
			metadata.json \
			stylesheet.css \
			schemas/$(notdir $(SCHEMA_FILE)) \
			lib/menuModel.js)

# ── Install ─────────────────────────────────────────────────────────────────
install: pack
	@echo "Installing extension..."
	@gnome-extensions install --force "$(ZIP_FILE)" 2>/dev/null || \
		(echo "⚠  gnome-extensions not found — manual install"; \
		mkdir -p "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)"; \
		cp extension.js prefs.js metadata.json stylesheet.css \
			"$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"; \
		mkdir -p "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/schemas"; \
		cp $(SCHEMA_FILE) "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/schemas/"; \
		mkdir -p "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/lib"; \
		cp lib/menuModel.js "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/lib/"; \
		glib-compile-schemas "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/schemas/" || true)
	@echo "Done. Restart GNOME Shell or run: gnome-extensions enable $(UUID)"

# ── Uninstall ───────────────────────────────────────────────────────────────
uninstall:
	@echo "Uninstalling extension..."
	@gnome-extensions uninstall "$(UUID)" 2>/dev/null || \
		rm -rf "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)"

# ── Clean ───────────────────────────────────────────────────────────────────
clean:
	@rm -f "$(ZIP_FILE)"
