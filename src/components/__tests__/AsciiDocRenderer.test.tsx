import * as React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock @asciidoctor/core before importing the component
const mockConvert = jest.fn().mockReturnValue("<h1>Mocked Content</h1>");
jest.mock("@asciidoctor/core", () => {
    return () => ({
        convert: mockConvert,
        Extensions: {}
    });
});
jest.mock("asciidoctor-kroki", () => ({
    register: jest.fn()
}));

import { AsciiDocRenderer } from "../AsciiDocRenderer";

describe("AsciiDocRenderer", () => {
    beforeEach(() => {
        mockConvert.mockClear();
    });

    it("calls asciidoctor.convert with safe: 'secure' mode", () => {
        const content = "== Test Content";
        render(<AsciiDocRenderer content={content} filePath="/some/path.adoc" />);

        expect(mockConvert).toHaveBeenCalledTimes(1);
        expect(mockConvert).toHaveBeenCalledWith(content, expect.objectContaining({
            safe: 'secure'
        }));
    });

    it("renders the converted html content", () => {
        const { container } = render(<AsciiDocRenderer content="test" filePath="/some/path.adoc" />);
        const asciidocDiv = container.querySelector('.asciidoc-content');
        expect(asciidocDiv).toBeInTheDocument();
        expect(asciidocDiv?.innerHTML).toBe("<h1>Mocked Content</h1>");
    });
});
