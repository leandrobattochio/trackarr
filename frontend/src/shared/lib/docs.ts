export const WIKI_URL = "https://github.com/leandrobattochio/trackarr/wiki";

export const WIKI_PAGES = [
  { title: "Plugins", url: `${WIKI_URL}/Plugins`, description: "Official, override and custom plugins, and the plugin YAML." },
  { title: "Managing plugins", url: `${WIKI_URL}/Managing-Plugins`, description: "Editing, testing, creating and deleting plugins." },
  { title: "Plugin updates", url: `${WIKI_URL}/Plugin-Updates`, description: "How the official plugins and bases are downloaded." },
  { title: "Writing a plugin", url: `${WIKI_URL}/Writing-a-Plugin`, description: "Plugin bases, JSON APIs and HTML regexes, and how to share a plugin." },
] as const;
