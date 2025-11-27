export class Schema {
	#columnCharacteristics: string[];

	constructor() {
		this.#columnCharacteristics = [];
	}

	addColumn(name: string, type: string): void {
		this.#columnCharacteristics.push(`${name} ${type}`);
	}

	addUniqueContraint(name: string): void {
		this.#columnCharacteristics.push(`UNIQUE INDEX idx_${name} (${name})`);
	}

	addForeignKeyConstraint(
		columnName: string,
		referencedTable: string,
		referencedColumn: string,
		actionOnCascade: string | null = null,
	): void {
		let constraint = `FOREIGN KEY (${columnName}) REFERENCES ${referencedTable}(${referencedColumn})`;
		if (actionOnCascade) {
			constraint += ` ON ${actionOnCascade} CASCADE`;
		}

		this.#columnCharacteristics.push(constraint);
	}

	toString(): string {
		return this.#columnCharacteristics.join(", ");
	}
}
