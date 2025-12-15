import { defineConfig } from "bumpp";

export default defineConfig({
	files: ["package.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml"],
	commit: false,
	tag: false,
	push: false,
});
