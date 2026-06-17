import * as React from "react";
import Asciidoctor from "@asciidoctor/core";
// @ts-ignore
import * as kroki from "asciidoctor-kroki";

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

    const htmlContent = React.useMemo(() => {
        return asciidoctor.convert(content, { 
            safe: 'secure',
            attributes: { 
                showtitle: true,
                outfilesuffix: '.adoc' 
            } 
        }) as string;
    }, [content]);

    const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest("a");
        if (anchor && onLinkClick) {
            const href = anchor.getAttribute("href");
            if (href && !href.startsWith("http") && !href.startsWith("#")) {
                e.preventDefault();
                // Resolve relative path
                let resolvedPath = href;
                if (!href.startsWith("/")) {
                    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
                    resolvedPath = dir + "/" + href;
                }
                
                // Normalize path (e.g., handle ./ and ../)
                const parts = resolvedPath.split('/');
                const stack: string[] = [];
                for (const part of parts) {
                    if (part === '..') {
                        stack.pop();
                    } else if (part !== '.' && part !== '') {
                        stack.push(part);
                    }
                }
                onLinkClick("/" + stack.join('/'));
            }
        }
    };

    return (
        <div style={{ padding: "16px", background: "var(--component-bg, white)", flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            <div 
                className="asciidoc-content" 
                dangerouslySetInnerHTML={{ __html: htmlContent }} 
                style={{ padding: "16px", border: "1px solid #eaeaea" }}
                onClick={handleContentClick}
            />
        </div>
    );
};
