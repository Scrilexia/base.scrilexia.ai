export interface EmbeddingInterface {
	embed(text: string): Promise<number[]>;
	getDimension(): Promise<number>;
}

export abstract class EmbeddingBase implements EmbeddingInterface {
	// biome-ignore lint/complexity/noUselessConstructor: <explanation>
	constructor(_args: Record<string, unknown> = {}) {
		// Initialize with args if necessary
	}

	abstract embed(text: string): Promise<number[]>;
	abstract getDimension(): Promise<number>;
}
