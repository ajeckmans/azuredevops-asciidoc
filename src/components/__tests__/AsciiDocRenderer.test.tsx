import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock @asciidoctor/core before importing the component
const mockConvert = jest.fn().mockReturnValue("<h1>Mocked Content</h1>");
const mockIncludeProcessor = jest.fn();
const mockRegistry = {
    includeProcessor: mockIncludeProcessor
};

jest.mock("@asciidoctor/core", () => {
    return () => ({
        convert: mockConvert,
        Extensions: {
            create: () => mockRegistry
        }
    });
});
jest.mock("asciidoctor-kroki", () => ({
    register: jest.fn()
}));

import { AsciiDocRenderer } from "../AsciiDocRenderer";

describe("AsciiDocRenderer", () => {
    beforeEach(() => {
        mockConvert.mockClear();
        mockIncludeProcessor.mockClear();
    });

    it("calls asciidoctor.convert with safe: 'safe' mode", async () => {
        const content = "== Test Content";
        render(<AsciiDocRenderer content={content} filePath="/some/path.adoc" />);

        await waitFor(() => {
            expect(mockConvert).toHaveBeenCalledTimes(1);
        });

        expect(mockConvert).toHaveBeenCalledWith(content, expect.objectContaining({
            safe: 'safe'
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
});
