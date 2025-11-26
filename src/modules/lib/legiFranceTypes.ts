export class ArticleSearchResult {
	id: string;
	num: string;
	texte: string;
	etat: string;
	dateDebut: string | number;
	dateFin: string | number;
	dateVersion: string;
	title?: string | null;

	constructor(
		id = "",
		num = "",
		texte = "",
		etat = "",
		dateDebut = "",
		dateFin = "",
		dateVersion = "",
	) {
		this.id = id;
		this.num = num;
		this.texte = texte;
		this.etat = etat;
		this.dateDebut = dateDebut;
		this.dateFin = dateFin;
		this.dateVersion = dateVersion;
		this.title = null;
	}
}

export class LegiFranceCodeArticleOnline {
	id: string;
	num: string;
	texte: string;
	content: string;
	etat: string | undefined | null;
	dateDebut: number;
	dateFin: number;

	constructor(
		_id = "",
		_num = "",
		_texte = "",
		_content = "",
		_etat = null,
		_dateDebut = 0,
		_dateFin = 0,
	) {
		this.id = _id;
		this.num = _num;
		this.texte = _texte;
		this.content = _content;
		this.etat = _etat;
		this.dateDebut = _dateDebut;
		this.dateFin = _dateFin;
	}
}

export class LegiFranceCodeSectionOnline {
	id: string;
	articles: Array<LegiFranceCodeArticleOnline>;
	sections: Array<LegiFranceCodeSectionOnline>;

	constructor(
		_id = "",
		_articles: Array<LegiFranceCodeArticleOnline> = [],
		_sections: Array<LegiFranceCodeSectionOnline> = [],
	) {
		this.id = _id;
		this.articles = _articles;
		this.sections = _sections;
	}
}

export class LegiFranceCodeOnline {
	id: string;
	title: string | undefined;
	dateDebutVersion: string;
	dateFinVersion: string;
	articles: Array<LegiFranceCodeArticleOnline>;
	sections: Array<LegiFranceCodeSectionOnline>;

	constructor(
		_id = "",
		_title = undefined,
		_dateDebutVersion = "",
		_dateFinVersion = "",
		_articles: Array<LegiFranceCodeArticleOnline> = [],
		_sections: Array<LegiFranceCodeSectionOnline> = [],
	) {
		this.id = _id;
		this.title = _title;
		this.dateDebutVersion = _dateDebutVersion;
		this.dateFinVersion = _dateFinVersion;
		this.articles = _articles;
		this.sections = _sections;
	}
}

export class CodeSearchResult {
	id: string;
	cid: string;
	etat: string;
	titre: string;
	dateDebut: string;
	dateFin: string;
	lastUpdate: string;
	pdfFileName: string | null;
	pdfFileSize: string | null;
	pdfFilePath: string | null;

	constructor(
		_id = "",
		_cid = "",
		_etat = "",
		_titre = "",
		_dateDebut = "",
		_dateFin = "",
		_lastUpdate = "",
		_pdfFileName = null,
		_pdfFileSize = null,
		_pdfFilePath = null,
	) {
		this.id = _id;
		this.cid = _cid;
		this.etat = _etat;
		this.titre = _titre;
		this.dateDebut = _dateDebut;
		this.dateFin = _dateFin;
		this.lastUpdate = _lastUpdate;
		this.pdfFileName = _pdfFileName;
		this.pdfFileSize = _pdfFileSize;
		this.pdfFilePath = _pdfFilePath;
	}
}

export class CodeSearchResults {
	results: Array<CodeSearchResult>;

	constructor(_results = Array<CodeSearchResult>(0)) {
		this.results = _results;
	}
}
