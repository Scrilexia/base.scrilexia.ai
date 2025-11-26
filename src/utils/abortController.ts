export class Abort {
	#controller: AbortController;
	constructor() {
		this.#controller = new AbortController();
	}

	reset() {
		this.#controller = new AbortController();
	}

	get controller() {
		return this.#controller;
	}
}

export default new Abort();
