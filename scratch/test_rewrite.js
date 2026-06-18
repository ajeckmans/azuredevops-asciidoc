const Asciidoctor = require('@asciidoctor/core');
const asciidoctor = Asciidoctor();

const cache = new Map();

function resolvePath(currentPath, target) {
    if (target.startsWith('/')) return target;
    const dir = currentPath.substring(0, currentPath.lastIndexOf('/'));
    const parts = (dir + '/' + target).split('/');
    const stack = [];
    for (const part of parts) {
        if (part === '..') stack.pop();
        else if (part !== '.' && part !== '') stack.push(part);
    }
    return '/' + stack.join('/');
}

// Mock fetch
async function fetchFile(path) {
    if (path === '/docs/components/auth.adoc') {
        return "Auth Component.\n\ninclude::api.adoc[]\n";
    } else if (path === '/docs/components/api.adoc') {
        return "API Component.";
    }
    return null;
}

async function prefetch(text, currentPath) {
    let newText = text;
    const regex = /^include::([^\[]+)\[(.*?)\]/gm;
    let match;
    const promises = [];
    const replacements = [];

    while ((match = regex.exec(text)) !== null) {
        const fullMatch = match[0];
        const target = match[1];
        const attrs = match[2];
        const absPath = resolvePath(currentPath, target);
        replacements.push({ fullMatch, absPath, attrs });

        if (!cache.has(absPath)) {
            cache.set(absPath, "");
            promises.push((async () => {
                const content = await fetchFile(absPath);
                if (content) {
                    const rewrittenContent = await prefetch(content, absPath);
                    cache.set(absPath, rewrittenContent);
                } else {
                    cache.set(absPath, `// NOT FOUND: ${absPath}`);
                }
            })());
        }
    }

    await Promise.all(promises);

    for (const rep of replacements) {
        newText = newText.replace(rep.fullMatch, `include::${rep.absPath}[${rep.attrs}]`);
    }

    return newText;
}

async function run() {
    const rootPath = '/docs/index.adoc';
    const rootContent = `= Title\n\ninclude::components/auth.adoc[]\n`;

    const rewrittenRoot = await prefetch(rootContent, rootPath);
    console.log("Rewritten Root:\n" + rewrittenRoot);
    console.log("Cache:", cache);

    const registry = asciidoctor.Extensions.create();
    registry.includeProcessor(function () {
        this.handles((target) => true);
        this.process((doc, reader, target, attrs) => {
            console.log("Processor intercepted:", target);
            const data = cache.get(target);
            if (data !== undefined) {
                reader.pushInclude(data, target, target, 1, attrs);
            } else {
                reader.pushInclude(`// UNKNOWN: ${target}`, target, target, 1, attrs);
            }
        });
    });

    const html = asciidoctor.convert(rewrittenRoot, {
        safe: 'safe',
        extension_registry: registry
    });

    console.log("\nHTML:\n" + html);
}

run();
