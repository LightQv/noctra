const uiShell = require("../../ui/shell/manager");
const bookmarksService = require("./service");

const PAGE_SIZE = 9;

class BookmarkInsertScopeModal {
  constructor() {
    this.active = false;
    this.entry = null;
    this.stack = [];
    this.pageByLevel = [];
    this.confirmIndex = 0;
  }

  isActive() {
    return this.active;
  }

  open(entry) {
    this.entry = {
      title: String(entry?.title || "").trim(),
      url: String(entry?.url || "").trim(),
    };
    this.stack = [];
    this.pageByLevel = [0];
    this.confirmIndex = 0;
    this.active = true;
    uiShell.showSelectionModal(this.buildModel());
  }

  close() {
    this.active = false;
    this.entry = null;
    this.stack = [];
    this.pageByLevel = [];
    this.confirmIndex = 0;
    uiShell.hideSelectionModal();
  }

  getCurrentFolderPath() {
    return this.stack.map((folder) => folder.id);
  }

  getCurrentFolders() {
    return bookmarksService.listFolderChildrenByPath(
      this.getCurrentFolderPath(),
    );
  }

  getCurrentPage() {
    const level = this.stack.length;
    const page = Number(this.pageByLevel[level] || 0);
    return Math.max(0, page);
  }

  setCurrentPage(page) {
    const level = this.stack.length;
    this.pageByLevel[level] = Math.max(0, Math.floor(page));
  }

  isConfirmStep() {
    return this.getCurrentFolders().length === 0;
  }

  hasDuplicateInCurrentScope() {
    const url = String(this.entry?.url || "").trim();
    if (!url) return false;
    return bookmarksService.hasEntryUrlAtFolderPath(
      this.getCurrentFolderPath(),
      url,
    );
  }

  buildModel() {
    const depth = this.stack.length;
    const pathText = depth
      ? `Scope: root/${this.stack.map((item) => item.name).join("/")}`
      : "Scope: root";
    const pageTitle = this.entry?.title || this.entry?.url || "current page";
    const promptTitle = `Add "${pageTitle}" to bookmarks`;
    const urlLine = String(this.entry?.url || "");

    if (this.isConfirmStep()) {
      const duplicateInScope = this.hasDuplicateInCurrentScope();
      const confirmSelected = this.confirmIndex === 0;
      return {
        title: "Bookmark",
        promptTitle,
        urlLine,
        scopeLabel: pathText,
        items: [duplicateInScope ? "confirm (exists)" : "confirm", "cancel"],
        indexHints: ["(enter)", "(esc)"],
        selectedIndex: duplicateInScope ? 1 : confirmSelected ? 0 : 1,
        footerLeft: duplicateInScope
          ? "URL already exists in this folder"
          : "h/l choose",
        footerRight: duplicateInScope ? "confirm disabled" : "Enter confirm",
      };
    }

    const folders = this.getCurrentFolders();
    const totalPages = Math.max(1, Math.ceil(folders.length / PAGE_SIZE));
    const page = Math.min(this.getCurrentPage(), totalPages - 1);
    this.setCurrentPage(page);
    const start = page * PAGE_SIZE;
    const pageFolders = folders.slice(start, start + PAGE_SIZE);

    const items = ["current"];
    const indexHints = ["(0)"];
    for (let index = 0; index < pageFolders.length; index += 1) {
      items.push(pageFolders[index].name);
      indexHints.push(`(${index + 1})`);
    }

    const footerLeft = totalPages > 1 ? "h/l page" : "";
    const footerRight =
      totalPages > 1 ? `page ${page + 1}/${totalPages}` : "0-9 select";
    return {
      title: "Bookmark",
      promptTitle,
      urlLine,
      scopeLabel: pathText,
      items,
      indexHints,
      footerLeft,
      footerRight,
    };
  }

  rerender() {
    if (!this.active) return;
    uiShell.updateSelectionModal(this.buildModel());
  }

  confirmInsert() {
    const result = bookmarksService.appendEntryAtFolderPath(
      this.getCurrentFolderPath(),
      {
        id: bookmarksService.makeEntryId(),
        title: this.entry.title || this.entry.url,
        url: this.entry.url,
      },
    );
    this.close();
    return result?.status === "inserted";
  }

  handleInput(input) {
    if (!this.active || !input || input.type !== "keyDown") {
      return false;
    }

    const key = String(input.key || "");

    if (key === "Escape") {
      if (this.stack.length === 0) {
        this.close();
        return true;
      }
      this.stack.pop();
      this.confirmIndex = 0;
      this.rerender();
      return true;
    }

    if (this.isConfirmStep()) {
      if (key === "h" || key === "ArrowLeft") {
        if (this.hasDuplicateInCurrentScope()) {
          this.confirmIndex = 1;
          this.rerender();
          return true;
        }
        this.confirmIndex = 0;
        this.rerender();
        return true;
      }
      if (key === "l" || key === "ArrowRight") {
        this.confirmIndex = 1;
        this.rerender();
        return true;
      }
      if (key === "Enter") {
        if (this.confirmIndex === 0) {
          if (this.hasDuplicateInCurrentScope()) {
            this.confirmIndex = 1;
            this.rerender();
            return true;
          }
          this.confirmInsert();
        } else {
          this.close();
        }
        return true;
      }
      return true;
    }

    const folders = this.getCurrentFolders();
    const totalPages = Math.max(1, Math.ceil(folders.length / PAGE_SIZE));
    const page = Math.min(this.getCurrentPage(), totalPages - 1);

    if ((key === "h" || key === "ArrowLeft") && totalPages > 1) {
      this.setCurrentPage((page - 1 + totalPages) % totalPages);
      this.rerender();
      return true;
    }
    if ((key === "l" || key === "ArrowRight") && totalPages > 1) {
      this.setCurrentPage((page + 1) % totalPages);
      this.rerender();
      return true;
    }

    if (!/^[0-9]$/.test(key)) {
      return true;
    }

    const selected = Number.parseInt(key, 10);
    if (selected === 0) {
      this.confirmIndex = 0;
      this.rerender();
      return true;
    }

    const idx = selected - 1;
    const start = page * PAGE_SIZE;
    const node = folders[start + idx];
    if (!node) {
      return true;
    }

    this.stack.push({ id: node.id, name: node.name });
    this.confirmIndex = 0;
    this.rerender();
    return true;
  }

  selectIndex(index) {
    if (!this.active) return false;
    const idx = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : -1;
    if (idx < 0) return false;

    if (this.isConfirmStep()) {
      if (idx === 0) {
        if (this.hasDuplicateInCurrentScope()) {
          this.confirmIndex = 1;
          this.rerender();
          return true;
        }
        this.confirmInsert();
        return true;
      }
      this.close();
      return true;
    }

    if (idx === 0) {
      this.confirmIndex = 0;
      this.rerender();
      return true;
    }

    const folders = this.getCurrentFolders();
    const totalPages = Math.max(1, Math.ceil(folders.length / PAGE_SIZE));
    const page = Math.min(this.getCurrentPage(), totalPages - 1);
    const start = page * PAGE_SIZE;
    const node = folders[start + idx - 1];
    if (!node) return true;
    this.stack.push({ id: node.id, name: node.name });
    this.confirmIndex = 0;
    this.rerender();
    return true;
  }
}

function createBookmarkInsertScopeModal() {
  return new BookmarkInsertScopeModal();
}

const defaultBookmarkInsertScopeModal = createBookmarkInsertScopeModal();

module.exports = defaultBookmarkInsertScopeModal;
module.exports.BookmarkInsertScopeModal = BookmarkInsertScopeModal;
module.exports.createBookmarkInsertScopeModal = createBookmarkInsertScopeModal;
