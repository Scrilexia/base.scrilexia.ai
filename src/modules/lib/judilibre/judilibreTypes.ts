export class TextZoneSegment {
	start: number;
	end: number;

	constructor(start = 0, end = 0) {
		this.start = start;
		this.end = end;
	}
}

export class Visa {
	title: string;

	constructor(title = "") {
		this.title = title;
	}
}

export class TitlesAndSummary {
	titles: string[];
	summary: string;

	constructor(titles: string[] = [], summary = "") {
		this.titles = titles;
		this.summary = summary;
	}
}

export class TextZoneSegments {
	introduction: TextZoneSegment[];
	expose: TextZoneSegment[];
	moyens: TextZoneSegment[];
	motivations: TextZoneSegment[];
	dispositif: TextZoneSegment[];
	annexes: TextZoneSegment[];

	constructor(
		introduction = Array<TextZoneSegment>(),
		expose = Array<TextZoneSegment>(),
		moyens = Array<TextZoneSegment>(),
		motivations = Array<TextZoneSegment>(),
		dispositif = Array<TextZoneSegment>(),
		annexes = Array<TextZoneSegment>(),
	) {
		this.introduction = introduction;
		this.expose = expose;
		this.moyens = moyens;
		this.motivations = motivations;
		this.dispositif = dispositif;
		this.annexes = annexes;
	}
}

export class JudiDecision {
	id: string;
	text: string;
	jurisdiction: string;
	chamber: string;
	location: string;
	number: string;
	decision_date: string;
	type: string;
	solution: string;
	summary: string;
	themes: string[];
	titlesAndSummaries: TitlesAndSummary[];
	zones: TextZoneSegments;
	visas: Visa[];

	constructor(
		id = "",
		text = "",
		jurisdiction = "",
		chamber = "",
		location = "",
		decision_date = "",
		type = "",
		solution = "",
		number = "",
		summary = "",
		themes = [],
		titlesAndSummaries = [],
		zones = new TextZoneSegments(),
		visas = [],
	) {
		this.id = id;
		this.text = text;
		this.jurisdiction = jurisdiction;
		this.chamber = chamber;
		this.location = location;
		this.decision_date = decision_date;
		this.type = type;
		this.solution = solution;
		this.number = number;
		this.titlesAndSummaries = titlesAndSummaries;
		this.summary = summary;
		this.themes = themes;
		this.zones = zones;
		this.visas = visas;
	}
}

export enum Jurisdiction {
	COUR_DE_CASSATION = "cc",
	COURS_APPEL = "ca",
	TRIBUNAL_JUDICIAIRE = "tj",
	TRIBUNAL_DE_COMMERCE = "tcom",
}
