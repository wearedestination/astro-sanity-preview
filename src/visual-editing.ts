import { enableVisualEditing } from "@sanity/visual-editing";

enableVisualEditing({
	// Pages are rendered on the server, so show changes by reloading.
	refresh: () => {
		location.reload();
		return new Promise(() => {});
	},
	// Keeps the Presentation tool's address bar in step with the page.
	history: {
		subscribe: (navigate) => {
			navigate({ type: "push", url: location.pathname + location.search });
			return () => {};
		},
		update: (update) => {
			if (update.type === "pop") history.back();
			else location.assign(update.url);
		},
	},
});
