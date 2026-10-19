import { sanitizeSnippetHtml } from './snippet-html-sanitizer';

describe('sanitizeSnippetHtml', () => {
  it('removes pasted fonts, sizes, classes and event handlers', () => {
    const html = '<p class="MsoNormal" style="font-family:Calibri;font-size:11pt;line-height:2" onclick="alert(1)">Texte</p>';

    expect(sanitizeSnippetHtml(html)).toBe('<p>Texte</p>');
  });

  it('keeps semantic formatting, safe links and the configured text color', () => {
    const html = '<p><strong>Important</strong> <span class="foreign" style="color:#dc3545;font-size:20px">rouge</span> <a href="/front/news" target="_blank">suite</a></p>';

    expect(sanitizeSnippetHtml(html)).toBe(
      '<p><strong>Important</strong> <span style="color: rgb(220, 53, 69);">rouge</span> <a href="/front/news">suite</a></p>'
    );
  });

  it('drops dangerous elements and URL protocols', () => {
    const html = '<p>Avant<script>alert(1)</script><a href="javascript:alert(1)">lien</a>Après</p>';

    expect(sanitizeSnippetHtml(html)).toBe('<p>Avant<a>lien</a>Après</p>');
  });

  it('keeps only application table classes and valid spans', () => {
    const html = '<table class="table table-sm foreign"><tr><td colspan="2" style="width:200px">Cellule</td></tr></table>';

    expect(sanitizeSnippetHtml(html)).toBe(
      '<table class="table table-sm"><tbody><tr><td colspan="2">Cellule</td></tr></tbody></table>'
    );
  });

  it('unwraps unknown layout elements without losing their text', () => {
    expect(sanitizeSnippetHtml('<div><section><p>Contenu</p></section></div>')).toBe('<p>Contenu</p>');
  });
});
