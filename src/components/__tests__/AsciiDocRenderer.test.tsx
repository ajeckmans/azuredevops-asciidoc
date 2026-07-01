import * as React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock @asciidoctor/core before importing the component
const mockConvert = jest.fn().mockReturnValue("<h1>Mocked Content</h1>");
const mockLoad = jest.fn().mockReturnValue({
    findBy: () => [
        { getLineNumber: () => 1, setId: jest.fn() }
    ],
    convert: mockConvert
});
const mockIncludeProcessor = jest.fn();
const mockRegistry = {
    includeProcessor: mockIncludeProcessor
};

jest.mock("@asciidoctor/core", () => {
    return () => ({
        load: mockLoad,
        convert: mockConvert,
        Extensions: {
            create: () => mockRegistry
        }
    });
});
jest.mock("asciidoctor-kroki", () => ({
    register: jest.fn()
}));

const mockDiffLines = jest.fn().mockReturnValue([]);
jest.mock("diff", () => ({
    diffLines: (...args: any[]) => mockDiffLines(...args)
}));

import { AsciiDocRenderer } from "../AsciiDocRenderer";

describe("AsciiDocRenderer", () => {
    beforeEach(() => {
        mockConvert.mockClear();
        mockLoad.mockClear();
        mockIncludeProcessor.mockClear();
    });

    it("calls asciidoctor.load with safe: 'safe' mode and sourcemap: true", async () => {
        const content = "== Test Content";
        render(<AsciiDocRenderer content={content} filePath="/some/path.adoc" />);

        await waitFor(() => {
            expect(mockLoad).toHaveBeenCalledTimes(1);
        });

        expect(mockLoad).toHaveBeenCalledWith(content, expect.objectContaining({
            safe: 'safe',
            sourcemap: true
        }));
    });

    it("renders the converted html content", async () => {
        const { container } = render(<AsciiDocRenderer content="test" filePath="/some/path.adoc" />);
        
        await waitFor(() => {
            const asciidocDiv = container.querySelector('.asciidoc-content');
            expect(asciidocDiv).toBeInTheDocument();
            expect(asciidocDiv?.innerHTML).toBe("<h1>Mocked Content</h1>");
        });
    });

    it("handles link clicks via onLinkClick", async () => {
        const onLinkClick = jest.fn();
        mockConvert.mockReturnValueOnce('<a href="local-file.adoc" data-internal-path="/some/local-file.adoc">Link</a>');
        
        const { container } = render(<AsciiDocRenderer content="test" filePath="/some/path.adoc" onLinkClick={onLinkClick} />);
        
        await waitFor(() => {
            expect(container.querySelector('a')).toBeInTheDocument();
        });

        const link = container.querySelector('a');
        expect(link).not.toBeNull();
        if (link) {
            fireEvent.click(link);
            expect(onLinkClick).toHaveBeenCalledWith('/some/local-file.adoc');
        }
    });

    it("computes diff when previousContent is provided", async () => {
        mockDiffLines.mockReturnValue([
            { count: 1 }, // unchanged line
            { count: 1, removed: true }, // removed line
            { count: 1, added: true }, // added line
            { count: 1 } // unchanged line
        ]);

        // Mock the convert to return HTML with data-line-number so the diff logic finds it
        mockConvert.mockReturnValue(`
            <div class="sect1">
                <p id="adoc-source-line-1" data-line-number="1">line1</p>
                <p id="adoc-source-line-2" data-line-number="2">line2</p>
                <p id="adoc-source-line-3" data-line-number="3">line3</p>
            </div>
        `);
        
        const { container } = render(
            <AsciiDocRenderer 
                content="line1\nline2\nline3" 
                previousContent="line1\nlineold\nline3" 
                filePath="/some/path.adoc" 
            />
        );
        
        await waitFor(() => {
            const asciidocDiv = container.querySelector('.asciidoc-content');
            expect(asciidocDiv).toBeInTheDocument();
        });
        
        // Let's verify that the effect added the styles for the changed line 2
        await waitFor(() => {
            const p2 = container.querySelector('p[data-line-number="2"]');
            expect(p2).toHaveClass('visual-diff-changed');
        });
    });

    it("computes diff with pure additions", async () => {
        mockDiffLines.mockReturnValue([
            { count: 1 }, // unchanged line
            { count: 1, added: true } // added line
        ]);
        
        mockConvert.mockReturnValue(`
            <div class="sect1">
                <p id="adoc-source-line-1" data-line-number="1">line1</p>
                <p id="adoc-source-line-2" data-line-number="2">lineadded</p>
            </div>
        `);
        
        const { container: c2 } = render(
            <AsciiDocRenderer 
                content="line1\nlineadded\n" 
                previousContent="line1\n" 
                filePath="/some/path.adoc" 
            />
        );
        
        await waitFor(() => {
            expect(c2.querySelector('.visual-diff-added')).toBeInTheDocument();
        });
    });

    it("computes diff with pure deletions", async () => {
        mockDiffLines.mockReturnValue([
            { count: 1 }, // unchanged line
            { count: 1, removed: true } // removed line
        ]);
        
        mockConvert.mockReturnValue(`
            <div class="sect1">
                <p id="adoc-source-line-1" data-line-number="1">line1</p>
            </div>
        `);
        
        const { container: c3 } = render(
            <AsciiDocRenderer 
                content="line1\n" 
                previousContent="line1\nlinedeleted\n" 
                filePath="/some/path.adoc" 
            />
        );
        
        await waitFor(() => {
            expect(c3.querySelector('.visual-diff-deleted-marker')).toBeInTheDocument();
        });
    });
    it("handles include macros and fetches file content", async () => {
        const fetchFileContent = jest.fn().mockResolvedValue("included content");
        render(<AsciiDocRenderer content="include::header.adoc[]" filePath="/docs/main.adoc" fetchFileContent={fetchFileContent} />);
        
        await waitFor(() => {
            expect(fetchFileContent).toHaveBeenCalledWith("/docs/header.adoc");
        });
    });

    it("prevents path traversal above root in include macros", async () => {
        const fetchFileContent = jest.fn().mockResolvedValue("secret content");
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        render(<AsciiDocRenderer content="include::../../secret.txt[]" filePath="/docs/main.adoc" fetchFileContent={fetchFileContent} />);
        
        await waitFor(() => {
            expect(warnSpy).toHaveBeenCalledWith("Path traversal blocked: ../../secret.txt");
            expect(fetchFileContent).not.toHaveBeenCalled();
        });
        
        warnSpy.mockRestore();
    });

    it("prevents path traversal via absolute path starting with root", async () => {
        const fetchFileContent = jest.fn().mockResolvedValue("secret content");
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        render(<AsciiDocRenderer content="include::/../../secret.txt[]" filePath="/docs/main.adoc" fetchFileContent={fetchFileContent} />);

        await waitFor(() => {
            expect(warnSpy).toHaveBeenCalledWith("Path traversal blocked: /../../secret.txt");
            expect(fetchFileContent).not.toHaveBeenCalled();
        });

        warnSpy.mockRestore();
    });

    it("handles include fallback when fetchFileContent returns null or fails", async () => {
        const fetchFileContent = jest.fn().mockRejectedValue(new Error("fail"));
        render(<AsciiDocRenderer content="include::missing.adoc[]" filePath="/docs/main.adoc" fetchFileContent={fetchFileContent} />);
        
        await waitFor(() => {
            expect(fetchFileContent).toHaveBeenCalledWith("/docs/missing.adoc");
        });
    });
});
