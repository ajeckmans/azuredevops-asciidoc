// Service for rendering PlantUML diagrams entirely client-side using PlantUML TeaVM JS

let plantUmlModulePromise: Promise<typeof import('../vendor/plantuml.js')> | null = null;
let stdlibLoaderInitialized = false;

// Sequential execution queue to prevent race conditions in TeaVM state
let queuePromise: Promise<any> = Promise.resolve();

// Memory cache for rendered SVGs: key = source + (dark ? ":dark" : ":light")
const svgCache = new Map<string, string>();

function initStdlibLoader() {
    if (stdlibLoaderInitialized || typeof window === 'undefined') return;
    stdlibLoaderInitialized = true;

    const win = window as any;
    win.PLANTUML_STDLIB_LOADER = (name: string, ok: () => void, fail: (msg: string) => void) => {
        const baseName = name.replace(/\.min\.js$/, "").replace(/\.js$/, "").toLowerCase();
        
        let loader: (() => Promise<any>) | null = null;
        if (baseName === 'c4') {
            loader = () => import(/* webpackChunkName: "puml-stdlib-c4" */ '../vendor/stdlib/c4.min.js');
        } else if (baseName === 'azure') {
            loader = () => import(/* webpackChunkName: "puml-stdlib-azure" */ '../vendor/stdlib/azure.min.js');
        } else if (baseName === 'archimate') {
            loader = () => import(/* webpackChunkName: "puml-stdlib-archimate" */ '../vendor/stdlib/archimate.min.js');
        } else if (baseName === 'kubernetes') {
            loader = () => import(/* webpackChunkName: "puml-stdlib-kubernetes" */ '../vendor/stdlib/kubernetes.min.js');
        }

        if (loader) {
            loader()
                .then(() => ok())
                .catch((err) => fail(err && err.message ? err.message : String(err)));
            return true;
        }

        fail(`Stdlib '${name}' not available offline.`);
        return true;
    };
}

export interface RenderPlantUmlOptions {
    dark?: boolean;
}

/**
 * Renders a PlantUML diagram source string to an SVG string.
 * This runs entirely client-side with no external server requests.
 */
export async function renderPlantUml(source: string, options?: RenderPlantUmlOptions): Promise<string> {
    const isDark = !!(options && options.dark);
    const cacheKey = `${source}:${isDark ? 'dark' : 'light'}`;

    const cached = svgCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    if (!plantUmlModulePromise) {
        initStdlibLoader();
        plantUmlModulePromise = import(/* webpackChunkName: "plantuml" */ '../vendor/plantuml.js');
    }

    const plantuml = await plantUmlModulePromise;

    // Normalize source into lines
    let lines = source.split(/\r?\n/);
    // Ensure @startuml and @enduml tags exist if missing
    const hasStart = lines.some(l => l.trim().startsWith('@start'));
    const hasEnd = lines.some(l => l.trim().startsWith('@end'));
    if (!hasStart) {
        lines = ['@startuml', ...lines];
    }
    if (!hasEnd) {
        lines = [...lines, '@enduml'];
    }

    // Queue sequentially to protect TeaVM internal thread state
    const result = new Promise<string>((resolve, reject) => {
        queuePromise = queuePromise.then(() => {
            return new Promise<void>((next) => {
                const timeout = setTimeout(() => {
                    next();
                    reject(new Error("PlantUML rendering timed out"));
                }, 20000);

                try {
                    plantuml.renderToString(
                        lines,
                        (svg: string) => {
                            clearTimeout(timeout);
                            svgCache.set(cacheKey, svg);
                            next();
                            resolve(svg);
                        },
                        (err: any) => {
                            clearTimeout(timeout);
                            const message = err && err.message ? err.message : String(err);
                            next();
                            reject(new Error(message));
                        },
                        { dark: isDark }
                    );
                } catch (e: any) {
                    clearTimeout(timeout);
                    next();
                    reject(e);
                }
            });
        });
    });

    return result;
}

/**
 * Checks if AsciiDoc text contains any PlantUML diagram blocks
 */
export function containsPlantUml(content: string): boolean {
    return /(?:\[(?:plantuml|c4plantuml)[^\]]*\])|(?:@startuml)/i.test(content);
}
