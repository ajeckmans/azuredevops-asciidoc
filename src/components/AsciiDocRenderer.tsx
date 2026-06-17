import * as React from "react";
import Asciidoctor from "@asciidoctor/core";
// @ts-ignore
import * as kroki from "asciidoctor-kroki";
import hljs from 'highlight.js';
import 'highlight.js/styles/default.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './AsciiDocRenderer.css';

const asciidoctor = Asciidoctor();
try {
    kroki.register(asciidoctor.Extensions);
} catch (e) {
    console.error("Failed to register kroki:", e);
}

export interface AsciiDocRendererProps {
    content: string;
    filePath: string;
    onLinkClick?: (path: string) => void;
}

export const AsciiDocRenderer: React.FC<AsciiDocRendererProps> = ({ content, filePath, onLinkClick }) => {
    const [isDarkTheme, setIsDarkTheme] = React.useState<boolean>(false);

    React.useEffect(() => {
        const updateTheme = () => {
            const textPrimary = getComputedStyle(document.body).getPropertyValue('--text-primary-color');
            if (textPrimary && (textPrimary.includes('255') || textPrimary.includes('fff') || textPrimary.toLowerCase().includes('rgba(255') || textPrimary.includes('250'))) {
                setIsDarkTheme(true);
            } else {
                setIsDarkTheme(false);
            }
        };

        // Check initially (wait a tick for SDK to apply variables)
        setTimeout(updateTheme, 100);

        window.addEventListener("themeApplied", updateTheme);
        return () => window.removeEventListener("themeApplied", updateTheme);
    }, []);

    const htmlContent = React.useMemo(() => {
        return asciidoctor.convert(content, { 
            safe: 'secure',
            attributes: { 
                showtitle: true,
                outfilesuffix: '.adoc',
                icons: 'font',
                'source-highlighter': 'highlight.js'
            } 
        }) as string;
    }, [content]);

    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (contentRef.current) {
            const blocks = contentRef.current.querySelectorAll('pre code');
            blocks.forEach((block) => {
                hljs.highlightElement(block as HTMLElement);
            });

            // Rewrite relative links to point to the correct Azure DevOps URL instead of the extension CDN
            const links = contentRef.current.querySelectorAll('a');
            links.forEach((anchor) => {
                const href = anchor.getAttribute("href");
                if (href && !href.startsWith("http") && !href.startsWith("#")) {
                    let resolvedPath = href;
                    if (!href.startsWith("/")) {
                        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
                        resolvedPath = dir + "/" + href;
                    }
                    const parts = resolvedPath.split('/');
                    const stack: string[] = [];
                    for (const part of parts) {
                        if (part === '..') {
                            stack.pop();
                        } else if (part !== '.' && part !== '') {
                            stack.push(part);
                        }
                    }
                    const finalPath = "/" + stack.join('/');

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
            });
        }
    }, [htmlContent, filePath]);

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
};
