import * as React from "react";
import Asciidoctor from "@asciidoctor/core";
import * as Diff from 'diff';
import hljs from 'highlight.js';
import 'highlight.js/styles/default.css';
import { DevOpsService } from "../services/DevOpsService";
import '@fortawesome/fontawesome-free/css/all.min.css';
import './AsciiDocRenderer.css';
import DOMPurify from 'dompurify';

DOMPurify.addHook('afterSanitizeAttributes', function(node) {
    if (node.tagName && node.tagName.toLowerCase() === 'a') {
        const href = node.getAttribute('href');
        // Only set target="_blank" for external links
        if (href && (href.startsWith('http') || href.startsWith('//'))) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        } else {
            node.removeAttribute('target');
        }
    }
});

const asciidoctor = Asciidoctor();

export interface AsciiDocRendererProps {
    content: string;
    previousContent?: string;
    filePath: string;
    onLinkClick?: (path: string) => void;
    fetchFileContent?: (path: string) => Promise<string | null>;
}

function resolvePath(currentPath: string, target: string): string | null {
    if (target.startsWith('/')) return target;
    const dir = currentPath.substring(0, currentPath.lastIndexOf('/'));
    const parts = (dir + '/' + target).split('/');
    const stack: string[] = [];
    for (const part of parts) {
        if (part === '..') {
            if (stack.length === 0) {
                console.warn(`Path traversal blocked: ${target}`);
                return null;
            }
            stack.pop();
        }
        else if (part !== '.' && part !== '') stack.push(part);
    }
    return '/' + stack.join('/');
}

// ⚡ Bolt: Memoized AsciiDocRenderer to prevent expensive asciidoctor.load().convert() re-runs
export const AsciiDocRenderer: React.FC<AsciiDocRendererProps> = React.memo(({ content, previousContent, filePath, onLinkClick, fetchFileContent }) => {
    const [isDarkTheme, setIsDarkTheme] = React.useState<boolean>(false);
    const [htmlContent, setHtmlContent] = React.useState<string>("");

    React.useEffect(() => {
        let isMounted = true;
        const updateTheme = () => {
            if (!isMounted) return;
            const textPrimary = getComputedStyle(document.body).getPropertyValue('--text-primary-color');
            if (textPrimary && (textPrimary.includes('255') || textPrimary.includes('fff') || textPrimary.toLowerCase().includes('rgba(255') || textPrimary.includes('250'))) {
                setIsDarkTheme(true);
            } else {
                setIsDarkTheme(false);
            }
        };

        const timer = setTimeout(updateTheme, 100);

        window.addEventListener("themeApplied", updateTheme);
        return () => {
            isMounted = false;
            clearTimeout(timer);
            window.removeEventListener("themeApplied", updateTheme);
        };
    }, []);

    React.useEffect(() => {
        let isCancelled = false;

        const processAndConvert = async () => {
            const cache = new Map<string, string>();
            let krokiSettings: { renderPlantUML: boolean, krokiServerUrl: string } | null = null;
            try {
                krokiSettings = await DevOpsService.getKrokiSettings();
            } catch (e) {
                console.warn("Failed to get kroki settings", e);
            }

            const prefetch = async (text: string, currentPath: string, depth: number = 0): Promise<string> => {
                if (depth > 20) return text; // max depth
                let newText = text;
                const regex = /^include::([^\[]+)\[(.*?)\]/gm;
                let match;
                const promises: Promise<void>[] = [];
                const replacements: { fullMatch: string, absPath: string, attrs: string }[] = [];

                while ((match = regex.exec(text)) !== null) {
                    const fullMatch = match[0];
                    const target = match[1];
                    const attrs = match[2];
                    const absPath = resolvePath(currentPath, target);

                    if (absPath === null) {
                        replacements.push({ fullMatch, absPath: `// PATH TRAVERSAL BLOCKED: ${target}`, attrs: '' });
                        continue;
                    }

                    replacements.push({ fullMatch, absPath, attrs });

                    if (!cache.has(absPath) && fetchFileContent) {
                        cache.set(absPath, ""); // mark pending
                        promises.push((async () => {
                            try {
                                const fetchedContent = await fetchFileContent(absPath);
                                if (fetchedContent) {
                                    const rewrittenContent = await prefetch(fetchedContent, absPath, depth + 1);
                                    cache.set(absPath, rewrittenContent);
                                } else {
                                    cache.set(absPath, `// INCLUDE NOT FOUND: ${absPath}`);
                                }
                            } catch (e) {
                                cache.set(absPath, `// ERROR FETCHING INCLUDE: ${absPath}`);
                            }
                        })());
                    }
                }

                await Promise.all(promises);

                for (const rep of replacements) {
                    // Safe string replacement replacing all exact occurrences
                    if (rep.absPath.startsWith('// PATH TRAVERSAL BLOCKED')) {
                        newText = newText.split(rep.fullMatch).join(rep.absPath);
                    } else {
                        newText = newText.split(rep.fullMatch).join(`include::${rep.absPath}[${rep.attrs}]`);
                    }
                }

                return newText;
            };

            const rewrittenContent = await prefetch(content, filePath);
            if (isCancelled) return;

            const registry = asciidoctor.Extensions.create();
            registry.includeProcessor(function () {
                this.handles((target) => true);
                this.process((doc: any, reader: any, target: string, attrs: any) => {
                    const data = cache.get(target);
                    if (data !== undefined && data !== "") {
                        reader.pushInclude(data, target, target, 1, attrs);
                    } else {
                        reader.pushInclude(`// UNRESOLVED INCLUDE: ${target}`, target, target, 1, attrs);
                    }
                });
            });

            if (krokiSettings && krokiSettings.renderPlantUML && krokiSettings.krokiServerUrl) {
                const krokiDiagramTypes = ['plantuml', 'mermaid', 'ditaa', 'graphviz', 'c4plantuml', 'svgbob', 'nomnoml', 'erd', 'vega', 'vegalite', 'wavedrom', 'pikchr', 'umlet', 'bpmn', 'excalidraw', 'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'packetdiag', 'rackdiag', 'structurizr', 'dbml', 'wireviz'];
                registry.block(function () {
                    krokiDiagramTypes.forEach(type => {
                        this.named(type);
                    });
                    this.onContext(['listing', 'literal', 'open']);
                    this.process(function(this: any, parent: any, reader: any, attrs: any) {
                        const lines = reader.getLines().join('\n');
                        const encoded = btoa(unescape(encodeURIComponent(lines)));
                        const type = (this as any).name || attrs.style || 'plantuml';
                        return (this as any).createBlock(parent, 'pass', `<div class="async-diagram" data-type="${type}" data-content="${encoded}"></div>`);
                    });
                });
            }

            const options = {
                safe: 'safe',
                extension_registry: registry,
                sourcemap: true,
                attributes: {
                    showtitle: true,
                    outfilesuffix: '.adoc',
                    icons: 'font',
                    'source-highlighter': 'highlight.js'
                }
            };

            // Yield to main thread before heavy processing
            await new Promise(resolve => setTimeout(resolve, 0));
            if (isCancelled) return;

            const html = await new Promise<string>((resolve) => {
                const doc = asciidoctor.load(rewrittenContent, options);
                const blocks = doc.findBy((b: any) => typeof b.getLineNumber() !== 'undefined');
                blocks.forEach((block: any) => {
                    block.setId(`adoc-source-line-${block.getLineNumber()}`);
                });
                resolve(doc.convert() as string);
            });

            if (isCancelled) return;

            // Sanitize the HTML to prevent XSS (can also be slow for huge files)
            await new Promise(resolve => setTimeout(resolve, 0));
            if (isCancelled) return;

            const sanitizedHtml = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });

            if (!isCancelled) {
                setHtmlContent(sanitizedHtml);
            }
        };

        processAndConvert();

        return () => { isCancelled = true; };
    }, [content, filePath, fetchFileContent]);

    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (contentRef.current) {
            const asyncDiagrams = contentRef.current.querySelectorAll('.async-diagram');
            if (asyncDiagrams.length > 0) {
                DevOpsService.getKrokiSettings().then(settings => {
                    if (settings && settings.krokiServerUrl) {
                        const baseUrl = settings.krokiServerUrl.endsWith('/') ? settings.krokiServerUrl : settings.krokiServerUrl + '/';
                        asyncDiagrams.forEach((diagram) => {
                            if (diagram.getAttribute('data-processed')) return;
                            diagram.setAttribute('data-processed', 'true');
                            diagram.innerHTML = "<div>Loading diagram...</div>";
                            const encoded = diagram.getAttribute('data-content');
                            const type = diagram.getAttribute('data-type');
                            if (encoded && type) {
                                const source = decodeURIComponent(escape(atob(encoded)));
                                fetch(baseUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        diagram_source: source,
                                        diagram_type: type,
                                        output_format: 'svg'
                                    })
                                })
                                .then(res => res.text())
                                .then(svg => {
                                    diagram.innerHTML = svg;
                                })
                                .catch(e => {
                                    console.error("Failed to fetch diagram from custom server", e);
                                    diagram.innerHTML = `<div style="color:red;">Error rendering diagram: ${e.message}</div>`;
                                });
                            }
                        });
                    }
                });
            }
            const blocks = contentRef.current.querySelectorAll('pre code');
            blocks.forEach((block) => {
                hljs.highlightElement(block as HTMLElement);
            });

            const links = contentRef.current.querySelectorAll('a');
            links.forEach((anchor) => {
                const href = anchor.getAttribute("href");
                if (href && !href.startsWith("http") && !href.startsWith("#")) {
                    const finalPath = resolvePath(filePath, href);
                    if (finalPath) {
                        let newHref = "#" + finalPath;
                        try {
                            if (document.referrer) {
                                const url = new URL(document.referrer);
                                url.searchParams.set("path", finalPath);
                                newHref = url.toString();
                            }
                        } catch (e) {}
                        anchor.setAttribute("href", newHref);
                        anchor.setAttribute("data-internal-path", finalPath);
                    }
                }
            });

            // Visual Diff Rendering
            if (previousContent !== undefined && previousContent !== "") {
                setTimeout(() => {
                    try {
                        const changes = Diff.diffLines(previousContent, content);
                        let newLineNum = 1;
                        
                        // Remove existing diff markers if any
                        contentRef.current?.querySelectorAll('.visual-diff-deleted-marker').forEach(e => e.remove());
                        contentRef.current?.querySelectorAll('.visual-diff-added').forEach(e => e.classList.remove('visual-diff-added'));
                        contentRef.current?.querySelectorAll('.visual-diff-changed').forEach(e => e.classList.remove('visual-diff-changed'));
                        contentRef.current?.querySelectorAll('.visual-diff-sr-text').forEach(e => e.remove());

                        const srOnlyStyle = "position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;";

                        let i = 0;
                        while (i < changes.length) {
                            const change = changes[i];
                            const count = change.count || 0;

                            if (change.removed) {
                                if (i + 1 < changes.length && changes[i+1].added) {
                                    // Modification (Removed followed by Added)
                                    const nextCount = changes[i+1].count || 0;
                                    for (let j = 0; j < nextCount; j++) {
                                        const targetLine = newLineNum + j;
                                        const elem = document.getElementById(`adoc-source-line-${targetLine}`);
                                        if (elem) {
                                            elem.classList.add("visual-diff-changed");
                                            const srSpan = document.createElement("span");
                                            srSpan.className = "visual-diff-sr-text";
                                            srSpan.style.cssText = srOnlyStyle;
                                            srSpan.innerText = "Changed line: ";
                                            elem.insertBefore(srSpan, elem.firstChild);
                                        }
                                    }
                                    newLineNum += nextCount;
                                    i += 2; // Skip both
                                    continue;
                                } else {
                                    // Pure deletion
                                    let targetLine = newLineNum; 
                                    let elem = document.getElementById(`adoc-source-line-${targetLine}`);
                                    if (!elem && targetLine > 1) {
                                        elem = document.getElementById(`adoc-source-line-${targetLine - 1}`);
                                    }
                                    if (elem && elem.parentNode) {
                                        const marker = document.createElement("div");
                                        marker.className = "visual-diff-deleted-marker";
                                        marker.innerHTML = `<span aria-hidden="true" class="left-icon flex-noshrink fabric-icon ms-Icon--Cancel medium"></span><span class="visual-diff-sr-text" style="${srOnlyStyle}">Deleted line here</span>`;
                                        elem.parentNode.insertBefore(marker, elem);
                                    }
                                }
                            } else if (change.added) {
                                if (i + 1 < changes.length && changes[i+1].removed) {
                                    // Modification (Added followed by Removed)
                                    for (let j = 0; j < count; j++) {
                                        const targetLine = newLineNum + j;
                                        const elem = document.getElementById(`adoc-source-line-${targetLine}`);
                                        if (elem) {
                                            elem.classList.add("visual-diff-changed");
                                            const srSpan = document.createElement("span");
                                            srSpan.className = "visual-diff-sr-text";
                                            srSpan.style.cssText = srOnlyStyle;
                                            srSpan.innerText = "Changed line: ";
                                            elem.insertBefore(srSpan, elem.firstChild);
                                        }
                                    }
                                    newLineNum += count;
                                    i += 2; // Skip both
                                    continue;
                                } else {
                                    // Pure addition
                                    for (let j = 0; j < count; j++) {
                                        const targetLine = newLineNum + j;
                                        const elem = document.getElementById(`adoc-source-line-${targetLine}`);
                                        if (elem) {
                                            elem.classList.add("visual-diff-added");
                                            const srSpan = document.createElement("span");
                                            srSpan.className = "visual-diff-sr-text";
                                            srSpan.style.cssText = srOnlyStyle;
                                            srSpan.innerText = "Added line: ";
                                            elem.insertBefore(srSpan, elem.firstChild);
                                        }
                                    }
                                    newLineNum += count;
                                }
                            } else {
                                newLineNum += count;
                            }
                            i++;
                        }
                    } catch (e) {
                        console.error("Diff failed", e);
                    }
                }, 0);
            }
        }
    }, [htmlContent, filePath, content, previousContent]);

    const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest("a");
        if (anchor && onLinkClick) {
            const internalPath = anchor.getAttribute("data-internal-path");
            if (internalPath) {
                e.preventDefault();
                onLinkClick(internalPath);
            }
        }
    };

    return (
        <div style={{ padding: "16px", background: "transparent", flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            <div 
                ref={contentRef}
                className={`asciidoc-content ${isDarkTheme ? 'is-dark-theme' : ''}`} 
                dangerouslySetInnerHTML={{ __html: htmlContent }} 
                style={{ padding: "16px", border: "1px solid var(--palette-neutral-8, #eaeaea)" }}
                onClick={handleContentClick}
            />
        </div>
    );
});
