export interface SiteStructure {
	landingPageRoute: string | null;
	defaultApp: string | null;
	pathMap: { [k: string]: string };
}
