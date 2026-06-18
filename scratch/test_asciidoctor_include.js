const Asciidoctor = require('@asciidoctor/core');
const asciidoctor = Asciidoctor();

const registry = asciidoctor.Extensions.create();

registry.includeProcessor(function () {
    this.handles((target) => true);
    this.process((doc, reader, target, attrs) => {
        console.log("Include intercepted:");
        console.log("  Target:", target);
        console.log("  Reader dir:", reader.dir);
        
        let dir = reader.dir || '.';
        let resolvedPath = dir + '/' + target;
        
        console.log("  Resolved:", resolvedPath);
        
        // Return dummy content
        if (target === 'b.adoc') {
            reader.pushInclude("This is B.\n\ninclude::c.adoc[]", target, dir, 1, attrs);
        } else if (target === 'c.adoc') {
            reader.pushInclude("This is C.", target, dir, 1, attrs);
        } else {
            reader.pushInclude("Unknown", target, dir, 1, attrs);
        }
    });
});

const content = `
= Title

This is A.

include::b.adoc[]
`;

const html = asciidoctor.convert(content, {
    safe: 'safe',
    extension_registry: registry,
    attributes: {
        docdir: '/root/dir'
    }
});

console.log("\nHTML Output:");
console.log(html);
