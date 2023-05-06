export function objectValidator(object: any) {
	const keys = Object.keys(object);
	for (const key of keys) {
		if (object[key] === undefined) {
			throw Error(`Missing input ${key}`);
		}
	}
}
