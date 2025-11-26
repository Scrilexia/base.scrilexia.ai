export function cosineSimilarity(
	firstVactor: number[],
	secondVector: number[],
): number {
	if (firstVactor.length !== secondVector.length) {
		throw new Error("Vectors must be of the same length");
	}

	const dotProduct = firstVactor.reduce(
		(sum, value, index) => sum + value * secondVector[index],
		0,
	);
	const magnitudeFirstVector = Math.sqrt(
		firstVactor.reduce((sum, value) => sum + value * value, 0),
	);
	const magnitudeSecondVector = Math.sqrt(
		secondVector.reduce((sum, value) => sum + value * value, 0),
	);

	return dotProduct / (magnitudeFirstVector * magnitudeSecondVector);
}

export function normalizeVector(vector: number[]): number[] {
	const magnitude = Math.sqrt(
		vector.reduce((sum, value) => sum + value * value, 0),
	);
	if (magnitude === 0) {
		throw new Error("Cannot normalize a zero vector");
	}
	return vector.map((value) => value / magnitude);
}

export function oppositeVector(vector: number[]): number[] {
	return vector.map((value) => -value);
}

export function updateBarycenter(
	previousBarycenter: number[],
	numberOfVectors: number,
	vector: number[],
): number[] {
	if (previousBarycenter.length !== vector.length) {
		throw new Error("Barycenter and vector must be of the same length");
	}

	if (numberOfVectors === 0) {
		return vector;
	}

	return previousBarycenter.map(
		(value, index) =>
			(numberOfVectors * value + vector[index]) / (numberOfVectors + 1),
	);
}
