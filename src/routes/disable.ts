import type { APIRoute } from "astro";
import { disableDraftMode } from "../client";

export const GET: APIRoute = ({ cookies, redirect }) => {
	disableDraftMode(cookies);

	return redirect("/", 307);
};
