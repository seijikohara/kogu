// Override ajv-formats types to use the root ajv package.
// ajv-formats bundles its own copy of ajv (as both a dependency and a
// peer dependency), which causes type incompatibility when the root ajv
// version differs. This declaration re-exports the plugin typed against
// the root ajv to eliminate the duplicate-type error.
declare module 'ajv-formats' {
	import type Ajv from 'ajv';

	type FormatMode = 'full' | 'fast';

	type FormatName =
		| 'date'
		| 'time'
		| 'date-time'
		| 'iso-time'
		| 'iso-date-time'
		| 'duration'
		| 'uri'
		| 'uri-reference'
		| 'uri-template'
		| 'url'
		| 'email'
		| 'hostname'
		| 'ipv4'
		| 'ipv6'
		| 'regex'
		| 'uuid'
		| 'json-pointer'
		| 'relative-json-pointer'
		| 'byte'
		| 'int32'
		| 'int64'
		| 'float'
		| 'double'
		| 'password'
		| 'binary';

	interface FormatOptions {
		mode?: FormatMode;
		formats?: FormatName[];
		keywords?: boolean;
	}

	type FormatsPluginOptions = FormatName[] | FormatOptions;

	function addFormats(ajv: Ajv, opts?: FormatsPluginOptions): Ajv;
	export default addFormats;
}
