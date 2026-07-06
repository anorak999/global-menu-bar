UUID = global-menu-bar@anorak999.github.com
ZIP_FILE = $(UUID).zip
SCHEMA_FILE = schemas/org.gnome.shell.extensions.global-menu-bar.gschema.xml
SCHEMA_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)/schemas

JS_SOURCES = \
	extension.js \
	prefs.js \
	lib/menuModel.js

TEST_SOURCES = \
	test/menuModel.test.js

.PHONY: all clean install uninstall test package compile-check

all: compile-check package

compile-check:
	@echo "Compiling JavaScript sources..."
	@for src in $(JS_SOURCES); do \
		echo "Checking $$src"; \
		gjs -c "$$src" || exit 1; \
	done
	@echo "Compiling test sources..."
	@for src in $(TEST_SOURCES); do \
		echo "Checking $$src"; \
		gjs -c "$$src" || exit 1; \
	done
	@echo "Compiling GSchema..."
	@xmllint --noout $(SCHEMA_FILE) || (echo "Invalid XML in schema"; exit 1)
	@echo "All compile checks passed."

test:
	@echo "Running menuModel tests..."
	@gjs test/menuModel.test.js

package: compile-check
	@echo "Packaging $(ZIP_FILE)..."
	@rm -f $(ZIP_FILE)
	@zip -r $(ZIP_FILE) \
		extension.js \
		prefs.js \
		metadata.json \
		stylesheet.css \
		schemas/$(notdir $(SCHEMA_FILE)) \
		lib/menuModel.js
	@echo "Package created: $(ZIP_FILE)"

install: package
	@echo "Installing extension to $(HOME)/.local/share/gnome-shell/extensions/$(UUID)..."
	@mkdir -p "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)"
	@cp extension.js "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"
	@cp prefs.js "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"
	@cp metadata.json "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"
	@cp stylesheet.css "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/"
	@mkdir -p "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/schemas"
	@cp $(SCHEMA_FILE) "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/schemas/"
	@mkdir -p "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/lib"
	@cp lib/menuModel.js "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/lib/"
	@echo "Compiling schemas..."
	@glib-compile-schemas "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/schemas/" || true
	@echo "Installation complete."

uninstall:
	@echo "Uninstalling extension..."
	@rm -rf "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)"
	@echo "Extension removed."

clean:
	@echo "Cleaning build artifacts..."
	@rm -f $(ZIP_FILE)
	@echo "Clean complete."
