export class Vector {
	#vector: number[];

	constructor(vector: number[]) {
		this.#vector = vector;
	}
	get vector(): number[] {
		return this.#vector;
	}

	normalize(): void {
		const magnitude = Math.sqrt(
			this.#vector.reduce((sum, value) => sum + value * value, 0),
		);
		if (magnitude === 0) {
			throw new Error("Cannot normalize a zero vector");
		}
		this.#vector = this.#vector.map((value) => value / magnitude);
	}

	static center(vectors: Array<Vector>): Vector {
		if (vectors.length === 0) {
			throw new Error("Vector array is empty.");
		}
		const size = vectors[0].vector.length;
		const result = new Array(size).fill(0);
		for (const embedding of vectors) {
			if (embedding.vector.length !== size) {
				throw new Error("All vectors must have the same size.");
			}
			embedding.normalize();
			for (let i = 0; i < size; i++) {
				result[i] += embedding.vector[i];
			}
		}
		for (let i = 0; i < size; i++) {
			result[i] /= vectors.length;
		}
		const centeredEmbedding = new Vector(result);
		centeredEmbedding.normalize();
		return centeredEmbedding;
	}
}
