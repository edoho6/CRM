import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { extractText, rtfToText } from '../../../scripts/library/lib/extract.mjs';
import { splitPdf } from '../../../scripts/library/lib/convert.mjs';

/**
 * The readers the loader uses for what is not a PDF or a .docx: RTF with
 * Hebrew in its two spellings, slides and sheets read out of their zip,
 * a book out of its EPUB — and the cut of a scanned PDF into parts.
 */

// The RTF is assembled from pieces so no editor or tool reads the escapes
// (ᔀ, \'f9) as anything but the seven ASCII characters they are.
const B = '\\';
const rtfOf = (...parts: string[]) => parts.join('');

describe('rtfToText', () => {
  it('decodes Hebrew written as code-page bytes and as unicode escapes, keeps paragraphs, drops the font table', () => {
    const rtf = rtfOf(
      '{', B, 'rtf1', B, 'ansi', B, 'ansicpg1255', B, 'deff0{', B, 'fonttbl{', B, 'f0 Arial;}}{', B, 'colortbl;', B, 'red0', B, 'green0', B, 'blue0;}\n',
      B, 'pard', B, 'rtlpar ', B, "'f9", B, "'ec", B, "'e5", B, "'ed ", B, "'f2", B, "'e5", B, "'ec", B, "'ed", B, 'par\n',
      B, 'pard ', B, 'u1500?', B, 'u1492? ', B, 'u1502?', B, 'u1512?', B, 'u1497?', B, 'par\n',
      '{', B, '*', B, 'generator Riched20}Plain', B, 'par}',
    );
    const text = rtfToText(Buffer.from(rtf, 'latin1'));
    expect(text).toBe('שלום עולם\nלה מרי\nPlain');
  });

  it('honours \\uc for the fallback bytes after a unicode escape, escaped braces and the non-breaking space', () => {
    const rtf = rtfOf('{', B, 'rtf1', B, 'ansi', B, 'uc2 a', B, 'u8364', B, "'80", B, "'80b ", B, '{x', B, '} ', B, '~y}');
    expect(rtfToText(Buffer.from(rtf, 'latin1'))).toBe('a€b {x}  y');
  });
});

async function zipOf(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('extractText', () => {
  it('reads slides in order, a paragraph a line', async () => {
    const buffer = await zipOf({
      'ppt/slides/slide2.xml': '<p:sld><p:txBody><a:p><a:r><a:t>Second </a:t></a:r><a:r><a:t>slide</a:t></a:r></a:p></p:txBody></p:sld>',
      'ppt/slides/slide1.xml': '<p:sld><p:txBody><a:p><a:r><a:t>כותרת</a:t></a:r></a:p><a:p><a:r><a:t>שורה &amp; עוד</a:t></a:r></a:p></p:txBody></p:sld>',
      'ppt/slides/slide10.xml': '<p:sld><p:txBody><a:p><a:r><a:t>Tenth</a:t></a:r></a:p></p:txBody></p:sld>',
    });
    const { pages, pageCount } = await extractText(buffer, 'pptx');
    expect(pageCount).toBe(3);
    expect(pages).toEqual([
      { page: 1, text: 'כותרת\nשורה & עוד' },
      { page: 2, text: 'Second slide' },
      { page: 3, text: 'Tenth' },
    ]);
  });

  it('reads a sheet with shared and inline strings and numbers, a row a line', async () => {
    const buffer = await zipOf({
      'xl/workbook.xml': '<workbook><sheets><sheet name="מינונים" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/sharedStrings.xml': '<sst><si><t>צמח</t></si><si><r><t>גרם</t></r><r><t> ליום</t></r></si></sst>',
      'xl/worksheets/sheet1.xml':
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Dang Gui</t></is></c><c r="B2"><v>9</v></c></row><row r="3"></row></sheetData></worksheet>',
    });
    const { pages } = await extractText(buffer, 'xlsx');
    expect(pages).toEqual([{ page: 1, text: '# מינונים\n\nצמח | גרם ליום\nDang Gui | 9' }]);
  });

  it('reads an EPUB in spine order and strips scripts', async () => {
    const buffer = await zipOf({
      'META-INF/container.xml': '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
      'OEBPS/content.opf':
        '<package><manifest><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="css" href="s.css" media-type="text/css"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>',
      'OEBPS/a.xhtml': '<html><body><h1>Chapter One</h1><p>First paragraph.</p><script>bad()</script></body></html>',
      'OEBPS/b.xhtml': '<html><body><p>Second chapter.</p></body></html>',
    });
    const { pages, pageCount } = await extractText(buffer, 'epub');
    expect(pageCount).toBe(2);
    expect(pages[0]).toEqual({ page: 1, text: '# Chapter One\n\nFirst paragraph.' });
    expect(pages[1]).toEqual({ page: 2, text: 'Second chapter.' });
  });

  it('says an image needs OCR, and that an unknown kind is unsupported', async () => {
    expect(await extractText(Buffer.from('x'), 'image')).toEqual({ pages: [], pageCount: null, note: 'no text layer (scanned?)' });
    expect((await extractText(Buffer.from('x'), 'zzz')).note).toBe('unsupported: zzz');
  });
});

describe('splitPdf', () => {
  it('cuts a PDF into parts of the given size and numbers the pages they start on', async () => {
    const source = await PDFDocument.create();
    for (let i = 0; i < 30; i += 1) source.addPage([200, 200]);
    const buffer = Buffer.from(await source.save());
    const parts = await splitPdf(buffer, 12);
    expect(parts.map((p) => [p.firstPage, p.lastPage])).toEqual([
      [1, 12],
      [13, 24],
      [25, 30],
    ]);
    const last = await PDFDocument.load(parts[2]!.buffer);
    expect(last.getPageCount()).toBe(6);
  });
});
