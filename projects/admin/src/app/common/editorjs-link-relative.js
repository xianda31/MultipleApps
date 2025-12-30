/**
 * Patch for EditorJS LinkTool to allow relative URLs
 * Usage: pass this as the LinkTool class in EditorJS config
 */
class LinkToolRelative {
  static get toolbox() {
    return {
      title: 'Link',
      icon: '<svg width="17" height="17"><path d="M7.5 1.5h2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4z" fill="none" stroke="#000"/></svg>'
    };
  }

  constructor({data}) {
    this.data = data;
  }

  render() {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Lien interne (front/...) ou externe (https://...)';
    input.value = this.data && this.data.link ? this.data.link : '';
    input.addEventListener('input', (e) => {
      let val = e.target.value;
      // Ne jamais préfixer http:// automatiquement
      this.data.link = val;
    });
    return input;
  }

  save(blockContent) {
    let link = blockContent.value;
    // Auto-correct: if link looks like 'front/...' (no protocol, no leading slash), prefix with '/'
    if (typeof link === 'string' &&
        /^[a-zA-Z0-9_\-]+\/.+/.test(link) &&
        !/^([a-zA-Z]+:\/\/|\/|\.\/|\.\.\/)/.test(link)) {
      link = '/' + link;
    }
    return {
      link
    };
  }

  validate(savedData) {
    // Accept relative links (start with /, ./, ../, or a word for internal route)
    if (!savedData.link) return false;
    // Accept: protocol://, /, ./, ../, or a string without spaces or protocol (ex: front/les_albums)
    return /^([a-zA-Z]+:\/\/|\/|\.\/|\.\.\/|[a-zA-Z0-9_\-]+\/.+)/.test(savedData.link);
  }
}

window.LinkToolRelative = LinkToolRelative;
