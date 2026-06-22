const Asciidoctor = require('@asciidoctor/core')();
const registry = Asciidoctor.Extensions.create();
registry.block(function() {
  this.named('plantuml');
  this.onContext(['listing', 'literal', 'open']);
  this.process((parent, reader, attrs) => {
    const lines = reader.getLines().join('\n');
    return this.createBlock(parent, 'pass', '<div class="async-diagram" data-type="plantuml">' + Buffer.from(lines).toString('base64') + '</div>');
  });
});
const content = '[plantuml]\n----\nA -> B\n----';
console.log(Asciidoctor.load(content, {extension_registry: registry}).convert());
